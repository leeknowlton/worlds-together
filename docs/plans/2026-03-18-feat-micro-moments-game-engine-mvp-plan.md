---
title: 'feat: Micro Moments game engine MVP'
type: feat
date: 2026-03-18
---

# Micro Moments Game Engine MVP

## Overview

Build the core game engine and one playable micro game (FirstSteps) to prove the WarioWare-style architecture. A single page with a 400x400 canvas, a start button, and a complete game loop: input, update, render, timer, win/lose feedback.

**Brainstorm:** `docs/brainstorms/2026-03-18-micro-moments-mvp-brainstorm.md`

## Proposed Solution

Seven files, built bottom-up: types first, then engine (InputManager, GameRunner), then responsive scaling, then the game itself, then the Svelte shell page.

## Technical Approach

### File Map

```
src/lib/engine/types.ts       # Interfaces: MicroGame, GameContext, InputState, GameManifest, GameResult, Difficulty
src/lib/engine/InputManager.ts # Touch/mouse/keyboard → normalized InputState
src/lib/engine/GameRunner.ts   # rAF loop, timer, timer bar, color wash, asset loading
src/lib/utils/responsive.ts    # Canvas scaling: 400×400 logical, CSS-fit, devicePixelRatio
src/games/first-steps/game.ts  # Functional factory: createFirstSteps()
src/games/first-steps/manifest.json
src/routes/+page.svelte        # Single-page shell: idle → loading → playing → result → idle
src/app.css                    # Global styles, canvas container
static/games/first-steps/baby.png  # Placeholder sprite
```

### Phase 1: Types (`types.ts`)

Define the full interface contract. These types are from the architecture doc with minor adjustments for the functional factory pattern.

```typescript
// src/lib/engine/types.ts

export type GameResult = 'pending' | 'win' | 'lose';
export type Difficulty = 1 | 2 | 3;

export interface InputState {
	pointer: {
		x: number; // 0..1 normalized to canvas
		y: number;
		down: boolean;
		justPressed: boolean; // true for one frame on press-down
		justReleased: boolean;
	};
	keys: {
		left: boolean;
		right: boolean;
		up: boolean;
		down: boolean;
		action: boolean; // space / enter
		justPressed: Record<string, boolean>;
	};
}

export interface GameContext {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	width: number; // always 400
	height: number; // always 400
	difficulty: Difficulty;
	input: InputState;
	timeLeft: number; // seconds remaining
	totalTime: number; // total duration for this game
	loadAsset: (path: string) => Promise<HTMLImageElement>;
	playSound: (id: string) => void; // no-op for MVP
}

export interface MicroGame {
	init(ctx: GameContext): Promise<void>;
	update(ctx: GameContext, dt: number): GameResult;
	render(ctx: GameContext): void;
	destroy(): void;
}

export interface GameManifest {
	id: string;
	title: string;
	prompt: string;
	date: string;
	occasion: string;
	description?: string;
	duration: number;
	difficulty_scaling: Record<Difficulty, { duration: number }>;
	tags?: string[];
	preload?: string[];
}
```

**Key contract:** `update()` returns `GameResult`. The runner checks the return value each frame. `'pending'` = keep going, `'win'` / `'lose'` = game over. If the timer expires and the game hasn't returned win/lose, the runner treats it as `'lose'`.

### Phase 2: InputManager (`InputManager.ts`)

Manages all input sources. Updates each frame (poll model — call `update()` at start of each frame to compute `justPressed` / `justReleased` from raw state).

**Design:**

- Registers `pointerdown`, `pointermove`, `pointerup` (unified pointer events — covers mouse + touch)
- Registers `keydown`, `keyup`
- Uses `canvas.getBoundingClientRect()` on each pointer event to normalize coordinates (not cached — handles resize)
- `justPressed` / `justReleased` computed by diffing current vs previous frame state
- `preventDefault()` called on pointer events targeting the canvas
- Canvas gets `touch-action: none` CSS

**API:**

```typescript
createInputManager(canvas: HTMLCanvasElement): {
	getState(): InputState;
	update(): void;    // call at start of each frame to advance justPressed/justReleased
	destroy(): void;   // remove all event listeners
}
```

**Edge cases handled:**

- Multi-touch: only tracks primary pointer (first touch)
- Pointer leaves canvas: `down` stays true until `pointerup` fires (even outside canvas)
- Keyboard `action`: space and enter both map to `action`

