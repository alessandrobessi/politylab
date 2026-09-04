<script lang="ts">
	import type { State as StateModel, StateYearStats, War, Cause } from '$lib/simulation';
	import { compact, percent, population, titleCase } from './format';
	import { technologyIndex } from '$lib/simulation';
	import Sparkline from './Sparkline.svelte';
	import WhyPanel from './WhyPanel.svelte';

	let {
		country,
		stats,
		wars,
		regionCount,
		nameOf,
		causesFor
	}: {
		country: StateModel;
		stats: StateYearStats[];
		wars: War[];
		regionCount: number;
		nameOf: (id: string) => string;
		causesFor: (metric: string) => Cause[];
	} = $props();

	const WHY_TITLES: Record<string, string> = {
		gdpGrowth: 'GDP growth',
		stability: 'Stability',
		legitimacy: 'Legitimacy',
		technologyGrowth: 'Technology growth'
	};

	let openWhy = $state<string | null>(null);
	const toggle = (metric: string) => (openWhy = openWhy === metric ? null : metric);

	const series = (pick: (s: StateYearStats) => number) => stats.slice(-120).map(pick);

	const activeWars = $derived(wars.filter((w) => w.active));
	const allies = $derived(
		Object.entries(country.relations)
			.filter(([, r]) => r.alliance)
			.map(([id]) => nameOf(id))
	);
	const tradePartners = $derived(
		Object.entries(country.relations)
			.map(([id, r]) => ({ name: nameOf(id), trade: r.trade }))
			.sort((a, b) => b.trade - a.trade)
			.slice(0, 3)
			.filter((p) => p.trade > 0.05)
	);
</script>

<div class="inspector">
	<h2>
		<span class="swatch" style:background="hsl({country.colorHue} 55% 55%)"></span>
		{country.name}
	</h2>
	<p class="gov">{titleCase(country.politics.governmentType)}{country.alive ? '' : ' · fallen'}</p>

	<dl>
		<div>
			<dt>Population</dt>
			<dd>{population(country.population)}</dd>
		</div>
		<div>
			<dt>Territory</dt>
			<dd>{country.territory.toFixed(0)} · {regionCount} regions</dd>
		</div>
		<div>
			<dt>GDP</dt>
			<dd>{compact(country.gdp)} <Sparkline values={series((s) => s.gdp)} /></dd>
		</div>
		<div>
			<dt>GDP / capita</dt>
			<dd>
				{country.gdpPerCapita.toFixed(2)}
				<Sparkline values={series((s) => s.gdpPerCapita)} />
				<button class="why-btn" onclick={() => toggle('gdpGrowth')}>?</button>
			</dd>
		</div>
		<div>
			<dt>Stability</dt>
			<dd>
				{percent(country.politics.stability)}
				<Sparkline values={series((s) => s.stability)} colour="#3182ce" />
				<button class="why-btn" onclick={() => toggle('stability')}>?</button>
			</dd>
		</div>
		<div>
			<dt>Legitimacy</dt>
			<dd>
				{percent(country.politics.legitimacy)}
				<Sparkline values={series((s) => s.legitimacy)} colour="#3182ce" />
				<button class="why-btn" onclick={() => toggle('legitimacy')}>?</button>
			</dd>
		</div>
		<div>
			<dt>Technology</dt>
			<dd>
				{technologyIndex(country.technology).toFixed(2)}
				<Sparkline values={series((s) => s.technologyIndex)} colour="#38a169" />
				<button class="why-btn" onclick={() => toggle('technologyGrowth')}>?</button>
			</dd>
		</div>
		<div>
			<dt>Military power</dt>
			<dd>
				{compact(country.military.power)}
				<Sparkline values={series((s) => s.militaryPower)} colour="#c05621" />
			</dd>
		</div>
	</dl>

	{#if openWhy}
		<div class="why-box">
			<WhyPanel title={WHY_TITLES[openWhy] ?? openWhy} causes={causesFor(openWhy)} />
		</div>
	{/if}

	<h3>Current wars</h3>
	{#if activeWars.length === 0}
		<p class="none">At peace.</p>
	{:else}
		<ul>
			{#each activeWars as w (w.id)}
				<li>
					{w.attackerId === country.id ? 'attacking' : 'defending against'}
					{nameOf(w.attackerId === country.id ? w.defenderId : w.attackerId)}
					<small>(since {w.startYear})</small>
				</li>
			{/each}
		</ul>
	{/if}

	<h3>Alliances</h3>
	<p class="none">{allies.length ? allies.join(', ') : 'None.'}</p>

	<h3>Top trade partners</h3>
	{#if tradePartners.length === 0}
		<p class="none">Isolated.</p>
	{:else}
		<ul>
			{#each tradePartners as p (p.name)}
				<li>{p.name} <small>({percent(p.trade)})</small></li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.inspector {
		font-size: 0.85rem;
	}
	h2 {
		font-size: 1.05rem;
		margin: 0 0 0.15rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.swatch {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 2px;
	}
	.gov {
		margin: 0 0 0.75rem;
		color: #666;
		text-transform: capitalize;
	}
	dl {
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}
	dl > div {
		display: grid;
		grid-template-columns: 7rem 1fr;
		align-items: center;
	}
	dt {
		color: #777;
	}
	dd {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-variant-numeric: tabular-nums;
	}
	.why-btn {
		width: 1.2rem;
		height: 1.2rem;
		padding: 0;
		border-radius: 50%;
		border: 1px solid #bbb;
		background: #f4f4f4;
		font-size: 0.7rem;
		line-height: 1;
		cursor: pointer;
	}
	.why-box {
		margin: 0.6rem 0;
		padding: 0.5rem;
		background: #f7f9fb;
		border: 1px solid #e2e8ee;
		border-radius: 4px;
	}
	h3 {
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: #888;
		margin: 1rem 0 0.25rem;
	}
	ul {
		margin: 0;
		padding-left: 1.1rem;
	}
	.none {
		margin: 0;
		color: #999;
	}
	small {
		color: #999;
	}
</style>
