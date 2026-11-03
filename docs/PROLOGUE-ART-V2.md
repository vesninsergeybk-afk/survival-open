# Mission 00 — «Последний сигнал»: environment and gameplay art direction v2

Status: **in-progress production specification**, 29 Oct 2026. The current implementation has seven primary rooms plus three **playable, mandatory secondary areas** and 51 station-model placements (29 fleet/22 modular Quaternius). The level is **not** art-complete or a final demo.

## Non-negotiable integration

- Mission 00 is a regular campaign mission. Same core Game, Player, ship appearance/progression, Enemy, Weapon, FriendlyBases, HUD, controls, save and victory.
- The shared 2.5D/3D ship renderer being developed in parallel is the only authoritative appearance for the player in every mission. Avoid importing a prologue-only hero sprite or independent ship camera.
- Player starts in a damaged dock with **no weapon equipped**. The green engineering repair action (Space / mobile repair button) powers the first generator and restores the broken command terminal. The workshop installs the shared STARTER_PULSE as the first weak gun. Repairs of the allied bases and reactor follow the shared costs and effects; this is one campaign engine.
- Preserve existing mission 1–4 and mobile UI changes. New station assets should load lazily by sector and run on the same renderer.
- Story progression is linear and legible; no labyrinths. Small side galleries can enrich a sector but always rejoin the main spine.

## Larger station route — seven core sectors plus three playable wings (first expanded build)

| Zone | Distinctive environment | Gameplay beat using the common engine |
| --- | --- | --- |
| 00. Derelict dry dock | Torn pressure bulkheads, gantries, ship cradle, sparks, deep ship shadows, distant open starfield | Damaged ship; movement, interact and engineering-beam tutorial; restore auxiliary power |
| 01. Power trunk / airlock | Huge capacitor drums, layered cabling, sequential emergency lighting, heavy hydraulic iris | Redirect power, clear a collapsed route, operate an actual moving hatch |
| 02. Observation gallery | Multi-bay panoramic glazing, NASA-based stellar disk, nebula parallax, rotating solar features, cast mullion shadows | Visual reveal, navigation landmark and environmental storytelling, with no window collision |
| 03. Security junction | Elevated armored sentry emplacements, visor lights, camera track, damage decals | Restore two actual FriendlyBases turret batteries; survive patrol and reinforcements |
| 04. Engineering workshop | Engine test stand, hanging robotic arms, repair platform, weapon lockers, active consoles | Fit the first weak starter weapon, try upgrades and defense against intruders |
| 05. Foundry / fabrication arena | Tall refinery machinery, conveyor loops, coolant haze, orange key/fill lighting | Shut down two stabilizers, use cover/physics, survive combat waves |
| 06. Habitation and maintenance crosswalk | Observation niches, emergency shelters, broken service equipment, hints of the abandoned crew | Short optional environmental findings and resource recovery; no blocking detour |
| 07. Command and communications | Large multilevel holographic chamber, data screens, central projector, security shutters | Decode «Оплот», unlock route, fight through responding defenders |
| 08. Reactor defense nexus | Massive energy core, heavy orbital cannon plinths, animated shields and beams | Restore two true base systems, use shared technology tree, defend core in several escalation phases |
| 09. Evacuation / launch approach | Wide hangar doors, coolant vents, departing traffic outside, flashing alarm line | Hold position to transmit, final assault, complete common mission victory and continue to Mission 01 |

In the first expanded feature build, observation is connected to security by a northern causeway, cooling is below the workshop, and the reserve capacitor is below the core. All three require interactions and spawn defenders; the remaining conceptual subrooms are future art-production work. This is a 10-playable-area station, not yet ten fully art-directed distinct macro scenes.

Treat these as art-directed *macro rooms* with subspaces, props, height layers and clear silhouettes. Macro zones are not ten equally sized rectangles; vary size, camera composition, ceilings and openness. Keep each gameplay area linked by collision geometry and believable mechanical doors.