### Phase 3: GameRunner (`GameRunner.ts`)

The main orchestrator. Owns the rAF loop, timer, timer bar rendering, color wash, and asset loading.

**State machine:**

```
LOADING → PLAYING → RESULT → (done callback)
```

The Svelte component manages the outer states (idle vs active). GameRunner only handles the active game lifecycle.

**API:**

```typescript
createGameRunner(canvas: HTMLCanvasElement, opts: {
	game: MicroGame;
	manifest: GameManifest;
	difficulty: Difficulty;
	onComplete: (result: 'win' | 'lose') => void;
}): {
	start(): Promise<void>;  // load assets, init game, begin loop
	destroy(): void;          // stop loop, cleanup
}
```

**Game loop (each rAF frame):**

1. Compute `dt` = time since last frame, **clamped to 100ms max** (prevents dt spike on tab return)
2. `inputManager.update()` — advance justPressed/justReleased
3. Decrement `timeLeft` by `dt`
4. If `timeLeft <= 0`, force result to `'lose'` (timer expired)
5. `result = game.update(ctx, dt)`
6. `game.render(ctx)`
7. Draw timer bar on top (thin bar at top of canvas, inside the 400×400 space, ~6px tall, shrinks left-to-right, white)
8. If `result !== 'pending'`, stop loop, enter result phase

**Timer bar:** Drawn inside the 400×400 coordinate space at y=0..6. White bar. Width = `(timeLeft / totalTime) * 400`. Games should avoid the top 6px, but for MVP it's fine to overlap slightly.

**Result phase:**

- Stop the game loop
- Draw a semi-transparent color wash over the final game frame (green at `rgba(0,200,0,0.6)` for win, red at `rgba(200,0,0,0.6)` for lose)
- Draw text overlay ("You did it!" / "Oops!") centered on canvas
- After 1.5s (`setTimeout`, not rAF — so it fires even if tab is hidden), call `onComplete(result)`
- Call `game.destroy()`

**Asset loading (`loadAsset`):**

