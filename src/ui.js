/**
 * @module ui
 * @description All DOM-side glue — HUD, menus, settings panel, achievement
 * gallery, level-up overlay. Intentionally decoupled from the render loop so
 * UI state mutations always funnel through these helpers (easier to audit,
 * easier to swap renderers later).
 *
 * Dependencies: `./data.js`, `./config.js`, `./i18n.js`.
 *
 * Exports:
 *   - class UI               cached element references + render helpers
 *   - totalAchievements()    convenience for tests / badges
 */

import { ACHIEVEMENTS, PASSIVES, WEAPONS } from './data.js?v=tactics-106';
import { CONFIG } from './config.js?v=base-87';
import { skillChange, skillKey } from './skill-presentation.js?v=ui-980';
import { showPrologueSkills } from './prologue-skills-ui.js?v=design-127';
import { buildSkillTree, skillChoice } from './skill-tree.js?v=design-127';
import { TEMPORARY_BOOSTS, FIELD_MODULES } from './temporary-boosts.js?v=space-7';
import { t, setLocale, availableLocales } from './i18n.js';
import { calculatePoints, formatPoints } from './records.js';
import { getStage, listStages } from './stages.js?v=space-4';
import { buildShareText, dailyStreakSummary, loadDailyHistory } from './daily.js';
import {
    DEFAULT_KEYMAP,
    KEYMAP_ACTIONS,
    bindKey,
    cloneKeymap,
    detectConflicts,
    keyLabel,
    normaliseKey
} from './keymap.js';

export class UI {
    constructor(game) {
        this.game = game;
        this.els = {};
        this._cache();
    }

    _cache() {
        const ids = [
            'hp',
            'maxHp',
            'hpBar',
            'shieldHud',
            'temporaryBoostHud',
            'shieldValue',
            'shieldMax',
            'level',
            'expBar','expLabel',
            'time',
            'kills',
            'score',
            'finalScore',
            'finalRecordBadge',
            'weaponIcons',
            'startScreen',
            'gameOver',
            'finalTime',
            'finalKills',
            'finalLevel',
            'levelUpMenu',
            'upgradeOptions',
            'levelUpTechNote',
            'pauseMenu',
            'settingsMenu',
            'fpsCounter',
            'bossBanner',
            'highScore',
            'passiveIcons',
            'achievementToasts',
            'highScoreList',
            'waveLabel',
            'creditHud',
            'baseBearing',
            'raidBanner',
            'dockAction',
            'achievementsScreen',
            'leaderboardScreen',
            'stagePickerScreen',
            'streakScreen',
            'helpScreen',
            'howToPlayScreen',
            'btnStageChip'
        ];
        for (const id of ids) this.els[id] = document.getElementById(id);
        // iter-20: harden ARIA on the dynamic overlay hosts. The static
        // overlays in index.html (`startScreen`, `levelUpMenu`, `pauseMenu`,
        // `gameOver`) already declare role+aria-modal at the markup level;
        // these are the dynamically-populated dialogs that share the same
        // `.overlay` class and need the same announcement contract for
        // assistive tech to pick them up consistently.
        for (const id of [
            'achievementsScreen',
            'leaderboardScreen',
            'stagePickerScreen',
            'streakScreen',
            'helpScreen',
            'howToPlayScreen',
            'settingsMenu'
        ]) {
            const el = this.els[id];
            if (!el || typeof el.setAttribute !== 'function') continue;
            // Some test stubs don't implement hasAttribute — fall back to
            // unconditional set in that case, which is still idempotent.
            const hasAttr = typeof el.hasAttribute === 'function';
            if (!hasAttr || !el.hasAttribute('role')) el.setAttribute('role', 'dialog');
            if (!hasAttr || !el.hasAttribute('aria-modal')) el.setAttribute('aria-modal', 'true');
        }
    }

