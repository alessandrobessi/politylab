/**
 * Headless Monte Carlo batch (BLUEPRINT.md §27). Run with:
 *
 *   pnpm mc                      # 100 worlds × 500 years
 *   pnpm mc --worlds 500 --years 1000
 *   pnpm mc --seed 1000 --json report.json
 *
 * No UI, no DOM — the engine runs unmodified under Node via vite-node (for the
 * `$lib` alias). Exits non-zero if any MODEL.md §78 pathology rule fires, so it
 * can gate CI.
 */

import { writeFileSync } from 'node:fs';
import { formatReport, runBatch } from '$lib/montecarlo';

interface Args {
	worlds: number;
	years: number;
	seed: number;
	json: string | null;
	states: number | undefined;
	regions: number | undefined;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		worlds: 100,
		years: 500,
		seed: 1,
		json: null,
		states: undefined,
		regions: undefined
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => {
			const v = argv[++i];
			if (v === undefined) throw new Error(`missing value for ${a}`);
			return v;
		};
		switch (a) {
			case '--worlds':
			case '-n':
				args.worlds = Number(next());
				break;
			case '--years':
			case '-y':
				args.years = Number(next());
				break;
			case '--seed':
			case '-s':
				args.seed = Number(next());
				break;
			case '--states':
				args.states = Number(next());
				break;
			case '--regions':
				args.regions = Number(next());
				break;
			case '--json':
				args.json = next();
				break;
			case '--help':
			case '-h':
				console.log(
					'Usage: pnpm mc [--worlds N] [--years M] [--seed S] [--states K] [--regions R] [--json out.json]'
				);
				process.exit(0);
				break;
			default:
				throw new Error(`unknown argument: ${a}`);
		}
	}
	return args;
}

const args = parseArgs(process.argv.slice(2));
const worldgen =
	args.states !== undefined || args.regions !== undefined
		? { stateCount: args.states, regionCount: args.regions }
		: undefined;

const start = Date.now();
let lastLogged = 0;
const result = runBatch({
	worlds: args.worlds,
	years: args.years,
	seed: args.seed,
	worldgen,
	onProgress: (done, total) => {
		const now = Date.now();
		if (now - lastLogged > 1000 || done === total) {
			lastLogged = now;
			process.stderr.write(`\r  ${done}/${total} worlds…`);
		}
	}
});
process.stderr.write('\r\x1b[K');

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(formatReport(result));
console.log(`\nCompleted in ${elapsed}s.`);

if (args.json) {
	writeFileSync(args.json, JSON.stringify(result, null, 2));
	console.log(`Wrote ${args.json}`);
}

process.exit(result.summary.firedPathologies.length > 0 ? 1 : 0);
