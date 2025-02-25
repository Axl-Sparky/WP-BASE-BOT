const {
	default: makeWASocket,
	useMultiFileAuthState,
	DisconnectReason,
	makeInMemoryStore,
	Browsers
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const config = require('config');
const PLATFORM = config.get('PLATFORM');
const MONGODB_URI = config.get('MONGODB_URI');
const path = require('path');
const pino = require('pino');
const https = require('https');
const {
	message,
	database
} = require('./src');

if (PLATFORM === "KOYEB" || PLATFORM === "koyeb" || PLATFORM === "Koyeb") {
	require('http')
		.createServer(async (req, res) => {})
		.listen(process.env?.PORT || 8080, () => true)
}

(async () => {
	await database.connect(MONGODB_URI);
})();

async function connectTextron() {
	const {
		state,
		saveCreds
	} = await useMultiFileAuthState('./src/core/session');
	const client = makeWASocket({
		auth: state,
		browser: Browsers.macOS("Chrome"),
		logger: pino({
			level: "silent"
		}),
		syncFullHistory: false,
		printQRInTerminal: true,
		version: [2, 3000, 1015901307],
		getMessage: async (key) => {
			if (store) {
				const msg = await store.loadMessage(key.remoteJid, key.id).catch(() => null);
				return msg?.message || {
					conversation: "Fallback message."
				};
			}
			return {
				conversation: "Fallback message."
			};
		}
	});
	const store = makeInMemoryStore({
		logger: pino().child({
			level: 'silent',
			stream: 'store'
		})
	});
	store.bind(client.ev);

	setInterval(() => {
		store.writeToFile("./src/core/session/store.json");
	}, 30 * 1000);

	client.ev.on('connection.update', async (update) => {
		const {
			connection
		} = update;
		if (connection === "open") {
			fs.readdirSync("./modules").forEach((module) => {
				if (path.extname(module).toLowerCase() == ".js") {
					import("./modules/" + module);
				}
			});
			console.log("Modules Installed!.");
			console.log("Connected to whatsapp!");
		} else if (connection === "close") {
			console.log("Connection closed: Reconnecting...");
			setTimeout(async () => {
				await connectTextron();
			}, 3000);
		}
	});

	client.ev.on('messages.upsert', async (m) => {
		await message.initMessageHandler(client, m);
	});
	client.ev.on('group-participants.update', async (update) => {
		const {
			id,
			participants,
			action
		} = update;
	});
	client.ev.on('creds.update', saveCreds);

}
setTimeout(async () => {
	await connectTextron();
}, 2000);
