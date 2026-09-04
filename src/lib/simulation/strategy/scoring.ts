/**
 * Transparent scoring functions for strategic decisions (BLUEPRINT.md §20).
 * No machine learning — each score is a weighted sum of interpretable factors,
 * and callers turn scores into probabilities with a sigmoid.
 */

export interface AllianceScoreInputs {
	/** Mutual trust (the lower of the two directions). 0..1. */
	trust: number;
	/** Two-way average opinion, mapped to 0..1. */
	normalizedOpinion: number;
	/** Strength of a shared adversary (MODEL.md §49–§50). 0..1. */
	commonThreat: number;
	/** Bilateral trade intensity. 0..1. */
	trade: number;
	/** Alignment of strategic interests (low rivalry). 0..1. */
	strategicCompatibility: number;
}

/** Alliance attractiveness between two states (MODEL.md §49). */
export function scoreAlliancePartner(i: AllianceScoreInputs): number {
	return (
		0.25 * i.trust +
		0.2 * i.normalizedOpinion +
		0.3 * i.commonThreat +
		0.15 * i.trade +
		0.1 * i.strategicCompatibility
	);
}
