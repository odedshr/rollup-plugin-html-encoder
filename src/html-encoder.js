import { DOMParser } from 'xmldom';
import Node from './Node.js';

const domParser = new DOMParser(),
	NodeType = {
		Element: 1,
		Attribute: 2,
		Text: 3,
		CDATA: 4,
		EntityReference: 5,
		Entity: 6,
		ProcessingInstruction: 7,
		Comment: 8,
		Document: 9,
		DocumentType: 10,
		DocumentFragment: 11,
		Notation: 12
	};

class SubRoutine {
	constructor(type, varName) {
		this.type = type;
		this.varName = varName;
		this.children = [];
	}

	push(str) {
		this.children.push(str);
	}

	pop() {
		switch (this.type) {
			case 'loop':
				const [iteratorAndIndex, varName] = this.varName.split('@'),
					[iterator, index = '$i'] = iteratorAndIndex.split(':');
				return `this._forEach('${iterator}', '${index}','${varName}', () => {
					${this.children.join('\n')}
				});`;
			case 'if':
				return `
					if (this._getValue(this.data, '${this.varName}')) {
						${this.children.join('\n')}
					}`;
		}
	}
}

class NodeParser {
	constructor(rootNode) {
		this.rootNode = rootNode;
		this.output = this._parseNode(rootNode);
	}

	_parseNode(node) {
		switch (node.nodeType) {
			case NodeType.Document:
			case NodeType.DocumentFragment:
				if (node.childNodes.length !== 1) {
					throw Error('document must have exactly one child');
				}

				return this._parseNode(node.firstChild);
			case NodeType.ProcessingInstruction:
				return this._parseProcessInstruction(node);
			case NodeType.Text:
				return `docElm.createTextNode(\`${node.textContent}\`)`;
			case NodeType.Comment:
				return `docElm.createComment(\`${node.textContent}\`)`;
			default:
				return this._parseHtmlElement(node);
		}
	}

	_parseProcessInstruction(node) {
		const tagName = node.tagName;

		if (tagName.indexOf('?') === 0) {
			return new SubRoutine('if', tagName.substring(1));
		} else if (tagName.match(/.+@.+/)) {
			return new SubRoutine('loop', tagName);
		} else if (['/@', '/?'].indexOf(tagName) > -1) {
			return null;
		} else if (tagName.indexOf('attr') === 0) {
			return this._getAttributeInstructions(node.nodeValue.split(/\s/));
		} else if (tagName.indexOf('css') === 0) {
			return this._getCssInstructions(node.nodeValue.split(/\s/));
		} else if (tagName.indexOf(':') === 0) {
			return `this._getSubTemplate('${tagName.substring(1)}')`;
		} else if (tagName.indexOf('==') === 0) {
			return this._getAppendLivableString(
				`this.domParser.parseFromString(this._getValue(this.data, '${tagName.substring(2)}'))`,
				node.nodeValue,
				'html'
			);
		} else if (tagName.indexOf('=') === 0) {
			return this._getAppendLivableString(
				`docElm.createTextNode(this._getValue(this.data, '${tagName.substring(1)}'))`,
				node.nodeValue,
				'text'
			);
		}

		return `docElm.createProcessingInstruction('${tagName}','${node.nodeValue}')`;
	}

	_getAppendLivableString(nodeString, nodeValue, type) {
		const addToSetString =
			nodeValue.indexOf('#') === 0 ? `this.set['${nodeValue.substring(1)}'] = { node, type: '${type}' };` : '';

		return `(() => { const node = ${nodeString}; ${addToSetString} return node; })()`;
	}

