import type { Relation } from './relation';

/**
 * A state is an aggregate political entity (BLUEPRINT.md §9). Most normalized
 * fields use 0..1 internally (BLUEPRINT.md §9, MODEL.md §4); the UI may show them
 * as percentages. Absolute fields (population, gdp, capital, debt, territory,
 * military capital) are in the engine's internal units.
 *
 * Deviations from the BLUEPRINT.md §9 sketch, kept deliberately:
 * - `food` is modelled as the derived `foodCapacity` / `foodRatio` / `foodStress`
 *   trio (a flow, per MODEL.md §9), not a stock.
 * - Per-state time series live in `WorldHistory` (see models/history.ts), not on
 *   the state, so world snapshots don't nest history.
 */

export type GovernmentType =
	| 'monarchy'
	| 'constitutional-monarchy'
	| 'republic'
	| 'oligarchy'
	| 'autocracy'
	| 'military-regime'
	| 'federation';

export const TECH_DOMAINS = [
	'agriculture',
	'materials',
	'energy',
	'transport',
	'medicine',
	'communication',
	'military',
	'institutions'
] as const;

export type TechDomain = (typeof TECH_DOMAINS)[number];

/** Continuous capability per domain, 0..1 (MODEL.md §24). No tech tree. */
export type TechnologyState = Record<TechDomain, number>;

/** Per-domain research emphasis, 0.5..1.5 (MODEL.md §23). */
export type ResearchPriorities = Record<TechDomain, number>;

/** Sector shares of economic activity; sum to 1 (BLUEPRINT.md §12). */
export interface EconomicStructure {
	agriculture: number;
	industry: number;
	services: number;
}

/** Government spending shares; sum to 1 (BLUEPRINT.md §13, MODEL.md §17). */
export interface GovernmentBudget {
	infrastructure: number;
	education: number;
	research: number;
	military: number;
	welfare: number;
	administration: number;
}

/** Absolute annual spending per budget line (`budget` share × revenue). */
export type GovernmentSpending = Record<keyof GovernmentBudget, number>;

/** Aggregate power-bloc influence; shares sum to 1 (MODEL.md §33). */
export interface FactionInfluence {
	elite: number;
	merchant: number;
	military: number;
	worker: number;
}

/** BLUEPRINT.md §16, MODEL.md §29–§37. Government type is derived from these. */
export interface PoliticsState {
	governmentType: GovernmentType;
	/** Hereditary-regime flag, an input to classification (MODEL.md §32). */
	hereditary: boolean;

	legitimacy: number;
	stability: number;

	politicalParticipation: number;
	centralization: number;
	ruleOfLaw: number;
	institutionalCapacity: number;

	factions: FactionInfluence;
	/** 0..1, derived (MODEL.md §34). */
	eliteConflict: number;
	/** max(0, desired − actual) participation, derived (MODEL.md §29). */
	participationGap: number;
}

/** BLUEPRINT.md §22, MODEL.md §41–§43. */
export interface MilitaryState {
	/** Accumulated military capital M (MODEL.md §41). Absolute units. */
	capital: number;
	/** Effective military power (MODEL.md §42), derived each year. */
	power: number;
	/** 0..1. */
	readiness: number;
	/** 0..1, derived from stability (MODEL.md §42). */
	morale: number;
	/** Absolute annual military spending, from the budget. */
	spending: number;
	/** spending / gdp, derived (MODEL.md §43). */
	burden: number;
}

export type StrategicAction =
	| 'invest-economy'
	| 'invest-education'
	| 'invest-research'
	| 'increase-military'
	| 'seek-trade'
	| 'seek-alliance'
	| 'improve-relations'
	| 'prepare-war'
	| 'declare-war';

export interface State {
	id: string;
	name: string;
	alive: boolean;
	/** Map hue in [0, 360), assigned at world generation. */
	colorHue: number;

	population: number;
	/** Total owned area (sum of owned region areas). */
	territory: number;

	/** Total annual food-production capacity (MODEL.md §9). */
	foodCapacity: number;
	/** foodCapacity / population (MODEL.md §9). */
	foodRatio: number;
	/** clamp01((1 − foodRatio) / 0.40) (MODEL.md §10). */
	foodStress: number;

	capital: number;
	gdp: number;
	gdpPerCapita: number;
	/** Total factor productivity (MODEL.md §14). */
	productivity: number;
	/** Bounded transform of gdpPerCapita, 0..1 (MODEL.md §12). */
	prosperity: number;
	economy: EconomicStructure;
	/** Year-on-year fractional growth, derived (for explanations / stress). */
	growth: { gdp: number; gdpPerCapita: number; population: number };
	/** clamp01(−realGdpPerCapitaGrowth / 0.10), derived (MODEL.md §31). */
	economicStress: number;

	/** Government revenue this year: gdp × taxRate × tax efficiency (MODEL.md §16). */
	revenue: number;
	/** Absolute spending per budget line this year (MODEL.md §17). */
	spending: GovernmentSpending;
	treasury: number;
	debt: number;
	/** debt / gdp, derived (MODEL.md §40). */
	debtRatio: number;
	/** clamp01((debtRatio − 0.50) / 1.50), derived (MODEL.md §40). */
	debtStress: number;
	/** 0..1. */
	taxRate: number;
	budget: GovernmentBudget;

	education: number;
	urbanization: number;
	inequality: number;

	technology: TechnologyState;
	researchPriorities: ResearchPriorities;

	politics: PoliticsState;
	military: MilitaryState;

	/** 0..1. Aggregate openness to trade, derived from relations. */
	tradeOpenness: number;
	/** 0..1, derived (MODEL.md §38). */
	overextension: number;
	/** 0..1 (MODEL.md §61). */
	warExhaustion: number;

	/** Keyed by the other state's id (BLUEPRINT.md §9). */
	relations: Record<string, Relation>;
}
