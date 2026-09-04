import type { GovernmentType, PoliticsState } from '../models/state';

/**
 * Derive a government-type label from continuous political structure
 * (BLUEPRINT.md §16, MODEL.md §32). This is a *description*, never an input to
 * political dynamics — it is recomputed from the structure every year and jumps
 * only when a transition (MODEL.md §36) moves the underlying variables.
 */
export function classifyGovernment(p: PoliticsState): GovernmentType {
	const participation = p.politicalParticipation;
	const military = p.factions.military;
	const elite = p.factions.elite;

	if (participation < 0.2 && military > 0.35) return 'military-regime';
	if (participation < 0.25 && p.centralization > 0.6) return 'autocracy';
	if (participation >= 0.55 && p.ruleOfLaw >= 0.45) {
		return p.hereditary ? 'constitutional-monarchy' : 'republic';
	}
	if (p.hereditary) return participation < 0.4 ? 'monarchy' : 'constitutional-monarchy';
	if (p.centralization < 0.4 && participation >= 0.35) return 'federation';
	if (elite > 0.4 && participation < 0.5) return 'oligarchy';
	return participation >= 0.45 ? 'republic' : 'oligarchy';
}