## Visual hierarchy and scene rules

1. **Authoritative models**: use the 80 already-committed GLB spaceship modules from the parallel branch. Check ship silhouettes between the prologue, endless and campaigns after merge. Use the already-committed shared Interstellar Fleet GLB implementation; never manufacture a prologue-only hero model.
2. **Station architecture**: use Quaternius Modular Sci-Fi Megakit (270+ CC0 mesh pieces) as a consistent high-detail structural vocabulary: modular floors, layered wall plates, windows, columns, shutters, machinery. Five CC0 Standard models (access panel, computer, crate, door frame, vent) are **now staged under** `assets/3d/interior/` with embedded mesh buffers and local licensing. Remaining architecture is a candidate. Existing `site/games/uzel7/assets/env/` and `site/games/station-zero/assets/quaternius/` provide source-compatible interior references.
3. **Machines, actors, animations**: Quaternius Sci-Fi Essentials (60+ meshes including animated robot enemies/screens and weapons, CC0) is an asset candidate. Actual turret tracking and recoil are provided by the shared FriendlyBases / Hybrid3D pipeline with 19159/19160 meshes. Continue to refine head pivots and firing animation during visual QA.
4. **Star**: use NASA/SDO AIA 304 solar disk as a **real scientific surface image**. This is a false-color ultraviolet visualization, not an ordinary RGB photograph. Its details and limb features replace synthetic spots. The V2 display is a layered 2D preview with existing `nebula_main.jpg`, mild rotational drift, glazing, frames and lighting; production target is the 3D shared scene renderer's sun sphere and shader.
5. **Light**: star direction is physically consistent across all galleries. Window bars cast shadows into the room; danger alarms and reactor light have separate colors and changing intensities.
6. **Never downgrade**: no untextured primitives or flat debug polygons at shipping fidelity. During loading, show quality-controlled pre-rendered scene art or keep the prior completed scene, not crude blocks.

## Assets and licenses verified at source

- NASA/SDO AIA 304 image (SDO assets, 29 Oct 2026): `assets/space/sdo-sun-304.webp`; source `https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0304.jpg`. NASA/SDO indicates images and movies are not copyrighted unless noted. Credit requested: **Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams**. `https://sdo.gsfc.nasa.gov/gallery/copyright/`
- Quaternius Modular Sci-Fi Megakit, CC0: `https://quaternius.com/packs/modularscifimegakit`.
- Quaternius Sci-Fi Essentials, CC0, animated enemies/screens: `https://quaternius.itch.io/sci-fi-essentials-kit`.
- Quaternius Ultimate Space Kit, CC0, 92 spacecraft/planet pieces: `https://quaternius.com/packs/ultimatespacekit.html`.
- Solar System Scope 2K Sun equirectangular map: `https://play.solarsystemscope.com/textures/`; license attribution should be re-confirmed at the official terms before importing the map. A native NASA scene material is preferred if it meets visual quality.

## Definition of done

- All ten macro-zones have curated authored models/materials and landmark compositions; no blank patterned corridors.
- Real model animation, lighting, texture loading and sound pass on desktop and landscape Android.
- Shared engineering repair, workshop ion-weapon acquisition, mandatory wing objectives and mission rewards tested without changing shared combat APIs.
- Enemy navigation cannot soft-lock at any shutter; every checkpoint can reach the next and survive reload/retry.
- Visual review includes at least one screenshot per zone, two window states, active/base off states, hangar wide shot, and same exact hero model in two modes.
- Local scripted unit tests and real browser playthrough both pass. Do not call this version art-complete until the visual check is done.

## Integration coordination

