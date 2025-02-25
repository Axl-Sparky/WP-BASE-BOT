const {
	sizeFormatter
} = require('human-readable');

exports.formatp = sizeFormatter({
std: 'JEDEC',
decimalPlaces: 2,
keepTrailingZeroes: false,
render: (literal, symbol) => `${literal} ${symbol}B`,
});
