# BLUEPRINT.md

# Procedural Geopolitical World Simulator

## 1. Vision

Build a browser-based simulation in which procedurally generated states emerge, develop, compete, cooperate, wage wars, change governments, advance technologically, rise, decline, fragment, and occasionally disappear.

The user is primarily an **observer of history**, not a traditional strategy-game player.

The core experience is:

1. Generate a world from a seed.
2. Start the simulation.
3. Watch decades or centuries pass.
4. Observe borders, economies, technologies, governments, alliances, and wars evolve.
5. Click any state or event to understand what happened.
6. Inspect the causal mechanisms behind major historical developments.
7. Rewind the world and explore its history.

The central design principle is:

> Do not script historical events. Simulate mechanisms capable of producing historical events.

A second equally important principle is:

> Whenever possible, the simulator should be able to explain why something happened.

The project should feel less like a simplified *Age of Empires* and more like an interactive geopolitical laboratory.

---

# 2. Product Identity

The simulator sits between:

- grand-strategy game
- agent-based model
- interactive history generator
- complex-systems sandbox
- educational visualization
- computational social-science experiment

It is explicitly **not intended to predict real geopolitics**.

It should instead be presented as:

> A computational thought experiment exploring how geography, economics, institutions, technology, demographics, and power can interact over time.

---

# 3. Core Experience

When the application loads:

```text
World Seed: 481204

[ Generate World ]
```

The generated world initially contains approximately:

- 8 states
- 100–200 geographic regions
- different population sizes
- different resource endowments
- different starting governments
- different economic conditions
- different technological capabilities

The user presses:

```text
▶ Play
```

One simulation tick represents:

```text
1 year
```

Available speeds:

```text
Pause
1x
5x
20x
100x
```

The world then begins evolving automatically.

Example event stream:

```text
124 — Ardan and Velos sign a trade agreement
131 — Ironworking spreads from Tarek to Noria
143 — Food shortages destabilize Velos
149 — General Kael seizes power in Velos
161 — Ardan and Noria form a defensive alliance
173 — Velos declares war on Ardan
179 — Velos captures the Northern Basin
184 — War exhaustion causes unrest in Velos
188 — Ardan and Velos sign a peace treaty
203 — Ardan overtakes Velos economically
```

These events must emerge from simulation state rather than predefined storylines.

---

# 4. v0.1 Scope

The first version should model only:

- geography
- population
- resources
- economy
- technology
- government
- political stability
- military power
- diplomacy
- trade
- alliances
- war
- territorial ownership
- historical events

Do not implement yet:

- individual citizens
- political parties
- religions
- ethnic groups
- currencies
- detailed commodities markets
- naval warfare
- logistics networks
- espionage
- climate change
- epidemics
- internal provinces with autonomy
- detailed migration
- corporations
- financial markets
- tactical battles
- AI-generated rulers
- LLM decision-making
- multiplayer
- accounts
- backend services

The v0.1 success criterion is:

> The simulator can run for 1,000 years and generate different, coherent, interpretable histories.

---

# 5. Technology Stack

Use:

```text
SvelteKit 5
TypeScript
pnpm
Vitest
D3 where useful for visualization
Web Workers for simulation execution
IndexedDB for local saved worlds
```

Initially:

```text
NO backend
NO authentication
NO database server
NO external API dependency
NO LLM dependency
```

Everything should run locally in the browser.

---

# 6. Architectural Principle

The simulation engine must be completely independent from Svelte.

Dependency direction:

```text
UI
 ↓
Simulation Controller
 ↓
Simulation Engine
 ↓
Simulation Systems
 ↓
Domain Models
```

Never allow:

```text
Simulation Engine
 ↓
Svelte components
```

The engine should later be usable from:

- browser
- Node CLI
- automated tests
- Monte Carlo experiments
- server-side simulations

without modification.

---

# 7. Determinism

Determinism is mandatory.

Never call:

```ts
Math.random()
```

inside simulation code.

All stochastic behavior must use a seeded random-number generator.

Conceptually:

```ts
const rng = new SeededRandom(seed);
```

Given:

```text
seed = 481204
configuration = identical
```

the simulator must produce exactly the same world history.

This enables:

- reproducible bugs
- automated testing
- shared worlds
- replay
- Monte Carlo analysis

Users should eventually be able to share:

```text
Seed 18392041
```

and reproduce the same history.

---

# 8. Core Domain Model

## World

