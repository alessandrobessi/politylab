import type { Cause } from '$lib/simulation';

export interface DisplayCause {
	factor: string;
	/** Human label: `food_stress` → `Food stress`. */
	label: string;
	impact: number;
	/** Share of the total absolute impact, 0..1 — for bar widths. */
	share: number;
	value?: number;
}

/**
 * Prepare a `Cause[]` (already magnitude-sorted by `CauseSet.list`) for the
 * "Why?" panel: readable labels and each contributor's share of the total
 * absolute impact so the UI can draw proportional bars.
 */
export function toDisplayCauses(causes: readonly Cause[]): DisplayCause[] {
	const totalAbs = causes.reduce((sum, c) => sum + Math.abs(c.impact), 0) || 1;
	return causes.map((c) => ({
		factor: c.factor,
		label: humanize(c.factor),
		impact: c.impact,
		share: Math.abs(c.impact) / totalAbs,
		value: c.value
	}));
}

function humanize(factor: string): string {
	const spaced = factor.replace(/_/g, ' ');
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
