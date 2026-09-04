# MODEL.md

# PolityLab Simulation Model

## 1. Purpose

This document defines the mathematical and behavioral model used by PolityLab.

It complements `BLUEPRINT.md`.

`BLUEPRINT.md` defines:

- product behavior
- architecture
- components
- implementation milestones

`MODEL.md` defines:

- state variables
- equations
- causal relationships
- initial parameter values
- numerical constraints
- modeling assumptions
- calibration principles

The objective is not historical prediction.

The objective is to create a simulation that produces:

```text id="h75xme"
diverse
+
coherent
+
emergent
+
explainable
```

world histories.

---

# 2. Modeling Philosophy

PolityLab follows five principles.

## 2.1 Mechanisms over events

Do not encode:

```text id="lmxn9q"
industrial revolution happens in year 180
```

Encode:

```text id="fl1559"
education
+ capital
+ energy
+ technology
+ institutions
→ increased probability of rapid industrial development
```

---

## 2.2 Probabilities over certainties

Avoid:

```text id="b7b35d"
instability > 0.8
→ revolution
```

Prefer:

```text id="az2gjz"
instability ↑
→ probability of political rupture ↑
```

---

## 2.3 Continuous variables over rigid stages

Avoid:

```text id="zv11wg"
Agricultural Age
Industrial Age
Modern Age
```

Prefer continuous variables:

```text id="vi6heh"
technology
urbanization
education
industrialization
capital
```

---

## 2.4 Feedback loops over linear progress

Development should be reversible.

A technologically advanced state can:

- stagnate
- lose territory
- accumulate debt
- suffer institutional collapse
- experience population decline

There must be no built-in assumption that history always progresses.

---

## 2.5 Explainability

When an important value changes, the system should retain its major causal contributors.

Example:

```text id="786so4"
Stability -0.07

Food stress          -0.031
War exhaustion       -0.024
Economic contraction -0.017
Government legitimacy +0.002
```

---

# 3. Time

One simulation tick represents:

```text id="udymvl"
1 year
```

All rates in this document are therefore annual unless explicitly specified otherwise.

---

# 4. Normalization

Most structural variables use:

```text id="apbd1p"
0.0 ≤ x ≤ 1.0
```

Examples:

```text id="mdz00p"
education
technology
legitimacy
stability
urbanization
inequality
institutional capacity
```

Use:

```ts id="506rsv"
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
```

Relations may use:

```text id="s9sjhd"
-1.0 ≤ opinion ≤ 1.0
```

Absolute variables include:

```text id="ohzsh5"
population
GDP
capital
debt
territory
military capital
```

---

# 5. Default World

Initial v0.1 world:

```text id="pu4ux0"
States:              8
Regions:             160
Years per tick:      1

Initial population:
0.5M – 5M per state

Initial technology:
0.10 – 0.30

Initial education:
0.10 – 0.35

Initial urbanization:
0.05 – 0.25

Initial stability:
0.45 – 0.85

Initial inequality:
0.25 – 0.65
```

These values should be seeded and asymmetric.

---

# 6. Population

Let:

```text id="3pvcnf"
P = population
b = birth rate
d = death rate
W = war deaths
```

Then:

\[
P_{t+1} = P_t + P_t(b-d) - W
\]

with:

\[
P_{t+1} \geq P_{min}
\]

unless the state is destroyed.

---

# 7. Birth Rate

Start with:

```text id="2pnkwk"
baseBirthRate = 0.030
```

Birth rate decreases gradually with:

- education
- urbanization
- prosperity

Initial formula:

\[
b =
b_0
-
w_e E
-
w_u U
-
w_p Pr
\]

where:

```text id="91wi76"
E  = education
U  = urbanization
Pr = prosperity
```

Default:

```text id="re5t0o"
b0 = 0.030

educationBirthEffect  = 0.009
urbanBirthEffect      = 0.008
prosperityBirthEffect = 0.004
```

Therefore:

```ts id="2bythz"
birthRate =
  0.030
  - 0.009 * education
  - 0.008 * urbanization
  - 0.004 * prosperity;
```

Clamp:

```text id="jnaj58"
0.008 ≤ birthRate ≤ 0.040
```

This creates a rudimentary demographic transition without explicitly scripting one.

---

# 8. Death Rate

Start with:

```text id="aeiod4"
baseDeathRate = 0.022
```

Mortality decreases with:

- medicine
- prosperity
- welfare

and increases with:

- famine
- war

Formula:

```ts id="5e49ev"
deathRate =
  0.022
  - 0.009 * medicineTech
  - 0.003 * prosperity
  - 0.003 * welfareEffect
  + famineMortality;
```

Clamp normal mortality:

```text id="krnr3g"
0.006 ≤ normalDeathRate ≤ 0.040
```

Famine may push mortality above this range.

---

# 9. Food System

Do not initially simulate individual crops.

Each region has:

```text id="8dcgs5"
area
agriculturalPotential
agricultural technology
infrastructure
stability
```

Regional food capacity:

\[
F_r =
A_r
\times Q_r
\times T_a
\times I
\times S
\]

where:

```text id="y4fkfo"
A = area
Q = agricultural potential
Ta = agricultural technology modifier
I = infrastructure modifier
S = stability modifier
```

Use:

```ts id="vhar77"
techModifier =
  0.65 + 1.10 * agricultureTech;

infrastructureModifier =
  0.75 + 0.50 * infrastructure;

stabilityModifier =
  0.75 + 0.25 * stability;
```

Total food capacity:

```ts id="p1p6t2"
foodCapacity =
  sum(regionFoodCapacity);
```

World generation should calibrate initial population so most states begin with:

```text id="v709oq"
foodRatio ≈ 0.9 – 1.3
```

where:

\[
foodRatio =
\frac{foodCapacity}{population}
\]

---

# 10. Food Stress

Define:

```ts id="tgbw6h"
foodStress =
  clamp01((1 - foodRatio) / 0.40);
```

Therefore:

```text id="0l01yz"
foodRatio ≥ 1.0
→ foodStress = 0

foodRatio = 0.8
→ foodStress ≈ 0.5

foodRatio ≤ 0.6
→ foodStress = 1
```

---

# 11. Famine Mortality

```ts id="2uim4x"
famineMortality =
  0.060 * foodStress ** 2;
```

The quadratic term ensures minor shortages have modest effects while severe shortages become dangerous.

---

# 12. Prosperity

Define relative prosperity using GDP per capita.

Do not normalize against an arbitrary absolute historical currency.

Use a bounded transform:

```ts id="847ur2"
prosperity =
  gdpPerCapita / (gdpPerCapita + prosperityHalfSaturation);
```

Default:

```text id="olfxii"
prosperityHalfSaturation = 2.0
```

---

# 13. Production Function

Use a simplified Cobb-Douglas model.

Let:

```text id="cj0k6h"
Y = GDP
A = total factor productivity
K = capital stock
L = population
α = capital elasticity
```

Then:

\[
Y = A K^\alpha L^{1-\alpha}
\]

Default:

```text id="6sh5pw"
alpha = 0.35
```

Implementation:

```ts id="gpebo9"
gdp =
  totalFactorProductivity
  * Math.pow(capital, 0.35)
  * Math.pow(population, 0.65);
```

Use appropriate internal scaling so numbers remain numerically manageable.

---

# 14. Total Factor Productivity

TFP depends on:

- technology
- institutions
- stability
- trade
- infrastructure

Technology productivity index:

```ts id="0jxibn"
productiveTech =
    0.20 * agriculture
  + 0.15 * materials
  + 0.20 * energy
  + 0.20 * transport
  + 0.10 * communication
  + 0.15 * institutionsTech;
```

Then:

```ts id="uu4mu9"
technologyModifier =
  0.60 + 1.40 * productiveTech;

institutionModifier =
  0.70 + 0.60 * institutionalCapacity;

stabilityModifier =
  0.70 + 0.30 * stability;

infrastructureModifier =
  0.75 + 0.50 * infrastructure;

tradeModifier =
  1 + 0.15 * tradeOpenness;
```

TFP:

```ts id="5h51ig"
tfp =
  technologyModifier
  * institutionModifier
  * stabilityModifier
  * infrastructureModifier
  * tradeModifier;
```

---

# 15. Capital Accumulation

Let:

```text id="bc3ll6"
K = productive capital
s = private savings/investment rate
δ = depreciation
```

Then:

\[
K_{t+1}
=
K_t
+
sY
+
G_{infra}
-
\delta K
-
D_{war}
\]

