class Node {
	constructor(data) {
		this.set = {};
		this.domParser = new (this.constructor.DOMParser || DOMParser)();
		const docElm =
			typeof document !== 'undefined'
				? document
				: this.domParser.parseFromString('<html></html>').documentElement.parentNode;
		this.data = data;
		this.node = {};

		if (Object.keys(this.set).length) {
			this.node.set = this._getSetProxy(this.set);
		}
		return this.node;
	}

	_getSubTemplate(templateName) {
		const Template = this._getValue(this.data, templateName);
		return new Template(this.data);
	}

	_getSetProxy(map) {
		return new Proxy(map, {
			get: (map, prop) => {
				const property = map[prop];
				if (property) {
					switch (property.type) {
						case 'text':
							return property.node.data;
						case 'html':
							return property.node;
						case 'attribute':
							return property.node;
					}
				}
			},
			set: (map, prop, value) => {
				const property = map[prop];

				if (property) {
					switch (property.type) {
						case 'text':
							property.node.data = value;
							break;
						case 'html':
							const newNode = typeof value === 'string' ? this.domParser.parseFromString(value) : value;
							return property.node.parentNode.replaceChild(newNode, property.node);
						case 'attribute':
							if (value === null) {
								return property.node.removeAttribute(prop);
							}

							return property.node.setAttribute(prop, value);
					}
				}
				return true;
			}
		});
	}

	_forEach(iteratorName, indexName, varName, fn) {
		const orig = {
				iterator: this._getValue(this.data, iteratorName),
				index: this._getValue(this.data, indexName)
			},
			list = this._getValue(this.data, varName);
		for (let k in list) {
			this._setValue(this.data, indexName, k);
			this._setValue(this.data, iteratorName, list[k]);
			fn();
		}
		this._setValue(this.data, iteratorName, orig.iterator);
		this._setValue(this.data, indexName, orig.index);
	}

	_getFirstOrSelf(elm) {
		if (elm.lastChild && elm.lastChild.nodeType === 1) {
			return elm.lastChild;
		}
		return elm;
	}

	_getValue(data, path) {
		return path[0] === '!'
			? !this._getValue(data, path.substr(1))
			: path.split('.').reduce((ptr, step) => ptr && ptr[step], data);
	}

	_setValue(data, path, value) {
		const pathParts = path.split('.'),
			varName = pathParts.pop();
		pathParts.reduce((ptr, step) => ptr && ptr[step], data)[varName] = value;
	}

	_toString() {
		return this.toString();
	}
}
export default Node;
