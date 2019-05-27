import buble from 'rollup-plugin-buble';

const pkg = require('./package.json'),
	external = Object.keys(pkg.dependencies);

export default {
	input: 'src/index.js',
	plugins: [buble({ sourceMap: true })],
	output: [
		{
			file: pkg['main'],
			format: 'cjs',
			sourceMap: true
		},
		{
			file: pkg['jsnext:main'],
			format: 'es',
			sourceMap: true
		}
	],
	external
};
