const {
  configurator
} = require('./core');
const modules = []

const bot = {
	async createPlugin(Info, func) {
		const moduleInfo = Info;
		moduleInfo.function = func;
		let prefix = await configurator.getPrefix();
		if (moduleInfo.alias) {
			moduleInfo.alias = new RegExp(`${prefix}( ?${moduleInfo.alias})`, `is`);
		}
		if (Info['on'] === undefined && Info['alias'] === undefined) {
			moduleInfo.on = 'message';
		}
		if (!(moduleInfo.alias === undefined && moduleInfo.alias)) {
			moduleInfo.hideAlias = false;
		}
		if (moduleInfo.on) {
			moduleInfo.hideAlias = true;
		}
		moduleInfo.fromMe = moduleInfo.fromMe || false;
		moduleInfo.usage = moduleInfo.usage || "No description provided.";
		moduleInfo.type = moduleInfo.type || "misc";

		modules.push(moduleInfo);
		return moduleInfo;
	}
}

module.exports = {
	bot,
	modules
}
