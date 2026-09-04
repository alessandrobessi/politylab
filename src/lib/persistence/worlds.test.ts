import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { deleteWorld, listWorlds, loadWorld, saveWorld } from './worlds';
import { WorkerCore } from '$lib/workers/core';

beforeEach(() => {
	// fresh IndexedDB per test
	globalThis.indexedDB = new IDBFactory();
});

describe('saved-world persistence (M26)', () => {
	it('save → list → load → delete round-trips', async () => {
		const core = new WorkerCore();
		core.generate(31);
		core.run(40);
		const saved = core.export();

		await saveWorld('my world', saved);
		const list = await listWorlds();
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ name: 'my world', seed: 31, year: 40 });

		const back = await loadWorld('my world');
		expect(back).not.toBeNull();
		expect(back!.world.year).toBe(40);

		await deleteWorld('my world');
		expect(await listWorlds()).toHaveLength(0);
	});

	it('a reloaded world resumes the exact deterministic trajectory', async () => {
		const uninterrupted = new WorkerCore();
		uninterrupted.generate(777);
		uninterrupted.run(150);

		const half = new WorkerCore();
		half.generate(777);
		half.run(60);
		await saveWorld('checkpoint', half.export());

		const resumed = new WorkerCore();
		resumed.load((await loadWorld('checkpoint'))!);
		resumed.run(90); // 60 + 90 = 150

		const a = uninterrupted.snapshot(false).world;
		const b = resumed.snapshot(false).world;
		expect(b.year).toBe(a.year);
		expect(b.states.map((s) => [s.gdp, s.population, s.territory, s.politics.stability])).toEqual(
			a.states.map((s) => [s.gdp, s.population, s.territory, s.politics.stability])
		);
		expect(b.events.length).toBe(a.events.length);
	});

	it('overwrites a world saved under the same name', async () => {
		const core = new WorkerCore();
		core.generate(5);
		core.run(20);
		await saveWorld('slot', core.export());
		core.run(20);
		await saveWorld('slot', core.export());

		const list = await listWorlds();
		expect(list).toHaveLength(1);
		expect(list[0]!.year).toBe(40);
	});
});
