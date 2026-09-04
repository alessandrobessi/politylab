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
	<summary>Saved worlds ({worlds.length})</summary>
	<div class="save-row">
		<input placeholder={`seed ${seed} @${year}`} bind:value={name} />
		<button onclick={save} disabled={busy}>Save</button>
	</div>
	{#if error}<p class="err">{error}</p>{/if}
	<ul>
		{#each worlds as w (w.name)}
			<li>
				<button class="name" onclick={() => load(w.name)} disabled={busy}
					>{w.name}<small> · seed {w.seed} · yr {w.year}</small></button
				>
				<button class="del" onclick={() => remove(w.name)} aria-label="delete">×</button>
			</li>
		{:else}
			<li class="none">Nothing saved yet.</li>
		{/each}
	</ul>
</details>

<style>
	.saved {
		margin-top: 1rem;
		font-size: 0.8rem;
		border-top: 1px solid #eee;
		padding-top: 0.6rem;
	}
	summary {
		cursor: pointer;
		color: #666;
	}
	.save-row {
		display: flex;
		gap: 0.4rem;
		margin: 0.5rem 0;
	}
	.save-row input {
		flex: 1;
		font-size: 0.8rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.2rem;
	}
	li {
		display: flex;
		gap: 0.3rem;
	}
	.name {
		flex: 1;
		text-align: left;
		border: 1px solid #e2e6ea;
		background: #fff;
		padding: 0.25rem 0.4rem;
		border-radius: 3px;
		cursor: pointer;
	}
	.name small {
		color: #999;
	}
	.del {
		border: 1px solid #e2c0c0;
		background: #fff;
		color: #b33;
		border-radius: 3px;
		cursor: pointer;
	}
	.none {
		color: #999;
	}
	.err {
		color: #b33;
		margin: 0.25rem 0;
	}
</style>
