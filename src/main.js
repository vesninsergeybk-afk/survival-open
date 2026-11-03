/**
 * @module main
 * @description Top-level orchestrator. Owns the `Game` instance, the
 * fixed-step update loop, the spawn/wave director, the achievement check
 * heartbeat and the menu/state machine. This is the only module that
 * reaches into nearly every other one — keep new logic out of here when a
 * focused module fits.
 *
 * Dependencies: every other module under `src/`.
 *
 * Exports:
 *   - class Game
 *   - boot()              constructor + window-handle install
 *   - re-exports ACHIEVEMENTS, WAVES from data.js
 */

import { simulationSlices } from './frame-clock.js?v=runtime-124';
import { FrameDiagnostics } from './frame-diagnostics.js?v=room-cache-130';
import { RenderBudget, inCamera } from './render-budget.js?v=runtime-124';
import { HeroSharpLayer } from './hero-sharp-layer.js?v=hero-sharp-132';
import { CONFIG, Difficulty, GameState } from './config.js?v=base-87';
import { planSurvivorViewport } from './mobile-layout.js?v=mobile-970';
import { ACHIEVEMENTS, BOSSES, ENEMIES, WAVES, WEAPONS } from './data.js?v=tactics-106';
import {
    Enemy,
    EnemyProjectile,
    ExpOrb,
    FloatingText,
    Particle,
    Player,
    findEnemyDef,
    registerWeaponClass
} from './entities.js?v=hero-sharp-132';
import { Weapon } from './weapons.js?v=design-127';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js?v=mobile-960';
import { HapticEngine } from './haptics.js';
import { loadKeymap, saveKeymap } from './keymap.js';
import { UI } from './ui.js?v=design-127';
import { FpsMeter, ShakeCamera } from './systems.js';
import { SpatialHash } from './spatial-hash.js';
import { Pool, resetFloatingText, resetParticle } from './pool.js';
import { EffectLayer } from './effects.js?v=space-4';
import { WorldVFX } from './world-vfx.js?v=perf-981';
import { SpaceArt } from './space-art.js?v=runtime-124';
import { createWorldObstacles, updateWorldObstacles, nudgeWorldObstaclesFromShip,
    resolveWorldObstacles, renderWorldObstacles, damageWorldObstacles } from './world-obstacles.js?v=webp-106';
import { GalaxyMap } from './galaxy-map.js?v=qa-103';
import { CombatDirector } from './combat-director.js?v=base-87';
import { WaveDirector } from './wave-director.js?v=base-87-audit2';
import { EnemyIntelligence } from './enemy-intelligence.js?v=visual-signals-110';
import { renderCombatSignals } from './combat-signals.js?v=visual-signals-110';
import { eligibleEnemyPool, NORMAL_BOSS_RECOVERY_SECONDS } from './enemy-fleet.js?v=fleet-104';
import { spawnTemporaryBoost, resetFieldFinds, updateFieldFinds,
    updateTemporaryBoostPickups, renderTemporaryBoostPickups } from './temporary-boosts.js?v=space-7';
import { createWorldCaches, updateWorldCaches, renderWorldCaches } from './world-caches.js?v=base-87-audit2';
import { FriendlyBases } from './friendly-bases.js?v=design-127';
import { BaseDockUI } from './base-dock-ui.js?v=audio-91';
import { getEnemySprite } from './sprite-art.js?v=motion-103';
import { drawAnimatedEnemyShip } from './disruptor-ship-sprites.js';
import { drawBossDetails } from './boss-visuals.js?v=visual-95';
import { AchievementTracker } from './achievements.js';
import {
    SeededRng,
    accumulateTotals,
    getTouchButtonScale,
    loadSave,
    loadSpeedrunScores,
    recordHighScore,
    recordSpeedrunScore,
    resetSave,
    saveSave
} from './storage.js';
import { setLocale, t as _t } from './i18n.js';
import { calculatePoints, recordSurvivorRun } from './records.js';
import {
    DEFAULT_STAGE_ID,
    getBackgroundFor,
    getBossesFor,
    getStageModifiers,
    getStage,
    getWavesFor,
    pickWeighted
} from './stages.js?v=space-4';
import { dailyChallenge, saveDailyResult } from './daily.js';
import { createMissionRules, isMissionUnlocked, recordMissionVictory } from './mission-progression.js?v=design-127';
import { MissionWorld, stageForMission, hasDesignedMission, installMissionUI } from './mission-world.js?v=design-127';
import { skillChoice } from './skill-tree.js?v=design-127';
import { PrologueMissionWorld } from './prologue-mission.js?v=spac1-walk-134';
import { drawRepairBeam } from './beam-art.js?v=runtime-124';
import { getWeaponMastery } from './weapon-masteries.js?v=mastery-1';
import { TutorialState } from './tutorial.js';
import { ReplayPlayer, ReplayRecorder, loadReplay, saveReplay } from './replay.js';
import { KonamiDetector } from './konami.js';

registerWeaponClass(Weapon);

/** Two light-weight exhaust plumes reuse the existing enemy hull angle.
 * No extra particle entities or draw calls for ships beyond the camera. */
