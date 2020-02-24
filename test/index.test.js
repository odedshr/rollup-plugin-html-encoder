const assert = require('assert');
const rollup = require('rollup');
const html = require('../dist/rollup-plugin-html-encoder.js');

// import assert from 'assert';
// import rollup from 'rollup';
// import html from '../dist/rollup-plugin-html-encoder.mjs';

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
			.then(({ output }) =>
				assert.ok(output[0].code.indexOf("console.log('html: ', JSNode())") > -1, 'Rollup passed with no problems')
			);
	});
});
