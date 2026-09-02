/**
 * A directed bilateral relation (BLUEPRINT.md §18, MODEL.md §44–§48). Each state
 * holds `relations[otherId]`. Symmetric quantities (`trade`, `proximity`,
 * `alliance`, `atWar`) are kept in sync on both sides by the diplomacy system;
 * directional quantities (`opinion`, `trust`, `threatPerception`,
 * `territorialClaims`) may differ by direction.
 */
export interface Relation {
	/** How favourably this state views the other. -1..1 (MODEL.md §44). */
	opinion: number;
	/** 0..1. Moves more slowly than opinion — carries historical memory. */
	trust: number;
	/** 0..1. Bilateral trade intensity (symmetric). */
	trade: number;
	/** 0..1. Persistent strategic antagonism. */
	rivalry: number;
	/** 0..1. Friction along a shared border. */
	borderTension: number;
	/** 0..1. Strength of this state's claim on the other's territory. */
	territorialClaims: number;
	/** 0..1. Threat this state perceives from the other (MODEL.md §48). */
	threatPerception: number;
	/** 0..1. Decays after a war ends (MODEL.md §46). */
	warMemory: number;
	/** 0..1. Geographic closeness (symmetric, MODEL.md §47). */
	proximity: number;

	alliance: boolean;
	atWar: boolean;
	/** Year the current alliance formed, or `null`. */
	allianceSince: number | null;
	/** Year the most recent war between the pair ended, or `null`. */
	lastWarEndYear: number | null;
}
