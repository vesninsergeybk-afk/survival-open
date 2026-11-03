import {SYSTEMS, ISSUE_REFS, REF_TITLES, PARTIAL_REFS, WORKSTREAMS, EMP_CUE_FRAMES} from './systems-data.js?v=emp-concept-1';

const $ = id => document.getElementById(id);
const make = (tag, klass, value) => {
 const node = document.createElement(tag);
 if (klass) node.className = klass;
 if (value !== undefined) node.textContent = value;
 return node;
};
const chapters = ['Все', ...new Set(SYSTEMS.map(item => item.chapter))];
const status = ref => PARTIAL_REFS.includes(ref) ? 'Частично в коде' : 'Концепция';
const episodeWord = count => {
 const mod10 = count % 10, mod100 = count % 100;
 return mod100 >= 11 && mod100 <= 14 ? 'эпизодов' : mod10 === 1 ? 'эпизод' : mod10 >= 2 && mod10 <= 4 ? 'эпизода' : 'эпизодов';
};
const represented = new Set(SYSTEMS.flatMap(item => item.refs));
if (ISSUE_REFS.length !== 31 || ISSUE_REFS.some(ref => !represented.has(ref))) {
 console.error('В игровом реестре не охвачены все исходные пункты');
}
let active = SYSTEMS[0].id;
let currentBeat = 0;
let group = 'Все';
let query = '';

