import type { TechDomain, TechnologyState, ResearchPriorities } from '../models/state';
import { TECH_DOMAINS } from '../models/state';

/** A `TechnologyState` with every domain set to `value`. */
export function tech(value: number): TechnologyState {
	return Object.fromEntries(TECH_DOMAINS.map((d) => [d, value])) as TechnologyState;
}

/** Research priorities, default 1 per domain, with optional overrides. */
export function priorities(
	overrides: Partial<Record<TechDomain, number>> = {}
): ResearchPriorities {
	return Object.fromEntries(TECH_DOMAINS.map((d) => [d, overrides[d] ?? 1])) as ResearchPriorities;
}
