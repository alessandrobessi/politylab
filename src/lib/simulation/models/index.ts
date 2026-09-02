export type { Vec2, World } from './world';
export { allocateId } from './world';

export type {
	State,
	GovernmentType,
	TechDomain,
	TechnologyState,
	ResearchPriorities,
	EconomicStructure,
	GovernmentBudget,
	GovernmentSpending,
	FactionInfluence,
	PoliticsState,
	MilitaryState,
	StrategicAction
} from './state';
export { TECH_DOMAINS } from './state';

export type { Region, TerrainType, RegionResources } from './region';
export type { Relation } from './relation';
export type { War } from './war';
export type { WorldEvent, EventType } from './event';

export type { StateYearStats, WorldSnapshot, WorldHistory } from './history';
export { createHistory } from './history';
