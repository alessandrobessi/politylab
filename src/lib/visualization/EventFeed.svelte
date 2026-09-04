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
			.slice(-80)
			.reverse()
	);
	const tier = (imp: number) =>
		imp >= 0.9 ? 'crit' : imp >= 0.7 ? 'high' : imp >= 0.5 ? 'mid' : 'low';
</script>

<section class="feed">
	<header>
		<h2>Historical Feed</h2>
		<label>
			<span class="eyebrow">min importance</span>
			<input type="range" min="0" max="1" step="0.1" bind:value={minImportance} />
			<span class="num">{minImportance.toFixed(1)}</span>
		</label>
	</header>
	<ul class="scroll">
		{#each shown as e (e.id)}
			<li class="t-{tier(e.importance)}" class:hot={e.actors.includes(selectedId ?? '')}>
				<span class="year num">{e.year}</span>
				<span class="d"></span>
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
	.feed {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 0;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid var(--border);
	}
	h2 {
		font-size: 12px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-dim);
	}
	label {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: var(--text-faint);
	}
	label input[type='range'] {
		width: 7rem;
	}
	label .num {
		font-size: 11px;
		color: var(--text-dim);
		width: 1.6rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		flex: 1;
		overflow-y: auto;
	}
	li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.32rem 0.75rem;
		border-bottom: 1px solid var(--border);
		border-left: 2px solid transparent;
		font-size: 12px;
		color: var(--text-dim);
	}
	li:hover {
		background: var(--panel-2);
	}
	li.hot {
		background: color-mix(in srgb, var(--accent) 9%, transparent);
		border-left-color: var(--accent);
	}
	.year {
		color: var(--text-faint);
		min-width: 2.75rem;
		font-size: 11px;
	}
	.d {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		flex: none;
		background: var(--text-faint);
	}
	.t-low .d {
		background: #64748b;
	}
	.t-mid .d {
		background: var(--warn);
	}
	.t-high .d {
		background: #fb923c;
	}
	.t-crit .d {
		background: var(--danger);
		box-shadow: 0 0 8px -1px var(--danger);
	}
	.t-crit .title {
		color: var(--text);
	}
	.title {
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.actors {
		display: flex;
		gap: 0.25rem;
		flex: none;
	}
	.actors button {
		font-family: var(--font-mono);
		font-size: 10px;
		padding: 0.05rem 0.4rem;
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		background: transparent;
		color: var(--text-dim);
		cursor: pointer;
		transition:
			color 0.12s,
			border-color 0.12s;
	}
	.actors button:hover {
		color: var(--text);
		border-color: var(--accent);
	}
	.causes {
		color: var(--text-faint);
		font-family: var(--font-mono);
		font-size: 10px;
		flex: none;
		max-width: 14rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.empty {
		color: var(--text-faint);
		justify-content: center;
	}
</style>