Default:

```text id="ymmi87"
privateInvestmentRate = 0.18
capitalDepreciation   = 0.04
```

Implementation:

```ts id="fax98x"
newCapital =
  capital
  + 0.18 * gdp
  + infrastructureInvestment
  - 0.04 * capital
  - warCapitalDamage;
```

Private investment may later become endogenous.

---

# 16. Government Revenue

Potential revenue:

\[
R = GDP \times taxRate
\]

Actual revenue depends on institutional capacity.

```ts id="hft03l"
taxEfficiency =
  0.45 + 0.55 * institutionalCapacity;
```

Therefore:

```ts id="tjix0m"
revenue =
  gdp
  * taxRate
  * taxEfficiency;
```

Initial tax rates:

```text id="fop64r"
0.12 – 0.28
```

---

# 17. Government Budget

Budget shares:

```text id="n8yki4"
infrastructure
education
research
military
welfare
administration
```

Must satisfy:

\[
\sum budgetShare_i = 1
\]

Typical initial budget:

```text id="6xq1p9"
Infrastructure     20%
Education          15%
Research            8%
Military           25%
Welfare            12%
Administration     20%
```

World generation should vary these.

---

# 18. Infrastructure

Infrastructure evolves according to investment and depreciation.

```ts id="3z5ugp"
infraIntensity =
  infrastructureSpending / gdp;
```

Then:

```ts id="zy5j0f"
deltaInfrastructure =
    0.020
    * (infraIntensity / 0.04)
    * (1 - infrastructure)
  - 0.005 * infrastructure;
```

Clamp annual change:

```text id="4khr1u"
-0.02 ≤ Δinfrastructure ≤ +0.03
```

---

# 19. Education

Education evolves slowly.

```ts id="b2mjzp"
educationIntensity =
  educationSpending / gdp;
```

Default reference expenditure:

```text id="me3zz7"
educationReference = 0.03 GDP
```

Formula:

```ts id="veha7h"
deltaEducation =
    0.015
    * (educationIntensity / 0.03)
    * institutionalCapacity
    * (1 - education)
  - 0.002 * education;
```

Clamp annual change:

```text id="rp8cxh"
-0.015 ≤ Δeducation ≤ +0.025
```

---

# 20. Urbanization

Urbanization responds to industrialization and prosperity.

```ts id="gxtkik"
targetUrbanization =
  clamp01(
    0.10
    + 0.45 * industryShare
    + 0.20 * servicesShare
    + 0.15 * prosperity
    + 0.10 * transportTech
  );
```

Adjustment:

```ts id="9msh71"
urbanization +=
  0.03 * (targetUrbanization - urbanization);
```

Urbanization therefore changes gradually.

---

# 21. Economic Structure

Three sectors:

```text id="6uixyb"
agriculture
industry
services
```

Shares sum to 1.

Industrial attractiveness:

```ts id="qmndks"
industrialPotential =
  materialsTech
  * energyTech
  * infrastructure
  * capitalAvailability;
```

Service attractiveness:

```ts id="zi0qdf"
servicePotential =
  communicationTech
  * education
  * urbanization;
```

Sector shares should move gradually toward target values.

Never transform instantly.

Recommended annual adjustment:

```text id="g7f8or"
sectorAdjustmentRate = 0.025
```

---

# 22. Research Investment

```ts id="ucqoi4"
researchIntensity =
  researchSpending / gdp;
```

Reference:

```text id="hciq4u"
researchReferenceIntensity = 0.02
```

---

# 23. Domestic Innovation

For technology domain \(d\):

\[
\Delta T_d =
r
\times Investment
\times Education
\times Institutions
\times FrontierGap
\]

Implementation:

```ts id="g4izum"
innovation =
  0.006
  * (researchIntensity / 0.02)
  * (0.40 + 0.60 * education)
  * (0.50 + 0.50 * institutionalCapacity)
  * Math.pow(1 - tech, 1.5)
  * domainPriority;
```

Recommended:

```text id="u8e8r8"
0.5 ≤ domainPriority ≤ 1.5
```

This allows states to develop different technological profiles.

---

# 24. Technology Domains

Initial domains:

```text id="5w6ep3"
Agriculture
Materials
Energy
Transport
Medicine
Communication
Military
Institutions
```

No technology tree is required.

Technologies are continuous capabilities.

Later versions may add thresholds representing major breakthroughs.

---

# 25. Technology Diffusion

For states \(i\) and \(j\):

```ts id="z3ivna"
gap =
  Math.max(0, techJ - techI);
```

Diffusion:

```ts id="60optc"
diffusion =
  gap
  * 0.010
  * tradeIntensity
  * diplomaticOpenness
  * proximity;
```

Where:

```text id="eub1oh"
tradeIntensity     ∈ [0,1]
diplomaticOpenness ∈ [0,1]
proximity          ∈ [0,1]
```

Aggregate diffusion from all partners but cap annual external technology growth:

```text id="p2epq4"
maxAnnualDiffusion = 0.020
```

---

# 26. Trade

Trade is abstract.

Do not model individual commodities initially.

Trade potential between states \(i,j\):

\[
TradePotential =
EconomicSize
\times Proximity
\times Relations
\times Complementarity
\]

Use normalized components.

Example:

```ts id="yhrmw8"
tradeScore =
    0.30 * economicCompatibility
  + 0.25 * proximity
  + 0.20 * relationQuality
  + 0.15 * resourceComplementarity
  + 0.10 * transportCompatibility;
```

Convert to target trade intensity:

```ts id="7j9w0s"
targetTradeIntensity =
  sigmoid((tradeScore - 0.50) * 6);
```

Trade adjusts gradually:

```ts id="jlke9h"
trade +=
  0.15 * (targetTradeIntensity - trade);
```

War forces:

```text id="2b01d4"
trade → near zero
```

between belligerents.

---

# 27. Trade Benefits

Trade affects:

```text id="1p1k9x"
GDP
relations
technology diffusion
```

Trade productivity bonus is intentionally limited:

```text id="kokwqs"
maximumTradeTFPBonus = 15%
```

This prevents trade from dominating every other mechanism.

---

# 28. Inequality

v0.1 inequality is an abstract state variable.

It responds to:

```text id="gmn87r"
capital concentration
welfare
economic growth
structural transformation
```

Initial rule:

```ts id="hiefv3"
deltaInequality =
    0.006 * capitalPressure
  + 0.004 * rapidIndustrialization
  - 0.010 * welfareIntensity
  - 0.003 * institutionalCapacity;
```

Clamp:

```text id="3emhl6"
0.05 ≤ inequality ≤ 0.95
```

Do not claim this is an empirical inequality model.

It exists primarily as a political pressure mechanism.

---

# 29. Political Legitimacy

Legitimacy represents perceived acceptance of the political order.

It changes because of:

```text id="pgq5rh"
economic performance
political stability
war outcomes
food security
participation mismatch
```

Economic performance transform:

```ts id="rad765"
growthSignal =
  Math.tanh(realGdpPerCapitaGrowth * 10);
```

Participation demand:

```ts id="4t1pez"
desiredParticipation =
  clamp01(
    0.10
    + 0.35 * education
    + 0.25 * urbanization
    + 0.15 * merchantInfluence
    + 0.15 * workerInfluence
  );
```

Participation gap:

```ts id="io11yd"
participationGap =
  Math.max(
    0,
    desiredParticipation - politicalParticipation
  );
```

Annual legitimacy change:

```ts id="2xcb26"
deltaLegitimacy =
    0.012 * growthSignal
  + 0.008 * stability
  - 0.020 * foodStress
  - 0.015 * participationGap
  - 0.015 * warExhaustion
  + victoryBonus
  - defeatPenalty;
```

Apply mild regression toward the middle to avoid permanent extremes:

```ts id="xn1fca"
deltaLegitimacy +=
  0.005 * (0.50 - legitimacy);
```

---

# 30. Political Stability

Define two aggregates:

```text id="47hkrv"
support
stress
```

Support:

```ts id="tyqqxe"
support =
    0.30 * legitimacy
  + 0.25 * institutionalCapacity
  + 0.20 * prosperity
  + 0.15 * welfareEffect
  + 0.10 * recentVictory;
```

Stress:

```ts id="mszf8n"
stress =
    0.22 * inequality
  + 0.22 * foodStress
  + 0.20 * warExhaustion
  + 0.16 * economicStress
  + 0.10 * debtStress
  + 0.10 * eliteConflict;
```

