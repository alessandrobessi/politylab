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

	technology: {
		innovationRate: 0.006,
		diffusionRate: 0.01,
		maxAnnualDiffusion: 0.02,
		researchReferenceIntensity: 0.02
	},

	politics: {
		stabilityAdjustmentRate: 0.15,

		ruptureBaseProbability: 0.08,

		legitimacyMeanReversion: 0.005
	},

	military: {
		depreciation: 0.08,
		baseCasualtyRate: 0.003
	},

	diplomacy: {
		opinionMeanReversion: 0.01,
		warMemoryDecay: 0.97,
		claimDecay: 0.99
	},

	warfare: {
		baseWarProbability: 0.12,
		warThreshold: 0.15,

		baseEconomicDamage: 0.01,

		peaceExhaustionDecay: 0.92
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
