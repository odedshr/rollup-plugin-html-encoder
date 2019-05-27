const assert = require('assert'),
	rollup = require('rollup'),
	html = require('../dist/rollup-plugin-html-encoder.js');

require('source-map-support').install();

process.chdir(__dirname);

describe('rollup-plugin-html-encoder', () => {
	it('converts html', () => {
		return rollup
			.rollup({
				input: 'samples/main.js',
				plugins: [html()]
			})
			.then(bundle => bundle.generate({ format: 'cjs' }))
			.then(({ output }) => {
				assert.ok(output[0].code.indexOf("console.log('html: ', Node())") > -1, 'Rollup passed with no problems');
			});
	});
});
