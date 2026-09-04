<script lang="ts">
	import type { SavedSimulation } from '$lib/workers/protocol';
	import {
		deleteWorld,
		listWorlds,
		loadWorld,
		saveWorld,
		type SavedWorldMeta
	} from '$lib/persistence/worlds';

	let {
		seed,
		year,
		exportState,
		onload
	}: {
		seed: number;
		year: number;
		exportState: () => Promise<SavedSimulation>;
		onload: (saved: SavedSimulation) => void;
	} = $props();

	let worlds = $state<SavedWorldMeta[]>([]);
	let name = $state('');
	let busy = $state(false);
	let error = $state('');

	async function refresh() {
		try {
			worlds = await listWorlds();
		} catch (e) {
			error = String(e);
		}
	}
	$effect(() => {
		refresh();
	});

	async function save() {
		const label = name.trim() || `seed ${seed} @${year}`;
		busy = true;
		try {
			await saveWorld(label, await exportState());
			name = '';
			await refresh();
		} catch (e) {
			error = String(e);
		} finally {
			busy = false;
		}
	}

	async function load(worldName: string) {
		busy = true;
		try {
			const saved = await loadWorld(worldName);
			if (saved) onload(saved);
		} finally {
			busy = false;
		}
	}

	async function remove(worldName: string) {
		await deleteWorld(worldName);
		await refresh();
	}
</script>

<details class="saved">
	<summary>
		<span class="eyebrow">Saved worlds</span>
		<span class="count num">{worlds.length}</span>
	</summary>

	<div class="save-row">
		<input placeholder={`seed ${seed} @${year}`} bind:value={name} />
		<button class="btn" onclick={save} disabled={busy}>Save ↓</button>
	</div>
	{#if error}<p class="err">{error}</p>{/if}

	<ul>
		{#each worlds as w (w.name)}
			<li>
				<button class="name" onclick={() => load(w.name)} disabled={busy}>
					<span class="wn">{w.name}</span>
					<small class="num">seed {w.seed} · yr {w.year}</small>
				</button>
				<button class="del" onclick={() => remove(w.name)} aria-label="delete world">×</button>
			</li>
		{:else}
			<li class="none">Nothing saved yet.</li>
		{/each}
	</ul>
</details>

<style>
	.saved {
		border-top: 1px solid var(--border);
		padding: 0.7rem 0.9rem 0.9rem;
		font-size: 12px;
	}
	summary {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::before {
		content: '▸';
		color: var(--text-faint);
		font-size: 10px;
		transition: transform 0.15s;
	}
	.saved[open] summary::before {
		transform: rotate(90deg);
	}
	.count {
		color: var(--text-faint);
	}

	.save-row {
		display: flex;
		gap: 0.4rem;
		margin: 0.6rem 0 0.4rem;
	}
	.save-row input {
		flex: 1;
		min-width: 0;
	}
	ul {
		list-style: none;
		margin: 0.3rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.25rem;
	}
	li {
		display: flex;
		gap: 0.3rem;
	}
	.name {
		flex: 1;
		min-width: 0;
		display: grid;
		gap: 0.05rem;
		text-align: left;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 0.35rem 0.5rem;
		cursor: pointer;
		transition:
			background 0.12s,
			border-color 0.12s;
	}
	.name:hover {
		background: var(--elev);
		border-color: var(--border-strong);
	}
	.wn {
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.name small {
		color: var(--text-faint);
		font-size: 10px;
	}
	.del {
		flex: none;
		width: 1.8rem;
		border: 1px solid var(--border);
		background: var(--panel-2);
		color: var(--text-faint);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
		transition:
			color 0.12s,
			border-color 0.12s;
	}
	.del:hover {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 45%, transparent);
	}
	.none {
		color: var(--text-faint);
	}
	.err {
		color: var(--danger);
		margin: 0.25rem 0;
		font-size: 11px;
	}
</style>