```ts
interface World {
  seed: number;
  year: number;

  states: State[];
  regions: Region[];
  wars: War[];
  events: WorldEvent[];

  config: SimulationConfig;
}
```

---

# 9. State Model

Each state is an aggregate political entity.

```ts
interface State {
  id: string;
  name: string;

  alive: boolean;

  population: number;
  territory: number;

  food: number;
  capital: number;

  gdp: number;
  gdpPerCapita: number;
  productivity: number;

  treasury: number;
  debt: number;
  taxRate: number;

  education: number;
  urbanization: number;
  inequality: number;

  technology: TechnologyState;

  politics: PoliticsState;

  military: MilitaryState;

  budget: GovernmentBudget;

  relations: Record<string, Relation>;

  history: StateHistory;
}
```

Most normalized state variables should use:

```text
0.0 → 1.0
```

rather than arbitrary 0–100 values internally.

The UI may display them as percentages.

---

# 10. Region Model

The map consists of regions.

```ts
interface Region {
  id: string;

  ownerId: string | null;

  neighbors: string[];

  area: number;
  population: number;

  agriculturalPotential: number;

  resources: {
    iron: number;
    coal: number;
    oil: number;
    minerals: number;
    genericResources: number;
  };

  terrain: TerrainType;

  infrastructure: number;
}
```

Initial terrain types:

```ts
type TerrainType =
  | "plains"
  | "forest"
  | "hills"
  | "mountains"
  | "desert"
  | "coastal";
```

Terrain initially affects only:

- agricultural output
- resource distribution
- military defense

Do not over-model terrain in v0.1.

---

# 11. Population System

Population changes every year.

Basic model:

```text
new population
=
current population
+ births
- deaths
+ net migration
```

Migration may initially be omitted or approximated.

Population growth should depend on:

- food availability
- medical technology
- economic prosperity
- political stability

Conceptually:

```ts
growthRate =
  basePopulationGrowth *
  foodModifier *
  healthModifier *
  stabilityModifier;
```

Food shortages must cause:

- lower population growth
- increased mortality
- increased political instability

This creates the feedback loop:

```text
population
    ↓
food demand
    ↓
food pressure
    ↓
political instability
```

Population must never become negative.

---

# 12. Economy

Avoid detailed microeconomics initially.

GDP should depend approximately on:

```text
population
×
productivity
×
capital
×
resources
×
stability
```

Conceptual implementation:

```ts
gdp =
  population *
  productivity *
  capitalModifier *
  resourceModifier *
  stabilityModifier;
```

The economy should have three broad sectors:

```ts
interface EconomicStructure {
  agriculture: number;
  industry: number;
  services: number;
}
```

Shares must sum to 1.

Economic development gradually moves activity from:

```text
agriculture
→ industry
→ services
```

depending on:

- technology
- capital
- energy availability
- education
- urbanization

Do not hard-code historical "ages."

---

# 13. Government Revenue

Government revenue:

```text
revenue = GDP × effectiveTaxRate
```

Government spending should be allocated among:

```ts
interface GovernmentBudget {
  infrastructure: number;
  education: number;
  research: number;
  military: number;
  welfare: number;
  administration: number;
}
```

Shares sum to 1.

Example:

```text
Infrastructure    20%
Education         15%
Research          10%
Military          25%
Welfare           15%
Administration    15%
```

Budget allocation should create long-term trade-offs.

Examples:

```text
high military spending
→ stronger short-term military
→ weaker long-term investment
```

```text
high education spending
→ slower immediate payoff
→ higher future productivity and research capacity
```

---

# 14. Technology System

Technology must not be represented by a single value.

Use domains:

```ts
interface TechnologyState {
  agriculture: number;
  materials: number;
  energy: number;
  transport: number;
  medicine: number;
  communication: number;
  military: number;
  institutions: number;
}
```

Values:

```text
0.0 → 1.0
```

Research growth should depend on:

- education
- research spending
- existing technology
- institutional quality
- population
- economic surplus

Conceptually:

```ts
innovation =
  researchEfficiency *
  education *
  sqrt(researchInvestment) *
  institutionalQuality;
```

Use diminishing returns.

---

# 15. Technology Diffusion

Technology must spread between states.

Diffusion depends on:

- technology gap
- trade
- diplomatic openness
- geographic proximity
- relations

Conceptually:

```ts
diffusion =
  technologyGap *
  tradeIntensity *
  openness *
  diffusionRate;
```

This should create technological convergence without guaranteeing it.

Isolation should have both advantages and disadvantages.

