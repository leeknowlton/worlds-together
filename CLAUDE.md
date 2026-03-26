# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (Vite)
pnpm build            # Production build (Vercel adapter)
pnpm check            # Svelte type checking
pnpm lint             # Prettier + ESLint
pnpm format           # Auto-format with Prettier
pnpm test             # Run all tests once
pnpm test:unit        # Run Vitest in watch mode
pnpm test:unit -- --run --reporter verbose -t "test name"  # Run a single test
```

## Architecture

**Worlds Together** is a WarioWare-style collection of timed micro-games for kids, built with SvelteKit + Canvas 2D. All rendering is pixel-art on `<canvas>`, no DOM game UI.

### Flow: Scenes → Game Runner

The app is a single-page SvelteKit app (`+page.svelte`) that manages three states via canvas-based scenes:

1. **TitleScene** — Animated pixel-art title screen. Tap/Enter advances to selection.
2. **SelectionScene** — Grid of game thumbnails. Picking one launches a game.
3. **GameRunner** — Runs a single `MicroGame` with a countdown timer, input handling, and a metadata panel below the game area.

After a game completes (win/lose), it returns to the TitleScene.

### Canvas Layout

The logical canvas is 400×480px (defined in `src/lib/utils/responsive.ts`). It's split into:
- **Game area**: 400×400px top portion where games render
- **Metadata panel**: 400×80px bottom strip showing date, occasion, and description from the manifest

Games that use the low-res pixel buffer render at 200×150 (`BUFFER_WIDTH`/`BUFFER_HEIGHT` in `draw.ts`) and blit up to the game area via `blitBufferToScreen()`.

### Adding a New Game

Each game lives in `src/lib/games/<game-id>/` with two files:

- **`manifest.json`** — Metadata: `id`, `title`, `prompt`, `date`, `occasion`, `description`, `duration`, `difficulty_scaling` (durations per difficulty 1/2/3), optional `tags` and `preload`.
- **`game.ts`** — Default export is a factory function returning a `MicroGame` object with `init()`, `update()`, `render()`, `destroy()`.

To wire it in, import the game factory + manifest in `+page.svelte` and add to the `games` array.

Game assets go in `static/games/<game-id>/` and are loaded at runtime via `ctx.loadAsset(path)`.

### Key Engine Modules

- **`engine/types.ts`** — Core interfaces: `MicroGame`, `GameContext`, `InputState`, `GameManifest`
- **`engine/GameRunner.ts`** — Orchestrates a game session: timer, input, render loop, result display
- **`engine/draw.ts`** — Pixel drawing primitives (`px`, `rect`, `drawSprite`), 3×5 bitmap font, buffer surface creation, `blitBufferToScreen()`
- **`engine/InputManager.ts`** — Normalizes pointer (touch/mouse) and keyboard into `InputState`. Pointer coords are 0–1 normalized to game area.
- **`engine/SoundManager.ts`** — Procedural Web Audio sounds (no audio files). Sound IDs: `hit`, `miss`, `tick`, `bass`, `win`, `lose`, `combo`
- **`sprites/child.ts`** — Shared child character sprite drawn from composable parts (`drawChildHead`, `drawChildEyes`, `drawChildMouth`, `drawChildTorso`, etc.)

### Tech Stack

- SvelteKit with Svelte 5 runes mode (enforced in `svelte.config.js`)
- TypeScript strict mode
- Vitest with two test projects: `client` (browser via Playwright) for `.svelte.test.ts` files, `server` (Node) for plain `.test.ts`
- Deployed to Vercel
- pnpm package manager
- DotGothic16 font used for Japanese text rendering
