# Lilac Frontier source

The editable browser modules are in `lilac-frontier/src/`; `lilac-frontier/THIRD_PARTY.md` identifies third-party code and its original sources. The Blender-derived noise shader retains its GPL-2.0-or-later notice. License texts accompany the scene at `../licenses/`.

To rebuild, retain this directory structure, including `infrastructure/sh-panel/`, and download the files in `lilac-frontier/` and `lilac-frontier/src/`. Copy the scene's `../assets/scene.json` and `../assets/geometry.bin.gz` into `lilac-frontier/public/assets/`. Copy this README and the accompanying license texts into the same public layout. From `lilac-frontier`, run `npm ci` followed by `npm run build`. This produces a self-contained `dist/` directory. Node.js 24 was used for the published build.

The geometry files are already served with this release; the original Blender project and private verification artifacts are not needed to build the browser application.