    /**
     * Full-screen leaderboard dialog. Renders both regular + speedrun runs in
     * separate scrollable sections, with export/import for sharing. This is
     * the main-menu entry point; the game-over summary still shows a compact
     * top-10 list inside the run recap.
     */
    /**
     * Render the stage picker overlay. Each stage card shows the icon, name
     * and tagline; the active one gets the `active` class so users see what
     * they've selected. Selecting a card persists via the supplied callback
     * and closes the dialog.
     */
    showStagePicker(currentId, onPick) {
        const m = this.els.stagePickerScreen;
        if (!m) return;
        const stages = listStages();
        m.innerHTML = `
            <div class="overlay-card stage-picker-card">
                <h2>${t('chooseStage')}</h2>
                <div class="stage-grid">
                    ${stages
                        .map(
                            (s) => `
                            <button class="stage-card ${s.id === currentId ? 'active' : ''}" data-stage="${s.id}">
                                <div class="stage-icon">${s.icon}</div>
                                <div class="stage-name">${s.name}</div>
                                <div class="stage-desc">${s.description}</div>
                            </button>`
                        )
                        .join('')}
                </div>
                <div class="btn-row">
                    <button id="stageClose" class="btn primary">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
        };
        m.querySelector('#stageClose')?.addEventListener('click', close);
        m.querySelectorAll('.stage-card').forEach((btn) =>
            btn.addEventListener('click', () => {
                const id = btn.dataset.stage;
                onPick && onPick(id);
                close();
            })
        );
    }

    hideStagePicker() {
        if (this.els.stagePickerScreen) this.els.stagePickerScreen.style.display = 'none';
    }

    /**
     * Refresh the stage chip rendered inside the main-menu Stage button so the
     * player can see at a glance which map a "Start Run" press would launch.
     * Cheap to call repeatedly — just innerText + className updates.
     */
    updateStageChip(stageId) {
        if (!this.els.btnStageChip) return;
        const s = getStage(stageId);
        // The chip carries the stage icon + name; we keep it short so the
        // button stays one line at the default font size.
        this.els.btnStageChip.textContent = `${s.icon} ${s.name}`;
        this.els.btnStageChip.dataset.stage = s.id;
    }

    /**
     * Render the daily-streak overlay: a 14-day calendar showing which days
     * the player has logged a daily run, plus current and best streak chips.
     * Read-only (no callbacks beyond close); the daily run itself starts via
     * the regular Daily Challenge button.
     */
    showStreak(onClose) {
        const m = this.els.streakScreen;
        if (!m) return;
        const summary = dailyStreakSummary(loadDailyHistory());
        // Render the 14 cells oldest -> newest so the row reads left-to-right
        // like a calendar; reverse the summary array (which is newest-first).
        const cells = summary.days.slice().reverse();
        const cellHtml = cells
            .map((d) => {
                const cls = d.played
                    ? d.won
                        ? 'streak-cell won'
                        : 'streak-cell played'
                    : 'streak-cell missed';
                const tip = d.played
                    ? `${d.date} · ${Math.floor(d.timeSurvived / 60)}:${String(Math.floor(d.timeSurvived % 60)).padStart(2, '0')} · ${d.kills} убийств`
                    : `${d.date} — без забега`;
                const day = d.date.slice(8);
                return `<div class="${cls}" title="${tip}" aria-label="${tip}">${day}</div>`;
            })
            .join('');
        const empty =
            summary.current === 0 && summary.best === 0
                ? `<div class="hs-empty">${t('noStreakYet')}</div>`
                : '';
        m.innerHTML = `
            <div class="overlay-card streak-card">
                <h2>${t('dailyStreak')}</h2>
                <div class="streak-stats">
                    <div class="streak-pill"><span>${t('currentStreak')}</span><strong>${summary.current}</strong></div>
                    <div class="streak-pill"><span>${t('bestStreak')}</span><strong>${summary.best}</strong></div>
                </div>
                <div class="streak-label">${t('last14Days')}</div>
                <div class="streak-grid" role="list">${cellHtml}</div>
                ${empty}
                <div class="btn-row">
                    <button id="streakClose" class="btn primary">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
            onClose && onClose();
        };
        m.querySelector('#streakClose')?.addEventListener('click', close);
    }

    hideStreak() {
        if (this.els.streakScreen) this.els.streakScreen.style.display = 'none';
    }

    /** Keyboard-shortcuts help overlay. Mirrors the H hotkey. */
    showHelp(onClose) {
        const m = this.els.helpScreen;
        if (!m) return;
        const touchControls = !!window.matchMedia?.('(any-pointer: coarse)').matches;
        const rows = touchControls ? [
            ['◉', 'Передвигайтесь джойстиком слева внизу'],
            ['⏸', 'Пауза — кнопка справа вверху'],
            ['🗺', 'Карта мира — кнопка справа вверху'],
            ['📋', 'Журнал миссии — кнопка справа вверху'],
            ['⚙', 'База — кнопка справа, когда вы рядом'],
            ['✦', 'Действие миссии — кнопка справа при доступной цели']
        ] : [
            ['WASD / ←↑↓→', t('helpKeyMove')],
            ['P / Esc', t('helpKeyPause')],
            ['M', t('helpKeyMute')],
            ['H / ?', t('helpKeyHelp')],
            [',', t('helpKeySettings')],
            ['Enter / Space', t('helpKeyConfirm')]
        ];
        m.innerHTML = `
            <div class="overlay-card help-card">
                <h2>${t('helpTitle')}</h2>
                <div class="help-rows">
                    ${rows
                        .map(
                            ([k, v]) =>
                                `<div class="help-row"><kbd>${k}</kbd><span>${v}</span></div>`
                        )
                        .join('')}
                </div>
                <div class="btn-row">
                    <button id="helpClose" class="btn primary">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
            onClose && onClose();
        };
        m.querySelector('#helpClose')?.addEventListener('click', close);
    }

    hideHelp() {
        if (this.els.helpScreen) this.els.helpScreen.style.display = 'none';
    }

    /** First-launch / on-demand "How to play" overlay. */
    showHowToPlay(onClose) {
        const m = this.els.howToPlayScreen;
        if (!m) return;
        const touchControls = !!window.matchMedia?.('(any-pointer: coarse)').matches;
        const moveHint = touchControls
            ? 'Управляйте кораблём джойстиком внизу слева. Оружие само атакует ближайших врагов.'
            : t('howToBody1');
        const actionHint = touchControls
            ? 'Пауза, карта и журнал миссии открываются экранными кнопками справа вверху. Звук включается в главном меню.'
            : t('howToBody4');
        m.innerHTML = `
            <div class="overlay-card howto-card">
                <h2>${t('howToTitle')}</h2>
                <ol class="howto-list">
                    <li>${moveHint}</li>
                    <li>${t('howToBody2')}</li>
                    <li>${t('howToBody3')}</li>
                    <li>${actionHint}</li>
                    <li>${t('howToBody5')}</li>
                    <li>⚠️ Через семь секунд без движения орбитальные пушки наводятся на корабль. Выходите из красных кругов.</li>
                    <li>☄️ Разбивайте астероиды и собирайте энергию для усиления корабля, щитов и оружия.</li>
                </ol>
                <div class="btn-row">
                    <button id="howtoClose" class="btn primary">${t('gotIt')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
            onClose && onClose();
        };
        m.querySelector('#howtoClose')?.addEventListener('click', close);
    }

    hideHowToPlay() {
        if (this.els.howToPlayScreen) this.els.howToPlayScreen.style.display = 'none';
    }

    /**
     * iter-15: replay menu. Shows a short summary of the saved replay and
     * three speed buttons (1×, 2×, 4×). When `blob` is null we render a
     * "no replay yet" empty state and only show Close.
     */
    showReplayMenu(blob, onPlay) {
        let m = document.getElementById('replayScreen');
        if (!m) {
            m = document.createElement('div');
            m.id = 'replayScreen';
            m.className = 'overlay';
            m.style.display = 'none';
            const container = document.getElementById('gameContainer');
            container?.appendChild(m);
        }
        if (!blob) {
            m.innerHTML = `
                <div class="overlay-card replay-card">
                    <h2>${t('replayLastRun')}</h2>
                    <div class="hs-empty">${t('noReplay')}</div>
                    <div class="btn-row">
                        <button id="replayClose" class="btn primary">${t('close')}</button>
                    </div>
                </div>`;
            m.style.display = 'flex';
            m.querySelector('#replayClose')?.addEventListener('click', () => {
                m.style.display = 'none';
            });
            return;
        }
        const mm = Math.floor((blob.finalTime || 0) / 60)
            .toString()
            .padStart(2, '0');
        const ss = Math.floor((blob.finalTime || 0) % 60)
            .toString()
            .padStart(2, '0');
        m.innerHTML = `
            <div class="overlay-card replay-card">
                <h2>${t('replayLastRun')}</h2>
                <div class="replay-summary">
                    <div><strong>${t('time')}:</strong> ${mm}:${ss}</div>
                    <div><strong>${t('level')}:</strong> ${blob.finalLevel ?? 1}</div>
                    <div><strong>${t('kills')}:</strong> ${blob.finalKills ?? 0}</div>
                    <div><strong>${t('stage')}:</strong> ${getStage(blob.stage).name}</div>
                </div>
                <div class="btn-row" role="group" aria-label="${t('replaySpeed')}">
                    <button class="btn primary" data-replay-speed="1">1×</button>
                    <button class="btn ghost" data-replay-speed="2">2×</button>
                    <button class="btn ghost" data-replay-speed="4">4×</button>
                </div>
                <div class="btn-row">
                    <button id="replayClose" class="btn ghost">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
        };
        m.querySelectorAll('[data-replay-speed]').forEach((b) =>
            b.addEventListener('click', () => {
                const s = parseFloat(b.dataset.replaySpeed) || 1;
                close();
                onPlay && onPlay(s);
            })
        );
        m.querySelector('#replayClose')?.addEventListener('click', close);
    }

    showLeaderboard(normalScores, speedrunScores, onClose) {
        const m = this.els.leaderboardScreen;
        if (!m) return;
        const renderRow = (r, i) => {
            const mm = Math.floor((r.timeSurvived ?? 0) / 60)
                .toString()
                .padStart(2, '0');
            const ss = Math.floor((r.timeSurvived ?? 0) % 60)
                .toString()
                .padStart(2, '0');
            const d = new Date(r.date || 0);
            const dstr = isNaN(d.getTime())
                ? '—'
                : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                      d.getDate()
                  ).padStart(2, '0')}`;
            const ws = Array.isArray(r.weapons) && r.weapons.length
                ? r.weapons.map((id) => Object.values(WEAPONS).find((w) => w.id === id)?.name || id).join(' + ')
                : '—';
            const nh = r.noHit ? `<span class="no-hit">${t('noHit')}</span>` : '';
            return `<div class="hs-row wide"><span>${i + 1}</span><span>${formatPoints(r.points ?? calculatePoints({ seconds: r.timeSurvived, kills: r.kills, level: r.level }))}</span><span>${mm}:${ss}</span><span>Ур. ${r.level ?? 1}</span><span>${r.kills ?? 0}</span><span class="weapons">${ws}</span><span>${dstr}</span><span>${nh}</span></div>`;
        };
        const renderSpeedRow = (r, i) => {
            const ms = r.timeMs || 0;
            const mm = Math.floor(ms / 60000)
                .toString()
                .padStart(2, '0');
            const ss = Math.floor((ms % 60000) / 1000)
                .toString()
                .padStart(2, '0');
            const ml = Math.floor(ms % 1000)
                .toString()
                .padStart(3, '0');
            const d = new Date(r.date || 0);
            const dstr = isNaN(d.getTime())
                ? '—'
                : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                      d.getDate()
                  ).padStart(2, '0')}`;
            const ws = Array.isArray(r.weapons) && r.weapons.length
                ? r.weapons.map((id) => Object.values(WEAPONS).find((w) => w.id === id)?.name || id).join(' + ')
                : '—';
            return `<div class="hs-row wide"><span>${i + 1}</span><span>${formatPoints(r.points ?? calculatePoints({ seconds: r.timeMs / 1000, kills: r.kills, level: r.level }))}</span><span>${mm}:${ss}.${ml}</span><span>Ур. ${r.level ?? 1}</span><span>${r.kills ?? 0}</span><span class="weapons">${ws}</span><span>${dstr}</span><span>${r.noHit ? t('noHit') : ''}</span></div>`;
        };
        m.innerHTML = `
            <div class="overlay-card leaderboard-card">
                <h2>${t('leaderboard')}</h2>
                <section class="lb-section">
                    <h3>${t('highScores')} (${normalScores.length})</h3>
                    <div class="hs-list scroll">
                        ${
                            normalScores.length
                                ? `<div class="hs-head wide"><span>#</span><span>${t('score')}</span><span>${t('time')}</span><span>${t('level')}</span><span>${t('kills')}</span><span>${t('weapons')}</span><span>${t('date')}</span><span>${t('noHit')}</span></div>` +
                                  normalScores.map(renderRow).join('')
                                : `<div class="hs-empty">${t('noHighScores')}</div>`
                        }
                    </div>
                </section>
                <section class="lb-section">
                    <h3>${t('speedrun')} (${speedrunScores.length})</h3>
                    <div class="hs-list scroll">
                        ${
                            speedrunScores.length
                                ? `<div class="hs-head wide"><span>#</span><span>${t('score')}</span><span>${t('time')}</span><span>${t('level')}</span><span>${t('kills')}</span><span>${t('weapons')}</span><span>${t('date')}</span></div>` +
                                  speedrunScores.map(renderSpeedRow).join('')
                                : `<div class="hs-empty">${t('noHighScores')}</div>`
                        }
                    </div>
                </section>
                <textarea id="lbJson" class="lb-json" rows="4" aria-label="${t('paste')}" placeholder='${t('paste')}'></textarea>
                <div class="btn-row">
                    <button id="lbExport" class="btn ghost">${t('export')}</button>
                    <button id="lbImport" class="btn ghost">${t('import')}</button>
                    <button id="lbClose" class="btn primary">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
            onClose && onClose();
        };
        m.querySelector('#lbClose')?.addEventListener('click', close);
        const ta = m.querySelector('#lbJson');
        m.querySelector('#lbExport')?.addEventListener('click', () => {
            if (ta) ta.value = JSON.stringify({ normal: normalScores, speedrun: speedrunScores });
        });
        m.querySelector('#lbImport')?.addEventListener('click', () => {
            if (!ta?.value?.trim()) return;
            try {
                const parsed = JSON.parse(ta.value);
                // Caller wires the merge into storage; here we just fire an event.
                const ev = new CustomEvent('vs-leaderboard-import', { detail: parsed });
                window.dispatchEvent(ev);
            } catch (err) {
                console.warn('[ui] Import JSON parse failed', err);
                ta.value = 'Неверный JSON: ' + err.message;
            }
        });
    }

    hideLeaderboard() {
        if (this.els.leaderboardScreen) this.els.leaderboardScreen.style.display = 'none';
    }

    /**
     * Render the achievements gallery as a grid of locked/unlocked cards.
     * @param {Record<string, number>} unlocked - id → unlock timestamp
     * @param {() => void} onClose
     */
    showAchievements(unlocked, onClose) {
        const m = this.els.achievementsScreen;
        if (!m) return;
        const total = ACHIEVEMENTS.length;
        const earned = ACHIEVEMENTS.filter((a) => unlocked[a.id]).length;
        m.innerHTML = `
            <div class="overlay-card achievements-card">
                <h2>${t('achievements')} <span class="ach-count">${earned} / ${total}</span></h2>
                <div class="ach-grid">
                    ${ACHIEVEMENTS.map((a) => {
                        const got = !!unlocked[a.id];
                        return `
                            <div class="ach-card ${got ? 'earned' : 'locked'}">
                                <div class="ach-card-icon">${got ? a.icon : '🔒'}</div>
                                <div class="ach-card-name">${got ? a.name : '???'}</div>
                                <div class="ach-card-desc">${a.description}</div>
                            </div>`;
                    }).join('')}
                </div>
                <div class="btn-row">
                    <button id="achClose" class="btn primary">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        const close = () => {
            m.style.display = 'none';
            onClose && onClose();
        };
        m.querySelector('#achClose')?.addEventListener('click', close);
    }

    hideAchievements() {
        if (this.els.achievementsScreen) this.els.achievementsScreen.style.display = 'none';
    }

    updateHud(game, force=false) {
        const p = game.player;
        const now=game.gameTime||0;
        const urgent=this._hudPlayer!==p || this._hudHp!==Math.ceil(p.hp) || this._hudLevel!==p.level;
        if(!force && !urgent && now>=this._hudLast && now+1e-6<this._hudNext)return;
        this._hudPlayer=p;this._hudHp=Math.ceil(p.hp);this._hudLevel=p.level;
        this._hudLast=now;this._hudNext=now+.05;
        this.els.hp.textContent = Math.ceil(p.hp);
        this.els.maxHp.textContent = Math.ceil(p.maxHp);
        this.els.hpBar.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
        if (this.els.shieldHud) {
            this.els.shieldHud.style.display = p.maxShield > 0 ? 'block' : 'none';
            if (p.maxShield > 0) {
                this.els.shieldValue.textContent = Math.ceil(p.shield);
                this.els.shieldMax.textContent = Math.ceil(p.maxShield);
            }
        }
        if (this.els.temporaryBoostHud) {
            const active = Object.entries(p.temporaryBoosts || {})
                .filter(([id, seconds]) => seconds > 0 && TEMPORARY_BOOSTS[id])
                .sort((a, b) => a[0].localeCompare(b[0]));
            const temporary = active.map(([id, seconds]) => {
                const def = TEMPORARY_BOOSTS[id];
                return '<span class="temporary-boost-tag" title="' + def.description +
                    '" style="--boost-color:' + def.color + '">' +
                    def.icon + ' ' + def.name + ' <strong>' +
                    Math.ceil(seconds) + ' с</strong></span>';
            }).join('');
            const modules = Object.entries(p.fieldModules || {})
                .filter(([id,count]) => count > 0 && FIELD_MODULES[id])
                .sort((a,b) => a[0].localeCompare(b[0]))
                .map(([id,count]) => {
                    const def = FIELD_MODULES[id];
                    return '<span class="temporary-boost-tag" title="' + def.description +
                        '" style="--boost-color:' + def.color + '">' +
                        def.icon + ' ' + def.name + ' <strong>×' + count +
                        ' · забег</strong></span>';
                }).join('');
            const markup = temporary + modules;
            if (this.els.temporaryBoostHud.innerHTML !== markup) {
                this.els.temporaryBoostHud.innerHTML = markup;
            }
            this.els.temporaryBoostHud.style.display = markup ? 'flex' : 'none';
        }
        this.els.level.textContent = p.level;
        const xpLabel=this.els.expLabel;
        if(xpLabel)xpLabel.textContent=p.trainingProgression?'Улучшения':t('xp');
        this.els.expBar.style.width = Math.min(100, (p.exp / p.expToNext) * 100) + '%';

        const m = Math.floor(game.gameTime / 60)
            .toString()
            .padStart(2, '0');
        const s = Math.floor(game.gameTime % 60)
            .toString()
            .padStart(2, '0');
        this.els.time.textContent = `${m}:${s}`;
        this.els.kills.textContent = game.kills;
        if (this.els.score) this.els.score.textContent = formatPoints(calculatePoints({
            seconds: game.gameTime, kills: game.kills, level: p.level,
            bosses: Object.keys(game.run?.bossesDefeated || {}).length
        }));

        if (this.els.highScore) {
            const hs = game.save.highScore;
            const hm = Math.floor(hs.timeSurvived / 60)
                .toString()
                .padStart(2, '0');
            const hsec = Math.floor(hs.timeSurvived % 60)
                .toString()
                .padStart(2, '0');
            this.els.highScore.textContent = `${t('highScore')}: ${formatPoints(hs.points ?? calculatePoints({ seconds: hs.timeSurvived, kills: hs.kills, level: hs.level }))} ${t('points')}`;
        }

        if (this.els.waveLabel && game.currentWave) {
            this.els.waveLabel.textContent = game.missionWorld?.index===0 ? game.missionWorld.encounterLabel() : `${t('wave')}: ${game.currentWave.label}`;
        }
        const station = game.friendlyBases?.status(game);
        const insidePrologue = game.missionWorld?.index===0;
        if (this.els.creditHud) {
            this.els.creditHud.style.display = station?.enabled ? 'block' : 'none';
            if (station?.enabled) this.els.creditHud.textContent = insidePrologue
                ? '⚙ ДЕТАЛИ ' + station.credits
                : '⚙ ' + station.credits + ' · 🛸 ' + station.escorts + ' · ⚡ СЕТЬ ' + station.techTier + '/3';
        }
        if (this.els.baseBearing) {
            this.els.baseBearing.style.display = !insidePrologue && station?.base ? 'block' : 'none';
            if (!insidePrologue && station?.base) {
                const destination = station.dockable ? station.base :
                    station.objective || station.base;
                const dx = destination.x - game.player.x;
                const dy = destination.y - game.player.y;
                const oct = Math.round(Math.atan2(-dy,dx)/(Math.PI/4));
                const dirs = ['→','↗','↑','↖','←','↙','↓','↘'];
                const direction = dirs[((oct%8)+8)%8];
                const distance = Math.round(Math.hypot(dx,dy));
                const def = game.friendlyBases.typeInfo(destination);
                this.els.baseBearing.textContent = station.dockable
                    ? '🛠️ ' + station.name + ' · E — ДОК · ' + station.distance + ' ед.'
                    : (station.objective ? '🧭 СЛЕДУЮЩАЯ ЦЕЛЬ · ' : '📡 БАЗА · ') +
                        direction + ' ' + def.name + ' · ' + distance + ' ед.' +
                        (destination.visited ? '' : ' · РАЗВЕДКА +12 XP');
            }
        }
        if(this.els.raidBanner) {
            const raid=game.friendlyBases?.raidStatus(game);
            this.els.raidBanner.style.display=raid?'block':'none';
            if(raid) {
                this.els.raidBanner.classList.toggle('raid-active',
                    raid.state==='active');
                this.els.raidBanner.textContent=raid.state==='warning'
                    ?'⚠ НАЛЁТ НА БАЗУ ЧЕРЕЗ '+raid.seconds+' с · '+
                        raid.direction+' '+raid.distance+' ед. · '+raid.name
                    :'⚔ ЗАЩИТА БАЗЫ '+raid.hp+'/'+raid.maxHp+
                        ' HP · БОМБАРДИРОВЩИКИ: '+raid.bombers+
                        ' · '+raid.direction+' '+raid.distance+' ед.';
            }
        }
        if (this.els.dockAction) {
            const label = document.body.classList.contains('survivor-touch-layout') ?
                '⚙ БАЗА' : '⚙ БАЗА · E';
            if (this.els.dockAction.textContent !== label) this.els.dockAction.textContent = label;
            this.els.dockAction.style.display = !insidePrologue && station?.dockable ? 'block' : 'none';
            this.els.dockAction.disabled = insidePrologue || !station?.dockable;
        }

        // Weapon icons
        this._renderChips(
            this.els.weaponIcons,
            p.weapons.map((w) => ({
                icon: w.icon,
                level: w.level,
                max: CONFIG.WEAPON_MAX_LEVEL,
                evolved: !!w.isEvolved?.()
            }))
        );
        // Passive icons
        const passives = [];
        for (const id in p.passives) {
            const p2 = p.passives[id];
            passives.push({ icon: p2.def.icon, level: p2.count, max: CONFIG.PASSIVE_MAX_STACK });
        }
        this._renderChips(this.els.passiveIcons, passives);
    }

    _renderChips(container, items) {
        if (!container) return;
        this._chipSignatures ??= new WeakMap();
        const signature=items.map(item=>[item.icon,item.level,item.max,!!item.evolved].join(':')).join('|');
        if(this._chipSignatures.get(container)===signature)return;
        this._chipSignatures.set(container,signature);
        container.innerHTML = '';
        for (const it of items) {
            const div = document.createElement('div');
            div.className = 'chip active' + (it.level >= it.max ? ' maxed' : '');
            if (it.evolved) div.classList.add('evolved');
            div.textContent = it.icon;
            const lvl = document.createElement('span');
            lvl.className = 'chip-lvl';
            lvl.textContent = it.level;
            div.appendChild(lvl);
            container.appendChild(div);
        }
    }

    setFps(fps, show) {
        if (!this.els.fpsCounter) return;
        this.els.fpsCounter.style.display = show ? 'block' : 'none';
        if(show){
            const text=`${Math.round(fps)} fps`;
            if(this.els.fpsCounter.textContent!==text)this.els.fpsCounter.textContent=text;
        }
    }

    /** Fullscreen elements form a top layer: the atlas must live inside it. */
    _rehomeSkillOverlay() {
        if (!this._skillOriginalParent || !this.els.levelUpMenu) return;
        const full = document.fullscreenElement || document.webkitFullscreenElement;
        const fullOwnsGame = full && (full === this._skillOriginalParent ||
            full.contains?.(this._skillOriginalParent));
        const host = fullOwnsGame ? full : document.body;
        if (this.els.levelUpMenu.parentElement !== host)
            host.appendChild(this.els.levelUpMenu);
        if (this._drawSkillLinks && typeof requestAnimationFrame === 'function')
            requestAnimationFrame(this._drawSkillLinks);
    }

    /** Inspect dependencies and real stat changes before spending one level-up. */
    showSkillTree(player, onPick, options = {}) {
        const preview = !!options.preview;
        const network = options.network ?? this.game.friendlyBases;
        const mission = options.missionRules ?? this.game.activeMission;
        if(mission?.index===0)return showPrologueSkills(this,player,onPick,options);
        const root = this.els.upgradeOptions;
        const title = document.getElementById('levelUpTitle');
        if (title) title.textContent = preview ? 'Развитие корабля · обзор' : 'Развитие корабля';
        const tree = buildSkillTree(player, network, mission);
        const tech = this.els.levelUpTechNote;
        if (tech) {
            tech.style.display = 'block';
            tech.textContent = (preview ? 'Без покупки' : '1 очко развития') +
                ' · уровень ' + player.level + ' · доступный ранг ' + tree.cap + '/5' +
                (mission ? ' · миссия ' + String(mission.index).padStart(2, '0') : '') +
                (options.catalogue ? ' · начальное оснащение' : ' · игра на паузе');
        }
        this._skillOriginalParent ??= this.els.levelUpMenu.parentElement;
        if (!this._skillFullscreenHandler && document.addEventListener) {
            this._skillFullscreenHandler = () => {
                if (this.els.levelUpMenu.classList.contains('skill-tree-mode'))
                    this._rehomeSkillOverlay();
            };
            document.addEventListener('fullscreenchange', this._skillFullscreenHandler);
            document.addEventListener('webkitfullscreenchange', this._skillFullscreenHandler);
        }
        this._skillResizeObserver?.disconnect();
        this._rehomeSkillOverlay();
        this.els.levelUpMenu.classList.add('skill-tree-mode');
        root.setAttribute('role', 'group');
        const preferred = {fighter:'weapons',mage:'tech',scout:'ship'}[this.game.buildStyle] || 'weapons';
        const selected = tree.branches.find(b => b.id === this._treeBranch) ? this._treeBranch : preferred;
        this._treeBranch = selected;
        root.replaceChildren();
        const el = (tag, cls, text) => {
            const result = document.createElement(tag);
            if (cls) result.className = cls;
            if (text !== undefined) result.textContent = text;
            return result;
        };
        const atlas = el('div', 'skill-atlas');
        const toolbar = el('div', 'skill-toolbar');
        toolbar.appendChild(el('p', 'skill-instruction', preview ?
            'Выберите навык, чтобы прочитать условия открытия.' :
            'Выберите навык → изучите эффект → подтвердите улучшение.'));
        if (preview) {
            const close = el('button', 'skill-preview-close', options.closeLabel || '← К паузе');
            close.type = 'button';
            close.addEventListener('click', () => options.onClose?.());
            toolbar.appendChild(close);
        }
        atlas.appendChild(toolbar);
        const tabs = el('div', 'skill-tabs');
        tabs.setAttribute('role', 'tablist');
        tabs.setAttribute('aria-label', 'Направления развития');
        for (const branch of tree.branches) {
            const tab = el('button', 'skill-tab' + (branch.id === selected ? ' selected' : ''));
            tab.type = 'button';
            tab.id = 'tree-tab-' + branch.id;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', String(branch.id === selected));
            tab.setAttribute('aria-controls', 'skill-branch-panel');
            tab.tabIndex = branch.id === selected ? 0 : -1;
            tab.appendChild(el('span', '', branch.title));
            const count = branch.tiers.flat().filter(node => node.state === 'available').length;
            const badge = el('span', 'skill-tab-count', String(count));
            badge.setAttribute('aria-label', count + ' доступных вариантов');
            tab.appendChild(badge);
            const activate = () => {
                this._treeBranch = branch.id;
                this.showSkillTree(player, onPick, {...options, focusTab: true});
            };
            tab.addEventListener('click', activate);
            tab.addEventListener('keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault(); event.stopPropagation();
                const index = tree.branches.indexOf(branch);
                this._treeBranch = tree.branches[event.key === 'Home' ? 0 :
                    event.key === 'End' ? tree.branches.length - 1 :
                    (index + (event.key === 'ArrowLeft' ? -1 : 1) + tree.branches.length) % tree.branches.length].id;
                this.showSkillTree(player, onPick, {...options, focusTab: true});
            });
            tabs.appendChild(tab);
        }
        atlas.appendChild(tabs);
        const active = tree.branches.find(b => b.id === selected);
        const viewport = el('div', 'skill-map-scroll');
        viewport.id = 'skill-branch-panel';
        viewport.setAttribute('role', 'tabpanel');
        viewport.setAttribute('aria-labelledby', 'tree-tab-' + selected);
        viewport.setAttribute('tabindex', '0');
        const path = el('div', 'skill-path');
        const links = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        links.setAttribute('class', 'skill-links');
        links.setAttribute('aria-hidden', 'true');
        path.appendChild(links);
        const nodeEntries = [];
        const nodeButtons = new Map();
        const inspect = el('section', 'skill-inspect');
        inspect.setAttribute('aria-label', 'Выбранное улучшение');
        const inspectContent = el('div', 'skill-inspect-content');
        inspectContent.setAttribute('aria-live', 'polite');
        const inspectHead = el('div', 'skill-inspect-heading');
        const inspectIcon = el('span', 'skill-inspect-icon');
        inspectIcon.setAttribute('aria-hidden', 'true');
        const inspectName = el('h3');
        inspectHead.append(inspectIcon, inspectName);
        const inspectBadge = el('span', 'skill-state-badge');
        const inspectBody = el('p', 'skill-effect');
        const stats = el('dl', 'skill-stat-changes');
        const inspectStatus = el('p', 'skill-inspect-status');
        const inspectFuture = el('p', 'skill-future-paths');
        inspectContent.append(inspectBadge, inspectHead, stats, inspectBody, inspectStatus, inspectFuture);
        const learn = el('button', 'skill-learn');
        learn.type = 'button';
        const purchaseHint = el('p', 'skill-purchase-hint', preview ?
            'Обзор: очки не расходуются.' : 'Цена: 1 очко. После выбора полёт продолжится.');
        inspect.append(inspectContent, purchaseHint, learn);
        let selectedNode = null;
        let picked = false;
        const commit = choice => {
            if (!choice || preview || picked || typeof onPick !== 'function') return;
            picked = true; learn.disabled = true; onPick(choice);
        };
        const selectButton = button => {
            if (selectedNode) {
                selectedNode.classList.remove('is-selected');
                selectedNode.setAttribute('aria-pressed', 'false');
            }
            selectedNode = button;
            button.classList.add('is-selected');
            button.setAttribute('aria-pressed', 'true');
        };
        const showNode = (node, button) => {
            selectButton(button);
            this._treeSelection = skillKey(node);
            inspectIcon.textContent = node.def.icon;
            inspectName.textContent = node.def.name;
            inspectBody.textContent = node.def.description;
            inspect.dataset.state = node.state;
            inspectBadge.dataset.state = node.state;
            inspectBadge.textContent = node.state === 'available' ?
                (preview ? 'Можно выбрать при повышении уровня' : 'Доступно сейчас') :
                node.state === 'maxed' ? 'Максимальный ранг' : 'Пока закрыто';
            const parentNames = (node.parents || []).map(token =>
                nodeEntries.find(entry => entry.token === token)?.node.def.name || token.split(':')[1]);
            const reason = node.reason === 'Сначала откройте связанный родительский навык' ?
                'Сначала изучите: ' + parentNames.join(' или ') + '.' : node.reason;
            inspectStatus.textContent = node.state === 'locked' ? reason + (parentNames.length && !reason.includes(parentNames[0]) ? ' Связан с: ' + parentNames.join(' или ') + '.' : '') :
                node.state === 'maxed' ? 'Все ранги этого навыка уже изучены.' :
                node.fork ? 'Вы выбираете одну специализацию. Другой путь для этого оружия станет недоступен.' :
                parentNames.length ? 'Связь с навыком: ' + parentNames.join(' или ') + '.' : 'Начальный навык этой ветки.';
            inspectFuture.textContent = node.futurePaths?.length ?
                'На IV ранге: ' + node.futurePaths.join(' / ') + '. Выбор откроется при выполнении условий кампании и сети.' : '';
            stats.replaceChildren();
            if (node.state !== 'maxed') {
                for (const change of skillChange(node, player)) {
                    const item = el('div');
                    item.append(el('dt', '', change.label),
                        el('dd', '', change.before + ' → ' + change.after));
                    stats.appendChild(item);
                }
            }
            learn.hidden = preview;
            learn.disabled = node.state !== 'available' || picked;
            learn.textContent = node.fork ? 'Выбрать путь · 1 очко' :
                node.rank ? 'Улучшить · 1 очко' : 'Изучить · 1 очко';
            learn.onclick = () => {
                const validated = skillChoice(player, network, node.kind, node.id, node.specialization, mission);
                if (validated) commit(validated);
            };
        };
        for (const [index, nodes] of active.tiers.entries()) {
            const tier = el('section', 'skill-tier');
            tier.appendChild(el('h3', '', ['I · Основа', 'II · Развитие', 'III · Высшие навыки'][index]));
            const row = el('div', 'skill-tier-nodes');
            for (const [rowIndex, node] of nodes.entries()) {
                const button = el('button', 'skill-node ' + node.state + (node.fork ? ' fork-choice' : ''));
                button.type = 'button';
                const token = node.kind + ':' + node.id;
                button.dataset.skill = token;
                button.append(el('span', 'skill-node-icon', node.def.icon),
                    el('span', 'skill-node-rank', node.rank + '/' + node.maximum),
                    el('span', 'skill-node-title', node.def.name),
                    el('span', 'skill-node-state', node.state === 'available' ? '+ Доступно' :
                        node.state === 'maxed' ? '✓ Изучено' : '○ Закрыто'));
                button.setAttribute('aria-pressed', 'false');
                button.setAttribute('aria-label', node.def.name + '. Ранг ' + node.rank + ' из ' + node.maximum +
                    '. ' + (node.state === 'available' ? 'Доступно' : node.reason));
                button.addEventListener('click', () => showNode(node, button));
                button.addEventListener('keydown', event => {
                    if (!event.key.startsWith('Arrow')) return;
                    event.preventDefault(); event.stopPropagation();
                    const targetTier = index + (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0);
                    const targetRow = rowIndex + (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0);
                    const target = nodeEntries.filter(entry => entry.tier === targetTier);
                    const next = target[Math.max(0, Math.min(target.length - 1, targetRow))];
                    if (next) { showNode(next.node, next.button); next.button.focus({preventScroll: true});
                        next.button.scrollIntoView({block: 'nearest', inline: 'nearest'}); }
                });
                row.appendChild(button);
                nodeEntries.push({node, button, token, tier: index});
                if (!nodeButtons.has(token)) nodeButtons.set(token, button);
            }
            tier.appendChild(row); path.appendChild(tier);
        }
        viewport.appendChild(path);
        atlas.append(viewport, inspect);
        if (!preview) {
            const support = el('div', 'skill-support');
            support.appendChild(el('span', 'skill-support-label', 'Вместо навыка:'));
            const supplies = [
                {id:'credits',icon:'⚙',name:'Ресурсы',description:'+18 кредитов'},
                {id:'repair',icon:'💚',name:'Ремонт',description:'+18% корпуса'},
                {id:'scanner',icon:'📡',name:'Разведка',description:'Показать следующую станцию'}
            ];
            for (const def of supplies) {
                if (def.id === 'scanner' && !network.bases.some(base => !base.discovered && base.hp > 0)) continue;
                const button = el('button', 'skill-supply', def.icon + ' ' + def.name);
                button.type = 'button';
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => {
                    selectButton(button);
                    inspectIcon.textContent = def.icon; inspectName.textContent = def.name;
                    inspectBody.textContent = def.description + '. Этот выбор заменяет улучшение навыка на текущем уровне.';
                    inspect.dataset.state = 'available';
                    inspectBadge.textContent = 'Полевое снабжение'; inspectBadge.dataset.state = 'available';
                    stats.replaceChildren(); inspectFuture.textContent = '';
                    const full = def.id === 'repair' && player.hp >= player.maxHp;
                    inspectStatus.textContent = full ? 'Корпус цел. Ремонт сейчас не нужен.' : 'Стоимость: одно очко развития.';
                    learn.disabled = full || picked; learn.hidden = false;
                    learn.textContent = 'Получить · 1 очко';
                    learn.onclick = () => { if (!full) commit({type:'supply',data:def}); };
                });
                support.appendChild(button);
            }
            atlas.appendChild(support);
        }
        root.appendChild(atlas);
        this.els.levelUpMenu.style.display = 'flex';
        const first = nodeEntries.find(entry => skillKey(entry.node) === this._treeSelection) ||
            nodeEntries.find(entry => entry.node.state === 'available') || nodeEntries[0];
        if (first) showNode(first.node, first.button);
        const drawLinks = () => {
            if (!path.isConnected) return;
            const bounds = path.getBoundingClientRect();
            links.setAttribute('viewBox', '0 0 ' + path.clientWidth + ' ' + path.clientHeight);
            links.setAttribute('width', String(path.clientWidth));
            links.setAttribute('height', String(path.clientHeight));
            links.replaceChildren();
            for (const entry of nodeEntries) for (const parent of entry.node.parents || []) {
                const origin = nodeButtons.get(parent);
                if (!origin) continue;
                const a = origin.getBoundingClientRect(), b = entry.button.getBoundingClientRect();
                const x1 = a.right - bounds.left, y1 = a.top + a.height / 2 - bounds.top;
                const x2 = b.left - bounds.left, y2 = b.top + b.height / 2 - bounds.top;
                const bend = Math.max(12, (x2 - x1) * .45);
                const connector = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                connector.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + (x1 + bend) + ',' + y1 +
                    ' ' + (x2 - bend) + ',' + y2 + ' ' + x2 + ',' + y2);
                connector.setAttribute('class', 'skill-link ' + (entry.node.state === 'locked' ? 'is-locked' : 'is-live'));
                links.appendChild(connector);
            }
        };
        this._drawSkillLinks = drawLinks;
        requestAnimationFrame(drawLinks);
        if (typeof ResizeObserver !== 'undefined') {
            this._skillResizeObserver = new ResizeObserver(drawLinks);
            this._skillResizeObserver.observe(path);
        }
        if (options.focusTab) root.querySelector('#tree-tab-' + selected)?.focus({preventScroll: true});
        else if (preview) root.querySelector('.skill-preview-close')?.focus({preventScroll: true});
        else first?.button.focus({preventScroll: true});
    }

    showLevelUp(player, onPick) {
        // Competitive scoreboards and replay playback retain the v8.6 roller.
        // Ordinary expeditions use the visible, predictable 8.7 skill tree.
        if (this.game.friendlyBases?.enabled && !this.game.speedrunMode &&
            !this.game.dailyMode && !this.game.replayActive) {
            this.showSkillTree(player, onPick);
            return;
        }
        const title = document.getElementById('levelUpTitle');
        if (title) title.textContent = 'Выберите улучшение';
        const options = this.els.upgradeOptions;
        options.setAttribute('role', 'menu');
        options.innerHTML = '';
        const techCap=this.game.friendlyBases?.getUpgradeCap?.() ?? CONFIG.WEAPON_MAX_LEVEL;
        if(this.els.levelUpTechNote) {
            const network=this.game.friendlyBases;
            const limited=network?.enabled&&techCap<CONFIG.WEAPON_MAX_LEVEL;
            this.els.levelUpTechNote.textContent=limited
                ?'⚡ ТЕХНОЛОГИИ '+network.technologyTier+'/3 · предел '+techCap+
                    '/5. Активируйте ещё одну базу для новых уровней. '+
                    'Сохранено пакетов: '+(this.game._researchSaved||0)+'/2.'
                :'⚡ Доступны все уровни вооружения.';
            this.els.levelUpTechNote.style.display=network?.enabled?'block':'none';
        }
        const pool = buildUpgradePool(player, techCap, this.game.friendlyBases);
        // pool is [...live, ...maxed]. We pick from `live` first, fall back to
        // maxed only when there is nothing else to surface.
        const liveCount = pool.filter((p) => isUpgradeLive(player, p, techCap)).length;
        const livePool = pool.slice(0, liveCount);
        const maxedPool = pool.slice(liveCount);
        // Every level offers a path to finish an existing weapon. The second
        // slot prefers a passive associated with the selected starting style,
        // leaving at least one choice open to surprise.
        const picks = [];
        const synergies = {
            fighter: ['armor', 'area', 'max_hp', 'shield_core', 'salvage'],
            mage: ['cooldown', 'luck', 'magnet', 'emp_pulse', 'targeting'],
            scout: ['movespeed', 'might', 'dodge', 'targeting', 'emp_pulse']
        };
        const preferredIds = synergies[this.game.buildStyle] || synergies.fighter;
        // The first energy level must provide real ways out of a swarm,
        // not four random +6-10% stat cards. Subsequent levels stay varied.
        if (player.level === 2 && player.weapons.length === 1 &&
            player.weapons[0].id === 'starter_pulse') {
            for (const id of ['starter_pulse', 'whip', 'emp_pulse', 'shield_core']) {
                const choice = livePool.find(up => up.data.id === id);
                if (choice) picks.push(choice);
            }
        } else {
            const owned = livePool.filter(up => up.type === 'weapon' &&
                player.weapons.some(weapon => weapon.id === up.data.id));
            if (owned.length) picks.push(pickN(owned, 1)[0]);
            const compatible = livePool.filter(up => up.type === 'passive' &&
                preferredIds.includes(up.data.id) && !picks.includes(up));
            if (compatible.length) picks.push(pickN(compatible, 1)[0]);
        }
        picks.push(...pickN(livePool.filter(up => !picks.includes(up)),
            4 - picks.length));
        // Engineering reserves let pilots keep earning meaningful rewards
        // while their equipment is held back by inactive research stations.
        const limited=this.game.friendlyBases?.enabled &&
            techCap<CONFIG.WEAPON_MAX_LEVEL;
        const support=[
            {type:'supply',data:{id:'credits',icon:'⚙',name:'Контейнер ресурсов',
                description:'Получить 18 кредитов для станций, эскадр и обороны.'}},
            {type:'supply',data:{id:'repair',icon:'🛠️',name:'Аварийный ремонт',
                description:'Восстановить 18% корпуса или получить кредиты, если корпус цел.'}},
            {type:'supply',data:{id:'scanner',icon:'📡',name:'Дальний сканер',
                description:'Найти неизвестную станцию и отметить её на карте.'}}
        ];
        if(limited&&(this.game._researchSaved||0)<2)
            support.unshift({type:'supply',data:{id:'reserve',icon:'🧬',
                name:'Сохранить технологический пакет',
                description:'Отложить выбор до активации новой базы (не больше двух).'}});
        if(limited && player.level>2 && player.level%3===0 &&
            support[0]?.data.id==='reserve' && picks.length===4) {
            picks[3]=support.shift();
        }
        for(const offer of support){
            if(picks.length>=4)break;
            picks.push(offer);
        }
        while (picks.length < 4 && maxedPool.length) {
            const i = Math.floor(Math.random() * maxedPool.length);
            picks.push(maxedPool.splice(i, 1)[0]);
        }

        for (const up of picks) {
            const div = document.createElement('div');
            div.className = 'upgrade-option';
            div.setAttribute('role', 'menuitem');
            const isSupply=up.type==='supply';
            const existing =
                up.type === 'weapon'
                    ? player.weapons.find((w) => w.id === up.data.id)
                    : isSupply?null:player.passives[up.data.id];
            const lvl = up.type === 'weapon' ? (existing?.level ?? 0) : (existing?.count ?? 0);
            const isMaxed = isSupply?false:
                up.type === 'weapon'
                    ? lvl >= CONFIG.WEAPON_MAX_LEVEL
                    : lvl >= CONFIG.PASSIVE_MAX_STACK;
            const label = isSupply?' (поддержка)':isMaxed
                ? ' (МАКС.)'
                : lvl > 0
                  ? ` (${up.type === 'weapon' ? 'ур.' : '×'}${lvl + 1})`
                  : ' (Новое!)';
            const willEvolve =
                up.type === 'weapon' &&
                !isMaxed &&
                lvl + 1 === up.data.evolveLevel &&
                up.data.evolveName;
            const evoHtml = willEvolve
                ? `<div class="evolve-tag">→ ${up.data.evolveName}</div>`
                : '';
            if (isMaxed) div.classList.add('maxed');
            div.setAttribute(
                'aria-label',
                `${up.data.name}${label}. ${up.data.description}${willEvolve ? '. Развивается в ' + up.data.evolveName : ''}`
            );
            const advice = isSupply ? 'Полевое снабжение' : up.type === 'weapon' && up.data.id === 'starter_pulse' && lvl === 1
                ? 'Двойной импульс: сразу два заряда'
                : up.type === 'weapon' && player.weapons.some((w) => w.id === up.data.id)
                ? 'Усилить имеющееся оружие'
                : up.type === 'passive' && preferredIds.includes(up.data.id)
                  ? 'Подходит вашему боевому стилю'
                  : '';
            div.innerHTML = `
                ${advice ? '<div class="upgrade-advice">' + advice + '</div>' : ''}
                <div class="name">${up.data.icon} ${up.data.name}${label}</div>
                <div class="desc">${up.data.description}</div>
                ${evoHtml}
            `;
            // MAXED options heal a sliver instead of vanishing — they pay out something.
            div.addEventListener('click', () => onPick(isMaxed ? null : up));
            div.setAttribute('tabindex', '0');
            div.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick(isMaxed ? null : up);
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    (div.nextElementSibling || options.firstElementChild)?.focus();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    (div.previousElementSibling || options.lastElementChild)?.focus();
                }
            });
            options.appendChild(div);
        }
        if (picks.length === 0) {
            // Nothing to upgrade (everything maxed): heal to full instead.
            player.hp = player.maxHp;
            onPick(null);
            return;
        }
        this.els.levelUpMenu.style.display = 'flex';
        // focus first option for a11y
        options.querySelector('.upgrade-option')?.focus();
    }

    hideLevelUp() {
        this.els.levelUpMenu.style.display = 'none';
        this.els.levelUpMenu.classList.remove('skill-tree-mode','prologue-skills-mode');
        this._drawSkillLinks = null;
        this._skillResizeObserver?.disconnect();
        if (this._skillOriginalParent &&
            this.els.levelUpMenu.parentElement !== this._skillOriginalParent)
            this._skillOriginalParent.appendChild(this.els.levelUpMenu);
    }

    showBossBanner() {
        if (!this.els.bossBanner) return;
        this._activeBannerKey = 'bossIncoming';
        this.els.bossBanner.textContent = t('bossIncoming');
        this.els.bossBanner.classList.add('visible');
        clearTimeout(this._bannerTimer);
        this._bannerTimer = setTimeout(() => {
            this.els.bossBanner.classList.remove('visible');
            this._activeBannerKey = null;
        }, 2500);
    }

    /**
     * Re-translate any sticky DOM text that does not flow through updateHud.
     * iter-16 bug-bash: previously this only refreshed the boss banner, so
     * every static menu/HUD label tagged with `data-i18n` was stuck on the
     * locale that was active at boot. Now we walk the document once and
     * write the new translation into every tagged node — cheap (one query
     * per locale change, never per frame) and works for the whole DOM
     * regardless of whether a particular overlay is visible at the time.
     */
    onLocaleChanged() {
        if (this._activeBannerKey && this.els.bossBanner) {
            this.els.bossBanner.textContent = t(this._activeBannerKey);
        }
        if (typeof document === 'undefined') return;
        const nodes = document.querySelectorAll('[data-i18n]');
        for (const el of nodes) {
            const key = el.getAttribute('data-i18n');
            if (!key) continue;
            // Preserve any non-text children (e.g. the stage chip <span> nested
            // inside the Stage button) by only rewriting the leading text node.
            const firstText = Array.from(el.childNodes).find((n) => n.nodeType === 3 /* Text */);
            const translated = t(key);
            if (firstText) {
                firstText.nodeValue = translated;
            } else {
                el.textContent = translated;
            }
        }
        // Stage chip is composed dynamically from the active stage id, not a
        // raw i18n key — refresh it explicitly so the icon + name swap with
        // the locale (e.g. "Whisperwood" → "低语森林").
        if (this.game?.stageId && typeof this.updateStageChip === 'function') {
            this.updateStageChip(this.game.stageId);
        }
    }

    showPause() {
        const skills = document.getElementById('btnViewSkills');
        if (skills) skills.style.display = this.game.friendlyBases?.enabled ? '' : 'none';
        this.els.pauseMenu.style.display = 'flex';
    }
    hidePause() {
        this.els.pauseMenu.style.display = 'none';
    }

    showAchievementToast(ach) {
        const host = this.els.achievementToasts;
        if (!host) return;
        const el = document.createElement('div');
        el.className = 'ach-toast';
        el.innerHTML = `
            <div class="ach-icon">${ach.icon}</div>
            <div class="ach-body">
                <div class="ach-title">${t('achievementUnlocked')}</div>
                <div class="ach-name">${ach.name}</div>
                <div class="ach-desc">${ach.description}</div>
            </div>`;
        host.appendChild(el);
        // fade-in
        requestAnimationFrame(() => el.classList.add('visible'));
        setTimeout(() => {
            el.classList.remove('visible');
            setTimeout(() => el.remove(), 500);
        }, 3500);
    }

    showSettings(settings, onChange, onClose, onReset, opts = {}) {
        this._settingsCleanup?.();
        const m = this.els.settingsMenu;
        // iter-19: vibration row is only useful on devices with the
        // navigator.vibrate API. We hide the row entirely when
        // `opts.vibrationSupported` is false so desktop players don't see
        // a control they can't act on. The Customize controls button is
        // unconditional — keyboard remap applies everywhere.
        const vibrationRow =
            opts.vibrationSupported !== false
                ? checkboxRow('vibration', settings.vibration !== false)
                : '';
        const remapRow = opts.onRemap
            ? `<div class="settings-row"><span>${t('customizeControls')}</span>` +
              `<button data-action="remap">${t('customizeControls')}</button></div>`
            : '';
        m.innerHTML = `
            <div class="settings-card">
                <h2>${t('settings')}</h2>
                <div class="settings-row"><label for="settingsMuted">Выключить весь звук</label><input id="settingsMuted" type="checkbox" data-key="muted" ${settings.muted ? 'checked' : ''}></div>
                <h3 class="settings-group-title">Звук</h3>
                ${sliderRow('masterVolume', settings.masterVolume)}
                ${sliderRow('sfxVolume', settings.sfxVolume)}
                ${sliderRow('musicVolume', settings.musicVolume)}
                ${checkboxRow('musicEnabled', settings.musicEnabled !== false)}
                <h3 class="settings-group-title">Игра и изображение</h3>
                <label class="settings-row"><span>Графика</span><select data-key="graphicsMode" aria-label="Режим графики">
                    <option value="auto" ${(settings.graphicsMode||'auto')==='auto'?'selected':''}>Автоматически</option>
                    <option value="3d" ${settings.graphicsMode==='3d'?'selected':''}>Подробные 3D-модели</option>
                    <option value="2d" ${settings.graphicsMode==='2d'?'selected':''}>Быстрая 2D-графика</option>
                </select></label>
                <p class="graphics-settings-note">Авто сохраняет 3D корабля и крупных целей, а при нагрузке упрощает графику эскадрилий и эффекты. При сильных торможениях выберите 2D.</p>
                ${selectRow('difficulty', settings.difficulty, ['easy', 'normal', 'hard', 'nightmare'])}
                ${checkboxRow('showFps', settings.showFps)}
                ${checkboxRow('screenShake', settings.screenShake)}
                ${checkboxRow('reducedMotion', settings.reducedMotion)}
                ${checkboxRow('colorblind', !!settings.colorblind)}
                ${checkboxRow('damageNumbers', settings.damageNumbers !== false)}
                ${checkboxRow('criticalFlash', settings.criticalFlash !== false)}
                ${vibrationRow}
                
                <h3 class="settings-group-title">Управление</h3>
                ${selectRow('touchButtonScale', String(settings.touchButtonScale ?? 1), ['0.8', '1', '1.2'])}
                ${remapRow}
                <p class="graphics-settings-note">Обновление удаляет только временные файлы «Выжившего». Сохранённый прогресс остаётся.</p>
                <div class="settings-buttons">
                    <button type="button" data-action="refresh">↻ Обновить файлы игры</button>
                    <button class="danger" data-action="reset">${t('resetData')}</button>
                    <button data-action="close">${t('close')}</button>
                </div>
            </div>`;
        m.style.display = 'flex';
        m.addEventListener('input', handler);
        m.addEventListener('change', handler);
        m.addEventListener('click', buttonHandler);

        const self = this;
        const cleanup = () => {
            m.removeEventListener('input', handler);
            m.removeEventListener('change', handler);
            m.removeEventListener('click', buttonHandler);
            if (self._settingsCleanup === cleanup) self._settingsCleanup = null;
        };
        this._settingsCleanup = cleanup;
        function handler(e) {
            const key = e.target.dataset.key;
            if (!key) return;
            const val =
                e.target.type === 'checkbox'
                    ? e.target.checked
                    : e.target.type === 'range'
                      ? parseFloat(e.target.value)
                      : e.target.value;
            if (key === 'locale') {
                setLocale(val);
                self.onLocaleChanged();
            }
            if (key === 'colorblind') {
                document.body.classList.toggle('cb-mode', !!val);
            }
            // iter-14: touchButtonScale is exposed as a select with string
            // values ('0.8' / '1' / '1.2'); coerce back to number before
            // persisting so getTouchButtonScale's clamp works correctly.
            if (key === 'touchButtonScale') {
                const num = parseFloat(val);
                onChange(key, Number.isFinite(num) ? num : 1);
                return;
            }
            onChange(key, val);
        }
        function buttonHandler(e) {
            const a = e.target.dataset.action;
            if (a === 'close') {
                cleanup();
                m.style.display = 'none';
                onClose();
            } else if (a === 'reset') {
                if (confirm(t('confirmReset'))) onReset();
            } else if (a === 'refresh' && typeof opts.onRefresh === 'function') {
                opts.onRefresh();
            } else if (a === 'remap' && typeof opts.onRemap === 'function') {
                // iter-19: Customize controls. Settings panel stays open
                // behind the dialog so the user can return without
                // re-navigating.
                opts.onRemap();
            }
        }
    }

    hideSettings() {
        this._settingsCleanup?.();
        this.els.settingsMenu.style.display = 'none';
    }

    /**
     * iter-19: Customize controls dialog. Mounts on top of the settings
     * panel so closing the dialog returns to settings. Each row shows the
     * action label and the currently-bound key(s); the user clicks the row
     * (or focuses + presses Enter) to enter capture mode, then presses any
     * key to bind it. Captured keys are normalised through the `keymap`
     * module so the conflict-detect path matches what InputManager reads.
     *
     * Captures Esc as a binding when the user is in capture mode (so they
     * can rebind pause to a different key). Outside capture mode Esc
     * closes the dialog like the rest of the overlays.
     *
     * @param {object} keymap   the active keymap (caller owns persistence)
     * @param {(next:object)=>void} onSave
     * @param {()=>void} onClose
     */
    showRemap(keymap, onSave, onClose) {
        // Reuse the settings menu container as a host so we layer above any
        // open settings panel without spawning a new top-level overlay; the
        // settings panel itself stays mounted underneath.
        let host = document.getElementById('remapDialog');
        if (!host) {
            host = document.createElement('div');
            host.id = 'remapDialog';
            host.className = 'menu-screen';
            const fullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            (fullscreen || document.body).appendChild(host);
        }
        let working = cloneKeymap(keymap || DEFAULT_KEYMAP);
        let capturingAction = null;

        const render = () => {
            const conflicts = detectConflicts(working);
            const conflictKeys = new Set(conflicts.map((c) => c.key));
            const rows = KEYMAP_ACTIONS.map((action) => {
                const keys = working[action] || [];
                const isCapturing = capturingAction === action;
                const labels = keys.map((k) => keyLabel(k)).join(' / ') || '—';
                const row =
                    `<div class="remap-row${isCapturing ? ' capturing' : ''}" data-action="${action}" tabindex="0">` +
                    `<span class="remap-label">${t('remap_' + action) || action}</span>` +
                    `<span class="remap-keys${conflictKeys.has(keys[0]) ? ' conflict' : ''}">${
                        isCapturing ? t('pressAnyKey') : labels
                    }</span>` +
                    '</div>';
                return row;
            }).join('');
            const conflictMsg = conflicts.length
                ? `<div class="remap-conflicts">${t('keymapConflict')}: ${conflicts
                      .map((c) => `${keyLabel(c.key)} → ${c.actions.join(' / ')}`)
                      .join(', ')}</div>`
                : '';
            host.innerHTML = `
                <div class="settings-card remap-card">
                    <h2>${t('customizeControls')}</h2>
                    <div class="remap-hint">${t('remapHint')}</div>
                    ${rows}
                    ${conflictMsg}
                    <div class="settings-buttons">
                        <button data-action="reset-defaults">${t('resetDefaults')}</button>
                        <button data-action="cancel">${t('cancel')}</button>
                        <button data-action="save">${t('save')}</button>
                    </div>
                </div>`;
            host.style.display = 'flex';
        };

        const onClick = (e) => {
            const row = e.target.closest('.remap-row');
            if (row) {
                capturingAction = row.dataset.action;
                render();
                return;
            }
            const a = e.target.dataset?.action;
            if (a === 'cancel') {
                cleanup();
                onClose?.();
            } else if (a === 'save') {
                onSave?.(working);
                cleanup();
                onClose?.();
            } else if (a === 'reset-defaults') {
                working = cloneKeymap(DEFAULT_KEYMAP);
                capturingAction = null;
                render();
            }
        };

        const onKey = (e) => {
            if (!capturingAction) return;
            // Block the captured key from reaching gameplay handlers — we're
            // remapping, not playing.
            e.preventDefault();
            e.stopPropagation();
            const k = normaliseKey(e.key);
            if (!k) return;
            // Tab is reserved for focus navigation; refusing it lets the
            // user back out of capture mode without binding it.
            if (k === 'tab') {
                capturingAction = null;
                render();
                return;
            }
            working = bindKey(working, capturingAction, k, { replace: true });
            capturingAction = null;
            render();
        };

        const cleanup = () => {
            host.style.display = 'none';
            host.innerHTML = '';
            host.removeEventListener('click', onClick);
            window.removeEventListener('keydown', onKey, true);
        };

        host.addEventListener('click', onClick);
        // Capture phase so we receive the keydown before InputManager and
        // can swallow the binding press.
        window.addEventListener('keydown', onKey, true);
        render();
    }

    showGameOver(game) {
        const m = Math.floor(game.gameTime / 60)
            .toString()
            .padStart(2, '0');
        const s = Math.floor(game.gameTime % 60)
            .toString()
            .padStart(2, '0');
        this.els.finalTime.textContent = `${m}:${s}`;
        this.els.finalKills.textContent = game.kills;
        this.els.finalLevel.textContent = game.player.level;
        const expedition = document.getElementById('finalExpedition');
        if (expedition) {
            expedition.style.display = game.friendlyBases?.enabled ? 'block' : 'none';
            if (game.friendlyBases?.enabled) {
                expedition.textContent = '🧭 Экспедиция: ' +
                    (game.run?.basesVisited || 0) + ' станций разведано · ' +
                    (game.run?.basesActivated || 0) + ' реакторов запущено · ' +
                    (game.run?.signalsRecovered || 0) + ' капсул изучено · ' +
                    Math.round(game.run?.distanceTravelled || 0) + ' ед. пройдено';
            }
        }
        if (this.els.finalScore) this.els.finalScore.textContent = formatPoints(game.points);
        if (this.els.finalRecordBadge) {
            this.els.finalRecordBadge.textContent = game.personalRecord && !game.personalRecord.saved
                ? t('recordNotSaved')
                : game.personalRecord?.isRecord ? t('newPersonalBest') : t('recordSaved');
        }

        // Render leaderboard under the run summary.
        if (this.els.highScoreList) {
            const rows = game.save.highScores || [];
            // Speedrun splits block (if applicable).
            let splitsHtml = '';
            if (game.speedrunMode && game.speedrunSplits?.length) {
                splitsHtml =
                    `<div class="splits"><div class="splits-head">${t('splits')}</div>` +
                    game.speedrunSplits
                        .map((sp) => {
                            const mm = Math.floor(sp.mark / 60)
                                .toString()
                                .padStart(2, '0');
                            const ss = Math.floor(sp.mark % 60)
                                .toString()
                                .padStart(2, '0');
                            const rs = (sp.realMs / 1000).toFixed(2);
                            return `<div class="split-row"><span>${mm}:${ss}</span><span>${rs} с</span></div>`;
                        })
                        .join('') +
                    '</div>';
            }
            if (!rows.length) {
                this.els.highScoreList.innerHTML =
                    splitsHtml + `<div class="hs-empty">${t('noHighScores')}</div>`;
            } else {
                this.els.highScoreList.innerHTML =
                    splitsHtml +
                    `<div class="hs-head"><span>#</span><span>${t('score')}</span><span>${t('time')}</span><span>${t('kills')}</span><span>${t('date')}</span></div>` +
                    rows
                        .map((r, i) => {
                            const mm = Math.floor(r.timeSurvived / 60)
                                .toString()
                                .padStart(2, '0');
                            const ss = Math.floor(r.timeSurvived % 60)
                                .toString()
                                .padStart(2, '0');
                            const d = new Date(r.date || 0);
                            const dstr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            return `<div class="hs-row"><span>${i + 1}</span><span>${formatPoints(r.points ?? calculatePoints({ seconds:r.timeSurvived, kills:r.kills, level:r.level }))}</span><span>${mm}:${ss}</span><span>${r.kills}</span><span>${dstr}</span></div>`;
                        })
                        .join('');
            }
        }

        // Daily mode: render a "Share" button that copies a Wordle-style
        // result string to the clipboard. Inserted inline above the regular
        // retry/menu row so the share is the first call to action.
        if (game.dailyMode && game.dailyChallenge) {
            const card = this.els.gameOver.querySelector('.gameover');
            if (card && !card.querySelector('.daily-share-row')) {
                const wrap = document.createElement('div');
                wrap.className = 'daily-share-row';
                wrap.innerHTML = `<button id="btnShareDaily" class="btn ghost">${t('shareDaily')}</button><pre id="dailyShareText" class="share-preview" hidden></pre>`;
                // Insert before the .btn-row.
                const before = card.querySelector('.btn-row');
                if (before) card.insertBefore(wrap, before);
                else card.appendChild(wrap);
            }
            const btn = this.els.gameOver.querySelector('#btnShareDaily');
            const pre = this.els.gameOver.querySelector('#dailyShareText');
            const entry = {
                date: game.dailyChallenge.date,
                stage: game.stageId,
                timeSurvived: game.gameTime,
                kills: game.kills,
                level: game.player?.level || 1,
                won: !!game.run?.bossesDefeated?.void_lord
            };
            btn?.addEventListener('click', async () => {
                const text = buildShareText(entry);
                if (pre) {
                    pre.textContent = text;
                    pre.hidden = false;
                }
                try {
                    await navigator.clipboard?.writeText?.(text);
                    btn.textContent = t('copied');
                    setTimeout(() => (btn.textContent = t('shareDaily')), 2000);
                } catch {
                    // Fall back to selecting the preview text so the user can
                    // copy manually; clipboard write is blocked in some
                    // sandboxed iframe environments.
                    btn.textContent = t('copyManual');
                }
            });
        } else {
            // Non-daily run: strip a stale share row if any.
            const stale = this.els.gameOver.querySelector('.daily-share-row');
            stale?.remove();
        }

        this.els.gameOver.style.display = 'flex';
    }

    hideGameOver() {
        this.els.gameOver.style.display = 'none';
    }
    hideStart() {
        this.els.startScreen.style.display = 'none';
    }
    showStart() {
        this.refreshCommandMenu?.();
        this.els.startScreen.style.display = 'flex';
    }
}

