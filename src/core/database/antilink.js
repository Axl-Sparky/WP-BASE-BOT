const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
	groupId: {
		type: String,
		required: true
	},
	userId: {
		type: String,
		required: true
	},
	warnings: {
		type: Number,
		default: 0
	}
});

module.exports = mongoose.model('Warning', warningSchema);
