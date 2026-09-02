import type { SeededRandom } from '../simulation/rng';

/**
 * Seeded toponym generator. Syllable assembly, deterministic in the RNG stream,
 * with per-world uniqueness. Produces bare place names ("Ardan", "Velos"); the
 * UI pairs them with a government descriptor.
 */

const ONSETS = [
	'b',
	'd',
	'f',
	'g',
	'k',
	'l',
	'm',
	'n',
	'p',
	'r',
	's',
	't',
	'v',
	'z',
	'br',
	'dr',
	'gr',
	'kr',
	'tr',
	'st',
	'th',
	'sh',
	'vl',
	'kh'
];
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ia', 'ou'];
const CODAS = ['', '', '', 'n', 'r', 's', 'l', 'k', 'th', 'nd', 'rk', 'sh', 'ss'];

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

export interface NameGenerator {
	next(): string;
}

export function createNameGenerator(rng: SeededRandom): NameGenerator {
	const used = new Set<string>();

	function build(): string {
		const syllables = rng.int(2, 4); // 2 or 3
		let word = '';
		for (let i = 0; i < syllables; i++) {
			word += rng.pick(ONSETS) + rng.pick(NUCLEI);
			// Interior syllables rarely take a coda; the last one usually does.
			if (i === syllables - 1 || rng.bool(0.25)) word += rng.pick(CODAS);
		}
		return capitalize(word);
	}

	return {
		next(): string {
			for (let attempt = 0; attempt < 50; attempt++) {
				const name = build();
				if (name.length >= 3 && name.length <= 9 && !used.has(name)) {
					used.add(name);
					return name;
				}
			}
			// Deterministic fallback if the syllable space is exhausted.
			let n = 1;
			let name = `${build()}${n}`;
			while (used.has(name)) name = `${build()}${++n}`;
			used.add(name);
			return name;
		}
	};
}
