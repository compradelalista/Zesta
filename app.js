'use strict';
/* =========================================================================
   Cesta — lista de la compra. Web estática (GitHub Pages), todo en local.
   ========================================================================= */
const APP_VERSION = '1.0.0';
const G = globalThis;

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const round = n => Math.round(n * 1000) / 1000;
const eur = n => (Math.round(n * 100) / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const fmtQty = n => (Math.round(n * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : NaN; };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const today = () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function sing(w) {
  if (w.length < 4) return w;
  if (/ces$/.test(w)) return w.slice(0, -3) + 'z';
  if (/[aeiou][nlrd]es$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
  return w;
}
const keyOf = name => norm(name).split(' ').map(sing).join(' ');

/* ---------- Tabla de precios ---------- */
const TABLE = new Map();
const TABLE_NAMES = Object.keys(G.PRICE_TABLE || {});
for (const [k, v] of Object.entries(G.PRICE_TABLE || {})) TABLE.set(keyOf(k), v);

function lookupTable(name) {
  const k = keyOf(name);
  if (!k) return null;
  if (TABLE.has(k)) return { k, e: TABLE.get(k) };
  const pad = ' ' + k + ' ';
  let best = null, bestScore = 0;
  for (const [tk, e] of TABLE) {
    if (!pad.includes(' ' + tk + ' ')) continue;
    const score = (pad.startsWith(' ' + tk + ' ') ? 1000 : 0) + tk.length;
    if (score > bestScore) { best = { k: tk, e }; bestScore = score; }
  }
  return best;
}

/* ---------- Interpretar texto / dictado ---------- */
const NUMW = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, veinte: 20,
  veinticuatro: 24, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100, doscientos: 200, doscientas: 200,
  trescientos: 300, trescientas: 300, cuatrocientos: 400, quinientos: 500, quinientas: 500,
  medio: 0.5, media: 0.5, cuarto: 0.25, par: 2
};
const UNITS = [
  [/^(kilos?|kg|kgs|kilogramos?|quilos?)$/, 'kg'], [/^(gramos?|gr|grs|g)$/, 'g'],
  [/^(litros?|l|lt|lts)$/, 'l'], [/^(mililitros?|ml)$/, 'ml'], [/^(centilitros?|cl)$/, 'cl'],
  [/^(paquetes?|paq)$/, 'paquete'], [/^packs?$/, 'pack'], [/^(botes?|tarros?|frascos?)$/, 'bote'],
  [/^latas?$/, 'lata'], [/^(botellas?|botellines?)$/, 'botella'], [/^bolsas?$/, 'bolsa'],
  [/^(bricks?|briks?|tetrabriks?|tetrabricks?)$/, 'brick'], [/^cajas?$/, 'caja'], [/^barras?$/, 'barra'],
  [/^docenas?$/, 'docena'], [/^mallas?$/, 'malla'], [/^bandejas?$/, 'bandeja'], [/^tarrinas?$/, 'tarrina'],
  [/^sobres?$/, 'sobre'], [/^rollos?$/, 'rollo'], [/^(unidades?|uds?|piezas?)$/, 'ud']
];
const UNIT_OPTS = ['', 'ud', 'kg', 'g', 'l', 'ml', 'paquete', 'pack', 'bote', 'lata', 'botella', 'brick', 'bolsa', 'barra', 'docena', 'caja', 'malla', 'bandeja', 'tarrina', 'sobre', 'rollo'];
const FILLERS = new Set(['y', 'e', 'tambien', 'ademas', 'necesito', 'necesitamos', 'comprar', 'compra', 'apunta', 'apuntame', 'anade', 'anadir', 'pon', 'ponme', 'poner', 'quiero', 'falta', 'faltan', 'de', 'unos', 'unas', 'algo', 'poco', 'el', 'la', 'los', 'las', 'otro', 'otra', 'mas', 'luego', 'vale', 'bueno', 'pues', 'hay', 'que', 'coma', 'punto']);

function numVal(t) {
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  return Object.prototype.hasOwnProperty.call(NUMW, t) ? NUMW[t] : null;
}
function unitOf(t) { for (const [re, u] of UNITS) if (re.test(t)) return u; return null; }

function splitText(text) {
  return String(text || '')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\b(punto y aparte|punto y seguido|coma|punto)\b/gi, ',')
    .replace(/\s+(también|tambien|además|ademas|luego|después|despues)\s+/gi, ',')
    .split(/[,;\n]+|\.(?!\d)|\s+y\s+(?!medi[oa]\b(?!\s+(?:kilos?|litros?|docenas?|kg|l)\b))|\s+e\s+(?=[a-záéíóúñ])/i)
    .map(s => s.trim()).filter(Boolean);
}

function parseChunk(chunk) {
  const toks = chunk.replace(/(\d)\s?(kgs?|grs?|g|ml|cl|l)\b/gi, '$1 $2').split(/\s+/).filter(Boolean);
  const out = [];
  let cur = null;
  const fresh = () => ({ name: [], qty: null, unit: '', unitWord: '' });
  const N = i => (toks[i] ? norm(toks[i]) : '');
  for (let i = 0; i < toks.length;) {
    const raw = toks[i], t = N(i);
    if (!t) { i++; continue; }
    let q = /^\d+([.,]\d+)?$/.test(raw) ? parseFloat(raw.replace(',', '.')) : numVal(t);
    if (q != null) {
      let j = i + 1;
      if ((t === 'un' || t === 'una') && ['medio', 'media', 'cuarto', 'par'].includes(N(j))) { q = NUMW[N(j)]; j++; }
      if (cur && cur.name.length) { out.push(cur); cur = null; }
      if (!cur) cur = fresh();
      cur.qty = q;
      if (N(j) === 'de' && unitOf(N(j + 1))) j++;
      if (unitOf(N(j))) {
        cur.unit = unitOf(N(j)); cur.unitWord = N(j); j++;
        if (N(j) === 'y' && /^medi[oa]$/.test(N(j + 1))) { cur.qty += 0.5; j += 2; }
      }
      if (N(j) === 'de') j++;
      i = j; continue;
    }
    const u = unitOf(t);
    if (u && (!cur || !cur.name.length) && N(i + 1) === 'y' && /^medi[oa]$/.test(N(i + 2))) {
      if (!cur) cur = fresh();
      cur.unit = u; cur.unitWord = t; cur.qty = 1.5;
      i += 3; if (N(i) === 'de') i++;
      continue;
    }
    if (u && (!cur || !cur.name.length) && N(i + 1) === 'de') {
      if (!cur) cur = fresh();
      cur.unit = u; cur.unitWord = t; if (cur.qty == null) cur.qty = 1;
      i += 2; continue;
    }
    if ((!cur || !cur.name.length) && FILLERS.has(t)) { i++; continue; }
    if (!cur) cur = fresh();
    cur.name.push(raw); i++;
  }
  if (cur) out.push(cur);
  const res = [];
  for (const it of out) {
    if (!it.name.length) {
      const p = res[res.length - 1];
      if (p && p.qty == null) { p.qty = it.qty; if (it.unit) { p.unit = it.unit; p.unitWord = it.unitWord; } }
      continue;
    }
    res.push(...splitKnown(it));
  }
  return res.map(finishItem).filter(x => x.name);
}
// "leche huevos pan" (dictado sin pausas) → tres productos, si cada palabra es un producto conocido
function isKnown(k) { if (TABLE.has(k)) return true; try { const u = db.users[db.current]; return !!(u && u.history[k]); } catch (e) { return false; } }
function splitKnown(it) {
  const w = it.name;
  if (w.length < 2 || it.unit) return [it];
  const ks = w.map(x => keyOf(x));
  if (isKnown(keyOf(w.join(' '))) || !ks.every(isKnown)) return [it];
  return w.map((x, i) => ({ name: [x], qty: i === 0 ? it.qty : null, unit: '', unitWord: '' }));
}
function finishItem(it) {
  let name = it.name.join(' ').replace(/^[\s,.;:¡!¿?"'-]+|[\s,.;:¡!¿?"'-]+$/g, '');
  let unit = it.unit;
  if (it.unitWord && TABLE.has(keyOf(it.unitWord + ' de ' + name))) { name = it.unitWord + ' de ' + name; unit = ''; }
  return { name: cap(name), qty: it.qty == null ? 1 : round(it.qty), unit };
}
const parseText = text => splitText(text).flatMap(parseChunk);

/* ---------- Unidades y precios ---------- */
const BASE = { kg: ['kg', 1], g: ['kg', 0.001], l: ['l', 1], ml: ['l', 0.001], cl: ['l', 0.01], docena: ['docena', 1] };
const PACKS = new Set(['paquete', 'pack', 'caja', 'malla']);
const base = it => (BASE[it.unit] || ['ud'])[0];
const baseQty = it => (it.qty || 0) * (BASE[it.unit] || ['ud', 1])[1];
const unitShort = (u, q) => (!u ? '' : ['kg', 'g', 'l', 'ml', 'cl', 'ud'].includes(u) || q === 1 ? u : u + 's');
function qtyLabel(it) {
  if (!it.unit && it.qty === 1) return '';
  return fmtQty(it.qty) + (it.unit ? ' ' + unitShort(it.unit, it.qty) : '');
}
function priceUnitLabel(it) {
  const b = base(it);
  if (b !== 'ud') return b;
  return it.unit && it.unit !== 'ud' ? it.unit : 'unidad';
}
function tableCost(it) {
  const m = lookupTable(it.name);
  if (!m) return null;
  const [p, k = 0, n = 0] = m.e;
  const b = base(it), bq = baseQty(it);
  if (b === 'kg' || b === 'l') return k ? (p / k) * bq : p;
  if (it.unit === 'docena') return n ? (p * it.qty * 12) / n : p * it.qty;
  if (PACKS.has(it.unit)) return p * it.qty;
  if ((it.unit === '' || it.unit === 'ud') && n) return it.unit === '' && it.qty < 2 ? p : (p * it.qty) / n;
  return p * it.qty;
}
function cost(it, user = U()) {
  if (it.up != null) return { v: it.up * baseQty(it), src: 'manual' };
  const m = user && user.prices[keyOf(it.name)];
  if (m && m.base === base(it)) return { v: m.up * baseQty(it), src: m.src, note: m.note };
  const t = tableCost(it);
  if (t != null) return { v: t, src: 'tabla' };
  return null;
}
const SRC = { manual: 'precio puesto por ti', tabla: 'tabla orientativa', ia: 'estimación IA', web: 'IA con búsqueda web' };
function totals(l) {
  let t = 0, miss = 0;
  for (const it of l.items) { const c = cost(it); if (c) t += c.v; else miss++; }
  return { t, miss };
}

/* ---------- Datos (localStorage) ---------- */
const KEY = 'cesta:v1';
let db = loadDB();
function loadDB() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && typeof d === 'object' && d.users) return d; } catch (e) { /* vacío */ }
  return { users: {}, current: null };
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('No se ha podido guardar en este dispositivo'); }
}
const U = () => db.users[db.current] || null;
function L() {
  const u = U(); if (!u) return null;
  let l = u.lists.find(x => x.id === u.activeList);
  if (!l) { l = u.lists[0]; if (!l) { l = mkList('Compra'); u.lists.push(l); } u.activeList = l.id; }
  return l;
}
const getList = id => U().lists.find(x => x.id === id);
const mkList = (name, items = []) => ({ id: uid(), shareId: uid() + uid(), name, items, created: Date.now(), updated: Date.now() });
const mkItem = p => ({ id: uid(), name: p.name, qty: p.qty ?? 1, unit: p.unit || '', done: !!p.done, up: p.up ?? null });