Target stability:

```ts id="0mknfj"
targetStability =
  clamp01(
    0.50
    + support
    - stress
  );
```

Adjustment:

```ts id="382rn0"
stability +=
  0.15 * (targetStability - stability);
```

Optional stochastic disturbance:

```ts id="u4he2b"
stability +=
  rng.normal(0, 0.005);
```

The seeded RNG must be used.

---

# 31. Economic Stress

Use recent real GDP-per-capita growth.

```ts id="4kyekv"
economicStress =
  clamp01(
    -realGdpPerCapitaGrowth / 0.10
  );
```

Thus approximately:

```text id="m98yq8"
+ growth → little stress

-5% growth → moderate stress

-10% or worse → severe stress
```

---

# 32. Government Structure

Maintain continuous political characteristics:

```text id="1k84st"
politicalParticipation
centralization
ruleOfLaw
institutionalCapacity
```

Government labels are derived descriptions.

Example classification:

```text id="5k7uwo"
Participation < 0.25
Executive concentration high
→ Autocracy

Participation < 0.20
Military influence high
→ Military Regime

Participation > 0.55
Rule of law > 0.45
→ Republic

Moderate participation
Hereditary regime flag
→ Constitutional Monarchy
```

Classification logic should be kept separate from political dynamics.

---

# 33. Political Factions

v0.1 uses four aggregate power blocs:

```text id="rk3vut"
traditional elites
merchants
military
workers
```

Influence shares should sum to 1.

Desired influence responds to structure.

Example:

```ts id="otdqwe"
eliteTarget =
  0.20
  + 0.40 * agricultureShare;

merchantTarget =
  0.10
  + 0.35 * servicesShare
  + 0.20 * tradeOpenness;

workerTarget =
  0.05
  + 0.40 * industryShare
  * urbanization;

militaryTarget =
  0.10
  + 0.40 * militaryBurden
  + 0.15 * activeWar;
```

Normalize targets.

Adjust gradually:

```text id="d4ofch"
factionAdjustmentRate = 0.05/year
```

---

# 34. Elite Conflict

Elite conflict increases when major factions have similar power but incompatible political preferences.

Simple first approximation:

```ts id="1rxkzj"
eliteConflict =
  politicalPolarization
  * (1 - dominantFactionShare);
```

For v0.1, political polarization may itself be derived from:

```text id="4ion1p"
participation gap
military influence
inequality
```

Keep this intentionally simple.

---

# 35. Political Transition Pressure

Political rupture probability should depend strongly on instability.

Start with:

```ts id="4d6c95"
rupturePressure =
  clamp01(
    0.45 * (1 - stability)
    + 0.30 * (1 - legitimacy)
    + 0.15 * participationGap
    + 0.10 * eliteConflict
  );
```

Annual probability:

```ts id="sk00dx"
ruptureProbability =
  0.08
  * sigmoid((rupturePressure - 0.65) * 10);
```

Thus even troubled states do not necessarily experience a transition every year.

---

# 36. Political Transition Selection

If a rupture occurs, calculate outcome scores.

## Reform

```text id="lic7i1"
high education
high merchant influence
moderate institutions
participation gap
```

## Coup

```text id="fgthuo"
high military influence
low legitimacy
weak institutions
```

## Popular revolution

```text id="vzw789"
low legitimacy
high worker influence
high urbanization
severe inequality
```

## Autocratization

```text id="2x8oqf"
high instability
high executive centralization
high military influence
```

Compute scores and use weighted seeded random selection.

Do not simply choose the maximum.

---

# 37. Institutional Capacity

Institutional capacity changes slowly.

Positive forces:

```text id="oj6mjx"
administrative investment
education
institutional technology
political stability
```

Negative forces:

```text id="unxuhm"
war
debt crisis
territorial overextension
political collapse
```

Example:

```ts id="k6ta1w"
deltaInstitutionalCapacity =
    0.008 * administrationIntensity
  + 0.004 * education
  + 0.004 * institutionsTech
  - 0.006 * warExhaustion
  - 0.006 * overextension;
```

Clamp annual change:

```text id="xmw5yb"
-0.025 ≤ Δ ≤ +0.020
```

---

# 38. Territorial Overextension

Territory creates benefits and costs.

Define:

```ts id="7ia73j"
administrativeCapacity =
  population
  * (0.50 + institutionalCapacity)
  * (0.50 + transportTech);
```

Relative burden:

```ts id="7vluqj"
overextensionRatio =
  territory / administrativeCapacityScaled;
```

Transform:

```ts id="d5upac"
overextension =
  clamp01(
    (overextensionRatio - 1) / 1.5
  );
```

Overextension decreases:

- institutional efficiency
- stability
- tax collection

and increases:

- military maintenance
- separatist pressure in future versions

This prevents conquest from being purely beneficial.

---

# 39. Debt

Government debt grows through extraordinary expenditure.

Normal budgets should approximately balance in v0.1.

War may generate deficits.

```ts id="i2vjo6"
emergencyWarSpending =
  warIntensity
  * 0.04
  * gdp;
```

Borrowing:

```ts id="0nlteh"
newDebt =
  oldDebt
  + emergencyWarSpending
  + interest
  - repayments;
```

Interest:

```ts id="n63u5o"
interest =
  debt
  * baseInterestRate
  * riskModifier;
```

Default:

```text id="26yh6n"
baseInterestRate = 0.03
```

---

# 40. Debt Stress

Debt ratio:

```ts id="95dnv4"
debtRatio =
  debt / Math.max(gdp, epsilon);
```

Stress:

```ts id="gxcxmy"
debtStress =
  clamp01(
    (debtRatio - 0.50) / 1.50
  );
```

Therefore:

```text id="tagk2d"
< 50% GDP
→ minimal debt stress

~125% GDP
→ moderate stress

≥ 200% GDP
→ severe stress
```

These are simulation thresholds, not claims about real fiscal sustainability.

---

# 41. Military Capital

Military power should not equal annual spending.

Maintain military capital:

\[
M_{t+1}
=
M_t
+
MilitaryInvestment
-
Depreciation
-
WarLosses
\]

Default:

```text id="jtbntu"
militaryDepreciation = 0.08
```

---

# 42. Military Power

Effective military power:

```ts id="i92v9u"
militaryPower =
  Math.sqrt(militaryCapital)
  * manpowerModifier
  * technologyModifier
  * logisticsModifier
  * moraleModifier;
```

Where:

```ts id="hqk4d5"
manpowerModifier =
  Math.pow(population, 0.25);

technologyModifier =
  0.50 + militaryTech;

logisticsModifier =
  0.60
  + 0.20 * transportTech
  + 0.20 * infrastructure;

moraleModifier =
  0.70
  + 0.30 * stability;
```

---

# 43. Military Burden

```ts id="5ja7t1"
militaryBurden =
  militarySpending / gdp;
```

Very high burden produces long-term opportunity costs automatically because less government revenue flows to other investments.

Additional political cost begins above:

```text id="k02cj4"
militaryBurden > 0.08 GDP
```

This threshold should later be calibrated.

---

# 44. Bilateral Relations

For state pair \(i,j\):

```text id="v22xtu"
opinion        [-1,1]
trust          [0,1]
trade          [0,1]
rivalry        [0,1]
borderTension  [0,1]
claims         [0,1]
threat         [0,1]
```

Opinion updates slowly.

Example:

```ts id="pnwc6c"
deltaOpinion =
    0.020 * trade
  + 0.015 * alliance
  + 0.010 * commonEnemy
  - 0.025 * claims
  - 0.020 * threat
  - 0.015 * rivalry
  - warMemoryEffect;
```

Add mild mean reversion:

```ts id="x9sg3u"
deltaOpinion +=
  -0.01 * opinion;
```

---

# 45. Trust

Trust rises through:

```text id="j6gsse"
long peace
trade
successful alliance
```

and falls through:

```text id="psly6j"
war
broken agreement
territorial disputes
rapid militarization
```

Trust should change more slowly than opinion.

This allows historical memory.

---

# 46. War Memory

After war:

```text id="pa09dv"
warMemory = 1
```

Annual decay:

```ts id="vmal3i"
warMemory *= 0.97;
```

Approximate half-life:

```text id="lcwrfe"
~23 years
```

War memory negatively affects relations.

---

# 47. Proximity

For neighboring states:

```text id="wnqbfi"
proximity ≈ 1
```

For non-neighbors:

derive from graph distance.

Example:

