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

<div class="inspector" style:--hue={country.colorHue}>
	<div class="head">
		<span class="swatch"></span>
		<div>
			<h2>{country.name}</h2>
			<p class="gov">
				{titleCase(country.politics.governmentType)}{country.alive ? '' : ' · fallen'}
			</p>
		</div>
	</div>

	<div class="stats">
		<div class="stat">
			<span class="k">Population</span>
			<span class="v num">{population(country.population)}</span>
		</div>
		<div class="stat">
			<span class="k">Territory</span>
			<span class="v num">{country.territory.toFixed(0)} <i>· {regionCount} rgn</i></span>
		</div>

		<div class="stat wide">
			<span class="k">GDP</span>
			<span class="v num">{compact(country.gdp)}</span>
			<Sparkline values={series((s) => s.gdp)} colour="#38bdf8" />
		</div>
		<div class="stat wide">
			<span class="k">GDP / capita</span>
			<span class="v num">{country.gdpPerCapita.toFixed(2)}</span>
			<Sparkline values={series((s) => s.gdpPerCapita)} colour="#38bdf8" />
			<button class="why" class:on={openWhy === 'gdpGrowth'} onclick={() => toggle('gdpGrowth')}
				>why</button
			>
		</div>
		<div class="stat wide">
			<span class="k">Stability</span>
			<span class="v num">{percent(country.politics.stability)}</span>
			<Sparkline values={series((s) => s.stability)} colour="#34d399" />
			<button class="why" class:on={openWhy === 'stability'} onclick={() => toggle('stability')}
				>why</button
			>
		</div>
		<div class="stat wide">
			<span class="k">Legitimacy</span>
			<span class="v num">{percent(country.politics.legitimacy)}</span>
			<Sparkline values={series((s) => s.legitimacy)} colour="#34d399" />
			<button class="why" class:on={openWhy === 'legitimacy'} onclick={() => toggle('legitimacy')}
				>why</button
			>
		</div>
		<div class="stat wide">
			<span class="k">Technology</span>
			<span class="v num">{technologyIndex(country.technology).toFixed(2)}</span>
			<Sparkline values={series((s) => s.technologyIndex)} colour="#a78bfa" />
			<button
				class="why"
				class:on={openWhy === 'technologyGrowth'}
				onclick={() => toggle('technologyGrowth')}>why</button
			>
		</div>
		<div class="stat wide">
			<span class="k">Military</span>
			<span class="v num">{compact(country.military.power)}</span>
			<Sparkline values={series((s) => s.militaryPower)} colour="#f5a524" />
		</div>
	</div>

	{#if openWhy}
		<div class="why-box">
			<WhyPanel title={WHY_TITLES[openWhy] ?? openWhy} causes={causesFor(openWhy)} />
		</div>
	{/if}

	<div class="section">
		<h3>Current wars</h3>
		{#if activeWars.length === 0}
			<p class="none">At peace.</p>
		{:else}
			<ul class="tags">
				{#each activeWars as w (w.id)}
					<li class="tag war">
						{w.attackerId === country.id ? '⚔ vs' : '🛡 vs'}
						{nameOf(w.attackerId === country.id ? w.defenderId : w.attackerId)}
						<span class="since">{w.startYear}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="section">
		<h3>Alliances</h3>
		{#if allies.length === 0}
			<p class="none">None.</p>
		{:else}
			<ul class="tags">
				{#each allies as a (a)}
					<li class="tag ally">{a}</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="section">
		<h3>Top trade partners</h3>
		{#if tradePartners.length === 0}
			<p class="none">Isolated.</p>
		{:else}
			<ul class="trade">
				{#each tradePartners as p (p.name)}
					<li>
						<span>{p.name}</span>
						<span class="bar"><i style:width={percent(p.trade)}></i></span>
						<span class="num">{percent(p.trade)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.inspector {
		font-size: 13px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding-bottom: 0.75rem;
		margin-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
	}
	.swatch {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 6px;
		flex: none;
		background: hsl(var(--hue) 60% 56%);
		box-shadow: 0 0 16px -3px hsl(var(--hue) 70% 55% / 0.6);
	}
	h2 {
		font-size: 16px;
		line-height: 1.1;
	}
	.gov {
		margin: 0.1rem 0 0;
		font-size: 11px;
		color: var(--text-faint);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem 0.6rem;
	}
	.stat {
		display: grid;
		gap: 0.05rem;
		padding: 0.4rem 0.5rem;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.stat.wide {
		grid-column: 1 / -1;
		grid-template-columns: 6rem 3.4rem 1fr auto;
		align-items: center;
		gap: 0 0.5rem;
	}
	.stat .k {
		font-size: 10px;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--text-faint);
	}
	.stat .v {
		font-size: 13px;
		color: var(--text);
	}
	.stat .v i {
		color: var(--text-faint);
		font-style: normal;
		font-size: 11px;
	}
	.why {
		justify-self: end;
		appearance: none;
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-faint);
		background: transparent;
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		padding: 0.15rem 0.4rem;
		cursor: pointer;
		transition:
			color 0.14s,
			border-color 0.14s,
			background 0.14s;
	}
	.why:hover {
		color: var(--text);
		border-color: var(--text-faint);
	}
	.why.on {
		color: var(--accent-ink);
		background: var(--accent);
		border-color: var(--accent);
	}
	.why-box {
		margin: 0.7rem 0 0;
		padding: 0.6rem;
		background: var(--panel-2);
		border: 1px solid var(--border);
		border-left: 2px solid var(--accent);
		border-radius: var(--radius-sm);
	}

	.section {
		margin-top: 1.1rem;
	}
	h3 {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--text-faint);
		margin-bottom: 0.4rem;
	}
	.none {
		margin: 0;
		color: var(--text-faint);
		font-size: 12px;
	}
	.tags {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.tag {
		font-size: 11px;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--border-strong);
		color: var(--text-dim);
	}
	.tag.war {
		color: var(--danger);
		border-color: color-mix(in srgb, var(--danger) 40%, transparent);
		background: color-mix(in srgb, var(--danger) 12%, transparent);
	}
	.tag.ally {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.tag .since {
		color: var(--text-faint);
		font-family: var(--font-mono);
		margin-left: 0.25rem;
	}

	.trade {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.3rem;
	}
	.trade li {
		display: grid;
		grid-template-columns: 1fr 4rem 2.5rem;
		align-items: center;
		gap: 0.5rem;
		font-size: 12px;
	}
	.trade .bar {
		height: 0.4rem;
		background: var(--elev);
		border-radius: 999px;
		overflow: hidden;
	}
	.trade .bar i {
		display: block;
		height: 100%;
		background: var(--accent);
	}
	.trade .num {
		text-align: right;
		color: var(--text-dim);
		font-size: 11px;
	}
</style>
