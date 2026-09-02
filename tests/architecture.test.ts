import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Enforces BLUEPRINT.md §6 (engine independent of the UI) and §7 / §55.6
 * (determinism — no `Math.random()`), so a violation fails CI rather than
 * silently breaking reproducibility or coupling the engine to Svelte.
 *
 * These trees must run unmodified under plain Node: browser, CLI, tests, Monte
 * Carlo, server. `src/lib/persistence` legitimately touches `indexedDB` (a
 * browser global, not an import) but must not import Svelte or use
 * `Math.random()` either.
 */

const ENGINE_DIRS = [
	'src/lib/simulation',
	'src/lib/worldgen',
	'src/lib/montecarlo',
	'src/lib/persistence'
];

function collectSourceFiles(dir: string): string[] {
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch {
		return [];
	}
	const out: string[] = [];
	for (const name of entries) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			out.push(...collectSourceFiles(full));
		} else if (/\.(ts|js|svelte)$/.test(name)) {
			out.push(full);
		}
	}
	return out;
}

/** Strip block and line comments so prose mentioning a forbidden token (e.g. a
 *  doc-comment explaining the rule) doesn't count as a violation. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const FORBIDDEN: Array<{ label: string; pattern: RegExp }> = [
	{ label: 'Math.random()', pattern: /\bMath\s*\.\s*random\s*\(/ },
	{ label: "import from 'svelte'", pattern: /\bfrom\s+['"]svelte(\/[^'"]*)?['"]/ },
	{ label: "import from '$app/*'", pattern: /\bfrom\s+['"]\$app\// },
	{ label: "import from '$env/*'", pattern: /\bfrom\s+['"]\$env\// }
];

describe('engine architecture', () => {
	const files = ENGINE_DIRS.flatMap(collectSourceFiles);

	it('finds source files to scan', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('contains no forbidden dependencies or non-deterministic calls', () => {
		const violations: string[] = [];
		for (const file of files) {
			const source = stripComments(readFileSync(file, 'utf8'));
			for (const { label, pattern } of FORBIDDEN) {
				if (pattern.test(source)) {
					violations.push(`${file} → ${label}`);
				}
			}
		}
		expect(
			violations,
			`engine files violated architecture rules:\n${violations.join('\n')}`
		).toEqual([]);
	});
});