function buildUpgradePool(player, techCap = CONFIG.WEAPON_MAX_LEVEL, network = null) {
    // Two tiers: live (selectable) upgrades first, then "maxed" cards as a
    // visible reminder of mastery. The level-up screen still prefers `live`,
    // so the player rarely sees a maxed card unless their build is full.
    const live = [];
    const maxed = [];
    for (const weapon of Object.values(WEAPONS)) {
        const existing = player.weapons.find((w) => w.id === weapon.id);
        // Heavy systems appear in later level-up pools, not on the first
        // upgrade. Owned weapons can always be improved.
        if (!existing && player.level < (weapon.minPlayerLevel || 1)) continue;
        // A relevant active station reveals specialist equipment earlier.
        // At network tier III reverse engineering unlocks all weapon families,
        // so procedural station placement never locks away a loadout forever.
        const specialist={knife:'arsenal',mine:'arsenal',
            boomerang:'arsenal',railgun:'arsenal',
            orbit:'carrier',drone_swarm:'carrier',
            lightning:'lab',frost_nova:'lab',retro_blaster:'lab',
            soul_drain:'dock'}[weapon.id];
        if(!existing&&specialist&&network?.enabled&&
            network.technologyTier<3&&!network.hasActivatedType(specialist))
            continue;
        if (existing) {
            if (existing.level < techCap) {
                live.push({ type: 'weapon', data: weapon });
            } else if(existing.level >= CONFIG.WEAPON_MAX_LEVEL) {
                maxed.push({ type: 'weapon', data: weapon });
            }
        } else if (player.weapons.length < CONFIG.MAX_WEAPONS) {
            live.push({ type: 'weapon', data: weapon });
        }
    }
    for (const passive of Object.values(PASSIVES)) {
        const existing = player.passives[passive.id];
        if (!existing) {
            if (Object.keys(player.passives).length < CONFIG.MAX_PASSIVES) {
                live.push({ type: 'passive', data: passive });
            }
        } else if (existing.count < Math.min(techCap,CONFIG.PASSIVE_MAX_STACK)) {
            live.push({ type: 'passive', data: passive });
        } else if(existing.count >= CONFIG.PASSIVE_MAX_STACK) {
            maxed.push({ type: 'passive', data: passive });
        }
    }
    return live.concat(maxed);
}

