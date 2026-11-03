# Kenney Robot Pack — licensed station robots

Author: Kenney Vleugels (Kenney).
Source: https://kenney.nl/assets/robot-pack
License: CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
Preserved source mirror: https://github.com/Tiddybub/2d-assets/tree/main/sci-fi/robot-pack

## Included original atlases

- kenney-robots-top.png — original Spritesheet/spritesheet_robotsTop.png, blob 725211d708be4db220445bad78e00677cf09e521.
- kenney-robots-side.png — original Spritesheet/spritesheet_robotsSide.png, blob 3af12342e15bbec64511f278ba719e2e5ef42989.

Source archive also contains License.txt and XML atlas maps. No paid assets.

## Rendering

The 2D prologue uses the Kenney top-view chassis for the patrol spider, maintenance unit,
and armored sentinel. Articulated mechanical legs, tread marks, aiming, hit flashes and muzzle
effects are Canvas2D layers. Falling death uses the source side-view Hurt/Damage frames.
Instances share exactly two local images. Draw states use no WebGL even in the 3D graphics mode.
All Enemy positions, collisions, weapons, abilities, drops, and campaign victory are unchanged.
Robot wrecks are capped at 12 and removed after 0.85 seconds.