```ts id="w5jkam"
proximity =
  Math.exp(-0.7 * (graphDistance - 1));
```

---

# 48. Threat Perception

Threat from \(j\) toward \(i\):

```ts id="5apk83"
relativeMilitaryPower =
  militaryPowerJ
  / (militaryPowerI + militaryPowerJ);
```

Hostility:

```ts id="7y8yos"
hostility =
  clamp01((-opinion + 1) / 2);
```

Threat:

```ts id="llklmq"
threat =
  clamp01(
    relativeMilitaryPower
    * proximity
    * (0.50 + 0.50 * hostility)
    * (0.75 + 0.25 * expansionismSignal)
  );
```

---

# 49. Alliance Scoring

Alliance attractiveness between \(i,j\):

```ts id="oyq9as"
allianceScore =
    0.25 * trust
  + 0.20 * normalizedOpinion
  + 0.30 * commonThreat
  + 0.15 * trade
  + 0.10 * strategicCompatibility;
```

Alliance probability:

```ts id="kak8f2"
pAlliance =
  0.10
  * sigmoid(
      (allianceScore - 0.65) * 10
    );
```

Existing alliances persist unless relations deteriorate significantly.

---

# 50. Balance-of-Power Behavior

Common threat is one of the strongest alliance drivers.

Therefore:

```text id="glqlg7"
State A becomes dominant
        ↓
neighbor threat perception rises
        ↓
common-threat scores rise
        ↓
alliances among weaker states become more probable
```

No special "anti-hegemon coalition" event is required.

---

# 51. Territorial Claims

Claims arise slowly from:

- previously owned regions
- disputed borders
- strategically valuable adjacent regions

v0.1 should avoid complex cultural claims.

When territory changes hands:

```text id="v1rsm3"
former owner gains persistent claim
```

Claims decay slowly.

Suggested:

```ts id="vc2l0h"
claim *= 0.99;
```

per year.

---

# 52. War Utility

State \(i\) evaluating target \(j\):

```ts id="v2kl8k"
warUtility =
    0.22 * territorialValue
  + 0.16 * resourceValue
  + 0.14 * strategicValue
  + 0.18 * claimValue
  + 0.10 * domesticPoliticalBenefit
  + 0.10 * perceivedMilitaryAdvantage
  + 0.10 * rivalry

  - 0.25 * militaryRisk
  - 0.20 * allianceRisk
  - 0.15 * economicCost
  - 0.15 * currentWarExhaustion
  - 0.10 * tradeDependency;
```

Normalize contributors before combining them.

Coefficients are deliberately approximate.

---

# 53. War Probability

War should require positive utility.

```ts id="gdkb1q"
pWar =
  baseWarProbability
  * sigmoid(
      (warUtility - warThreshold) * 8
    );
```

Defaults:

```text id="gs02xy"
baseWarProbability = 0.12
warThreshold       = 0.15
```

Additional restrictions:

```text id="0mdpu9"
cannot declare war if:

stability extremely low
military capacity negligible
already severely overextended
no strategic access to opponent
```

Avoid deterministic bans where possible, but clearly irrational wars should be rare.

---

# 54. War Objectives

v0.1 war objective:

```text id="a60hfn"
limited territorial conquest
```

Do not initially implement:

- regime change
- total annexation objectives
- reparations
- colonies
- ideological wars

These can follow later.

---

# 55. Combat Strength

Annual effective strength:

```ts id="mxpqqi"
combatStrength =
  militaryPower
  * readiness
  * logistics
  * morale
  * stochasticCombatFactor;
```

Use seeded mild randomness:

```text id="ncvv2f"
stochasticCombatFactor ≈ 0.90 – 1.10
```

Do not allow random rolls to overwhelm structural military advantages.

---

# 56. Defensive Terrain

Terrain modifiers:

```text id="5hdkfa"
Plains       1.00
Forest       1.08
Hills        1.12
Mountains    1.25
Desert       1.05
Coastal      1.00
```

Apply only when defending the relevant region.

---

# 57. Combat Outcome

Compute strength ratio:

```ts id="6nhdr9"
ratio =
  attackerStrength / defenderStrength;
```

Transform into attacker success:

```ts id="2qed6n"
attackerSuccess =
  sigmoid(
    Math.log(ratio) * 3
  );
```

This avoids abrupt thresholds.

---

# 58. Casualties

Annual casualty fraction should remain relatively small.

Base:

```text id="7jzvut"
baseWarCasualtyRate = 0.003 population
```

Actual:

```ts id="yfzt8p"
casualtyFraction =
  baseWarCasualtyRate
  * warIntensity
  * exposureModifier;
```

Cap annual population loss from ordinary warfare:

```text id="2mxszp"
≤ 3%
```

unless future versions explicitly model catastrophic events.

---

# 59. Economic War Damage

Base annual economic damage:

```ts id="psomcr"
warEconomicDamage =
  0.01
  * gdp
  * warIntensity;
```

Additional capital destruction occurs when territory is occupied.

---

# 60. Territorial Capture

A bordering region becomes capturable when:

```text id="zui8ju"
attacker has sustained superiority
+
region is adjacent to attacker-controlled territory
```

Suggested threshold:

```text id="6uvmx1"
attackerSuccess > 0.65
```

Capture remains probabilistic.

Do not transfer many regions instantly.

---

# 61. War Exhaustion

State-level exhaustion:

```ts id="jztlrm"
deltaWarExhaustion =
    0.015
  + 4.0 * casualtyFraction
  + 1.5 * economicDamageFraction
  + 0.010 * foodStress;
```

Clamp:

```text id="arxn3q"
0 ≤ warExhaustion ≤ 1
```

During peace:

```ts id="2mczog"
warExhaustion *= 0.92;
```

---

# 62. Peace

Peace attractiveness rises with:

```text id="nmn0b4"
war exhaustion
economic damage
military defeat
war duration
domestic instability
```

and falls with:

```text id="38bjoc"
military advantage
valuable attainable objectives
recent victories
```

Either state may initiate peace.

A war should not require total destruction of one side.

---

# 63. Victory and Defeat

Peace outcome compares:

- territory gained/lost
- battlefield performance
- relative war objectives

Winner receives temporary:

```text id="i56utn"
legitimacy bonus
prestige effect
```

Loser receives:

```text id="s3d8m9"
legitimacy penalty
```

Keep effects temporary and modest.

Suggested maximum immediate legitimacy change:

```text id="8mnigo"
±0.08
```

---

# 64. State Destruction

A state disappears only when:

```text id="h9eysj"
territory = 0
```

or future collapse mechanics explicitly fragment it.

Do not delete historical records.

Set:

```ts id="xfjzdz"
state.alive = false;
```

Historical charts and events must remain accessible.

---

# 65. Event Importance

Every event receives:

```text id="phf4nu"
importance ∈ [0,1]
```

Example categories:

```text id="4t0u6l"
0.1 minor trade change
0.3 alliance
0.4 technology acceleration
0.6 government transition
0.7 major territorial loss
0.8 war
0.9 regime collapse
1.0 state destruction
```

The timeline may filter low-importance events at high simulation speeds.

---

# 66. Causal Contributor Format

Use:

```ts id="4206d6"
interface Cause {
  factor: string;
  impact: number;
  value?: number;
}
```

Example:

```ts id="4jpmja"
{
  factor: "food_stress",
  impact: -0.034,
  value: 0.72
}
```

Store raw impacts rather than only percentages.

UI percentages can be derived later.

---

# 67. Random Disturbances

Some stochasticity is desirable.

Potential small shocks:

```text id="p63gvc"
harvest variation
economic variation
political disturbances
combat uncertainty
```

Random shocks must:

- use seeded RNG
- remain small relative to structural forces
- never be the sole explanation of long-term development

Suggested economic shock:

```text id="fz9k9x"
Normal(0, 0.01)
```

or approximately ±1% typical annual variation.

---

# 68. Sigmoid Utility

Use:

```ts id="o99vah"
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
```

Useful for:

- political transition probability
- war probability
- alliance probability
- combat outcomes
- nonlinear stress responses

Clamp extreme input to avoid overflow:

```ts id="lmd7fq"
x = Math.max(-20, Math.min(20, x));
```

---

# 69. Numerical Safety

Every system must avoid:

```text id="aveyf2"
NaN
Infinity
negative population
negative GDP
negative capital
invalid shares
```

Required helpers:

```ts id="t3zxp7"
clamp()

clamp01()

safeDivide()

normalizeShares()

finiteOrFallback()
```

