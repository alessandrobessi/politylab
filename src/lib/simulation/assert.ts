/**
 * Development / test invariant guard. BLUEPRINT.md §44 / MODEL.md §69, §84: the
 * simulation must never silently propagate invalid state. `assertFiniteWorld`
 * runs after each tick in tests and throws a descriptive error on the first
 * violation it finds.
 */

import type { World } from './models/world';
import { sharesSumToOne } from './math';

export class WorldInvariantError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WorldInvariantError';
	}
}

function fail(message: string): never {
	throw new WorldInvariantError(message);
}

function finite(value: number, where: string): void {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		fail(`${where} is not a finite number (got ${value})`);
	}
}

function inRange(value: number, lo: number, hi: number, where: string): void {
	finite(value, where);
	if (value < lo || value > hi) {
		fail(`${where} is out of [${lo}, ${hi}] (got ${value})`);
	}
}

function nonNegative(value: number, where: string): void {
	finite(value, where);
	if (value < 0) fail(`${where} is negative (got ${value})`);
}

/** Throws `WorldInvariantError` on the first broken invariant. */
export function assertFiniteWorld(world: World): void {
	finite(world.year, 'world.year');
	if (!Number.isInteger(world.year)) fail(`world.year is not an integer (got ${world.year})`);
	nonNegative(world.width, 'world.width');
	nonNegative(world.height, 'world.height');
	if (!Array.isArray(world.states)) fail('world.states is not an array');
	if (!Array.isArray(world.regions)) fail('world.regions is not an array');

	const stateIds = new Set(world.states.map((s) => s.id));
	const regionIds = new Set(world.regions.map((r) => r.id));

	for (const state of world.states) {
		const at = `state ${state.id}`;

		nonNegative(state.population, `${at}.population`);
		nonNegative(state.territory, `${at}.territory`);
		nonNegative(state.capital, `${at}.capital`);
		nonNegative(state.gdp, `${at}.gdp`);
		nonNegative(state.revenue, `${at}.revenue`);
		nonNegative(state.foodCapacity, `${at}.foodCapacity`);
		for (const [line, amount] of Object.entries(state.spending)) {
			nonNegative(amount, `${at}.spending.${line}`);
		}
		finite(state.gdpPerCapita, `${at}.gdpPerCapita`);
		finite(state.productivity, `${at}.productivity`);
		finite(state.treasury, `${at}.treasury`);
		finite(state.debt, `${at}.debt`);
		finite(state.foodRatio, `${at}.foodRatio`);
		finite(state.growth.gdp, `${at}.growth.gdp`);
		finite(state.growth.gdpPerCapita, `${at}.growth.gdpPerCapita`);
		finite(state.growth.population, `${at}.growth.population`);

		inRange(state.taxRate, 0, 1, `${at}.taxRate`);
		inRange(state.foodStress, 0, 1, `${at}.foodStress`);
		inRange(state.prosperity, 0, 1, `${at}.prosperity`);
		inRange(state.economicStress, 0, 1, `${at}.economicStress`);
		inRange(state.debtStress, 0, 1, `${at}.debtStress`);
		inRange(state.education, 0, 1, `${at}.education`);
		inRange(state.urbanization, 0, 1, `${at}.urbanization`);
		inRange(state.inequality, 0, 1, `${at}.inequality`);
		inRange(state.tradeOpenness, 0, 1, `${at}.tradeOpenness`);
		inRange(state.overextension, 0, 1, `${at}.overextension`);
		inRange(state.warExhaustion, 0, 1, `${at}.warExhaustion`);

		// Technology domains + research priorities.
		for (const [domain, value] of Object.entries(state.technology)) {
			inRange(value, 0, 1, `${at}.technology.${domain}`);
		}
		for (const [domain, value] of Object.entries(state.researchPriorities)) {
			inRange(value, 0, 5, `${at}.researchPriorities.${domain}`);
		}

		// Economic structure — shares in range and summing to 1.
		const econ = state.economy;
		inRange(econ.agriculture, 0, 1, `${at}.economy.agriculture`);
		inRange(econ.industry, 0, 1, `${at}.economy.industry`);
		inRange(econ.services, 0, 1, `${at}.economy.services`);
		if (!sharesSumToOne([econ.agriculture, econ.industry, econ.services], 1e-6)) {
			fail(
				`${at}.economy shares do not sum to 1 (got ${econ.agriculture + econ.industry + econ.services})`
			);
		}

		// Government budget — shares in range and summing to 1.
		const b = state.budget;
		const budgetShares = [
			b.infrastructure,
			b.education,
			b.research,
			b.military,
			b.welfare,
			b.administration
		];
		budgetShares.forEach((share, i) => inRange(share, 0, 1, `${at}.budget[${i}]`));
		if (!sharesSumToOne(budgetShares, 1e-6)) {
			fail(`${at}.budget shares do not sum to 1 (got ${budgetShares.reduce((x, y) => x + y, 0)})`);
		}

		// Politics.
		const p = state.politics;
		inRange(p.legitimacy, 0, 1, `${at}.politics.legitimacy`);
		inRange(p.stability, 0, 1, `${at}.politics.stability`);
		inRange(p.politicalParticipation, 0, 1, `${at}.politics.politicalParticipation`);
		inRange(p.centralization, 0, 1, `${at}.politics.centralization`);
		inRange(p.ruleOfLaw, 0, 1, `${at}.politics.ruleOfLaw`);
		inRange(p.institutionalCapacity, 0, 1, `${at}.politics.institutionalCapacity`);
		inRange(p.eliteConflict, 0, 1, `${at}.politics.eliteConflict`);
		inRange(p.participationGap, 0, 1, `${at}.politics.participationGap`);
		const f = p.factions;
		const factionShares = [f.elite, f.merchant, f.military, f.worker];
		factionShares.forEach((share, i) => inRange(share, 0, 1, `${at}.politics.factions[${i}]`));
		if (!sharesSumToOne(factionShares, 1e-6)) {
			fail(
				`${at}.politics.factions shares do not sum to 1 (got ${factionShares.reduce((x, y) => x + y, 0)})`
			);
		}

		// Military.
		const m = state.military;
		nonNegative(m.capital, `${at}.military.capital`);
		nonNegative(m.power, `${at}.military.power`);
		nonNegative(m.spending, `${at}.military.spending`);
		inRange(m.readiness, 0, 1, `${at}.military.readiness`);
		inRange(m.morale, 0, 1, `${at}.military.morale`);
		finite(m.burden, `${at}.military.burden`);

		// Relations.
		for (const [otherId, rel] of Object.entries(state.relations)) {
			const rat = `${at}.relations.${otherId}`;
			if (!stateIds.has(otherId)) fail(`${rat} references unknown state`);
			if (otherId === state.id) fail(`${rat} is a self-relation`);
			inRange(rel.opinion, -1, 1, `${rat}.opinion`);
			inRange(rel.trust, 0, 1, `${rat}.trust`);
			inRange(rel.trade, 0, 1, `${rat}.trade`);
			inRange(rel.rivalry, 0, 1, `${rat}.rivalry`);
			inRange(rel.borderTension, 0, 1, `${rat}.borderTension`);
			inRange(rel.territorialClaims, 0, 1, `${rat}.territorialClaims`);
			inRange(rel.threatPerception, 0, 1, `${rat}.threatPerception`);
			inRange(rel.warMemory, 0, 1, `${rat}.warMemory`);
			inRange(rel.proximity, 0, 1, `${rat}.proximity`);
		}
	}

	// Regions.
	for (const region of world.regions) {
		const at = `region ${region.id}`;
		if (region.ownerId !== null && !stateIds.has(region.ownerId)) {
			fail(`${at}.ownerId references unknown state ${region.ownerId}`);
		}
		nonNegative(region.population, `${at}.population`);
		if (!(region.area > 0) || !Number.isFinite(region.area)) {
			fail(`${at}.area must be a positive finite number (got ${region.area})`);
		}
		inRange(region.agriculturalPotential, 0, 1, `${at}.agriculturalPotential`);
		inRange(region.infrastructure, 0, 1, `${at}.infrastructure`);
		for (const n of region.neighbors) {
			if (!regionIds.has(n)) fail(`${at} has neighbor ${n} that does not exist`);
		}
		for (const [resource, amount] of Object.entries(region.resources)) {
			nonNegative(amount, `${at}.resources.${resource}`);
		}
	}

	// Wars.
	for (const war of world.wars) {
		const at = `war ${war.id}`;
		if (!stateIds.has(war.attackerId)) fail(`${at}.attackerId references unknown state`);
		if (!stateIds.has(war.defenderId)) fail(`${at}.defenderId references unknown state`);
		inRange(war.intensity, 0, 1, `${at}.intensity`);
	}
}
