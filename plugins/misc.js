const {
	bot,
	language
} = require('../src');
const lang = language('misc');

bot.createPlugin({
		alias: "ping",
		fromMe: false,
		usage: lang.ping_usage,
		type: "misc"
	},
	async ({
		m
	}) => {
		const startTime = Date.now();
		const msg = await m.send(m.userId, "```Ping!```", {
			quoted: m
		});
		const endTime = Date.now();
		const delay = endTime - startTime;
		return await m.send(m.userId, `_Latency: ${delay} ms_`, {
			edit: msg.key
		});
	});