In development mode, invalid states should throw descriptive errors.

Do not silently hide simulation corruption.

---

# 70. Annual Change Limits

To prevent numerical explosions, normalized structural variables should generally not change more than:

```text id="77go0z"
~2–5 percentage points/year
```

unless a discrete event occurs.

Examples of legitimate discrete events:

```text id="f3r6tn"
revolution
coup
territorial conquest
regime collapse
```

---

# 71. Explainability Requirement

Every major system must be capable of answering:

```text id="h5ush6"
Why did this value move?
```

Required explainable metrics for v0.1:

```text id="fhd34j"
GDP growth

population growth

technology growth

stability

legitimacy

diplomatic opinion

threat perception

alliance decisions

war decisions
```

---

# 72. Historical Data

Record annually:

```text id="51oj1o"
population
GDP
GDP per capita
technology composite
stability
legitimacy
military power
territory
government type
```

Full world snapshots:

```text id="jhnoiu"
every 10 years
```

Initial default:

```text id="z4amtv"
snapshotInterval = 10
```

---

# 73. Composite Technology Index

For UI purposes only:

```ts id="ecmihg"
technologyIndex =
  mean([
    agriculture,
    materials,
    energy,
    transport,
    medicine,
    communication,
    military,
    institutions
  ]);
```

Simulation systems should use domain technologies directly.

Do not drive everything from the composite score.

---

# 74. Composite State Power

Optional UI statistic:

```ts id="d4jlfq"
statePower =
    0.30 * normalizedGDP
  + 0.30 * normalizedMilitary
  + 0.15 * normalizedPopulation
  + 0.15 * technologyIndex
  + 0.10 * institutionalCapacity;
```

This should initially be informational only.

Do not use composite power as the primary strategic decision input.

---

# 75. World Generation Correlations

Initial variables should not be completely independent.

Examples:

Fertile regions:

```text id="lqobru"
→ somewhat larger initial populations
```

Mountainous regions:

```text id="bhkmyl"
→ lower agricultural capacity
→ higher defense
```

Coastal regions:

```text id="2epw9m"
→ higher trade potential
```

Mineral-rich regions:

```text id="w5e8nv"
→ future industrial potential
```

But add sufficient randomness that geography does not determine destiny.

---

# 76. Initial State Asymmetry

World generation should deliberately create differences.

For each state randomly vary:

```text id="uep8fp"
population
territory
food capacity
resources
education
technology
government
budget priorities
institution quality
military spending
```

Avoid balanced-game starts.

The point is historical emergence, not competitive fairness.

---

# 77. Simulation Health Targets

These are engineering calibration targets, not historical facts.

Across many seeded simulations:

### Diversity

No single government type should dominate virtually every world.

### Survival

Some states should persist for centuries.

Some should disappear.

### War

Wars should occur but should usually end.

### Hegemony

Global conquest should be possible but rare.

### Technology

States should diverge technologically but diffusion should matter.

### Economy

Initial advantage should matter without guaranteeing permanent dominance.

### Politics

Prosperous states should still sometimes experience political disruption.

### Geography

Resource-rich states should not automatically become dominant.

---

# 78. Initial Monte Carlo Warning Rules

Flag simulations where:

```text id="7rqp01"
>90% of states disappear before year 100
```

```text id="b4n6sk"
no war occurs in 1,000 years
```

```text id="g2yf64"
a single war lasts >150 years
```

```text id="c4haqr"
one state controls >90% of world territory
in >50% of seeds
```

```text id="s6j4is"
all states reach technology >0.95 before year 250
```

```text id="td6ki3"
all states converge to the same government
```

```text id="o9i447"
world population grows >1000× without corresponding
food-capacity growth
```

These warnings indicate calibration problems, not necessarily bugs.

---

# 79. Parameter Configuration

Initial configuration object:

```ts id="ejxwhb"
export const DEFAULT_MODEL_CONFIG = {
  population: {
    baseBirthRate: 0.030,
    baseDeathRate: 0.022,

    educationBirthEffect: 0.009,
    urbanBirthEffect: 0.008,
    prosperityBirthEffect: 0.004,

    medicineDeathEffect: 0.009,
    prosperityDeathEffect: 0.003,
    welfareDeathEffect: 0.003,

    maxFamineMortality: 0.060
  },

  economy: {
    capitalElasticity: 0.35,
    privateInvestmentRate: 0.18,
    capitalDepreciation: 0.04,

    maxTradeProductivityBonus: 0.15
  },

  education: {
    growthCoefficient: 0.015,
    depreciation: 0.002,
    referenceIntensity: 0.03
  },

  infrastructure: {
    growthCoefficient: 0.020,
    depreciation: 0.005,
    referenceIntensity: 0.04
  },

  technology: {
    innovationRate: 0.006,
    diffusionRate: 0.010,
    maxAnnualDiffusion: 0.020,
    researchReferenceIntensity: 0.02
  },

  politics: {
    stabilityAdjustmentRate: 0.15,

    ruptureBaseProbability: 0.08,

    legitimacyMeanReversion: 0.005
  },

  military: {
    depreciation: 0.08,
    baseCasualtyRate: 0.003
  },

  diplomacy: {
    opinionMeanReversion: 0.01,
    warMemoryDecay: 0.97,
    claimDecay: 0.99
  },

  warfare: {
    baseWarProbability: 0.12,
    warThreshold: 0.15,

    baseEconomicDamage: 0.01,

    peaceExhaustionDecay: 0.92
  },

  history: {
    snapshotInterval: 10
  }
};
```

These values must live in configuration rather than simulation functions.

---

# 80. Parameter Interpretation

Treat every coefficient as:

```text id="r5shd7"
hypothesis
```

not:

```text id="zyoqsl"
fact
```

When a parameter changes substantially, record why.

Example:

```text id="0130ob"
technology.diffusionRate

0.010 → 0.006

Reason:
Monte Carlo runs showed unrealistically rapid convergence,
eliminating persistent technological differences.
```

This should eventually become a calibration changelog.

---

# 81. Required Model Tests

## Population

Higher food stress must increase mortality.

Higher medicine technology must reduce normal mortality.

---

## Economy

Higher capital should increase GDP, all else equal.

Higher institutional capacity should increase effective productivity.

War damage should reduce capital.

---

## Education

Higher education spending should increase long-run education.

---

## Technology

Higher research spending should increase expected technological growth.

Technology diffusion must require a positive technology gap.

---

## Politics

Increasing food stress must reduce target stability.

Increasing legitimacy must increase target stability.

War exhaustion must reduce stability.

---

## Diplomacy

Higher trade should generally improve relations.

Higher threat should generally worsen relations.

---

## Alliances

Common external threats should increase alliance probability.

---

## War

Greater military risk should reduce war probability.

Stronger claims should increase war probability.

High war exhaustion should reduce willingness to continue war.

---

# 82. Directional Tests

Many simulation behaviors are stochastic.

Therefore prefer tests like:

```text id="u5ytqm"
Over 10,000 controlled decisions,
high-threat conditions produce more alliances
than low-threat conditions.
```

rather than:

```text id="kvx1gy"
Seed 42 must create an alliance in year 17.
```

Use exact deterministic tests only for reproducibility.

---

# 83. Determinism Test

Required:

```ts id="lrzdfb"
worldA = generateWorld(481204);
worldB = generateWorld(481204);

simulateYears(worldA, 1000);
simulateYears(worldB, 1000);

expect(worldA).toEqual(worldB);
```

This is one of the project's most important tests.

---

# 84. Long-Run Stability Test

Run:

```text id="58fe85"
100 worlds
×
10,000 years
```

in automated or dedicated simulation tests.

Assert:

```text id="w8qpd7"
no NaN
no Infinity
no invalid percentages
no negative populations
no negative capital
no broken ownership references
```

Do not assert that states must survive.

---

# 85. Modeling Assumptions

## P01 — Population depends on material conditions

Food availability and health influence mortality and population growth.

---

## P02 — Demographic transition

Higher education, prosperity, and urbanization tend to reduce birth rates.

This is represented as a general mechanism rather than a deterministic historical stage.

---

## P03 — Capital contributes to production

Capital accumulation increases economic output with diminishing returns.

---

## P04 — Institutions influence productive capacity

Higher institutional capacity improves:

- taxation
- production
- research
- administration

---

## P05 — Education contributes to innovation

Education increases the effectiveness of research investment.

Education does not automatically cause a particular political regime.

---

## P06 — Technology diffuses

