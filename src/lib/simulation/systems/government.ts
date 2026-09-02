import type { SimContext } from '../context';
import { CauseSet } from '../events/causes';
import { clamp, clamp01, normalizeShares, safeDivide, sharesSumToOne } from '../math';
import type { World } from '../models/world';
import { regionsByOwner, revenue } from './common';

/**
 * Phase 4 — Government revenue (BLUEPRINT.md §13, §24; MODEL.md §16).
 * revenue = GDP × taxRate × taxEfficiency, computed from this year's GDP.
 */
export function updateGovernmentRevenue(world: World, _ctx: SimContext): void {
	for (const state of world.states) {
		if (!state.alive) continue;
		state.revenue = revenue(state);
	}
}

/**
 * Phase 5 — Government spending (BLUEPRINT.md §13, §24; MODEL.md §17–§19).
 *
 * Revenue is split across the six budget lines by their shares (which always sum
 * to 1). In peacetime the budget balances (MODEL.md §39), so the treasury is
 * flat; war deficits and borrowing arrive in M16. Spending then drives:
 *   - infrastructure per owned region (MODEL.md §18)
 *   - education (MODEL.md §19), scaled by institutional capacity
 *   - military spending and burden (MODEL.md §43)
 *
 * A fixed budget forces trade-offs: more military means less infrastructure and
 * education, and therefore slower long-run growth (BLUEPRINT.md §13).
 */
export function updateGovernmentSpending(world: World, ctx: SimContext): void {
	const owned = regionsByOwner(world);
	const infra = ctx.config.infrastructure;
	const edu = ctx.config.education;

	for (const state of world.states) {
		if (!state.alive) continue;

		if (!sharesSumToOne(Object.values(state.budget))) {
			state.budget = normalizeShares(state.budget);
		}

		const b = state.budget;
		const rev = state.revenue;
		state.spending = {
			infrastructure: b.infrastructure * rev,
			education: b.education * rev,
			research: b.research * rev,
			military: b.military * rev,
			welfare: b.welfare * rev,
			administration: b.administration * rev
		};

		state.military.spending = state.spending.military;
		state.military.burden = safeDivide(state.spending.military, state.gdp, 0);

		// Infrastructure per owned region (MODEL.md §18). Δ clamped to [-0.02, +0.03].
		const infraIntensity = safeDivide(state.spending.infrastructure, state.gdp, 0);
		for (const region of owned.get(state.id) ?? []) {
			const growth =
				infra.growthCoefficient *
				(infraIntensity / infra.referenceIntensity) *
				(1 - region.infrastructure);
			const decay = infra.depreciation * region.infrastructure;
			region.infrastructure = clamp01(region.infrastructure + clamp(growth - decay, -0.02, 0.03));
		}

		// Education (MODEL.md §19). Δ clamped to [-0.015, +0.025].
		const eduIntensity = safeDivide(state.spending.education, state.gdp, 0);
		const eduGrowth =
			edu.growthCoefficient *
			(eduIntensity / edu.referenceIntensity) *
			state.politics.institutionalCapacity *
			(1 - state.education);
		const eduDecay = edu.depreciation * state.education;
		state.education = clamp01(state.education + clamp(eduGrowth - eduDecay, -0.015, 0.025));

		if (ctx.traces) {
			const causes = new CauseSet();
			causes.add('education_spending', eduGrowth, eduIntensity);
			causes.add('depreciation', -eduDecay, state.education);
			ctx.traces.record(state.id, 'educationChange', causes.list());
		}
	}
}
