---
title: "refactor: Extract duplicated blit-to-screen into shared utility"
type: refactor
date: 2026-03-25
deepened: 2026-03-25
---

# Extract Duplicated Blit-to-Screen into Shared Utility

## Enhancement Summary

**Deepened on:** 2026-03-25
**Agents used:** kieran-typescript-reviewer, pattern-recognition-specialist, code-simplicity-reviewer, architecture-strategist, performance-oracle

### Key Insights from Review

1. **Signature is correct** — explicit `screenWidth`/`screenHeight` params are necessary because TitleScene passes LOGICAL_W/H (400/480) which differ from canvas physical dimensions (DPR-scaled). Using `ctx.canvas.width/height` would break.
2. **draw.ts is the right home** — `createBufferSurface()` already establishes precedent for canvas management in this module. A separate `screen.ts` for one function would be over-engineering.
3. **Performance: no concerns** — function call overhead is negligible at 60fps. Scale calculations (4-6 float ops) cost ~0.01ms. Caching would be premature optimization.
4. **save()/restore() is correct** — encapsulating context state management prevents bugs at call sites. The overhead is minimal.
5. **SelectionScene thumbnails unaffected** — it captures the game's internal buffer canvas after render(), never calls the blit function.
6. **bgColor parameter validated** — 4 files use `#151621`, 2 use `#1a1a2e`. The default parameter correctly handles majority case.

## Overview

Six files contain a near-identical ~15-line block that blits a 200x150 buffer onto the screen canvas with scaling, centering, and a dark border frame. Extract this into a single `blitBufferToScreen()` function in `draw.ts`, then replace all 6 inline copies. Also fix a pointer coordinate bug in airport-lines that breaks touch-based right movement.

## Problem

The duplicated blit block appears in:
1. `src/lib/games/birthday-jump/game.ts`
2. `src/lib/games/swing-rhythm/game.ts`
3. `src/lib/games/airport-lines/game.ts`
4. `src/lib/games/silly-dance/game.ts`
5. `src/lib/games/microwave-cook/game.ts`
6. `src/lib/title/TitleScene.ts`

Each copy does: fill background, calculate scale, draw dark border frame (`#090b11` fill + `#2e3247` stroke), blit buffer with `imageSmoothingEnabled = false`, save/restore context. The only variance is background color (`#151621` in 4 files, `#1a1a2e` in 2 files).

Additionally, `airport-lines` has a bug where `pointer.x` (normalized 0-1) is compared against `ctx.width * 0.4` (=160), making right-side touch input completely non-functional.

## Proposed Solution

### 1. Add `blitBufferToScreen()` to `src/lib/engine/draw.ts`

```typescript
export function blitBufferToScreen(
  buffer: HTMLCanvasElement,
  screen: CanvasRenderingContext2D,
  screenWidth: number,
  screenHeight: number,
  bgColor = '#151621'
): void
```

- Reads `buffer.width` / `buffer.height` to compute scale (not hardcoded to 200x150)
- Owns `screen.save()` / `screen.restore()` to prevent state leaks
- Hardcodes frame appearance: offset -8, fill `#090b11`, stroke `#2e3247`, lineWidth 4

### 2. Replace all 6 inline blit blocks with `blitBufferToScreen()` calls

- `birthday-jump/game.ts` — `blitBufferToScreen(canvas, screen, ctx.width, ctx.height)`
- `swing-rhythm/game.ts` — same
- `microwave-cook/game.ts` — same
- `airport-lines/game.ts` — `blitBufferToScreen(canvas, screen, ctx.width, ctx.height, '#1a1a2e')`
- `silly-dance/game.ts` — `blitBufferToScreen(surface.canvas, screen, ctx.width, ctx.height, '#1a1a2e')`
- `TitleScene.ts` — `blitBufferToScreen(buffer.canvas, screen, LOGICAL_W, LOGICAL_H)`

### 3. Fix airport-lines pointer bug

Change `ctx.input.pointer.x < ctx.width * 0.4` to `ctx.input.pointer.x < 0.4` and `ctx.input.pointer.x > ctx.width * 0.6` to `ctx.input.pointer.x > 0.6`.

### 4. Minor consistency fixes

- `swing-rhythm/game.ts`: Add `ctx: GameContext` parameter to `init()` for interface conformance
- `silly-dance/game.ts`: Null state in `destroy()` for consistency

## Acceptance Criteria

- [x] New `blitBufferToScreen()` function exported from `src/lib/engine/draw.ts`
- [x] All 6 files use the shared function (no inline blit blocks remain)
- [x] All games render identically to before (no visual changes)
- [x] Selection scene thumbnail capture still works (non-standard 400x400 context)
- [x] TitleScene renders correctly (uses LOGICAL_WIDTH/HEIGHT, not GameContext)
- [x] Airport-lines right-side touch input works
- [x] `npx svelte-check` passes with 0 errors
- [x] `npm run build` succeeds

## Files Changed

| File | Change |
|------|--------|
| `src/lib/engine/draw.ts` | Add `blitBufferToScreen()` |
| `src/lib/games/birthday-jump/game.ts` | Replace inline blit |
| `src/lib/games/swing-rhythm/game.ts` | Replace inline blit, fix init signature |
| `src/lib/games/airport-lines/game.ts` | Replace inline blit, fix pointer bug |
| `src/lib/games/silly-dance/game.ts` | Replace inline blit, fix destroy |
| `src/lib/games/microwave-cook/game.ts` | Replace inline blit |
| `src/lib/title/TitleScene.ts` | Replace inline blit |

## Not in scope

- airport-dash (renders directly to screen canvas, no buffer pattern)
- Difficulty scaling for swing-rhythm (separate enhancement)
- Tests (no game code is currently tested)
- Parameterizing frame appearance (hardcoded is fine for now)
