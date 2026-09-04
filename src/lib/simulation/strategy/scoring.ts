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

export interface WarTargetInputs {
	/** Quality of the target's grabbable border land. 0..1. */
	territorialValue: number;
	/** Resource richness of that land. 0..1. */
	resourceValue: number;
	/** Positional gain from taking it. 0..1. */
	strategicValue: number;
	/** The attacker's standing territorial claim on the target. 0..1. */
	claimValue: number;
	/** Rally-round-the-flag benefit — higher for a shaky regime. 0..1. */
	domesticPoliticalBenefit: number;
	/** Attacker's share of the combined military power. 0..1. */
	perceivedMilitaryAdvantage: number;
	/** Standing antagonism. 0..1. */
	rivalry: number;
	/** Risk of losing — the defender's effective power share. 0..1. */
	militaryRisk: number;
	/** Risk from the defender's alliance network. 0..1. */
	allianceRisk: number;
	/** Economic disruption to the attacker. 0..1. */
	economicCost: number;
	/** Attacker's current war exhaustion. 0..1. */
	warExhaustion: number;
	/** How much the attacker depends on trade with the target. 0..1. */
	tradeDependency: number;
}

/**
 * Expected net utility of a war against `target` (MODEL.md §52). Contributors are
 * pre-normalized to 0..1 by the caller; coefficients are deliberately
 * approximate.
 */
export function scoreWarTarget(i: WarTargetInputs): number {
	return (
		0.22 * i.territorialValue +
		0.16 * i.resourceValue +
		0.14 * i.strategicValue +
		0.18 * i.claimValue +
		0.1 * i.domesticPoliticalBenefit +
		0.1 * i.perceivedMilitaryAdvantage +
		0.1 * i.rivalry -
		0.25 * i.militaryRisk -
		0.2 * i.allianceRisk -
		0.15 * i.economicCost -
		0.15 * i.warExhaustion -
		0.1 * i.tradeDependency
	);
}
