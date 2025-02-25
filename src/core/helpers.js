const config = require('config');
const PREFIX = config.get('PREFIX');
const ffmpeg = require('fluent-ffmpeg');
const webp = require('node-webpmux');
const {
	parsePhoneNumberFromString
} = require('libphonenumber-js');
const ct = require('countries-and-timezones');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const os = require('os');

const processMedia = {
	async createTempFile(fileBuffer, extension) {
		const dir = os.tmpdir();
		const tempFilePath = path.join(dir, `tempfile-${Date.now()}.${extension}`);
		await fs.writeFileSync(tempFilePath, fileBuffer);
		return tempFilePath;
	},
	async createFile(extension) {
		const dir = os.tmpdir();
		const tempFileName = `tempfile-${Date.now()}.${extension}`;
		const tempFilePath = path.join(dir, tempFileName);
		return tempFilePath;
	},
	async addStickerMetaData(stickerBuffer, options) {
		const img = new webp.Image();
		const {
			packName,
			authorName,
			categories
		} = options;
		const stickerPackId = [...Array(32)].map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
		const json = {
			'sticker-pack-id': stickerPackId,
			'sticker-pack-name': (options.packName || ''),
			'sticker-pack-publisher': (options.authorName || ''),
			'emojis': (options.categories || ['💖']),
			'android-app-store-link': 'https://github.com/KichuExe',
			'ios-app-store-link': 'https://github.com/KichuExe'
		};
		let exifAttr = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
		let jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
		let exif = Buffer.concat([exifAttr, jsonBuffer]);
		exif.writeUIntLE(jsonBuffer.length, 14, 4);
		await img.load(stickerBuffer)
		img.exif = exif
		return await img.save(null)
	},
	async addExifToWebP(buffer, options) {
		const outputFilePath = await this.createFile('webp');
		const inputFilePath = await this.createTempFile(buffer, "webp");
		if (options.packName || options.authorName) {
			const img = new webp.Image();
			const json = {
				"sticker-pack-id": `https://github.com/KichuExe`,
				"sticker-pack-name": options.packName,
				"sticker-pack-publisher": options.authorName,
				emojis: options.categories ? options.categories : [""],
			};
			const exifAttr = await Buffer.from([
				0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
				0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
			]);
			const jsonBuff = await Buffer.from(JSON.stringify(json), "utf-8");
			const exif = await Buffer.concat([exifAttr, jsonBuff]);
			await exif.writeUIntLE(jsonBuff.length, 14, 4);
			await img.load(inputFilePath);
			img.exif = exif;
			await img.save(outputFilePath);
			const stickerBuffer = fs.readFileSync(outputFilePath);
			return stickerBuffer;
		}
	},
	async imgToWebP(buffer, exif) {
		const outputFilePath = await this.createFile('webp');
		const inputFilePath = await this.createTempFile(buffer, "jpg");
		await new Promise((resolve, reject) => {
			ffmpeg(inputFilePath)
				.on('error', (err) => {
					console.error('Error during conversion:', err);
					reject(err);
				})
				.on('end', () =>
					resolve(true))
				.addOutputOptions([
					'-vcodec',
					'libwebp',
					"-vf",
					"scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse"
				])
				.toFormat('webp')
				.save(outputFilePath);
		});
		const buff = fs.readFileSync(outputFilePath);
		fs.unlinkSync(outputFilePath);
		fs.unlinkSync(inputFilePath);
		if (!exif) {
			return buff;
		} else {
			return await this.addStickerMetaData(
				buff, {
					packName: exif.packName,
					authorName: exif.authorName
				}
			);
		}
	},
	async vidToWebP(buffer, exif) {
		const outputFilePath = await this.createFile('webp');
		const inputFilePath = await this.createTempFile(buffer, "mp4");
		await new Promise((resolve, reject) => {
			ffmpeg(inputFilePath)
				.on('error', (err) => {
					console.error('Error during conversion:', err);
					reject(err);
				})
				.on('end', () =>
					resolve(true))
				.addOutputOptions([
					"-vcodec",
					"libwebp",
					"-vf",
					"scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse",
					"-loop",
					"0",
					"-ss",
					"00:00:00",
					"-t",
					"00:00:05",
					"-preset",
					"default",
					"-an",
					"-vsync",
					"0"
				])
				.toFormat('webp')
				.save(outputFilePath);
		});
		const buff = fs.readFileSync(outputFilePath);
		fs.unlinkSync(outputFilePath);
		fs.unlinkSync(inputFilePath);
		if (!exif) {
			return buff;
		} else {
			return await this.addStickerMetaData(
				buff, {
					packName: exif.packName,
					authorName: exif.authorName
				}
			);
		}
	}
}

const timeUtils = {
	async fetchTimeZone(phoneNumber) {
		if (!phoneNumber.startsWith('+')) {
			phoneNumber = '+' + phoneNumber;
		}
		const parsedNumber = await parsePhoneNumberFromString(phoneNumber);
		if (parsedNumber) {
			const country = parsedNumber.country;
			const countryData = await ct.getCountry(country);
			if (countryData) {
				const timezones = countryData.timezones;
				return timezones[0];
			}
		}
		return null;
	},
	async extractDateTime(phoneNumber) {
		const userTimeZone = await this.fetchTimeZone(phoneNumber);
		let result = {};
		try {
			if (userTimeZone) {
				const now = moment.tz(userTimeZone);
				const date = now.format('DD/MM/YYYY');
				const time = now.format('hh:mm:ss A');
				result = {
					date,
					time
				}
			}
			return result;
		} catch (e) {
			console.log(e);
		}
	}
};

const configurator = {
	async getPrefix() {
		if (!PREFIX || PREFIX === "false" || PREFIX === "null") {
			return "^";
		} else {
			return `^[${PREFIX}]`;
		}
	}
};

async function isUrl(url) {
	return new RegExp(
		/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
		"gi"
	).test(url);
};

module.exports = {
	configurator,
	processMedia,
	timeUtils,
	isUrl
};
