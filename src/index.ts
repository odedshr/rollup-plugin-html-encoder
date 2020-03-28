import * as htmlEncoder from 'html-encoder';

export default function htmlEncoderRollupPlugin(options: any = {}) {
	return {
		name: 'html',

		transform(html: string, id: string) {
			if (!id.match(/.html$/)) return null;

			return { code: htmlEncoder.default(html), map: { mappings: '' } };
		}
	};
}
