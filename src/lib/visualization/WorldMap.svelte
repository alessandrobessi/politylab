<script lang="ts">
	import type { World } from '$lib/simulation';
	import { colourRegions, type MapMode } from './mapModes';

	let {
		world,
		mode = 'political',
		selectedId = null,
		onselect
	}: {
		world: World;
		mode?: MapMode;
		selectedId?: string | null;
		onselect?: (id: string | null) => void;
	} = $props();

	const colouring = $derived(colourRegions(world, mode));
	let hoverId = $state<string | null>(null);

	const stateOf = (ownerId: string | null) =>
		ownerId ? (world.states.find((s) => s.id === ownerId) ?? null) : null;

	const pointsOf = (polygon: readonly (readonly [number, number])[]) =>
		polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

	// One representative label position per living state (its largest region).
	const labels = $derived(
		world.states
			.filter((s) => s.alive)
			.map((s) => {
				const regions = world.regions.filter((r) => r.ownerId === s.id);
				const biggest = regions.reduce(
					(a, r) => (r.area > (a?.area ?? -1) ? r : a),
					regions[0] ?? null
				);
				return biggest ? { id: s.id, name: s.name, at: biggest.site } : null;
			})
			.filter((l): l is { id: string; name: string; at: readonly [number, number] } => l !== null)
	);

	const hoverState = $derived(stateOf(hoverId));

	// Graticule lines for a cartographic feel — evenly spaced in map space.
	const gridStep = 90;
	const vLines = $derived(
		Array.from({ length: Math.floor(world.width / gridStep) + 1 }, (_, i) => i * gridStep)
	);
	const hLines = $derived(
		Array.from({ length: Math.floor(world.height / gridStep) + 1 }, (_, i) => i * gridStep)
	);
</script>

<div class="map-wrap">
	<svg
		viewBox="0 0 {world.width} {world.height}"
		preserveAspectRatio="xMidYMid slice"
		role="group"
		aria-label="World map ({mode} mode)"
		onmouseleave={() => (hoverId = null)}
	>
		<defs>
			<filter id="pl-glow" x="-30%" y="-30%" width="160%" height="160%">
				<feDropShadow dx="0" dy="0" stdDeviation="3.5" flood-color="#38bdf8" flood-opacity="0.9" />
			</filter>
		</defs>

		<rect x="0" y="0" width={world.width} height={world.height} class="ocean" />

		<g class="graticule">
			{#each vLines as x (`v${x}`)}
				<line x1={x} y1="0" x2={x} y2={world.height} />
			{/each}
			{#each hLines as y (`h${y}`)}
				<line x1="0" y1={y} x2={world.width} y2={y} />
			{/each}
		</g>

		<g class:has-selection={selectedId != null}>
			{#each world.regions as region (region.id)}
				<!-- Regions are also selectable via the keyboard-accessible roster list. -->
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<polygon
					points={pointsOf(region.polygon)}
					fill={colouring.fill.get(region.id) ?? '#1b2430'}
					class="region"
					class:owned={region.ownerId != null}
					class:sel={region.ownerId != null && region.ownerId === selectedId}
					class:dim={selectedId && region.ownerId !== selectedId}
					aria-hidden="true"
					onmousemove={() => (hoverId = region.ownerId)}
					onclick={() => onselect?.(region.ownerId === selectedId ? null : region.ownerId)}
				/>
			{/each}
		</g>

		{#each labels as label (label.id)}
			<text
				x={label.at[0]}
				y={label.at[1]}
				text-anchor="middle"
				class="label"
				class:selected={label.id === selectedId}
				class:faded={selectedId && label.id !== selectedId}>{label.name}</text
			>
		{/each}
	</svg>

	{#if hoverState}
		<div class="tooltip">
			<span class="tdot" style:background="hsl({hoverState.colorHue} 60% 58%)"></span>
			{hoverState.name}
		</div>
	{/if}

	{#if colouring.legend}
		<div class="legend">
			{#each colouring.legend as stop (stop.label)}
				<span><i style:background={stop.colour}></i>{stop.label}</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.map-wrap {
		position: relative;
		width: 100%;
		height: 100%;
	}
	svg {
		width: 100%;
		height: 100%;
		display: block;
	}
	.ocean {
		fill: var(--ocean);
	}
	.graticule line {
		stroke: rgba(120, 170, 210, 0.06);
		stroke-width: 0.75;
	}

	.region {
		cursor: pointer;
		stroke: rgba(6, 12, 20, 0.55);
		stroke-width: 0.5;
		transition:
			opacity 0.18s ease,
			filter 0.18s ease;
	}
	.region.owned:hover {
		opacity: 0.85;
	}
	/* When a state is selected, fade the rest and lift the selection. */
	.has-selection .region.dim {
		opacity: 0.4;
	}
	.region.sel {
		stroke: #eaf6ff;
		stroke-width: 1.4;
		filter: url(#pl-glow);
	}

	.label {
		font-family: var(--font-display);
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.02em;
		fill: rgba(255, 255, 255, 0.82);
		pointer-events: none;
		paint-order: stroke;
		stroke: rgba(0, 0, 0, 0.55);
		stroke-width: 3px;
		transition:
			opacity 0.18s,
			fill 0.18s;
	}
	.label.faded {
		opacity: 0.3;
	}
	.label.selected {
		font-weight: 700;
		fill: #fff;
		font-size: 13px;
	}

	.tooltip {
		position: absolute;
		top: 0.6rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: color-mix(in srgb, var(--panel) 90%, transparent);
		backdrop-filter: blur(8px);
		color: var(--text);
		padding: 0.3rem 0.65rem;
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		pointer-events: none;
		box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.7);
	}
	.tdot {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: 50%;
	}

	.legend {
		position: absolute;
		right: 0.6rem;
		bottom: 0.6rem;
		display: flex;
		gap: 0.75rem;
		background: color-mix(in srgb, var(--panel) 88%, transparent);
		backdrop-filter: blur(8px);
		padding: 0.35rem 0.6rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--text-dim);
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}
	.legend i {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 2px;
		display: inline-block;
	}
</style>
