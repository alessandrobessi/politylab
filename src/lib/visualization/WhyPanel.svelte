<script lang="ts">
	import type { Cause } from '$lib/simulation';
	import { toDisplayCauses } from './causes';

	let { title, causes }: { title: string; causes: Cause[] } = $props();

	const rows = $derived(toDisplayCauses(causes));
</script>

<div class="why">
	<div class="why-title"><span class="q">?</span> {title}</div>
	{#if rows.length === 0}
		<p class="empty">No contributors recorded this year.</p>
	{:else}
		<ul>
			{#each rows as row (row.factor)}
				<li>
					<span class="label">{row.label}</span>
					<span class="bar" class:neg={row.impact < 0}>
						<span class="fill" style:width="{(row.share * 100).toFixed(0)}%"></span>
					</span>
					<span class="impact num" class:neg={row.impact < 0}>
						{row.impact > 0 ? '+' : ''}{row.impact.toFixed(3)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.why {
		font-size: 12px;
	}
	.why-title {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 12px;
		color: var(--text);
		margin-bottom: 0.5rem;
	}
	.q {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.05rem;
		height: 1.05rem;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 10px;
		font-weight: 700;
	}
	.empty {
		color: var(--text-faint);
		margin: 0;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.3rem;
	}
	li {
		display: grid;
		grid-template-columns: 7.5rem 1fr 3.5rem;
		align-items: center;
		gap: 0.5rem;
	}
	.label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--text-dim);
	}
	.bar {
		height: 0.5rem;
		background: var(--elev);
		border-radius: 999px;
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--good);
	}
	.bar.neg .fill {
		background: var(--danger);
	}
	.impact {
		text-align: right;
		font-size: 11px;
		color: var(--good);
	}
	.impact.neg {
		color: var(--danger);
	}
</style>
