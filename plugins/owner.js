const {
	bot,
        language
} = require('../src');
const lang = language('owner');
const util = require("util");

bot.createPlugin({
		alias: "eval",
	        hideAlias: false,
		fromMe: true,
		usage: lang.eval_usage,
		type: "owner"
	},
	async ({
	}) => {
	});

bot.createPlugin({
		on: "text",
		fromMe: true,
	        hideAlias: true
	},
	async ({
		client,
		m,
		input
	}) => {
		if (input.startsWith("$")) {
			try {
				let evaled = await eval(`(async () => { ${input.replace("$", "")} })()`);
				if (typeof evaled !== "string") evaled = util.inspect(evaled);
				await m.reply(`${evaled}`)
			} catch (err) {
				await m.reply(`${util.format(err)}`);
			}
		}
	});
