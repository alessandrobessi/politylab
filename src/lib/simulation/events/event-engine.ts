import type { SimContext } from '../context';
import type { Cause } from './causes';
import type { GovernmentType, State } from '../models/state';
import type { EventType, WorldEvent } from '../models/event';
import { allocateId, type World } from '../models/world';
import { technologyIndex } from '../systems/technology';

/**
 * Phase 13 — Events (BLUEPRINT.md §26, §24; MODEL.md §65–§66).
 *
 * Events are *derived* from the change in world state over the tick — they are
 * never scripted. `captureEventSnapshot` records the relevant values before the
 * systems run; `generateEvents` compares them afterwards and emits a
 * `WorldEvent` (type, actors, importance, causes) for each significant change.
 * Causes are taken from this tick's traces where a system recorded them.
 */

interface StateSnapshot {
	alive: boolean;
	governmentType: GovernmentType;
	territory: number;
	technologyIndex: number;
	gdpPerCapita: number;
	foodStress: number;
}

export interface EventSnapshot {
	states: Map<string, StateSnapshot>;
	warIds: Set<string>;
	alliances: Set<string>;
}

const pairKey = (a: string, b: string): string => (a < b ? `${a}~${b}` : `${b}~${a}`);

export function captureEventSnapshot(world: World): EventSnapshot {
	const states = new Map<string, StateSnapshot>();
	for (const s of world.states) {
		states.set(s.id, {
			alive: s.alive,
			governmentType: s.politics.governmentType,
			territory: s.territory,
			technologyIndex: technologyIndex(s.technology),
			gdpPerCapita: s.gdpPerCapita,
			foodStress: s.foodStress
		});
	}
	const alliances = new Set<string>();
	for (const s of world.states) {
		for (const [otherId, rel] of Object.entries(s.relations)) {
			if (rel.alliance) alliances.add(pairKey(s.id, otherId));
		}
	}
	return {
		states,
		warIds: new Set(world.wars.map((w) => w.id)),
		alliances
	};
}

function name(world: World, id: string): string {
	return world.states.find((s) => s.id === id)?.name ?? id;
}

function emit(
	world: World,
	type: EventType,
	actors: string[],
	importance: number,
	title: string,
	data: Record<string, unknown>,
	causes: Cause[]
): void {
	world.events.push({
		id: allocateId(world, 'evt'),
		year: world.year,
		type,
		actors,
		importance,
		title,
		data,
		causes
	});
}

function tracesFor(ctx: SimContext, stateId: string, metric: string): Cause[] {
	return ctx.traces?.forState(stateId)?.[metric] ?? [];
}

export function generateEvents(world: World, ctx: SimContext, prev: EventSnapshot): void {
	const year = ctx.year;

	// Wars declared and concluded this tick.
	for (const war of world.wars) {
		if (!prev.warIds.has(war.id) && war.startYear === year) {
			emit(
				world,
				'war',
				[war.attackerId, war.defenderId],
				0.8,
				`${name(world, war.attackerId)} declares war on ${name(world, war.defenderId)}`,
				{ warId: war.id },
				tracesFor(ctx, war.attackerId, `war:${war.defenderId}`)
			);
		}
		if (war.endYear === year && prev.warIds.has(war.id)) {
			const net = war.regionsToAttacker.length - war.regionsToDefender.length;
			const title =
				net > 0
					? `${name(world, war.attackerId)} prevails over ${name(world, war.defenderId)}`
					: net < 0
						? `${name(world, war.defenderId)} repels ${name(world, war.attackerId)}`
						: `${name(world, war.attackerId)} and ${name(world, war.defenderId)} make peace`;
			emit(
				world,
				'peace',
				[war.attackerId, war.defenderId],
				0.5,
				title,
				{ warId: war.id, netRegions: net },
				[]
			);
		}
	}

	// New alliances.
	for (const s of world.states) {
		for (const [otherId, rel] of Object.entries(s.relations)) {
			if (
				rel.alliance &&
				rel.allianceSince === year &&
				!prev.alliances.has(pairKey(s.id, otherId))
			) {
				if (s.id < otherId) {
					emit(
						world,
						'alliance',
						[s.id, otherId],
						0.3,
						`${name(world, s.id)} and ${name(world, otherId)} form an alliance`,
						{},
						tracesFor(ctx, s.id, `alliance:${otherId}`)
					);
				}
			}
		}
	}

	// Per-state changes.
	for (const s of world.states) {
		const before = prev.states.get(s.id);
		if (!before) continue;

		if (before.alive && !s.alive) {
			const conqueror = strongestClaimant(world, s.id);
			emit(
				world,
				'territory',
				conqueror ? [s.id, conqueror] : [s.id],
				1,
				conqueror
					? `${name(world, s.id)} is conquered by ${name(world, conqueror)}`
					: `${name(world, s.id)} ceases to exist`,
				{},
				[]
			);
			continue;
		}
		if (!s.alive) continue;

		if (before.governmentType !== s.politics.governmentType) {
			emit(
				world,
				'politics',
				[s.id],
				0.6,
				`${name(world, s.id)} becomes a ${label(s.politics.governmentType)}`,
				{ from: before.governmentType, to: s.politics.governmentType },
				transitionCauses(ctx, s)
			);
		}

		const territoryLoss =
			before.territory > 0 ? (before.territory - s.territory) / before.territory : 0;
		if (territoryLoss > 0.12) {
			emit(
				world,
				'territory',
				[s.id],
				0.7,
				`${name(world, s.id)} loses ${(territoryLoss * 100).toFixed(0)}% of its territory`,
				{ fraction: territoryLoss },
				[]
			);
		}

		const techJump = technologyIndex(s.technology) - before.technologyIndex;
		if (techJump > 0.012) {
			emit(
				world,
				'technology',
				[s.id],
				0.4,
				`${name(world, s.id)} undergoes rapid technological advance`,
				{ delta: techJump },
				tracesFor(ctx, s.id, 'technologyGrowth')
			);
		}

		const growth = before.gdpPerCapita > 0 ? s.gdpPerCapita / before.gdpPerCapita - 1 : 0;
		if (Math.abs(growth) > 0.1) {
			emit(
				world,
				'economy',
				[s.id],
				0.3,
				growth > 0
					? `${name(world, s.id)}'s economy surges`
					: `${name(world, s.id)}'s economy contracts sharply`,
				{ growth },
				tracesFor(ctx, s.id, 'gdpGrowth')
			);
		}

		if (s.foodStress > 0.5 && before.foodStress <= 0.5) {
			emit(
				world,
				'demography',
				[s.id],
				0.4,
				`Food shortages grip ${name(world, s.id)}`,
				{ foodStress: s.foodStress },
				[]
			);
		}
	}
}

function label(type: GovernmentType): string {
	return type.replace(/-/g, ' ');
}

function transitionCauses(ctx: SimContext, s: State): Cause[] {
	const metrics = ctx.traces?.forState(s.id);
	if (!metrics) return [];
	for (const [key, causes] of Object.entries(metrics)) {
		if (key.startsWith('transition:')) return causes;
	}
	return [];
}

function strongestClaimant(world: World, deadId: string): string | null {
	let best: string | null = null;
	let bestTerritory = -1;
	for (const s of world.states) {
		if (!s.alive || s.id === deadId) continue;
		if (s.relations[deadId]?.territorialClaims && s.territory > bestTerritory) {
			bestTerritory = s.territory;
			best = s.id;
		}
	}
	return best ?? world.states.filter((s) => s.alive && s.id !== deadId)[0]?.id ?? null;
}