function drawEnemyThrusters(ctx, enemy, seconds, glow=true) {
    if (!enemy.speed || enemy.speed < 1 || enemy.hp <= 0) return;
    const size = Math.min(88, Math.max(10, enemy.size || 14));
    const flicker = .83 + .17*Math.sin(seconds*22 + enemy.x*.021 + enemy.y*.013);
    const length = size*(enemy.boss ? .82 : .59)*flicker;
    const color = enemy.boss || enemy.bomber ? '#ff9564' : '#60cafa';
    ctx.save();ctx.translate(enemy.x,enemy.y);
    ctx.rotate(enemy.visualAngle || 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = enemy.boss ? .82 : .65;
    ctx.fillStyle = color;ctx.shadowColor = color;ctx.shadowBlur = glow ? 9 : 0;
    for (const dx of [-size*.31,size*.31]) {
        ctx.beginPath();
        ctx.moveTo(dx-size*.13,size*.56);
        ctx.lineTo(dx,size*.56+length);
        ctx.lineTo(dx+size*.13,size*.56);
        ctx.closePath();ctx.fill();
    }
    ctx.restore();
}

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', {alpha:false});
        this.heroLayer = new HeroSharpLayer(this.canvas);
        this.diagnostics=new FrameDiagnostics(new URLSearchParams(location.search).get('profile')==='1');
        this.state = GameState.MENU;
        this.lastTime = 0;
        this.gameTime = 0;
        this.kills = 0;
        this.points = 0;
        this.personalRecord = null;
        this.raf = 0;

        // Collections
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];
        this.mines = [];

        this.player = null;

        // Systems
        this.spatial = new SpatialHash(CONFIG.SPATIAL_CELL_SIZE);
        this.camera = new ShakeCamera();
        this.fpsMeter = new FpsMeter();
        this.effects = new EffectLayer();
        this.worldArt = new SpaceArt();
        this.battleDirector = new CombatDirector();
        this.waveDirector = new WaveDirector();
        this.enemyIntelligence = new EnemyIntelligence();
        this.friendlyBases = new FriendlyBases();
        this.galaxyMap = new GalaxyMap();
        this.galaxyMap.onClose = () => this.closeGalaxyMap();
        this.beams = [];
        this.combatBursts = [];
        this.worldCaches = [];
        this.worldObstacles = [];
        this.boostPickups = [];

        // Object pools for the churny entities. `prealloc` avoids the
        // first-level burst triggering an allocation cascade.
        this.pools = {
            floatingText: new Pool(() => new FloatingText('', 0, 0, '#fff'), resetFloatingText, {
                maxSize: 256,
                prealloc: 32
            }),
            particle: new Pool(() => new Particle(0, 0, '#fff'), resetParticle, {
                maxSize: 512,
                prealloc: 64
            })
        };

        // Tab-visibility aware pause so resuming doesn't produce a huge dt.
        this._hiddenPaused = false;
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => this._onVisibilityChange());
        }

        // Save + settings
        this.save = loadSave();
        const renderQuery=new URLSearchParams(window.location?.search||'').get('render');
        let renderMode=this.save.settings.graphicsMode||'auto';
        if(renderQuery==='2d'||renderQuery==='3d')renderMode=renderQuery;
        this.frameBudget=new RenderBudget({mode:renderMode,devicePixelRatio:window.devicePixelRatio||1});
        this.worldVfx = new WorldVFX(this.save.settings);
        this.save.settings.locale = 'ru';
        setLocale('ru');
        if (this.save.settings.colorblind) document.body.classList.add('cb-mode');

        // Audio + input + UI
        this.audio = new AudioEngine(this.save.settings);
        this.input = new InputManager();
        // iter-19: haptic feedback engine. Reads the live save.settings ref
        // so toggling the Settings checkbox takes effect on the next event.
        this.haptics = new HapticEngine(this.save.settings);
        // iter-19: load custom keymap (or fall back to default WASD + arrows
        // + Esc/P + H/? + M) and hand it to the input manager. Persisted
        // changes from previous sessions are picked up here.
        this.keymap = loadKeymap();
        this.input.setKeymap(this.keymap);
        this.ui = new UI(this);
        this.baseDockUI = new BaseDockUI(this);
        this.ui.onLocaleChanged();

        // Achievements tracker persists the lifetime record.
        this.achievements = new AchievementTracker(this.save);

        this._bossesSpawned = new Set();
        this._spawnAccumulator = 0;
        this._bossWarnedAt = new Set();
        this._bossReadyAt = new Map();
        this._lastBossSpawnAt = -Infinity;
        this._lastAnnouncedWave = null;

        // Active stage descriptor + per-stage waves/bosses snapshot. Keyed off
        // the persisted setting so a returning player resumes on whatever map
        // they last picked. Re-derived in start() so a stage swap mid-session
        // takes effect on the next run.
        this.stageId = this.save?.settings?.stage || DEFAULT_STAGE_ID;
        this.activeMission = null;
        this.missionWorld = null;
        this._requestedMissionIndex = null;
        this._missionRewarded = false;
        this.stageWaves = getWavesFor(this.stageId);
        this.stageBosses = getBossesFor(this.stageId);
        this.currentWave = this.stageWaves[0] || WAVES[0];

        // Speedrun bookkeeping. When `speedrunMode` is truthy, spawn picks
        // are deterministic, real-time splits are tracked and the result
        // lands in the speedrun leaderboard instead of the normal one.
        this.speedrunMode = false;
        this.speedrunRng = null;
        this.speedrunStart = 0;
        this.speedrunSplits = [];
        this._nextSplitIdx = 0;

        // Daily-challenge bookkeeping. When `dailyMode` is true the seed +
        // stage + boss schedule are pinned by `daily.dailyChallenge(...)`.
        this.dailyMode = false;
        this.dailyChallenge = null;

        // Per-run bookkeeping used by achievements.
        this.run = this.achievements.run;

        this._bindInput();
        this._bindDomButtons();
        installMissionUI(this);
        this._bindLeaderboardImport();
        this._bindGlobalHotkeys();
        // iter-20: Konami code detector. Active only on the main menu (state
        // === MENU); the listener is hot-installed but checks the state on
        // every push so it never interferes with gameplay input.
        this._bindKonamiCode();

        // iter-13: paint the Stage chip on the main menu so a returning
        // player sees which map their next Start Run would launch.
        this.ui.updateStageChip(this.stageId);
        this._updateStageHud();

        // iter-15: tutorial state machine + replay bookkeeping. Both are
        // inert until explicitly engaged by the player (via Try Tutorial /
        // Replay Last Run). Recorder is created on every run start in
        // `start()` and only persisted when the run ends; replay player is
        // only created on demand.
        this.tutorial = new TutorialState();
        this.replayRecorder = null;
        this.replayPlayer = null;
        this.replayActive = false;
        // Per-frame snapshot of move vector for the recorder (kept on the
        // game so other systems can also peek at the most recent input).
        this._lastMoveVec = { x: 0, y: 0 };
        // Cached tutorial banner element handle; assigned lazily on first
        // tutorial activation so we don't pay for it on returning players.
        this._tutorialBanner = null;

        // Mission 00 teaches the shared controls. Help and a separate training
        // flight stay available in the menu without stacking first-visit dialogs.

        // Apply any persisted mute on boot so a refresh keeps the choice.
        if (this.save.settings.muted) this.audio.setMuted(true);

        // iter-14: apply touch-button scale to CSS custom properties.
        this._applyTouchScale();
        // iter-14: PWA install prompt (one-shot per save). Listens for the
        // browser's `beforeinstallprompt` once; if it fires before the user
        // has dismissed it ever, we surface our own little banner.
        this._wirePwaPrompt();

        window.addEventListener('resize', () => this._resize());
        window.visualViewport?.addEventListener('resize', () => this._resize());
        document.addEventListener('fullscreenchange', () => this._resize());
        this._resize();
        // Give the menu an actual landscape before the first run starts.
        this.render(0);
    }

    /**
     * Bind global hotkeys that operate from the main menu *and* during
     * gameplay: M toggles mute, H (or ?) toggles the help overlay. Pause
     * already has its own binding via InputManager.onTogglePause.
     */
    _bindGlobalHotkeys() {
        // iter-19: M (mute) and H/? (help) are now dispatched by the input
        // layer through the customisable keymap. We keep the per-frame
        // suppression for INPUT/TEXTAREA targets as a capture-phase guard so
        // typing into the leaderboard import textarea doesn't pause/help.
        if (typeof window === 'undefined') return;
        window.addEventListener(
            'keydown',
            (e) => {
                const tag = (e.target && e.target.tagName) || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    // Stop the input-manager's default handler from firing
                    // for typed text. We do this rather than gating inside
                    // input.js so keymap remapping stays tiny.
                    e.stopPropagation();
                }
            },
            true
        );
    }

    /**
     * iter-20: install the Konami Code detector. Listens on the main menu
     * only — the gameplay input layer already owns arrows during a run, and
     * we don't want a stray cheat-code press during combat to flicker an
     * unlock toast. On a successful sequence we flip a per-run flag, run
     * the achievement check immediately, and surface a small announcement
     * via the existing live-region helper. The unlock weapon is wired
     * through UNLOCKS so the next Start Run gets it as a starter option.
     */
    _bindKonamiCode() {
        if (typeof window === 'undefined') return;
        this._konami = new KonamiDetector(() => this._onKonamiUnlocked());
        window.addEventListener('keydown', (e) => {
            if (this.state !== GameState.MENU) return;
            // Ignore when typing into the leaderboard import textarea etc.
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            this._konami.push(e.key);
        });
    }

    /** Konami sequence completed: flip the per-run flag and unlock the cheat. */
    _onKonamiUnlocked() {
        // `this.run` is aliased to `this.achievements.run` (see constructor +
        // start()), so setting the flag in one place is enough for the
        // achievement check to read it.
        if (this.run) this.run.konamiCode = true;
        try {
            this.achievements.check(this);
        } catch {
            /* swallow — boot-time miss is fine */
        }
        this._flushAchievementToasts?.();
        this._announce('Секретный код найден! Ретробластер открыт.');
    }

    /** Toggle a global mute and persist so a refresh keeps the choice. */
    toggleMute() {
        const next = !this.save.settings.muted;
        this.save.settings.muted = next;
        saveSave(this.save);
        this.audio.setMuted(next);
        this._announce(next ? 'Звук выключен' : 'Звук включён');
    }

    /** Open the help overlay; close it if it's already open. */
    toggleHelp() {
        const el = this.ui.els.helpScreen;
        if (el && el.style.display === 'flex') {
            this.ui.hideHelp();
        } else {
            this.ui.showHelp();
        }
    }

    /**
     * Listen for the `vs-leaderboard-import` CustomEvent that `UI.showLeaderboard`
     * dispatches when the user pastes JSON and clicks Import. We merge the
     * incoming runs into both the normal and speedrun stores, dedupe by
     * `date+timeSurvived` (or `date+timeMs` for speedrun), then re-rank and
     * persist. The UI is then refreshed if it's still on screen.
     */
    _bindLeaderboardImport() {
        if (typeof window === 'undefined') return;
        window.addEventListener('vs-leaderboard-import', (ev) => {
            const payload = ev.detail || {};
            try {
                if (Array.isArray(payload.normal)) {
                    const seen = new Set(
                        (this.save.highScores || []).map((r) => `${r.date}|${r.timeSurvived}`)
                    );
                    for (const r of payload.normal) {
                        const k = `${r.date}|${r.timeSurvived}`;
                        if (!seen.has(k)) {
                            recordHighScore(this.save, r);
                            seen.add(k);
                        }
                    }
                    saveSave(this.save);
                }
                if (Array.isArray(payload.speedrun)) {
                    const existing = loadSpeedrunScores();
                    const seen = new Set(existing.map((r) => `${r.date}|${r.timeMs}`));
                    for (const r of payload.speedrun) {
                        const k = `${r.date}|${r.timeMs}`;
                        if (!seen.has(k)) {
                            recordSpeedrunScore(r);
                            seen.add(k);
                        }
                    }
                }
                // Refresh the open leaderboard view if the dialog is still up.
                this.ui.showLeaderboard?.(
                    this.save.highScores || [],
                    loadSpeedrunScores(),
                    () => {}
                );
            } catch (err) {
                console.warn('[main] leaderboard import failed', err);
            }
        });
    }

    // --- Lifecycle --------------------------------------------------------
    _bindInput() {
        this.input.attach(window);
        this.input.onTogglePause = () => this.togglePause();
        // iter-19: help/mute actions are routed through the keymap rather
        // than the legacy global keydown listener. Both still default to
        // H/M but a remap takes effect immediately.
        this.input.onActionHelp = () => this.toggleHelp();
        this.input.onActionMute = () => this.toggleMute();
        this.input.onToggleMap = () => this.toggleMap();
        // Virtual joystick
        const joy = document.getElementById('joystickBase');
        const knob = document.getElementById('joystickKnob');
        if (joy && knob) this.input.attachJoystick(joy, knob);
        // Touch actions use labelled mission/base buttons. Pause stays on
        // the accessible top-right control, avoiding a misleading fake skill.
        // iter-14: gamepad confirm/cancel/menu wiring. We map A→togglePause
        // and B→togglePause as well for now (overlay UIs read DOM keystrokes
        // directly), but Start is the canonical pause toggle.
        this.input.onGamepadConfirm = () => {
            // Forward as a synthetic Enter keypress so existing menu close
            // handlers fire without each one having to know about gamepads.
            this._dispatchKey('Enter');
        };
        this.input.onGamepadCancel = () => {
            this._dispatchKey('Escape');
        };
        this.input.onGamepadCycleNext = () => this._dispatchKey('Tab');
        this.input.onGamepadCyclePrev = () => this._dispatchKey('Tab', { shiftKey: true });
    }

    /** Dispatch a synthetic keydown so DOM listeners react to gamepad nav. */
    _dispatchKey(key, opts = {}) {
        if (typeof window === 'undefined' || typeof KeyboardEvent === 'undefined') return;
        const ev = new KeyboardEvent('keydown', { key, bubbles: true, ...opts });
        (document.activeElement || document.body).dispatchEvent(ev);
    }

    /**
     * iter-14: write the touch-button scale to CSS custom properties on the
     * document root. Multiplies the base sizes (defined in styles.css under
     * `:root`) by the user's setting so the joystick + special button stay
     * proportional. No-op outside the browser (test env).
     */
    _applyTouchScale() {
        if (typeof document === 'undefined' || !document.documentElement) return;
        const scale = getTouchButtonScale(this.save);
        const base = 140;
        const knob = 58;
        const special = 96;
        const root = document.documentElement.style;
        root.setProperty('--touch-button-size', `${Math.round(base * scale)}px`);
        root.setProperty('--touch-knob-size', `${Math.round(knob * scale)}px`);
        root.setProperty('--touch-special-size', `${Math.round(special * scale)}px`);
    }

    /**
     * iter-14: install-prompt plumbing. Browsers fire `beforeinstallprompt`
     * once when the page meets the install criteria. We stash the deferred
     * event, surface a small in-page banner the first time, and remember the
     * user's choice (install / dismiss) so we never nag them again. We
     * intentionally avoid auto-prompting — Chrome ranks repeated prompts as
     * spam; the user has to click our button.
     */
    _wirePwaPrompt() {
        if (typeof window === 'undefined') return;
        if (this.save?.flags?.pwaPromptSeen) return;
        let deferred = null;
        const banner = document.getElementById('pwaInstallPrompt');
        const installBtn = document.getElementById('pwaInstallBtn');
        const dismissBtn = document.getElementById('pwaInstallDismiss');
        if (!banner || !installBtn || !dismissBtn) return;
        const markSeen = () => {
            this.save.flags = this.save.flags || {};
            this.save.flags.pwaPromptSeen = true;
            saveSave(this.save);
            banner.style.display = 'none';
        };
        window.addEventListener(
            'beforeinstallprompt',
            (e) => {
                e.preventDefault?.();
                deferred = e;
                banner.style.display = 'flex';
            },
            { once: true }
        );
        installBtn.addEventListener('click', async () => {
            if (deferred) {
                deferred.prompt?.();
                try {
                    await deferred.userChoice;
                } catch {
                    /* ignore */
                }
            }
            markSeen();
        });
        dismissBtn.addEventListener('click', markSeen);
    }

    _bindDomButtons() {
        const q = (id) => document.getElementById(id);
        q('dockAction')?.addEventListener('click', () => {
            if (this.missionWorld?.index!==0) this.openBaseDock();
        });
        q('btnMap')?.addEventListener('click', () => this.toggleMap());
        window.addEventListener('keydown', (event) => {
            if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
            if (['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName)) return;
            if (this.state === GameState.DOCK && event.key === 'Escape') {
                event.preventDefault();
                this.closeBaseDock();
            } else if (this.state === GameState.PLAYING &&
                (this.missionWorld?.index === 0 || this.missionWorld?.index === 1) &&
                (event.code==='Space' || event.code==='KeyQ')) {
                event.preventDefault();
                if(event.code==='Space'){
                    if(this.missionWorld?.index===0)this.missionWorld.beginRepairBeam(this);
                    else this.missionWorld.useRepairBeam(this);
                }
                else this.missionWorld.useStationStasis(this);
            } else if (this.state === GameState.PLAYING &&
                (event.key.toLowerCase() === 'e' || event.code === 'KeyE')) {
                if (this.missionWorld?.canInteract(this)) {
                    event.preventDefault();
                    this.missionWorld.interact(this);
                } else if (this.missionWorld?.index!==0 && this.friendlyBases.dockable(this)) {
                    event.preventDefault();
                    this.openBaseDock();
                }
            }
        });
        window.addEventListener('keyup',(event)=>{
            if(event.code==='Space')this.missionWorld?.endRepairBeam?.();
        });
        window.addEventListener('blur',()=>this.missionWorld?.endRepairBeam?.());
        q('btnStart')?.addEventListener('click', () => {
            this.audio.unlock();
            this.speedrunMode = false;
            this.dailyMode = false;
            this.start();
        });
        q('btnSpeedrun')?.addEventListener('click', () => {
            this.audio.unlock();
            this.startSpeedrun();
        });
        q('btnStage')?.addEventListener('click', () => this.openStagePicker());
        q('btnDaily')?.addEventListener('click', () => {
            this.audio.unlock();
            this.startDaily();
        });
        q('btnLeaderboard')?.addEventListener('click', () => this.openLeaderboard());
        q('btnSettings')?.addEventListener('click', () => this.openSettings());
        q('btnAchievements')?.addEventListener('click', () => this.openAchievements());
        q('btnViewStreak')?.addEventListener('click', () => this.openStreak());
        q('btnHowTo')?.addEventListener('click', () => this.openHowToPlay());
        // iter-15: replay-last-run + tutorial entry points on the start menu.
        q('btnReplay')?.addEventListener('click', () => this.openReplay());
        q('btnTutorial')?.addEventListener('click', () => this.startTutorialRun());
        q('btnRetry')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            if (this.dailyMode) this.startDaily();
            else if (this.speedrunMode) this.startSpeedrun();
            else if (this.activeMission) this.startMission(this.activeMission.index);
            else this.start();
        });
        q('btnMenu')?.addEventListener('click', () => {
            this.ui.hideGameOver();
            this._endTutorialIfActive();
            this.ui.showStart();
            this.state = GameState.MENU;
            this.missionWorld = null;
            this.missionLog?.hide();
            document.getElementById('prologueTransmission')?.remove();
            document.getElementById('missionObjectiveHud')?.style.setProperty('display','none');
            document.getElementById('missionAction')?.style.setProperty('display','none');
            this.speedrunMode = false;
        });
        q('btnResume')?.addEventListener('click', () => this.togglePause());
        q('btnViewSkills')?.addEventListener('click', () => this.openSkillTreePreview());
        q('btnQuit')?.addEventListener('click', () => {
            if (this.replayActive) { this._endReplay(); return; }
            this.state = GameState.MENU;
            this._endTutorialIfActive();
            this._skillPreviewOpen = false;
            this.ui.hideLevelUp();
            this.ui.hidePause();
            this.ui.showStart();
            this.missionWorld = null;
            this.missionLog?.hide();
            document.getElementById('prologueTransmission')?.remove();
            document.getElementById('missionObjectiveHud')?.style.setProperty('display','none');
            document.getElementById('missionAction')?.style.setProperty('display','none');
            cancelAnimationFrame(this.raf);
            this.audio.stopMusic();
        });
    }

    _updateStageHud() {
        const target = document.getElementById('stageHud');
        if (target) {
            const stage = getStage(this.stageId);
            target.textContent = this.activeMission ?
                '✦ МИССИЯ '+this.activeMission.index+' · '+this.activeMission.name :
                stage.icon + ' ' + stage.name;
        }
    }

    _resize() {
        const container = document.getElementById('gameContainer');
        if (!container) return;
        const touch = window.matchMedia?.('(any-pointer: coarse)').matches ||
            (typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 0);
        const plan = planSurvivorViewport({
            width: window.innerWidth,
            height: Math.round(window.visualViewport?.height || window.innerHeight),
            coarsePointer: touch,
            devicePixelRatio: this.frameBudget && this.frameBudget.mode!=='3d' && touch
                ? Math.min(1,window.devicePixelRatio||1) : window.devicePixelRatio
        });
        this.frameBudget?.setDevice(plan.mobile,window.devicePixelRatio||1);
        this._renderWidth=plan.cssWidth;this._renderHeight=plan.cssHeight;
        this._worldDirty=true;
        CONFIG.CANVAS_WIDTH = plan.logicalWidth;
        CONFIG.CANVAS_HEIGHT = plan.logicalHeight;
        container.style.width = `${plan.cssWidth}px`;
        container.style.height = `${plan.cssHeight}px`;
        if (this.canvas.width !== plan.backingWidth) this.canvas.width = plan.backingWidth;
        if (this.canvas.height !== plan.backingHeight) this.canvas.height = plan.backingHeight;
        this._canvasBaseWidth=plan.backingWidth;
        this._canvasBaseHeight=plan.backingHeight;
        // Canvas backing pixels and world units are decoupled. Rendering,
        // collisions and the camera continue to use logical world units.
        this.ctx?.setTransform?.(
            plan.backingWidth / plan.logicalWidth, 0, 0,
            plan.backingHeight / plan.logicalHeight, 0, 0
        );
        document.body.classList.toggle('survivor-touch-layout', plan.mobile);
        const portrait = plan.mobile && plan.cssHeight >= plan.cssWidth;
        document.body.classList.toggle('survivor-needs-landscape', portrait);
        const orientationNotice = document.getElementById('landscapeNotice');
        orientationNotice?.setAttribute('aria-hidden', String(!portrait));
        // A mid-run rotation must never leave the ship exposed to live combat.
        // The player explicitly resumes after turning the phone back.
        if (portrait && this.state === GameState.PLAYING) {
            // The journal intercepts pause hotkeys. Close it first, then pause.
            if (this.missionLog?.isOpen()) this.missionLog.close();
            this.togglePause();
        }
        if (portrait && !this._needsLandscape) orientationNotice?.focus?.({ preventScroll: true });
        this._needsLandscape = portrait;
        this._updateCamera();
    }

    /** Docking freezes combat while the player chooses a purchase. */
    openBaseDock() {
        if (this.state !== GameState.PLAYING) return;
        const base = this.friendlyBases.dockable(this);
        if (!base) return;
        // The first emergency activation must remain possible even if a
        // starter ship is being chased. Active workshops still need clearance.
        const emergencyStartup=!base.activated &&
            this.friendlyBases.activationCount===0;
        if (!emergencyStartup && this.enemies.some(e => e.hp > 0 &&
            Math.hypot(e.x - base.x, e.y - base.y) < 210)) {
            this.createFloatingText('ОПАСНО! СНАЧАЛА ОТБЕЙТЕСЬ',
                this.player.x, this.player.y - 60, '#ff9c91');
            return;
        }
        this.state = GameState.DOCK;
        this.baseDockUI.open(base);
        this._announce('Открыт док. Выберите покупку или направление турели.');
    }

    closeBaseDock() {
        if (this.state !== GameState.DOCK) return;
        this.baseDockUI.close();
        this.state = GameState.PLAYING;
        this.lastTime = performance.now();
        this.ui.updateHud(this,true);
    }

    /** Leave a suspended tutorial before entering another game mode. */
    _endTutorialIfActive(){
        if(!this.tutorial?.active && !this._tutorialKeyHandler)return;
        this.tutorial?.skip?.();
        if(this._tutorialKeyHandler && typeof window!=='undefined')
            window.removeEventListener('keydown',this._tutorialKeyHandler,true);
        this._tutorialKeyHandler=null;
        this._renderTutorialBanner();
    }

    _ensureHybrid3D() {
        if(this.frameBudget?.mode==='2d' || this._hybrid3dFailed || this._hybrid3dPending ||
            (this.hybrid3d && !this.hybrid3d.disposed))return;
        this._hybrid3dPending=true;
        import('./hybrid-3d.js?v=runtime-124').then(({Hybrid3D})=>{
            if(this.frameBudget.mode==='2d')return;
            this.hybrid3d=new Hybrid3D(this.canvas,{mode:'campaign',graphicsMode:'3d',
                quality:this.frameBudget.plan(this.enemies.length)});
            this.hybrid3d.onDisabled=()=>{if(this.player)this.player._hybrid3dVisible=false;};
        }).catch(error=>{
            this._hybrid3dFailed=true;
            console.warn('3D unavailable; original 2D visuals remain',error);
        }).finally(()=>{this._hybrid3dPending=false;});
    }

    _changeGraphicsMode(mode) {
        this.frameBudget.setMode(mode);
        this._hybrid3dFailed=false;
        if(mode==='2d'){
            this.hybrid3d?.disable();this.hybrid3d=null;
            if(this.player)this.player._hybrid3dVisible=false;
            for(const enemy of this.enemies)enemy._hybrid3dVisible=false;
            for(const projectile of this.enemyProjectiles)projectile._hybrid3dVisible=false;
        }else if(this.player)this._ensureHybrid3D();
        this._resize();
        if(this.player && this.state!==GameState.PLAYING)this.render(0);
    }

    /**
     * Contract for the mission director being developed in another branch.
     * No objective, map or level timing is implied by this call: the mission
     * director must explicitly call completeMission() after a real victory.
     */
    startMission(index) {
        if(!hasDesignedMission(index)||!isMissionUnlocked(this.save,index))return false;
        this._endTutorialIfActive();
        this.speedrunMode=false;
        this.dailyMode=false;
        this._requestedMissionIndex=index;
        this.start();
        return true;
    }

    completeMission(seconds=this.gameTime) {
        if(!this.activeMission || this._missionRewarded || this.replayActive)
            return {ok:false,message:'Нет новой победы в миссии'};
        const result=recordMissionVictory(this.save,this.activeMission.index,seconds);
        if(result.ok) {
            this._missionRewarded=true;
            saveSave(this.save);
        }
        return result;
    }

    start() {
        this.galaxyMap.close();
        this.state = GameState.PLAYING;
        this.gameTime = 0;
        this.kills = 0;
        this.points = 0;
        this.personalRecord = null;
        this._runFinalized = false;
        this._missionRewarded = false;
        const missionIndex=this._requestedMissionIndex;
        this._requestedMissionIndex=null;
        this.activeMission=Number.isInteger(missionIndex) && !this.speedrunMode && !this.dailyMode &&
            !this.replayActive ? createMissionRules(missionIndex,this.save) : null;
        this.missionWorld=null;
        this.missionLog?.hide();
        document.getElementById('prologueTransmission')?.remove();
        document.getElementById('missionObjectiveHud')?.style.setProperty('display','none');
        document.getElementById('missionAction')?.style.setProperty('display','none');
        this._updateStageHud();
        this.enemies = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.expOrbs = [];
        this.particles = [];
        this.floatingTexts = [];
        this.mines = [];
        this.beams = [];
        this.combatBursts = [];
        this.battleDirector.reset();
        this.waveDirector.reset();
        this.enemyIntelligence.reset();
        this.worldVfx.configure(this.save.settings);
        this.worldVfx.reset();
        this.boostPickups = [];
        this._firstBoostSpawned = false;
        this._firstRockBroken = false;
        this._pendingLevelUps = 0;
        this._skillPreviewOpen = false;
        this._researchSaved = 0;
        this._nextAmbush = 165;
        this._bossesSpawned.clear();
        this._bossWarnedAt.clear();
        this._bossReadyAt.clear();
        this._lastBossSpawnAt = -Infinity;
        this._spawnAccumulator = 0;
        this._lastAnnouncedWave = null;
        this._nextSplitIdx = 0;
        // iter-16 bug-bash: clear stale pause-anchor from any prior paused run.
        this._pauseStartedAt = 0;

        // Re-derive the stage snapshot at run start. Daily mode pins the
        // stage from the challenge spec; otherwise we honour the saved
        // setting so a stage-picker change between runs takes effect here.
        const stageOverride =
            this.dailyMode && this.dailyChallenge ? this.dailyChallenge.stage : null;
        this.stageId = this.activeMission ? stageForMission(this.activeMission.index) :
            stageOverride || (this.replayActive && this._replayStageOverride) ||
            this.save?.settings?.stage || DEFAULT_STAGE_ID;
        this._updateStageHud();
        this.stageWaves = getWavesFor(this.stageId);
        this.stageBosses = this._applyDailyBossOffset(getBossesFor(this.stageId));
        this.currentWave = this.stageWaves[0];
        // iter-14: cache the active stage's gameplay modifiers (player speed,
        // enemy HP, cold tick). Looked up here so the per-frame hot path
        // doesn't pay the indirection — `getStageModifiers` walks STAGES.
        this.stageMods = getStageModifiers(this.stageId);
        // Mission scenery borrows tundra's starfield without its unannounced
        // endless-mode cold damage; the canyon's rock walls are its hazard.
        if(this.activeMission && this.stageMods)
            this.stageMods={...this.stageMods,coldTickInterval:0,coldTickDamage:0};
        // Designed missions replace these random fields on entry. Avoid
        // generating and discarding both maps during mission transitions.
        const designedSector=(this.activeMission?.index??0)>0;
        this.worldCaches = designedSector?[]:createWorldCaches(this.stageId,
            !(this.speedrunMode || this.dailyMode || this.replayActive || this.tutorial?.active));
        this.worldObstacles = designedSector?[]:createWorldObstacles(this.stageId);
        this._coldTickAccum = 0;

        // Reset per-run achievement state.
        this.achievements.resetRun();
        this.run = this.achievements.run;
        // Seed the fields the v2.4 achievements depend on. Kept here (rather
        // than in AchievementTracker) because these tie together weapons/ui.
        this.run.passivesPicked = 0;
        this.run.basesVisited = 0;
        this.run.basesActivated = 0;
        this.run.signalsRecovered = 0;
        this.run.distanceTravelled = 0;
        this.run.maxedWeaponCount = 0;
        this.run.evolvedBefore = {};
        this.run.realSecondsToVoidLord = Infinity;
        this.run.noHitBoss = false;
        this.run.tookAnyDamage = false; // flipped by Player.takeDamage; drives no-hit badge
        this.run.bossFightNoHit = new Set(); // ids of bosses whose fight we've tracked
        this._runStartWallClock = performance.now();
        this.speedrunSplits = [];

        this.player = new Player(
            (CONFIG.ARENA_WIDTH ?? CONFIG.CANVAS_WIDTH) / 2,
            (CONFIG.ARENA_HEIGHT ?? CONFIG.CANVAS_HEIGHT) / 2
        );
        // Competitive modes and tutorials retain their fixed starting loadout.
        const fixedLoadout = this.speedrunMode || this.dailyMode ||
            this.replayActive || this.tutorial?.active;
        const chosen = document.querySelector('input[name="survivorBuild"]:checked')?.value;
        this.buildStyle = fixedLoadout ? 'fighter' :
            ['fighter', 'mage', 'scout'].includes(chosen) ? chosen : 'fighter';
        this.player.shipVariant = this.buildStyle;
        // One renderer instance, with a stable 2D fallback on unsupported devices.
        this._ensureHybrid3D();
        // No ship starts with a premium weapon. Every pilot must close in,
        // mine rocks and earn more capable technology through level-ups.
        // Ship bonuses stay deliberately small and non-offensive.
        if (this.buildStyle === 'fighter') {
            this.player.baseMaxHp = 110;
            this.player.recalculateStats();
        }
        // Ordinary expeditions get a more usable opening weapon. Competitive
        // modes keep the original 8.6 loadout for existing score comparisons.
        const starter=fixedLoadout ? WEAPONS.STARTER_PULSE : {
            ...WEAPONS.STARTER_PULSE,baseDamage:9,baseCooldown:1.24,baseRange:135
        };
        this.player.weapons.push(new Weapon(starter));
        resetFieldFinds(this);
        this.baseDockUI.close();
        // Competitive modes retain their established rules and records.
        this.friendlyBases.reset(this, !(this.speedrunMode || this.dailyMode ||
            this.replayActive || this.tutorial?.active));
        if(this.activeMission){
            this.missionWorld=this.activeMission.index===0 ?
                new PrologueMissionWorld(this) : new MissionWorld(this,this.activeMission.index);
            this.missionWorld.enter(this);
        }
        // Snap camera to player at run start so the first frame doesn't show
        // a one-tick lerp from (0,0).
        this._updateCamera();

        this.ui.hideStart();
        this.ui.hideGameOver();
        this.ui.hideLevelUp();
        this.ui.hidePause();

        // Replays are read-only: they must not change settings or run counts.
        if (!this.replayActive) {
            this.save.runs = (this.save.runs || 0) + 1;
            saveSave(this.save);
        }

        // iter-15: spin up a fresh replay recorder for the new run, unless
        // we're playing back an existing replay. We use a deterministic seed
        // when one is available (speedrun / daily) so playback can recreate
        // identical spawns. Outside those modes, the recorder records the
        // wall-clock seed so replay still mostly reproduces the run, but
        // RNG-driven systems (Math.random) will diverge — documented in
        // docs/USER_GUIDE.md and the CHANGELOG.
        if (!this.replayActive) {
            const seed = this.speedrunRng?.state || Date.now() & 0xffffffff || 1;
            this.replayRecorder = new ReplayRecorder({
                seed,
                stage: this.stageId,
                difficulty: this.save.settings.difficulty || 'normal',
                dt: 1 / 60
            });
        } else {
            this.replayRecorder = null;
        }

        this.audio.unlock();
        this.audio.setMusicState('exploration');
        this._musicCueClock = 0;
        this.audio.startMusic();

        this.lastTime = performance.now();
        this._scheduleFrame();
    }

    /**
     * Speedrun mode: deterministic seed, fixed boss timeline (the `spawnAt`
     * fields in data.js are already fixed), real-time millisecond clock,
     * separate leaderboard. We toggle `speedrunMode` before delegating to
     * `start()` so the spawn path can branch on the seeded RNG.
     */
    startSpeedrun() {
        this.speedrunMode = true;
        this.dailyMode = false;
        this.speedrunRng = new SeededRng(CONFIG.SPEEDRUN_SEED);
        this.speedrunStart = performance.now();
        this.start();
        this._announce('Начался забег на время. Мир одинаков для всех попыток.');
    }

    /**
     * Daily challenge: deterministic seed pinned to the UTC date, stage is
     * also pinned (rotates daily), and boss timings are nudged by a per-day
     * offset. Final entry lands in `daily-{date}-{stage}` rather than the
     * regular leaderboard so the global ranks aren't polluted.
     */
    startDaily() {
        this.dailyMode = true;
        this.speedrunMode = false;
        this.dailyChallenge = dailyChallenge();
        // Re-use SeededRng for spawn determinism — same plumbing as speedrun.
        this.speedrunRng = new SeededRng(this.dailyChallenge.seed);
        this.speedrunStart = performance.now();
        this.start();
        this._announce(`Испытание дня: ${this.dailyChallenge.date}. Локация: ${getStage(this.stageId).name}.`);
    }

    /** Apply the daily challenge's bossOffset to a `getBossesFor` result. */
    _applyDailyBossOffset(bosses) {
        if (!this.dailyMode || !this.dailyChallenge?.bossOffset) return bosses;
        const off = this.dailyChallenge.bossOffset;
        return bosses.map((b) => ({ ...b, spawnAt: Math.max(30, b.spawnAt + off) }));
    }

    /** Show the stage picker overlay; persists the choice via `save.settings.stage`. */
    openStagePicker() {
        this.ui.showStagePicker(this.stageId, (newStageId) => {
            this.stageId = newStageId;
            this.save.settings.stage = newStageId;
            saveSave(this.save);
            // Refresh the chip on the main menu Stage button.
            this.ui.updateStageChip(newStageId);
            this._updateStageHud();
            if (this.state === GameState.MENU) this.render(0);
        });
    }

    openStreak() {
        this.ui.showStreak();
    }

    openHowToPlay() {
        this.ui.showHowToPlay(() => {
            this.save.flags = this.save.flags || {};
            this.save.flags.howToSeen = true;
            saveSave(this.save);
        });
    }

    /**
     * iter-15: surface a small "Try Tutorial" prompt above the start menu
     * on first launch. Yes/skip button writes `tutorialDone=true` either way
     * so the prompt never re-appears.
     */
    _offerTutorial() {
        if (typeof document === 'undefined') return;
        if (this.save?.flags?.tutorialDone) return;
        // Ensure the host overlay exists (created lazily so the DOM stays
        // unchanged for users who never trigger it).
        let overlay = document.getElementById('tutorialOffer');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'tutorialOffer';
            overlay.className = 'tutorial-offer';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-live', 'polite');
            overlay.style.display = 'none';
            const container = document.getElementById('gameContainer');
            container?.appendChild(overlay);
        }
        const dismiss = () => {
            overlay.style.display = 'none';
            this.save.flags = this.save.flags || {};
            this.save.flags.tutorialDone = true;
            saveSave(this.save);
        };
        const accept = () => {
            overlay.style.display = 'none';
            this.startTutorialRun();
        };
        overlay.innerHTML = `
            <div class="overlay-card tutorial-offer-card">
                <h2>${_t('tutorialOffer')}</h2>
                <div class="btn-row">
                    <button id="tutorialOfferYes" class="btn primary">${_t('tryTutorial')}</button>
                    <button id="tutorialOfferNo" class="btn ghost">${_t('skipTutorial')}</button>
                </div>
            </div>`;
        overlay.style.display = 'flex';
        overlay.querySelector('#tutorialOfferYes')?.addEventListener('click', accept);
        overlay.querySelector('#tutorialOfferNo')?.addEventListener('click', dismiss);
    }

    /**
     * Begin the tutorial: hand the menu off to a normal `start()` then flip
     * the tutorial state on. Esc skips at any point. Once the last step is
     * acknowledged we persist `tutorialDone=true`.
     */
    startTutorialRun() {
        this.tutorial = new TutorialState();
        this.tutorial.start();
        this.audio.unlock();
        this.speedrunMode = false;
        this.dailyMode = false;
        this.start();
        this._renderTutorialBanner();
        // Esc handler that explicitly skips the tutorial. Only fires while
        // the tutorial is active and a step is on screen — once the run is
        // over (success or skip) we detach the listener.
        if (typeof window !== 'undefined') {
            const onKey = (e) => {
                if (!this.tutorial.active) return;
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.tutorial.skip();
                    this._renderTutorialBanner();
                    this.save.flags = this.save.flags || {};
                    this.save.flags.tutorialDone = true;
                    saveSave(this.save);
                    window.removeEventListener('keydown', onKey, true);
                }
            };
            window.addEventListener('keydown', onKey, true);
            this._tutorialKeyHandler = onKey;
        }
    }

    /** Lazily mount + repaint the tutorial banner overlay. */
    _renderTutorialBanner() {
        if (typeof document === 'undefined') return;
        let banner = this._tutorialBanner;
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'tutorialBanner';
            banner.className = 'tutorial-banner';
            banner.setAttribute('aria-live', 'polite');
            const container = document.getElementById('gameContainer');
            container?.appendChild(banner);
            this._tutorialBanner = banner;
        }
        const prompt = this.tutorial.currentPrompt();
        if (!prompt) {
            banner.style.display = 'none';
            this._tutorialRenderedStep = null;
            if (this.tutorial.completed) {
                this.save.flags = this.save.flags || {};
                this.save.flags.tutorialDone = true;
                saveSave(this.save);
                this._announce(_t('tutorialDone'));
            }
            return;
        }
        const mobileControls = !!window.matchMedia?.('(any-pointer: coarse)').matches;
        const renderKey = prompt.id + (mobileControls ? ':touch' : ':keyboard');
        // Preserve the same button node across frames; replacing innerHTML
        // every tick would cancel a finger click before touchend.
        if (this._tutorialRenderedStep === renderKey && banner.style.display === 'block') return;
        this._tutorialRenderedStep = renderKey;
        const body = mobileControls && prompt.id === 'move'
            ? 'Передвигайте корабль джойстиком внизу слева.'
            : mobileControls && prompt.id === 'pause'
                ? 'Нажмите кнопку паузы в правом верхнем углу, чтобы завершить обучение.'
                : prompt.body;
        banner.innerHTML = `
            <strong>${prompt.title}</strong>
            <span class="tutorial-body">${body}</span>
            ${mobileControls ? '' : `<span class="tutorial-skip-hint">${_t('tutorialSkipHint')}</span>`}
            <button type="button" class="tutorial-skip-button">Пропустить обучение</button>`;
        banner.style.display = 'block';
        banner.querySelector('.tutorial-skip-button')?.addEventListener('click', () => {
            if (!this.tutorial.active) return;
            this.tutorial.skip();
            this.save.flags = this.save.flags || {};
            this.save.flags.tutorialDone = true;
            saveSave(this.save);
            if (this._tutorialKeyHandler) {
                window.removeEventListener('keydown', this._tutorialKeyHandler, true);
                this._tutorialKeyHandler = null;
            }
            this._renderTutorialBanner();
        });
    }

    /**
     * iter-15: open the replay menu. Loads the most recent saved replay
     * (single-slot) and lets the player pick a 1× / 2× / 4× playback speed.
     * If no replay is saved, surface a friendly note.
     */
    openReplay() {
        const blob = loadReplay();
        this.ui.showReplayMenu(blob, (speed) => {
            if (!blob) return;
            this._beginReplay(blob, speed);
        });
    }

    /**
     * Engage replay playback: build a ReplayPlayer, start the run with the
     * persisted seed/stage/difficulty, and route input through the player.
     */
    _beginReplay(blob, speed) {
        this.replayPlayer = new ReplayPlayer(blob, { speed });
        this.replayActive = true;
        // Replay parameters are temporary; never overwrite the user's saved
        // stage/difficulty (even if playback is closed mid-run).
        this._replayStageOverride = blob.stage || null;
        this._replayDifficultyOverride = blob.difficulty || null;
        // Reuse the speedrun seeding plumbing for spawn determinism. We
        // explicitly toggle off speedrunMode (no leaderboard write) but keep
        // the seeded RNG branch alive by setting `_replaySeededRng`.
        this.speedrunMode = false;
        this.dailyMode = false;
        this.speedrunRng = new SeededRng(blob.seed);
        // Use start() to do the rest of the setup (player, weapons, UI).
        this.start();
        // After start() resets state, force-feed the replay seed back in
        // because start() does not touch speedrunRng outside its modes.
        this.speedrunRng = new SeededRng(blob.seed);
        // Banner the user so they know inputs are disabled.
        this._announce(_t('replayPlaying'));
    }

    /**
     * End an active replay session — called when the player runs out of
     * frames or hits Esc / Quit. Returns the engine to the menu cleanly.
     */
    _endReplay() {
        this.replayActive = false;
        this._replayStageOverride = null;
        this._replayDifficultyOverride = null;
        this.replayPlayer = null;
        this.state = GameState.MENU;
        cancelAnimationFrame(this.raf);
        this.audio.stopMusic();
        this.ui.hideGameOver();
        this.ui.showStart();
    }

    toggleMap() {
        if(this.state===GameState.PLAYING){
            this.openGalaxyMap();return this.state===GameState.MAP;
        }
        if(this.state===GameState.MAP){
            this.closeGalaxyMap();return true;
        }
        return false;
    }

    openGalaxyMap() {
        if(this.state!==GameState.PLAYING)return;
        if(!this.galaxyMap.open(this))return;
        cancelAnimationFrame(this.raf);
        this.state=GameState.MAP;
        this._pauseStartedAt=performance.now();
        this.audio.stopMusic();
        this._announce('Карта открытого мира. Tab или Escape — вернуться к полёту.');
    }

    closeGalaxyMap() {
        if(this.state!==GameState.MAP)return;
        this.galaxyMap.close();
        this.state=GameState.PLAYING;
        if(this._pauseStartedAt){
            const paused=performance.now()-this._pauseStartedAt;
            if(paused>0 && Number.isFinite(paused)){
                if(this.speedrunStart)this.speedrunStart+=paused;
                if(this._runStartWallClock)this._runStartWallClock+=paused;
            }
            this._pauseStartedAt=0;
        }
        this.lastTime=performance.now();
        this.audio.startMusic();
        this._scheduleFrame();
    }

    /** Study every visible path while paused, without buying an upgrade. */
    openSkillTreePreview() {
        if (this.state !== GameState.PAUSED || !this.player ||
            !this.friendlyBases?.enabled || this._skillPreviewOpen) return;
        this._skillPreviewOpen = true;
        this.ui.hidePause();
        this.ui.showSkillTree(this.player, null, {
            preview: true,
            onClose: () => this.closeSkillTreePreview()
        });
    }

    closeSkillTreePreview() {
        if (!this._skillPreviewOpen) return;
        this._skillPreviewOpen = false;
        this.ui.hideLevelUp();
        this.ui.showPause();
    }

    togglePause() {
        if(this.missionLog?.isOpen()){this.missionLog.close();return;}
        if (this._skillPreviewOpen) { this.closeSkillTreePreview(); return; }
        if(this.state===GameState.MAP){this.closeGalaxyMap();return;}
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            this.ui.showPause();
            this.audio.stopMusic();
            // iter-16 bug-bash: stamp the pause moment so we can subtract the
            // paused duration from the speedrun wall-clock when we resume.
            // Without this, leaderboard timeMs (and split realMs) silently
            // counted seconds spent in the pause menu — penalising players
            // who paused to read a level-up dialog or take a breath.
            this._pauseStartedAt = performance.now();
            // iter-15: tutorial step 5 waits for a pause toggle.
            if (this.tutorial?.active) {
                this.tutorial.notifyPause();
                this._renderTutorialBanner();
            }
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.ui.hidePause();
            this.audio.startMusic();
            this.lastTime = performance.now();
            // iter-16 bug-bash: shift the speedrun + run-start anchors forward
            // by however long we were paused so wall-clock readings exclude
            // pause time. Both anchors are floats, so a simple addition keeps
            // the existing `performance.now() - anchor` math correct.
            if (this._pauseStartedAt) {
                const paused = performance.now() - this._pauseStartedAt;
                if (paused > 0 && Number.isFinite(paused)) {
                    if (this.speedrunStart) this.speedrunStart += paused;
                    if (this._runStartWallClock) this._runStartWallClock += paused;
                }
                this._pauseStartedAt = 0;
            }
            this._scheduleFrame();
        }
    }

    gameOver() {
        if (this._runFinalized) return;
        this._runFinalized = true;
        // Watching an old recording must never award another score.
        if (this.replayActive) { this._endReplay(); return; }
        this.state = GameState.GAMEOVER;
        cancelAnimationFrame(this.raf);
        this.audio.stopMusic();
        this.audio.death();
        // iter-19: long death-knell pattern. Fired once at the moment of
        // game over, before any leaderboard / replay finalisation work.
        this.haptics?.gameOver();
        // iter-15: snapshot + persist the recorded replay (single slot).
        // We do this before any of the leaderboard / achievement logic so a
        // crash inside those paths never loses the replay. Skipped during
        // playback (no recorder).
        if (this.replayRecorder) {
            try {
                this.replayRecorder.finalize({
                    kills: this.kills,
                    time: this.gameTime,
                    level: this.player?.level || 1
                });
                saveReplay(this.replayRecorder.serialize());
            } catch (err) {
                console.warn('[main] failed to persist replay', err);
            }
            this.replayRecorder = null;
        }

        // Update lifetime "unique builds" counter: a build = the sorted set
        // of weapon ids at death. If we haven't seen this combination before,
        // append it. Hard-cap the array at SEEN_BUILDS_CAP (1000) to keep the
        // save under a reasonable byte budget — older keys roll out FIFO.
        this.save.totals ??= { kills: 0, timePlayed: 0, runs: 0, bossKills: 0 };
        this.save.totals.seenBuilds ??= [];
        const buildKey = this.player.weapons
            .map((w) => w.id)
            .sort()
            .join('+');
        if (buildKey && !this.save.totals.seenBuilds.includes(buildKey)) {
            this.save.totals.seenBuilds.push(buildKey);
            const cap = CONFIG.SEEN_BUILDS_CAP || 1000;
            if (this.save.totals.seenBuilds.length > cap) {
                this.save.totals.seenBuilds.splice(0, this.save.totals.seenBuilds.length - cap);
            }
            this.save.totals.uniqueBuilds = this.save.totals.seenBuilds.length;
        }

        // Final achievement check.
        this.achievements.check(this);
        this._flushAchievementToasts();

        // Score is awarded once per completed run and kept in the same browser
        // as the laboratory's personal file. Replaying a recording cannot earn points.
        const bossCount = Object.keys(this.run.bossesDefeated || {}).length;
        this.points = calculatePoints({
            seconds: this.gameTime,
            kills: this.kills,
            level: this.player.level,
            bosses: bossCount
        });
        this.personalRecord = this.replayActive ? null : recordSurvivorRun({
            seconds: this.gameTime,
            kills: this.kills,
            level: this.player.level,
            bosses: bossCount,
            stage: this.stageId,
            difficulty: this.save.settings.difficulty,
            mode: this.dailyMode ? 'daily' : this.speedrunMode ? 'speedrun' : 'normal'
        });

        // Record run -------------------------------------------------------
        const weaponIds = this.player.weapons.map((w) => w.id);
        const entry = {
            kills: this.kills,
            timeSurvived: this.gameTime,
            points: this.points,
            level: this.player.level,
            date: Date.now(),
            weapons: weaponIds,
            // v2.6: stage tag so per-stage leaderboards split correctly.
            stage: this.stageId,
            // Authoritative: was the player hit even once across the whole
            // run? Falls back to the unhit-timer proxy for backwards compat
            // if a custom path bypassed Player.takeDamage.
            noHit: !this.run.tookAnyDamage
        };
        // Progression telemetry is descriptive only: never changes scores or
        // competitive replay seeds. Six weapon slots cap its save footprint.
        if(!this.speedrunMode && !this.dailyMode) {
            entry.masteries=this.player.weapons.filter(w=>w.specialization)
                .map(w=>({weapon:w.id,path:w.specialization,rank:w.level}));
        }
        // Daily-mode runs go to the per-day slot rather than the global
        // leaderboard so they don't pollute the speedrun/normal pools.
        if (this.dailyMode && this.dailyChallenge) {
            saveDailyResult({
                ...entry,
                date: this.dailyChallenge.date,
                seed: this.dailyChallenge.seed,
                won: !!this.run.bossesDefeated?.void_lord
            });
        } else {
            recordHighScore(this.save, entry);
        }
        accumulateTotals(this.save, {
            kills: this.kills,
            gameTime: this.gameTime,
            bossKills: Object.keys(this.run.bossesDefeated).length
        });
        saveSave(this.save);

        // Speedrun: write to its own leaderboard, and store the split timeline
        // on the game so the UI can render it in the game-over screen.
        if (this.speedrunMode) {
            const sEntry = {
                timeMs: performance.now() - this.speedrunStart,
                splits: this.speedrunSplits,
                level: this.player.level,
                kills: this.kills,
                points: this.points,
                date: Date.now(),
                weapons: weaponIds,
                noHit: entry.noHit
            };
            const rank = recordSpeedrunScore(sEntry);
            this._speedrunRank = rank;
            this._speedrunEntry = sEntry;
        }

        this.ui.showGameOver(this);
    }

    openLeaderboard() {
        this.ui.showLeaderboard(this.save.highScores || [], loadSpeedrunScores(), () => {
            /* closed */
        });
    }

    // --- Frame loop -------------------------------------------------------
    _scheduleFrame() {
        this.raf = requestAnimationFrame((t) => this._frame(t));
    }

    _onVisibilityChange() {
        if (typeof document === 'undefined') return;
        if (document.hidden) {
            if (this.state === GameState.PLAYING) {
                this._hiddenPaused = true;
                this.state = GameState.PAUSED;
                this.ui.showPause();
                this.audio.stopMusic();
                // iter-16 bug-bash: track tab-hidden start so when the player
                // hits Resume the speedrun anchor shifts past the hidden
                // window. Mirrors togglePause()'s logic.
                this._pauseStartedAt = performance.now();
            }
        } else if (this._hiddenPaused && this.state === GameState.PAUSED) {
            // Don't auto-resume: leave the pause menu up so the player
            // explicitly opts back in. Just reset the clock to avoid a
            // massive dt when they do click Resume.
            this._hiddenPaused = false;
            this.lastTime = performance.now();
        }
    }

    _frame(now) {
        if (this.state !== GameState.PLAYING && this.state !== GameState.LEVEL_UP &&
            this.state !== GameState.DOCK) return;
        // Clamp dt so that (a) a paused+resumed tab does not nuke the sim in
        // one step, and (b) frame-rate spikes don't create tunneling bugs.
        const frameMs=Math.max(0,now-this.lastTime);
        const workStarted=performance.now();
        const qualitySample=this.state===GameState.PLAYING;
        const slices=simulationSlices(frameMs);
        const dt=slices.elapsed;
        this.lastTime = now;
        // iter-14: pull the gamepad once per frame so axes + button edges
        // are fresh by the time update() reads `getMoveVector`. Safe no-op
        // when no pad is attached.
        this.input.pollGamepad?.();
        if (this.state === GameState.PLAYING) {
            this.diagnostics.measure('simulation',()=>{
                for(let i=0;i<slices.count&&this.state===GameState.PLAYING;i++)this.update(slices.dt);
            });
        }
        // iter-20: pass the canvas viewport so EffectLayer can recycle
        // off-screen emoji rain drops without reaching back into the DOM.
        // Level-up and docking freeze the world. Repaint once on entry or
        // resize; keep the cheap input loop alive for confirm/resume controls.
        const drawWorld=this.state===GameState.PLAYING || this._worldDirty ||
            this._lastRenderedState!==this.state || this._lastRenderedTime!==this.gameTime;
        if(drawWorld){
            this.effects.update(dt,{w:CONFIG.CANVAS_WIDTH,h:CONFIG.CANVAS_HEIGHT});
            this.diagnostics.measure('render',()=>this.render(dt));this._worldDirty=false;
            this._lastRenderedState=this.state;this._lastRenderedTime=this.gameTime;
        }
        this.fpsMeter.tick(Math.max(.001,frameMs/1000));
        this.ui.setFps(this.fpsMeter.fps, this.save.settings.showFps);
        if(qualitySample && this.state===GameState.PLAYING)
            this.frameBudget.sample(frameMs,performance.now()-workStarted);
        this.diagnostics.frame(frameMs,this);
        this._scheduleFrame();
    }

    update(dt) {
        this.gameTime += dt;

        const { hpMult, dmgMult, diff } = this._computeDifficultyMults();
        this.enemyDmgMult = dmgMult; // used by enemy projectile spawn

        this.currentWave = this._selectWave();

        // Audio director changes scores sparingly: continuous enemy ticks
        // must not cause choppy transitions or restart music.
        this._musicCueClock = (this._musicCueClock || 0) - dt;
        if (this._musicCueClock <= 0) {
            this._musicCueClock = 4.5;
            const bossActive = this.enemies.some(e => e.boss && e.hp > 0);
            const crowded = this.gameTime >= 55 && this.enemies.length >= 14;
            this.audio.setMusicState(bossActive ? 'boss' :
                crowded ? 'combat' : 'exploration');
        }

        // iter-15: replay playback drives input by replacing
        // `input.getMoveVector` with the recorded vector for the current
        // frame. We tick the player AFTER this swap; the swap is undone via
        // `input.getMoveVector = original` only when the replay finishes.
        if (this.replayActive && this.replayPlayer) {
            const v = this.replayPlayer.getMoveVector();
            this.input.getMoveVector = () => v;
            this.replayPlayer.tick();
            if (this.replayPlayer.done) {
                // Out of frames: end the replay before computing player update
                // so the run terminates cleanly on the next loop iteration.
                this._endReplay();
                return;
            }
        }

        // iter-15: snapshot the current input so the recorder + tutorial
        // both see the same vector this frame. Reading `getMoveVector`
        // twice would otherwise be cheap but inconsistent under replay.
        const moveSnapshot = this.input.getMoveVector();
        this._lastMoveVec = { x: moveSnapshot.x, y: moveSnapshot.y };
        if (this.replayRecorder && !this.replayActive) {
            this.replayRecorder.record(this._lastMoveVec);
        }
        // Tutorial state-machine tick. Cheap no-op unless active.
        if (this.tutorial?.active) {
            this.tutorial.tick(dt, this._lastMoveVec);
            this._renderTutorialBanner();
        }

        const oldPlayerX = this.player.x, oldPlayerY = this.player.y;
        this.player.update(dt, this);
        const proposedX = this.player.x, proposedY = this.player.y;
        updateWorldObstacles(this,dt);
        nudgeWorldObstaclesFromShip(this.player,this.worldObstacles,
            oldPlayerX,oldPlayerY,dt,{x:proposedX,y:proposedY});
        resolveWorldObstacles(this.player, this.worldObstacles, oldPlayerX, oldPlayerY);
        this.missionWorld?.constrainEntity?.(this.player,oldPlayerX,oldPlayerY);
        if (this.run) this.run.distanceTravelled += Math.hypot(
            this.player.x - oldPlayerX, this.player.y - oldPlayerY);
        // Collision should cancel only the blocked component of drift, so
        // a ship glides along an asteroid instead of vibrating against it.
        if (Math.abs(this.player.x - proposedX) > .3) this.player.vx = 0;
        if (Math.abs(this.player.y - proposedY) > .3) this.player.vy = 0;
        if (this.player.dead) {
            this.gameOver();
            return;
        }
        updateWorldCaches(this);
        // iter-14: stage modifiers — cold tick (no-op on forest/crypt).
        this._applyColdTick(dt);

        // iter-20: pacifist-provoked timer. Counts up while the player has
        // zero kills; a single kill breaks the streak and forfeits the
        // window for the rest of the run (we cap at 60 + 1 to avoid
        // unbounded float growth and to make the achievement check trivial).
        if (this.run) {
            if (this.kills === 0) {
                if ((this.run.pacifistTimer || 0) < 61) {
                    this.run.pacifistTimer = (this.run.pacifistTimer || 0) + dt;
                }
            }
        }

        // Spatial hash rebuild BEFORE anyone queries it.
        this.spatial.insertAll(this.enemies);
        this.enemyIntelligence.update(dt,this);

        this._updateEnemies(dt, hpMult, dmgMult);
        this._updateProjectiles(dt);
        this._updateEnemyProjectiles(dt);
        this.friendlyBases.update(dt, this);
        // Campaign missions use positioned salvage and scripted rewards.
        // Random roaming boosts can undermine the intended first objectives.
        if(!this.missionWorld)updateFieldFinds(this, dt);
        updateTemporaryBoostPickups(this, dt);
        this.worldVfx.update(dt);
        if(!this.missionWorld)this.battleDirector.update(dt, this);
        for (const list of [this.beams, this.combatBursts]) {
            for (let i = list.length - 1; i >= 0; i--) {
                list[i].ttl -= dt;
                if (list[i].ttl <= 0) list.splice(i, 1);
            }
        }
        if (this.player.dead) { this.gameOver(); return; }
        this._updateMines(dt);
        this._updateExpOrbs(dt);
        this._maybeTriggerLevelUp();
        this._updateParticlesAndText(dt);

        if(this.missionWorld){
            this.missionWorld.update(this,dt,hpMult,dmgMult);
            if(this.state!==GameState.PLAYING)return;
        }else this._spawnLogic(dt, hpMult, dmgMult, diff.spawnMult);

        // Speedrun splits: push once per threshold as gameTime crosses them.
        if (this.speedrunMode) {
            const thresholds = CONFIG.SPEEDRUN_SPLITS;
            while (
                this._nextSplitIdx < thresholds.length &&
                this.gameTime >= thresholds[this._nextSplitIdx]
            ) {
                const mark = thresholds[this._nextSplitIdx];
                this.speedrunSplits.push({
                    mark,
                    realMs: performance.now() - this.speedrunStart
                });
                this._nextSplitIdx++;
            }
        }

        // Achievement ticks (cheap: most checks short-circuit).
        this.achievements.check(this);
        this._flushAchievementToasts();

        // HUD
        this.ui.updateHud(this);

        // Camera
        this.camera.update(dt, this.save.settings.screenShake);
        this._updateCamera();
    }

    /**
     * Position the camera so the player sits in the centre of the viewport,
     * clamped so the camera never shows arena out-of-bounds. Called every
     * frame from `update()` and once from `start()` to avoid a first-frame
     * snap. Stored on `this.camera.worldX/worldY` (top-left of the viewport
     * in arena coords). Render translates by `-worldX + shake.x` etc.
     */
    _updateCamera() {
        if (!this.player) return;
        const vw = CONFIG.CANVAS_WIDTH;
        const vh = CONFIG.CANVAS_HEIGHT;
        const aw = CONFIG.ARENA_WIDTH ?? vw;
        const ah = CONFIG.ARENA_HEIGHT ?? vh;
        let wx = this.player.x - vw / 2;
        let wy = this.player.y - vh / 2;
        if (wx < 0) wx = 0;
        if (wy < 0) wy = 0;
        if (wx > aw - vw) wx = aw - vw;
        if (wy > ah - vh) wy = ah - vh;
        this.camera.worldX = wx;
        this.camera.worldY = wy;
    }

    // --- update() helpers (kept close to the orchestrator for locality) ---
    _computeDifficultyMults() {
        const diff =
            Difficulty[((this.replayActive && this._replayDifficultyOverride) ||
                this.save.settings.difficulty || 'normal').toUpperCase()] ||
            Difficulty.NORMAL;
        if(this.missionWorld?.index===0)return {diff,hpMult:diff.hpMult,dmgMult:diff.dmgMult};
        const timeDiff = 1 + Math.min(1.8, (this.gameTime / 60) * 0.14);
        // Stage modifier folds into hpMult at the source so every spawn path
        // (waves, splitter children, bosses) inherits the +20% on tundra
        // without each call site reaching back into stages.js.
        const stageHpMult = this.stageMods?.enemyHpMult ?? 1;
        // A gentler first minute lets weak ships reach their first field
        // finds; the original challenge returns smoothly by 60 seconds.
        const warmupHp = .84 + .16 * Math.min(1, this.gameTime / 60);
        return {
            diff,
            hpMult: diff.hpMult * timeDiff * stageHpMult * warmupHp,
            dmgMult: diff.dmgMult * timeDiff
        };
    }

    /**
     * iter-14: tundra cold tick. Drains 1 HP every `coldTickInterval` seconds
     * (default 10) on stages that opt in. Skipped on stages with
     * `coldTickInterval == 0` (forest, crypt). Bypasses i-frames and armor on
     * purpose — it's an attrition mechanic, not damage — and never kills the
     * player outright (clamps at 1 HP) so death is always attributable to a
     * real hit.
     */
    _applyColdTick(dt) {
        const mods = this.stageMods;
        if (!mods || !mods.coldTickInterval) return;
        if (!this.player || this.player.dead) return;
        this._coldTickAccum += dt;
        while (this._coldTickAccum >= mods.coldTickInterval) {
            this._coldTickAccum -= mods.coldTickInterval;
            const dmg = mods.coldTickDamage || 1;
            // Drain HP without going through takeDamage so we don't refresh
            // i-frames or trigger the no-hit invalidation (cold is ambient).
            const next = Math.max(1, this.player.hp - dmg);
            if (next < this.player.hp) {
                this.player.hp = next;
                this.createFloatingText(`-${dmg}❄`, this.player.x, this.player.y - 36, '#88ccff');
            }
        }
    }

    _updateEnemies(dt, hpMult, dmgMult) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.hp <= 0) {
                if (!e.selfDestructed) this._onEnemyKilled(e, hpMult, dmgMult);
                this.enemies.splice(i, 1);
                continue;
            }
            const oldEX=e.x,oldEY=e.y;
            e.update(dt, this);
            // A kamikaze has already detonated. Its wreck cannot deliver an
            // extra contact hit, award XP, or count as a player kill.
            if (e.hp <= 0 && e.selfDestructed) {
                this.enemies.splice(i, 1);
                continue;
            }
            this.missionWorld?.constrainEntity?.(e,oldEX,oldEY);
            nudgeWorldObstaclesFromShip(e,this.worldObstacles,oldEX,oldEY,dt);
            if(e.prologueGroup&&dt>0){
                const moved=Math.hypot(e.x-oldEX,e.y-oldEY);
                e.prologueTravel=(e.prologueTravel||0)+moved;
                e.faceVelocity(dt,(e.x-oldEX)/dt,(e.y-oldEY)/dt);
            }

            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const d = Math.hypot(dx, dy);
            if (d < e.size + this.player.size && !this.player.invincible) {
                this.player.takeDamage(e.damage, this);
                this.createFloatingText(
                    Math.round(e.damage),
                    this.player.x,
                    this.player.y - 30,
                    '#ff3333'
                );
            }

            if (e.hp <= 0) {
                this._onEnemyKilled(e, hpMult, dmgMult);
                this.enemies.splice(i, 1);
                continue;
            }

            if (d > CONFIG.DESPAWN_RADIUS && !e.boss && !e.missionStructure &&
                !e.missionBeaconWave && !e.missionFinalRaider && !e.missionDecoy &&
                !e.missionRigRaider) {
                this.enemies.splice(i, 1);
            }
        }
    }

    _onEnemyKilled(e, hpMult, dmgMult) {
        const relayBonus=this.missionWorld?.onEnemyDestroyed?.(e)||0;
        if(relayBonus)this.createFloatingText('РЕЛЕ · ЗАРЯДКА −'+relayBonus+' С',
            e.x,e.y-68,'#9dffdf');
        if(!e.siegeMite)this.kills++;
        this.createParticles(e.x, e.y, e.color, e.boss ? 28 : 6);
        this.worldVfx.shipExplosion(e.x, e.y, e.size, e.color, e.boss);
        this.effects.hit(e.x, e.y, this._rgbFromHex(e.color));
        if(!e.siegeMite && this.missionWorld?.index!==0)this.dropExp(e.x, e.y, e.expValue);
        this.friendlyBases.onEnemyKilled(e, this);
        if (e.boss) {
            this.shake(0.5);
            this.audio.explosion();
            this.achievements.onBossDefeated(e.id);
            this._announce(`Босс повержен: ${Object.values(BOSSES).find((b) => b.id === e.id)?.name || e.id}`);
            // Mark no-hit-boss if the player's unhit streak is longer than
            // the fight itself. We use the unhit timer (seconds without
            // damage) as a cheap proxy; any damage during the fight resets it.
            if (this.player.unhitTimer >= 8) this.run.noHitBoss = true;
            // Speedrun: record wall-clock seconds until each boss.
            if (e.id === 'void_lord') {
                this.run.realSecondsToVoidLord =
                    (performance.now() - this._runStartWallClock) / 1000;
            }
            // iter-20: hidden Speedrunner Plus achievement. Any boss kill in
            // under 5 minutes wall-clock counts. The pause anchor inside
            // `togglePause` keeps `_runStartWallClock` honest, so a player
            // can't pad the timer by sitting in the pause menu.
            if (this._runStartWallClock) {
                const realSec = (performance.now() - this._runStartWallClock) / 1000;
                if (realSec < 300) this.run.fastBossClear = true;
            }
        }
        if (e.splitter && e.type.splitInto) {
            const childDef = findEnemyDef(e.type.splitInto);
            if (childDef) {
                const activeCap = this.missionWorld ? 60 :
                    Math.max(5, (this.waveDirector?.maxEnemies || 5) + 2);
                const n = Math.min(e.type.splitCount || 2,
                    Math.max(0, Math.min(CONFIG.MAX_ENEMIES,activeCap) - this.enemies.length));
                for (let k = 0; k < n; k++) {
                    const a = (k / n) * Math.PI * 2;
                    this.enemies.push(
                        new Enemy(
                            e.x + Math.cos(a) * 14,
                            e.y + Math.sin(a) * 14,
                            childDef,
                            hpMult,
                            dmgMult
                        )
                    );
                }
            }
        }
        this.audio.hit();
    }

    spawnTemporaryBoost(x, y) {
        if(this.missionWorld?.index===0)return null;
        return spawnTemporaryBoost(this, x, y);
    }

    damageTerrain(x, y, radius, damage, hitSet = null, reward = true, impact = null) {
        return damageWorldObstacles(this, x, y, radius, damage, hitSet, reward, impact);
    }

    _updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            const previousX=p.x,previousY=p.y;
            p.update(dt, this);
            if(this.missionWorld?.index===0&&!this.missionWorld.clearLineOfFire(previousX,previousY,p.x,p.y))p.shouldRemove=true;
            if (p.shouldRemove) {
                this.projectiles.splice(i, 1);
                continue;
            }
            p.terrainHits ??= new Set();
            const rockHits = this.damageTerrain(
                p.x, p.y, p.size + 7, p.damage * .8 * (p.def?.rockDamageMult || 1), p.terrainHits,
                true,{vx:p.vx,vy:p.vy});
            if (rockHits && !p.piercing) {
                this.audio.hit('armor');
                p._onEnd?.(this);
                this.projectiles.splice(i, 1);
                continue;
            }

            const range = p.size + 32;
            for (const enemy of this.spatial.queryRect(p.x, p.y, range)) {
                if (p.hitEnemies.has(enemy)) continue;
                const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (d < enemy.size + p.size) {
                    let dmg = p.damage;
                    const chance = this.player.getCritChance();
                    const crit = chance > 0 && Math.random() < chance;
                    if (crit) dmg *= 2;
                    const hitShield = (enemy.shieldHp || 0) > 0;
                    enemy.takeDamage(dmg);
                    p.hitEnemies.add(enemy);
                    this.audio.hit(hitShield ? 'shield' : 'normal');
                    if (enemy.hp > 0) {
                        this.createFloatingText(
                            Math.round(dmg),
                            enemy.x,
                            enemy.y - 20,
                            crit ? '#ffee44' : '#fff',
                            { crit }
                        );
                    }
                    // iter-15 polish: brief red flash on critical hits, opt-out
                    // via Settings → criticalFlash. Suppressed when reduced
                    // motion is on so it never overrides accessibility.
                    if (
                        crit &&
                        this.save.settings.criticalFlash !== false &&
                        !this.save.settings.reducedMotion
                    ) {
                        this.effects.criticalHit();
                    }
                    this.effects.hit(enemy.x, enemy.y);
                    this.worldVfx.hit(enemy.x, enemy.y, crit, !!enemy.shieldHp);
                    if (!p.piercing || (p.id === 'starter_pulse' &&
                        p.hitEnemies.size >= 2)) {
                        p._onEnd(this);
                        p.shouldRemove = true;
                        break;
                    }
                }
            }
        }
    }

    _updateEnemyProjectiles(dt) {
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const ep = this.enemyProjectiles[i];
            ep.update(dt, this);
            if (!ep.shouldRemove && ep.kind !== 'mine' &&
                this.damageTerrain(ep.x, ep.y, ep.size + 5, ep.damage * .5,
                    null, false,{vx:ep.vx,vy:ep.vy})) {
                ep.shouldRemove = true;
                this.createParticles(ep.x, ep.y, '#ffbc85', 5);
            }
            if (ep.shouldRemove) this.enemyProjectiles.splice(i, 1);
        }
    }

    _updateMines(dt) {
        for (let i = this.mines.length - 1; i >= 0; i--) {
            const m = this.mines[i];
            m.update(dt, this);
            if (m.shouldRemove) this.mines.splice(i, 1);
        }
    }

    _updateExpOrbs(dt) {
        // iter-15: snapshot the orb-collected counter before the per-frame
        // update so we can fire `tutorial.notifyOrbPickup()` on the rising
        // edge. ExpOrb.update bumps `game.run.orbsCollected`; comparing the
        // two values is cheaper than wrapping ExpOrb.
        const before = this.run?.orbsCollected || 0;
        for (let i = this.expOrbs.length - 1; i >= 0; i--) {
            const o = this.expOrbs[i];
            o.update(dt, this);
            if (o.shouldRemove) this.expOrbs.splice(i, 1);
        }
        if (this.tutorial?.active) {
            const after = this.run?.orbsCollected || 0;
            for (let k = 0; k < after - before; k++) {
                this.tutorial.notifyOrbPickup();
            }
            if (after !== before) this._renderTutorialBanner();
        }
    }

    _maybeTriggerLevelUp() {
        if(this.missionWorld?.index===0&&(!this.missionWorld.done('weapon')||!this.missionWorld.trainingSafe(this)))return;
        if (this._pendingLevelUps > 0 && this.state === GameState.PLAYING) {
            this._pendingLevelUps--;
            this.state = GameState.LEVEL_UP;
            this.audio.levelUp();
            this.effects.levelUp(this.player.x, this.player.y);
            this.worldVfx.nova(this.player.x, this.player.y, 130, 'gold');
            // iter-19: ascending-ramp vibration. Distinct shape from the
            // hurt single-pulse and the boss triple so the player can
            // tell what just happened from the haptic alone.
            this.haptics?.levelUp();
            this._announce(`Уровень ${this.player.level}! Выберите улучшение.`);
            // iter-15: notify the tutorial state machine — its "level up"
            // step waits for exactly this event.
            if (this.tutorial?.active) {
                this.tutorial.notifyLevelUp();
                this._renderTutorialBanner();
            }
            this.ui.showLevelUp(this.player, (choice) => this._applyUpgrade(choice));
        }
    }

    _updateParticlesAndText(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.update(dt);
            if (part.life <= 0) {
                this.pools.particle.release(part);
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) {
                this.pools.floatingText.release(ft);
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    /** Broadcast a short message to screen readers via the a11y live region. */
    _announce(msg) {
        this.missionWorld?.onAnnouncement?.(this,msg);
        if (typeof document === 'undefined') return;
        const el = document.getElementById('a11yLiveRegion');
        if (!el) return;
        // Toggle textContent to force SR re-announce if the message repeats.
        el.textContent = '';
        // Microtask flush before writing so ATs pick up the change.
        Promise.resolve().then(() => {
            el.textContent = msg;
        });
    }

    _applyUpgrade(choice) {
        if(this.activeMission?.index===0){
            if(!choice||(this.player.trainingSpent||0)>=(this.player.trainingEarned||0))return;
            choice=skillChoice(this.player,this.friendlyBases,choice.type,choice.data?.id,null,this.activeMission);
            if(!choice)return;
            this.player.trainingSpent=(this.player.trainingSpent||0)+1;
        }
        let upgradeCue = 'upgrade_standard';
        if (choice) {
            // The confirmed selection has its own cue; the level-up banner
            // keeps the original alert. A new weapon branch is recognisable.
            const id = choice.data?.id;
            if (choice.type === 'weapon') {
                const known = this.player.weapons.find(w => w.id === id);
                const isSpecialization = known?.level === 3 &&
                    !!getWeaponMastery(id, choice.specialization);
                const branchByWeapon = {
                    knife:'arsenal', mine:'arsenal', boomerang:'arsenal',
                    railgun:'arsenal', orbit:'carrier', drone_swarm:'carrier',
                    lightning:'laboratory', frost_nova:'laboratory',
                    retro_blaster:'laboratory', soul_drain:'repair'
                };
                const branch = branchByWeapon[id];
                upgradeCue = (!known || isSpecialization) && branch
                    ? 'unlock_branch_' + branch : 'upgrade_weapon';
            } else if (choice.type === 'ability') upgradeCue = 'upgrade_research';
            else if (choice.type === 'passive') {
                upgradeCue = ['armor','max_hp','shield_core','damage_reduction',
                    'dodge','recovery'].includes(id) ? 'upgrade_armor'
                    : ['magnet','growth','salvage','targeting','magnet_plus',
                        'emp_pulse'].includes(id) ? 'upgrade_research'
                    : 'upgrade_standard';
            }
            if (choice.type === 'supply') {
                const id=choice.data.id;
                if(id==='credits') {
                    this.friendlyBases.addCredits(18,this);
                    this.createFloatingText?.('⚙ +18',this.player.x,
                        this.player.y-50,'#ffe09c');
                } else if(id==='repair') {
                    if(this.player.hp>=this.player.maxHp-.5)
                        this.friendlyBases.addCredits(10,this);
                    else this.player.heal(Math.ceil(this.player.maxHp*.18));
                    this.worldVfx?.boostCollect(this.player.x,this.player.y,'green');
                } else if(id==='scanner') {
                    if(!this.friendlyBases.scanNearest(this))
                        this.friendlyBases.addCredits(14,this);
                } else if(id==='reserve') {
                    this._researchSaved=Math.min(2,(this._researchSaved||0)+1);
                    this._announce('Технологический пакет сохранён. Запустите новую базу.');
                }
            } else if (choice.type === 'ability') {
                this.player.fieldSkills ??= Object.create(null);
                const id=choice.data.id;
                const prev=this.player.fieldSkills[id]||0;
                this.player.fieldSkills[id]=Math.min(choice.data.maxRank||1,prev+1);
                this._announce(choice.data.name+' · уровень '+this.player.fieldSkills[id]+'.');
            } else if (choice.type === 'weapon') {
                const existing = this.player.weapons.find((w) => w.id === choice.data.id);
                if (existing) {
                    const prevLvl = existing.level;
                    if(prevLvl===3 &&
                        getWeaponMastery(existing.id,choice.specialization))
                        existing.specialization=choice.specialization;
                    existing.levelUp();
                    if (existing.level >= CONFIG.WEAPON_MAX_LEVEL) {
                        this.achievements.onWeaponMaxed();
                        // Track how many distinct weapons have been maxed this run.
                        if (prevLvl < CONFIG.WEAPON_MAX_LEVEL) {
                            this.run.maxedWeaponCount = (this.run.maxedWeaponCount || 0) + 1;
                        }
                    }
                    // Early-Evolve achievement: fire when the weapon actually
                    // crosses into its evolution tier before 7:00.
                    if (
                        existing.def.evolveLevel &&
                        prevLvl < existing.def.evolveLevel &&
                        existing.level >= existing.def.evolveLevel &&
                        this.gameTime < CONFIG.EARLY_EVOLVE_THRESHOLD
                    ) {
                        this.run.evolvedBefore = this.run.evolvedBefore || {};
                        this.run.evolvedBefore.sevenMin = true;
                    }
                } else {
                    // Expeditions get an accessible but deliberately modest
                    // rocket Mk I. Competitive modes retain the old weapon.
                    const rocket=choice.data.id==='knife' && this.friendlyBases?.enabled
                        ? {...choice.data,baseDamage:14,baseCooldown:1.64,baseRange:285}
                        : choice.data;
                    this.player.weapons.push(new Weapon(rocket));
                }
            } else {
                this.player.passives[choice.data.id] ??= { def: choice.data, count: 0 };
                if (this.player.passives[choice.data.id].count < CONFIG.PASSIVE_MAX_STACK) {
                    this.player.passives[choice.data.id].count++;
                    this.player.recalculateStats();
                    this.run.passivesPicked = (this.run.passivesPicked || 0) + 1;
                }
            }
        }
        this.ui.hideLevelUp();
        if (choice) this.audio?.playEvent(upgradeCue);
        this.state = GameState.PLAYING;
        this.lastTime = performance.now();
    }

    _selectWave() {
        const t = this.gameTime;
        const list = this.stageWaves && this.stageWaves.length ? this.stageWaves : WAVES;
        let match = list[list.length - 1];
        for (const w of list) {
            if (t >= w.from && t < w.to) {
                match = w;
                break;
            }
        }
        if (this._lastAnnouncedWave !== match.label) {
            this._lastAnnouncedWave = match.label;
        }
        return match;
    }

    _spawnLogic(dt, hpMult, dmgMult, diffSpawnMult) {
        const wave = this.currentWave;
        const linkTier=this.friendlyBases?.enabled?
            this.friendlyBases.technologyTier:3;
        // Gentle discovery window: avoid swamping a technology-gated ship,
        // without making higher-tech stations reduce enemy difficulty.
        const explorePressure=linkTier===0?.82:linkTier===1?.91:1;
        const plan = this.waveDirector.step(
            dt, this, diffSpawnMult*explorePressure, wave.spawnMult || 1);
        if (plan.spawn) {
            this._spawnOne(wave.pool, hpMult, dmgMult, plan.angle);
        }

        // A compact interceptor wing is an earned midgame challenge, not a
        // three-sided ambush against a ship still gathering its first cells.
        if (this.gameTime >= this._nextAmbush) {
            this._nextAmbush = Math.max(this._nextAmbush + 78, this.gameTime + 78);
            const count = Math.min(4, 2 + Math.floor(this.player.level / 4));
            if (this.player.level >= 3 && !this.waveDirector.inRespite &&
                this.enemies.length <= plan.cap - count) {
                const entry = plan.angle + .7;
                const wing=[];
                for (let i = 0; i < count; i++) {
                    const ship=this._spawnOne(['stalker'], hpMult, dmgMult, entry);
                    if(ship)wing.push(ship);
                }
                this.enemyIntelligence.formAmbush(wing,this);
                this._announce('⚠️ Группа перехватчиков! Следите за направлением атаки');
            }
        }

        // Boss triggers (warning 5s before). Use the per-stage boss list so
        // stage-specific timing overrides (e.g. crypt's earlier Reaper) fire.
        const bossList =
            this.stageBosses && this.stageBosses.length ? this.stageBosses : Object.values(BOSSES);
        let activeBoss = this.enemies.some(e => e.boss && e.hp > 0);
        for (const boss of bossList) {
            if (this._bossesSpawned.has(boss.id)) continue;
            // Normal games now give players time to build and equip stations.
            // Speedrun, daily and replays keep their original timelines.
            const competitive=this.speedrunMode||this.dailyMode||this.replayActive;
            const early=!competitive&&boss.spawnAt<330;
            let spawnAt=boss.spawnAt;
            if(early){
                const eligibleAt=Math.max(270,boss.spawnAt+135);
                if(this.gameTime>=eligibleAt&&this.player.level>=5&&
                    !this._bossReadyAt.has(boss.id)){
                    this._bossReadyAt.set(boss.id,this.gameTime+10);
                }
                spawnAt=Math.min(360,this._bossReadyAt.get(boss.id)||360);
                // A pilot still seeking the second base gets one bounded
                // preparation window, not an unwinnable early boss.
                if(this.friendlyBases?.enabled &&
                    this.friendlyBases.technologyTier<2)
                    spawnAt=Math.max(spawnAt,450);
            }
            // Never stack two capital ships on the same frame when a pilot
            // has not yet linked the second station. Once one battle starts,
            // finish it and allow a short repair / salvage interval. Keep
            // competitive timelines unchanged for deterministic records.
            if (!competitive && (activeBoss ||
                this.gameTime - (this._lastBossSpawnAt ?? -Infinity) <
                    NORMAL_BOSS_RECOVERY_SECONDS)) continue;
            if(this.gameTime>=spawnAt-9&&!this._bossWarnedAt.has(boss.id)){
                this._bossWarnedAt.add(boss.id);
                this.audio.bossWarn();
                this.audio.setMusicState('combat');
            }
            if(this.gameTime>=spawnAt&&!this._bossesSpawned.has(boss.id)){
                this._bossesSpawned.add(boss.id);
                this._spawnBoss(boss,hpMult,dmgMult);
                this._lastBossSpawnAt = this.gameTime;
                activeBoss = true;
            }
        }
    }

    _spawnOne(pool, hpMult, dmgMult, arrivalAngle = null) {
        // Speedrun + Daily both want determinism; either uses speedrunRng.
        const rng =
            (this.speedrunMode || this.dailyMode) && this.speedrunRng ? this.speedrunRng : null;
        const frnd = rng ? () => rng.nextFloat() : Math.random;
        // pickWeighted honours the active stage's poolOverrides; with default
        // stage (forest) all weights are 1 so it degrades to a uniform pick.
        // Introduce enemy behaviours one by one. Slower progress retains
        // simpler opponents, rather than unlocking elite swarms by timer.
        const t = this.gameTime;
        const level = this.player?.level || 1;
        let candidates = pool;
        if (this.missionWorld) {
            // Campaign designers own these rosters: the normal expedition
            // tier filter must not replace a scripted escort or ambush.
            candidates = pool;
        } else if (this.speedrunMode || this.dailyMode || this.replayActive) {
            // Preserve the old seeded/competitive sequence and replay pools.
            if (t < 45) candidates = ['bat', 'bat', 'bat', 'zombie'];
            else if (t < 100) candidates = ['bat', 'bat', 'zombie', 'skeleton',
                ...(t >= 80 && level >= 2 ? ['stalker'] : [])];
            if (this.stageId==='crypt' && t>=35 && t<100)
                candidates=[...candidates,'mage'];
            else if (level < 3) candidates = ['bat', 'zombie', 'skeleton', 'stalker'];
            else if (t < 180) candidates = ['bat', 'zombie', 'skeleton',
                'stalker', 'wolf', 'mage'];
        } else {
            candidates = eligibleEnemyPool(pool,t,level,this.stageId);
        }
        if (!candidates?.length) candidates = ['bat', 'zombie'];
        const pick =
            pickWeighted(candidates, this.stageId, frnd) ||
            candidates[Math.floor(frnd() * candidates.length)];
        const type = findEnemyDef(pick) || ENEMIES.BAT;
        const angle = arrivalAngle == null ? frnd() * Math.PI * 2 :
            arrivalAngle + (frnd() - .5) * 1.05;
        const dist = CONFIG.SPAWN_RADIUS + frnd() * 120;
        const x = this.player.x + Math.cos(angle) * dist;
        const y = this.player.y + Math.sin(angle) * dist;
        const ship=new Enemy(x, y, type, hpMult, dmgMult);
        // Spawn-side targeting information expires unless a scout refreshes it.
        ship._lastKnownTarget={x:this.player.x,y:this.player.y,
            vx:this.player.vx||0,vy:this.player.vy||0,until:this.gameTime+6};
        this.enemies.push(ship);
        if(type.commandSquad){
            const cap=Math.min(CONFIG.MAX_ENEMIES,
                this.waveDirector.maxEnemies||CONFIG.MAX_ENEMIES);
            if(this.enemies.length+2<=cap){
                const wing=[ship],escort=findEnemyDef('stalker');
                for(let i=0;i<2;i++){
                    const angle=(i===0?-1:1)*.65;
                    const member=new Enemy(x+Math.cos(angle)*38,
                        y+Math.sin(angle)*38,escort,hpMult*.75,dmgMult*.85);
                    this.enemies.push(member);wing.push(member);
                }
                this.enemyIntelligence.formAmbush(wing,this);
            }
        }
        return ship;
    }

    _spawnBoss(bossDef, hpMult, dmgMult) {
        const angle = Math.random() * Math.PI * 2;
        const d = CONFIG.SPAWN_RADIUS * 0.8;
        const x = this.player.x + Math.cos(angle) * d;
        const y = this.player.y + Math.sin(angle) * d;
        this.enemies.push(new Enemy(x, y, bossDef, hpMult, dmgMult));
        this.ui.showBossBanner();
        this.audio.bossSpawn();
        this.audio.setMusicState('boss');
        this.effects.bossSpawn();
        this.worldVfx.bossPortal(x, y, bossDef.size || 28);
        // iter-15 polish: bump boss-spawn camera shake by +50% (0.8 → 1.2).
        // The reduced-motion gate inside `shake()` still applies so
        // accessibility users are unaffected.
        this.shake(1.2);
        // iter-19: triple-pulse vibration so the player feels the warning
        // even with audio off / sleeve-pocket play.
        this.haptics?.bossSpawn();
        this._announce(`Приближается босс: ${bossDef.name || bossDef.id}`);
    }

    _flushAchievementToasts() {
        const toasts = this.achievements.takeToasts();
        for (const ach of toasts) {
            this.ui.showAchievementToast(ach);
            this.audio.achievement();
            this.effects.achievement();
            this._announce(`Достижение открыто: ${ach.name}. ${ach.description}`);
            // iter-20: harmless emoji-rain celebration the first time the
            // player crosses the 15-minute Survivor threshold. We trigger
            // off the achievement-just-unlocked event rather than polling
            // the save flag so a returning player who already has the
            // achievement doesn't get rained on every run.
            if (ach.id === 'survive_15min') {
                const w = CONFIG.CANVAS_WIDTH;
                const h = CONFIG.CANVAS_HEIGHT;
                this.effects.celebrate(w, h);
            }
        }
    }

    _rgbFromHex(hex) {
        // Accept '#rrggbb' and return 'r,g,b' for effects layer.
        if (!hex || hex[0] !== '#') return '255,255,255';
        const n = parseInt(hex.slice(1), 16);
        return `${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff}`;
    }

    // --- Helpers ----------------------------------------------------------
    dropExp(x, y, amount) {
        this.expOrbs.push(new ExpOrb(x, y, amount));
    }
    createParticles(x, y, color, n) {
        if (this.save.settings.reducedMotion) n = Math.min(n, 2);
        // The Kenney VFX layer adds richer sprites. Bound legacy particles as
        // well so two effects systems never overload an Android browser.
        const cap = this.worldVfx?.quality < 1 ? 150 : 300;
        n = Math.max(0, Math.min(n, this.worldVfx ? 12 : 32, cap - this.particles.length));
        for (let i = 0; i < n; i++) {
            this.particles.push(this.pools.particle.acquire(x, y, color));
        }
    }
    createFloatingText(text, x, y, color, opts) {
        if (this.save.settings.reducedMotion) return;
        // damageNumbers toggle (default on). Backwards-compatible: an older
        // save without the field still gets numbers because we treat
        // `undefined` as on.
        if (this.save.settings.damageNumbers === false) return;
        this.floatingTexts.push(this.pools.floatingText.acquire(text, x, y, color, opts || {}));
    }
    shake(amount) {
        // Reduced-motion users get no camera shake even if the setting is on.
        const prm =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        if (this.save.settings.screenShake && !prm && !this.save.settings.reducedMotion) {
            this.camera.shake(amount);
        }
    }

    // called by Player via takeDamage
    onPlayerHurt(_amount) {
        this.audio.damage();
        this.shake(0.25);
        // iter-19: short single-pulse vibration. No-ops on platforms without
        // navigator.vibrate or when the user has switched it off.
        this.haptics?.hurt();
    }

    onBossAbility(boss) {
        if (boss.ability === 'summon') {
            const childDef = findEnemyDef('skeleton');
            for (let i = 0; i < 3; i++) {
                const a = Math.random() * Math.PI * 2;
                const r = 80;
                this.enemies.push(
                    new Enemy(boss.x + Math.cos(a) * r, boss.y + Math.sin(a) * r, childDef, 2, 1.5)
                );
            }
            this.createParticles(boss.x, boss.y, '#aa33ff', 20);
            this.worldVfx.nova(boss.x, boss.y, 85, 'violet');
        } else if (boss.ability === 'salvo') {
            const n = 10;
            if (this.enemyProjectiles.length < 145) {
                const heading = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
                for (let i = 0; i < n; i++) {
                    const a = heading + i * Math.PI * 2 / n;
                    this.enemyProjectiles.push(new EnemyProjectile(
                        boss.x, boss.y, a, 250,
                        14 * (this.enemyDmgMult || 1), 'plasma'
                    ));
                }
            }
            this.createParticles(boss.x, boss.y, '#ff9b66', 26);
            this.shake(.14);
        } else if (boss.ability === 'charge') {
            const dx = this.player.x - boss.x;
            const dy = this.player.y - boss.y;
            const d = Math.hypot(dx, dy) || 1;
            boss.x += (dx / d) * 120;
            boss.y += (dy / d) * 120;
            this.createParticles(boss.x, boss.y, '#ff3366', 15);
        }
    }

    // --- Rendering --------------------------------------------------------
    render(_dt) {
        const ctx = this.ctx;
        const plan=this.frameBudget?.plan(this.enemies.length);
        ctx.__lowFx=(plan?.level||0)>0;
        const ratio=plan?.canvasRatio??1;
        const width=Math.max(1,Math.round((this._canvasBaseWidth||this.canvas.width)*ratio));
        const height=Math.max(1,Math.round((this._canvasBaseHeight||this.canvas.height)*ratio));
        if(this.canvas.width!==width||this.canvas.height!==height){
            this.canvas.width=width;this.canvas.height=height;
            ctx.setTransform(width/CONFIG.CANVAS_WIDTH,0,0,height/CONFIG.CANVAS_HEIGHT,0,0);
        }
        this._renderPlan=plan;
        this.worldVfx.setBudget?.(plan?.vfxScale??1);
        this.diagnostics.measure('WebGL',()=>this._renderHybrid3D(plan));
        this._updateGraphicsRuntimeStatus(plan);
        // 1) Background fill in screen space (no transform). This guarantees
        //    the viewport is always cleared even when the camera sits flush
        //    against an arena edge and a sliver would otherwise be unfilled.
        const bg = getBackgroundFor(this.stageId);
        ctx.fillStyle = bg.fill;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        // 2) World-space pass: translate by -camera + shake so entity coords
        //    (which live in arena space) project into the viewport.
        ctx.save();
        ctx.translate(-this.camera.worldX + this.camera.x, -this.camera.worldY + this.camera.y);

        this.worldArt.draw(
            ctx, this.stageId, this.camera.worldX, this.camera.worldY,
            CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT,
            this.missionWorld?.index??null, plan?.vfxScale??1
        );
        this.worldArt.drawAtmosphere(
            ctx, this.stageId, this.camera.worldX, this.camera.worldY,
            CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT, this.gameTime,
            this.missionWorld?.index??null, plan?.vfxScale??1
        );
        const fxCamera = { worldX:this.camera.worldX, worldY:this.camera.worldY,
            width:CONFIG.CANVAS_WIDTH, height:CONFIG.CANVAS_HEIGHT };
        this.worldVfx.render(ctx, 'back', fxCamera);
        this.diagnostics.measure('station back',()=>this.missionWorld?.drawBack(ctx,this));
        // Put shadows below props and all gameplay actors, never on top.
        this.diagnostics.measure('ship shadow',()=>this.missionWorld?.drawShipShadow?.(ctx,this.player,this.gameTime,this.save?.campaign));

        renderWorldObstacles(ctx, this.worldObstacles, this.player, false,
            this.gameTime, plan?.vfxScale??1);
        renderWorldCaches(ctx, this.worldCaches, this.gameTime, this.player);
        renderTemporaryBoostPickups(ctx, this.boostPickups, this.gameTime);
        this.friendlyBases.render(ctx, this);
        this.diagnostics.measure('station front',()=>this.missionWorld?.drawFront(ctx,this));
        if(!this.missionWorld)this.battleDirector.render(ctx);
        for (const o of this.expOrbs) o.render(ctx);
        for (const m of this.mines) m.render(ctx);
        this.diagnostics.measure('robots',()=>this._renderEnemies(ctx));
        // Event-bound awareness and radio cues; bounded to visible actors.
        renderCombatSignals(ctx,this,CONFIG.CANVAS_WIDTH,CONFIG.CANVAS_HEIGHT);
        if (this.player) {
            this.player._hybrid3dVisible = !!this.hybrid3d?.ready &&
                !this.hybrid3d.disposed && !this.hybrid3d.contextLost &&
                this.frameBudget?.mode!=='2d' && this.state !== GameState.MENU && this.state !== GameState.GAMEOVER;
            const campaign=this.save?.campaign;
            const workshop=this.missionWorld?.index===0 && this.missionWorld.done('weapon');
            const sharpHull=ratio<.999 && this.heroLayer?.available &&
                this.diagnostics.measure('sharp hero',()=>this.heroLayer.draw({
                    player:this.player,camera:this.camera,
                    logicalWidth:CONFIG.CANVAS_WIDTH,logicalHeight:CONFIG.CANVAS_HEIGHT,
                    cssWidth:this._renderWidth,cssHeight:this._renderHeight,
                    devicePixelRatio:window.devicePixelRatio||1,
                    paint:shipCtx=>this.player.render(shipCtx,campaign,workshop,'hull')
                }));
            if(!sharpHull)this.heroLayer?.hide();
            this.player.render(ctx,campaign,workshop,sharpHull?'field':'all');
            // Orbit shards live on the weapon, so render per-weapon extras here.
            for (const w of this.player.weapons) w.renderExtras?.(ctx, this.player);
        }
        renderWorldObstacles(ctx, this.worldObstacles, this.player, true,
            this.gameTime, plan?.vfxScale??1);
        for (const b of this.combatBursts) {
            const alpha = Math.max(0, b.ttl / b.total);
            ctx.save();
            ctx.strokeStyle = b.color; ctx.globalAlpha = alpha;
            ctx.lineWidth = 5; ctx.shadowColor = b.color; ctx.shadowBlur = 15;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.range * (1.15 - alpha * .15), 0, Math.PI * 2);
            ctx.stroke(); ctx.restore();
        }
        for (const beam of this.beams) {
            const alpha = Math.max(0, beam.ttl / beam.total);
            if (beam.mode === 'repair') {
                drawRepairBeam(ctx, beam, this.gameTime, alpha);
                continue;
            }
            ctx.save(); ctx.globalAlpha = alpha;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.strokeStyle = beam.color || '#56cfff'; ctx.lineWidth = 15; ctx.shadowColor = beam.color || '#87eeff';
            ctx.shadowBlur = 28;
            ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(beam.x2, beam.y2); ctx.stroke();
            ctx.strokeStyle = beam.coreColor || '#f5fcff'; ctx.lineWidth = 3; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(beam.x2, beam.y2); ctx.stroke();
            ctx.restore();
        }
        for (const p of this.projectiles) p.render(ctx);
        for (const ep of this.enemyProjectiles) ep.render(ctx);
        this.worldVfx.render(ctx, 'front', fxCamera);
        this.effects.renderWorld(ctx);
        for (const p of this.particles) p.render(ctx);
        for (const t of this.floatingTexts) t.render(ctx);

        ctx.restore();

        // 3) Screen-space effects (flash, pulses, vignette) on top — these
        //    render relative to the viewport, not the world.
        this.effects.renderScreen(ctx, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        this.enemyIntelligence.renderIntercept(ctx,this);
    }

    /** Explain visible fallback graphics without adding another intrusive HUD. */
    _updateGraphicsRuntimeStatus(plan){
        const label=document.getElementById('graphicsRuntimeStatus');
        if(!label)return;
        const status=plan?.mode==='2d'?'2D · выбран вручную':
            this._hybrid3dFailed?'2D · WebGL недоступен':
            !this.hybrid3d?.ready || this.hybrid3d?.disposed?'Подготовка 3D…':
            this.missionWorld?.index===0?
                (this.hybrid3d?.stellarWindows?.windows?.size?
                    '2D · спрайты; 3D · обзорные окна':
                    '2D · спрайты станции'):
                (plan?.level>0?'3D · облегчённая графика ('+plan.level+'/3)':'3D · модели включены');
        if(label.textContent!==status)label.textContent=status;
    }

    /** Set current-frame 3D visibility before drawing any 2D fallback hulls. */
    _renderHybrid3D(plan) {
        if (this.hybrid3d && !this.hybrid3d.disposed && this.frameBudget?.mode!=='2d') {
            try {
                // The prologue keeps the animated WebGL star, but rasterizes
                // its transparent overlay at a cheaper resolution. Cache the
                // derived plan so no quality object is allocated each frame.
                let overlayQuality=plan;
                if(this.missionWorld?.index===0&&plan?.pixelRatio>.8){
                    if(this._prologueOverlayFrom!==plan){
                        this._prologueOverlayFrom=plan;
                        this._prologueOverlayPlan=Object.freeze({...plan,pixelRatio:.8});
                    }
                    overlayQuality=this._prologueOverlayPlan;
                }
                const windows=this.missionWorld?.getSolarWindows?.()||[];
                const prologue=this.missionWorld?.index===0;
                const visibleWindows=prologue?windows.filter(w=>
                    w.x<this.camera.worldX+CONFIG.CANVAS_WIDTH&&w.x+w.w>this.camera.worldX&&
                    w.y<this.camera.worldY+CONFIG.CANVAS_HEIGHT&&w.y+w.h>this.camera.worldY):windows;
                if(prologue&&!visibleWindows.length){
                    this.hybrid3d.canvas.style.display='none';
                    return;
                }
                this.hybrid3d.canvas.style.display='block';
                this.hybrid3d.render({
                    player:this.player,
                    centerX:this.camera.worldX-this.camera.x+CONFIG.CANVAS_WIDTH/2,
                    centerY:this.camera.worldY-this.camera.y+CONFIG.CANVAS_HEIGHT/2,
                    logicalWidth:CONFIG.CANVAS_WIDTH,
                    logicalHeight:CONFIG.CANVAS_HEIGHT,
                    cssWidth:this._renderWidth,cssHeight:this._renderHeight,quality:overlayQuality,
                    time:this.gameTime, campaign:this.save?.campaign,
                    enemies:this.enemies, enemyProjectiles:this.enemyProjectiles,
                    workshop:this.missionWorld?.index===0&&this.missionWorld.done('weapon'),
                    // Prologue bases stay native 2D fixtures. Selective, authored
                    // 3D scenery is culled by Hybrid3D and the shared render budget.
                    bases:this.missionWorld?.index===0?[]:this.friendlyBases?.bases,
                    scenery:this.missionWorld?.get3DProps?.(
                        this.frameBudget?.mobile?'mobile':'desktop')||[],
                    stellarWindows:visibleWindows,
                    active:this.state !== GameState.MENU && this.state !== GameState.GAMEOVER
                });
            } catch (error) { this.hybrid3d.disable(error); }
        }
    }

    /**
     * Draw enemies using the cached offscreen sprite when available. Bosses
     * and flashing enemies still go through the full per-frame path because
     * their visuals include HP bars and hit-flash highlights that the cached
     * bitmap cannot reproduce. This cuts per-enemy drawing calls from ~4
     * (gradient + two arcs + fill) to a single drawImage for the common case.
     */
    _renderEnemies(ctx) {
        for (const e of this.enemies) {
            // Authored siege stations are rendered as modular buildings in the mission layer.
            if (e.missionStructure) {
                if (!inCamera(e,this.camera,CONFIG.CANVAS_WIDTH,CONFIG.CANVAS_HEIGHT,90))
                    continue;
                // At most two animated 3D elites on desktop, one on mobile.
                // Every other robot remains the real Kenney Canvas2D sprite.
                if(!e._prologue3dVisible || this._renderPlan?.mode==='2d' ||
                   !this.hybrid3d?.ready || this.hybrid3d?.disposed)
                    this.missionWorld?.drawRobot?.(ctx,e,this.gameTime);
                else if(e.hp<e.maxHp){
                    const width=48;
                    ctx.fillStyle='#091824';ctx.fillRect(e.x-width/2,e.y-48,width,5);
                    ctx.fillStyle='#8ef1d1';
                    ctx.fillRect(e.x-width/2,e.y-48,width*Math.max(0,e.hp/e.maxHp),5);
                }
                continue;
            }
            const padding=e.aimTimer>0?800:e.boss?260:70;
            if(!inCamera(e,this.camera,CONFIG.CANVAS_WIDTH,CONFIG.CANVAS_HEIGHT,padding))continue;
            drawEnemyThrusters(ctx,e,this.gameTime,this._renderPlan?.enemyGlow!==false);
            if (e._hybrid3dVisible) {
                // The old 2D HP indicator stays legible over a real 3D hull.
                if (e.hp<e.maxHp && !e.boss) {
                    const span=Math.max(24,e.size*1.8);
                    ctx.fillStyle='#0c202d';
                    ctx.fillRect(e.x-span/2,e.y-e.size-13,span,4);
                    ctx.fillStyle='#ff857a';
                    ctx.fillRect(e.x-span/2,e.y-e.size-13,
                        span*Math.max(0,e.hp/e.maxHp),4);
                }
                if (e.boss) drawBossDetails(ctx,e,this.gameTime,this.player,
                    !!this.save?.settings?.reducedMotion);
                continue;
            }
            const detailed=e.boss || !!e.repairState || e.flashTimer>0 || e.shielded ||
                e.avoidingStrike || e.slowTimer>0 || e.reactiveShieldHp>0 ||
                (e.bomber && e.fuseArmed) || e.reactionSpeedUntil>this.gameTime;
            const animated=!detailed && drawAnimatedEnemyShip(ctx,e);
            const sprite=(detailed||animated)?null:getEnemySprite(e.type,e.size);
            if (detailed) {
                e.render(ctx);
                if(e.boss)drawBossDetails(ctx,e,this.gameTime,this.player,
                    !!this.save?.settings?.reducedMotion);
            } else if (animated || sprite) {
                if (sprite) {
                    ctx.save();
                    ctx.translate(e.x, e.y);
                    ctx.rotate(e.visualAngle || 0);
                    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
                    ctx.restore();
                }
                // Cheap HP bar (cached sprite can't reflect current HP).
                const pct = Math.max(0, e.hp / e.maxHp);
                if (pct < 1) {
                    const w = 30;
                    ctx.fillStyle = '#222';
                    ctx.fillRect(e.x - w / 2, e.y - e.size - 10, w, 3);
                    ctx.fillStyle = pct > 0.5 ? '#44ff44' : pct > 0.25 ? '#ffaa33' : '#ff4444';
                    ctx.fillRect(e.x - w / 2, e.y - e.size - 10, w * pct, 3);
                }
            } else {
                e.render(ctx);
            }
            if (e.aimTimer > 0) {
                const a = e.aimAngle;
                ctx.save(); ctx.globalAlpha = .75;
                ctx.strokeStyle = '#ff6896'; ctx.lineWidth = 2.5;
                ctx.setLineDash([9, 8]); ctx.shadowColor = '#f55d9b'; ctx.shadowBlur = 12;
                ctx.beginPath(); ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x + Math.cos(a) * 760, e.y + Math.sin(a) * 760);
                ctx.stroke(); ctx.setLineDash([]); ctx.restore();
            } else if (e.dasher && e.dashActive <= 0 &&
                e.dashTimer > 0 && e.dashTimer < .52) {
                const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
                ctx.save(); ctx.globalAlpha = .5;
                ctx.strokeStyle = '#ff8667'; ctx.lineWidth = 4;
                ctx.setLineDash([9, 7]);
                ctx.beginPath(); ctx.moveTo(e.x, e.y);
                ctx.lineTo(e.x + Math.cos(a) * 185, e.y + Math.sin(a) * 185);
                ctx.stroke(); ctx.restore();
            }
        }
    }

    /**
     * Draws a faint grid in arena/world space. Because we're inside the
     * world-space transform (-camera + shake) we can just iterate from
     * the first grid line >= camera.worldX to the last one <= worldX+vw,
     * which auto-clips to the visible region without any per-frame guess.
     */
    _drawGrid() {
        const ctx = this.ctx;
        const alpha = (getBackgroundFor(this.stageId).gridAlpha ?? 0.04).toFixed(3);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1;
        const size = CONFIG.GRID_SIZE;
        const cx = this.camera.worldX;
        const cy = this.camera.worldY;
        const vw = CONFIG.CANVAS_WIDTH;
        const vh = CONFIG.CANVAS_HEIGHT;
        const startX = Math.floor(cx / size) * size;
        const startY = Math.floor(cy / size) * size;
        for (let x = startX; x <= cx + vw; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, cy);
            ctx.lineTo(x, cy + vh);
            ctx.stroke();
        }
        for (let y = startY; y <= cy + vh; y += size) {
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx + vw, y);
            ctx.stroke();
        }
    }

    openAchievements() {
        this.ui.showAchievements(this.save.achievements || {}, () => {
            /* closed */
        });
    }

    // --- Settings ---------------------------------------------------------
    async refreshPublishedFiles() {
        if (!window.confirm(
            'Перезагрузить файлы «Выжившего»? Текущий вылет прервётся. ' +
            'Сохранённые достижения, настройки и прогресс останутся.'
        )) return;
        try {
            // A refresh affects this game's offline files only. Do not clear
            // localStorage, IndexedDB or the shared caches of other games.
            saveSave(this.save);
            if ('caches' in window) {
                const names = await caches.keys();
                await Promise.all(names
                    .filter(name => name.startsWith('vesnin-survivor-ru-'))
                    .map(name => caches.delete(name)));
            }
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration(location.href);
                if (registration) {
                    await Promise.race([
                        registration.update().catch(() => {}),
                        new Promise(resolve => setTimeout(resolve, 2500))
                    ]);
                }
            }
        } catch (error) {
            // Still load a cache-busting document if cache APIs are blocked.
            console.warn('[survivor] Targeted cache refresh partially unavailable', error);
        }
        const fresh = new URL(window.location.href);
        fresh.searchParams.set('refresh', Date.now().toString(36));
        fresh.searchParams.delete('vmv'); // shared release check will set the current fingerprint
        window.location.replace(fresh.href);
    }

    openSettings() {
        this.ui.showSettings(
            this.save.settings,
            (key, value) => {
                this.save.settings[key] = value;
                saveSave(this.save);
                if (key === 'masterVolume' || key === 'sfxVolume' || key === 'musicVolume')
                    this.audio.applyVolumes();
                if (key === 'musicEnabled') this.audio.toggleMusic(value);
                if (key === 'muted') this.audio.setMuted(value);
                if (key === 'graphicsMode') this._changeGraphicsMode(value);
                // iter-14: re-apply CSS custom properties when the touch
                // button scale changes so the player sees the buttons
                // resize live without reloading the page.
                if (key === 'touchButtonScale') this._applyTouchScale();
            },
            () => {
                /* closed */
            },
            () => {
                resetSave();
                this.save = loadSave();
                this.achievements = new AchievementTracker(this.save);
                this.run = this.achievements.run;
                this.audio.applyVolumes();
                this.ui.hideSettings();
            },
            {
                // iter-19: only render the vibration row when the host
                // actually has the API; the UI hides it otherwise so it
                // isn't a dead control.
                vibrationSupported: this.haptics?.isSupported() ?? false,
                onRemap: () => this.openRemap(),
                onRefresh: () => this.refreshPublishedFiles()
            }
        );
    }

    // --- Keymap remap -----------------------------------------------------
    /**
     * iter-19: open the Customize Controls dialog. Saves the new keymap to
     * localStorage and re-arms the input manager so the rebind takes effect
     * on the next keystroke.
     */
    openRemap() {
        this.ui.showRemap(
            this.keymap,
            (next) => {
                this.keymap = next;
                this.input.setKeymap(next);
                saveKeymap(next);
            },
            () => {
                /* closed; settings panel stays open behind */
            }
        );
    }
}