Technological knowledge can spread between politically and economically connected states.

---

## P07 — Geography matters without determining destiny

Resources, terrain, and agricultural capacity create constraints and opportunities.

They do not determine outcomes by themselves.

---

## P08 — Military strength has opportunity costs

Military expenditure can improve short-term strategic power while reducing resources available for long-term investment.

---

## P09 — Political stability is multicausal

No single variable determines political stability.

---

## P10 — Political systems are not evolutionary stages

Monarchy, democracy, autocracy, and other systems are not encoded as lower or higher stages of development.

---

## P11 — States respond to perceived threat

Relative military power, proximity, and hostility affect strategic behavior.

---

## P12 — Balance-of-power behavior can emerge

States sharing a powerful threat have stronger incentives to cooperate.

---

## P13 — War has domestic consequences

War affects:

- population
- debt
- economic production
- political legitimacy
- stability

---

## P14 — Territorial expansion has diminishing returns

Territory creates resources and strategic power but also administrative and military burdens.

---

## P15 — History has persistence

Wars, claims, institutions, infrastructure, and accumulated capital create path dependence.

---

# 86. Explicit Non-Assumptions

PolityLab must not assume:

```text id="66m4ym"
democracy always produces higher growth
```

```text id="7ty8k3"
autocracy always produces instability
```

```text id="wokg0z"
wealth inevitably causes democracy
```

```text id="ch36dk"
war is primarily caused by resources
```

```text id="fx3dts"
technology always progresses
```

```text id="5mrywj"
large states are inherently stronger
```

```text id="f04u72"
economic interdependence makes war impossible
```

```text id="6gek04"
societies move through universal historical stages
```

These outcomes should emerge only if the model's interacting mechanisms produce them.

---

# 87. Model Development Rule

When adding a new feature, ask:

```text id="iiafs0"
What state variable does this introduce?

What mechanism changes it?

What does it influence?

What feedback loops does it create?

How can the effect be tested?

How can the effect be explained to the user?
```

If these questions cannot be answered, do not add the mechanism yet.

---

# 88. Avoiding Model Bloat

Before adding a variable, ask whether an existing variable can represent the mechanism adequately.

Prefer:

```text id="wlvocp"
20 meaningful interacting variables
```

over:

```text id="g03549"
200 weakly connected statistics
```

Complexity should emerge from interactions, not from quantity of parameters.

---

# 89. Calibration Workflow

For each major milestone:

```text id="u3bmqc"
1. Create controlled unit scenarios.

2. Verify directional behavior.

3. Run individual worlds.

4. Inspect surprising outcomes.

5. Use causal traces to explain them.

6. Run Monte Carlo batches.

7. Measure world-level statistics.

8. Adjust coefficients.

9. Record calibration changes.

10. Repeat.
```

Never calibrate only by watching one favorite seed.

---

# 90. Core Model Objective

The simulator succeeds when a user can observe something like:

```text id="1ef3eo"
Velos became the dominant military power.

↓

Its victories increased territorial control.

↓

Expansion increased resource access.

↓

But administration could not keep pace.

↓

War expenditure produced heavy debt.

↓

Education and infrastructure investment declined.

↓

Technology growth slowed.

↓

Ardan overtook Velos economically.

↓

Neighboring states formed a balancing alliance.

↓

A prolonged war produced food shortages and political instability.

↓

The Velos military removed the government.

↓

Thirty years later the empire fragmented.
```

and every step can be traced to understandable simulation mechanisms.

No step needs to have been scripted.

That is the purpose of the model.

---

# 91. North-Star Technical Principle

The best PolityLab model is not the one with the most realistic-looking equations.

It is the smallest model that reliably creates:

```text id="x169fz"
surprising outcomes
that remain understandable
after inspection.
```

When forced to choose between complexity and interpretability, prefer interpretability for v0.1.

---

# 92. Calibration Changelog

Every coefficient in `src/lib/simulation/config.ts` (`DEFAULT_MODEL_CONFIG`)
starts at the value given in §79 and the sections above. When a value is changed
because Monte Carlo batches or playtests reveal a pathology (§77–§78), record it
here so the reasoning is not lost (§37, §80, BLUEPRINT.md §55.12):

```text
namespace.param: old → new — reason (milestone / seed evidence)
```

### Additions (parameters MODEL.md references but §79 omits)

- `economy.prosperityHalfSaturation = 2.0` (M4) — the half-saturation constant
  named in §12; needed by the prosperity transform at world generation.
- `food.areaCapacityScale = 330000` (M4) — internal unit scaling so region-area
  food capacity (§9) produces populations in the §5 range.
- `welfare.referenceIntensity = 0.05` (M6) — §8/§28/§30 use `welfareEffect` /
  `welfareIntensity` without a reference; welfare outlay (fraction of GDP) is
  divided by this to give a bounded 0..1 effect. §28's `welfareIntensity` term
  is implemented with this bounded `welfareEffect` (0..1) so it is comparable to
  the other 0..1 terms in that formula.
- `diplomacy.opinionMeanReversion: 0.01 → 0.02` (M12) — once trade became
  dynamic, the `+0.020·trade` term in §44 (with trade ≈ 0.7 in a peaceful
  world) drove opinion to +1 for nearly every pair against a 0.01 restoring
  pull, erasing all polarization. 0.02 restores a spread (opinions ≈ −0.1 to
  +0.8, mean ≈ 0.5). **Calibration watch:** revisit after M15/M16 — if trade +
  warm relations suppress wars entirely, `computeTradeScore` (whose components
  are proxies, below) or this coefficient need further tuning.
- Military political cost (§43, M14): "additional political cost above ~8% of
  GDP" is applied as a `militaryBurdenStress = clamp01((burden − 0.08) / 0.15)`
  term (weight 0.08) added to the regime-stress sum in §30 — so an over-armed
  state is less stable, on top of the opportunity cost of the spending itself.
- Alliances (§49, M13): formation rate 0.10 and the `sigmoid(·×10)` shape are
  from MODEL.md; `allianceThreshold` is raised 0.65 → 0.78 and mirror break
  parameters added (`allianceBreakRate 0.08`, `allianceBreakThreshold 0.68`)
  because the score's components (trust, trade, opinion) run high in a peaceful
  world — at 0.65 every pair allied within centuries. With the wider band,
  alliances form when a genuine shared threat lifts the score and dissolve when
  it fades: ≈ 4–11 of 28 pairs allied at year 1000, and a dominant state raises
  its neighbours' alliance activity ≈ 75%. `strategicCompatibility` in the
  score = `1 − rivalry`. Trust also gained an erosion-toward-0.35 term (M13) so
  it is earned rather than assumed.
- `computeTradeScore` components (§26, M12) are interpretations of the named
  factors: `economicCompatibility = prosperityA · prosperityB` (both need
  surplus); `relationQuality` from the two-way average opinion;
  `resourceComplementarity` from the mean absolute difference of the two
  states' region-mean resource profiles (÷0.25); `transportCompatibility` a
  50/50 blend of transport tech and mean infrastructure. `tradeOpenness` (§27,
  fed to the §14 TFP bonus) = mean partner trade intensity ÷ 0.40, clamped.
- Trust (§45): MODEL.md gives drivers but no formula. Implemented (M11) as
  `Δtrust = (0.006·trade + 0.004·alliance + 0.003·peaceFactor)·(1−trust)
  − (0.010·atWar + 0.006·claims + 0.004·threat)·trust`, giving a stable
  relationship-quality equilibrium in (0, 1). `peaceFactor` ramps 0→1 over 30
  years since the last war ended (1 if never at war).
- Diffusion / diplomacy proxies (M11): `commonEnemy` = max over third parties of
  `min(threat i→k, threat j→k)`; `expansionismSignal` in the threat formula
  (§48) = the other state's territorial claim on this one (a full
  expansionism model waits on war-declaration history).
- `politics.inequalityMeanReversion = 0.004` (M10) — §28 has no restoring term,
  so any small constant imbalance in its drivers pushes inequality to a bound
  over centuries; a mild pull toward 0.40 (following the §29 legitimacy
  precedent) keeps it in a plausible band. §28's `capitalPressure` and
  `rapidIndustrialization` inputs are proxies (`clamp01(K/Y ÷ 6)` and
  `clamp01(max(0, GDP growth) ÷ 0.05)`) pending the deferred §21 structure data.
