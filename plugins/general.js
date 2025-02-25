const {
	bot,
        language,
	modules,
	formatp,
	timeUtils
} = require('../src');
const lang = language('general');
const os = require('os');

bot.createPlugin({
		alias: "menu",
		fromMe: false,
		usage: lang.menu_usage,
		type: "general"
	},
	async ({
		m,
		client,
		input
	}) => {
		try {
			if (input) {
				for (let i of modules) {
					if (i.alias.test(input)) {
						return m.reply(`Command : ${input.trim()}\nDescription : ${i.desc}`);
					}
				}
				return m.reply("Oops command not found")
			} else {
				let {
					date,
					time
				} = await timeUtils.extractDateTime(m?.sender);
				let menu = ``;
				menu += `👤 *User :* _${m?.senderName ? m?.senderName : "Unknown"}_
📅 *Date :* _${date}_
⏰ *Time :* _${time}_
🔣 *Prefix :* _${m?.prefix}_
💾 *Ram :* _${formatp(os.totalmem() - os.freemem())}/${formatp(os.totalmem())}_
🔢 *Total Commands :* _${modules.length}_\n\n`;
				let cmnd = [];
				let cmd, usage;
				let category = [];
				modules.map((command, num) => {

					if (command.alias) {
						let cmdName = command.alias
						cmd = cmdName.source.split('( ?')[1]
							.toString()
							.match(/(\W*)([A-Za-züşiğ öç1234567890]*)/)[2];
					}
					usage = command.usage
					if (command.hideAlias || cmd === undefined) return;

					if (!command.hideAlias && cmd !== undefined) {
						let type;
						if (!command.type) {
							type = "misc";
						} else {
							type = command.type.toLowerCase();
						}
						cmnd.push({
							cmd,
							usage,
							type: type
						});
						if (!category.includes(type)) category.push(type);
					}
				});
				cmnd.sort();
				category.sort().forEach((cmmd) => {
					menu += `\n *${cmmd.toUpperCase()}*\n\n`
					let comad = cmnd.filter(({
						type
					}) => type == cmmd)
					comad.sort()
					comad.forEach(({
						cmd,
						usage
					}, num) => {
						menu += `\`${m.prefix ? m.prefix : ""}${cmd}\` — _${usage}_\n`;
					});
				});
				await m.reply(menu)
			}
		} catch (e) {
			console.log(`${e}`)
		}
	});