---

# 16. Politics

Politics should not be represented only by government labels.

```ts
interface PoliticsState {
  legitimacy: number;
  stability: number;

  politicalParticipation: number;
  centralization: number;
  ruleOfLaw: number;
  institutionalCapacity: number;

  elitePower: number;
  merchantInfluence: number;
  militaryInfluence: number;
  workerInfluence: number;
}
```

Government type is a classification derived partly from political structure.

Initial labels:

```ts
type GovernmentType =
  | "monarchy"
  | "constitutional-monarchy"
  | "republic"
  | "oligarchy"
  | "autocracy"
  | "military-regime"
  | "federation";
```

Avoid direct transformations such as:

```ts
if (stability < 0.2) government = "republic";
```

Political transitions must be probabilistic and conditional.

---

# 17. Political Instability

Political pressure should depend on factors such as:

```text
inequality
food stress
war exhaustion
economic decline
elite conflict
unemployment
```

and be reduced by:

```text
legitimacy
institutional capacity
prosperity
```

Conceptually:

```ts
pressure =
    inequality * inequalityWeight
  + foodStress * foodWeight
  + warExhaustion * warWeight
  + economicStress * economicWeight
  + eliteConflict * eliteWeight
  - legitimacy * legitimacyWeight
  - institutionalCapacity * institutionsWeight;
```

High pressure increases probabilities of:

- reform
- repression
- coup
- revolution
- civil instability

The resulting event depends on political structure.

Examples:

```text
strong military
+
weak government
→ coup probability increases
```

```text
high urbanization
+
high worker influence
+
low legitimacy
→ revolutionary pressure increases
```

```text
high education
+
strong merchant influence
+
moderate institutions
→ reform probability increases
```

---

# 18. Diplomacy

Every pair of states has a bilateral relation.

```ts
interface Relation {
  opinion: number;
  trust: number;

  trade: number;

  rivalry: number;
  borderTension: number;

  territorialClaims: number;

  alliance: boolean;
  atWar: boolean;

  threatPerception: number;
}
```

Relations evolve gradually.

Positive drivers:

- trade
- alliance
- common enemies
- long peace

Negative drivers:

- territorial claims
- military threats
- previous wars
- border disputes
- competing strategic interests

---

# 19. Threat Perception

States should respond to perceived threat rather than raw strength.

Conceptually:

```text
Threat
=
Military Power
× Proximity
× Hostility
```

This is important because it allows balancing behavior.

Example:

```text
Ardan becomes increasingly powerful
        ↓
neighbors perceive growing threat
        ↓
neighbors improve relations
        ↓
defensive coalition becomes likely
```

Coalitions should emerge from incentives rather than scripted events.

---

# 20. Strategic Decisions

Each year, states evaluate possible actions.

Initial action set:

```ts
type StrategicAction =
  | "invest-economy"
  | "invest-education"
  | "invest-research"
  | "increase-military"
  | "seek-trade"
  | "seek-alliance"
  | "improve-relations"
  | "prepare-war"
  | "declare-war";
```

Do not use machine learning.

Use transparent scoring functions.

For example:

```ts
scoreTradePartner(state, target);

scoreAlliancePartner(state, target);

scoreWarTarget(state, target);
```

Choose actions probabilistically based on scores.

Avoid making the highest-score action automatic every year.

Some stochasticity should remain.

---

# 21. War Decision

A state considering war estimates:

```text
expected benefit
-
expected cost
```

Benefits may include:

- valuable territory
- resources
- strategic position
- territorial claims
- security
- prestige
- domestic political benefits

Costs include:

- enemy military strength
- enemy alliances
- casualties
- economic disruption
- distance
- war exhaustion

Conceptually:

```ts
warUtility =
    territorialValue
  + resourceValue
  + strategicValue
  + claimValue
  + domesticPoliticalValue
  - militaryRisk
  - allianceRisk
  - economicCost
  - exhaustionRisk;
```

Convert this into probability using a sigmoid-like function.

War should therefore be possible but not deterministic.

---

# 22. Warfare

Do not simulate individual units.

Military strength:

```ts
effectivePower =
  militaryResources *
  militaryTechnology *
  logistics *
  morale;
```

Defense receives terrain advantages.

Each year of war should produce:

- casualties
- economic damage
- territorial pressure
- war exhaustion

Territory should change only after significant military superiority.

Peace becomes increasingly likely as:

- war duration rises
- casualties rise
- war exhaustion rises
- economic damage rises
- military position deteriorates

