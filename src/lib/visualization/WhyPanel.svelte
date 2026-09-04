<script lang="ts">
	import type { Cause } from '$lib/simulation';
	import { toDisplayCauses } from './causes';

	let { title, causes }: { title: string; causes: Cause[] } = $props();

	const rows = $derived(toDisplayCauses(causes));
</script>

<div class="why">
	<div class="why-title">Why? — {title}</div>
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
					<span class="impact" class:neg={row.impact < 0}>
						{row.impact > 0 ? '+' : ''}{row.impact.toFixed(3)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.why {
		font-size: 0.8rem;
	}
	.why-title {
		font-weight: 600;
		color: #444;
		margin-bottom: 0.3rem;
	}
	.empty {
		color: #999;
		margin: 0;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.2rem;
	}
	li {
		display: grid;
		grid-template-columns: 8rem 1fr 3.5rem;
		align-items: center;
		gap: 0.4rem;
	}
	.label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar {
		height: 0.7rem;
		background: #eef1f4;
		border-radius: 2px;
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: #3a7d3a;
	}
	.bar.neg .fill {
		background: #b33a3a;
	}
	.impact {
		text-align: right;
		font-variant-numeric: tabular-nums;
		color: #3a7d3a;
	}
	.impact.neg {
		color: #b33a3a;
	}
</style>
