/**
 * Space Shooter Remastered (Kenney) + CC0 space backgrounds (OpenGameArt).
 * All images are optional; offline vector fallback remains playable.
 */
const files = {
    shipFighter: '../assets/space/ship_fighter.png',
    shipMage: '../assets/space/ship_mage.png',
    shipScout: '../assets/space/ship_scout.png',
    drone: '../assets/space/enemy_drone.png',
    fighter: '../assets/space/enemy_fighter.png',
    interceptor: '../assets/space/enemy_interceptor.png',
    shield: '../assets/space/enemy_shield.png',
    bomber: '../assets/space/enemy_bomber.png',
    swarm: '../assets/space/enemy_swarm.png',
    caster: '../assets/space/enemy_caster.png',
    bossCarrier: '../assets/space/boss_carrier.png',
    bossDreadnought: '../assets/space/boss_dreadnought.png',
    bossCruiser: '../assets/space/boss_cruiser.png',
    meteor1: '../assets/space/meteor_1.png',
    meteor2: '../assets/space/meteor_2.png',
    meteor3: '../assets/space/meteor_3.png',
    meteorBrown1: '../assets/upgrade/asteroids/meteorBrown_big1.png',
    meteorBrown2: '../assets/upgrade/asteroids/meteorBrown_big2.png',
    meteorBrown3: '../assets/upgrade/asteroids/meteorBrown_big3.png',
    meteorBrown4: '../assets/upgrade/asteroids/meteorBrown_big4.png',
    meteorGrey1: '../assets/upgrade/asteroids/meteorGrey_big1.png',
    meteorGrey2: '../assets/upgrade/asteroids/meteorGrey_big2.png',
    meteorGrey3: '../assets/upgrade/asteroids/meteorGrey_big3.png',
    meteorGrey4: '../assets/upgrade/asteroids/meteorGrey_big4.png',
    ufoBlue: '../assets/upgrade/ships/ufoBlue.png',
    ufoGreen: '../assets/upgrade/ships/ufoGreen.png',
    ufoRed: '../assets/upgrade/ships/ufoRed.png',
    nebula: '../assets/space/nebula_main.jpg',
    starfield: '../assets/space/starfield.png'
};

export const atlas = Object.create(null);
const listeners = new Set();
for (const [key, file] of Object.entries(files)) {
    atlas[key] = null;
    if (typeof Image === 'undefined') continue;
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
        if (!image.naturalWidth) return;
        atlas[key] = image;
        for (const listener of listeners) listener();
    };
    image.onerror = () => { /* The game keeps its original canvas art. */ };
    image.src = new URL(file, import.meta.url).href;
}

export function onAtlasChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
