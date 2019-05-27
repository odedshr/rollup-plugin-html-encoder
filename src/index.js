import { createFilter } from 'rollup-pluginutils';
import htmlEncoder from './html-encoder.js';

const ext = /\.html$/;

export default function htmlEncoderRollupPlugin(options = {}) {
	const filter = createFilter(options.include || ['**/*.html'], options.exclude);
	if (options.marked) {
		marked.setOptions(options.marked);
	}

	return {
		name: 'html',

		transform(htmlString, id) {
			if (!ext.test(id)) return null;
			if (!filter(id)) return null;

			return { code: htmlEncoder(htmlString), map: { mappings: '' } };
		}
	};
}