The **80 Interstellar Fleet GLB models are now confirmed** in the production tree under `site/games/survivor/assets/3d/`. The common renderer is `src/hybrid-3d.js`; `assets/3d/manifest.json` names all 80 objects and their CC0 source. The existing 3D ship is the shared model and is used by Mission 00. Mission-specific scenery currently places **51 prop instances** drawn from the already-existing ids 19191/19192 (dock), 19194 (defense), 19193 (fuel depot), 19189 (reactor), 19178 (communications), 19180 (escape pods) and other station objects via the same renderer. These are visual scene props, not separate collision/gameplay engines. Stage this work in a feature branch for visual QA before release.

## Quaternius reuse in current branch

The five embedded-buffer glTFs used here come from the already-vetted `station-zero` Standard/CC0 set. They are copied into `site/games/survivor/assets/3d/interior/` with its `LICENSE_Standard.txt`, so the Survivor package is self-contained. The hybrid renderer loads only visible sectors and keeps their rigs cached; it has a Canvas2D fallback. Models remain non-colliding scenery; functional shutters and interaction points retain original rules.

## Story/ship fidelity correction (29 Oct 2026)

The original authorial pitch explicitly requires a defenseless engineering craft at mission start, a repair-beam generator, stealth/security turrets, first weapon only after the workshop, broken central computer, backup defense upload, heavy towers powering up at 100%, and evacuation. The shared 3D player hull remains 19151 at all tiers, with bolt-on parts, animated thrusters and AI-triggered rolls. See `PROLOGUE-STORY-V3.md` for the current gameplay contract. Visual review remains pending.


## Artistic pass 3 — live star and inhabited architecture (29 Oct 2026)

The observation star is a major navigational and emotional set-piece. It appears
through two windows of **the same station mission**: Helios at world offsets
(1250, -1260), 650×220, and the command-gallery window at (4875, -412),
610×240. Both render one shared solar rotation phase.

- New reusable \`src/stellar-window-3d.js\` draws each window in the **same
  transparent Three.js world overlay** as all ships. The view has a ray-mapped
  spherical photosphere, convecting granulation, limb falloff, turbulent corona,
  prominences, deep-space texture and fine starfield. The shader samples the
  already-packaged NASA/SDO AIA 304 false-colour surface image. It is a
  visualization of plasma emission, not an optical true-colour Sun.
- Windows have volumetric 3D steel framing, structural posts, metallic
  edge highlights, blinking maintenance lamps, glass gleam, and a localized
  warm point light that falls on the real 3D ships and machinery.
- The original 2D Canvas art remains as a **fallback** for WebGL-disabled
  environments. It now includes much broader multi-bay sunlight shafts,
  warm floor pools, strong dark mullion shadows and moving dust particles.
- Architecture now includes raised wall profiles, inset grilles, cables,
  bolt heads, alive/dead light strips, and a specialized animation palette:
  broken-dock sparks, security scanner, workshop manipulator tests, foundry
  coolant channels, defense pulsations, Helios tracking rings, refrigeration
  steam and evacuation guidance lamps. Nonessential animations are culled
  by the player's sector and never affect gameplay collision.
- Existing Quaternius and Interstellar Fleet 3D props gain powered-state
  movement (sensor scanning, telescope rotation, gantry motion, ventilator
  movement) after the corresponding mission systems have been repaired.
  The derelict is dark and still at first.
- Both visible "start prologue" links on the Survivor home page now open
  \`?mission=0\`, starting the **unified campaign's Mission 00**.
  The legacy separate \`/prologue/\` demo is retained only as an archive.

**Source / attribution:** NASA/SDO solar disk and NASA AIA/EVE/HMI science
teams; \`https://sdo.gsfc.nasa.gov/data/rules.php\`. Nebula imagery and
Quaternius/Interstellar packs stay as already recorded in the asset manifest.

**QA gate before calling the art finished:** test the Sun in actual desktop
WebGL and Android landscape; inspect the front/back positioning of 3D panes,
window glass and player, contrast for moving targets in Helios and Command,
frame rate, fallback Canvas 2D, and upload-into-siege transitions.