const KINDS = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual', otra: 'Otra' };
function defaultTemplates() {
  const mk = (name, kind, lines) => ({ id: uid(), name, kind, items: parseText(lines.join('\n')) });
  return [
    mk('Compra semanal', 'semanal', ['6 bricks de leche', '1 docena de huevos', '2 barras de pan', '1 kg de tomates', '1 kg de plátanos', '1 kg de manzanas', '1 lechuga', '1 kg de pechuga de pollo', '1 paquete de jamón cocido', '1 paquete de queso en lonchas', '1 paquete de yogures', '1 bolsa de zanahorias']),
    mk('Despensa mensual', 'mensual', ['2 paquetes de arroz', '3 paquetes de pasta', '1 botella de aceite de oliva', '2 botes de tomate frito', '4 latas de atún', '2 botes de garbanzos', '1 paquete de café', '1 kg de azúcar', '1 paquete de sal', '1 paquete de harina']),
    mk('Limpieza e higiene', 'mensual', ['1 paquete de papel higiénico', '1 paquete de papel de cocina', '1 bote de detergente', '1 bote de lavavajillas', '1 paquete de bolsas de basura', '1 gel de ducha', '1 champú', '1 pasta de dientes'])
  ];
}
function createUser(name) {
  const id = uid();
  const u = {
    id, name: (name || '').trim() || 'Yo', lists: [], templates: defaultTemplates(), prices: {}, history: {},
    settings: { market: 'Mercadona', apiKey: '', model: 'claude-haiku-5-5', web: true }, activeList: null, created: Date.now()
  };
  const l = mkList('Compra'); u.lists.push(l); u.activeList = l.id;
  db.users[id] = u; db.current = id; save();
  return u;
}

function addItems(arr) {
  const l = L(), u = U();
  let n = 0;
  for (const p of arr) {
    if (!p || !p.name || !(p.qty > 0)) continue;
    const k = keyOf(p.name);
    const ex = l.items.find(x => keyOf(x.name) === k);
    if (ex) {
      if (ex.done) { ex.done = false; ex.qty = p.qty; ex.unit = p.unit; }
      else if (ex.unit === p.unit) ex.qty = round(ex.qty + p.qty);
      else { ex.qty = p.qty; ex.unit = p.unit; }
    } else l.items.push(mkItem(p));
    const h = u.history[k] || (u.history[k] = { n: 0 });
    Object.assign(h, { name: p.name, qty: p.qty, unit: p.unit, n: h.n + 1, last: Date.now() });
    n++;
  }
  l.updated = Date.now();
  save();
  return n;
}

/* ---------- Estado de la interfaz ---------- */
let tab = 'list';
let showDone = true;
let sheetCtx = null;
let sheetSeq = 0;
let pendingShare = null;
let busyAI = false;
let review = null;