---

# 23. War Exhaustion

War must influence domestic politics.

```text
war
↓
casualties
↓
population pressure
```

```text
war
↓
government expenditure
↓
debt
```

```text
war
↓
trade disruption
↓
economic damage
```

```text
war
↓
war exhaustion
↓
political instability
```

A military victory can temporarily increase legitimacy.

A prolonged unsuccessful war should strongly decrease it.

---

# 24. Simulation Tick

One tick equals one year.

Preferred phase order:

```text
1. Environment
2. Population
3. Production
4. Government revenue
5. Government spending
6. Technology
7. Political dynamics
8. Trade
9. Diplomacy
10. Strategic decisions
11. Warfare
12. Territorial changes
13. Events
14. Statistics
15. Historical snapshot
```

Implementation:

```ts
function simulateYear(world: World): World {
  updatePopulation(world);
  updateEconomies(world);
  updateGovernmentFinances(world);
  updateTechnology(world);
  updatePolitics(world);

  updateTrade(world);
  updateDiplomacy(world);

  makeStrategicDecisions(world);
  resolveWars(world);

  generateEvents(world);
  recordStatistics(world);

  world.year += 1;

  return world;
}
```

Prefer pure functions where practical.

---

# 25. Causal Explanation System

This is a core product feature, not optional polish.

Important derived values should expose their major contributors.

Instead of merely:

```ts
stability = 0.63;
```

support something conceptually similar to:

```ts
{
  value: 0.63,

  contributors: [
    { factor: "legitimacy", impact: +0.21 },
    { factor: "economicGrowth", impact: +0.14 },
    { factor: "institutions", impact: +0.09 },

    { factor: "inequality", impact: -0.11 },
    { factor: "foodStress", impact: -0.08 },
    { factor: "warExhaustion", impact: -0.05 }
  ]
}
```

The UI can then display:

```text
STABILITY
63% ↓

Main drivers

Economic growth        +14
Strong institutions     +9
High legitimacy        +21

Inequality             -11
Food pressure           -8
War exhaustion          -5
```

Major events should also retain their causes.

---

# 26. Event System

```ts
interface WorldEvent {
  id: string;

  year: number;

  type: EventType;

  actors: string[];

  importance: number;

  title: string;

  data: Record<string, unknown>;

  causes: Cause[];
}
```

Initial event categories:

```ts
type EventType =
  | "war"
  | "peace"
  | "alliance"
  | "politics"
  | "technology"
  | "economy"
  | "demography"
  | "territory";
```

Example:

```json
{
  "year": 173,
  "type": "war",
  "actors": ["ardan", "velos"],
  "title": "Ardan declares war on Velos",
  "causes": [
    {
      "factor": "territorial_claim",
      "impact": 0.31
    },
    {
      "factor": "resource_pressure",
      "impact": 0.22
    },
    {
      "factor": "military_advantage",
      "impact": 0.18
    }
  ]
}
```

Events become the historical record of the world.

---

# 27. Historical State

Users should eventually be able to inspect past years.

Store lightweight annual statistics and periodic complete snapshots.

Example:

```text
Full snapshot every 10 years

+
annual event log
+
annual statistics
```

This enables:

- timeline scrubbing
- replay
- historical graphs
- state comparison
- debugging

Do not store unnecessary deep object copies every frame.

---

# 28. World Generation

Do not begin with Earth.

Generate a fictional map.

v0.1 may use:

- polygon regions
- Voronoi cells
- or another simple generated territorial representation

Each region gets:

- terrain
- agricultural potential
- resources
- initial population

States receive contiguous groups of regions.

Important:

Different states should begin with meaningfully different conditions.

Avoid symmetrical starts.

Example:

```text
State A
fertile
high population
few minerals

State B
mountainous
low population
high mineral resources

State C
coastal
high trade potential
moderate resources
```

This should create divergent development paths.

---

# 29. Main UI

Desktop layout:

```text
┌────────────────────────────────────────────────────────────┐
│ YEAR 384       Pause  1x  5x  20x  100x      Seed 481204 │
├──────────────────────────────────────┬─────────────────────┤
│                                      │                     │
│                                      │ SELECTED STATE      │
│                                      │                     │
│             WORLD MAP                │ Ardan Republic      │
│                                      │ Population 12.4M    │
│                                      │ GDP 81B             │
│                                      │ Stability 72%       │
│                                      │ Technology 67%      │
│                                      │                     │
├──────────────────────────────────────┴─────────────────────┤
│ HISTORICAL EVENTS                                          │
│                                                            │
│ 381 Ardan overtakes Velos economically                     │
│ 378 Noria joins the anti-Velos alliance                    │
│ 374 Food riots begin in northern Velos                     │
└────────────────────────────────────────────────────────────┘
```

