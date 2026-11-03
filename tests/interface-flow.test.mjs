import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {UI} from '../src/ui.js';
import {Player} from '../src/entities.js';
import {Weapon} from '../src/weapons.js';
import {WEAPONS} from '../src/data.js';
import {buildSkillTree} from '../src/skill-tree.js';
import {skillChange} from '../src/skill-presentation.js';
import {nextCampaignMission} from '../src/menu-interface.js';

class Element {
    constructor(tag = 'div') {
        Object.assign(this, {tagName:tag.toUpperCase(), children:[], attributes:{}, dataset:{},
            style:{}, listeners:{}, parentElement:null, className:'', hidden:false, disabled:false});
        this.classList = {
            add: name => {if (!this.className.split(' ').includes(name)) this.className += ' ' + name;},
            remove: name => {this.className = this.className.split(' ').filter(c => c !== name).join(' ');},
            contains: name => this.className.split(' ').includes(name)
        };
    }
    append(...nodes) { for (const node of nodes) this.appendChild(node); }
    appendChild(node) {
        if (node.parentElement) node.parentElement.children = node.parentElement.children.filter(child => child !== node);
        node.parentElement = this; this.children.push(node); return node;
    }
    replaceChildren(...nodes) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...nodes); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    focus() { this.focused = true; }
    scrollIntoView() { this.scrolled = true; }
    click() { if (!this.disabled && !this.hidden) { this.listeners.click?.({}); this.onclick?.({}); } }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
        const matches = node => selector.startsWith('#') ? node.id === selector.slice(1) :
            selector.startsWith('.') ? selector.slice(1).split('.').every(c => node.classList.contains(c)) :
            node.tagName.toLowerCase() === selector;
        const all = [];
        const visit = node => { for (const child of node.children) { if (matches(child)) all.push(child); visit(child); } };
        visit(this); return all;
    }
    get isConnected() { return false; } // SVG geometry belongs to browser QA.
}
function fixture(fn) {
    const previous = {document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame};
    const body = new Element(), container = new Element(), modal = new Element(), root = new Element();
    const title = new Element(), tech = new Element();
    body.appendChild(container); container.appendChild(modal); modal.appendChild(root);
    const document = {body,createElement:tag => new Element(tag),createElementNS:(_ns,tag) => new Element(tag),
        getElementById:id => id === 'levelUpTitle' ? title : null, addEventListener(){}};
    globalThis.document = document;
    globalThis.requestAnimationFrame = callback => callback();
    const ui = Object.create(UI.prototype);
    const network = {enabled:true,technologyTier:0,getUpgradeCap:()=>2,hasActivatedType:()=>false,bases:[]};
    ui.game = {buildStyle:'fighter',friendlyBases:network,activeMission:null};
    ui.els = {levelUpMenu:modal,upgradeOptions:root,levelUpTechNote:tech};
    const player = new Player(0,0); player.weapons.push(new Weapon(WEAPONS.STARTER_PULSE)); player.level = 2;
    try { fn({ui,player,root,modal,document,container,network}); }
    finally {globalThis.document = previous.document; globalThis.requestAnimationFrame = previous.requestAnimationFrame;}
}

test('campaign resume starts with the first unfinished playable mission, preserving the save', () => {
    const fresh = {};
    assert.equal(nextCampaignMission(fresh).index,0);
    const save = {campaign:{completed:[0,1,2],blueprints:['knife']}};
    const before = structuredClone(save);
    assert.equal(nextCampaignMission(save).index,3);
    assert.deepEqual(save,before);
    assert.equal(nextCampaignMission({campaign:{completed:[0,1,2,3,4]}}).index,4);
});

