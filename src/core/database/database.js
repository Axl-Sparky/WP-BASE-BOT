const mongoose = require('mongoose');

const database = {
	async connect(URI) {
		if (!URI || typeof URI !== 'string' || URI.trim() === '') {
			console.log("Invalid or empty MongoDB URI provided.");
			return;
		}
		try {
			await mongoose.connect(URI);
			console.log("Successfully established a connection to MongoDB.");
		} catch (e) {
			console.log("Unable to establish a connection to MongoDB.");
			console.error(e);
		}
	}
};

module.exports = {
	database
};