// Level-up batching. Called from gainExp via Player; we patch Player here to notify.
const origGainExp = Player.prototype.gainExp;
Player.prototype.gainExp = function (amount) {
    const ups = origGainExp.call(this, amount);
    if (ups.length && window.__vsGame) {
        window.__vsGame._pendingLevelUps = (window.__vsGame._pendingLevelUps || 0) + ups.length;
    }
    return ups;
};

// Bootstrap
export function boot() {
    const g = new Game();
    window.__vsGame = g;
    if(typeof window!=='undefined' &&
       new URLSearchParams(window.location?.search||'').get('mission')==='0'){
        window.history?.replaceState?.({},'',window.location.pathname);
        g.audio.unlock();g.startMission(0);
    }
    // Dev-only debug hooks. Gated on hostname so they never fire on the
    // GitHub Pages build; the smoke harness loads from localhost so it
    // does. Used by scripts/runtime-smoke.js to fast-forward to bosses,
    // force a level-up, and trigger game-over without having to actually
    // play 5 minutes per scene.
    const isDev =
        typeof location !== 'undefined' &&
        (location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.hostname === '');
    if (isDev) {
        window.__SURV_DEBUG__ = {
            /** Fast-forward simulated game time. Triggers everything that's
             * gated on `gameTime`: wave director, boss spawns, difficulty
             * scaling. Spawn accumulator follows along so a chunk of enemies
             * appears proportionate to the elapsed window. */
            advance(seconds = 30) {
                if (!g.player || g.state !== 'playing') return false;
                g.gameTime += seconds;
                // Keep the spawn director from emptying its bag in one frame.
                g._spawnAccumulator = 0;
                return true;
            },
            /** Push enough XP that the next update() flushes one level-up. */
            grantLevel(n = 1) {
                if (!g.player) return false;
                for (let i = 0; i < n; i++) g.player.gainExp(g.player.expToNext + 1);
                return true;
            },
            /** Knock the player to 1 HP so the next enemy hit ends the run. */
            killPlayer() {
                if (!g.player) return false;
                g.player.hp = 0;
                g.player.dead = true;
                return true;
            },
            /** Spawn the named boss right now (skipping its scheduled time). */
            spawnBoss(id) {
                const def = Object.values(BOSSES).find((b) => b.id === id);
                if (!def) return false;
                g._spawnBoss(def, 1, 1);
                g._bossesSpawned.add(def.id);
                return true;
            }
        };
    }
    return g;
}

// Re-export for any external script that needs the catalogue.
export { ACHIEVEMENTS, WAVES };


