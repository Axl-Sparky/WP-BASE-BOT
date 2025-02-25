const {
	getContentType,
	generateWAMessageFromContent,
	generateForwardMessageContent
} = require('@whiskeysockets/baileys');
const {
	fromBuffer
} = require('file-type');
const fetch = require('node-fetch');
const fs = require('fs');
const config = require('config');
const SUDO = config.get('SUDO');
const LOGS = config.get('LOGS');
const {
	serialize
} = require('./serialize');
const {
	modules
} = require('./modules');
const {
	processMedia,
  isUrl
} = require('./core');

const message = {
	async initMessageHandler(client, msg) {
		if (msg.type !== "notify") return;
		let m = await serialize(JSON.parse(JSON.stringify(msg.messages[0])), client);
		m = await this.handleMessage(m, client);
		if (LOGS) {
			var groupName = m.isGroup ? (await client.groupMetadata(m.userId)).subject : null;
			console.log("--- New Message ---");
			if (m.isGroup) {
				console.log(`Message at : ${groupName}`);
			} else {
				console.log(`Message at : ${m.userId}`);
			}
			console.log(`Sender Name : ${m.senderName}`);
			console.log(`Message : ${m.body ? m.body : m.type}`);
			console.log("---------------------");
		}
		modules.map(async (botmodule) => {

			if (botmodule.fromMe && !m.sudo) return;

			let command = m.text ? m.body[0].toLowerCase() + m.body.slice(1).trim() : "";
			let input;
			switch (true) {
				case botmodule.alias && botmodule.alias.test(command):
					input = m.body.replace(new RegExp(botmodule.alias, "i"), "").trim();
					botmodule.function({
						m,
						input,
						client
					});
					break;

				case m.body && botmodule.on === "text":
					input = m.body
					botmodule.function({
						m,
						input,
						client
					});
					break;

				case botmodule.on === "image" || botmodule.on === "photo":
					if (m.type === "imageMessage") {
						botmodule.function({
							m,
							client
						});
					}
					break;

				case botmodule.on === "sticker":
					if (m.type === "stickerMessage") {
						botmodule.function({
							m,
							client
						});
					}
					break;

				case botmodule.on === "video":
					if (m.type === "videoMessage") {
						botmodule.function({
							m,
							client
						});
					}
					break;
				default:
					break;
			}
		});
	},
	async handleMessage(m, client) {
		m.getFile = async (PATH, returnAsFilename) => {
			let res,
				filename;
			let data = Buffer.isBuffer(PATH) ?
				PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ?
				Buffer.from(PATH.split`,` [1], "base64") : /^https?:\/\//.test(PATH) ?
				await (res = await fetch(PATH)).buffer() : fs.existsSync(PATH) ?
				((filename = PATH), fs.readFileSync(PATH)) : typeof PATH === "string" ?
				PATH : Buffer.alloc(0);
			if (!Buffer.isBuffer(data)) throw console.log("Result is not a buffer");
			let type = (await fromBuffer(data)) || {
				mime: "application/octet-stream",
				ext: ".bin",
			};
			if (data && returnAsFilename && !filename)
				(filename = path.join(
					__dirname,
					"../" + new Date() * 1 + "." + type.ext
				)),
				await fs.promises.writeFile(filename, data);
			return {
				res,
				filename,
				...type,
				data,
			};
		}

		m.send = async (jid, content, opt = {}, type = "text") => {
			{
				switch (type.toLowerCase()) {
					case "text": {
						return client.sendMessage(jid, {
							text: content,
							...opt,
						}, {
							...opt
						});
					}
					break;
					case "image": {
						if (Buffer.isBuffer(content)) {
							return client.sendMessage(jid, {
								image: content,
								...opt
							}, {
								...opt
							});
						} else if (isUrl(content)) {
							let media = await (await fetch(content)).buffer()
							return client.sendMessage(jid, {
								image: media,
								...opt
							}, {
								...opt
							});
						}
					}
					break;
					case "video": {
						if (Buffer.isBuffer(content)) {
							return client.sendMessage(jid, {
								video: content,
								...opt
							}, {
								...opt
							});
						} else if (isUrl(content)) {
							let media = await (await fetch(content)).buffer()
							return client.sendMessage(jid, {
								video: media,
								...opt
							}, {
								...opt
							});
						}
					}
					break;
					case "audio": {
						if (Buffer.isBuffer(content)) {
							return client.sendMessage(jid, {
								audio: content,
								...opt
							}, {
								...opt
							});
						} else if (isUrl(content)) {
							let media = await (await fetch(content)).buffer()
							return client.sendMessage(jid, {
								audio: media,
								...opt
							}, {
								...opt
							});
						}
					}
					break;
					case "sticker": {
						let {
							data,
							mime
						} = await m.getFile(content);
						let toSticker;
						if (mime === "image/webp") {
							toSticker = await processMedia.addExifToWebP(data, {
								packName: opt.packName,
								authorName: opt.authorName
							});
						} else if (mime.split("/")[0] === "image") {
							toSticker = await processMedia.imgToWebP(data, {
								packName: opt.packName,
								authorName: opt.authorName
							});
						} else if (mime.split("/")[0] === "video") {
							toSticker = await processMedia.vidToWebP(data, {
								packName: opt.packName,
								authorName: opt.authorName
							});
						}
						return await client.sendMessage(jid, {
								sticker: toSticker,
								...opt
							},
							opt
						);
					}
					break;
				}
			}
		}
		m.forwardMessage = async (targetJid, message, options = {}) => {
			let contentType;
			let content = message;
			if (options.readViewOnce) {
				content = content && content.ephemeralMessage && content.ephemeralMessage.message ? content.ephemeralMessage.message : content || undefined;
				const viewOnceKey = Object.keys(content)[0];
				delete(content && content.ignore ? content.ignore : content || undefined);
				delete content.viewOnceMessage.message[viewOnceKey].viewOnce;
				content = {
					...content.viewOnceMessage.message
				};
			}
			if (options.mentions) {
				content[contentType].contextInfo.mentionedJid = options?.mentions;
			}
			const forwardContent = await generateForwardMessageContent(content, false);
			contentType = await getContentType(forwardContent);
			if (options.ptt) forwardContent[contentType].ptt = options?.ptt;
			if (options.audiowave) forwardContent[contentType].waveform = options?.audiowave;
			if (options.seconds) forwardContent[contentType].seconds = options?.seconds;
			if (options.fileLength) forwardContent[contentType].fileLength = options?.fileLength;
			if (options.caption) forwardContent[contentType].caption = options?.caption;
			if (options.contextInfo) forwardContent[contentType].contextInfo = options?.contextInfo;
			if (options.mentions) forwardContent[contentType].contextInfo.mentionedJid = options.mentions;

			let contextInfo = {};
			if (contentType != "conversation") {
				contextInfo = message.message[contentType]?.contextInfo;
			}
			forwardContent[contentType].contextInfo = {
				...contextInfo,
				...forwardContent[contentType]?.contextInfo
			};

			const waMessage = await generateWAMessageFromContent(targetJid, forwardContent, options ? {
				...forwardContent[contentType],
				...options,
				...(options?.contextInfo ? {
					'contextInfo': {
						...forwardContent[contentType].contextInfo,
						...options?.contextInfo
					}
				} : {})
			} : {});
			return await client.relayMessage(targetJid, waMessage.message, {
				'messageId': waMessage.key.id
			});
		}
		m.reply = async (txt) => {
			await client.sendMessage(m.userId, {
				text: txt
			}, {
				quoted: m
			});
		}
		m.deleteMessage = async (jid, option) => {
			return await client.sendMessage(jid, {
				delete: option.deleteMessage
			});
		}
		return m;
	}
}

module.exports = {
	message
}
