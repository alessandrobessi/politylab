import { describe, it, expect } from 'vitest';
import type { PoliticsState } from '../models/state';
import { classifyGovernment } from './classify';

function politics(overrides: Partial<PoliticsState>): PoliticsState {
	return {
		governmentType: 'republic',
		hereditary: false,
		legitimacy: 0.5,
		stability: 0.6,
		politicalParticipation: 0.4,
		centralization: 0.5,
		ruleOfLaw: 0.4,
		institutionalCapacity: 0.5,
		factions: { elite: 0.25, merchant: 0.25, military: 0.25, worker: 0.25 },
		eliteConflict: 0.2,
		participationGap: 0.1,
		...overrides
	};
}

describe('classifyGovernment (MODEL.md §32)', () => {
	it('low participation + strong military ⇒ military regime', () => {
		expect(
			classifyGovernment(
				politics({
					politicalParticipation: 0.1,
					factions: { elite: 0.2, merchant: 0.15, military: 0.5, worker: 0.15 }
				})
			)
		).toBe('military-regime');
	});

	it('low participation + high centralization ⇒ autocracy', () => {
		expect(
			classifyGovernment(politics({ politicalParticipation: 0.15, centralization: 0.8 }))
		).toBe('autocracy');
	});

	it('high participation + rule of law ⇒ republic (or constitutional monarchy if hereditary)', () => {
		expect(classifyGovernment(politics({ politicalParticipation: 0.7, ruleOfLaw: 0.6 }))).toBe(
			'republic'
		);
		expect(
			classifyGovernment(
				politics({ politicalParticipation: 0.7, ruleOfLaw: 0.6, hereditary: true })
			)
		).toBe('constitutional-monarchy');
	});

	it('hereditary + low participation ⇒ monarchy', () => {
		expect(classifyGovernment(politics({ hereditary: true, politicalParticipation: 0.2 }))).toBe(
			'monarchy'
		);
	});

	it('decentralized + moderate participation ⇒ federation', () => {
		expect(
			classifyGovernment(politics({ centralization: 0.25, politicalParticipation: 0.45 }))
		).toBe('federation');
	});

	it('elite-dominated + limited participation ⇒ oligarchy', () => {
		expect(
			classifyGovernment(
				politics({
					politicalParticipation: 0.3,
					centralization: 0.55,
					factions: { elite: 0.55, merchant: 0.2, military: 0.15, worker: 0.1 }
				})
			)
		).toBe('oligarchy');
	});
});
