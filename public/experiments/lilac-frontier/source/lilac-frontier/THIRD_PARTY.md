# Third-party code

Three.js 0.172.0: MIT. Vite: MIT. SHPanel files copied byte-for-byte from the saved Creative Code Index infrastructure, with their SHA-256 values recorded in the handoff evidence.

`src/blender-noise.glsl` adapts the 3D subset of Blender 5.0.1's shader noise library, copyright 2019–2023 Blender Authors, GPL-2.0-or-later. Original sources:

- https://github.com/blender/blender/blob/v5.0.1/source/blender/gpu/shaders/common/gpu_shader_common_hash.glsl
- https://github.com/blender/blender/blob/v5.0.1/source/blender/gpu/shaders/material/gpu_shader_material_noise.glsl
- https://github.com/blender/blender/blob/v5.0.1/source/blender/gpu/shaders/material/gpu_shader_material_fractal_noise.glsl

This shader-based adaptation is supplied with source; redistribution must retain the applicable GPL terms. The published build includes editable modules under `source/lilac-frontier/src/`, build inputs under `source/lilac-frontier/`, and the unchanged panel under `source/infrastructure/sh-panel/`. License texts are served under `licenses/`. No source image is used as a runtime texture.
