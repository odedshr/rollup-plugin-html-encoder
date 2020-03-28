import { readFileSync } from 'fs';
import assert from 'assert';
import html from '../dist/index.mjs';

describe('rollup-plugin-html-encoder', () => {
	it('converts html', () => {
		const file = './test/samples/test1.html';
		const output = html()(readFileSync(file, 'utf-8', file));

		assert.ok(output[0].code.indexOf("console.log('html: ', JSNode())") > -1, 'Rollup passed with no problems');
	});
});