- `technology.diffusionGapFloor = 0.05` (post-v0.1 calibration) — §25 diffusion
  used the raw gap `max(0, otherTech − ownTech)`, which pulls every state to an
  identical frontier over centuries. The floor makes diffusion operate only once
  a state is more than 5 points behind a partner, so genuine laggards are still
  lifted ("diffusion should matter", §77) while near-peers stay spread. See the
  calibration-pass note below.

### Coefficient changes

- **Post-v0.1 calibration pass** (uses the M27 `pnpm mc` batch as the feedback
  loop; closes two of the §77 watches). Baseline before this pass, 100 worlds ×
  1,000 y: technology convergence **1.00** (every seed), state extinction **3.8%**
  (median world lost 0 of 8), and `td6ki3` fired on 1 seed.
  - `technology.innovationRate 0.006 → 0.0042`, `diffusionRate 0.01 → 0.0072`,
    `maxAnnualDiffusion 0.02 → 0.013`, plus the new `diffusionGapFloor` (below).
    At the §79 rates every state saturated the frontier well inside 1,000 y and
    the technology index converged to an identical value — no divergence at all,
    against §77. After: index min/median/max ≈ **0.89 / 0.92 / 0.95**
    (convergence 0.95), with diffusion still visibly closing large gaps and the
    residual divergence compounding into a wide GDP-per-capita spread
    (≈ 8 – 19, gini ≈ 0.44).
  - Warfare — capture threshold `attackerSuccess 0.65 → 0.60`, rate factor
    `0.25 → 0.34` (both directions), and the peace formula reweighted from
    `0.03 + 0.5·avg(desire) + 0.35·max(desire)` to
    `0.02 + 0.62·min(desire) + 0.26·avg(desire)`. At the old values a war
    almost never transferred enough land to finish a state — the loser's
    desperation ended every war in ~2 y before the winner could press. After:
    state extinction ≈ **21%** over 1,000 y (median world loses 2 of 8, worst
    4, best 0), war duration ≈ 3.5 y, largest empire ≈ 37%, **0 seeds** reach
    the 90% hegemony bar (the §38 overextension brake still holds). §77's "some
    persist for centuries, some disappear" is now genuinely met.
  - **Still open (documented, not fixed here):** at horizons past the v0.1
    1,000-year bar the world consolidates (≈ 45% extinction, median 4–5
    survivors by year 2,000) and `td6ki3` — all surviving states the same
    government — fires on ~15% of 2,000-year seeds. Republic is the plurality
    in ~64% of 1,000-year worlds. The cause is structural: `politicalParticipation`
    only rises (via `reform` transitions, which developed states score highly)
    and `classifyGovernment` routes "high participation + rule of law" straight
    to `republic`, so development ratchets toward one type (a soft P10 tension).
    Coefficient nudges here backfired (they over-routed to `oligarchy` and made
    `td6ki3` fire *more* at 1,000 y); the real fix is a continuous,
    faction-resisted participation/centralization drift and a multi-axis
    classifier, deferred to its own pass.

- War-frequency pass after M18 (Phase 4 gate): `warfare.warThreshold 0.20 → 0.25`;
  `scoreWarTarget` `territorialValue` 0.3+0.7·agri → 0.15+0.6·agri, `resourceValue`
  ×0.7, `strategicValue` 0.4·prox+0.6·tension → 0.3·prox+0.5·tension; and a new
  `memoryGate = 1 − 0.85·warMemory` on `pWar` so recent belligerents don't
  immediately re-declare. Result: ~50–80 wars per 1,000 years (a war every
  ~15 years), 7–8 of 8 states surviving, largest empire 17–38%. The event feed
  now reads as varied history rather than a war ticker.
- `warfare.baseWarProbability: 0.12 → 0.08` (M16) and territorial-capture
  probability factor 0.4 → 0.25 — once real casualties/economic damage/territory
  loss were in, the M15 frequency ground weak states down: 2–4 of 8 survived and
  1 seed in 8 reached >90% territory. At the lower values, 4–7 of 8 survive and
  0 of 12 seeds exceed 90%. The remaining consolidation pressure should ease once
  M17 adds the overextension brake (§38).
- `warfare.warThreshold: 0.15 → 0.20` (M15) — at 0.15 the §53 probability fired
  ~420 wars per 1,000 years (a declaration every ~2 years); 0.20 brings it to
  ~280–320, still frequent. Real calibration of war frequency waits on M16
  (actual casualties / economic damage raise the cost of war) and M27.

- `politics.legitimacyMeanReversion: 0.005 → 0.012` (M10) — at 0.005 the
  persistent Malthusian food stress (§11, `foodStress ≈ 0.37` at equilibrium)
  applies `−0.020·foodStress ≈ −0.0074`/yr to legitimacy every year, which the
  0.005 reversion cannot offset, pinning legitimacy at 0 for a majority of
  states (a degenerate, information-free variable). 0.012 keeps legitimacy
  non-degenerate (≈ 0.00–0.41, mean ≈ 0.2) while still reflecting chronic food
  pressure. **Revisit after M27:** the deeper fix is likely urbanization
  dynamics (§20, currently deferred) lowering birth rates further and thus the
  food-stress equilibrium; also re-check once war outcomes (M16, ±0.08
  legitimacy swings) add variety.

### Observed behaviour

- M6: with technology, education, and prosperity still static (their systems are
  no-ops until M7/M9), population converges to a Malthusian ceiling near
  `foodRatio ≈ 0.85` (`foodStress ≈ 0.37`) within ~1.2–1.5× of the starting
  population — no runaway growth, no collapse. The demographic transition should
  begin once M7/M9 let prosperity and education rise.
- M7: with technology still static, capital converges to `K/Y ≈ 5` (the
  `s/δ` ratio plus infrastructure investment), so GDP per capita roughly doubles
  from its low-capital start (e.g. 0.8 → 1.6) then plateaus; prosperity rises
  ~0.28 → ~0.45. Bounded and stable — growth → 0 at the steady state.
  Deferred to a later milestone: economic structure sector shares (§21) and
  urbanization dynamics (§20), and the optional ±1% economic shock (§67).
- M8: with the default budget, region infrastructure converges to ≈ 0.65–0.80
  and education to ≈ 0.60–0.80 (higher with more institutional capacity, §19).
  Both raise TFP and — via infrastructure — food capacity, lifting GDP per
  capita to ≈ 1.4–3.3 and populations to ≈ 1.3–5M while the rising education
  begins pulling birth rates down (the demographic transition). Bounded and
  stable over 1,000 years. Debt interest/servicing (§39) still deferred to M16
  alongside war deficits; budgets are static until strategic decisions (M15).
- M9: technology advances from ≈ 0.2 to ≈ 0.80–0.87 over 1,000 years, with a
  small inter-state spread (≈ 0.07–0.11) — domestic innovation dominates and
  diffusion narrows the rest. Compounding into TFP and food capacity, this lifts
  GDP per capita to ≈ 5–9 and populations to ≈ 3–9M by year 1000 (a full
  millennium of uninterrupted development; wars, instability, and varied
  research budgets — none yet modelled — are expected to spread these out and
  set them back). **Calibration watch:** if Monte Carlo (M27) shows technology
  clustering near the frontier too readily, revisit `technology.innovationRate`.
- M10: stability converges to ≈ 0.5–0.85, held up mostly by prosperity and
  institutions; legitimacy settles low (≈ 0.0–0.4) under the persistent
  Malthusian food-stress drag (see the `legitimacyMeanReversion` note above).
  Inequality drifts toward ≈ 0.05–0.8 depending on welfare and capital
  intensity. Bounded, stable, deterministic (seeded ±0.005 stability
  disturbance). No government transitions — that is M17.
- M11: opinions polarize to a structural equilibrium — neighbouring pairs with
  power asymmetry or claims entrench toward −1, distant/compatible pairs sit
  mildly positive. Threat perception ≈ 0.05–0.6, strongest between close,
  hostile, unequal neighbours. Trust is uniformly high (≈ 0.6–0.9) because no
  war ever breaks it in a pure-peace run; M16 will drop and spread it. All
  relation fields bounded/finite; the opinion↔threat loop has gain < 1
  (converges). (Note: M12 raises `opinionMeanReversion`, softening the
  toward-−1 entrenchment; opinions then span ≈ −0.1 to +0.8.)
