const assert = require('assert'),
	transform = require('../dist/rollup-plugin-html-encoder.js')().transform,
	DOMParser = require('xmldom').DOMParser,
	domParser = new DOMParser(),
	virutalSourceFile = `${__dirname}/test/samples/test1.html`,
	getNode = (htmlString, data) => {
		const output = transform(htmlString, virutalSourceFile).code;

		try {
			const Node = new Function(output.replace(/export default/, 'return'))();
			Node.DOMParser = DOMParser;

			return new Node(data);
		} catch (err) {
			console.error(err);
			console.log(output);
		}
	},
	encode = (htmlString, data) => {
		return getNode(htmlString, data).toString();
	};

require('source-map-support').install();

process.chdir(__dirname);

describe('htmlEncoder: basic operations', () => {
	it('fails when no DOMParser provided', () => {
		const output = transform('<div>Fail</div>', virutalSourceFile).code,
			Node = new Function(output.replace(/export default/, 'return'))();

		assert.throws(() => new Node(), new ReferenceError('DOMParser is not defined'), 'Fails due to no DOMParser');
	});

	it('converts static html', () =>
		assert.equal(encode('<div>Hello <b>World</b></div>'), '<div>Hello <b>World</b></div>', 'Got expected results'));

	it('ignores unknown process instructions', () =>
		assert.equal(encode('<div>Hello <?ignore ?></div>'), '<div>Hello <?ignore ?></div>', 'ignored PI'));

	it('supports <?=text?>', () =>
		assert.equal(encode('<div>Hello <?=name?></div>', { name: 'World' }), '<div>Hello World</div>', 'binded text'));

	it('safeguards from html in <?=text?>', () =>
		assert.equal(
			encode('<div>Hello <?=name?></div>', { name: '<b>World</b>' }),
			'<div>Hello &lt;b>World&lt;/b></div>',
			'protects from html injection'
		));

	it('supports <?==html?>', () =>
		assert.equal(
			encode('<div>Hello <?==name?></div>', { name: '<b>World</b>' }),
			'<div>Hello <b>World</b></div>',
			'binded html'
		));
});

describe('htmlEncoder: loops', () => {
	it('supports <?value:key@array?></?@?>', () =>
		assert.equal(
			encode('<ul><?v:k@items?><li><?=v?><?=k?></li><?/@?></ul>', { items: ['a', 'b', 'c'] }),
			'<ul><li>a0</li><li>b1</li><li>c2</li></ul>',
			'iterates an array'
		));

	it('supports <?value:key@object?></?@?>', () =>
		assert.equal(
			encode('<ul><?v:k@items?><li><?=v?><?=k?></li><?/@?></ul>', { items: { a: 0, b: 1, c: 2 } }),
			'<ul><li>0a</li><li>1b</li><li>2c</li></ul>',
			'iterates an object'
		));
});

describe('htmlEncoder: conditionals', () => {
	it('supports <??boleans?>[content]<?/??>', () =>
		assert.equal(
			encode('<div><??flag1?>True<?/??><??flag2?>False<?/??></div>', { flag1: true, flag2: false }),
			'<div>True</div>',
			'binded conditionally'
		));

	it('supports <??!boleans?>[content]<?/??>', () =>
		assert.equal(
			encode('<div><??!flag1?>True<?/??><??!flag2?>False<?/??></div>', { flag1: true, flag2: false }),
			'<div>False</div>',
			'binded with negative boolean'
		));
});