	_parseHtmlElement(node) {
		let element = [`const elm = docElm.createElement('${node.tagName}');`],
			stack = [];

		Array.from(node.attributes || []).forEach(attr => {
			if (attr.nodeName.toLowerCase() === 'id') {
				element.push(`this.set['${attr.nodeValue}'] = { node: elm, type: 'attribute' };`);
			}
			element.push(`elm.setAttribute('${attr.nodeName}','${attr.nodeValue}')`);
		});

		Array.from(node.childNodes || []).forEach(childNode => {
			const parsed = this._parseNode(childNode);

			if (parsed instanceof SubRoutine) {
				stack.push(element);
				element = parsed;
			} else if (parsed === null) {
				const subRoutine = element;

				element = stack.pop();
				element.push(subRoutine.pop());
			} else if (Array.isArray(parsed)) {
				element.push(...parsed);
			} else {
				element.push(`elm.appendChild(${parsed})`);
			}
		});
		return `(() => { ${element.join('\n')}\n return elm; })()`;
	}

	// value is `condition?attrName=varName`
	_parseAttrValue(value) {
		const matches = value.match(/((.+)\?)?([^=.]+)(=(.+))?/);
		return { condition: matches[2], attrName: matches[3], varName: matches[5] };
	}

	_getAttributeInstructions(attributes) {
		const instructions = ['{ let node = this._getFirstOrSelf(elm), tmpAttrs;'];
		let liveId;
		if (attributes[attributes.length - 1].indexOf('#') === 0) {
			liveId = attributes.pop().substring(1);
		}

		attributes.forEach(attrValue => {
			const { condition, attrName, varName } = this._parseAttrValue(attrValue);
			if (condition) {
				instructions.push(`if (this._getValue(this.data, '${condition}')) {`);
			}
			if (varName) {
				instructions.push(`node.setAttribute('${attrName}', this._getValue(this.data, '${varName}'));`);
				if (liveId) {
					instructions.push(
						`this.set['${liveId}#${attrName}'] = { node, type: 'attribute', 'attrName': '${attrName}'}`
					);
				}
			} else {
				const addToLiveList = liveId
					? `this.set[\`${liveId}#\${k}\`] = { node, type: 'attribute', 'attrName': k };`
					: '';
				instructions.push(`tmpAttrs = this._getValue(this.data, '${attrName}');`);
				instructions.push(`for (let k in tmpAttrs) { node.setAttribute(k, tmpAttrs[k]);${addToLiveList} }`);
			}
			if (condition) {
				instructions.push('}');
			}
		});
		instructions.push('}');

		return instructions;
	}

	// value is `condition?cssName`
	_parseCssValue(value) {
		const matches = value.match(/((.+)\?)?([^=.]+)/);
		return { condition: matches[2], varName: matches[3] };
	}

	_getCssInstructions(classes) {
		const instructions = [
			`{ let tmpElm = this._getFirstOrSelf(elm), tmpCss = tmpElm.getAttribute('class') || '',
		target = tmpCss.length ? tmpCss.split(/\s/) : [];`
		];

		classes.forEach(varValue => {
			const { condition, varName } = this._parseCssValue(varValue);
			if (condition) {
				instructions.push(`if (this._getValue(this.data, '${condition}')) {`);
			}
			instructions.push(`tmpCss = this._getValue(this.data, '${varName}');
			(Array.isArray(tmpCss) ? tmpCss : [tmpCss]).forEach(css => target.push(css));
		`);
			if (condition) {
				instructions.push('}');
			}
		});
		instructions.push(`tmpElm.setAttribute('class', target.join(' ')); }`);

		return instructions;
	}

	toString() {
		return this.output;
	}
}

function htmlEncoder(htmlString) {
	const rootNode = domParser.parseFromString(htmlString, 'text/xml'),
		nodeParser = new NodeParser(rootNode);

	const nodeTemplate = [Node.toString().replace(/this\.node = {};/, `this.node = ${nodeParser.toString()};`)];

	for (let k in Node.prototype) {
		nodeTemplate.push(`Node.prototype.${k} = ${Node.prototype[k].toString()}`);
	}

	nodeTemplate.push('export default Node;');

	return nodeTemplate.join('\n');
}

export default htmlEncoder;