- Fetches from `/games/{gameId}/{path}` (maps to `static/games/...`)
- Returns `HTMLImageElement` via: `fetch()` → blob → `URL.createObjectURL()` → assign to `img.src` → wait for `onload`
- On error: log a warning, return a 1×1 transparent image (game's emoji fallback should handle missing sprites)
- No timeout or retry for MVP

**Tab visibility:**

- Listen to `document.visibilitychange`
- When hidden: stop rAF loop (it stops automatically, but also pause the timer by not decrementing `timeLeft`)
- When visible: resume rAF loop
- The dt clamp (100ms) is the safety net if visibility events are missed

### Phase 4: Responsive Scaling (`responsive.ts`)

**API:**

```typescript
setupCanvas(canvas: HTMLCanvasElement, logicalSize?: number): {
	ctx: CanvasRenderingContext2D;
	width: number;  // logical width (400)
	height: number; // logical height (400)
	destroy(): void; // cleanup resize listener
}
```

**Behavior:**

- Set `canvas.width = logicalSize * devicePixelRatio`, `canvas.height = logicalSize * devicePixelRatio`
- Apply `ctx.scale(devicePixelRatio, devicePixelRatio)` so all drawing uses logical 400×400 coordinates
- CSS: set canvas to `width: min(100vw, 100vh, 600px); height: same; aspect-ratio: 1`
- Listen to `resize` + `devicePixelRatio` changes → re-apply dimensions
- Default `logicalSize` = 400

### Phase 5: FirstSteps Game (`first-steps/game.ts`)

Functional factory. Adapts the architecture doc's class-based example to closure style.

**Game design (concrete):**

- Baby starts at x=0.15 (normalized). Target at x=0.7 (difficulty 1), 0.8 (d2), 0.9 (d3).
- Each tap/click anywhere on canvas (or spacebar) moves baby +0.06 to the right and starts a wobble animation.
- Baby wins when `x >= targetX`.
- At difficulty >= 2, rapid tapping while wobble is high has a small chance of falling (lose).
- Difficulty 1 for MVP (hardcoded — sequencer not present).

**Rendering:**

- Sky gradient background
- Brown floor at y=0.75
- Target (parent emoji 🤱) at the target position
- Baby: load `baby.png` via `loadAsset`. Fallback to 👶 emoji if image not available.
- Wobble animation: rotate baby by `sin(time) * wobble * 0.3`
- Step indicators: small ellipses on the floor for each step taken
- "plop!" text if fell

**Manifest (`manifest.json`):**

```json
{
	"id": "first-steps",
	"title": "First Steps!",
	"prompt": "Walk!",
	"date": "2025-01-15",
	"occasion": "First Steps",
	"description": "The day he finally let go of the table and took three wobbly steps across the living room.",
	"duration": 5,
	"difficulty_scaling": {
		"1": { "duration": 6 },
		"2": { "duration": 4 },
		"3": { "duration": 2.5 }
	},
	"tags": ["motor", "first-year", "milestone"],
	"preload": ["baby.png"]
}
```

### Phase 6: Page Shell (`+page.svelte`)

Single Svelte 5 component using runes. Manages four states: `idle`, `loading`, `playing`, `result`.

**State machine:**

```
idle → [click Start] → loading → [assets loaded, game init'd] → playing → [game complete] → result → [1.5s auto] → idle
```

**DOM structure:**

- `idle`: Title ("Micro Moments"), subtitle, Start button. No canvas visible.
- `loading`: Canvas mounted but showing "Loading..." text. Start button hidden.
- `playing`: Canvas showing game. Start button hidden.
- `result`: Canvas showing frozen game frame + color wash (handled by GameRunner). Start button hidden. Auto-transitions to idle after 1.5s.

**Implementation:**

- `let state = $state<'idle' | 'loading' | 'playing' | 'result'>('idle')`
- `let canvasEl: HTMLCanvasElement` bound via `bind:this`
- On start click: set `state = 'loading'`, wait for tick (so canvas mounts), create GameRunner, call `runner.start()`
- GameRunner's `start()` handles loading → playing transition internally
- `onComplete` callback: set `state = 'result'`, then after 1.5s set `state = 'idle'`
- On destroy (component unmount): call `runner.destroy()` if active

### Phase 7: Global Styles (`app.css`)

Minimal:

- CSS reset (box-sizing, margin, padding)
- Body: centered flex layout, dark background
- Canvas: `touch-action: none`, centered, with subtle shadow or border
- Title/button styling (clean, minimal — not the focus)

### Asset: `static/games/first-steps/baby.png`

A simple placeholder image. Can be a 64×64 pixel art baby or even a colored circle. The game has an emoji fallback, so this just proves the asset pipeline works.

## Acceptance Criteria

- [x] Visiting the page shows a title and start button
- [x] Clicking start loads the game and shows the canvas
- [x] The 400×400 canvas renders at crisp resolution on Retina displays
- [x] Tapping/clicking advances the baby across the screen
- [x] Spacebar also advances the baby
- [x] A white timer bar at the top shrinks as time runs out
- [x] Reaching the target triggers a green color wash with "You did it!"
- [x] Timer expiring triggers a red color wash with "Oops!"
- [x] After 1.5s, returns to the start screen automatically
- [x] Works on mobile (touch input, no page scrolling during game)
- [x] Tab backgrounding doesn't break the timer or cause dt spikes
- [x] `baby.png` loads from `static/`; game falls back to emoji if it fails
- [x] Canvas scales responsively on resize
- [x] No event listener leaks after multiple play-throughs
- [x] `pnpm check` passes (TypeScript types are clean)

## Implementation Order

1. `src/lib/engine/types.ts` — no dependencies
2. `src/lib/engine/InputManager.ts` — depends on types
3. `src/lib/utils/responsive.ts` — no dependencies
4. `src/lib/engine/GameRunner.ts` — depends on types, InputManager, responsive
5. `src/lib/games/first-steps/manifest.json` — no dependencies
6. `static/games/first-steps/baby.png` — placeholder asset
7. `src/lib/games/first-steps/game.ts` — depends on types
8. `src/app.css` — no dependencies
9. `src/routes/+page.svelte` — depends on everything above

Build and test after each file. Run `pnpm check` at the end.

## Formatting Conventions

Per the existing project config:

- **Tabs** for indentation
- **Single quotes**
- **No trailing commas**
- **100-char print width**
- Svelte 5 runes (`$state`, `$props`, `$effect`)

## References

- Brainstorm: `docs/brainstorms/2026-03-18-micro-moments-mvp-brainstorm.md`
- Architecture doc: provided in original prompt (not committed to repo)
- SvelteKit: v2.55.0 with Svelte 5.54.0
- Testing: Vitest 4.1.0 with browser (Playwright) + Node dual projects