function setGroup(next) {
 group = next;
 query = '';
 $('sys-search').value = '';
 renderFilters();
 renderCards();
}
function choose(id, scroll = false) {
 active = id;
 currentBeat = 0;
 renderCards();
 renderDetail();
 if (scroll) $('sys-detail').scrollIntoView({behavior: 'smooth', block: 'start'});
}
function visibleItems() {
 const q = query.trim().toLocaleLowerCase('ru');
 return SYSTEMS.filter(item => {
  if (group !== 'Все' && item.chapter !== group) return false;
  if (!q) return true;
  return [item.id, item.name, item.essence, item.reality, item.hypothesis, item.chapter,
   ...item.refs, ...item.refs.map(ref => REF_TITLES[ref] || '')].join(' ').toLocaleLowerCase('ru').includes(q);
 });
}
function renderFilters() {
 const box = $('sys-filters');
 box.replaceChildren();
 for (const name of chapters) {
  const button = make('button', '', name === 'Все' ? 'Все 15' : name);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(name === group));
  button.addEventListener('click', () => setGroup(name));
  box.append(button);
 }
}
function renderCards() {
 const box = $('sys-cards');
 box.replaceChildren();
 const items = visibleItems();
 if (!items.length) {
  box.append(make('p', 'sys-empty', 'Ничего не найдено. Попробуйте другое название или номер из реестра.'));
  return;
 }
 for (const item of items) {
  const button = make('button', 'sys-card');
  button.type = 'button';
  button.setAttribute('aria-pressed', String(item.id === active));
  const row = make('span', 'sys-card-top');
  row.append(make('span', 'sys-id', item.id.toUpperCase() + ' · ' + item.chapter), make('span', 'sys-refs', item.refs.join(' ')));
  button.append(row, make('strong', '', item.name), make('small', '', item.phase + ' · ' + item.beats.length + ' ' + episodeWord(item.beats.length)));
  button.addEventListener('click', () => choose(item.id));
  box.append(button);
 }
}
function badge(textValue, partial = false) {
 return make('span', 'sys-badge' + (partial ? ' sys-partial' : ''), textValue);
}
function block(title, description, klass = '') {
 const el = make('section', 'sys-box ' + klass);
 el.append(make('span', '', title), make('p', '', description));
 return el;
}
function renderBeat(item, container) {
 const beat = item.beats[currentBeat];
 const head = make('div', 'sys-phasehead');
 head.append(make('h4', '', 'Последовательность действий'), make('small', '', 'Сцена ' + (currentBeat + 1) + ' из ' + item.beats.length));
 const timeline = make('div', 'sys-beats');
 timeline.setAttribute('role', 'group');
 timeline.setAttribute('aria-label', 'Выберите эпизод');
 item.beats.forEach((step, index) => {
  const button = make('button', '', String(index + 1));
  button.type = 'button';
  button.setAttribute('aria-pressed', String(index === currentBeat));
  button.setAttribute('aria-label', 'Эпизод ' + (index + 1) + ': ' + step[0]);
  button.addEventListener('click', () => {currentBeat = index; renderDetail();});
  timeline.append(button);
 });
 const scene = make('div', 'sys-stage');
 scene.append(make('h5', '', beat[0]));
 const lines = make('div', 'sys-stage-grid');
 const labels = ['ИГРОК ДЕЛАЕТ', 'МИР ОТВЕЧАЕТ', 'ВОЗНИКАЕТ ВЫБОР'];
 for (let i = 0; i < 3; i++) {
  const line = make('div', 'sys-stage-item');
  line.append(make('strong', '', labels[i]), make('p', '', beat[i + 1]));
  lines.append(line);
 }
 scene.append(lines);
 const controls = make('div', 'sys-stage-nav');
 const back = make('button', '', '← Предыдущее');
 back.type = 'button';
 back.disabled = currentBeat === 0;
 back.addEventListener('click', () => {currentBeat--; renderDetail();});
 const next = make('button', 'primary', currentBeat === item.beats.length - 1 ? 'К первому эпизоду ↻' : 'Следующий эпизод →');
 next.type = 'button';
 next.addEventListener('click', () => {currentBeat = (currentBeat + 1) % item.beats.length; renderDetail();});
 controls.append(back, next);
 scene.append(controls);
 container.append(head, timeline, scene);
}
function formatProposal(item) {
 const lines = ['# ' + item.name, 'Раздел: ' + item.chapter, 'Статус: ' + item.phase,
  'Реестр: ' + item.refs.join(', '), '', 'Замысел: ' + item.essence, '',
  'Что известно из проекта: ' + item.reality, 'Проверяемая гипотеза: ' + item.hypothesis, '', 'События:'];
 item.beats.forEach((step, index) => {
  lines.push((index + 1) + '. ' + step[0], 'Игрок: ' + step[1], 'Мир: ' + step[2], 'Выбор: ' + step[3], '');
 });
 lines.push('Правило: ' + item.rule, 'Опасность: ' + item.risk, 'Проверка: ' + item.test,
  'Зависимости: ' + item.deps, '', 'Источник: https://github.com/vesninsergeybk-afk/survival-open/issues/1');
 return lines.join('\n');
}
function renderEmpPrototype(root) {
 const section = make('section','sys-emp-lab');
 section.id='sys-emp-lab';
 const intro = make('div','sys-emp-heading');
 intro.append(make('span','sys-emp-eyebrow','ИНТЕРАКТИВНЫЙ МАКЕТ · ПЕРЕД ПРАВКОЙ ИГРЫ'),
  make('h4','','Как бортовой ИИ объяснит импульс'),
  make('p','','Переключайте семь проверочных ситуаций. Здесь показаны ожидаемые подписи; их совпадение с игровым кодом проверяется отдельно.'));
 section.append(intro);
 const viewport = make('div','sys-emp-viewport');
 const emblem = make('div','sys-emp-emblem');
 emblem.setAttribute('aria-hidden','true');
 emblem.append(make('span','','ЭМ'));
 const overlay = make('div','sys-emp-overlay');
 const topline = make('span','sys-emp-overline','БОРТОВОЙ ИИ · ГЛУШИТЕЛЬ');
 const cueLabel = make('strong','sys-emp-label');
 const cueHint = make('span','sys-emp-hint');
 overlay.append(topline,cueLabel,cueHint);
 viewport.append(emblem,overlay);
 const buttons=make('div','sys-emp-picker');
 buttons.setAttribute('role','group');
 buttons.setAttribute('aria-label','Состояния глушителя');
 const info=make('p','sys-emp-explanation');
 info.setAttribute('aria-live','polite');
 const controls=[];
 const show = index => {
  const frame=EMP_CUE_FRAMES[index];
  viewport.dataset.cue=frame.key;
  viewport.style.setProperty('--emp-color',frame.color);
  cueLabel.textContent=frame.label;
  cueHint.textContent=frame.hint;
  info.textContent=frame.explanation;
  controls.forEach((button,i)=>button.setAttribute('aria-pressed',String(index===i)));
 };
 EMP_CUE_FRAMES.forEach((frame,i)=>{
  const button=make('button','',frame.name);
  button.type='button';
  button.addEventListener('click',()=>show(i));
  buttons.append(button);controls.push(button);
 });
 section.append(viewport,buttons,info);
 root.append(section);
 show(0);
}

