import { describe, it, expect } from 'vitest';
import { DEFAULT_MODEL_CONFIG, makeConfig } from './config';

describe('DEFAULT_MODEL_CONFIG', () => {
	it('matches the values in MODEL.md §79', () => {
		expect(DEFAULT_MODEL_CONFIG).toEqual({
			population: {
				baseBirthRate: 0.03,
				baseDeathRate: 0.022,
				educationBirthEffect: 0.009,
				urbanBirthEffect: 0.008,
				prosperityBirthEffect: 0.004,
				medicineDeathEffect: 0.009,
				prosperityDeathEffect: 0.003,
				welfareDeathEffect: 0.003,
				maxFamineMortality: 0.06
			},
			economy: {
				capitalElasticity: 0.35,
				privateInvestmentRate: 0.18,
				capitalDepreciation: 0.04,
				maxTradeProductivityBonus: 0.15,
				prosperityHalfSaturation: 2.0
			},
			food: { areaCapacityScale: 330000 },
			education: { growthCoefficient: 0.015, depreciation: 0.002, referenceIntensity: 0.03 },
			infrastructure: { growthCoefficient: 0.02, depreciation: 0.005, referenceIntensity: 0.04 },
			welfare: { referenceIntensity: 0.05 },
			technology: {
				innovationRate: 0.006,
				diffusionRate: 0.01,
				maxAnnualDiffusion: 0.02,
				researchReferenceIntensity: 0.02
			},
			politics: {
				stabilityAdjustmentRate: 0.15,
				ruptureBaseProbability: 0.08,
				legitimacyMeanReversion: 0.012,
				inequalityMeanReversion: 0.004,
				factionAdjustmentRate: 0.05
			},
			military: { depreciation: 0.08, baseCasualtyRate: 0.003 },
			diplomacy: {
				opinionMeanReversion: 0.02,
				warMemoryDecay: 0.97,
				claimDecay: 0.99,
				allianceFormationRate: 0.1,
				allianceThreshold: 0.78,
				allianceBreakRate: 0.08,
				allianceBreakThreshold: 0.68
			},
			warfare: {
				baseWarProbability: 0.08,
				warThreshold: 0.25,
				baseEconomicDamage: 0.01,
				peaceExhaustionDecay: 0.92,
				baseInterestRate: 0.03
			},
			history: { snapshotInterval: 10 }
		});
	});
});

describe('makeConfig', () => {
	it('returns a deep clone, not a reference to the default', () => {
		const a = makeConfig();
		const b = makeConfig();
		a.population.baseBirthRate = 999;
		expect(b.population.baseBirthRate).toBe(0.03);
		expect(DEFAULT_MODEL_CONFIG.population.baseBirthRate).toBe(0.03);
	});

	it('deep-merges overrides', () => {
		const cfg = makeConfig({
			technology: { diffusionRate: 0.006 },
			warfare: { baseWarProbability: 0.2 }
		});
		expect(cfg.technology.diffusionRate).toBe(0.006);
		// sibling keys in an overridden namespace are preserved
		expect(cfg.technology.innovationRate).toBe(0.006);
		expect(cfg.technology.maxAnnualDiffusion).toBe(0.02);
		expect(cfg.warfare.baseWarProbability).toBe(0.2);
		expect(cfg.warfare.warThreshold).toBe(0.25);
		// untouched namespaces are intact
		expect(cfg.population.baseBirthRate).toBe(0.03);
	});
});
