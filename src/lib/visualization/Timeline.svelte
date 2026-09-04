<script lang="ts">
	let {
		year,
		max,
		replaying,
		onseek,
		onresume
	}: {
		year: number;
		max: number;
		replaying: boolean;
		onseek: (year: number) => void;
		onresume: () => void;
	} = $props();
</script>

<div class="timeline" class:replaying>
	<input
		type="range"
		min="0"
		max={Math.max(1, max)}
		value={year}
		oninput={(e) => onseek(Number((e.currentTarget as HTMLInputElement).value))}
		aria-label="Timeline scrubber"
	/>
	<span class="pos">Year {year} / {max}</span>
	{#if replaying}
		<button onclick={onresume}>Return to present</button>
	{/if}
</div>

<style>
	.timeline {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.35rem 0;
	}
	.timeline.replaying {
		background: #fffaf0;
		border: 1px solid #f0e0c0;
		border-radius: 4px;
		padding: 0.35rem 0.6rem;
	}
	input[type='range'] {
		flex: 1;
	}
	.pos {
		font-size: 0.8rem;
		color: #666;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	button {
		font-size: 0.78rem;
		padding: 0.2rem 0.55rem;
		border: 1px solid #d0a94f;
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		white-space: nowrap;
	}
</style>