function renderDetail() {
 const item = SYSTEMS.find(entry => entry.id === active);
 if (!item) return;
 const root = $('sys-detail');
 root.replaceChildren();
 root.append(make('div', 'sys-eyebrow', item.chapter + ' · ' + item.id.toUpperCase()));
 root.append(make('h3', 'sys-title', item.name), make('p', 'sys-lead', item.essence));
 const badges = make('div', 'sys-badges');
 badges.append(badge(item.phase, item.phase === 'Частично в игре'), badge('Приоритет ' + item.priority));
 for (const ref of item.refs) badges.append(badge(ref));
 root.append(badges);
 const comparison = make('div', 'sys-comparison');
 const real = make('div', 'sys-compare');
 real.append(make('span', '', 'ЧТО УЖЕ ИЗВЕСТНО'), make('p', '', item.reality));
 const proposed = make('div', 'sys-compare sys-hypothesis');
 proposed.append(make('span', '', 'ГИПОТЕЗА · НУЖНО ПРОВЕРИТЬ'), make('p', '', item.hypothesis));
 comparison.append(real, proposed);
 root.append(comparison);
 if (item.id === 'emp') renderEmpPrototype(root);
 renderBeat(item, root);
 const rails = make('div', 'sys-guardrails');
 rails.append(block('ОБЯЗАТЕЛЬНОЕ ПРАВИЛО', item.rule),
  block('ЧТО МОЖЕТ ИСПОРТИТЬ ИГРУ', item.risk, 'sys-risk'),
  block('КРИТЕРИЙ ПРОВЕРКИ В ИГРЕ', item.test, 'sys-test'));
 root.append(rails);
 const footer = make('div', 'sys-footer');
 footer.append(make('small', '', 'Зависимости: ' + item.deps));
 const copy = make('button', 'sys-copy', 'Скопировать концепцию');
 copy.type = 'button';
 const status = make('span', 'sys-copy-status');
 status.setAttribute('role','status');
 copy.addEventListener('click', async () => {
  try {
   await navigator.clipboard.writeText(formatProposal(item));
   status.textContent = 'Текст концепции скопирован.';
  } catch {
   status.textContent = 'Буфер обмена недоступен. Концепция остаётся доступна на странице.';
  }
 });
 footer.append(copy);
 root.append(footer, status);
}

function renderWorkstreams() {
 const root = $('sys-roadmap-list');
 if (!root) return;
 root.replaceChildren();
 for (const stream of WORKSTREAMS) {
  const button = make('button', 'sys-milestone');
  button.type = 'button';
  button.setAttribute('aria-label', stream.title + ': открыть подробную концепцию');
  const head = make('span', 'sys-milestone-head');
  head.append(make('strong', '', stream.title), make('em', '', stream.state));
  const fact = make('p', '', stream.fact);
  const next = make('p', '', stream.next);
  const gate = make('small', '', 'УСЛОВИЕ ПРИЁМКИ · ' + stream.gate);
  button.append(head, fact, next, gate);
  button.addEventListener('click', () => choose(stream.id, true));
  root.append(button);
 }
}

function renderCoverage() {
 const box = $('sys-coverage-list');
 const sections = [
  ['А · Первые минуты и задания', ISSUE_REFS.filter(ref => ref.startsWith('А'))],
  ['Б · Оружие и развитие', ISSUE_REFS.filter(ref => ref.startsWith('Б'))],
  ['В · Базы и сеть', ISSUE_REFS.filter(ref => ref.startsWith('В'))],
  ['Г · Астероиды и события', ISSUE_REFS.filter(ref => ref.startsWith('Г'))],
  ['Д · Проверка качества', ISSUE_REFS.filter(ref => ref.startsWith('Д'))]
 ];
 for (const [title, ids] of sections) {
  const section = make('section', 'sys-cover-group');
  section.append(make('h4', '', title));
  const row = make('div', 'sys-cover-items');
  for (const ref of ids) {
   const button = make('button', 'sys-cover-item');
   button.type = 'button';
   button.dataset.partial = String(PARTIAL_REFS.includes(ref));
   button.title = 'Перейти к соответствующей концепции';
   button.append(make('b','',ref), make('span','',REF_TITLES[ref]), make('em','',status(ref)));
   button.addEventListener('click', () => {
    setGroup('Все');
    const entry = SYSTEMS.find(item => item.refs.includes(ref));
    if (entry) choose(entry.id, true);
   });
   row.append(button);
  }
  section.append(row);
  box.append(section);
 }
}
function init() {
 const metrics = $('sys-metrics');
 const values = [
  [ISSUE_REFS.length, 'пункт исходного реестра'],
  [represented.size, 'пункт с концепцией'],
  [SYSTEMS.length, 'проектных систем'],
  [PARTIAL_REFS.length, 'частично в коде · не приняты']
 ];
 for (const [number, description] of values) {
  const tile = make('div', 'sys-metric');
  tile.append(make('b', '', String(number)), make('small', '', description));
  metrics.append(tile);
 }
 $('sys-search').addEventListener('input', event => {
  query = event.target.value;
  renderCards();
 });
 renderFilters();
 renderCards();
 renderWorkstreams();
 renderCoverage();
 renderDetail();
}
if ($('panel-systems')) init();