const ic = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  mic: ic('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  share: ic('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/>'),
  check: ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  edit: ic('<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  cart: ic('<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>'),
  lists: ic('<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>'),
  cal: ic('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  sliders: ic('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  spark: ic('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  more: ic('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>')
};

/* ---------- Render ---------- */
function render() {
  const v = $('#view');
  if (!U()) { $('#hdr').hidden = true; $('#tabs').hidden = true; v.innerHTML = viewOnboarding(); return; }
  $('#hdr').hidden = false; $('#tabs').hidden = false;
  renderHeader(); renderTabs();
  v.innerHTML = tab === 'list' ? viewList() : tab === 'lists' ? viewLists() : tab === 'templates' ? viewTemplates() : viewSettings();
  document.body.dataset.tab = tab;
}
function refresh() {
  if (U() && tab === 'list' && $('#listBody')) {
    renderHeader();
    $('#listBody').innerHTML = listBody();
    const dl = $('#sugg'); if (dl) dl.innerHTML = suggestions();
  } else render();
}
function renderHeader() {
  const u = U();
  const titles = { lists: 'Mis listas', templates: 'Plantillas', settings: 'Ajustes' };
  $('#hdrTitle').innerHTML = tab === 'list' ? `${esc(L().name)} <small>▾</small>` : titles[tab];
  $('#shareBtn').hidden = tab !== 'list';
  $('#shareBtn').innerHTML = ICON.share;
  $('#userBtn').textContent = (u.name || '?').trim().charAt(0).toUpperCase();
}
function renderTabs() {
  const T = [['list', 'Lista', ICON.cart], ['lists', 'Listas', ICON.lists], ['templates', 'Plantillas', ICON.cal], ['settings', 'Ajustes', ICON.sliders]];
  $('#tabs').innerHTML = T.map(([k, l, i]) => `<button class="${tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${i}<span>${l}</span></button>`).join('');
}

function viewOnboarding() {
  const users = Object.values(db.users);
  return `<div class="onb">
    <div class="logo">${ICON.cart}</div>
    <h1>Cesta</h1>
    <p>Tu lista de la compra, simple y rápida.</p>
    ${users.length ? `<div class="stack">${users.map(o => `<button class="btn" data-act="user-switch" data-u="${o.id}">Soy ${esc(o.name)}</button>`).join('')}</div><p class="hint">o crea un usuario nuevo:</p>` : ''}
    <form data-form="onb" class="form">
      <input name="name" placeholder="¿Cómo te llamas?" required autocomplete="given-name" maxlength="40">
      <button class="btn primary block">Empezar</button>
    </form>
    <p class="hint">Todo se guarda en este dispositivo. Sin cuentas ni registros.</p>
  </div>`;
}

function suggestions() {
  const seen = new Set(), out = [];
  const add = n => { const k = keyOf(n); if (k && !seen.has(k)) { seen.add(k); out.push(`<option value="${esc(cap(n))}">`); } };
  Object.values(U().history).sort((a, b) => b.n - a.n).forEach(h => add(h.name));
  TABLE_NAMES.forEach(add);
  return out.join('');
}

function viewList() {
  return `<form class="addbar" data-form="add" autocomplete="off">
      <input id="addInput" name="q" list="sugg" placeholder="Añadir… ej: 2 kg patatas, leche" enterkeyhint="done" autocapitalize="sentences" aria-label="Añadir productos">
      <button class="addbtn" aria-label="Añadir">${ICON.plus}</button>
      <button type="button" class="mic" data-act="voice" aria-label="Dictar por voz">${ICON.mic}</button>
    </form>
    <datalist id="sugg">${suggestions()}</datalist>
    <div id="listBody">${listBody()}</div>`;
}
function listBody() {
  const l = L();
  const pend = l.items.filter(x => !x.done), done = l.items.filter(x => x.done);
  let h = chipsHtml(pend);
  if (!l.items.length) {
    h += `<div class="empty"><div class="empty-ic">${ICON.cart}</div>
      <p><b>Lista vacía</b></p>
      <p>Escribe arriba o pulsa el micrófono y di, por ejemplo:<br><i>«dos kilos de patatas, leche y una docena de huevos»</i></p>
      <p><button class="btn" data-act="tab" data-tab="templates">Usar una plantilla</button></p></div>`;
  }
  if (pend.length) h += `<ul class="items">${pend.map(itemRow).join('')}</ul>`;
  if (!pend.length && done.length) h += `<div class="empty small"><p><b>¡Todo en el carro!</b></p></div>`;
  if (done.length) {
    h += `<div class="sec"><button class="sec-t" data-act="toggle-done-sec">En el carro · ${done.length} ${showDone ? '▾' : '▸'}</button>
      <button class="link" data-act="clear-done">Quitar comprados</button></div>`;
    if (showDone) h += `<ul class="items">${done.map(itemRow).join('')}</ul>`;
  }
  if (l.items.length) {
    const t = totals(l);
    h += `<div class="summary"><div><div class="tot">${eur(t.t)}</div>
      <div class="tot-sub">estimado${t.miss ? ` · ${t.miss} sin precio` : ''}</div></div>
      <button class="btn ai" data-act="ai" ${busyAI ? 'disabled' : ''}>${ICON.spark}${busyAI ? 'Consultando…' : 'Precios IA'}</button></div>`;
  }
  return h;
}
function chipsHtml(pend) {
  const pk = new Set(pend.map(x => keyOf(x.name)));
  const h = Object.entries(U().history).filter(([k]) => !pk.has(k))
    .sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last).slice(0, 12);
  if (!h.length) return '';
  return `<div class="chips">${h.map(([k, v]) => `<button class="chip" data-act="chip" data-k="${esc(k)}">+ ${esc(v.name)}</button>`).join('')}</div>`;
}
function itemRow(it) {
  const c = cost(it), q = qtyLabel(it);
  const price = c ? `${c.src === 'tabla' ? '≈ ' : ''}${eur(c.v)}${c.src === 'ia' || c.src === 'web' ? '<small>IA</small>' : ''}` : '';
  return `<li class="item ${it.done ? 'done' : ''}" data-act="toggle" data-id="${it.id}">
    <span class="check">${ICON.check}</span>
    <span class="iname">${q ? `<b class="qty">${esc(q)}</b> ` : ''}${esc(it.name)}</span>
    <span class="iprice">${price}</span>
    <button class="icon-btn" data-act="edit" data-id="${it.id}" aria-label="Editar ${esc(it.name)}">${ICON.edit}</button>
  </li>`;
}

function viewLists() {
  const u = U();
  const lists = u.lists.slice().sort((a, b) => b.updated - a.updated);
  return `<div class="pad"><button class="btn primary block" data-act="new-list">${ICON.plus} Nueva lista</button></div>
  <ul class="cards">${lists.map(l => {
    const t = totals(l), p = l.items.filter(x => !x.done).length;
    return `<li class="card ${l.id === u.activeList ? 'active' : ''}" data-act="open-list" data-id="${l.id}">
      <div class="card-main"><b>${esc(l.name)}</b><span>${p} pendientes · ${l.items.length} productos${t.t ? ' · ' + eur(t.t) : ''}</span></div>
      <button class="icon-btn" data-act="list-menu" data-id="${l.id}" aria-label="Opciones">${ICON.more}</button></li>`;
  }).join('')}</ul>`;
}

function viewTemplates() {
  const u = U();
  return `<div class="pad stack-h">
      <button class="btn primary" data-act="tpl-new">${ICON.plus} Nueva</button>
      <button class="btn" data-act="tpl-from-list" data-id="${L().id}">Guardar lista actual</button>
      <button class="btn" data-act="tpl-habituales">Desde mis habituales</button>
    </div>
    <ul class="cards">${u.templates.map(t => {
      const est = t.items.reduce((s, it) => s + (cost(it)?.v || 0), 0);
      return `<li class="card">
        <div class="card-main" data-act="tpl-edit" data-id="${t.id}"><b>${esc(t.name)}</b>
          <span><em class="badge">${KINDS[t.kind] || 'Otra'}</em>${t.items.length} productos${est ? ' · ≈ ' + eur(est) : ''}</span></div>
        <div class="card-btns">
          <button class="btn small primary" data-act="tpl-use" data-id="${t.id}">Crear lista</button>
          <button class="btn small" data-act="tpl-add" data-id="${t.id}">+ A la lista actual</button>
          <button class="btn small ghost" data-act="tpl-edit" data-id="${t.id}">Editar</button>
        </div></li>`;
    }).join('') || '<li class="hint pad">No tienes plantillas.</li>'}</ul>
    <p class="hint pad">Una plantilla es tu compra estándar (semanal, mensual…). «Crear lista» genera una lista nueva con la fecha de hoy; «+ A la lista actual» la suma a la que estás usando.</p>`;
}

const MARKETS = ['Mercadona', 'Carrefour', 'Lidl', 'Dia', 'Alcampo', 'Consum', 'Eroski', 'Aldi', 'El Corte Inglés'];
function viewSettings() {
  const u = U(), s = u.settings;
  const others = Object.values(db.users).filter(x => x.id !== u.id);
  return `<div class="pad settings">
  <section>
    <h3>Usuario</h3>
    <div class="row-between"><span class="avatar big">${esc(u.name.charAt(0).toUpperCase())}</span>
      <div class="grow"><b>${esc(u.name)}</b><div class="hint">Tus listas se guardan solo en este dispositivo.</div></div>
      <button class="btn small ghost" data-act="user-rename">Cambiar</button></div>
    ${others.map(o => `<button class="btn ghost" data-act="user-switch" data-u="${o.id}">Cambiar a ${esc(o.name)}</button>`).join('')}
    <button class="btn" data-act="user-new">${ICON.plus} Añadir otro usuario</button>
  </section>
  <section>
    <h3>Precios con IA</h3>
    <form data-form="settings" class="form">
      <label>Supermercado de referencia<select name="market">${MARKETS.map(m => `<option ${m === s.market ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      <label>Clave de API de Anthropic<input name="apiKey" type="password" autocomplete="off" value="${esc(s.apiKey)}" placeholder="sk-ant-…"></label>
      <p class="hint">Consíguela en console.anthropic.com. Se guarda solo en este navegador y se envía únicamente a la API de Anthropic. No la pongas en un móvil compartido.</p>
      <label class="check-row"><input type="checkbox" name="web" ${s.web ? 'checked' : ''}> Buscar precios reales en la web del supermercado</label>
      <details><summary class="hint">Avanzado</summary><label>Modelo<input name="model" value="${esc(s.model)}"></label></details>
      <button class="btn primary">Guardar</button>
    </form>
    <button class="btn ghost" data-act="prices-reset">Olvidar precios aprendidos (${Object.keys(u.prices).length})</button>
  </section>
  <section>
    <h3>Datos</h3>
    <button class="btn" data-act="export">Descargar copia de seguridad</button>
    <label class="btn">Restaurar copia<input type="file" accept="application/json,.json" id="importFile" hidden></label>
    <button class="btn danger ghost" data-act="user-delete">Borrar este usuario</button>
  </section>
  <p class="hint center">Cesta v${APP_VERSION} · Los precios de la tabla son orientativos.</p>
  </div>`;
}

/* ---------- Hojas (modales inferiores) ---------- */
function openSheet(html, ctx = null) {
  if (sheetCtx && sheetCtx.res) sheetCtx.res(null);
  sheetCtx = ctx; sheetSeq++;
  $('#toast').hidden = true;
  const s = $('#sheet');
  $('#sheetCard').innerHTML = html;
  s.hidden = false;
  requestAnimationFrame(() => s.classList.add('open'));
}
function closeSheet() {
  const ctx = sheetCtx; sheetCtx = null;
  if (ctx && ctx.res) ctx.res(null);
  if (voice) cancelVoice();
  const s = $('#sheet'), seq = sheetSeq;
  s.classList.remove('open');
  setTimeout(() => { if (seq === sheetSeq) { s.hidden = true; $('#sheetCard').innerHTML = ''; } }, 180);
}
function askText(title, value = '', ph = '') {
  return new Promise(res => {
    openSheet(`<form data-form="ask" class="form"><h3>${esc(title)}</h3>
      <input name="v" value="${esc(value)}" placeholder="${esc(ph)}" required maxlength="60">
      <div class="actions"><button type="button" class="btn ghost" data-act="close">Cancelar</button><button class="btn primary">Aceptar</button></div></form>`, { res });
    setTimeout(() => { const i = $('#sheetCard input'); if (i) { i.focus(); i.select(); } }, 60);
  });
}
function askConfirm(title, msg = '', ok = 'Aceptar', danger = false) {
  return new Promise(res => {
    openSheet(`<div class="form"><h3>${esc(title)}</h3>${msg ? `<p class="hint">${esc(msg)}</p>` : ''}
      <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button>
      <button class="btn ${danger ? 'danger-solid' : 'primary'}" data-act="confirm-ok">${esc(ok)}</button></div></div>`, { res });
  });
}
function resolveSheet(val) {
  const ctx = sheetCtx; sheetCtx = null;
  closeSheet();
  if (ctx && ctx.res) ctx.res(val);
}

let toastT;
function toast(msg, label, fn, ms = 2600) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button id="toastBtn">${esc(label)}</button>` : ''}`;
  t.hidden = false;
  if (label) $('#toastBtn').onclick = () => { t.hidden = true; fn && fn(); };
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}

/* ---------- Edición de producto ---------- */
function openEdit(id) {
  const it = L().items.find(x => x.id === id); if (!it) return;
  const c = cost(it);
  const auto = c && baseQty(it) ? eur(c.v / baseQty(it)) : '';
  openSheet(`<form data-form="item" class="form">
    <h3>Editar producto</h3>
    <label>Nombre<input name="name" value="${esc(it.name)}" required maxlength="80"></label>
    <div class="row">
      <label class="grow">Cantidad<div class="stepper"><button type="button" data-act="step" data-d="-1" aria-label="Menos">−</button><input name="qty" inputmode="decimal" value="${fmtQty(it.qty)}"><button type="button" data-act="step" data-d="1" aria-label="Más">+</button></div></label>
      <label>Unidad<select name="unit">${UNIT_OPTS.map(u => `<option value="${u}" ${u === it.unit ? 'selected' : ''}>${u || '—'}</option>`).join('')}</select></label>
    </div>
    <label><span class="lbl-inline">Precio en € por <span id="puLabel">${priceUnitLabel(it)}</span></span><input name="up" inputmode="decimal" placeholder="${auto ? 'Automático: ' + auto : 'Sin precio'}" value="${it.up != null ? fmtQty(it.up) : ''}"></label>
    <p class="hint">${c ? `Estimado: <b>${eur(c.v)}</b> · ${SRC[c.src] || c.src}${c.note ? ' · ' + esc(c.note) : ''}` : 'Sin precio. Ponlo a mano o pulsa «Precios IA».'}</p>
    <div class="actions"><button type="button" class="btn danger" data-act="del-item">Borrar</button><button class="btn primary">Guardar</button></div>
  </form>`, { type: 'item', id });
}
function saveItem(f) {
  const it = L().items.find(x => x.id === sheetCtx.id); if (!it) return closeSheet();
  const name = f.name.value.trim(); if (!name) return;
  const q = num(f.qty.value);
  it.name = cap(name);
  it.qty = q > 0 ? round(q) : 1;
  it.unit = f.unit.value;
  const up = num(f.up.value);
  it.up = up >= 0 ? up : null;
  if (it.up != null) U().prices[keyOf(it.name)] = { up: it.up, base: base(it), src: 'manual', at: Date.now() };
  L().updated = Date.now(); save(); closeSheet(); refresh();
}
function deleteItem(id) {
  const l = L(), idx = l.items.findIndex(x => x.id === id); if (idx < 0) return;
  const [it] = l.items.splice(idx, 1);
  save(); refresh();
  toast(`Borrado: ${it.name}`, 'Deshacer', () => { l.items.splice(idx, 0, it); save(); refresh(); }, 5000);
}

/* ---------- Dictado por voz ---------- */
const SR = G.SpeechRecognition || G.webkitSpeechRecognition;
let rec = null, voice = null;

function startVoice() {
  if (!SR) { openReview('', true); return; }
  voice = { finals: [], interim: '', active: true, err: '', done: false };
  openSheet(`<div class="voice">
    <button class="mic-big on" id="micBig" data-act="voice-done" aria-label="Terminar">${ICON.mic}</button>
    <p class="hint">Habla con naturalidad. Haz una pausa o di «y» entre productos.<br>Nada se añade hasta que lo revises.</p>
    <div id="vText" class="v-text"></div>
    <div class="actions"><button class="btn ghost" data-act="close">Cancelar</button><button class="btn primary" data-act="voice-done">Listo, revisar</button></div>
  </div>`, { type: 'voice' });
  updVoice();
  beginRec();
}
function beginRec() {
  try {
    rec = new SR();
    rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = e => {
      if (!voice) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i], t = r[0].transcript.trim();
        if (r.isFinal) pushFinal(t); else interim += t + ' ';
      }
      voice.interim = interim.trim();
      updVoice();
    };
    rec.onerror = e => {
      if (!voice || e.error === 'no-speech' || e.error === 'aborted') return;
      voice.err = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Permite el micrófono para esta web (icono del candado junto a la dirección).'
        : e.error === 'network' ? 'El dictado necesita conexión a internet.' : 'Error de dictado: ' + e.error;
      voice.active = false; updVoice();
    };
    rec.onend = () => {
      if (!voice) return;
      if (voice.finishing) return finishVoice();
      if (voice.active) { try { rec.start(); } catch (_) { voice.active = false; updVoice(); } }
    };
    rec.start();
  } catch (e) {
    if (voice) { voice.err = 'No se pudo iniciar el dictado en este navegador.'; voice.active = false; updVoice(); }
  }
}
function pushFinal(t) {
  if (!t) return;
  const f = voice.finals, last = f[f.length - 1];
  if (last && t.toLowerCase() === last.toLowerCase()) return;
  if (last && t.toLowerCase().startsWith(last.toLowerCase())) f[f.length - 1] = t; // evita duplicados de Chrome Android
  else f.push(t);
}
function updVoice() {
  const box = $('#vText'); if (!box || !voice) return;
  const lines = voice.finals.map(f => `<div>${esc(f)}</div>`).join('');
  box.innerHTML = (lines || voice.interim ? lines + (voice.interim ? `<div class="int">${esc(voice.interim)}…</div>` : '') : '<div class="int">Escuchando…</div>')
    + (voice.err ? `<div class="err">${esc(voice.err)}</div>` : '');
  const mb = $('#micBig'); if (mb) mb.classList.toggle('on', voice.active);
}
function stopVoice() {
  if (!voice) return;
  voice.active = false; voice.finishing = true;
  try { rec && rec.stop(); } catch (_) { /* nada */ }
  setTimeout(finishVoice, 1200); // por si el navegador no avisa del final
}
function finishVoice() {
  if (!voice || voice.done) return;
  voice.done = true;
  const text = [...voice.finals, voice.interim].filter(Boolean).join('\n');
  voice = null; rec = null;
  openReview(text);
}
function cancelVoice() {
  if (!voice) return;
  voice.active = false; voice.done = true;
  try { rec && rec.abort(); } catch (_) { /* nada */ }
  voice = null; rec = null;
}

/* ---------- Revisión antes de añadir ---------- */
function openReview(text, noSR = false) {
  review = { items: parseText(text) };
  openSheet(`<div class="form review">
    <h3>Revisa antes de añadir</h3>
    ${noSR ? '<p class="hint">Este navegador no trae dictado propio: toca el cuadro y usa el micrófono de tu teclado.</p>' : ''}
    <label>Texto<textarea id="revText" rows="3" placeholder="dos kilos de patatas, leche, pan…">${esc(text)}</textarea></label>
    <div id="revRows">${revRows()}</div>
    <div class="actions">${SR ? `<button class="btn" data-act="voice-again">${ICON.mic} Otra vez</button>` : ''}<button class="btn primary" data-act="rev-add" id="revAdd"></button></div>
  </div>`, { type: 'review' });
  updRevBtn();
  if (noSR) setTimeout(() => { const t = $('#revText'); t && t.focus(); }, 250);
}
function revRows() {
  if (!review.items.length) return '<p class="hint">Aún no hay productos. Escribe o corrige el texto de arriba (separa con comas).</p>';
  return review.items.map((it, i) => {
    const c = cost(it);
    return `<div class="rev-row">
      <input data-r="qty" data-i="${i}" value="${fmtQty(it.qty)}" inputmode="decimal" aria-label="Cantidad">
      <select data-r="unit" data-i="${i}" aria-label="Unidad">${UNIT_OPTS.map(u => `<option value="${u}" ${u === it.unit ? 'selected' : ''}>${u || '—'}</option>`).join('')}</select>
      <input data-r="name" data-i="${i}" value="${esc(it.name)}" aria-label="Producto">
      <span class="rev-p">${c ? eur(c.v) : ''}</span>
      <button class="icon-btn" data-act="rev-del" data-i="${i}" aria-label="Quitar">${ICON.x}</button></div>`;
  }).join('');
}
function updRevBtn() {
  const b = $('#revAdd'); if (!b) return;
  const n = review.items.filter(x => x.name.trim() && x.qty > 0).length;
  b.textContent = n ? `Añadir ${n} producto${n > 1 ? 's' : ''}` : 'Añadir';
  b.disabled = !n;
}

/* ---------- Compartir ---------- */
function b64u(bytes) {
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '=';
  const s = atob(str), b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}
async function encodeList(l) {
  const json = JSON.stringify({ v: 1, n: l.name, s: l.shareId, f: U().name, i: l.items.map(x => [x.name, x.qty, x.unit, x.done ? 1 : 0, x.up]) });
  if (G.CompressionStream) {
    const st = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + b64u(new Uint8Array(await new Response(st).arrayBuffer()));
  }
  return 'p' + b64u(new TextEncoder().encode(json));
}
async function decodeList(code) {
  const b = unb64u(code.slice(1));
  let json;
  if (code[0] === 'z') json = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  else json = new TextDecoder().decode(b);
  const p = JSON.parse(json);
  if (!p || !Array.isArray(p.i)) throw new Error('mal');
  return p;
}
function listAsText(l) {
  const t = totals(l);
  return `🛒 ${l.name}\n` + l.items.map(x => `${x.done ? '☑' : '☐'} ${qtyLabel(x) ? qtyLabel(x) + ' ' : ''}${x.name}`).join('\n')
    + (t.t ? `\n\nTotal estimado: ${eur(t.t)}` : '');
}
async function openShare(id) {
  const l = getList(id) || L();
  const url = location.origin + location.pathname + '#l=' + await encodeList(l);
  const others = Object.values(db.users).filter(x => x.id !== db.current);
  openSheet(`<div class="form"><h3>Compartir «${esc(l.name)}»</h3>
    <p class="hint">Quien abra el enlace guarda una copia en su móvil. Si cambias la lista, vuelve a compartirla y su copia se actualizará.</p>
    <div class="stack">
      ${navigator.share ? `<button class="btn primary" data-act="share-native">${ICON.share} Enviar enlace…</button>` : ''}
      <button class="btn ${navigator.share ? '' : 'primary'}" data-act="share-wa">WhatsApp</button>
      <button class="btn" data-act="share-copy">Copiar enlace</button>
      <button class="btn" data-act="share-text">Copiar como texto</button>
    </div>
    ${others.length ? `<h4>Pasar a otro usuario de este dispositivo</h4><div class="stack">${others.map(o => `<button class="btn ghost" data-act="share-local" data-u="${o.id}">→ ${esc(o.name)}</button>`).join('')}</div>` : ''}
  </div>`, { type: 'share', id: l.id, url });
}
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { await askText('Copia este texto', text); }
}
async function handleShare(code) {
  let p;
  try { p = await decodeList(code); } catch (e) { toast('El enlace de lista no es válido'); return; }
  const ex = U().lists.find(x => x.shareId === p.s);
  const shown = p.i.slice(0, 8).map(x => `<li>${esc(qtyLabel({ qty: x[1], unit: x[2] }))} ${esc(x[0])}</li>`).join('');
  openSheet(`<div class="form"><h3>${esc(p.f || 'Alguien')} te comparte una lista</h3>
    <p><b>${esc(p.n)}</b> · ${p.i.length} productos</p>
    <ul class="mini">${shown}${p.i.length > 8 ? `<li>…y ${p.i.length - 8} más</li>` : ''}</ul>
    <div class="stack">
      ${ex ? `<button class="btn primary" data-act="imp-update">Actualizar mi copia</button><button class="btn" data-act="imp-new">Guardar como lista nueva</button>`
          : `<button class="btn primary" data-act="imp-new">Guardar lista</button>`}
      <button class="btn ghost" data-act="close">Ahora no</button>
    </div></div>`, { type: 'import', p, exId: ex && ex.id });
}
const itemsFromShare = p => p.i.map(x => mkItem({ name: String(x[0] || '').slice(0, 80), qty: num(x[1]) > 0 ? num(x[1]) : 1, unit: UNIT_OPTS.includes(x[2]) ? x[2] : '', done: !!x[3], up: num(x[4]) >= 0 ? num(x[4]) : null })).filter(x => x.name);

/* ---------- IA: estimación de precios ---------- */
async function runAI() {
  const u = U(), s = u.settings, l = L();
  if (!l.items.length || busyAI) return;
  if (!s.apiKey) return openAISetup();
  const items = l.items.slice();
  busyAI = true; refresh();
  toast(s.web ? `Buscando precios en ${s.market}…` : 'Estimando precios…', null, null, 120000);
  try {
    const res = await askClaude(s, items);
    let n = 0;
    for (const r of res) {
      const it = items[r.i], tot = num(r.total);
      if (!it || !(tot > 0) || tot > 2000) continue;
      const bq = baseQty(it) || 1;
      u.prices[keyOf(it.name)] = { up: tot / bq, base: base(it), src: s.web ? 'web' : 'ia', at: Date.now(), note: String(r.producto || '').slice(0, 90) };
      n++;
    }
    save();
    toast(n ? `Precios actualizados: ${n} de ${items.length}` : 'La IA no devolvió precios válidos', null, null, 4000);
  } catch (e) {
    toast(e.message || 'Error al consultar la IA', null, null, 7000);
  } finally { busyAI = false; refresh(); }
}
async function askClaude(s, items) {
  const lines = items.map((it, i) => `${i}. ${qtyLabel(it) || '1'} ${it.name}`).join('\n');
  const prompt = `Eres un asistente de compras en España. Estima cuánto cuesta cada producto de esta lista de la compra en ${s.market}.
${s.web ? `Usa la búsqueda web para consultar precios actuales (por ejemplo, en la tienda online de ${s.market}). Si no encuentras un producto, estima con precios habituales en España.` : 'Usa los precios habituales actuales en España.'}
Para cada línea calcula el coste TOTAL en euros de la cantidad indicada (si no se indica, 1 envase o unidad del formato más habitual). Elige siempre la opción más corriente y económica, de marca del supermercado si existe.

Lista:
${lines}

Termina tu respuesta con un array JSON entre <json> y </json>, con un objeto por línea:
{"i": número de línea, "total": euros como número, "producto": "producto y formato elegido"}`;
  let messages = [{ role: 'user', content: prompt }];
  let tools = s.web ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: Math.min(12, 3 + Math.ceil(items.length / 3)) }] : null;
  let text = '';
  for (let turn = 0; turn < 5; turn++) {
    const body = { model: s.model || 'claude-haiku-5-5', max_tokens: 4096, messages };
    if (tools) body.tools = tools;
    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify(body)
      });
    } catch (e) { throw new Error('Sin conexión con la IA. Revisa tu internet.'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (data.error && data.error.message) || 'HTTP ' + r.status;
      if (tools && r.status === 400 && /tool|web_search/i.test(msg)) { tools = null; continue; }
      if (r.status === 401) throw new Error('La clave de API no es válida. Revísala en Ajustes.');
      throw new Error('IA: ' + msg);
    }
    text += (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    if (data.stop_reason === 'pause_turn') { messages = [...messages, { role: 'assistant', content: data.content }]; continue; }
    break;
  }
  const m = text.match(/<json>([\s\S]*?)<\/json>/) || text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('No he podido leer la respuesta de la IA');
  try { const arr = JSON.parse(m[1] || m[0]); return Array.isArray(arr) ? arr : []; }
  catch (e) { throw new Error('La respuesta de la IA no tenía el formato esperado'); }
}
function openAISetup() {
  const s = U().settings;
  openSheet(`<form data-form="aisetup" class="form"><h3>${ICON.spark} Precios con IA</h3>
    <p class="hint">La IA busca el precio de cada producto (en ${esc(s.market)} si activas la búsqueda web) y calcula el total. Necesitas una clave de API de Anthropic (console.anthropic.com). Se guarda solo en este dispositivo.</p>
    <label>Clave de API<input name="apiKey" type="password" autocomplete="off" placeholder="sk-ant-…" required></label>
    <label>Supermercado<select name="market">${MARKETS.map(m => `<option ${m === s.market ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
    <label class="check-row"><input type="checkbox" name="web" ${s.web ? 'checked' : ''}> Buscar precios reales en la web</label>
    <div class="actions"><button type="button" class="btn ghost" data-act="close">Ahora no</button><button class="btn primary">Guardar y estimar</button></div>
  </form>`, { type: 'aisetup' });
}

/* ---------- Plantillas ---------- */
function lineOf(it) {
  const q = qtyLabel(it);
  return !q ? it.name : it.unit ? `${q} de ${it.name}` : `${q} ${it.name}`;
}
function openTpl(t, isNew = false) {
  openSheet(`<form data-form="tpl" class="form"><h3>${isNew ? 'Nueva plantilla' : 'Editar plantilla'}</h3>
    <label>Nombre<input name="name" value="${esc(t.name)}" required maxlength="60"></label>
    <label>Frecuencia<select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}" ${k === t.kind ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label>Productos (uno por línea)<textarea name="items" rows="10" placeholder="2 kg de patatas&#10;leche&#10;1 docena de huevos">${esc(t.items.map(lineOf).join('\n'))}</textarea></label>
    <div class="actions">${isNew ? '' : `<button type="button" class="btn danger" data-act="tpl-del" data-id="${t.id}">Borrar</button>`}<button class="btn primary">Guardar</button></div>
  </form>`, { type: 'tpl', t, isNew });
}
const tplItems = items => items.map(x => ({ name: x.name, qty: x.qty, unit: x.unit }));

/* ---------- Copias de seguridad ---------- */
function exportUser() {
  const u = U();
  const blob = new Blob([JSON.stringify({ type: 'cesta-backup', version: 1, date: new Date().toISOString(), user: u }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cesta-${norm(u.name).replace(/ /g, '-') || 'usuario'}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importBackup(file) {
  try {
    const d = JSON.parse(await file.text());
    const u = d && d.type === 'cesta-backup' && d.user;
    if (!u || !u.id || !Array.isArray(u.lists)) throw 0;
    if (db.users[u.id] && !(await askConfirm(`¿Sustituir los datos de ${u.name}?`, 'Ya existe este usuario en el dispositivo.', 'Sustituir', true))) return;
    u.prices = u.prices || {}; u.history = u.history || {}; u.templates = u.templates || [];
    u.settings = Object.assign({ market: 'Mercadona', apiKey: '', model: 'claude-haiku-5-5', web: true }, u.settings);
    db.users[u.id] = u; db.current = u.id; save(); tab = 'list'; render();
    toast(`Copia restaurada: ${u.name}`);
  } catch (e) { toast('Ese archivo no es una copia válida de Cesta'); }
}

/* ---------- Eventos ---------- */
async function onClick(e) {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, u = U();
  switch (a) {
    case 'tab': tab = el.dataset.tab; closeSheetIfOpen(); render(); scrollTo(0, 0); break;
    case 'title': if (tab === 'list') { tab = 'lists'; render(); } break;
    case 'share': openShare(L().id); break;
    case 'toggle': {
      const it = L().items.find(x => x.id === id); if (!it) break;
      it.done = !it.done; L().updated = Date.now(); save(); refresh();
      if (navigator.vibrate) navigator.vibrate(8);
      break;
    }
    case 'edit': e.stopPropagation(); openEdit(id); break;
    case 'chip': {
      const h = u.history[el.dataset.k]; if (!h) break;
      addItems([{ name: h.name, qty: h.qty || 1, unit: h.unit || '' }]); refresh(); break;
    }
    case 'toggle-done-sec': showDone = !showDone; refresh(); break;
    case 'clear-done': {
      const l = L(), before = l.items.slice();
      l.items = l.items.filter(x => !x.done); save(); refresh();
      toast('Comprados quitados', 'Deshacer', () => { l.items = before; save(); refresh(); }, 5000);
      break;
    }
    case 'ai': runAI(); break;
    case 'step': {
      const f = el.closest('form'), inp = f.qty, unit = f.unit.value;
      const st = ['g', 'ml'].includes(unit) ? 100 : ['kg', 'l'].includes(unit) ? 0.5 : 1;
      const v = round((num(inp.value) || 0) + st * Number(el.dataset.d));
      inp.value = fmtQty(v > 0 ? v : st);
      break;
    }
    case 'del-item': { const iid = sheetCtx && sheetCtx.id; closeSheet(); deleteItem(iid); break; }
    case 'close': closeSheet(); break;
    case 'confirm-ok': resolveSheet(true); break;

    // Voz y revisión
    case 'voice': startVoice(); break;
    case 'voice-done': stopVoice(); break;
    case 'voice-again': startVoice(); break;
    case 'rev-del': review.items.splice(Number(el.dataset.i), 1); $('#revRows').innerHTML = revRows(); updRevBtn(); break;
    case 'rev-add': {
      const ok = review.items.filter(x => x.name.trim() && x.qty > 0).map(x => ({ ...x, name: cap(x.name.trim()) }));
      const n = addItems(ok); closeSheet(); refresh();
      toast(`Añadido${n > 1 ? 's' : ''} ${n} producto${n > 1 ? 's' : ''}`);
      break;
    }

    // Compartir
    case 'share-native': {
      const c = sheetCtx, l = getList(c.id);
      try { await navigator.share({ title: l.name, text: `${u.name} te comparte la lista «${l.name}»`, url: c.url }); closeSheet(); }
      catch (err) { if (err && err.name !== 'AbortError') copy(c.url, 'Enlace copiado'); }
      break;
    }
    case 'share-wa': {
      const c = sheetCtx, l = getList(c.id);
      window.open('https://wa.me/?text=' + encodeURIComponent(listAsText(l) + '\n\nÁbrela en la app: ' + c.url), '_blank');
      break;
    }
    case 'share-copy': copy(sheetCtx.url, 'Enlace copiado'); break;
    case 'share-text': copy(listAsText(getList(sheetCtx.id)), 'Lista copiada como texto'); break;
    case 'share-local': {
      const l = getList(sheetCtx.id), other = db.users[el.dataset.u]; if (!l || !other) break;
      const ex = other.lists.find(x => x.shareId === l.shareId);
      const items = l.items.map(x => mkItem(x));
      if (ex) { ex.items = items; ex.name = l.name; ex.updated = Date.now(); }
      else other.lists.push(Object.assign(mkList(l.name, items), { shareId: l.shareId }));
      save(); closeSheet(); toast(`Lista enviada a ${other.name}`);
      break;
    }
    case 'imp-new': case 'imp-update': {
      const { p, exId } = sheetCtx;
      let l;
      if (a === 'imp-update' && exId) { l = getList(exId); l.items = itemsFromShare(p); l.name = p.n; l.updated = Date.now(); }
      else { l = Object.assign(mkList(String(p.n || 'Lista compartida').slice(0, 60), itemsFromShare(p)), { shareId: exId ? uid() + uid() : p.s }); u.lists.push(l); }
      u.activeList = l.id; save(); closeSheet(); tab = 'list'; render();
      toast(a === 'imp-update' ? 'Lista actualizada' : 'Lista guardada');
      break;
    }

    // Listas
    case 'new-list': {
      const name = await askText('Nueva lista', '', 'Ej: Compra del sábado'); if (!name) break;
      const l = mkList(name.trim()); u.lists.push(l); u.activeList = l.id; save(); tab = 'list'; render();
      break;
    }
    case 'open-list': u.activeList = id; save(); tab = 'list'; render(); scrollTo(0, 0); break;
    case 'list-menu': {
      e.stopPropagation();
      const l = getList(id);
      openSheet(`<div class="form"><h3>${esc(l.name)}</h3><div class="stack">
        <button class="btn" data-act="lm-rename" data-id="${id}">Renombrar</button>
        <button class="btn" data-act="lm-dup" data-id="${id}">Duplicar</button>
        <button class="btn" data-act="lm-share" data-id="${id}">Compartir</button>
        <button class="btn" data-act="tpl-from-list" data-id="${id}">Guardar como plantilla</button>
        <button class="btn" data-act="lm-uncheck" data-id="${id}">Desmarcar todo</button>
        <button class="btn danger" data-act="lm-del" data-id="${id}">Borrar lista</button></div></div>`, { type: 'lmenu' });
      break;
    }
    case 'lm-rename': {
      const l = getList(id), name = await askText('Renombrar lista', l.name); if (!name) break;
      l.name = name.trim(); save(); render(); break;
    }
    case 'lm-dup': {
      const l = getList(id), c = mkList(l.name + ' (copia)', l.items.map(x => mkItem({ ...x, done: false })));
      u.lists.push(c); save(); closeSheet(); render(); toast('Lista duplicada'); break;
    }
    case 'lm-share': closeSheet(); setTimeout(() => openShare(id), 200); break;
    case 'lm-uncheck': getList(id).items.forEach(x => { x.done = false; }); save(); closeSheet(); render(); break;
    case 'lm-del': {
      const l = getList(id);
      if (!(await askConfirm(`¿Borrar «${l.name}»?`, 'No se puede deshacer.', 'Borrar', true))) break;
      u.lists = u.lists.filter(x => x.id !== id);
      if (!u.lists.length) u.lists.push(mkList('Compra'));
      if (u.activeList === id) u.activeList = u.lists[0].id;
      save(); render(); break;
    }

    // Plantillas
    case 'tpl-new': openTpl({ id: uid(), name: '', kind: 'semanal', items: [] }, true); break;
    case 'tpl-from-list': {
      const l = getList(id) || L();
      openTpl({ id: uid(), name: l.name, kind: 'semanal', items: tplItems(l.items) }, true); break;
    }
    case 'tpl-habituales': {
      const h = Object.values(u.history).sort((x, y) => y.n - x.n).slice(0, 25);
      if (!h.length) { toast('Aún no hay productos habituales. ¡Usa la app unos días!'); break; }
      openTpl({ id: uid(), name: 'Mis habituales', kind: 'semanal', items: h.map(x => ({ name: x.name, qty: x.qty || 1, unit: x.unit || '' })) }, true);
      break;
    }
    case 'tpl-edit': openTpl(u.templates.find(t => t.id === id)); break;
    case 'tpl-use': {
      const t = u.templates.find(x => x.id === id);
      const l = mkList(`${t.name} · ${today()}`, t.items.map(mkItem)); u.lists.push(l); u.activeList = l.id;
      t.items.forEach(x => { const k = keyOf(x.name); const h = u.history[k] || (u.history[k] = { n: 0 }); Object.assign(h, { name: x.name, qty: x.qty, unit: x.unit, n: h.n + 1, last: Date.now() }); });
      save(); tab = 'list'; render(); scrollTo(0, 0); toast(`Lista creada desde «${t.name}»`);
      break;
    }
    case 'tpl-add': {
      const t = u.templates.find(x => x.id === id);
      const n = addItems(t.items.map(x => ({ ...x }))); tab = 'list'; render(); toast(`${n} productos añadidos a «${L().name}»`);
      break;
    }
    case 'tpl-del': {
      const ctx = sheetCtx;
      if (!(await askConfirm('¿Borrar la plantilla?', '', 'Borrar', true))) { if (ctx) openTpl(ctx.t); break; }
      u.templates = u.templates.filter(t => t.id !== id); save(); render(); break;
    }

    // Usuarios y ajustes
    case 'user-rename': { const n = await askText('Tu nombre', u.name); if (n) { u.name = n.trim(); save(); render(); } break; }
    case 'user-new': {
      const n = await askText('Nuevo usuario', '', 'Nombre'); if (!n) break;
      createUser(n); tab = 'list'; render(); toast(`Hola, ${n.trim()}`); break;
    }
    case 'user-switch': db.current = el.dataset.u; save(); tab = 'list'; render(); processPending(); break;
    case 'user-delete': {
      if (!(await askConfirm(`¿Borrar a ${u.name} y todas sus listas?`, 'Descarga antes una copia si la quieres conservar.', 'Borrar', true))) break;
      delete db.users[u.id]; db.current = null; save(); render(); break;
    }
    case 'prices-reset': u.prices = {}; save(); render(); toast('Precios aprendidos olvidados'); break;
    case 'export': exportUser(); break;
  }
}
function closeSheetIfOpen() { if (!$('#sheet').hidden) closeSheet(); }

function onSubmit(e) {
  const f = e.target, k = f.dataset.form; if (!k) return;
  e.preventDefault();
  const u = U();
  switch (k) {
    case 'add': {
      const v = f.q.value.trim(); if (!v) return;
      const items = parseText(v);
      if (!items.length) return;
      addItems(items); f.q.value = ''; refresh();
      toast(items.length === 1 ? `Añadido: ${items[0].name}` : `Añadidos ${items.length} productos`, null, null, 1500);
      break;
    }
    case 'item': saveItem(f); break;
    case 'ask': resolveSheet(f.v.value.trim() || null); break;
    case 'onb': createUser(f.name.value); tab = 'list'; render(); processPending(); break;
    case 'settings': {
      const s = u.settings;
      s.market = f.market.value; s.apiKey = f.apiKey.value.trim(); s.web = f.web.checked; s.model = f.model.value.trim() || 'claude-haiku-5-5';
      save(); toast('Ajustes guardados'); break;
    }
    case 'aisetup': {
      const s = u.settings;
      s.apiKey = f.apiKey.value.trim(); s.market = f.market.value; s.web = f.web.checked;
      save(); closeSheet(); if (s.apiKey) runAI(); break;
    }
    case 'tpl': {
      const { t, isNew } = sheetCtx;
      t.name = f.name.value.trim() || 'Plantilla';
      t.kind = f.kind.value;
      t.items = parseText(f.items.value);
      if (isNew) u.templates.push(t);
      save(); closeSheet(); tab = 'templates'; render(); toast('Plantilla guardada');
      break;
    }
  }
}

let revT;
function onInput(e) {
  const t = e.target;
  if (t.id === 'revText' && review) {
    clearTimeout(revT);
    revT = setTimeout(() => { review.items = parseText(t.value); $('#revRows').innerHTML = revRows(); updRevBtn(); }, 300);
  } else if (t.dataset && t.dataset.r && review) {
    const it = review.items[Number(t.dataset.i)]; if (!it) return;
    if (t.dataset.r === 'qty') it.qty = num(t.value) > 0 ? num(t.value) : 0;
    else it[t.dataset.r] = t.value;
    updRevBtn();
  } else if (t.name === 'unit' && t.form && t.form.dataset.form === 'item') {
    const l = $('#puLabel'); if (l) l.textContent = priceUnitLabel({ unit: t.value });
  }
}

function checkHash() {
  const m = location.hash.match(/^#l=([A-Za-z0-9_-]+)/);
  if (!m) return;
  pendingShare = m[1];
  history.replaceState(null, '', location.pathname + location.search);
}
function processPending() {
  if (!pendingShare || !U()) return;
  const c = pendingShare; pendingShare = null;
  handleShare(c);
}

function init() {
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  document.addEventListener('input', onInput);
  document.addEventListener('change', e => { if (e.target.id === 'importFile' && e.target.files[0]) importBackup(e.target.files[0]); });
  $('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  window.addEventListener('hashchange', () => { checkHash(); processPending(); });
  window.addEventListener('storage', e => { if (e.key === KEY) { db = loadDB(); render(); } });
  checkHash();
  render();
  processPending();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

if (typeof document !== 'undefined' && document.getElementById('view')) init();
if (typeof module !== 'undefined') module.exports = { parseText, keyOf, lookupTable, tableCost, qtyLabel, lineOf };
