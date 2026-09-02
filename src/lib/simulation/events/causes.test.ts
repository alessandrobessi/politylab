import { describe, it, expect } from 'vitest';
import { CauseSet } from './causes';

describe('CauseSet', () => {
	it('sorts contributors by descending magnitude of impact', () => {
		const cs = new CauseSet();
		cs.add('legitimacy', 0.21, 0.65);
		cs.add('food_stress', -0.08, 0.72);
		cs.add('institutions', 0.09);
		expect(cs.list().map((c) => c.factor)).toEqual(['legitimacy', 'institutions', 'food_stress']);
	});

	it('keeps raw signed impacts and optional values', () => {
		const cs = new CauseSet();
		cs.add('war_exhaustion', -0.05, 0.4);
		expect(cs.list()[0]).toEqual({ factor: 'war_exhaustion', impact: -0.05, value: 0.4 });
	});

	it('ignores a zero impact with no reported value but keeps zero+value', () => {
		const cs = new CauseSet();
		cs.add('noise', 0);
		cs.add('reported_zero', 0, 0.33);
		expect(cs.size).toBe(1);
		expect(cs.list()[0]?.factor).toBe('reported_zero');
	});

	it('total() sums impacts and explain() pairs value with causes', () => {
		const cs = new CauseSet();
		cs.add('a', 0.1);
		cs.add('b', -0.03);
		expect(cs.total()).toBeCloseTo(0.07, 12);
		expect(cs.explain(0.63)).toEqual({
			value: 0.63,
			causes: [
				{ factor: 'a', impact: 0.1 },
				{ factor: 'b', impact: -0.03 }
			]
		});
	});

	it('list() returns a copy — mutating it does not affect the set', () => {
		const cs = new CauseSet();
		cs.add('a', 0.1);
		cs.list().push({ factor: 'x', impact: 1 });
		expect(cs.size).toBe(1);
	});
});
