/** Display formatting helpers for the UI. Pure functions, unit-tested. */

/** e.g. 12_400_000 → "12.4M", 940_000 → "0.94M", 3_100_000_000 → "3.10B". */
export function population(n: number): string {
	if (!Number.isFinite(n)) return '—';
	if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
	return `${(n / 1e6).toFixed(2)}M`;
}

/** 0.632 → "63%". */
export function percent(x: number, digits = 0): string {
	if (!Number.isFinite(x)) return '—';
	return `${(x * 100).toFixed(digits)}%`;
}

/** Signed percentage-point change, e.g. +0.043 → "+4.3%". */
export function signedPercent(x: number, digits = 1): string {
	if (!Number.isFinite(x)) return '—';
	const s = (x * 100).toFixed(digits);
	return x > 0 ? `+${s}%` : `${s}%`;
}

/** Compact magnitude for GDP / capital: 4_800_000 → "4.8M", 81_000_000_000 → "81B". */
export function compact(n: number): string {
	if (!Number.isFinite(n)) return '—';
	const abs = Math.abs(n);
	if (abs >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
	if (abs >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
	if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
	if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
	return n.toFixed(0);
}

/** Turn `military-regime` into `Military regime`. */
export function titleCase(kebab: string): string {
	const spaced = kebab.replace(/-/g, ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