The map is always the dominant visual element.

---

# 30. Map Modes

Initial map modes:

```text
Political
Population
GDP
GDP per capita
Technology
Government
Stability
Military
Resources
Alliances
War
```

Do not implement all modes in the first UI commit.

Start with:

```text
Political
GDP
Stability
Military
```

---

# 31. State Inspector

Clicking a state should show:

```text
Name
Government
Population
Territory

GDP
GDP per capita

Stability
Legitimacy

Technology

Military power

Current wars
Alliances
Major trade partners
```

Each important metric should expose a "Why?" explanation.

Example:

```text
GDP growth +4.3%

Why?

Industrial productivity   +1.8%
Population growth          +1.1%
Trade expansion            +0.9%
Political stability        +0.5%
```

---

# 32. Charts

Users should eventually be able to inspect historical series for:

- population
- GDP
- GDP per capita
- technology
- stability
- military power
- territory

Support comparing multiple states.

Do not build a generic visualization framework initially.

Implement only what the application needs.

---

# 33. Timeline

Include a chronological event feed.

Later add a timeline scrubber:

```text
Year 0 ─────────●──────────────────── Year 500
                ↑
               173
```

Selecting a historical year should update:

- map
- borders
- selected-state statistics

to that historical state.

---

# 34. Web Worker

The UI must not directly execute high-speed simulation loops.

Architecture:

```text
Main Thread

Svelte UI
   ↑
   │ snapshots/events
   │
Simulation Controller
   ↑
   │
Web Worker
   │
Simulation Engine
```

At low speeds this may initially be synchronous.

Before implementing 20x/100x simulation, move execution into a Web Worker.

---

# 35. Persistence

Use IndexedDB.

Users should eventually be able to:

```text
Save world
Load world
Delete world
```

Persist:

- seed
- simulation configuration
- current world
- snapshots
- event history

Do not add cloud persistence in v0.1.

---

# 36. Simulation Configuration

All important coefficients belong in configuration.

Example:

```ts
interface SimulationConfig {
  population: {
    baseGrowthRate: number;
    famineMortalityRate: number;
  };

  technology: {
    researchEfficiency: number;
    diffusionRate: number;
  };

  politics: {
    inequalityWeight: number;
    foodStressWeight: number;
    warExhaustionWeight: number;
  };

  warfare: {
    aggressionBaseline: number;
    casualtyRate: number;
  };
}
```

Never scatter magic constants throughout simulation functions.

---

# 37. MODEL.md

Create a separate:

```text
MODEL.md
```

Every meaningful modeling assumption should eventually be documented.

Format:

```text
## P12 — Education and innovation

Assumption:
Higher education tends to improve technological innovation.

Mechanism:
education → research productivity

Not assumed:
Education automatically produces democracy.
```

The model must distinguish:

```text
mechanism
```

from:

```text
historical inevitability
```

Avoid teleological assumptions.

---

# 38. Repository Structure

Recommended structure:

```text
src/
├── lib/
│   ├── simulation/
│   │   ├── engine.ts
│   │   ├── config.ts
│   │   ├── rng.ts
│   │   │
│   │   ├── models/
│   │   │   ├── world.ts
│   │   │   ├── state.ts
│   │   │   ├── region.ts
│   │   │   ├── relation.ts
│   │   │   ├── war.ts
│   │   │   └── event.ts
│   │   │
│   │   ├── systems/
│   │   │   ├── population.ts
│   │   │   ├── economy.ts
│   │   │   ├── government.ts
│   │   │   ├── technology.ts
│   │   │   ├── politics.ts
│   │   │   ├── trade.ts
│   │   │   ├── diplomacy.ts
│   │   │   └── warfare.ts
│   │   │
│   │   ├── strategy/
│   │   │   ├── scoring.ts
│   │   │   └── decisions.ts
│   │   │
│   │   └── events/
│   │       ├── event-engine.ts
│   │       └── causes.ts
│   │
│   ├── worldgen/
│   │   ├── world-generator.ts
│   │   ├── regions.ts
│   │   ├── states.ts
│   │   ├── names.ts
│   │   └── resources.ts
│   │
│   ├── visualization/
│   │
│   ├── persistence/
│   │
│   └── stores/
│
├── routes/
│   └── +page.svelte
│
└── workers/
    └── simulation.worker.ts

tests/
├── determinism.test.ts
├── population.test.ts
├── economy.test.ts
├── technology.test.ts
├── politics.test.ts
├── diplomacy.test.ts
├── warfare.test.ts
└── long-run.test.ts

BLUEPRINT.md
MODEL.md
README.md
```