test('weapon comparison uses real runtime calculations without changing rank or specialization', () => {
    const player = new Player(0,0), weapon = new Weapon(WEAPONS.STARTER_PULSE);
    weapon.level = 3; player.weapons.push(weapon); player.level = 8;
    const network={enabled:false,technologyTier:3,getUpgradeCap:()=>5};
    const node = buildSkillTree(player,network).branches.flatMap(b=>b.tiers.flat())
        .find(n=>n.id === 'starter_pulse' && n.specialization === 'focus');
    const before = {level:weapon.level,specialization:weapon.specialization,damage:weapon.getDamage(player)};
    const changes = skillChange(node,player);
    const expected = new Weapon(WEAPONS.STARTER_PULSE); expected.level=4; expected.specialization='focus';
    const format = (n,d) => Number(n.toFixed(d)).toLocaleString('ru-RU');
    assert.equal(changes.find(c=>c.label === 'Урон').after,format(expected.getDamage(player),1));
    assert.equal(changes.find(c=>c.label === 'Интервал атак').after,format(expected.getCooldown(player),2)+' с');
    assert.deepEqual({level:weapon.level,specialization:weapon.specialization,damage:weapon.getDamage(player)},before);
});

test('node inspection never spends a point; explicit confirmation commits once', () => fixture(({ui,player,root}) => {
    const choices = [];
    ui.showSkillTree(player, choice => choices.push(choice));
    const node = root.querySelectorAll('.skill-node').find(button => button.dataset.skill === 'weapon:starter_pulse');
    node.click(); assert.equal(choices.length,0);
    const learn = root.querySelector('.skill-learn');
    assert.equal(learn.disabled,false);
    learn.click(); learn.click();
    assert.equal(choices.length,1);
    assert.equal(choices[0].data.id,'starter_pulse');
}));

test('locked nodes remain inspectable and cannot be purchased', () => fixture(({ui,player,root}) => {
    const choices=[]; ui.showSkillTree(player, choice=>choices.push(choice));
    root.querySelectorAll('.skill-node').find(button=>button.dataset.skill === 'weapon:railgun').click();
    const learn=root.querySelector('.skill-learn');
    assert.equal(learn.disabled,true); learn.click(); assert.equal(choices.length,0);
    assert.match(root.querySelector('.skill-inspect-status').textContent,/Сначала/);
}));

test('menu and pause previews are read-only and return through their supplied close action', () => fixture(({ui,player,root}) => {
    let closed=0, spent=0;
    ui.showSkillTree(player,()=>spent++,{preview:true,onClose:()=>closed++});
    assert.equal(root.querySelector('.skill-learn').hidden,true);
    assert.equal(root.querySelectorAll('.skill-supply').length,0);
    root.querySelector('.skill-node').click(); root.querySelector('.skill-learn').click();
    assert.equal(spent,0); root.querySelector('.skill-preview-close').click(); assert.equal(closed,1);
}));

test('supply selection also requires confirmation and does not waste a repair on full health', () => fixture(({ui,player,root}) => {
    const choices=[]; ui.showSkillTree(player,choice=>choices.push(choice));
    const supplies=root.querySelectorAll('.skill-supply');
    supplies.find(button=>button.textContent.includes('Ремонт')).click();
    assert.equal(root.querySelector('.skill-learn').disabled,true); assert.equal(choices.length,0);
    supplies.find(button=>button.textContent.includes('Ресурсы')).click();
    assert.equal(choices.length,0); root.querySelector('.skill-learn').click();
    assert.equal(choices[0].data.id,'credits');
}));

test('the atlas stays inside the fullscreen owner, then returns to the original parent', () => fixture(({ui,player,document,container,modal}) => {
    document.fullscreenElement=container;
    ui.showSkillTree(player,null,{preview:true}); assert.equal(modal.parentElement,container);
    document.fullscreenElement=null; ui._rehomeSkillOverlay(); assert.equal(modal.parentElement,document.body);
    ui.hideLevelUp(); assert.equal(modal.parentElement,container);
}));

test('versioned UI entrypoints are precached together for offline installs', () => {
    const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
    const html=read('index.html'),main=read('src/main.js'),sw=read('service-worker.js');
    for (const [source,regex] of [[html,/\.\/src\/main\.js\?v=[^']+/],[html,/\.\/src\/menu-interface\.js\?v=[^']+/],
        [html,/\.\/interface\.css\?v=[^"]+/],[main,/\.\/ui\.js\?v=[^']+/]]) {
        let url=source.match(regex)?.[0]; assert.ok(url);
        if(source === main) url=url.replace('./','./src/');
        assert.ok(sw.includes(url),url+' missing from precache');
    }
});
