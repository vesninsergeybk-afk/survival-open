# Jarusca — Asteroids Pack (2D), diffuse spritesheet

- **Artist:** Jarusca
- **Original publication:** 2020-08-19
- **Source:** https://opengameart.org/content/asteroids-pack-2d-diffuse-normal-seamless-animations
- **Original download:** https://opengameart.org/sites/default/files/asteroids_spritesheet_diffuse.png
- **License:** Creative Commons CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- **Local asset:** `jarusca-asteroids-diffuse.png`, original diffuse-only sprite sheet (not modified)
- **Layout verified from the original file:** 1725 × 675 RGBA; 23 columns × 9 rows; each frame 75 × 75 pixels
- **Source archive size:** approximately 923 KB

The pack provides nine distinct asteroid meshes, each with 23 smoothly looping views of rotation. We do not need the separate normal-map sheet in the existing 2D Canvas renderer.

Rendering implementation: `arcade/animated-asteroids.js`. One atlas is loaded asynchronously only when animation is enabled, never one image per asteroid. Animated rocks are selected by a deterministic hash of their original position. The visual animation does not change rock collision radii, rotational physics, ore yields, object IDs, saved data or gameplay RNG. Rich ores retain their existing colored artwork. URL `?asteroids=off` disables the new sprite sheet; systems honoring reduced motion use previous static assets.

CC0 permits using and adapting this asset without attribution. We nevertheless retain credit and the original download link for provenance.
