<script lang="ts">
	import type { WorldEvent } from '$lib/simulation';

	let {
		events,
		selectedId = null,
		nameOf,
		onselect
	}: {
		events: WorldEvent[];
		selectedId?: string | null;
		nameOf: (id: string) => string;
		onselect?: (id: string) => void;
	} = $props();

	let minImportance = $state(0.3);

	const shown = $derived(
		events
			.filter((e) => e.importance >= minImportance)
			.slice(-60)
			.reverse()
	);
	const dot = (imp: number) =>
		imp >= 0.9 ? '#c0392b' : imp >= 0.7 ? '#e67e22' : imp >= 0.5 ? '#f1c40f' : '#95a5a6';
</script>

<section class="feed">
	<header>
		<h2>Historical events</h2>
		<label>
			min importance {minImportance.toFixed(1)}
			<input type="range" min="0" max="1" step="0.1" bind:value={minImportance} />
		</label>
	</header>
	<ul>
		{#each shown as e (e.id)}
			<li class:hot={e.actors.includes(selectedId ?? '')}>
				<span class="year">{e.year}</span>
				<span class="d" style:background={dot(e.importance)}></span>
				<span class="title">{e.title}</span>
				{#if e.actors.length}
					<span class="actors">
						{#each e.actors as a (a)}
							<button type="button" onclick={() => onselect?.(a)}>{nameOf(a)}</button>
						{/each}
					</span>
				{/if}
				{#if e.causes.length}
					<span class="causes"
						>{e.causes
							.slice(0, 3)
							.map((c) => c.factor)
							.join(' · ')}</span
					>
				{/if}
			</li>
		{:else}
			<li class="empty">No events at this importance yet — run the clock.</li>
		{/each}
	</ul>
</section>

<style>
	.feed header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	h2 {
		font-size: 0.95rem;
		margin: 0;
	}
	label {
		font-size: 0.78rem;
		color: #666;
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	ul {
		list-style: none;
		padding: 0;
		margin: 0.4rem 0 0;
		max-height: 14rem;
		overflow-y: auto;
		border: 1px solid #e3e3e3;
		border-radius: 4px;
	}
	li {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.28rem 0.6rem;
		border-bottom: 1px solid #f0f0f0;
		font-size: 0.82rem;
	}
	li.hot {
		background: #fff8e6;
	}
	.year {
		color: #888;
		font-variant-numeric: tabular-nums;
		min-width: 2.5rem;
	}
	.d {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		flex: none;
		align-self: center;
	}
	.title {
		flex: 1;
	}
	.actors {
		display: flex;
		gap: 0.2rem;
	}
	.actors button {
		font-size: 0.68rem;
		padding: 0 0.3rem;
		border: 1px solid #ddd;
		border-radius: 3px;
		background: #fafafa;
		cursor: pointer;
	}
	.causes {
		color: #999;
		font-size: 0.72rem;
	}
	.empty {
		color: #999;
	}
</style>
