import { openDB, type IDBPDatabase } from 'idb';
import type { SavedSimulation } from '$lib/workers/protocol';

/**
 * Local saved-world store (BLUEPRINT.md §35). IndexedDB via `idb`; no backend.
 * A saved world is the full serializable simulation state, so a reload resumes
 * the exact deterministic trajectory.
 */

export interface SavedWorldMeta {
	name: string;
	seed: number;
	year: number;
	savedAt: number;
}

interface SavedWorldRecord extends SavedWorldMeta {
	saved: SavedSimulation;
}

const DB_NAME = 'politylab';
const STORE = 'worlds';

async function db(): Promise<IDBPDatabase> {
	return openDB(DB_NAME, 1, {
		upgrade(database) {
			if (!database.objectStoreNames.contains(STORE)) {
				database.createObjectStore(STORE, { keyPath: 'name' });
			}
		}
	});
}

export async function listWorlds(): Promise<SavedWorldMeta[]> {
	const all = (await (await db()).getAll(STORE)) as SavedWorldRecord[];
	return all
		.map(({ name, seed, year, savedAt }) => ({ name, seed, year, savedAt }))
		.sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveWorld(name: string, saved: SavedSimulation): Promise<void> {
	const record: SavedWorldRecord = {
		name,
		seed: saved.world.seed,
		year: saved.world.year,
		savedAt: Date.now(),
		saved
	};
	await (await db()).put(STORE, record);
}

export async function loadWorld(name: string): Promise<SavedSimulation | null> {
	const record = (await (await db()).get(STORE, name)) as SavedWorldRecord | undefined;
	return record?.saved ?? null;
}

export async function deleteWorld(name: string): Promise<void> {
	await (await db()).delete(STORE, name);
}
