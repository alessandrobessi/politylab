import { describe, it, expect } from 'vitest';
import { WorkerCore } from './core';
import { STATS_TAIL } from './protocol';
import { generateWorld } from '$lib/worldgen';
import { simulateYears } from '$lib/simulation';

describe('WorkerCore (M23)', () => {
	it('generates, advances, and reports a truncated state', () => {
		const core = new WorkerCore();
		core.generate(7);
		core.run(300);
		const s = core.snapshot(false);
		expect(s.type).toBe('state');
		expect(s.world.year).toBe(300);
		expect(s.viewYear).toBeNull();
		// events are truncated to a tail for transport, but the true total is reported
		expect(s.totalEvents).toBeGreaterThanOrEqual(s.world.events.length);
		for (const rows of Object.values(s.statsTail)) {
			expect(rows.length).toBeLessThanOrEqual(STATS_TAIL);
		}
	});

	it('fullHistory returns the complete, untruncated per-state series', () => {
		const core = new WorkerCore();
		core.generate(7);
		core.run(400); // longer than STATS_TAIL

		const tail = core.snapshot(false).statsTail;
		const { stats, liveYear } = core.fullHistory();
		expect(liveYear).toBe(400);

		const anyId = Object.keys(stats)[0]!;
		expect(stats[anyId]!.length).toBe(401); // year 0 baseline + 400 ticks
		expect(tail[anyId]!.length).toBe(STATS_TAIL); // the tail is still capped
		expect(stats[anyId]![0]!.year).toBe(0);
		expect(stats[anyId]!.at(-1)!.year).toBe(400);

		// it's a copy — mutating the result must not touch the simulation
		stats[anyId]!.push({ ...stats[anyId]!.at(-1)! });
		expect(core.fullHistory().stats[anyId]!.length).toBe(401);
	});

	it('matches a plain engine run for the same seed (worker adds no divergence)', () => {
		const core = new WorkerCore();
		core.generate(481204);
		core.run(200);

		const plain = generateWorld(481204);
		simulateYears(plain, 200);

		expect(core.snapshot(false).world.states.map((s) => s.territory)).toEqual(
			plain.states.map((s) => s.territory)
		);
		expect(core.snapshot(false).world.year).toBe(plain.year);
	});

	it('seek enters a read-only view of the nearest earlier snapshot; resume returns to live', () => {
		const core = new WorkerCore();
		core.generate(1);
		core.run(85);
		const liveYear = core.snapshot(false).world.year;

		core.seek(42);
		const replay = core.snapshot(false);
		expect(replay.viewYear).toBe(40); // snapshots every 10y
		expect(replay.world.year).toBe(40);
		// the timeline extent still tracks the true present during replay
		expect(replay.liveYear).toBe(liveYear);

		core.run(1); // advancing leaves the replay view
		expect(core.snapshot(false).viewYear).toBeNull();
		expect(core.snapshot(false).world.year).toBe(liveYear + 1);
	});

	it('export → load round-trips and resumes the exact trajectory', () => {
		const a = new WorkerCore();
		a.generate(99);
		a.run(120);
		const saved = a.export();

		const b = new WorkerCore();
		b.load(saved);
		expect(b.snapshot(false).world.year).toBe(120);

		a.run(80);
		b.run(80);
		expect(b.snapshot(false).world.states.map((s) => s.gdp)).toEqual(
			a.snapshot(false).world.states.map((s) => s.gdp)
		);
	});

	it('preserves recorded history across load (snapshots + per-state stats)', () => {
		const a = new WorkerCore();
		a.generate(7);
		a.run(55);
		const saved = a.export();
		const b = new WorkerCore();
		b.load(saved);
		expect(b.snapshotYears).toEqual([0, 10, 20, 30, 40, 50]);
		b.seek(25);
		expect(b.snapshot(false).world.year).toBe(20);
	});
});
