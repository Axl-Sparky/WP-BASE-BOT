const config = require('config');
const LANGUAGE = config.get('LANGUAGE');
const fs = require('fs');
const path = require('path');

const loadLanguageFile = () => {
	const languageFilePath = path.join(__dirname, 'language', `${LANGUAGE.toLowerCase()}.json`);
	const defaultFilePath = path.join(__dirname, 'language', 'en.json');
	if (fs.existsSync(languageFilePath)) {
		return JSON.parse(fs.readFileSync(languageFilePath, 'utf-8'));
	} else {
		console.warn(`Language file for "${LANGUAGE.toLowerCase()}" not found, so defaulting to English.`);
		return JSON.parse(fs.readFileSync(defaultFilePath, 'utf-8'));
	}
};

const json = loadLanguageFile();

function language(section) {
	return json['data'][section] || {};
}

module.exports = {
	language
};
