# Teddy's Adventure

A 2D side-scrolling platformer in plain HTML5 canvas and JavaScript. There are no frameworks and no build step.

## Run it

Open the folder in Cursor, then start any static server from the project root:

```
npx serve .            # or: python3 -m http.server 8000
```

Then open http://localhost:3000 (or :8000). Opening `index.html` directly also mostly works, but a server avoids browser file:// quirks. The Live Server extension in Cursor works well too.

## Project layout

```
index.html            page shell: canvas, fonts, loads the two scripts
js/meta.js            GENERATED: sprite sizes (META) and Teddy rig pivots (RIG)
js/game.js            all game code
assets/*.webp         game-ready sprites and sprite sheets
tools/rig.py          cuts Teddy's art into rig pieces (legs, body, arm, shield, cape)
tools/build_assets.py rebuilds assets/ and js/meta.js from the original pack
tools/source/         the Teddy images you provided (hero + turnaround)
```

## Where to tweak things in js/game.js

Line numbers are approximate. Use Cursor's symbol search (Ctrl/Cmd+Shift+O) to jump to each name.

| What | Look for |
|---|---|
| Jump height, gravity, run speed, double jump | `const GRAV, RUN, JV, DJV` (~line 880) |
| Level layouts (ground, platforms, enemies, crystals, runes, dog, cave, signs) | `const LEVELS` (~line 416) |
| Enemy stats (HP, speed, size) | `function makeFoe` |
| Enemy behaviour (patrol, hop, thorn spitting) | `function updateFoes` |
| Player moves, attack hitbox, pickups, checkpoint, portal | `function updatePlayer` |
| Blocking and damage rules | `function hurtPlayer` |
| Teddy's animation poses (walk, jump, swing, block) | `function drawTeddy` |
| Background trees, rocks and fences placement | `function buildDecor` |
| HUD (health bar, counters, runes) | `function drawHUD` |
| Keyboard bindings | `const KEYMAP` |
| Touch button layout | `const TB` |
| Sound effects and music | `const SFX`, `musicTick` |
| Menu, pause, level complete and victory screens | `function loop` (state branches) |

### Level data format

- `ground: [[x0, x1, topY], ...]`: solid ground from x0 to x1. Gaps between segments are pits.
- `plats: [[x, y, width], ...]`: floating platforms you can jump up through.
- `foes: [['walk'|'hop'|'big', x], ...]`
- `runes`, `crystals`, `bones`, `big`: `[x, y]` positions.
- `dog`: checkpoint x. `cave`: exit x.

The screen is 1280×720 and the ground usually sits at y = 600. A single jump rises about 145 px and a double jump about 255 px. A double jump clears gaps of about 320 px.

## Rebuilding assets (optional)

You only need this to change how pack images are cropped or scaled, or to redraw the thorn critters. It needs Python 3 with `pip install pillow numpy opencv-python`.

1. Put the original `2D Stylized Adventure Game Asset Pack` folder **next to** this project folder.
2. `python3 tools/rig.py` re-cuts Teddy into rig pieces (writes `tools/rig/`).
3. `python3 tools/build_assets.py` rewrites `assets/` and `js/meta.js`.

You can also drop a new image straight into `assets/` as .webp. Add its name and `[width, height]` to `META` in `js/meta.js`, and it's available as `img('name', x, y, scale)`.

## Save data

Settings and the "Load Game" progress are stored in the browser's localStorage under the keys `teddy_settings` and `teddy_save`.
