/**
 * Simulation coefficients. BLUEPRINT.md §36 / §55.7 / MODEL.md §79: every
 * meaningful coefficient lives here, never as a magic constant inside a system.
 * Values are transcribed verbatim from MODEL.md §79; any later divergence is
 * recorded in MODEL.md's "Calibration Changelog" section.
 *
 * `SimulationConfig` is derived from the default object, so adding a field to
 * `DEFAULT_MODEL_CONFIG` in a later milestone extends the type automatically.
 */

export const DEFAULT_MODEL_CONFIG = {
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

		// MODEL.md §12 names this default; not in the §79 list. See §92.
		prosperityHalfSaturation: 2.0
	},

	// Not in MODEL.md §79. Internal unit scaling so region-area food capacity
	// (MODEL.md §9) yields populations in the MODEL.md §5 range. See §92.
	food: {
		areaCapacityScale: 330000
	},

	education: {
		growthCoefficient: 0.015,
		depreciation: 0.002,
		referenceIntensity: 0.03
	},

	infrastructure: {
		growthCoefficient: 0.02,
		depreciation: 0.005,
		referenceIntensity: 0.04
	},

	// Not in MODEL.md §79. MODEL.md §8/§28/§30 use `welfareEffect` /
	// `welfareIntensity` without a reference; this normalizes welfare spending
	// (fraction of GDP) into a bounded 0..1 effect. See §92.
	welfare: {
		referenceIntensity: 0.05
	},

	technology: {
		innovationRate: 0.006,
		diffusionRate: 0.01,
		maxAnnualDiffusion: 0.02,
		researchReferenceIntensity: 0.02
	},

	politics: {
		stabilityAdjustmentRate: 0.15,

		ruptureBaseProbability: 0.08,

		// MODEL.md §79 value 0.005 → 0.012 (M10). At 0.005 the persistent
		// Malthusian food stress (§11) pins legitimacy at 0 for a majority of
		// states, making the variable degenerate. See §92.
		legitimacyMeanReversion: 0.012,

		// Not in MODEL.md §79. Follows the §29 legitimacy precedent: a mild pull
		// toward the middle so inequality (§28, which has no restoring term) does
		// not drift to a bound over centuries. See §92.
		inequalityMeanReversion: 0.004
	},

	military: {
		depreciation: 0.08,
		baseCasualtyRate: 0.003
	},

	diplomacy: {
		opinionMeanReversion: 0.02,
		warMemoryDecay: 0.97,
		claimDecay: 0.99,

		// Formation rate 0.10 is MODEL.md §49; its threshold (§49 gives 0.65) and
		// the mirror break parameters are tuned for M13's higher component
		// values (trust/trade run high in a peaceful world). See §92.
		allianceFormationRate: 0.1,
		allianceThreshold: 0.78,
		allianceBreakRate: 0.08,
		allianceBreakThreshold: 0.68
	},

	warfare: {
		baseWarProbability: 0.08,
		warThreshold: 0.2,

		baseEconomicDamage: 0.01,

		peaceExhaustionDecay: 0.92,

		// MODEL.md §39 (not in §79): sovereign debt interest rate, scaled by a
		// risk modifier that grows with debt stress.
		baseInterestRate: 0.03
	},

	history: {
		snapshotInterval: 10
	}
} as const;

/** Structural type of the model configuration (mutable, plain `number` fields). */
export type SimulationConfig = {
	-readonly [Namespace in keyof typeof DEFAULT_MODEL_CONFIG]: {
		-readonly [Param in keyof (typeof DEFAULT_MODEL_CONFIG)[Namespace]]: number;
	};
};

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: DeepPartial<T> | undefined): T {
	if (!override) return structuredClone(base);
	const out = structuredClone(base) as Record<string, unknown>;
	for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
		if (value === undefined) continue;
		const current = out[key];
		out[key] =
			isPlainObject(current) && isPlainObject(value)
				? deepMerge(current, value as DeepPartial<typeof current>)
				: value;
	}
	return out as T;
}

/** A fresh, deeply-cloned config, optionally with overrides merged in. */
export function makeConfig(overrides?: DeepPartial<SimulationConfig>): SimulationConfig {
	return deepMerge(DEFAULT_MODEL_CONFIG as unknown as SimulationConfig, overrides);
}
