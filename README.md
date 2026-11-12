# Fold

A gradient and fold generator that runs on the GPU (WebGL2). Build soft light fields from layers and light splines, run them through fluted glass, folds, pleats or tiles, stack effects like bloom and halation on top, and export.

Try it: https://alexander-288.github.io/fold/

## Run

No build step. Serve the folder and open it:

```
python -m http.server 8291
```

Then go to http://localhost:8291

## What's in it

- **Layers** (up to 8): blob, ring, spectrum band, linear, conic, noise cloud, light spline, image, text. Blend modes: normal, add, screen, multiply. Every layer takes a colour ramp with up to 8 stops.
- **Light spline**: draw a curve with the pen and it glows as a neon tube, a light-painting stroke or a silk ribbon. Taper, glow, and a pulse that travels along it.
- **Image and text**: drop in a photo or logo, or type text, and run it through the glass. Up to 4 per design.
- **Scene**: background, flowing warp, seamless loop with flow and drift.
- **Fold**: fluted glass, sliding folds, accordion, wave, glass tiles. Refraction, shading, highlight, chroma split, smear.
- **Effects stack**: adjust, colour grade, gradient map, bloom, halation, lens, blur / tilt-shift, vignette, halftone, grain. Turn each on or off and drag to reorder.
- **Frame**: aspect presets or a custom ratio, crop by zooming and panning the canvas.
- **Export**: PNG / JPG / WebP up to the GPU's max size, MP4 loop rendered frame by frame (WebCodecs, real-time WebM fallback), a wallpaper pack ZIP for phone and desktop sizes, Shadertoy code, WebGL2 GLSL, a standalone HTML page, a CSS fallback, and `.fold.json` presets (with images) or a share link.
- **My presets**: save designs with thumbnails, star and rename them.

## Shortcuts

- `V` select, `H` pan (or hold Space), `L` light pen (Enter finishes), `T` text, scroll to zoom the crop, `0` reset crop
- `P` play / pause, `R` shuffle
- Arrow keys nudge the selected layer (Shift for more), `[` `]` switch layers
- `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo, `Ctrl+D` duplicate, `Del` delete
- `Ctrl+E` export image, `Ctrl+S` save preset

On canvas: drag the centre to move, the square to set size and angle (Shift keeps the angle), the circle to set height. Alt keeps it round.

## Files

- `js/shaders.js` – GLSL, shared by the editor and the code export
- `js/engine.js` – WebGL2 renderer (field pass, fold pass, then the effects stack ping-ponging between float textures)
- `js/assets.js` – imported images, kept in IndexedDB
- `js/state.js` – defaults, presets, shuffle
- `js/export.js` – image, video, wallpaper ZIP and code export
- `js/vendor/mp4-muxer.mjs` – MP4 muxer by Vanilagy (MIT)
- `js/ui.js` – controls
- `js/main.js` – the editor

Fonts: Schibsted Grotesk and Fragment Mono (OFL), see `fonts/OFL.txt`. Logo and icons are in `assets/`.

## License

Copyright (C) 2026 Aleksander Sprengel. Licensed under the GNU Affero General Public License v3.0, see `LICENSE`.
