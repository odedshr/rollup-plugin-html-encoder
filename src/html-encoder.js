import { DOMParser } from 'xmldom';

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
				return `
					const orig = { 
						iterator: this._getValue(this.data, '${iterator}'),
						index: this._getValue(this.data, '${index}')
					},
					list = this._getValue(this.data, '${varName}');
					for (let k in list) {
						this._setValue(this.data, '${index}', k);
						this._setValue(this.data, '${iterator}', list[k]);
						${this.children.join('\n')}
					}
					this._setValue(this.data, '${iterator}', orig.iterator);
					this._setValue(this.data, '${index}', orig.index);`;
			case 'if':
				return `
					if (this._getValue(this.data, '${this.varName}')) {
						${this.children.join('\n')}
					}`;
		}
	}
}

function parseNode(node) {
	switch (node.nodeType) {
		case NodeType.Document:
		case NodeType.DocumentFragment:
			if (node.childNodes.length !== 1) {
				throw Error('document must have exactly one child');
			}
			return parseNode(node.firstChild);
		case NodeType.ProcessingInstruction:
			const tagName = node.tagName;
			if (tagName.indexOf('?') === 0) {
				return new SubRoutine('if', tagName.substring(1));
			} else if (tagName.match(/.+@.+/)) {
				return new SubRoutine('loop', tagName);
			} else if (['/@', '/?'].indexOf(tagName) > -1) {
				return null;
			} else if (tagName.indexOf('attr') === 0) {
				return getAttributeInstructions(node.nodeValue.split(/\s/));
			} else if (tagName.indexOf('css') === 0) {
				return getCssInstructions(node.nodeValue.split(/\s/));
			} else if (tagName.indexOf('==') === 0) {
				return getAppendLivableString(
					`this.domParser.parseFromString(this._getValue(this.data, '${tagName.substring(2)}'))`,
					node.nodeValue,
					'html'
				);
			} else if (tagName.indexOf('=') === 0) {
				return getAppendLivableString(
					`docElm.createTextNode(this._getValue(this.data, '${tagName.substring(1)}'))`,
					node.nodeValue,
					'text'
				);
			} else {
				return `docElm.createProcessingInstruction('${tagName}','${node.nodeValue}')`;
			}
			return '';
		case NodeType.Text:
			return `docElm.createTextNode(\`${node.textContent}\`)`;
		case NodeType.Comment:
			return `docElm.createComment(\`${node.textContent}\`)`;
		default:
			let element = [`const elm = docElm.createElement('${node.tagName}');`],
				stack = [];

			Array.from(node.attributes || []).forEach(attr =>
				element.push(`elm.setAttribute('${attr.nodeName}','${attr.nodeValue}')`)
			);
			Array.from(node.childNodes || []).forEach(childNode => {
				const parsed = parseNode(childNode);

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
			return `(docElm => { ${element.join('\n')}\n return elm; })(docElm)`;
	}
}

// value is `condition?attrName=varName`
function parseAttrValue(value) {
	const matches = value.match(/((.+)\?)?([^=.]+)(=(.+))?/);
	return { condition: matches[2], attrName: matches[3], varName: matches[5] };
}

function getAttributeInstructions(attributes) {
	const instructions = ['{ let node = this._getFirstOrSelf(elm), tmpAttrs;'];
	let liveId;
	if (attributes[attributes.length - 1].indexOf('#') === 0) {
		liveId = attributes.pop().substring(1);
	}

	attributes.forEach(attrValue => {
		const { condition, attrName, varName } = parseAttrValue(attrValue);
		if (condition) {
			instructions.push(`if (this._getValue(this.data, '${condition}')) {`);
		}
		if (varName) {
			instructions.push(`node.setAttribute('${attrName}', this._getValue(this.data, '${varName}'));`);
			if (liveId) {
				instructions.push(`this.set['${liveId}#${attrName}'] = { node, type: 'attribute', 'attrName': '${attrName}'}`);
			}
		} else {
			const addToLiveList = liveId ? `this.set[\`${liveId}#\${k}\`] = { node, type: 'attribute', 'attrName': k };` : '';
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

function getAppendLivableString(nodeString, nodeValue, type) {
	if (nodeValue.indexOf('#') === 0) {
		return `(() => {
						const node = ${nodeString};
						this.set['${nodeValue.substring(1)}'] = { node, type: '${type}' };
						return node;
					})()`;
	}
	return `elm.appendChild(${nodeString})`;
}
// value is `condition?cssName`
function parseCssValue(value) {
	const matches = value.match(/((.+)\?)?([^=.]+)/);
	return { condition: matches[2], varName: matches[3] };
}

function getCssInstructions(classes) {
	const instructions = [
		`{ let tmpElm = this._getFirstOrSelf(elm), tmpCss = tmpElm.getAttribute('class') || '',
		target = tmpCss.length ? tmpCss.split(/\s/) : [];`
	];

	classes.forEach(varValue => {
		const { condition, varName } = parseCssValue(varValue);
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

function htmlEncoder(htmlString) {
	const rootNode = domParser.parseFromString(htmlString, 'text/xml');

	return `class Node { constructor(data) {
			this.set = {};
			this.domParser = new (this.constructor.DOMParser || DOMParser);
			const docElm = (typeof document !== 'undefined') ? document : this.domParser.parseFromString('<html></html>').documentElement.parentNode;
			this.data = data;
			this.node = ${parseNode(rootNode)}

			if (Object.keys(this.set).length) {
				this.node.set = this._getSetProxy(this.set);
			}
			return this.node;
		}
		_getSetProxy(map) {
			return new Proxy(map, {
				get: (map, prop) => {
					const property = map[prop];
					if (property) {
						switch(property.type) {
							case 'text': return property.node.data;
							case 'html': return property.node;
							case 'attribute': return property.node.getAttribute(property.attrName);
						}
					}
				},
				set: (map, prop, value) => {
					const property = map[prop];
					if (property) {
						switch(property.type) {
							case 'text': property.node.data = value; break;
							case 'html':
								const newNode = (typeof value ==='string') ? this.domParser.parseFromString(value) : value;
								property.node.parentNode.replaceChild(newNode, property.node); break;
							case 'attribute':
								property.node.setAttribute(property.attrName, value);
							break;
						}
					}
					return true;
				}
			});
		}
		_getFirstOrSelf(elm) {
			if (elm.lastChild && elm.lastChild.nodeType === 1) {
				return elm.lastChild;
			}
			return elm;
		}
	  _getValue(data, path) { 
			return (path[0] === '!') ?
				!this._getValue(data, path.substr(1)) :
				path.split('.').reduce((ptr, step) => ptr && ptr[step], data);
		}
		_setValue(data, path, value) {
			const pathParts = path.split('.'),
				varName = pathParts.pop();
			pathParts.reduce((ptr, step) => ptr && ptr[step], data)[varName] = value;
		}
	}
  export default Node;`;
}

export default htmlEncoder;
