# Project Context (for coding agents)

Chess Calculation Trainer — a TypeScript + Vite SPA for practicing chess calculation using lichess puzzles.

## File map

```
src/
├── main.ts            # Entry point — wires board, input, lines, UI, settings
├── types.ts           # Shared interfaces: Puzzle, Move, Line, Settings, etc.
├── board.ts           # Chessground wrapper: init, click/drag input, arrow drawing,
│                      #   piece animation, replay, settings sync
├── puzzle.ts          # Puzzle loading from Lichess API or local CSV
├── lines.ts           # Line state machine: addMove, undo, newLine, finish, reset
├── input.ts           # Thin wrapper linking board input → lines.addMove
├── validation.ts      # chess.js Move validation + UCI→SAN conversion
├── ui.ts              # DOM rendering: line display, button states, puzzle info
├── settings.ts        # Settings persistence (localStorage)
├── settings-page.ts   # Settings page interactivity (sliders, dropdowns)
├── style.css          # Main app dark theme, responsive layout
├── settings.css       # Settings page styles
└── __tests__/
    ├── validation.test.ts  # 14 tests: validateMoves, solutionToSan
    ├── settings.test.ts    # 7 tests: localStorage-backed settings
    └── lines.test.ts       # 19 tests: mocked board + validation
```

Additional:
- `public/puzzles.csv` — 30k+ lichess puzzles (CSV format)
- `index.html` / `settings.html` — entry HTML files
- `wrangler.jsonc` — Workers deployment config

## Architecture

### Input flow

```
User clicks/drags on #board-overlay (z-index: 10, above chessground)
  → pointerdown/pointermove/pointerup handlers (board.ts)
  → distinguishes click-to-move (select square → select target) from drag (mousedown → mouseup on different square)
  → calls onMoveInput(from, to) callback
  → input.ts handleMove() → lines.ts addMove(from, to)
  → lines.ts: pushes move, calls validation, calls board.animateMove(),
    calls board.drawArrows(), notifies UI
```

### Board visibility modes

- **static**: pieces never move on the board. `cg.move()` is not called in addMove (animateMove checks `getBoardVisibility()`). `#board` gets CSS class `.static-board` which hides the dragging ghost. `animation.enabled: false`.
- **dynamic**: pieces move visually. `animateMove(from, to)` calls `cg.move()` (only if dynamic). `replayMoves()` replays all moves. `animation.enabled: true`.

Both modes use the same pointer-based input via the overlay.

### Lines state machine

- `addMove(from, to)`: appends move, revalidates, calls animateMove + drawArrows, notifies UI
- `undo()`: pops last move, revalidates, calls replayMoves (replays remaining moves on board) + drawArrows
- `newLine()`: saves current line to completedLines[], clears current, resets board to initial position
- `finish()`: returns snapshot of both current and completed lines (doesn't mutate)
- `reset()`: clears all lines (called on puzzle load)

### Puzzle loading

1. `loadPuzzle()` checks `puzzleSource` (api or csv)
2. For CSV: parses `public/puzzles.csv`, filters by rating range, shuffles, tries candidates with `tryBuildPuzzle()`
3. For API: fetches from `lichess.org/api/puzzle/next?difficulty=<rating-based>`, replays PGN to extract pre-setup FEN and setup move
4. Returns `Puzzle` with: id, preSetupFen, setupMove (from→to), fen (after setup), solution (UCI[]), playerColor, rating, themes

### Move validation

`validateMoves(fen, moves[])` replays moves through chess.js. Each move gets `legal: boolean` and `san?: string`. Once the first illegal move is encountered, all subsequent moves are also illegal (the chess.js instance stops advancing).

`solutionToSan(fen, uci[])` converts solution UCI moves to SAN for display. Illegal UCIs fall through as raw UCI without crashing.

### Settings

Stored in localStorage under key `chess-calc-settings`. Defaults:
- arrowVisibility: 'all'
- arrowColorMode: 'per-player'
- boardVisibility: 'static'
- playerRating: 1500
- ratingMin: 1450
- ratingMax: 1550

Partial overrides merge with defaults. Corrupt JSON falls back to defaults.

## Key recent changes

1. **Pointer-based input** replaced click-only handler — now supports both click-to-move and drag across squares. Uses pointerdown/pointermove/pointerup with `setPointerCapture` and a `dragging` CSS class for cursor feedback.

2. **`animateMove(from, to)`** added — moves a piece on the board when `addMove` is called in dynamic mode. Previously pieces only moved during undo/newLine replays.

3. **`replayMoves()` fixed** — now always calls `resetPosition()` first, then replays individual moves only in dynamic mode. Previously skipped reset in static mode, causing stale positions after undo.

4. **`syncSettings()`** added — re-applies board visibility CSS class, animation config, and re-renders arrows. Called on `pageshow` (bfcache restore) to handle settings changes made on the settings page.

5. **Deployment stabilized** — project is Cloudflare Workers (not Pages), `wrangler.jsonc` has `assets.directory: "./dist"`, `vite.config.ts` uses `cloudflare()` plugin, `base: '/'` (subdomain deployment).

## Tests

- **vitest** configured in `vite.config.ts` (`test.include`)
- `tsconfig.json` includes `vitest/globals` types
- Tests run with `npx vitest run`
- `lines.test.ts` mocks `board` and `validation` modules with `vi.mock()` — tests state machine contracts, not visual output
- Stricter tsconfig flags (`noUnusedLocals`, `noUnusedParameters`) apply to test files too — prefix unused params with `_`

## Gotchas

1. **chess.js 1.4.0 does NOT auto-promote pawns** — you must pass a `promotion` field to `chess.move()`. Moves like `e7e8` without promotion throw. The `validateMoves` function catches the error and marks the move as illegal.

2. **`draggable.enabled: false` and `selectable.enabled: false`** in chessground config — ALL input goes through the overlay, not chessground's built-in drag/select. This is intentional to support both click and drag input consistently across static/dynamic modes.

3. **`#board-overlay`** has `touch-action: none` — required for pointer events on touchscreens.

4. **`solutionToSan` doesn't validate** — if UCI moves are illegal, the chess.js instance throws, the UCI is passed through as-is, and the position doesn't advance. Subsequent moves may also fail because the position is stale.

5. **Settings changes mid-puzzle** — settings are on a separate page (`/settings.html`). Changes take effect on page reload or when `startPuzzle()` is called (Next Puzzle). The `pageshow`/bfcache handler syncs settings when navigating back.

6. **The status message says "Drag pieces or click squares"** — both work now, but only via the overlay (not chessground's native drag).