---

# 39. Implementation Milestones

Each milestone should produce a working commit.

Do not implement later milestones prematurely.

## Milestone 1 — Project Skeleton

Create:

- SvelteKit project
- TypeScript
- pnpm
- Vitest
- initial directory structure

Acceptance:

```text
pnpm test
pnpm check
pnpm build
```

all succeed.

---

## Milestone 2 — Deterministic RNG

Implement seeded RNG.

Tests:

```text
same seed → same sequence
different seed → different sequence
```

No simulation file may call `Math.random()`.

---

## Milestone 3 — Core Domain Objects

Implement:

- World
- State
- Region
- Relation
- SimulationConfig

Create minimal test world.

No simulation logic yet.

---

## Milestone 4 — Minimal World Generator

Generate:

```text
8 states
100–200 regions
resource distributions
initial populations
```

Same seed must generate identical world.

Render a temporary simple map or diagnostic representation.

---

## Milestone 5 — Simulation Clock

Implement:

```ts
simulateYear(world)
simulateYears(world, n)
```

Add:

```text
year
pause
1x
5x
```

No complex systems yet.

---

## Milestone 6 — Population

Implement:

- births
- deaths
- food pressure
- population growth

Add unit tests.

Run 1,000 years without:

- NaN
- Infinity
- negative population

---

## Milestone 7 — Economy

Implement:

- production
- GDP
- GDP per capita
- taxation
- government revenue
- basic capital accumulation

Population and economy must influence each other.

---

## Milestone 8 — Government Budget

Implement spending across:

- infrastructure
- education
- research
- military
- welfare
- administration

Budget shares always sum to 1.

---

## Milestone 9 — Technology

Implement technology domains.

Add:

- research investment
- education effects
- diminishing returns
- technology diffusion

Test that technologically connected states tend to converge faster than isolated states.

---

## Milestone 10 — Political Stability

Implement:

- legitimacy
- inequality pressure
- food stress
- economic stress
- political stability

No government transitions yet.

---

## Milestone 11 — Diplomacy

Implement bilateral relations.

Add:

- opinion
- trust
- threat
- trade
- territorial claims

Relations evolve annually.

---

## Milestone 12 — Trade

Implement simplified bilateral trade.

Trade should:

- improve economic output
- improve relations
- increase technology diffusion

Do not model individual products.

---

## Milestone 13 — Alliances

States evaluate possible alliance partners.

Alliance likelihood depends on:

- trust
- common threats
- relations
- strategic value

Test emergence of balancing coalitions.

---

## Milestone 14 — Military Power

Military power depends on:

- military spending
- population
- military technology
- economy

Military spending must impose opportunity costs.

---

## Milestone 15 — War Decisions

Implement transparent war scoring.

Record causal factors.

Do not implement combat until decision logic works.

---

## Milestone 16 — Warfare

Implement:

- annual combat resolution
- casualties
- war exhaustion
- economic damage
- peace
- territorial transfers

No tactical units.

---

## Milestone 17 — Government Transitions

Implement probabilistic:

- reform
- coup
- autocratization
- democratization
- regime collapse

Transitions depend on structural conditions.

Do not create deterministic political progression.

---

## Milestone 18 — Event Engine

Generate important historical events.

Events must include:

```text
what
when
actors
importance
causes
```

Add event timeline.

---

## Milestone 19 — Causal Explanations

Expose contributor data for:

- GDP growth
- stability
- technology growth
- diplomatic hostility
- war decisions

Implement the UI's first:

```text
Why?
```

panel.

---

## Milestone 20 — Political Map

Create proper map visualization.

Initially support:

- political ownership
- state selection
- territorial transfers

Do not add all map modes yet.

---

## Milestone 21 — State Inspector

Implement right-hand state panel.

Display core statistics and trends.

---

## Milestone 22 — Map Modes

Add:

- GDP
- stability
- military power
- technology

---

## Milestone 23 — Web Worker

Move high-speed simulation into worker.

Add:

```text
20x
100x
```

UI must remain responsive.

---

