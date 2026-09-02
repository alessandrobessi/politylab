import type { Cause } from '../events/causes';

/** BLUEPRINT.md §26. Events are the historical record of the world. */
export type EventType =
	'war' | 'peace' | 'alliance' | 'politics' | 'technology' | 'economy' | 'demography' | 'territory';

export interface WorldEvent {
	id: string;
	year: number;
	type: EventType;
	/** State ids involved. */
	actors: string[];
	/** 0..1 (MODEL.md §65). The timeline filters low-importance events at speed. */
	importance: number;
	title: string;
	/** Event-specific structured payload. */
	data: Record<string, unknown>;
	/** Major causal contributors, retained for the "Why?" view (MODEL.md §66). */
	causes: Cause[];
}
