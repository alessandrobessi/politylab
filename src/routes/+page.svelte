<script lang="ts">
	import { generateWorld } from '$lib/worldgen';

	const INITIAL_SEED = 481204;
	let seed = $state(INITIAL_SEED);
	let world = $state(generateWorld(INITIAL_SEED));

	function regenerate() {
		world = generateWorld(seed);
	}

	const millions = (n: number) => (n / 1_000_000).toFixed(2) + 'M';
	const techAvg = (t: Record<string, number>) => {
		const vs = Object.values(t);
		return (vs.reduce((a, b) => a + b, 0) / vs.length).toFixed(2);
	};
	const fill = (hue: number) => `hsl(${hue.toFixed(0)} 55% 55%)`;
	const pointsOf = (polygon: readonly (readonly [number, number])[]) =>
		polygon.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

	const ownerHue = (ownerId: string | null) =>
		world.states.find((s) => s.id === ownerId)?.colorHue ?? 0;
</script>

<main>
	<h1>PolityLab</h1>
	<p class="tagline">
		Milestone 4 — procedural world generator. Diagnostic view: Voronoi regions coloured by owning
		state.
	</p>

	<form
		class="controls"
		onsubmit={(e) => {
			e.preventDefault();
			regenerate();
		}}
	>
		<label>
			Seed
			<input type="number" bind:value={seed} />
		</label>
		<button type="submit">Generate</button>
		<span class="meta">{world.states.length} states · {world.regions.length} regions</span>
	</form>

	<svg viewBox="0 0 {world.width} {world.height}" role="img" aria-label="Generated world map">
		{#each world.regions as region (region.id)}
			<polygon
				points={pointsOf(region.polygon)}
				fill={fill(ownerHue(region.ownerId))}
				stroke="rgba(0,0,0,0.25)"
				stroke-width="0.75"
			/>
		{/each}
		{#each world.states as state (state.id)}
			{@const r = world.regions.find((rr) => rr.ownerId === state.id)}
			{#if r}
				<text
					x={r.site[0]}
					y={r.site[1]}
					text-anchor="middle"
					font-size="14"
					fill="rgba(0,0,0,0.75)">{state.name}</text
				>
			{/if}
		{/each}
	</svg>

	<table>
		<thead>
			<tr>
				<th>State</th>
				<th>Gov</th>
				<th>Regions</th>
				<th>Population</th>
				<th>GDP p.c.</th>
				<th>Tech</th>
				<th>Stability</th>
				<th>Food ratio</th>
			</tr>
		</thead>
		<tbody>
			{#each world.states as state (state.id)}
				<tr>
					<td><span class="swatch" style:background={fill(state.colorHue)}></span>{state.name}</td>
					<td>{state.politics.governmentType}</td>
					<td>{world.regions.filter((r) => r.ownerId === state.id).length}</td>
					<td>{millions(state.population)}</td>
					<td>{state.gdpPerCapita.toFixed(2)}</td>
					<td>{techAvg(state.technology)}</td>
					<td>{(state.politics.stability * 100).toFixed(0)}%</td>
					<td>{state.foodRatio.toFixed(2)}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</main>

<style>
	main {
		max-width: 1040px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}
	h1 {
		margin: 0 0 0.25rem;
	}
	.tagline {
		margin: 0 0 1rem;
		color: #555;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.controls label {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}
	.controls input {
		width: 9rem;
	}
	.meta {
		color: #666;
		font-size: 0.9rem;
	}
	svg {
		width: 100%;
		height: auto;
		border: 1px solid #ddd;
		background: #eef2f5;
		display: block;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
		font-size: 0.9rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid #e3e3e3;
	}
	.swatch {
		display: inline-block;
		width: 0.8rem;
		height: 0.8rem;
		border-radius: 2px;
		margin-right: 0.4rem;
		vertical-align: middle;
	}
</style>
