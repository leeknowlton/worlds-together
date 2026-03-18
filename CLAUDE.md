# CLAUDE.md

## Project Overview

**Worlds Together** ("Micro Moments") is a SvelteKit-based micro game engine — a WarioWare-style arcade of tiny canvas games representing milestones from a child's life. The MVP includes one playable game ("First Steps") demonstrating the full game loop architecture.

## Tech Stack

- **Framework:** SvelteKit 2 + Svelte 5 (runes)
- **Language:** TypeScript (strict mode)
- **Build:** Vite 7
- **Package Manager:** pnpm (enforced via `.npmrc`)
- **Deployment:** Vercel (`@sveltejs/adapter-vercel`)
- **Testing:** Vitest + Playwright (browser tests) + vitest-browser-svelte
- **Linting:** ESLint 9 (flat config) + Prettier

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm check            # Type-check (svelte-kit sync + svelte-check)
pnpm lint             # Prettier check + ESLint
pnpm format           # Auto-format with Prettier
pnpm test             # Run all tests once
pnpm test:unit        # Run tests in watch mode
```

## Project Structure

```
src/
├── lib/
│   ├── engine/            # Core game engine
│   │   ├── types.ts       # Game interfaces (MicroGame, GameContext, etc.)
│   │   ├── GameRunner.ts  # Main game loop (RAF-based, 60fps)
│   │   └── InputManager.ts # Unified touch/keyboard/mouse input
│   ├── games/             # Game implementations
│   │   └── first-steps/
│   │       ├── game.ts    # FirstSteps game (factory pattern)
│   │       └── manifest.json
│   ├── utils/
│   │   └── responsive.ts  # Canvas scaling + DPR handling
│   └── assets/            # Static assets (favicon, etc.)
├── routes/
│   ├── +layout.svelte     # Root layout
│   └── +page.svelte       # Main game page
static/
├── games/first-steps/     # Game assets (images)
docs/
├── brainstorms/           # Design vision docs
└── plans/                 # Technical implementation plans
```

## Architecture

### Game Engine

- **`MicroGame` interface:** Games implement `init()`, `update(dt)`, `render(ctx)`, and return `GameResult` ('pending' | 'win' | 'lose')
- **`GameRunner`:** Orchestrates the game lifecycle: init → game loop → result animation → cleanup. Uses `requestAnimationFrame`, caps dt at 0.1s, pauses on tab blur.
- **`InputManager`:** Normalizes pointer coordinates to 0..1 range. Tracks `down`, `justPressed`, `justReleased` states plus arrow keys and action buttons.
- **`GameContext`:** Passed to games each frame — provides canvas, input state, time info, difficulty, and asset loading.

### Adding a New Game

1. Create `src/lib/games/<game-name>/game.ts` exporting a factory function that returns a `MicroGame`
2. Create `src/lib/games/<game-name>/manifest.json` with metadata (title, duration, difficulty, assets, tags)
3. Place static assets in `static/games/<game-name>/`
4. Game logic uses functional factory pattern with encapsulated state

### Canvas Rendering

- Logical canvas size: **400x400** pixels
- DPR-aware scaling handled by `responsive.ts`
- All rendering uses Canvas 2D API directly (no DOM-based game UI)

### Svelte Patterns

- **Svelte 5 runes:** Use `$state()` for reactive state, `$effect()` for lifecycle/side effects
- **Component state:** App states are `'idle' | 'loading' | 'playing' | 'result'`
- No external state management library

## Code Style

- **Tabs** for indentation
- **Single quotes**
- **Print width:** 100 characters
- **No trailing commas**
- Run `pnpm format` before committing

## Testing

Two test environments configured in `vite.config.ts`:

1. **Client tests** (Svelte components): Run in Chromium via Playwright. Pattern: `*.svelte.{test,spec}.{js,ts}`
2. **Server tests** (functions/utilities): Run in Node.js. Pattern: `*.{test,spec}.{js,ts}` (excluding `.svelte.` tests)

## Key Types

- `MicroGame` — Game implementation interface with lifecycle methods
- `GameContext` — Per-frame context passed to games
- `GameResult` — `'pending' | 'win' | 'lose'`
- `InputState` — Normalized input (pointer + keyboard)
- `GameManifest` — Game metadata (duration, difficulty, assets)
- `Difficulty` — `1 | 2 | 3`