describe('htmlEncoder: attributes', () => {
	it('supports <?attr key=value key2=value2?> for parent', () =>
		assert.equal(
			encode('<div><?attr val1=a val2=b?>Hello <b>World</b></div>', { a: 0, b: 1 }),
			'<div val1="0" val2="1">Hello <b>World</b></div>',
			'set attribute to parent node'
		));

	it('supports <?attr attributeMap?> for parent', () =>
		assert.equal(
			encode('<div><?attr attrs?>Hello <b>World</b></div>', { attrs: { val1: 0, val2: 1 } }),
			'<div val1="0" val2="1">Hello <b>World</b></div>',
			'set attribute to parent node'
		));

	it('supports <?attr key=value?> for sibling', () =>
		assert.equal(
			encode('<div>Hello <b>World</b><?attr value=a?></div>', { a: 0 }),
			'<div>Hello <b value="0">World</b></div>',
			'set attribute to sibling node'
		));

	it('supports <?attr key=value?> for sibling after a text-node', () =>
		assert.equal(
			encode('<div><b>Hello</b> World<?attr value=a?></div>', { a: 0 }),
			'<div value="0"><b>Hello</b> World</div>',
			'set attribute to parent node'
		));

	it('supports <?attr condition?key=value?> for parent', () =>
		assert.equal(
			encode('<div><?attr c1?val1=a c2?val2=b?>Hello <b>World</b></div>', { a: 0, b: 1, c1: true, c2: false }),
			'<div val1="0">Hello <b>World</b></div>',
			'set conditional attributes to node'
		));

	it('supports <?attr !condition?key=value?> for parent', () =>
		assert.equal(
			encode('<div><?attr !c1?val1=a !c2?val2=b?>Hello <b>World</b></div>', { a: 0, b: 1, c1: true, c2: false }),
			'<div val2="1">Hello <b>World</b></div>',
			'set conditional attributes to node'
		));

	it('supports <?attr condition?attrs?> for parent', () =>
		assert.equal(
			encode('<div><?attr c1?attrs ?>Hello <b>World</b></div>', { attrs: { val1: 0, val2: 1 }, c1: true }),
			'<div val1="0" val2="1">Hello <b>World</b></div>',
			'set conditional attributes to node'
		));
});

describe('htmlEncoder: css class', () => {
	it('supports <?css class?> for sibling', () =>
		assert.equal(
			encode('<div>Hello <b>World</b><?css state?></div>', { state: 'active' }),
			'<div>Hello <b class="active">World</b></div>',
			'set class to sibling node'
		));

	it('supports <?css array?> for sibling', () =>
		assert.equal(
			encode('<div>Hello <b>World</b><?css state?></div>', { state: ['active', 'idle'] }),
			'<div>Hello <b class="active idle">World</b></div>',
			'set class to sibling node'
		));

	it('supports <?css condition?class?> for sibling', () =>
		assert.equal(
			encode('<div>Hello <b>World</b><?css c1?idx c2?lvl ?></div>', { idx: 'active', lvl: 'one', c1: true, c2: false }),
			'<div>Hello <b class="active">World</b></div>',
			'set conditional class to sibling node'
		));
});
describe('htmlEncoder: real-time-updates', () => {
	it('supports <?=text #liveId?>', () => {
		const node = getNode('<div>Hello <?=name #name?></div>', { name: 'World' });
		assert.equal(node.toString(), '<div>Hello World</div>', 'binded text');
		node.set.name = 'Dave';
		assert.equal(node.toString(), '<div>Hello Dave</div>', 'binded text updated');
	});

	it('supports <?==html #liveId?> updating with string', () => {
		const node = getNode('<div>Hello <?==name #name?></div>', { name: '<b>World</b>' });
		assert.equal(node.toString(), '<div>Hello <b>World</b></div>', 'binded html');
		node.set.name = '<i>Dave</i>';
		assert.equal(node.toString(), '<div>Hello <i>Dave</i></div>', 'binded html updated');
	});

	it('supports <?==html #liveId?> updating with node', () => {
		const node = getNode('<div>Hello <?==name #name?></div>', { name: '<b>World</b>' });
		assert.equal(node.toString(), '<div>Hello <b>World</b></div>', 'binded html');
		node.set.name = domParser.parseFromString('<u>Claire</u>');
		assert.equal(node.toString(), '<div>Hello <u>Claire</u></div>', 'binded html updated');
	});

	it('supports <?attr value=key #liveId?> for parent', () => {
		const node = getNode('<div><?attr value=value #attrs?>Hello</div>', { value: 'foo' });
		assert.equal(node.toString(), '<div value="foo">Hello</div>', 'binded html');
		node.set['attrs#value'] = 'bar';
		assert.equal(node.toString(), '<div value="bar">Hello</div>', 'binded html updated');
	});

	it('supports <?attr attributeMap #liveId?> for parent', () => {
		const node = getNode('<div><?attr attrs #attrs?>Hello</div>', { attrs: { value: 'foo' } });
		assert.equal(node.toString(), '<div value="foo">Hello</div>', 'binded html');
		node.set['attrs#value'] = 'bar';
		assert.equal(node.toString(), '<div value="bar">Hello</div>', 'binded html updated');
	});
});
