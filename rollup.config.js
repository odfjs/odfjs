import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import css from 'rollup-plugin-css-only';
import sveltePreprocess from 'svelte-preprocess'
import { visualizer } from "rollup-plugin-visualizer";

const production = !process.env.ROLLUP_WATCH;


export default {
	input: 'scripts/front-end.js',
	output: {
		sourcemap: true,
		format: 'es',
		dir: 'build'
	},
	plugins: [
		svelte({
			compilerOptions: {
				// enable run-time checks when not in production
				dev: !production,
			},
			preprocess: sveltePreprocess()
		}),

		css({ output: 'bundle.css' }),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration -
		// consult the documentation for details:
		// https://github.com/rollup/plugins/tree/master/packages/commonjs
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),

		visualizer(),
		// If we're building for production (npm run build
		// instead of npm run dev), minify
		//production && terser()
	],
	watch: {
		clearScreen: false
	}
};