- M18: event engine. `captureEventSnapshot` freezes governmentType / territory /
  tech index / GDP-per-capita / foodStress + the war and alliance sets before
  the tick; `generateEvents` (phase 13) diffs afterwards and emits `WorldEvent`s
  — war 0.8, peace 0.5, politics (transition) 0.6, territory loss 0.7, state
  destruction 1.0, alliance 0.3, technology 0.4, economy 0.3, demography
  (famine onset) 0.4 (MODEL §65). Causes are lifted from the emitting system's
  trace where present (war decision, transition, GDP growth). Over 1,000 y a
  world logs ~600–800 events, chronological, ≥ 4 types. The UI gains a
  filterable event feed. **Phase 4 (conflict & political change) complete.**
- M17: government transitions. Faction influence (§33), institutional capacity
  (§37), and overextension (§38) are now dynamic. Overextension is measured as a
  state's world-territory share divided by its world-admin-capacity share
  (era-independent, no scale constant) and feeds regime stress (weight 0.10) and
  institutional erosion. On a rupture (`ruptureProbability = 0.08 · sigmoid((p −
  0.65)·10)`, §35) one of reform / coup / revolution / autocratization is chosen
  by weighted seeded draw (§36) and reshapes the continuous structure; the
  government-type label is re-derived every year by `classifyGovernment` (§32),
  never a driver. Over 10 seeds × 1,000 y: ~33 transitions per world, government
  types spread across republic / oligarchy / autocracy / federation /
  constitutional-monarchy (none > 55%), overextension now brakes conquerors
  (largest empire 21–52%, 0/10 seeds > 90%), 3–7 of 8 states survive.
- M16: warfare. Combat is `attackerSuccess = sigmoid(ln(strengthRatio)·3)` with
  terrain defence (§56–57); casualties ≤ 3%/yr (§58), economic damage and
  capital destruction (§59), war exhaustion accrual (§61). A dominant attacker
  captures one border region at a time (§60), the former owner keeps a claim
  (§51), and a state is removed only at territory 0 (§64, records preserved).
  Peace attractiveness rises with exhaustion, defeat, duration, instability
  (§62); victory/defeat move legitimacy by ≤ ±0.08 (§63). Debt now moves
  (`updateDebt`, §39): war deficits + interest × risk modifier, peacetime
  repayment. Over 1,000 years: ~260–360 short wars, 4–7 of 8 states surviving,
  largest empire 20–64%, world finite. Consolidation is still on the high side
  pending M17's overextension brake.
- M15: war decisions. `scoreWarTarget` (§52) contributors are proxies:
  `territorialValue` from target border-land agri potential, `resourceValue`
  from its resource means, `strategicValue = 0.4·proximity + 0.6·borderTension`,
  `domesticPoliticalBenefit` rises as the attacker's stability/legitimacy fall,
  `perceivedMilitaryAdvantage` = attacker's share of combined power (defender +
  0.6·allies), `economicCost = 0.3 + 0.5·trade + 0.2·debtStress`. Only
  graph-adjacent, non-allied, non-belligerent pairs roll §53's `pWar`; soft
  gates scale it down for low stability, weak military, overextension.
  `makeStrategicDecisions` also runs a compact peaceful-action menu (invest /
  arm / seek-trade) that nudges budgets on a genuine need. Placeholder war
  resolution in `warfare.ts`: exhaustion accrual (§61 base) + probabilistic end
  after ~2–3 years, no combat/territory (M16). Result: ~280–320 wars per
  1,000 years, all ending, world finite; stability drops to ≈ 0.4–0.55 in the
  more contentious world, development continues (tech ≈ 0.9, GDP/cap ≈ 7–10).
- M14: military power becomes dynamic. Capital accumulates from the military
  budget line toward `spending ÷ depreciation`, so power grows with the economy
  (≈ 40× over 1,000 years as GDP grows) while inter-state power ratios stay
  moderate (max/min ≈ 2.5–4). With the default budget, burden is 3–5% of GDP —
  under the §43 threshold, so no burden stress yet; the guns-vs-butter and
  arms-race dynamics show up only when budgets shift (M15). Bounded, finite,
  deterministic. **Phase 3 (international systems) complete.**
- M13: alliances emerge from incentives, not scripts — ≈ 4–11 of 28 pairs
  allied at year 1000, driven mostly by shared-threat (`commonThreat`, weight
  0.30). Balance of power works: making one state militarily dominant raises
  alliance activity among the other seven by ≈ 75% (8-seed control vs hegemon).
  Opinions keep a wide spread (≈ 0.5–0.7) after raising `opinionMeanReversion`
  and widening the alliance band.
- M12: trade grows to a moderate-to-high steady state (mean ≈ 0.7) between
  developed, reachable, non-belligerent states — trade blocs rather than
  isolation, given a peaceful millennium with advanced transport. Belligerent
  pairs go to ~0. Trade feeds the capped (≤15%) TFP bonus, warms relations
  (§44), and speeds diffusion (§25). Bounded, symmetric, deterministic. Whether
  this over-suppresses conflict is an open question until wars exist (M15/M16).
- M23–M26: Phase 6 (performance / history / persistence). No engine coefficients
  changed — `simulateYears` is unchanged and the determinism + architecture
  tests still pass. The engine now runs inside a Web Worker (`WorkerCore` is the
  `self`-free, Node-testable core; a thin `.worker.ts` shim wraps it, and an
  inline synchronous transport is used under SSR / when `Worker` is undefined).
  20× / 100× speeds added; a 1,000-year run completes in ~3 s with the UI
  thread free. The worker pushes a **truncated** state message: `world.events`
  to the last `EVENT_TAIL = 400`, per-state annual stats to the last
  `STATS_TAIL = 250` rows. Consequence: the M24 history charts and M21 inspector
  sparklines only show the most recent ~250 years of a longer run; the full
  record is retained in the worker and travels intact through `export` / `load`
  (M26) and `seek` snapshots (M25). `WorkerState.liveYear` was added so the M25
  timeline keeps its extent at the true present while a past year is being
  viewed read-only. Widening the charts to full history (a separate one-shot
  history fetch rather than the throttled tail) is deferred to post-v0.1.
- M27: Monte Carlo runner (`src/lib/montecarlo/`, `pnpm mc`, no engine change).
  Batch of 100 worlds × 500 years (seeds 1–100) in ~15 s under vite-node:
  **no §78 pathology rule fires.** Aggregate: ~44 wars/world all short
  (mean ≈ 2.9 y), 100% of worlds have wars, 7–8 of 8 states survive
  (extinction rate ≈ 1%), largest empire ≈ 23% (0% of worlds reach the 90%
  hegemony bar), GDP gini ≈ 0.37, ~15 political transitions/world, alliance
  frequency ≈ 28%. Government plurality across worlds: oligarchy 57, republic
  24, autocracy 9, federation 5, constitutional-monarchy 4, monarchy 1 — no
  world converges to one type (td6ki3 clear), but **oligarchy is the plurality
  in a majority of worlds** — a soft §77 diversity concern, not a §78 trip.
  **Calibration watches for a dedicated post-v0.1 pass (no coefficient change
  now):** (a) state elimination is low — over 500 y almost no state dies, so
  MODEL §77's "some should disappear" is only weakly met; (b) technology
  convergence ≈ 0.99 — states end a run nearly tied on the tech index
  (diffusion dominates divergence), though not pathologically early (s6j4is
  clear). Both are recorded here so the M9/M17 `Calibration watch` notes above
  now have Monte Carlo evidence behind them.
- **Post-v0.1 calibration pass.** Closed watches (a) and (b): the technology
  index now spreads ≈ 0.89–0.95 across a world's survivors (was a single value)
  and state extinction is ≈ 21% over 1,000 y (was ≈ 4%), median world losing 2
  of 8 with 0 seeds reaching hegemony. Coefficients and rationale are in the
  "Coefficient changes" section above. A new watch is recorded there: government
  diversity at horizons beyond 1,000 y — republic is the 1,000-year plurality
  (~64% of worlds, `td6ki3` clear) but consolidation past that makes `td6ki3`
  fire on ~15% of 2,000-year seeds; the fix is structural (participation must
  not ratchet one-way with development) and is its own pass.

**v0.1 complete.** All 27 milestones landed; the BLUEPRINT §51 checklist (16
conditions) is met; determinism, architecture, long-run, and directional test
suites are green (248 tests). The coefficient set is the §79 defaults plus the
additions and changes catalogued above — every divergence has a rationale and,
where relevant, a named watch. Remaining watches for later passes: government
diversity at long horizons (above); the `legitimacyMeanReversion` / urbanization
(§20) interaction from M10; economic-structure sector shares (§21) and economic
shocks (§67), still deferred.
