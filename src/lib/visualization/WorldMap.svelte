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
</script>

<div class="map-wrap">
	<svg
		viewBox="0 0 {world.width} {world.height}"
		role="group"
		aria-label="World map ({mode} mode)"
		onmouseleave={() => (hoverId = null)}
	>
		{#each world.regions as region (region.id)}
			<!-- Regions are also selectable via the keyboard-accessible roster list. -->
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<polygon
				points={pointsOf(region.polygon)}
				fill={colouring.fill.get(region.id) ?? '#d8dde2'}
				stroke={region.ownerId && region.ownerId === selectedId ? '#111' : 'rgba(0,0,0,0.22)'}
				stroke-width={region.ownerId && region.ownerId === selectedId ? 1.6 : 0.6}
				class="region"
				class:dim={selectedId && region.ownerId !== selectedId}
				aria-hidden="true"
				onmousemove={() => (hoverId = region.ownerId)}
				onclick={() => onselect?.(region.ownerId === selectedId ? null : region.ownerId)}
			/>
		{/each}
		{#each labels as label (label.id)}
			<text
				x={label.at[0]}
				y={label.at[1]}
				text-anchor="middle"
				class="label"
				class:selected={label.id === selectedId}>{label.name}</text
			>
		{/each}
	</svg>

	{#if hoverState}
		<div class="tooltip">{hoverState.name}</div>
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
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
		background: #eef2f5;
		border: 1px solid #d5dbe0;
		border-radius: 4px;
	}
	.region {
		cursor: pointer;
		transition: opacity 0.15s;
	}
	.region:hover {
		opacity: 0.82;
	}
	.region.dim {
		opacity: 0.4;
	}
	.label {
		font-size: 13px;
		fill: rgba(0, 0, 0, 0.72);
		pointer-events: none;
		paint-order: stroke;
		stroke: rgba(255, 255, 255, 0.6);
		stroke-width: 2px;
	}
	.label.selected {
		font-weight: 700;
		fill: #000;
	}
	.tooltip {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		background: rgba(0, 0, 0, 0.75);
		color: #fff;
		padding: 0.15rem 0.5rem;
		border-radius: 3px;
		font-size: 0.8rem;
		pointer-events: none;
	}
	.legend {
		position: absolute;
		right: 0.5rem;
		bottom: 0.5rem;
		display: flex;
		gap: 0.6rem;
		background: rgba(255, 255, 255, 0.9);
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.7rem;
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.legend i {
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
		display: inline-block;
	}
</style>
