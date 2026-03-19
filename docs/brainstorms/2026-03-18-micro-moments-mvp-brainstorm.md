# Brainstorm: Micro Moments MVP

**Date:** 2026-03-18
**Status:** Ready for planning

## What We're Building

A WarioWare-style micro game engine for SvelteKit, with one playable game (FirstSteps) proving out the full game loop: canvas rendering, input handling, game lifecycle, and asset loading.

The vision is a growing arcade of micro games, each a memento from a child's life. The MVP proves the core abstraction works so that adding a new game is just writing a small self-contained module.

## MVP Scope

**In scope:**

- `types.ts` — MicroGame interface contract, GameContext, InputState, GameManifest, GameResult, Difficulty
- `GameRunner.ts` — Canvas lifecycle manager (init, game loop via requestAnimationFrame, destroy)
- `InputManager.ts` — Unified touch/keyboard/mouse input, normalized to 0..1 coordinates
- `responsive.ts` — Canvas scaling helper (400x400 logical, CSS-scaled to viewport)
- `first-steps/game.ts` — FirstSteps game using functional factory pattern
- `first-steps/manifest.json` — Game manifest
- `first-steps/assets/baby.png` — Placeholder sprite (or simple drawn asset)
- `+page.svelte` — Single page: title, start button, 400x400 canvas
- Basic `loadAsset` for images (not audio)

**Out of scope (for now):**

- ArcadeSequencer (speed ramping, shuffle, lives, boss games)
- AudioManager / howler.js / any sound
- TransitionRenderer
- SpriteSheet helper
- Album view, Timeline, GameCard, Prompt, Lives, SpeedMeter components
- Multiple games / registry
- Multi-route setup (/arcade, /album)
- Photo integration
- CLI scaffolding tool

## Key Decisions

### Functional factory over classes

Games will use `createGame(): MicroGame` pattern instead of class-based. Lighter weight, no `this` binding issues, closure-based state. The interface contract stays the same — just the authoring style differs.

```typescript
export default function createFirstSteps(): MicroGame {
  let state = { ... };
  return {
    async init(ctx) { ... },
    update(ctx, dt) { ... },
    render(ctx) { ... },
    destroy() { state = null; },
  };
}
```

### 400x400 logical canvas

Fixed logical resolution. CSS-scaled to fit viewport. Games never think about responsive layout — they paint to a fixed coordinate space with normalized input (0..1).

### No audio in MVP

`GameContext.playSound` will be a no-op. `loadAsset` supports images only. Audio infrastructure added later when ArcadeSequencer lands.

### Single page for MVP

No routing. Everything on `+page.svelte`. Title text, start button, canvas appears when game runs. The Svelte component manages game state (idle/playing/result).

### Keep project name "worlds-together"

The package.json name stays. "Micro Moments" is the game concept name, not the repo name.

### No ECS

Plain objects and arrays for game state. Each micro game has ~3-10 entities max. Simple is correct here.

## Architecture (MVP subset)

```
src/
  lib/
    engine/
      types.ts           # Full interface contract (MicroGame, GameContext, etc.)
      GameRunner.ts       # requestAnimationFrame loop, init/destroy lifecycle
      InputManager.ts     # Touch/keyboard/mouse -> normalized InputState
    utils/
      responsive.ts       # Canvas scaling (400x400 logical -> viewport)
  games/
    first-steps/
      manifest.json
      game.ts             # Functional factory: createFirstSteps()
      assets/
        baby.png
  routes/
    +page.svelte          # Single page shell
  app.css                 # Minimal global styles
```

### Timer bar drawn by GameRunner

A thin colored bar at the top of the canvas that shrinks as time runs out. Drawn by GameRunner (not the game itself), so every game gets it for free. Provides urgency even without the full sequencer.

### Full-screen color wash for win/lose

When the game resolves, the canvas flashes green (win) or red (lose) briefly (~1.5s) with text overlay ("You did it!" / "Oops!"). WarioWare-like feedback without audio. Then resets to start state.

### Assets in static/ with runtime fetch

Game assets live at `static/games/first-steps/baby.png`. `loadAsset` uses `fetch()` + `Image()` construction. Matches the architecture doc's lazy-loading pattern. Games can be added without rebuilding the app.

## Resolved Questions

All open questions from the initial brainstorm have been resolved (see Key Decisions above).

## Next Steps

Run `/workflows:plan` to create the implementation plan for this MVP scope.
