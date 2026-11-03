import { MISSION_PROFILES, readCampaign, isMissionUnlocked, createMissionRules } from './mission-progression.js?v=design-127';
import { saveSave } from './storage.js';
import { hasDesignedMission } from './mission-world.js?v=design-127';

const BRIEFS = {
    0: 'Очнитесь на заброшенной станции, восстановите питание и найдите путь через охранный зал. История начинается у звезды.',
    1: 'Запустите станции, соедините энергетическую сеть и подготовьтесь к обороне.',
    2: 'Проведите корабль через Каменный пролив и освойте ракетное вооружение.',
    3: 'Восстановите разорванную сеть и защитите станции от налётов.',
    4: 'Проведите караван через туманность, сохранив грузовой корабль.'
};

/** Only completed, designed missions inform the next playable operation. */
export function nextCampaignMission(save, profiles = MISSION_PROFILES, designed = hasDesignedMission) {
    const completed = readCampaign(save).completed;
    const playable = profiles.filter(p => designed(p.index));
    return playable.find(p => !completed.includes(p.index) && isMissionUnlocked(save, p.index)) || playable.at(-1);
}

/** Main menu and bounded keyboard focus handling. No gameplay-loop work. */
export function installInterface(game) {
    const home = document.getElementById('startScreen');
    if (!home) return;
    const tabs = [...home.querySelectorAll('[data-menu-tab]')];
    const panels = [...home.querySelectorAll('[data-menu-panel]')];
    let selectedMission = nextCampaignMission(game.save)?.index ?? 0;
    let lastCompleted = null;
    const previewMissionIndex = () => isMissionUnlocked(game.save, selectedMission) ? selectedMission :
        nextCampaignMission(game.save)?.index ?? 0;
    const setPanel = (id, focus = false) => {
        for (const tab of tabs) {
            const active = tab.dataset.menuTab === id;
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            if (active && focus) tab.focus();
        }
        for (const panel of panels) panel.hidden = panel.dataset.menuPanel !== id;
    };
    for (const tab of tabs) {
        tab.addEventListener('click', () => setPanel(tab.dataset.menuTab));
        tab.addEventListener('keydown', event => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const current = tabs.indexOf(tab);
            const step = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
                (current + step + tabs.length) % tabs.length;
            setPanel(tabs[index].dataset.menuTab, true);
        });
    }
    const builds = [...home.querySelectorAll('input[name="survivorBuild"]')];
    for (const radio of builds) {
        if (game.save.settings.shipBuild === radio.value) radio.checked = true;
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            game.save.settings.shipBuild = radio.value;
            saveSave(game.save);
        });
    }
    const refresh = () => {
        for (const radio of builds) radio.checked = radio.value === (game.save.settings.shipBuild || 'fighter');
        const sound = document.getElementById('btnSound');
        sound.textContent = game.save.settings.muted ? '🔇 Включить звук' : '🔊 Выключить звук';
        sound.setAttribute('aria-pressed', String(!game.save.settings.muted));
        const progress = readCampaign(game.save);
        const completed = progress.completed.join(',');
        if (lastCompleted !== completed) selectedMission = nextCampaignMission(game.save)?.index ?? 0;
        lastCompleted = completed;
        const profiles = MISSION_PROFILES.filter(p => hasDesignedMission(p.index));
        document.getElementById('menuCampaignCount').textContent =
            profiles.filter(p => progress.completed.includes(p.index)).length + ' из ' + profiles.length + ' пройдено';
        const route = document.getElementById('menuCampaignRoute');
        const restoreRouteFocus = route.contains(document.activeElement);
        route.replaceChildren();
        for (const profile of profiles) {
            const unlocked = isMissionUnlocked(game.save, profile.index);
            const done = progress.completed.includes(profile.index);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'command-route-stop' + (done ? ' completed' : unlocked ? ' unlocked' : ' locked');
            button.setAttribute('aria-pressed', String(profile.index === selectedMission));
            button.dataset.mission = profile.index;
            const number = document.createElement('span');
            number.className = 'route-number';
            number.textContent = String(profile.index).padStart(2, '0');
            const title = document.createElement('strong');
            title.textContent = profile.name;
            const state = document.createElement('small');
            state.textContent = done ? '✓ Пройдено' : unlocked ? 'Доступно' : 'Закрыто';
            button.append(number, title, state);
            button.addEventListener('click', () => { selectedMission = profile.index; refresh(); });
            route.appendChild(button);
            if (restoreRouteFocus && profile.index === selectedMission) button.focus({preventScroll: true});
        }
        const mission = MISSION_PROFILES.find(p => p.index === selectedMission) || profiles[0];
        const unlocked = isMissionUnlocked(game.save, mission.index);
        const done = progress.completed.includes(mission.index);
        document.getElementById('menuMissionLabel').textContent = 'МИССИЯ ' + String(mission.index).padStart(2, '0') +
            (mission.index === 0 ? ' · СТАНЦИЯ «ГЕЛИОС»' : ' · КАМПАНИЯ');
        document.getElementById('menuMissionTitle').textContent = mission.name;
        document.getElementById('menuMissionDescription').textContent = BRIEFS[mission.index] || '';
        document.getElementById('menuMissionMeta').textContent = unlocked ?
            mission.minutesMin + '–' + mission.minutesMax + ' мин · ' + (done ? 'повторное прохождение' : 'новый вылет') :
            'Сначала завершите миссию ' + String(mission.index - 1).padStart(2, '0') + '.';
        const launch = document.getElementById('btnContinueCampaign');
        launch.disabled = !unlocked;
        launch.textContent = !unlocked ? 'Миссия пока закрыта' : done ? 'Повторить миссию →' :
            mission.index === 0 ? 'Начать историю →' : 'Продолжить кампанию →';
        const previewMission = MISSION_PROFILES.find(p => p.index === previewMissionIndex());
        document.getElementById('menuTreeContext').textContent = 'Обзор дерева: начало доступной миссии ' +
            String(previewMission.index).padStart(2, '0') + ' «' + previewMission.name + '». Покупки доступны во время вылета.';
        const replay = document.getElementById('btnReplay');
        // The runtime owns whether a replay exists; do not overwrite its disabled state.
        if (replay?.disabled) replay.title = 'Запись появится после первого завершённого вылета.';
    };
    game.ui.refreshCommandMenu = refresh;
    document.getElementById('btnContinueCampaign')?.addEventListener('click', () => {
        if (!isMissionUnlocked(game.save, selectedMission)) return;
        game.audio.unlock();
        game.startMission(selectedMission);
    });
    document.getElementById('btnPrologue')?.addEventListener('click', event => {
        event.preventDefault();
        game.audio.unlock();
        game.startMission(0);
    });
    for (const button of home.querySelectorAll('[data-tree-branch]')) {
        button.addEventListener('click', () => {
            const missionRules = createMissionRules(previewMissionIndex(), game.save);
            if (!missionRules) {
                setPanel('campaign', true);
                return;
            }
            game.ui._treeBranch = button.dataset.treeBranch;
            game.ui.hideStart();
            game.ui.showSkillTree({level: 1, weapons: previewMissionIndex() === 0 ? [] : [{id: 'starter_pulse', level: 1}],
                passives: {}, fieldSkills: {}}, null, {
                preview: true, catalogue: true, missionRules,
                network: {technologyTier: 0, enabled: true, getUpgradeCap: () => 2,
                    hasActivatedType: () => false, bases: []},
                closeLabel: '← К развитию',
                onClose: () => { game.ui.hideLevelUp(); game.ui.showStart(); button.focus(); }
            });
        });
    }

    // Pause opens the same settings, without resuming combat behind them.
    document.getElementById('btnPauseSettings')?.addEventListener('click', () => game.openSettings());
    const dialogs = [...document.querySelectorAll('.overlay')];
    let activeDialog = null;
    const dialogOpeners = new WeakMap();
    const visible = element => !!element && element.style.display !== 'none' && !element.hidden &&
        element.getClientRects().length > 0;
    const focusable = dialog => [...dialog.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select, textarea, summary, [tabindex="0"]'
    )].filter(el => visible(el) && !el.closest('[hidden]'));
    const modalPriority = dialog => dialog.id === 'levelUpMenu' ? 100 :
        dialog.id === 'remapDialog' ? 90 :
        dialog.id === 'settingsMenu' ? 70 : dialog.id === 'startScreen' ? 0 :
        dialog.id === 'pauseMenu' ? 10 : 50;
    const sync = () => {
        const top = dialogs.filter(visible).sort((a, b) => modalPriority(a) - modalPriority(b)).at(-1);
        for (const dialog of dialogs) {
            dialog.inert = visible(dialog) && dialog !== top;
            if (visible(dialog)) dialog.setAttribute('aria-hidden', String(dialog !== top));
        }
        if (top && top !== activeDialog) {
            const opener = dialogOpeners.get(activeDialog);
            if (opener?.isConnected && top.contains(opener) && visible(opener)) {
                opener.focus({preventScroll: true});
            } else {
                dialogOpeners.set(top, document.activeElement);
                if (!top.contains(document.activeElement)) focusable(top)[0]?.focus({preventScroll: true});
            }
        } else if (!top && activeDialog) {
            const opener = dialogOpeners.get(activeDialog);
            if (opener?.isConnected && visible(opener)) opener.focus({preventScroll: true});
        }
        activeDialog = top;
        const playing = !top;
        for (const element of document.getElementById('gameContainer').children) {
            if (!dialogs.includes(element) && !['SCRIPT', 'STYLE'].includes(element.tagName))
                element.inert = !playing;
        }
    };
    const observer = new MutationObserver(sync);
    for (const dialog of dialogs) observer.observe(dialog, {attributes: true, attributeFilter: ['style']});
    const addedDialogs = new MutationObserver(records => {
        for (const record of records) for (const element of record.addedNodes) {
            if (element.nodeType !== 1 || !element.matches('.overlay, .menu-screen')) continue;
            if (!dialogs.includes(element)) {
                dialogs.push(element);
                observer.observe(element, {attributes: true, attributeFilter: ['style']});
                element.setAttribute('role', 'dialog');
                element.setAttribute('aria-modal', 'true');
            }
        }
        sync();
    });
    addedDialogs.observe(document.body, {childList: true});
    addedDialogs.observe(document.getElementById('gameContainer'), {childList: true});
    window.addEventListener('keydown', event => {
        const remap = document.getElementById('remapDialog');
        if (visible(remap)) return;
        const dialog = activeDialog;
        if (!dialog || !visible(dialog)) return;
        if (event.key === 'Tab') {
            const items = focusable(dialog);
            if (!items.length) return;
            const first = items[0], last = items.at(-1);
            if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
                event.preventDefault(); first.focus();
            }
            // InputManager's Tab-to-map handler must not run inside a dialog.
            event.stopPropagation();
        }
        const key = event.key.toLowerCase();
        if (key !== 'escape' && game.keymap?.pause?.includes(key) &&
            dialog.id !== 'pauseMenu' && dialog.id !== 'levelUpMenu') {
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (game.keymap?.help?.includes(key) && !['startScreen', 'pauseMenu', 'helpScreen'].includes(dialog.id)) {
            event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (event.key !== 'Escape') return;
        const close = dialog.id === 'levelUpMenu' ? dialog.querySelector('.skill-preview-close') :
            dialog.id === 'settingsMenu' ? dialog.querySelector('[data-action="close"]') :
            dialog.id === 'campaignPickerScreen' ? document.getElementById('campaignBack') :
            dialog.id === 'stagePickerScreen' ? document.getElementById('stageClose') :
            dialog.id === 'howToPlayScreen' ? document.getElementById('howtoClose') :
            dialog.id === 'helpScreen' ? document.getElementById('helpClose') :
            dialog.id === 'replayScreen' ? document.getElementById('replayClose') :
            dialog.querySelector('[id$="Close"]');
        if (close) { event.preventDefault(); event.stopImmediatePropagation(); close.click(); }
    }, true);
    const rehomeRemap = () => {
        const remap = document.getElementById('remapDialog');
        if (!remap) return;
        const owner = document.fullscreenElement || document.webkitFullscreenElement || document.body;
        if (remap.parentElement !== owner) owner.appendChild(remap);
    };
    document.addEventListener('fullscreenchange', rehomeRemap);
    document.addEventListener('webkitfullscreenchange', rehomeRemap);
    refresh();
    sync();
}