## Milestone 24 — Historical Charts

Add selected-state time series.

Support basic state comparison.

---

## Milestone 25 — Snapshots and Replay

Store historical snapshots.

Allow selecting previous years.

Historical selection must restore:

- map
- borders
- state statistics

without modifying the current simulation.

---

## Milestone 26 — IndexedDB Persistence

Implement:

- save
- load
- delete

Saved simulations remain deterministic.

---

## Milestone 27 — Monte Carlo Runner

Create a Node-compatible simulation runner.

Example:

```text
10,000 worlds
×
500 years
```

Collect statistics.

No visualization required.

---

# 40. Long-Run Metrics

Monte Carlo runs should measure:

```text
number of wars

average war duration

average state lifespan

state extinction rate

largest empire share

GDP distribution

GDP inequality

technology distribution

technology convergence

government distributions

number of political transitions

alliance frequency

territorial concentration
```

These metrics are necessary for calibration.

---

# 41. Pathological Outcomes

Automatically detect suspicious behavior.

Examples:

```text
Every simulation becomes one world empire.
```

```text
No wars occur in most worlds.
```

```text
Wars never end.
```

```text
Every state becomes the same government.
```

```text
Technology always converges perfectly.
```

```text
Population grows infinitely.
```

```text
One initial advantage guarantees permanent dominance.
```

```text
States repeatedly declare irrational suicidal wars.
```

The simulation does not need historical realism in v0.1, but it must exhibit diverse outcomes.

---

# 42. Testing Philosophy

Tests should target:

### Correctness

Example:

```text
population cannot become negative
```

### Invariants

Example:

```text
government budget shares sum to 1
```

### Determinism

Example:

```text
same seed + same config = identical world
```

### Directional behavior

Example:

```text
increasing education spending should generally increase
long-run research capacity
```

### Long-run stability

Example:

```text
simulate 10,000 years without NaN or Infinity
```

Avoid tests requiring an exact political outcome unless deterministic inputs guarantee it.

---

# 43. Design Principles for Simulation Code

Prefer:

```ts
updatePopulation(state, context)
```

over large god objects.

Prefer:

```text
many small simulation systems
```

over:

```text
one giant simulateWorld.ts
```

Prefer transparent formulas over unexplained heuristics.

Prefer configurable coefficients over magic constants.

Prefer causal metadata over black-box decisions.

Prefer emergent outcomes over scripted narratives.

---

# 44. Numerical Safety

Every simulation system must guard against:

- NaN
- Infinity
- division by zero
- negative population
- negative territory
- invalid percentages
- invalid budget shares
- runaway exponentials

Use helper functions:

```ts
clamp01(value)

safeDivide(a, b)

normalizeShares(values)
```

Do not silently propagate invalid state.

---

# 45. Performance Targets

v0.1 target:

```text
8–20 states
100–500 regions
1,000 years
```

should execute quickly in-browser.

The engine should eventually support substantially larger worlds, but do not optimize prematurely.

Aggregate states instead of simulating individuals.

---

# 46. UI Philosophy

Avoid a conventional game aesthetic overloaded with:

- buttons
- resource bars
- unit icons
- tactical controls

The desired feel is:

```text
interactive geopolitical observatory
+
historical atlas
+
data visualization
```

The map should remain visually dominant.

The user should be encouraged to:

```text
watch
inspect
compare
rewind
understand
```

rather than micromanage.

---

# 47. User Agency

v0.1 is primarily observational.

Do not initially allow users to control a state.

Later experimental interventions could include:

```text
increase energy abundance

change technology diffusion

reduce fertility

increase resource concentration

introduce military technology

alter trade openness

change institutional quality
```

This would turn the simulator into an experimental sandbox.

But it is explicitly post-v0.1.

---

# 48. LLM Integration

Do not integrate an LLM during initial development.

Future architecture:

```text
Simulation
     ↓
structured event
     ↓
causal explanation
     ↓
LLM narrator
```

The LLM may eventually transform:

```json
{
  "event": "regime_collapse",
  "country": "Velos",
  "causes": {
    "war_exhaustion": 0.31,
    "food_stress": 0.26,
    "legitimacy": -0.24
  }
}
```

into natural-language history.

But:

> The simulation determines what happens. The LLM only describes or interprets it.

Never make the LLM the source of world truth.

---

# 49. Future Systems

Potential future additions after the core simulator proves interesting:

### Society

- political factions
- classes
- ethnic groups
- religion
- ideology

### Demography

