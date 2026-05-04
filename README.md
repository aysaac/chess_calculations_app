# Chess Calculation Trainer

A web app for practicing chess calculation skills. You're shown a puzzle position, then you input your calculated lines on an interactive board. At the end, compare your work against the solution.

**[chess-calc.aysaac.net](https://chess-calc.aysaac.net)**

## How it works

1. A puzzle is loaded — either from [Lichess](https://lichess.org) or a local CSV database of 30,000+ puzzles
2. The puzzle position is shown, plus a yellow arrow indicating the opponent's setup move
3. You calculate lines by clicking squares (or dragging) on the board: click a piece, then its destination
4. Use **New Line** to explore alternative continuations, **Undo** to backtrack
5. Click **Finished** to see the solution and compare your lines — illegal moves are highlighted in red
6. Adjust puzzle difficulty via the Settings page

## Features

- **Two puzzle sources**: Lichess API (difficulty-based) or bundled CSV
- **Rating filtering**: Only puzzles within your chosen rating range
- **Click and drag input**: Select squares by clicking, or drag from one square to another
- **Multiple calculation lines**: Explore branches — New Line saves the current line and lets you start another
- **Move validation**: Illegal moves are flagged in red when you finish
- **Configurable visibility**: Pieces can stay frozen (static) or move on the board (dynamic); arrows can show all moves, only the last move, or none
- **Settings persist** in your browser via localStorage

## Tech stack

| Library | Purpose |
|---|---|
| [chess.js](https://github.com/jhlywa/chess.js) | Move validation, SAN/UCI conversion, FEN parsing |
| [chessground](https://github.com/lichess-org/chessground) | Interactive chessboard rendering |
| TypeScript + Vite | Language and build tool |

## Running locally

```bash
npm install
npm run dev        # Start dev server on http://localhost:5173
npm run build      # Production build
npm run preview    # Preview production build locally
```

## Testing

```bash
npx vitest run     # Run all tests
npx vitest         # Watch mode
```

Over 40 unit tests cover validation, settings persistence, and line management.
