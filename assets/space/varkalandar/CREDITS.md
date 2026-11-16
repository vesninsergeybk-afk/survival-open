# Asteroid landscape art — Varkalandar / Hansjörg Malthaner

**Original asset:** [24 bigger asteroids](https://opengameart.org/content/24-bigger-asteroids)

**Creator:** Hansjörg Malthaner (Varkalandar); [author page](https://opengameart.org/users/varkalandar).

**License option used:** [Creative Commons Attribution 3.0 Unported (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/). The original OpenGameArt page offers CC BY 3.0, CC BY-SA 3.0, and OGA-BY 3.0 as alternative licenses. We specifically use **CC BY 3.0**, which permits commercial redistribution and adaptation subject to attribution.

**Original files selected:** `hjm-random_planetoids-2.png`, `hjm-random_planetoids-3.png`, `hjm-random_planetoids-4.png`. The original image archive contains 24 variants; these three sheets contain six variants each.

**Changes in Survivor, 16 November 2026:** Selected 18 of the 24 available asteroid variants. Extracted the individual rock images from their diagonal source layouts, cropped transparent frames, resized and re-centered consistently, and repacked each set of 12 rotations into a compact grid of 96×96 frames. The resulting PNG is `varkalandar-18x12.png` (1152×1728). The game plays those original rotational views with optional bounded frame-to-frame blending. No new 3D rendering pipeline is used.

This credit is also available in the game's **«Авторы и лицензии»** dialog. The author does not endorse or participate in the Survivor project.

To reproduce the derived atlas, download those three original sheets from OpenGameArt to this directory and run `python arcade/tools/build-varka-atlas.py` after installing `pillow numpy scipy`. The builder is for development only; the browser needs only the resulting PNG.

Copyright in the artwork remains with the original creator. The CC BY 3.0 conditions continue to apply to the adapted asteroid sprites.
