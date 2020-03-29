const { readFileSync } = require('fs');
const assert = require('assert');
const html = require('../dist/index.js').default().transform;

describe('rollup-plugin-html-encoder', () => {
	it('converts html', () => {
		const file = './tests/samples/test1.html';
		const output = html(readFileSync(file, 'utf-8'), file);

		assert.ok(output.code.indexOf('exports.default = JSNode;') > -1, 'Rollup plugin passed');
	});
});
