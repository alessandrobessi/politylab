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

	const pct = $derived(max > 0 ? Math.min(100, (year / max) * 100) : 0);
</script>

<div class="timeline panel" class:replaying>
	<span class="eyebrow lead">{replaying ? 'Replay' : 'Timeline'}</span>

	<div class="track">
		<div class="fill" style:width="{pct}%"></div>
		<input
			type="range"
			min="0"
			max={Math.max(1, max)}
			value={year}
			oninput={(e) => onseek(Number((e.currentTarget as HTMLInputElement).value))}
			aria-label="Timeline scrubber"
		/>
	</div>

	<span class="pos num">{year}<span class="sep">/</span>{max}</span>

	{#if replaying}
		<button class="btn resume" onclick={onresume}>Return to present ↩</button>
	{/if}
</div>

<style>
	.timeline {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.55rem 0.9rem;
		flex: none;
	}
	.timeline.replaying {
		border-color: color-mix(in srgb, var(--warn) 45%, transparent);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--warn) 30%, transparent) inset;
	}
	.lead {
		flex: none;
	}
	.timeline.replaying .lead {
		color: var(--warn);
	}

	.track {
		position: relative;
		flex: 1;
		height: 14px;
		display: flex;
		align-items: center;
	}
	.track::before {
		content: '';
		position: absolute;
		inset: 5px 0;
		background: var(--elev);
		border-radius: 999px;
	}
	.fill {
		position: absolute;
		left: 0;
		top: 5px;
		bottom: 5px;
		background: linear-gradient(90deg, var(--accent-strong), var(--accent));
		border-radius: 999px;
		pointer-events: none;
	}
	.timeline.replaying .fill {
		background: linear-gradient(90deg, #b4741a, var(--warn));
	}
	.track input[type='range'] {
		position: relative;
		background: transparent;
		margin: 0;
	}
	.timeline.replaying input[type='range']::-webkit-slider-thumb {
		background: var(--warn);
		box-shadow: 0 0 12px -1px var(--warn-glow);
	}
	.timeline.replaying input[type='range']::-moz-range-thumb {
		background: var(--warn);
	}

	.pos {
		flex: none;
		font-size: 12px;
		color: var(--text-dim);
		white-space: nowrap;
	}
	.pos .sep {
		color: var(--text-faint);
		margin: 0 0.15rem;
	}
	.resume {
		flex: none;
		color: var(--warn);
		border-color: color-mix(in srgb, var(--warn) 45%, transparent);
	}
	.resume:hover:not(:disabled) {
		color: var(--warn);
		border-color: var(--warn);
	}
</style>