function isUpgradeLive(player, up, techCap = CONFIG.WEAPON_MAX_LEVEL) {
    if(up.type==='supply')return true;
    if (up.type === 'weapon') {
        const existing = player.weapons.find((w) => w.id === up.data.id);
        return !existing || existing.level < techCap;
    }
    const existing = player.passives[up.data.id];
    return !existing || existing.count < Math.min(techCap,CONFIG.PASSIVE_MAX_STACK);
}

function pickN(arr, n) {
    const out = [];
    const copy = arr.slice();
    while (out.length < n && copy.length) {
        const i = Math.floor(Math.random() * copy.length);
        out.push(copy.splice(i, 1)[0]);
    }
    return out;
}

function sliderRow(key, value) {
    return `
        <label class="settings-row">
            <span>${t(key)}</span>
            <input type="range" min="0" max="1" step="0.05" value="${value}" data-key="${key}">
            <output>${Math.round(value * 100)}%</output>
        </label>`;
}

function selectRow(key, value, values) {
    return `
        <label class="settings-row">
            <span>${t(key)}</span>
            <select data-key="${key}">
                ${values.map((v) => `<option value="${v}" ${v === value ? 'selected' : ''}>${({easy:'Легко',normal:'Обычно',hard:'Сложно',nightmare:'Кошмар','0.8':'Маленькие','1':'Обычные','1.2':'Крупные'})[v] || v}</option>`).join('')}
            </select>
        </label>`;
}

function checkboxRow(key, value) {
    return `
        <label class="settings-row">
            <span>${t(key)}</span>
            <input type="checkbox" data-key="${key}" ${value ? 'checked' : ''}>
        </label>`;
}

// Expose catalogue count for badges / tests.
export function totalAchievements() {
    return ACHIEVEMENTS.length;
}


