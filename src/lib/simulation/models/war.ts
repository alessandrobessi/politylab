/**
 * An interstate war (BLUEPRINT.md §21–§23, MODEL.md §54–§64). v0.1 wars pursue
 * limited territorial conquest only — no regime change, annexation, reparations,
 * or ideological objectives.
 */
export interface War {
	id: string;
	attackerId: string;
	defenderId: string;
	/** Co-belligerents drawn in via alliances (empty in early milestones). */
	attackerAllies: string[];
	defenderAllies: string[];

	startYear: number;
	endYear: number | null;
	active: boolean;

	goal: 'limited-conquest';
	/** 0..1. Scales casualties and economic damage (MODEL.md §58–§61). */
	intensity: number;

	/** Regions currently fought over (adjacent to the front). */
	contestedRegionIds: string[];
	/** Regions transferred so far, by beneficiary. */
	regionsToAttacker: string[];
	regionsToDefender: string[];
}
