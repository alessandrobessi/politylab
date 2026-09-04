import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

const rawBase = process.env.BASE_PATH?.replace(/\/+$/, '');
const basePath: '' | `/${string}` =
	rawBase && rawBase.startsWith('/') ? (rawBase as `/${string}`) : '';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Single fully-prerendered route (see src/routes/+layout.ts); no SPA
			// fallback needed. Add `fallback: '200.html'` here if client-only routes
			// are introduced later.
			adapter: adapter(),
			// Served from a subpath on GitHub Pages (https://<user>.github.io/politylab).
			// The deploy workflow sets BASE_PATH; local dev/build use the root.
			paths: { base: basePath }
		})
	],
	test: {
		// The simulation engine is pure TypeScript and must run under plain Node.
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
		exclude: ['node_modules/**', '.svelte-kit/**', 'build/**'],
		// Long-run tests simulate many 1,000-year worlds; the default 5s is tight
		// on CI. Real engine optimisation lands with the Web Worker (M23).
		testTimeout: 30_000,
		hookTimeout: 30_000
	}
});
