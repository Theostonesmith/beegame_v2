# beeGame
High-Level Game Design: Honeybee Forager
1. Game Concept

A top-down exploration and collection game where the player controls a honeybee gathering pollen from flowers and delivering it back to the hive. The core gameplay loop revolves around:

Explore → Gather Pollen → Avoid Hazards → Return to Hive → Upgrade Progress

The player must efficiently collect pollen while managing health and navigating dangerous pesticide zones.

2. Core Gameplay Loop
Spawn at Beehive
      ↓
Search for Flowers
      ↓
Collect Pollen
      ↓
Pollen Meter Full?
      ↓ No
Continue Searching
      ↓ Yes
Return to Hive
      ↓
Deposit Pollen Automatically
      ↓
Increase Hive Storage
      ↓
Repeat

3. Objectives
Primary Objective

Accumulate as much pollen as possible in the beehive storage.

Secondary Objectives
Discover flower-rich areas.
Take efficient routes.
Avoid pesticide contamination.
Maintain bee health.
4. Player Character (Honeybee)
Movement
Free 8-directional movement.
Fast and responsive controls.
Constant flying animation.
Attributes
Health
Maximum Health: 100
Damaged by pesticide zones.
Regenerates slowly over time.
Death occurs when health reaches zero.
Pollen Capacity
Represents how much pollen the bee can carry.
Displayed as a pollen meter.
When full, no more pollen can be collected.

Example:

Pollen: [██████████] 100%
Health: [███████---] 70%

5. Beehive (Base)

The hive serves as:

Spawn point
Safe zone
Resource storage
Features
Automatic Deposit

When the player enters the hive zone:

Player Pollen
      ↓
Hive Storage


Deposit happens instantly.

Hive Storage

Tracks total pollen collected during the game.

Example:

Hive Storage: 3,750 Pollen

6. Flowers

Flowers are the main resource nodes.

Flower States
Full Flower
Contains collectable pollen.
Bright and visually attractive.
Can be harvested.
Empty Flower
No pollen available.
Duller appearance.
Regenerates after some time.
Gathering

When the bee enters collection range:

Flower → Bee


Pollen transfers automatically.

Collection continues until:

Flower becomes empty, OR
Bee pollen meter becomes full.
7. Pesticide Danger Zones

Danger areas placed throughout the field.

Characteristics
Clearly visible contaminated patches.
Reduce player health while inside.
Damage

Example:

-5 Health / Second

Risk vs Reward

High-flower-density regions may contain pesticides, creating strategic decisions:

Safe Area:
Low Reward
Low Risk

Danger Area:
High Reward
High Risk

8. Health Regeneration

Health slowly recovers when not taking damage.

Example:

+1 Health / Second


Rules:

Regeneration starts after a brief delay outside pesticides.
Cannot exceed maximum health.
Stops while taking damage.
9. World Layout
┌─────────────────────────┐
│   Flower Field          │
│                         │
│ F      F    P           │
│                         │
│      Pesticide Zone     │
│                         │
│ P       F       F       │
│                         │
│         Hive            │
└─────────────────────────┘

F = Flower
P = Pesticide Zone


The hive is generally positioned near the center or edge of the map.

10. User Interface
Top Left
Health
[████████--] 80%

Top Right
Pollen Meter
[██████----] 60%

Bottom Center
Hive Storage: 3,750

Optional Mini-Map

Shows:

Hive
Nearby flowers
Pesticide zones
11. Game States
Playing

Normal gameplay.

Returning to Hive

Triggered when pollen meter reaches 100%.

Visual cue:

Pollen Full!
Return to the Hive

Dead

Health reaches zero.

Options:

Respawn at hive.
Lose carried pollen.
Continue playing.
12. Progression System (Optional)
Hive Growth

Accumulated pollen unlocks improvements:

Upgrade	BenefitStronger Wings	Faster movement
Larger Pollen Sacs	Higher carrying capacity
Better Resistance	Reduced pesticide damage
Faster Recovery	Increased health regeneration
13. Scoring

Final score can be based on:

Total Pollen Stored
+
Flowers Harvested
+
Longest Survival Time
-
Deaths

14. Design Pillars
Simple

Easy-to-understand collection gameplay.

Relaxing

Smooth flying and flower gathering.

Risk and Reward

Dangerous pesticide zones contain valuable flower clusters.

Continuous Progression

Every successful return to the hive contributes to long-term growth.

MVP Features

For a first playable version:

Top-down bee movement
Beehive base
Pollen collection mechanic
Pollen carry meter
Automatic hive deposit
Pesticide damage zones
Health regeneration
HUD (health, pollen, hive storage)
Respawn at hive

This MVP provides a complete gameplay loop while leaving room for future additions such as weather, predators (birds/wasps), multiple flower species, hive upgrades, and seasonal events.

## Run the MVP

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Use WASD or the arrow keys to fly; on touch devices, drag across the field. Flowers regrow after being depleted. Return to the hive to bank pollen, and leave contaminated patches to recover health. Use **Pause** to stop the simulation or **New run** to reset it.

Create a production build with `npm run build`; preview it locally with `npm run preview`.
