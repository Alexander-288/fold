# Fold

A gradient and fold generator that runs on the GPU (WebGL2). Build soft light fields from layers, run them through fluted glass, folds, pleats or tiles, finish with grain or halftone, and export.

Try it: https://alexander-288.github.io/fold/

## Run

No build step. Serve the folder and open it:

```
python -m http.server 8291
```

Then go to http://localhost:8291

## What's in it

- **Layers** (up to 8): blob, ring, spectrum band, linear, conic, noise cloud. Blend modes: normal, add, screen, multiply.
- **Scene**: background, flowing warp, seamless loop with flow and drift.
- **Fold**: fluted glass, sliding folds, accordion, wave, glass tiles. Refraction, shading, highlight, chroma split, smear.
- **Finish**: exposure, contrast, saturation, hue, vignette, film grain, halftone (dots, grid, lines, dither).
- **Frame**: aspect presets or a custom ratio, crop by zooming and panning the canvas.
- **Export**: PNG / JPG / WebP up to the GPU's max size, MP4 or WebM loop, Shadertoy code, WebGL2 GLSL, a standalone HTML page, a CSS fallback, and `.fold.json` presets or a share link.

## Shortcuts

- `V` select, `H` pan (or hold Space), scroll to zoom the crop, `0` reset crop
- `P` play / pause, `R` shuffle
- Arrow keys nudge the selected layer (Shift for more), `[` `]` switch layers
- `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo, `Ctrl+D` duplicate, `Del` delete
- `Ctrl+E` export image, `Ctrl+S` save preset

On canvas: drag the centre to move, the square to set size and angle (Shift keeps the angle), the circle to set height. Alt keeps it round.

## Files

- `js/shaders.js` – GLSL, shared by the editor and the code export
- `js/engine.js` – WebGL2 renderer (field pass into a float texture, then fold and finish pass)
- `js/state.js` – defaults, presets, shuffle
- `js/export.js` – image, video and code export
- `js/ui.js` – controls
- `js/main.js` – the editor

Fonts: Instrument Sans and Fragment Mono (OFL), see `fonts/OFL.txt`. Logo and icons are in `assets/`.

## License

Copyright (C) 2026 Aleksander Sprengel. Licensed under the GNU Affero General Public License v3.0, see `LICENSE`.
