# Wick

A lamplighter against a moth-choked city. Walk, gather the gems left by the dark, and choose the tools that keep your light alive. Your weapons fire automatically. Survive ten minutes to reach dawn.

Wick includes ten tools, six chest evolutions, ten trinkets, thirteen enemies, and an illustrated almanac. Original pixel sprites, animated effects, synthesized sound cues, and a sequenced music bed ship with the game. It runs entirely in your browser, with no external services.

## Run

```sh
npm ci
npm run dev
```

For a static production site:

```sh
npm run build
npm run preview
```

Serve `dist/` as-is, including from a subdirectory. All asset URLs are relative. Asset generation is a one-time authoring step; builds bundle the committed files and need no generation tools.

## Controls

- **WASD / arrows:** walk; navigate menus.
- **Enter / Space:** choose; continue.
- **P / Escape:** pause and resume. Escape also returns from the almanac and instructions.
- **M:** toggle sound.
- **Mouse / touch:** select menu items. Touch controls provide movement.
- **Backtick:** engine diagnostics.

## Development

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` run the checks. The tests use the Simple 2D engine with a counted clock and native canvas. `src/game.ts` exports the game and its state/debug types; the debug surface is returned through the engine and is not installed on the page.

The `showcase/` folder contains captures of the running game. Asset production recipes are retained in `assets/source/`.
