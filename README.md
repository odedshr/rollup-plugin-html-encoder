# Rollup Plugin HTML Encoder
## Overview

This [Rollup](https://rollupjs.org/) plugin lets you import HTML files and use them as classes in your javascript code.

## Installation:
```
npm install --save-dev rollup-plugin-html-encoder
```

## Usage
Add the html-encoder to the `rollup.config.js`:
```
import { rollup } from 'rollup';
import html from 'rollup-plugin-html-encoder';

rollup({
	entry: 'main.js',
	plugins: [
		html({
			include: '**/*.html'
		})
	]
}).then(...)
```

You may import HTML files in your javascript code this way:
```
import Node from './popup.template.html'

document.body.append(new Node());
```

### Usage in Node.JS
The properly create a DOM node you'll need a  `DOMParser`, which exists in the browser but not in Node.JS.
You can obtain it from the [XMLDOM](https://www.npmjs.com/package/xmldom) dependency:
```
import Node from './page.template.html'
import { DOMParser } from 'xmldom';

Node.DOMParser = DOMParser;

return (new Node()).toString();
```

## Dynamic Content
`HTML-encoder` supports dynamic content using [`XML-processing-instructions`](https://en.wikipedia.org/wiki/Processing_Instruction)
and passing an object of data to the constructor (e.g. `new Node({data})`).
These instructions are applied to their preceeding sibling tag or parent if no preceeding tag availble. For example for the data
```
template.html:
<div><?css parent?><b>Hello</b><?css sibling?></div>`

import Node from './template.html';
console.log((new Node({ parent: 'parent', sibling: 'sibling'})).toString) 
// ouptput: <div class="parent"><b class="sibling">Hello</b></div>
```

### Content
1. `<?=text?>` will append a textNode with the html-safe content of the variable `text`.
2. `<?==html?>`  will append a parsed node with the content of the variable `html`. The input may be either a text or a pre-compiled node.

### Conditionals
3. `<??condition>xxx<?/??>` will add its content only if the variable `condition` is truthy.
4. `<??!condition>xxx<?/??>` will add its content only if the variable `condition` is falsy.

### Loops
5. `<?value@array?><li><?=value?></li></?@?>` will iterate over an array allowing access to its elements.
6. `<?value:key@array?><li><?=key?> <?=value?></li></?@?>`_ will iterate over an array allowing access to its elements and provide their index-number (starting from zero)
7. `<?value:key@object?><li><?=key?> <?=value?></li></?@?>` will iterate over a key-value object.

### Attributes
8. `<?attr key=value?>` will set the attribute `key` with the value of `value`.
9. `<?attr key=value key2=value2?>` will set as many attributes as provided.
10. `<?attr map?>` will set a collection of attributes described in the variable `map`
11. `<?attr condition?key=value?>` will set attribute `key` only if the variable `condition` is truthy.
11. `<?attr !condition?key=value?>` will set attribute `key` only if the variable `condition` is falsy. 
12. `<?attr condition?map?>` will set a collection of attributes only if the variable `condition` is truthy.
13. `<?attr !condition?map?>` will set a collection of attributes only if the variable `condition` is falsy.

### CSS Classes
13. _<?css value?>_ will add the css-class or array-of-classes provided in `value`.
14. _<?css condition?value?>_ will add the css-class or array-of-classes provided in `value` if the variable `condition` is truthy.

## Easy-access to Content
It's possible to provide quick-access to specific nodes and attributes by providing them with a `live-id`. For example:
```
template.html:
<div>Hello <?=firstName #name?></div>

javascript:
const node = new Node({ firstName: 'Adam' });
console.log(node.toString()); // output `<div>Hello Adam</div>`
node.live.name = 'Ben';
console.log(node.toString()); // output `<div>Hello Ben</div>`
```

15. `<?=text #liveId?>` => create a textnode and update its value
16. `<?==html #liveId?>` => create a node and update its value with either text or node
17. `<?attr object #liveId?>` will essentially provide quick-access to all of the node's attribtue via node.live[liveId#attributeName]

## The idea behind the project
The HTML `<template>` element can be useful when (a) we have repetitive HTML content; or (b) when we're introducing new content. But because of the static nature of HTML which doesn't really support any data-binding on its own, the `template` element becomes meaningless. 
I believe that there is a conceptual flaw with HTML `<template>` element (or at least it is I who failed to find a reasonable tutorial how to use it properly): `<template>` tags are meant to help having dynamic content in the page by providing the template as base, but as long as it is handled using javascript and not a pure-browser-native code, it must be encoded (for performance sake) to javascript before being used, and if the translation occurs at the browser-side than by definition it'll effect performance.

### How could it have worked natively?
1. `<template>` tag should have a `data-bind` attribute, which is then connected to a javascript variable hold an object (or array of objects) with fields that will be populated natively. For example - `<template data-bind="names"><li data-bind="name"><li></template>` would be displayed as `<li>Alex</li><li>Ben</li>`
And wouldn't it be wonderful if whenever names variable would update the html would refresh itself automatically?
2. If we could data-bind-src a URL with either JSON or XML data to be natively parsed into our template.
But in all fairness, we don't need a `template` tag for that, we just need the html `bind` attribute.
This would work great for pseudo-static HTML files (in the sense that there's no Javascript required for the page to function), and should we want a dynamic page perhaps we could pick the TemplateElement and use it's `clone(data)` method to populate it with our data, so the usage would be:
```
const template = document.selectById("myTemplate");
document.selectById("myParent").appendChild(template.clone(data, isWatchingData)
```
Without native-browser-based data-population and without javascript-less support, the `template` tags are utter pointless.

### JSX as a templating alternative
And now let's talk about [JSX](https://medium.com/javascript-scene/jsx-looks-like-an-abomination-1c1ec351a918), which is another kind of template. JSX in essence, is a pseudo-html code written within JS code and then pre-compiled to pure JS which is served to the browser. It's a much more efficient way to write template but I don't like it, because in order to write proper JSX you need to proficient in both HTML and Javascript and for me it feels like a mix of responsibilities. HTML provides the structure to our page, while javascript provides computability and these are two different things from my point of view.

### This is where the html-encoder comes in
I would like to write a normal HTML file but include in it the `data-bind` attribute without any additional javascript programming (it would have been nice to do so natively but that's just wishful thinking) and this HTML can be pre-compiled on the server and served as a static page (live-refresh is bonus). The `HTML encoder` does exactly that:

1. Write a normal HTML file
2. Import it to your javascript code using `import Node from `./example.template.html;` and then use it by appending it to the DOM - `document.appendChild(new Node());`

Behind the scenes, I use [Rollup](https://rollupjs.org/) plugin capability to detect imported HTML and encoding them to a set of javascript commands that are embedded with the Rollup output javascript file.

### Adding dynamic content
A guiding principle was to write an HTML valid code, but this raised the question - "Where can we place the computational instructions required?" and I found the Process Instructions (PI for short). they look a bit ugly I must admit - `<?=value?>` but for the proof-of-concept they serve their purpose.
Looking at other templating systems such as [Vue](https://medium.com/@Pier/vue-js-the-good-the-meh-and-the-ugly-82800bbe6684), the PIs are attributes in the elements or new html-invalid elements (i.e. not part of the HTML language). The <`? ... ?>` is a valid HTML element, it should appear as a first child to the element we wish to manipulate or immediately following it (in case of a childless element).

1. `<div><?=name?></div>` decoded with `new Node({ name: 'Dave'})` will result with `<div>Dave</div>`. Note that the variable must be a text-only (no HTML tags).
2. `<?==link?>` will decode html-content or a node.
3. `<??condition?>xxx<?/??>` will add the content only if condition is true. A boolean-negate ("!") is also available so <??!condition?>xxx<?/??> will add the content only if condition is false.
4. `<?item:index@items?>xxx<?/@?>` will iterate over items (either an array or an object) providing the key and value and the given variable names (in the example it would be "item" and "index")
5. Attributes:
`<?attr key1=varName1 key2=varName2?>` will set the attributes in preceding element
`<?attr attrObject?>` will set the attributes described in the attrObject (i.e. the key is the attribute name and the value is the actual value)
6. CSS classes:
`<?css varName?>` will set the class(es) described in the variable that can be either a string or an array. it's also possible to condition a class by writing `<?class condition?varName?>`.

### Future steps
I find this project to be rather exciting, as I plan to add event-listening functionality and I originally suggested, built-in fetch functionality, but I see it mainly as a thought-experiment in creating a relatively clean internet code, well-encapsulated and easy to use.