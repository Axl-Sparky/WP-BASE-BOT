const config = require('config');
const SUDO = config.get('SUDO');
const PREFIX = config.get('PREFIX');
const {
	getContentType,
	jidDecode,
	downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const fs = require('fs');

const decodeJid = (jid) => {
	if (!jid) return jid;
	if (/:\d+@/gi.test(jid)) {
		const decode = jidDecode(jid) || {};
		return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
	} else {
		return jid;
	}
};

const downloadMedia = (message, pathFile) =>
	new Promise(async (resolve, reject) => {
		let type = Object.keys(message)[0];
		let mimeMap = {
			imageMessage: "image",
			videoMessage: "video",
			stickerMessage: "sticker",
			documentMessage: "document",
			audioMessage: "audio",
		};
		let mes = message;
		if (type == "templateMessage") {
			mes = message.templateMessage.hydratedFourRowTemplate;
			type = Object.keys(mes)[0];
		}
		if (type == "buttonsMessage") {
			mes = message.buttonsMessage;
			type = Object.keys(mes)[0];
		}
		try {
			if (pathFile) {
				const stream = await downloadContentFromMessage(mes[type], mimeMap[type]);
				let buffer = Buffer.from([]);
				for await (const chunk of stream) {
					buffer = Buffer.concat([buffer, chunk]);
				}
				await fs.promises.writeFile(pathFile, buffer);
				resolve(pathFile);
			} else {
				const stream = await downloadContentFromMessage(mes[type], mimeMap[type]);
				let buffer = Buffer.from([]);
				for await (const chunk of stream) {
					buffer = Buffer.concat([buffer, chunk]);
				}
				resolve(buffer);
			}
		} catch (e) {
			reject(e);
		}
	});

const isAdmin = async (jid, user, client) => {
	const groupMetadata = await client.groupMetadata(jid);
	const groupAdmins = groupMetadata.participants
		.filter((participant) => participant.admin !== null)
		.map((participant) => participant.id);
	return groupAdmins.includes(decodeJid(user));
}

async function serialize(m, client) {

	if (m.key) {
		m.id = m.key.id;
		m.isSelf = m.key.fromMe;
		m.userId = m.key.remoteJid;
		m.isGroup = m.userId.endsWith("@g.us");
		m.senderName = m.pushName || "Unknown";
		m.sender = m.isGroup ? m.key.participant : m.isSelf ? client.user.id : m.userId;
	}
	m.botNumber = client?.user?.id?.replace(/:[^@]*/, '');
	m.botIsAdmin = m.isGroup ? await isAdmin(m?.userId, m?.botNumber, client) : false;
	if (!PREFIX || PREFIX === "false" || PREFIX === "null") {
		m.prefix = "";
	} else {
		m.prefix = PREFIX;
	}

	if (m.message) {
		m.type = await getContentType(m.message);
		if (m.type === "ephemeralMessage") {
			m.message = m.message[m.type].message;
			const tipe = Object.keys(m.message)[0];
			m.type = tipe;
			if (tipe === "viewOnceMessage") {
				m.message = m.message[m.type].message;
				m.type = await getContentType(m.message);
			}
		}
		if (m.type === "viewOnceMessage") {
			m.message = m.message[m.type].message;
			m.type = await getContentType(m.message);
		}
		try {
			m.mentions = m.message[m.type].contextInfo ? m.message[m.type].contextInfo.mentionedJid || [] : [];
		} catch {
			m.mentions = false;
		}
		try {
			const quoted = m.message[m.type].contextInfo;
			let type;
			if (quoted && quoted.quotedMessage) {
				if (quoted.quotedMessage["ephemeralMessage"]) {
					type = Object.keys(quoted.quotedMessage.ephemeralMessage.message)[0];
					m.quoted = {
						type: type === "viewOnceMessage" ? "view_once" : "ephemeral",
						stanzaId: quoted.stanzaId,
						sender: quoted.participant,
						message: type === "viewOnceMessage" ?
							quoted.quotedMessage.ephemeralMessage.message.viewOnceMessage
							.message : quoted.quotedMessage.ephemeralMessage.message,
					};
				} else if (quoted.quotedMessage["viewOnceMessage"]) {
					m.quoted = {
						type: "view_once",
						stanzaId: quoted.stanzaId,
						sender: quoted.participant,
						message: quoted.quotedMessage.viewOnceMessage.message,
					};
				} else {
					m.quoted = {
						type: "normal",
						stanzaId: quoted.stanzaId,
						sender: quoted.participant,
						message: quoted.quotedMessage,
					};
				}
				m.quoted.isSelf = m.quoted.sender === client.user.id;
				m.quoted.mtype = Object.keys(m.quoted.message);
				m.quoted.text = m.quoted.message[m.quoted.mtype]?.text || m.quoted.message[m.quoted.mtype]?.description || m.quoted.message[m.quoted.mtype]?.caption || (m.quoted.mtype === "templateButtonReplyMessage" && m.quoted.message[m.quoted.mtype].hydratedTemplate?.hydratedContentText) || m.quoted.message[m.quoted.mtype] || "";
				m.quoted.key = {
					id: m.quoted.stanzaId,
					fromMe: m.quoted.isSelf,
					remoteJid: m.userId,
					participant: quoted.participant
				};
				m.quoted.download = (pathFile) =>
					downloadMedia(m.quoted.message, pathFile);
			}
		} catch {
			m.quoted = null;
		}
	}

	try {
		m.text = m.message.conversation || m.message[m.type].text || m.message[m.type].selectedId;
		m.body = m.message.conversation || m.message[m.type].text || m.message[m.type].caption ||
			(m.type === "listResponseMessage" && m.message[m.type].singleSelectReply.selectedRowId) ||
			(m.type === "buttonsResponseMessage" && m.message[m.type].selectedButtonId) ||
			(m.type === "templateButtonReplyMessage" && m.message[m.type].selectedId) || false;
	} catch {
		m.body = false;
	}
	m.sudo = SUDO.split(",").includes(m?.sender?.split("@")[0]) || SUDO.split(",").includes(m?.quoted?.sender?.split("@")[0]) || m?.isSelf;
	m.isGrpAdmin = async (jid, sender) => {
		return await isAdmin(jid, sender, client);
	}
	m.groupAction = async (jid, type) => {
		switch (type.toLowerCase()) {
			case 'invite': {
				return await client.sendMessage(m.userId, {
					text: `https://chat.whatsapp.com/${await client.groupInviteCode(jid)}`
				}, {
					quoted: m
				});
			}
			break;
			case 'tagall': {
				const getParticipants = await client.groupMetadata(jid);
				const participants = getParticipants.participants
					.map((i, index) => `${i.id}`);
				return participants;
			}
			break;
			default:
		}
	}
  m.runtime = async () => {
			seconds = Number(`${process.uptime()}`);
			var d = Math.floor(seconds / (3600 * 24));
			var h = Math.floor(seconds % (3600 * 24) / 3600);
			var m = Math.floor(seconds % 3600 / 60);
			var s = Math.floor(seconds % 60);
			var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
			var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
			var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
			var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
			return dDisplay + hDisplay + mDisplay + sDisplay;
		}
		m.uptime = async () => {
			const duration = process.uptime();
			const seconds = Math.floor(duration % 60);
			const minutes = Math.floor((duration / 60) % 60);
			const hours = Math.floor((duration / (60 * 60)) % 24);
			const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
                        .toString()
                        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
			return formattedTime;
		}
	return m;
}

module.exports = {
	serialize
};