- age structure
- fertility transitions
- migration
- refugees

### Economy

- commodities
- energy
- supply chains
- debt crises
- currencies

### International relations

- sanctions
- spheres of influence
- proxy wars
- international organizations
- espionage

### State structure

- federalism
- separatism
- civil wars
- colonies
- imperial administration

### Technology

- technological breakthroughs
- general-purpose technologies
- industrial revolutions
- energy transitions

### Environment

- climate
- drought
- natural disasters
- epidemics

None should be implemented before the basic simulation produces interesting emergent histories.

---

# 50. Central Feedback Loops

The implementation should preserve these relationships.

### Development

```text
education
↓
research
↓
technology
↓
productivity
↓
GDP
↓
tax revenue
↓
education
```

### Militarization

```text
military spending
↓
military power
↓
territorial opportunities
```

but simultaneously:

```text
military spending
↓
less productive investment
↓
lower long-term growth
```

### Industrialization

```text
technology
↓
productivity
↓
industrialization
↓
urbanization
↓
political transformation
```

### Imperial Overextension

```text
territorial expansion
↓
resources + population
↓
power
```

but:

```text
territorial expansion
↓
administrative burden
↓
military cost
↓
political instability
```

### War

```text
war
↓
casualties
+ debt
+ trade disruption
+ exhaustion
↓
instability
```

### Balance of Power

```text
rapidly rising state
↓
neighboring threat perception
↓
alliances among weaker states
↓
balance against rising power
```

These feedback loops are more important than individual numerical formulas.

---

# 51. First Release Definition

Call the first meaningful release:

```text
v0.1 — Emergent States
```

It is complete when:

1. A seeded procedural world can be generated.
2. States possess distinct geographic and economic conditions.
3. Population and economies evolve.
4. Technology develops and diffuses.
5. States trade.
6. Diplomatic relationships evolve.
7. Alliances emerge.
8. States can declare wars.
9. Wars change territory and domestic conditions.
10. Governments can become unstable and transform.
11. A historical event feed records important developments.
12. Users can click states and inspect statistics.
13. Users can understand major causal drivers.
14. The simulation remains deterministic.
15. A world can run for 1,000 years without numerical failure.
16. Different seeds produce meaningfully different histories.

---

# 52. What Not to Optimize Yet

Do not optimize for:

- historical realism
- beautiful procedural geography
- sophisticated combat
- enormous worlds
- mobile UX perfection
- AI-generated prose
- multiplayer
- real-world historical scenarios

Optimize for:

```text
emergence
+
coherence
+
inspectability
+
replayability
```

---

# 53. Main Question During Development

After every major simulation milestone, run several worlds for hundreds of years and ask:

> Is something interesting happening because systems are interacting?

Not:

> How many features have we implemented?

A small model producing surprising but understandable history is preferable to a large model producing noise.

---

# 54. North Star

The desired experience is eventually something like:

```text
Year 0

Eight small states occupy the continent.

↓
↓
↓

Year 173

Industrializing Ardan attacks Velos over the Northern Basin.

↓
↓
↓

Year 241

Velos collapses after decades of debt, food shortages,
and repeated military defeats.

↓
↓
↓

Year 318

Formerly peripheral Noria becomes the dominant trading power.

↓
↓
↓

Year 407

Ardan's neighbors form a coalition to contain its expansion.

↓
↓
↓

Year 513

A political revolution transforms Ardan itself.
```

The user should be able to click every one of those developments and ask:

```text
Why?
```

And the simulator should have a meaningful answer.

That is the defining feature of the project.

---

# 55. Instruction to Coding Agents

When implementing this blueprint:

1. Work milestone by milestone.
2. Do not implement features belonging to future milestones.
3. Keep simulation logic independent of UI code.
4. Add tests for every simulation system.
5. Preserve deterministic behavior.
6. Never use `Math.random()` inside simulation code.
7. Put model coefficients in configuration.
8. Record causal information for important decisions.
9. Prefer simple transparent models over complicated opaque ones.
10. Keep the application runnable after every commit.
11. Run `pnpm test`, `pnpm check`, and `pnpm build` before declaring a milestone complete.
12. Update `MODEL.md` whenever a new substantive modeling assumption is introduced.
13. Do not add dependencies unless they materially simplify the implementation.
14. Do not add backend infrastructure.
15. Do not introduce an LLM until explicitly requested.

The objective is not to build the entire imagined simulator immediately.

The objective is to discover the **smallest simulation capable of producing interesting history**.