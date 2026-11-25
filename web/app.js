// Edición · 6 Grados — cada vídeo pasa por Idea, Guion, Corte y Edición; «Copiar a Claude» le pasa a tu Claude
// lo que necesita para hacer la siguiente versión. La app es un hueco: cómo te gustan los guiones, los cortes y la
// edición lo aprende tu cerebro. Los datos viven en archivos (ver CLAUDE.md) y la web los lee a través de servidor.mjs.
'use strict';

const ETAPAS = [
  { k: 'idea', n: 'Idea' }, { k: 'guion', n: 'Guion' }, { k: 'corte', n: 'Corte' }, { k: 'edicion', n: 'Edición' }
];
const IDX = { idea: 0, guion: 1, corte: 2, edicion: 3, terminado: 4 };
const $app = document.getElementById('app');
const S = { estado: null, lista: [], v: null, ruta: { vista: 'tablero' }, firma: null, guardando: 0, pendiente: false, nueva: false, lado: 'texto', completa: false, verV: {} };

// ── utilidades ──────────────────────────────────────────────────────────────────────────────
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function add(p, ...hijos) { hijos.flat().forEach((h) => h != null && h !== false && p.appendChild(typeof h === 'string' ? document.createTextNode(h) : h)); return p; }
const ICON = {
  play: '<path d="M7 5v14l12-7z" fill="currentColor"/>', pausa: '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/>',
  atras: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', adelante: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  dividir: '<path d="M12 3v18"/><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/>', quitar: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  recuperar: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', nota: '<path d="M12 5v14M5 12h14"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', subir: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/>',
  completa: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', sig: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>', ok: '<path d="m5 12 5 5 9-10"/>',
  cortar: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>'
};
function svg(n) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.innerHTML = ICON[n] || ''; return s; }
function boton(txt, { cls = '', icono, al, titulo, dis } = {}) {
  const b = el('button', 'bt ' + cls); b.type = 'button';
  if (icono) b.appendChild(svg(icono)); b.appendChild(el('span', null, txt));
  if (titulo) b.title = titulo; if (dis) b.disabled = true; if (al) b.addEventListener('click', al); return b;
}
const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + String(x).padStart(2, '0'); };
const fmtF = (iso) => { const d = new Date(iso + 'T12:00'); return isNaN(d) ? '' : d.getDate() + '-' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const escribiendo = () => { const a = document.activeElement; return a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type === 'text') || a.isContentEditable); };
// Solo se espera a repintar si ha tecleado hace poco: con el cursor quieto en una caja, lo de Claude aparece igual.
let ultimaTecla = 0; document.addEventListener('input', () => { ultimaTecla = Date.now(); }, true);
const tecleando = () => escribiendo() && Date.now() - ultimaTecla < 5000;
function pintarConFoco() { const a = document.activeElement, id = a && a.id, ini = a && a.selectionStart; pintar(); const f = id && document.getElementById(id); if (f) { f.focus(); try { f.setSelectionRange(ini, ini); } catch (e) {} } }
const mac = /Mac|iPhone|iPad/.test(navigator.platform);

let toastT; function toast(t, ms = 3200) {
  let e = document.querySelector('.toast'); if (!e) { e = el('div', 'toast'); e.setAttribute('role', 'status'); document.body.appendChild(e); }
  e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { e.hidden = true; }, ms);
}

async function api(ruta, op = {}) {
  const r = await fetch(ruta, { cache: 'no-store', ...op, headers: { 'Content-Type': 'application/json', ...(op.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 409) throw new Error(j.error || ('Error ' + r.status));
  return { status: r.status, j };
}

// ── tema (un solo botón: sol o luna) ─────────────────────────────────────────────────────────
const bTema = document.getElementById('b-tema');
function pintarTema() {
  const osc = document.documentElement.dataset.tema === 'oscuro';
  bTema.replaceChildren(svg(osc ? 'sol' : 'luna')); bTema.setAttribute('aria-label', osc ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}
bTema.addEventListener('click', () => {
  const osc = document.documentElement.dataset.tema !== 'oscuro';
  if (osc) document.documentElement.dataset.tema = 'oscuro'; else delete document.documentElement.dataset.tema;
  try { localStorage.setItem('6g-edicion.tema', osc ? 'oscuro' : ''); } catch (e) {}
  pintarTema(); if (ED.pintarOnda) ED.pintarOnda();
});
pintarTema();

// ── dictado a micrófono abierto (Web Speech API; en Safari y Chrome del Mac) ─────────────────────
const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
const DIC = { rec: null, ta: null, boton: null };
function dictar(ta, b) {
  if (DIC.rec) { const mismo = DIC.ta === ta; pararDictado(); if (mismo) return; }
  if (!Rec) { toast('Este navegador no deja dictar. Usa Handy o el dictado del Mac (pulsa dos veces la tecla Fn).', 5200); return; }
  const r = new Rec(); r.lang = 'es-ES'; r.continuous = true; r.interimResults = false;
  r.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) {
      const t = ev.results[i][0].transcript.trim(); if (!t) continue;
      ta.value = (ta.value && !/\s$/.test(ta.value) ? ta.value + ' ' : ta.value) + t; ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  r.onerror = (e) => { if (e.error === 'not-allowed') toast('El navegador no tiene permiso para el micrófono: dáselo en el candado de la barra de direcciones.', 5200); pararDictado(); };
  r.onend = () => { if (DIC.rec === r) { try { r.start(); } catch (e) { pararDictado(); } } };   // micrófono abierto hasta que lo pares
  DIC.rec = r; DIC.ta = ta; DIC.boton = b;
  try { r.start(); } catch (e) { pararDictado(); return; }
  if (b) { b.classList.add('grab'); b.querySelector('span').textContent = 'Parar (⌥D)'; const p = el('i', 'punto'); b.prepend(p); }
  ta.focus();
}
function pararDictado() {
  const r = DIC.rec; DIC.rec = null; if (r) try { r.stop(); } catch (e) {}
  if (DIC.boton && DIC.boton.isConnected) { DIC.boton.classList.remove('grab'); DIC.boton.querySelector('span').textContent = 'Dictar (⌥D)'; const p = DIC.boton.querySelector('.punto'); if (p) p.remove(); }
  DIC.ta = DIC.boton = null;
}
function botonMic(ta) { const b = boton('Dictar (⌥D)', { cls: 'chico mic', icono: 'mic', titulo: 'Habla y se escribe solo; vuelve a pulsar para parar' }); b.addEventListener('click', () => dictar(ta, b)); ta._mic = b; return b; }

// ── datos ───────────────────────────────────────────────────────────────────────────────────
async function cargarLista() { const { j } = await api('/api/videos'); S.lista = j.videos || []; S.firmaLista = S.lista.map((x) => x.id + x.firma).join('|'); }
async function cargarVideo(id) { const { j } = await api('/api/videos/' + id); S.v = j; S.firma = j.firma; return j; }
let guardarT;
function guardar(inmediato) {
  S.pendiente = true; clearTimeout(guardarT);
  guardarT = setTimeout(guardarYa, inmediato ? 0 : 350);
}
async function guardarYa() {
  const v = S.v; if (!v) return; S.pendiente = false; S.guardando++;
  const datos = { titulo: v.titulo, etapa: v.etapa, creado: v.creado, idea: v.idea, guion: v.guion, corte: v.corte, edicion: v.edicion, feedback: v.feedback };
  for (const k of Object.keys(v)) if (!(k in datos) && !['id', 'carpeta', 'guiones', 'archivos', 'transcripcion', 'ondas', 'firma', 'mtime', 'guionVersiones'].includes(k)) datos[k] = v[k];
  try {
    const { status, j } = await api('/api/videos/' + v.id + '/json', { method: 'PUT', body: JSON.stringify({ datos, mtime: v.mtime }) });
    if (status === 409) { S.v = j; S.firma = j.firma; toast('Claude acaba de cambiar este vídeo: lo he recargado.'); pintar(); }
    else { v.mtime = j.mtime; S.firma = j.firma; }
  } catch (e) { toast('No se ha podido guardar: ' + e.message); }
  S.guardando--;
}
async function guardarGuion(n, texto) {
  S.v.guiones[n] = texto; S.guardando++;
  try { const { j } = await api('/api/videos/' + S.v.id + '/guion/' + n, { method: 'PUT', body: JSON.stringify({ texto }) }); S.firma = j.firma; } catch (e) { toast('No se ha podido guardar el guion: ' + e.message); }
  S.guardando--;
}

// Vigila los archivos: lo que hace Claude aparece solo.
setInterval(async () => {
  if (document.hidden || S.guardando || S.pendiente) return;
  try {
    if (S.ruta.vista === 'tablero') {
      const antes = S.firmaLista; await cargarLista(); if (S.firmaLista !== antes && !tecleando()) pintarConFoco();
    } else if (S.v) {
      const { j } = await api('/api/videos/' + S.v.id + '/firma'); if (j.firma === S.firma || tecleando() || S.guardando || S.pendiente) return;
      const viejo = S.v; await cargarVideo(viejo.id);
      const nov = [];
      if (S.v.guion.version > viejo.guion.version) nov.push('guion v' + S.v.guion.version);
      if (S.v.corte.version > viejo.corte.version) nov.push('corte v' + S.v.corte.version);
      if (S.v.edicion.version > viejo.edicion.version) nov.push('edición v' + S.v.edicion.version);
      if (!viejo.transcripcion && S.v.transcripcion) nov.push('el texto de tu grabación');
      if (nov.length) { toast('Claude ha terminado: ' + nov.join(', ') + '.', 4200); S.verV = {}; if (IDX[S.v.etapa] < 4 && S.ruta.etapa !== S.v.etapa && IDX[S.v.etapa] > IDX[viejo.etapa]) { S.ruta.etapa = S.v.etapa; history.replaceState(null, '', '#/v/' + S.v.id + '/' + S.v.etapa); } }
      pintarConFoco();
    }
  } catch (e) {}
}, 2000);

// ── rutas ───────────────────────────────────────────────────────────────────────────────────
function leerRuta() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'v' && h[1]) return { vista: 'video', id: h[1], etapa: h[2] || null };
  return { vista: 'tablero' };
}
async function irRuta() {
  pararDictado(); salirCompleta(); S.ruta = leerRuta(); S.verV = {};
  if (S.ruta.vista === 'video') {
    try { await cargarVideo(S.ruta.id); } catch (e) { location.hash = '#/'; return; }
    if (!S.ruta.etapa || !(S.ruta.etapa in IDX) || S.ruta.etapa === 'terminado') S.ruta.etapa = S.v.etapa === 'terminado' ? 'edicion' : S.v.etapa;
  } else { S.v = null; await cargarLista(); }
  pintar(); window.scrollTo(0, 0); enfocarEditor();
}
// En Corte y Edición la página baja hasta el editor: vídeo y línea de tiempo a la vista sin desplazarse.
function enfocarEditor() { const e = document.querySelector('.editor'); const p = e && e.closest('.panel'); if (!p) return; const cab = document.querySelector('.cab'); const alto = cab && getComputedStyle(cab).position === 'sticky' ? cab.offsetHeight : 0; window.scrollTo(0, p.getBoundingClientRect().top + window.scrollY - alto - 10); }
window.addEventListener('hashchange', irRuta);
function irEtapa(k) { S.ruta.etapa = k; S.verV = {}; history.replaceState(null, '', '#/v/' + S.v.id + '/' + k); pararDictado(); salirCompleta(); pintar(); enfocarEditor(); }

// ── pintar ──────────────────────────────────────────────────────────────────────────────────
function pintar() {
  const y = window.scrollY;
  ED.desmontar();
  $app.replaceChildren(S.ruta.vista === 'video' && S.v ? vistaVideo() : vistaTablero());
  window.scrollTo(0, y);
}

// TABLERO
function etapaDe(v) { return v.etapa === 'terminado' ? 'terminado' : v.etapa; }
function metaTarjeta(v) {
  if (v.etapa === 'idea') return v.idea ? 'Idea apuntada' : 'Idea por escribir';
  if (v.etapa === 'guion') return v.guion.version ? 'Guion v' + v.guion.version : 'Esperando el guion v1';
  if (v.etapa === 'corte') return !v.corte.fuente ? 'Falta la grabación' : v.corte.version ? 'Corte v' + v.corte.version : 'Grabación subida';
  if (v.etapa === 'edicion') return v.edicion.version ? 'Edición v' + v.edicion.version : 'Esperando la edición v1';
  return 'Lista';
}
function puntos(v) { const d = el('span', 'puntos'), c = IDX[v.etapa]; ETAPAS.forEach((e, i) => d.appendChild(el('i', i < c ? 'hecho' : i === c ? 'ahora' : ''))); return d; }
function vistaTablero() {
  const f = document.createDocumentFragment();
  const cab = el('div', 'tab-cab');
  const t = el('div'); add(t, el('p', 'ceja', 'Tus vídeos'), add(el('h1'), 'Tablero', el('span', 'punto', '.')), el('p', 'sub', 'Cada vídeo pasa por cuatro etapas: Idea, Guion, Corte y Edición. En cada una, «Copiar a Claude» le pasa a tu Claude lo que necesita para hacer la siguiente versión.'));
  add(cab, t, boton('Nueva idea (N)', { cls: 'prim', icono: 'nota', al: () => { S.nueva = true; pintar(); } }));
  f.appendChild(cab);
  if (S.nueva) f.appendChild(formNueva());
  const cols = el('div', 'columnas');
  ETAPAS.forEach((e, i) => {
    const vs = S.lista.filter((v) => etapaDe(v) === e.k).sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
    const c = el('section', 'col'); c.setAttribute('aria-label', e.n);
    add(c, add(el('div', 'col-cab'), el('span', 'num', String(i + 1)), el('b', null, e.n), el('span', null, String(vs.length))));
    if (!vs.length) c.appendChild(el('div', 'col-vacia', i === 0 ? 'Apunta aquí cada idea que se te ocurra.' : 'Nada en esta etapa.'));
    vs.forEach((v) => {
      const b = el('button', 'tarjeta'); b.type = 'button';
      add(b, el('b', null, v.titulo), add(el('span', 'pie'), puntos(v), el('span', null, metaTarjeta(v)), el('span', null, '· ' + fmtF(v.creado))));
      b.addEventListener('click', () => { location.hash = '#/v/' + v.id; }); c.appendChild(b);
    });
    cols.appendChild(c);
  });
  f.appendChild(cols);
  const listos = S.lista.filter((v) => v.etapa === 'terminado');
  if (listos.length) {
    const d = el('details', 'listos'); d.appendChild(el('summary', null, 'Listos (' + listos.length + ')'));
    listos.forEach((v) => { const r = el('div', 'fila'); add(r, svg('ok'), el('b', null, v.titulo), el('span', 'sub', 'Edición v' + v.edicion.version)); r.querySelector('.sub').style.margin = '0 0 0 auto'; r.addEventListener('click', () => { location.hash = '#/v/' + v.id + '/edicion'; }); d.appendChild(r); });
    f.appendChild(d);
  }
  return f;
}
function formNueva() {
  const box = el('form', 'nueva'); box.setAttribute('aria-label', 'Nueva idea');
  const ti = el('input'); ti.type = 'text'; ti.placeholder = 'Título corto (por ejemplo: «Hummus de calabaza para el otoño»)'; ti.required = true;
  const ta = el('textarea'); ta.rows = 3; ta.placeholder = 'Qué quieres contar, a quién y qué tiene que sentir o hacer al verlo. Puedes dictarlo.';
  const cm = el('div', 'con-mic'); add(cm, ta, botonMic(ta));
  add(box, add(el('div', 'campo'), el('label', null, 'Título'), ti), add(el('div', 'campo'), el('label', null, 'La idea'), cm),
    add(el('div', 'acciones'), boton('Cancelar (Esc)', { al: () => { S.nueva = false; pararDictado(); pintar(); } }), boton('Crear (⌘↵)', { cls: 'prim', icono: 'ok', al: () => box.requestSubmit() })));
  box.addEventListener('submit', async (e) => {
    e.preventDefault(); const titulo = ti.value.trim(); if (!titulo) { ti.focus(); return; }
    pararDictado();
    const { j } = await api('/api/videos', { method: 'POST', body: JSON.stringify({ titulo, idea: ta.value.trim() }) });
    S.nueva = false; location.hash = '#/v/' + j.id + '/idea';
  });
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); box.requestSubmit(); } if (e.key === 'Escape') { S.nueva = false; pararDictado(); pintar(); } });
  setTimeout(() => ti.focus(), 0);
  return box;
}

// VÍDEO
function versionDe(k) { const v = S.v; return k === 'guion' ? v.guion.version : k === 'corte' ? v.corte.version : k === 'edicion' ? v.edicion.version : 0; }
function vistaVideo() {
  const v = S.v, f = document.createDocumentFragment(), c = IDX[v.etapa];
  const vol = el('button', 'volver'); add(vol, '← Tablero (Esc)'); vol.addEventListener('click', () => { location.hash = '#/'; }); f.appendChild(vol);
  const tit = el('div', 'titulo-video');
  add(tit, el('p', 'ceja', 'Vídeo · creado el ' + fmtF(v.creado) + (v.etapa === 'terminado' ? ' · listo' : '')), add(el('h1'), v.titulo, el('span', 'punto', '.')));
  f.appendChild(tit);
  const barra = el('nav', 'etapas'); barra.setAttribute('aria-label', 'Etapas');
  ETAPAS.forEach((e, i) => {
    if (i) barra.appendChild(el('span', 'flecha', '→'));
    const ver = versionDe(e.k), est = i < c ? 'hecho' : i === c ? 'ahora' : '';
    const b = el('button', 'etapa ' + est + (S.ruta.etapa === e.k ? ' sel' : '')); b.type = 'button';
    const n = el('span', 'n'); if (est === 'hecho') n.appendChild(svg('ok')), n.firstChild.setAttribute('width', '14'); else n.textContent = i + 1;
    add(b, n, add(el('span'), add(el('b'), e.n + (ver ? ' · v' + ver : '')), el('small', null, est === 'hecho' ? 'hecho' : est === 'ahora' ? 'te toca' : 'pendiente')));
    b.title = e.n + ' (' + (i + 1) + ')'; b.addEventListener('click', () => irEtapa(e.k)); barra.appendChild(b);
  });
  f.appendChild(barra);
  const k = S.ruta.etapa;
  f.appendChild(avisoEtapa(k));
  f.appendChild(k === 'idea' ? panelIdea() : k === 'guion' ? panelGuion() : k === 'corte' ? panelCorte() : panelEdicion());
  return f;
}
function avisoEtapa(k) {
  const T = {
    idea: ['Apunta la idea', 'Escribe o dicta qué quieres contar. Cuando esté, pulsa «Copiar a Claude», pégalo en tu Claude y te escribe el guion v1.'],
    guion: ['Revisa el guion', 'Retócalo aquí mismo o deja comentarios (Enter guarda cada uno). «Copiar a Claude» le pide la versión siguiente. Cuando te guste, grábalo y pásalo a Corte.'],
    corte: ['Corta la grabación', 'Sube lo que has grabado. Claude lo transcribe y te propone un corte; tú quitas o recuperas trozos en la línea de tiempo o en el texto, y le pides la versión siguiente.'],
    edicion: ['Edición por revisar', 'Claude monta tu corte y lo edita. Míralo, deja comentarios generales o con su minuto, y pide la versión siguiente hasta que la des por buena.']
  }[k];
  const a = el('div', 'aviso'); add(a, el('b', null, T[0]), el('p', null, T[1])); return a;
}
function siguiente(k) { const i = IDX[k]; return i < 3 ? ETAPAS[i + 1] : null; }
function botonesCab(k, { copiable = true, motivo = '' } = {}) {
  const v = S.v, der = el('div', 'der');
  if ((k === 'corte' && v.corte.fuente) || (k === 'edicion' && v.edicion.version)) der.appendChild(boton('Pantalla completa (P)', { icono: 'completa', al: alternarCompleta }));
  if (v.etapa === k) {
    const sg = siguiente(k);
    der.appendChild(sg ? boton('Pasar a ' + sg.n + ' (⌘↵)', { icono: 'sig', al: avanzar }) : boton('Dar por buena (⌘↵)', { icono: 'ok', al: avanzar, dis: !v.edicion.version, titulo: v.edicion.version ? '' : 'Primero tiene que haber una edición' }));
  } else if (v.etapa === 'terminado' && k === 'edicion') der.appendChild(add(el('span', 'pastilla'), 'Lista'));
  const bc = boton('Copiar a Claude (⇧⌘E)', { cls: 'prim', icono: 'copiar', al: () => copiarAClaude(k), dis: !copiable, titulo: motivo });
  bc.id = 'b-copiar'; der.appendChild(bc);
  return der;
}
function avanzar() {
  const v = S.v, k = S.ruta.etapa; if (v.etapa !== k) return;
  if (k === 'edicion') { if (!v.edicion.version) return; v.etapa = 'terminado'; guardar(true); toast('¡Lista! La tienes en el tablero, en «Listos».'); pintar(); return; }
  const sg = siguiente(k); v.etapa = sg.k; guardar(true); irEtapa(sg.k);
}

// IDEA
function panelIdea() {
  const v = S.v, p = el('section', 'panel');
  add(p, add(el('div', 'panel-cab'), add(el('h2'), 'Idea'), el('span', 'meta', v.idea ? '' : 'Escríbela o díctala'), botonesCab('idea', { copiable: !!(v.idea || '').trim() || !!v.titulo, motivo: '' })));
  const ti = el('input'); ti.type = 'text'; ti.value = v.titulo;
  ti.addEventListener('input', () => { v.titulo = ti.value; guardar(); });
  const ta = el('textarea', 'grande idea'); ta.value = v.idea || ''; ta.placeholder = 'Qué quieres contar, a quién y qué tiene que sentir o hacer al verlo.'; ta.id = 'texto-principal';
  ta.addEventListener('input', () => { v.idea = ta.value; guardar(); });
  const cm = el('div', 'con-mic'); add(cm, ta, botonMic(ta));
  add(p, add(el('div', 'campo'), el('label', null, 'Título'), ti), el('div', null), add(el('div', 'campo'), el('label', null, 'La idea'), cm));
  p.children[2].style.height = '14px';
  return p;
}

// GUION
function panelGuion() {
  const v = S.v, p = el('section', 'panel'), n = v.guion.version, ver = S.verV.guion || n;
  const fbN = fbDe('guion', n).length;
  add(p, add(el('div', 'panel-cab'), add(el('h2'), 'Guion'), el('span', 'meta', n ? 'v' + n + (fbN ? ' · ' + fbN + ' comentario' + (fbN > 1 ? 's' : '') : '') : 'Aún sin guion'), botonesCab('guion')));
  if (!n) {
    const vac = el('div', 'vacio'); add(vac, el('b', null, 'Aún no hay guion'), el('p', null, 'Pulsa «Copiar a Claude» y pégalo en tu Claude: escribe el guion v1 con tu idea y con lo que tu cerebro sabe de cómo te gustan. Aparecerá aquí solo.'));
    p.appendChild(vac); return p;
  }
  const dos = el('div', 'dos'), izq = el('div');
  const vs = el('div', 'versiones'); vs.appendChild(el('span', 'etq', 'Versiones'));
  (v.guionVersiones || Object.keys(v.guiones).map(Number)).slice().sort((a, b) => a - b).forEach((x) => {
    const b = boton('v' + x, { cls: 'chico' + (x === ver ? ' on' : ''), al: () => { S.verV.guion = x; pintar(); } }); vs.appendChild(b);
  });
  if (ver !== n) vs.appendChild(el('span', 'meta', 'Estás viendo una versión anterior'));
  const ta = el('textarea', 'grande'); ta.value = v.guiones[ver] || ''; ta.id = 'texto-principal'; ta.readOnly = ver !== n;
  let gT; ta.addEventListener('input', () => { clearTimeout(gT); S.pendiente = true; gT = setTimeout(() => { S.pendiente = false; guardarGuion(ver, ta.value); }, 450); });
  add(izq, vs, ta, el('p', 'ayuda-linea', 'Puedes retocarlo aquí: se guarda solo y Claude parte de tus cambios.'));
  const lado = el('div', 'lado'); lado.appendChild(feedback('guion', { conMinuto: false }));
  add(dos, izq, lado); p.appendChild(dos);
  return p;
}

// FEEDBACK (general con Enter; con minuto en Corte y Edición)
function fbDe(k, ver) { return (S.v.feedback[k] || []).filter((x) => (x.v || 0) === ver); }
const borradorK = (k) => '6g-edicion.borrador:' + S.v.id + ':' + k + ':' + versionDe(k);
function leerBorrador(k) { try { return localStorage.getItem(borradorK(k)) || ''; } catch (e) { return ''; } }
function feedback(k, { conMinuto, tiempo, ir, nombreMinuto } = {}) {
  const v = S.v, ver = versionDe(k), box = el('div', 'fb');
  const lista = () => v.feedback[k] || (v.feedback[k] = []);
  // general
  const g = el('div', 'campo'); g.appendChild(el('label', null, 'Comentarios' + (ver ? ' sobre la v' + ver : '')));
  const ta = el('textarea'); ta.rows = 2; ta.placeholder = 'Escribe y pulsa Enter (Mayús + Enter para otra línea)'; ta.value = leerBorrador(k); ta.id = 'fb-general';
  ta.setAttribute('aria-label', 'Comentario nuevo: Enter lo guarda');
  ta.addEventListener('input', () => { try { localStorage.setItem(borradorK(k), ta.value); } catch (e) {} });
  ta.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); const t = ta.value.trim(); if (!t) return;
    lista().push({ id: uid(), texto: t, v: ver }); ta.value = ''; try { localStorage.removeItem(borradorK(k)); } catch (x) {}
    guardar(); pintarLista();
  });
  const cm = el('div', 'con-mic'); add(cm, ta, botonMic(ta)); g.appendChild(cm); box.appendChild(g);
  // con minuto
  let notaN = null;
  if (conMinuto) {
    const fila = el('div', 'fila-nota'); fila.appendChild(el('span', 'etq', 'Con su minuto'));
    const bn = boton('Nota en ' + fmt(tiempo ? tiempo().T : 0) + ' (M)', { cls: 'chico', icono: 'nota', al: () => nuevaNota() }); bn.id = 'b-nota'; fila.appendChild(bn);
    box.appendChild(fila); notaN = el('div', 'nota-edit'); box.appendChild(notaN);
    box._refrescarMinuto = () => { bn.querySelector('span').textContent = 'Nota en ' + fmt(tiempo().T) + ' (M)'; };
  }
  function nuevaNota() {
    if (!conMinuto) return; ED.pausa && ED.pausa();
    const t = tiempo(); notaN.replaceChildren();
    const ta2 = el('textarea'); ta2.rows = 2; ta2.placeholder = 'Qué quieres cambiar en ' + fmt(t.T) + ' (Enter guarda)';
    ta2.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { notaN.replaceChildren(); return; }
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return; e.preventDefault();
      const x = ta2.value.trim(); if (!x) return;
      lista().push({ id: uid(), texto: x, v: ver, t: +t.t.toFixed(2), T: +t.T.toFixed(2) }); notaN.replaceChildren(); guardar(); pintarLista(); ED.repintarNotas && ED.repintarNotas();
    });
    const cm2 = el('div', 'con-mic'); add(cm2, ta2, botonMic(ta2)); notaN.appendChild(cm2); ta2.focus();
  }
  box._nuevaNota = nuevaNota;
  const ul = el('div', 'fb-lista'); box.appendChild(ul);
  function pintarLista() {
    ul.replaceChildren();
    const todos = lista().slice().sort((a, b) => (b.v || 0) - (a.v || 0) || ((a.T ?? -1) - (b.T ?? -1)));
    const actuales = todos.filter((x) => (x.v || 0) === ver), viejos = todos.filter((x) => (x.v || 0) !== ver);
    if (!actuales.length) ul.appendChild(el('p', 'ayuda-linea', conMinuto ? 'Aún no hay comentarios. Para el vídeo donde quieras comentar algo y pulsa «Nota» (M).' : 'Aún no hay comentarios sobre esta versión.'));
    actuales.forEach((x) => ul.appendChild(filaFb(x, true)));
    if (viejos.length) { const d = el('details'); d.appendChild(el('summary', 'ayuda-linea', 'De versiones anteriores (' + viejos.length + ')')); viejos.forEach((x) => d.appendChild(filaFb(x, false))); ul.appendChild(d); }
  }
  function filaFb(x, vivo) {
    const r = el('div', 'fb-item' + (vivo ? '' : ' fb-viejo'));
    if (x.T != null) { const m = el('button', 'min', fmt(x.T)); m.type = 'button'; m.title = 'Ir a ' + fmt(x.T); m.addEventListener('click', () => ir && ir(x)); r.appendChild(m); }
    r.appendChild(el('p', null, (vivo ? '' : 'v' + (x.v || 0) + ' · ') + x.texto));
    if (vivo) { const b = el('button', 'x', '✕'); b.type = 'button'; b.title = 'Quitar'; b.setAttribute('aria-label', 'Quitar comentario'); b.addEventListener('click', () => { v.feedback[k] = lista().filter((y) => y !== x); guardar(); pintarLista(); ED.repintarNotas && ED.repintarNotas(); }); r.appendChild(b); }
    return r;
  }
  pintarLista();
  return box;
}

// ── corte: piezas de la grabación ([a, b] en segundos; fuera = cortado) ─────────────────────────────
const PZ = {
  unir(ps) {
    const out = [];
    ps.filter((p) => p.b - p.a > 0.001).sort((x, y) => x.a - y.a).forEach((p) => {
      const u = out[out.length - 1];
      if (u && !!u.fuera === !!p.fuera && Math.abs(u.b - p.a) < 0.02) u.b = p.b; else out.push({ a: +p.a.toFixed(3), b: +p.b.toFixed(3), fuera: !!p.fuera });
    });
    // trozos de menos de 0,08 s se funden con el anterior
    for (let i = out.length - 1; i > 0; i--) if (out[i].b - out[i].a < 0.08) { out[i - 1].b = out[i].b; out.splice(i, 1); }
    return out;
  },
  dividir(ps, t) { const out = []; ps.forEach((p) => { if (t > p.a + 0.05 && t < p.b - 0.05) out.push({ ...p, b: t }, { ...p, a: t }); else out.push({ ...p }); }); return out; },
  marcar(ps, a, b, fuera) {
    let q = PZ.dividir(PZ.dividir(ps, a), b);
    q = q.map((p) => (p.a >= a - 0.01 && p.b <= b + 0.01 ? { ...p, fuera } : p));
    return PZ.unir(q).map((p) => ({ ...p }));
  },
  en(ps, t) { return ps.findIndex((p) => t >= p.a - 1e-3 && t < p.b - 1e-3); },
  total(ps) { return ps.reduce((s, p) => s + (p.fuera ? 0 : p.b - p.a), 0); },
  aMontaje(ps, t) { let s = 0; for (const p of ps) { if (t <= p.a) break; if (!p.fuera) s += Math.min(t, p.b) - p.a; } return s; },
  deMontaje(ps, T) { let s = 0; for (const p of ps) { if (p.fuera) continue; const d = p.b - p.a; if (T <= s + d) return p.a + (T - s); s += d; } const k = ps.filter((p) => !p.fuera).pop(); return k ? k.b : 0; }
};

// ── editor de vídeo (Corte y Edición) ────────────────────────────────────────────────────────
const ED = {
  desmontar() { if (ED.raf) cancelAnimationFrame(ED.raf); ED.raf = 0; if (ED.video) ED.video.pause(); ED.activo = false; ED.pausa = null; ED.repintarNotas = null; ED.pintarOnda = null; ED.acc = null; },
  cache: new Map()   // un <video> por archivo: al repintar no se pierde el punto donde estabas
};
function videoPara(src) {
  let v = ED.cache.get(src); if (v) return v;
  v = document.createElement('video'); v.src = src; v.preload = 'auto'; v.playsInline = true; ED.cache.set(src, v); return v;
}
function crearEditor({ k, src, archivo, conPiezas, editable }) {
  const V = S.v, cont = el('div'), video = videoPara(src); ED.video = video; ED.activo = true;
  let ps = () => V.corte.piezas;
  const hist = ED.hist && ED.hist.k === k + src ? ED.hist : (ED.hist = { k: k + src, atras: [], alante: [] });
  let sel = ED.sel != null && ED.selK === k + src ? ED.sel : null; ED.selK = k + src;
  let oyeCorte = null, selTexto = null;
  const dur = () => (isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
  if (conPiezas && editable) asegurarPiezas();
  function asegurarPiezas() {
    if (!dur()) { video.addEventListener('loadedmetadata', () => { if (!ED.activo) return; if (asegurarPiezas2()) refrescar(); }, { once: true }); return; }
    asegurarPiezas2();
  }
  function asegurarPiezas2() {
    if (V.corte.piezas && V.corte.piezas.length) return false;
    V.corte.piezas = [{ a: 0, b: +dur().toFixed(3), fuera: false }]; guardar(); return true;
  }
  const tMont = () => (conPiezas ? PZ.aMontaje(ps(), video.currentTime) : video.currentTime);
  const totalM = () => (conPiezas && ps().length ? PZ.total(ps()) : dur());

  // pantalla + controles
  const ladoIzq = el('div'), pant = el('div', 'pantalla'); pant.appendChild(video); ladoIzq.appendChild(pant);
  video.onclick = () => alternar();
  const ctl = el('div', 'ctl');
  const bPlay = boton('Reproducir (Espacio)', { cls: 'play', icono: 'play', al: () => alternar() });
  const bMenos = boton('−5 s (←)', { cls: 'chico', al: () => saltar(-5) }), bMas = boton('+5 s (→)', { cls: 'chico', al: () => saltar(5) });
  const tiempo = el('span', 'tiempo');
  add(ctl, bPlay, bMenos, bMas, tiempo); ladoIzq.appendChild(ctl);

  // herramientas (solo en el corte)
  let bDiv, bQui, bRec, bDes, bReh, info;
  if (conPiezas && editable) {
    const herr = el('div', 'herr');
    bDes = boton('Deshacer (⌘Z)', { cls: 'chico', icono: 'atras', al: deshacer }); bReh = boton('Rehacer (⇧⌘Z)', { cls: 'chico', icono: 'adelante', al: rehacer });
    bDiv = boton('Dividir (B)', { cls: 'chico w-dividir', icono: 'dividir', al: () => dividirEn(video.currentTime) });
    bQui = boton('Quitar (⌫)', { cls: 'chico', icono: 'quitar', al: () => quitar() }); bRec = boton('Recuperar (R)', { cls: 'chico', icono: 'recuperar', al: () => recuperar() });
    info = el('span', 'info');
    add(herr, bDes, bReh, el('span', 'sep'), bDiv, bQui, bRec, info); cont.appendChild(herr);
  }
  // línea de tiempo
  const linea = el('div', 'linea'), pista = el('div', 'pista'), regla = el('div', 'regla'), canvas = el('canvas', 'onda'), capaP = el('div'), aguja = el('div', 'aguja');
  add(pista, regla, canvas, capaP, aguja); linea.appendChild(pista);
  const ayuda = el('p', 'ayuda-linea', conPiezas && editable ? 'Pulsa en la línea para ir a ese punto. Lo rayado está cortado: púlsalo y dale a reproducir para oírlo, o «Recuperar». Clic derecho sobre un trozo para ver sus opciones.' : 'Pulsa en la línea para ir a ese punto; los marcadores son tus notas con su minuto.');
  let pps = 10;
  function medir() {
    const ancho = Math.max(300, linea.clientWidth - 24), d = dur() || 1;
    pps = Math.max(ancho / d, 8); pista.style.width = Math.round(d * pps) + 'px'; pista.style.marginLeft = pista.style.marginRight = '12px';
  }
  function pintarRegla() {
    regla.replaceChildren(); const d = dur(); if (!d) return;
    const paso = [1, 2, 5, 10, 15, 30, 60, 120, 300].find((p) => p * pps >= 70) || 600;
    for (let t = paso; t <= d + 0.01; t += paso) { const s = el('span', null, fmt(t)); s.style.left = (t * pps) + 'px'; regla.appendChild(s); }
  }
  ED.pintarOnda = pintarOnda;
  function pintarOnda() {
    const o = (V.ondas || {})[archivo], w = Math.max(1, Math.round(dur() * pps)), h = 96, dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const g = canvas.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    if (!o || !o.picos) return;
    const cs = getComputedStyle(document.documentElement), cOn = cs.getPropertyValue('--onda').trim(), cOff = cs.getPropertyValue('--onda-fuera').trim();
    const barra = 3, cada = Math.max(1, Math.round(barra / (o.paso * pps)));
    for (let i = 0; i < o.picos.length; i += cada) {
      const t = i * o.paso, x = t * pps; let m = 0; for (let j = i; j < i + cada && j < o.picos.length; j++) m = Math.max(m, o.picos[j]);
      const fuera = conPiezas && ps().length ? (ps()[PZ.en(ps(), t)] || {}).fuera : false;
      const alto = Math.max(2, (m / 100) * (h - 26)); g.fillStyle = fuera ? cOff : cOn; g.fillRect(x, h / 2 - alto / 2 + 6, Math.max(1, barra - 1), alto);
    }
  }
  function pintarPiezas() {
    capaP.replaceChildren();
    if (!conPiezas || !ps().length) return;
    ps().forEach((p, i) => {
      const d = el('div', 'pieza' + (p.fuera ? ' fuera' : '') + (sel === i ? ' sel' : ''));
      d.style.left = (p.a * pps) + 'px'; d.style.width = Math.max(2, (p.b - p.a) * pps) + 'px';
      d.title = (p.fuera ? 'Cortado · ' : 'Se queda · ') + fmt(p.a) + '–' + fmt(p.b);
      if ((p.b - p.a) * pps > 60) d.appendChild(el('span', 'et', (p.fuera ? 'cortado · ' : '') + ((p.b - p.a).toFixed(1).replace('.', ',')) + ' s'));
      d.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.stopPropagation(); elegir(i, e); });
      if (editable) d.addEventListener('contextmenu', (e) => { e.preventDefault(); elegir(i, e); menuPieza(e, i); });
      capaP.appendChild(d);
    });
  }
  function pintarNotas() {
    pista.querySelectorAll('.marca-nota').forEach((n) => n.remove());
    fbDe(k, versionDe(k)).filter((x) => x.t != null).forEach((x) => {
      const m = el('button', 'marca-nota'); m.type = 'button'; m.style.left = (x.t * pps) + 'px'; m.title = fmt(x.T) + ' · ' + x.texto; m.setAttribute('aria-label', 'Nota en ' + fmt(x.T));
      m.addEventListener('pointerdown', (e) => { e.stopPropagation(); irNota(x); }); pista.appendChild(m);
    });
  }
  ED.repintarNotas = pintarNotas;
  function elegir(i, e) {
    sel = i; ED.sel = i; const p = ps()[i];
    const x = e && e.clientX != null ? (e.clientX - pista.getBoundingClientRect().left) / pps : p.a;
    irA(Math.min(Math.max(x, p.a), p.b - 0.01)); pintarPiezas(); refrescarBarra();
  }
  pista.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const x = (e.clientX - pista.getBoundingClientRect().left) / pps; sel = null; ED.sel = null;
    irA(Math.max(0, Math.min(x, dur()))); pintarPiezas(); refrescarBarra();
    const mover = (ev) => { const t = (ev.clientX - pista.getBoundingClientRect().left) / pps; irA(Math.max(0, Math.min(t, dur()))); };
    const soltar = () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar); };
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar);
  });

  // reproducción: se salta lo cortado (salvo que hayas pulsado en un trozo cortado para oírlo)
  function irA(t) { pausa(); video.currentTime = t; oyeCorte = null; pintarAguja(); }
  function irNota(x) { irA(x.t); }
  function pausa() { video.pause(); }
  ED.pausa = pausa;
  function alternar() {
    if (!video.paused) { video.pause(); return; }
    if (conPiezas && ps().length) {
      const i = PZ.en(ps(), video.currentTime);
      if (i >= 0 && ps()[i].fuera) oyeCorte = i;
      if (video.currentTime >= dur() - 0.05) video.currentTime = (ps().find((p) => !p.fuera) || { a: 0 }).a;
    } else if (video.currentTime >= dur() - 0.05) video.currentTime = 0;
    video.muted = false; video.play().catch(() => {});
  }
  function saltar(s) {
    if (conPiezas && ps().length) { const T = Math.max(0, Math.min(totalM(), tMont() + s)); irA(PZ.deMontaje(ps(), T)); }
    else irA(Math.max(0, Math.min(dur(), video.currentTime + s)));
  }
  function bucle() {
    if (!ED.activo) return;
    if (!video.paused && conPiezas && ps().length) {
      const t = video.currentTime, i = PZ.en(ps(), t);
      if (i >= 0 && ps()[i].fuera && oyeCorte !== i) {
        const sig = ps().slice(i + 1).find((p) => !p.fuera);
        if (sig) video.currentTime = sig.a; else { video.pause(); video.currentTime = ps()[i].a; }
      } else if (oyeCorte != null && i !== oyeCorte) oyeCorte = null;
    }
    pintarAguja(); ED.raf = requestAnimationFrame(bucle);
  }
  let ultimoAncho = 0;
  function pintarAguja() {
    aguja.style.left = (video.currentTime * pps) + 'px';
    tiempo.textContent = fmt(tMont()) + ' / ' + fmt(totalM());
    const sonando = !video.paused; if (bPlay._s !== sonando) { bPlay._s = sonando; bPlay.replaceChildren(svg(sonando ? 'pausa' : 'play'), el('span', null, (sonando ? 'Pausa' : 'Reproducir') + ' (Espacio)')); }
    if (sonando) { const x = video.currentTime * pps, l = linea.scrollLeft, w = linea.clientWidth; if (x < l + 20 || x > l + w - 40) linea.scrollLeft = x - 60; }
    if (texto) marcarPalabra();
    if (fbBox && fbBox._refrescarMinuto) fbBox._refrescarMinuto();
    if (bDiv) refrescarDividir();
    if (linea.clientWidth !== ultimoAncho && linea.clientWidth) { ultimoAncho = linea.clientWidth; refrescar(); }
  }

  // acciones del corte
  function cambiar(nuevo) { hist.atras.push(JSON.stringify(ps())); hist.alante = []; V.corte.piezas = PZ.unir(nuevo); sel = null; ED.sel = null; guardar(); refrescar(); }
  function dividirEn(t) { if (!editable || !ps().length) return; const i = PZ.en(ps(), t); if (i < 0) return; const p = ps()[i]; if (t <= p.a + 0.05 || t >= p.b - 0.05) return; hist.atras.push(JSON.stringify(ps())); hist.alante = []; V.corte.piezas = PZ.dividir(ps(), t); sel = PZ.en(ps(), t); ED.sel = sel; guardar(); refrescar(); }
  function objetivo() { if (sel != null && ps()[sel]) return sel; const i = PZ.en(ps(), video.currentTime); return i >= 0 ? i : null; }
  function quitar(i = objetivo()) { if (i == null || !editable) return; if (selTexto) return cortarTexto(true); const p = ps()[i]; if (p.fuera) return; cambiar(PZ.marcar(ps(), p.a, p.b, true)); toast('Trozo cortado. «Recuperar» (R) o ⌘Z lo devuelve.', 2200); }
  function recuperar(i = objetivo()) { if (selTexto) return cortarTexto(false); if (i == null || !editable) return; const p = ps()[i]; if (!p.fuera) return; cambiar(PZ.marcar(ps(), p.a, p.b, false)); }
  function deshacer() { if (!hist.atras.length) return; hist.alante.push(JSON.stringify(ps())); V.corte.piezas = JSON.parse(hist.atras.pop()); guardar(); refrescar(); }
  function rehacer() { if (!hist.alante.length) return; hist.atras.push(JSON.stringify(ps())); V.corte.piezas = JSON.parse(hist.alante.pop()); guardar(); refrescar(); }
  function refrescarDividir() {
    const i = PZ.en(ps(), video.currentTime), p = ps()[i], dentro = !!p && video.currentTime > p.a + 0.05 && video.currentTime < p.b - 0.05;
    bDiv.disabled = !dentro; const t = (dentro ? 'Dividir en ' + fmt(tMont()) : 'Dividir') + ' (B)'; if (bDiv._t !== t) { bDiv._t = t; bDiv.querySelector('span').textContent = t; }
  }
  function refrescarBarra() {
    if (!bQui) return;
    const i = objetivo(), p = i != null ? ps()[i] : null;
    bQui.disabled = !(selTexto || (p && !p.fuera)); bRec.disabled = !(selTexto || (p && p.fuera));
    bDes.disabled = !hist.atras.length; bReh.disabled = !hist.alante.length;
    info.textContent = selTexto ? 'Texto elegido: ' + fmt(selTexto.a) + '–' + fmt(selTexto.b) : p ? (p.fuera ? 'Cortado · ' : 'Trozo · ') + ((p.b - p.a).toFixed(1).replace('.', ',')) + ' s' : '';
  }
  function menuPieza(e, i) {
    const p = ps()[i];
    abrirMenu(e, [
      { t: 'Dividir aquí', k: 'B', i: 'dividir', dis: false, f: () => dividirEn((e.clientX - pista.getBoundingClientRect().left) / pps) },
      { t: 'Quitar', k: '⌫', i: 'quitar', dis: p.fuera, f: () => quitar(i) },
      { t: 'Recuperar', k: 'R', i: 'recuperar', dis: !p.fuera, f: () => recuperar(i) },
      { t: 'Nota en este punto', k: 'M', i: 'nota', dis: false, f: () => { verLado('feedback'); setTimeout(() => fbBox && fbBox._nuevaNota(), 0); } }
    ]);
  }

  // lado derecho: Texto (con lo cortado tachado) y Feedback
  const ladoDer = el('div', 'lado');
  let texto = null, fbBox = null, palabras = [];
  const tabs = el('div', 'tabs');
  const bTx = boton('Texto (T)', { cls: 'chico', al: () => verLado('texto') }), bFb = boton('Comentarios (F)', { cls: 'chico', al: () => verLado('feedback') });
  if (conPiezas) tabs.appendChild(bTx); tabs.appendChild(bFb); ladoDer.appendChild(tabs);
  const cajaTx = el('div'), cajaFb = el('div'); add(ladoDer, cajaTx, cajaFb);
  function verLado(c) { if (!conPiezas) c = 'feedback'; S.lado = c; cajaTx.hidden = c !== 'texto'; cajaFb.hidden = c !== 'feedback'; bTx.classList.toggle('on', c === 'texto'); bFb.classList.toggle('on', c === 'feedback'); }
  if (conPiezas) {
    const tr = V.transcripcion;
    palabras = tr && Array.isArray(tr.palabras) ? tr.palabras : [];
    const barraSel = el('div', 'sel-barra');
    const bCortaTx = boton('Cortar esto (X)', { cls: 'chico', icono: 'cortar', al: () => cortarTexto(true) }), bRecTx = boton('Recuperar esto (R)', { cls: 'chico', icono: 'recuperar', al: () => cortarTexto(false) });
    const infoSel = el('span', 'info', palabras.length ? 'Selecciona palabras con el ratón para cortarlas o recuperarlas.' : '');
    add(barraSel, bCortaTx, bRecTx, infoSel); bCortaTx.hidden = bRecTx.hidden = true;
    texto = el('div', 'texto'); texto.setAttribute('aria-label', 'Texto de la grabación');
    if (!palabras.length) {
      const vac = el('div', 'vacio'); add(vac, el('b', null, 'Aún no hay texto'), el('p', null, V.corte.fuente ? 'Pulsa «Copiar a Claude»: transcribe tu grabación y te propone un primer corte. Mientras, puedes cortar en la línea de tiempo con Dividir (B) y Quitar (⌫).' : 'Primero sube tu grabación.'));
      texto.appendChild(vac);
      const gv = V.guion.version; if (gv && V.guiones[gv]) { texto.appendChild(el('p', 'etq', 'Tu guion v' + gv)); texto.appendChild(el('div', 'guion-ref', V.guiones[gv])); }
    } else {
      palabras.forEach((w, i) => { const s = el('span', 'w', w.p); s.dataset.i = i; texto.appendChild(s); texto.appendChild(document.createTextNode(' ')); });
      texto.addEventListener('click', (e) => { const s = e.target.closest('.w'); if (!s || !getSelection().isCollapsed) return; irA(palabras[+s.dataset.i].a + 0.01); });
      texto.addEventListener('mouseup', () => setTimeout(leerSeleccion, 0));
      texto.addEventListener('keyup', () => setTimeout(leerSeleccion, 0));
    }
    function leerSeleccion() {
      const s = getSelection(); selTexto = null;
      if (s && !s.isCollapsed && texto.contains(s.anchorNode)) {
        const r = s.getRangeAt(0), ws = [...texto.querySelectorAll('.w')].filter((w) => r.intersectsNode(w));
        if (ws.length) { const a = palabras[+ws[0].dataset.i], b = palabras[+ws[ws.length - 1].dataset.i]; selTexto = { a: a.a, b: b.b }; }
      }
      bCortaTx.hidden = bRecTx.hidden = !selTexto || !editable; infoSel.textContent = selTexto ? fmt(PZ.aMontaje(ps(), selTexto.a)) + ' · ' + ((selTexto.b - selTexto.a).toFixed(1).replace('.', ',')) + ' s elegidos' : (palabras.length ? 'Selecciona palabras con el ratón para cortarlas o recuperarlas.' : '');
      refrescarBarra();
    }
    ED.limpiarSel = () => { selTexto = null; getSelection().removeAllRanges(); leerSeleccion(); };
    add(cajaTx, barraSel, texto);
  }
  function cortarTexto(fuera) {
    if (!selTexto || !editable) return; const { a, b } = selTexto; selTexto = null; getSelection().removeAllRanges();
    cambiar(PZ.marcar(ps(), Math.max(0, a - 0.02), Math.min(dur() || b, b + 0.02), fuera));
  }
  function pintarTexto() {
    if (!texto || !palabras.length) return;
    texto.querySelectorAll('.w').forEach((s) => { const w = palabras[+s.dataset.i], m = (w.a + w.b) / 2, i = PZ.en(ps(), m); s.classList.toggle('fuera', i >= 0 && ps()[i].fuera); });
  }
  let palAct = -1;
  function marcarPalabra() {
    if (!palabras.length) return; const t = video.currentTime; let i = palabras.findIndex((w) => t >= w.a && t < w.b);
    if (i === palAct) return; const viejo = texto.querySelector('.w.ya'); if (viejo) viejo.classList.remove('ya');
    palAct = i; if (i >= 0) { const s = texto.querySelector('.w[data-i="' + i + '"]'); if (s) { s.classList.add('ya'); if (!video.paused) { const r = s.getBoundingClientRect(), R = texto.getBoundingClientRect(); if (r.top < R.top || r.bottom > R.bottom) texto.scrollTop += r.top - R.top - 60; } } }
  }
  fbBox = feedback(k, { conMinuto: true, tiempo: () => ({ t: video.currentTime, T: tMont() }), ir: irNota });
  cajaFb.appendChild(fbBox);
  verLado(conPiezas ? (S.lado || 'texto') : 'feedback');

  const ed = el('div', 'editor'); add(ed, ladoIzq, ladoDer);
  cont.prepend(ed); add(cont, linea, ayuda);
  function refrescar() { medir(); pintarRegla(); pintarOnda(); pintarPiezas(); pintarNotas(); pintarTexto(); refrescarBarra(); pintarAguja(); if (k === 'corte') { const m = document.querySelector('.panel-cab .meta'); if (m) m.textContent = metaCorte(); } }
  video.addEventListener('loadedmetadata', () => { if (ED.activo) refrescar(); });
  requestAnimationFrame(() => { refrescar(); ED.raf = requestAnimationFrame(bucle); });

  // atajos del editor (los recoge el manejador global)
  ED.acc = {
    ' ': alternar, ArrowLeft: () => saltar(-5), ArrowRight: () => saltar(5),
    b: () => dividirEn(video.currentTime), Backspace: () => quitar(), Delete: () => quitar(), r: () => recuperar(), x: () => cortarTexto(true),
    m: () => { verLado('feedback'); fbBox._nuevaNota(); }, t: () => verLado('texto'), f: () => verLado('feedback'),
    deshacer, rehacer
  };
  return cont;
}

// CORTE
function metaCorte() {
  const v = S.v, n = v.corte.version, fbN = fbDe('corte', n).length, k = v.corte.piezas.filter((x) => !x.fuera).length;
  return !v.corte.fuente ? 'Falta la grabación' : (n ? 'v' + n + ' · ' : '') + (v.corte.piezas.length ? 'queda en ' + fmt(PZ.total(v.corte.piezas)) + ' de ' + fmt(v.corte.piezas[v.corte.piezas.length - 1].b) + ' · ' + k + (k === 1 ? ' trozo' : ' trozos') : 'sin cortar') + (fbN ? ' · ' + fbN + ' comentario' + (fbN > 1 ? 's' : '') : '');
}
function panelCorte() {
  const v = S.v, p = el('section', 'panel');
  add(p, add(el('div', 'panel-cab'), add(el('h2'), 'Corte'), el('span', 'meta', metaCorte()), botonesCab('corte', { copiable: !!v.corte.fuente, motivo: v.corte.fuente ? '' : 'Primero sube tu grabación' })));
  if (!v.corte.fuente) { p.appendChild(zonaSubir()); return p; }
  p.appendChild(crearEditor({ k: 'corte', src: '/media/' + v.id + '/' + encodeURIComponent(v.corte.fuente), archivo: v.corte.fuente, conPiezas: true, editable: true }));
  const otra = el('p', 'ayuda-linea'); otra.append('Grabación: ' + v.corte.fuente + ' · ');
  const cam = el('button', 'volver', '¿Otra grabación? Súbela'); cam.style.margin = '0'; cam.addEventListener('click', () => { p.replaceChildren(p.firstChild, zonaSubir()); ED.desmontar(); }); otra.appendChild(cam);
  p.appendChild(otra);
  return p;
}
function zonaSubir() {
  const z = el('div', 'soltar'), inp = el('input'); inp.type = 'file'; inp.accept = 'video/*,.mov,.mp4,.m4v,.webm'; inp.hidden = true;
  const prog = el('div', 'progreso'), barra = el('i'); prog.appendChild(barra); prog.hidden = true;
  add(z, el('b', null, 'Sube tu grabación'), el('p', null, 'Arrástrala aquí o elígela. Si la tienes en el móvil, pásala antes al Mac (AirDrop o Drive).'), boton('Elegir vídeo (U)', { icono: 'subir', al: () => inp.click() }), inp, prog);
  z.id = 'zona-subir';
  const subir = (file) => {
    if (!file) return; if (!/\.(mp4|mov|m4v|webm)$/i.test(file.name)) { toast('Tiene que ser un vídeo (.mp4, .mov, .m4v o .webm).'); return; }
    prog.hidden = false; const x = new XMLHttpRequest();
    x.open('POST', '/api/videos/' + S.v.id + '/subir?nombre=' + encodeURIComponent(file.name.replace(/[^\w.\-]+/g, '-')));
    x.upload.onprogress = (e) => { if (e.lengthComputable) barra.style.width = Math.round((e.loaded / e.total) * 100) + '%'; };
    x.onload = () => { if (x.status !== 200) { toast('No se ha podido subir: ' + (JSON.parse(x.responseText || '{}').error || x.status)); prog.hidden = true; return; } S.v = JSON.parse(x.responseText); S.firma = S.v.firma; ED.hist = null; toast('Grabación subida. Ahora «Copiar a Claude» para que la transcriba y proponga el corte.', 4200); pintar(); };
    x.onerror = () => { toast('No se ha podido subir.'); prog.hidden = true; };
    x.send(file);
  };
  inp.addEventListener('change', () => subir(inp.files[0]));
  z.addEventListener('dragover', (e) => { e.preventDefault(); z.classList.add('encima'); });
  z.addEventListener('dragleave', () => z.classList.remove('encima'));
  z.addEventListener('drop', (e) => { e.preventDefault(); z.classList.remove('encima'); subir(e.dataTransfer.files[0]); });
  ED.subir = () => inp.click();
  return z;
}

// EDICIÓN
function panelEdicion() {
  const v = S.v, p = el('section', 'panel'), n = v.edicion.version, ver = S.verV.edicion || n, fbN = fbDe('edicion', n).length;
  add(p, add(el('div', 'panel-cab'), add(el('h2'), 'Edición'), el('span', 'meta', n ? 'v' + n + (fbN ? ' · ' + fbN + ' comentario' + (fbN > 1 ? 's' : '') : '') : 'Aún sin edición'), botonesCab('edicion', { copiable: !!v.corte.fuente, motivo: v.corte.fuente ? '' : 'Primero tiene que haber una grabación en Corte' })));
  if (!n) {
    const vac = el('div', 'vacio');
    add(vac, el('b', null, 'Aún no hay edición'), el('p', null, v.corte.fuente ? 'Pulsa «Copiar a Claude» y pégalo en tu Claude: monta tu corte y te prepara la edición v1. Si ya sabes qué quieres (subtítulos, música, textos en pantalla), déjalo en comentarios antes de copiar.' : 'Primero sube tu grabación en la etapa Corte.'));
    p.appendChild(vac);
    if (v.corte.fuente) { const lado = el('div', 'lado'); lado.style.marginTop = '14px'; lado.appendChild(feedback('edicion', { conMinuto: false })); p.appendChild(lado); }
    return p;
  }
  const vs = el('div', 'versiones'); vs.appendChild(el('span', 'etq', 'Versiones'));
  for (let x = 1; x <= n; x++) { const nom = x === n ? v.edicion.video : 'edicion-v' + x + '.mp4'; if (x !== n && !v.archivos.some((a) => a.nombre === nom)) continue; vs.appendChild(boton('v' + x, { cls: 'chico' + (x === ver ? ' on' : ''), al: () => { S.verV.edicion = x; pintar(); } })); }
  if (ver !== n) vs.appendChild(el('span', 'meta', 'Estás viendo una versión anterior; los comentarios van a la v' + n));
  p.appendChild(vs);
  const archivo = ver === n ? v.edicion.video : 'edicion-v' + ver + '.mp4';
  p.appendChild(crearEditor({ k: 'edicion', src: '/media/' + v.id + '/' + encodeURIComponent(archivo), archivo, conPiezas: false, editable: false }));
  return p;
}

// ── «Copiar a Claude»: lo que necesita tu Claude para hacer la siguiente versión ───────────────────
function cabeceraClaude(etapa) {
  const v = S.v, E = S.estado || {};
  return [
    'Esto viene de mi app de edición de 6 Grados (etapa ' + etapa + ').',
    'Antes de nada lee el CLAUDE.md de la app: ' + (E.carpeta || '') + '/CLAUDE.md (dónde está cada archivo y cómo se hace cada etapa).',
    'Cómo me gustan mis guiones, cortes y ediciones lo sabe mi cerebro: míralo antes de empezar. Lo que aprendas de mis comentarios, apúntalo en mi cerebro para la próxima vez.',
    '',
    'Vídeo: «' + v.titulo + '»',
    'Carpeta del vídeo: ' + v.carpeta,
    ''
  ];
}
function bloqueFb(k, ver, titulo) {
  const xs = fbDe(k, ver), borr = leerBorrador(k).trim();
  const gen = xs.filter((x) => x.T == null).map((x) => x.texto).concat(borr ? [borr] : []);
  const min = xs.filter((x) => x.T != null).sort((a, b) => a.T - b.T);
  if (!gen.length && !min.length) return [];
  const L = [titulo];
  if (gen.length) { L.push('GENERAL:'); gen.forEach((t, i) => L.push((i + 1) + '. ' + t)); }
  if (min.length) { L.push('CON SU MINUTO' + (k === 'corte' ? ' (minuto del vídeo tal como queda cortado · segundo de la grabación original):' : ' (minuto del vídeo editado):')); min.forEach((x) => L.push('- ' + fmt(x.T) + (k === 'corte' ? ' (' + x.t.toFixed(1).replace('.', ',') + ' s)' : '') + ' · ' + x.texto)); }
  return L;
}
function textoClaude(k) {
  const v = S.v, L = cabeceraClaude(ETAPAS[IDX[k]].n);
  if (k === 'idea' || (k === 'guion' && !v.guion.version)) {
    L.push('QUÉ QUIERO: el guion v1.', 'Mi idea:', (v.idea || '').trim() || '(solo tengo el título)', '',
      'Escríbelo como me gustan (lo dice mi cerebro; si no lo sabe, mira cómo son mis vídeos y pregúntame lo que dudes).',
      'Guárdalo en guion-v1.md dentro de la carpeta del vídeo y en video.json pon "guion": {"version": 1} y "etapa": "guion".',
      'Cuando acabes, dime en una línea que ya lo tengo en la app.');
  } else if (k === 'guion') {
    const n = v.guion.version, fb = bloqueFb('guion', n, 'MIS COMENTARIOS SOBRE LA V' + n + ':');
    L.push('QUÉ QUIERO: el guion v' + (n + 1) + ', a partir de guion-v' + n + '.md (si lo he retocado yo, mis cambios mandan).', '');
    if (fb.length) L.push(...fb, ''); else L.push('No he dejado comentarios: mejóralo tú con lo que sabes de cómo me gustan.', '');
    L.push('Guárdalo en guion-v' + (n + 1) + '.md (no borres las versiones anteriores) y en video.json pon "guion": {"version": ' + (n + 1) + '}.',
      'Cuando acabes, dime en una línea qué has cambiado.');
  } else if (k === 'corte') {
    const n = v.corte.version, ps = v.corte.piezas || [], tieneTx = !!(v.transcripcion && v.transcripcion.palabras && v.transcripcion.palabras.length);
    const fb = bloqueFb('corte', n, 'MIS COMENTARIOS SOBRE EL CORTE' + (n ? ' V' + n : '') + ':');
    const aMano = ps.some((p) => p.fuera);
    L.push('QUÉ QUIERO: el corte v' + (n + 1) + ' de mi grabación (' + v.corte.fuente + ').');
    if (!tieneTx) L.push('1. Transcríbela con el tiempo de cada palabra y guárdala en transcripcion.json (cómo, en el CLAUDE.md).');
    L.push((tieneTx ? '1' : '2') + '. ' + (n ? 'Ajusta el corte con mis comentarios.' : 'Propón el corte: quita silencios largos, arranques en falso y tomas repetidas (de lo repetido, la última toma bien dicha), sin cortar palabras.'),
      (tieneTx ? '2' : '3') + '. Escríbelo en video.json, en "corte": {"piezas": [...], "version": ' + (n + 1) + '}, con todas las piezas de la grabación en orden (las que se quitan, con "fuera": true).');
    if (aMano) {
      L.push('', 'CÓMO LO HE DEJADO YO (respétalo: lo he decidido a mano). Queda en ' + fmt(PZ.total(ps)) + ' de ' + fmt(ps[ps.length - 1].b) + ':');
      const pal = tieneTx ? v.transcripcion.palabras : [];
      ps.forEach((p) => { const txt = pal.filter((w) => (w.a + w.b) / 2 >= p.a && (w.a + w.b) / 2 < p.b).map((w) => w.p).join(' '); L.push('- ' + p.a.toFixed(2) + '–' + p.b.toFixed(2) + ' s ' + (p.fuera ? 'FUERA' : 'se queda') + (txt ? ' · «' + (txt.length > 90 ? txt.slice(0, 87) + '…' : txt) + '»' : '')); });
    }
    if (fb.length) L.push('', ...fb);
    L.push('', 'Cuando acabes, dime en una línea qué has cortado.');
  } else if (k === 'edicion') {
    const n = v.edicion.version, fb = bloqueFb('edicion', n, n ? 'MIS COMENTARIOS SOBRE LA EDICIÓN V' + n + ':' : 'LO QUE QUIERO EN LA EDICIÓN:');
    if (!n) {
      L.push('QUÉ QUIERO: la edición v1.', '1. Monta mi corte: las piezas de video.json → corte.piezas que no están "fuera", en orden, de ' + v.corte.fuente + ' (receta en el CLAUDE.md).',
        '2. Edítalo como me gustan mis vídeos (lo sabe mi cerebro; si no, pregúntame antes de inventar): formato vertical para redes, subtítulos y lo que haga falta.',
        '3. Guárdalo como edicion-v1.mp4 en la carpeta del vídeo y en video.json pon "edicion": {"version": 1, "video": "edicion-v1.mp4"} y "etapa": "edicion".');
    } else {
      L.push('QUÉ QUIERO: la edición v' + (n + 1) + ', a partir de la v' + n + ' (' + v.edicion.video + ').',
        'Guárdala como edicion-v' + (n + 1) + '.mp4 (no borres las anteriores) y en video.json pon "edicion": {"version": ' + (n + 1) + ', "video": "edicion-v' + (n + 1) + '.mp4"}.');
    }
    if (fb.length) L.push('', ...fb);
    L.push('', 'Cuando acabes, dime en una línea qué has hecho.');
  }
  return L.join('\n');
}
async function copiarAClaude(k) {
  const b = document.getElementById('b-copiar'); if (b && b.disabled) return;
  if (S.pendiente) await guardarYa();
  const t = textoClaude(k);
  try { await navigator.clipboard.writeText(t); }
  catch (e) { const ta = el('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  window.__ultimoCopiado = t;
  toast('Copiado. Pégalo en tu Claude (⌘V): cuando termine, lo verás aquí solo.', 4200);
}

// ── menú de clic derecho y atajos ─────────────────────────────────────────────────────────────
function abrirMenu(e, ops) {
  cerrarMenu(); const m = el('div', 'menu'); m.setAttribute('role', 'menu');
  ops.forEach((o) => { const b = el('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.disabled = !!o.dis; add(b, svg(o.i), el('span', null, o.t), el('kbd', null, o.k)); b.addEventListener('click', () => { cerrarMenu(); o.f(); }); m.appendChild(b); });
  document.body.appendChild(m); const r = m.getBoundingClientRect();
  m.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', fuera, { once: true }), 0);
  function fuera(ev) { if (!m.contains(ev.target)) cerrarMenu(); else document.addEventListener('pointerdown', fuera, { once: true }); }
}
function cerrarMenu() { document.querySelectorAll('.menu').forEach((m) => m.remove()); }
const ATAJOS = [
  ['Tablero', [['Nueva idea', 'N'], ['Volver al tablero', 'Esc']]],
  ['Cualquier etapa', [['Copiar a Claude', '⇧⌘E'], ['Pasar a la etapa siguiente / Dar por buena', '⌘↵'], ['Ir a Idea, Guion, Corte o Edición', '1 · 2 · 3 · 4'], ['Dictar (micrófono abierto)', '⌥D'], ['Guardar un comentario', 'Enter']]],
  ['Corte y Edición', [['Reproducir o pausar', 'Espacio'], ['5 s atrás / adelante', '← →'], ['Nota con su minuto', 'M'], ['Pantalla completa', 'P'], ['Pestaña Texto / Comentarios', 'T · F']]],
  ['Solo Corte', [['Dividir en la aguja', 'B'], ['Quitar el trozo', '⌫'], ['Recuperar el trozo', 'R'], ['Cortar el texto elegido', 'X'], ['Subir otra grabación', 'U'], ['Deshacer / Rehacer', '⌘Z · ⇧⌘Z']]]
];
function verAtajos() {
  if (document.querySelector('.capa')) { document.querySelector('.capa').remove(); return; }
  const c = el('div', 'capa'), w = el('div', 'ventana'); w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Atajos de teclado');
  add(w, add(el('h2'), 'Atajos', el('span', 'punto', '.')));
  ATAJOS.forEach(([g, xs]) => { w.appendChild(el('p', 'etq', g)); const t = el('table'); xs.forEach(([a, b]) => { const r = el('tr'); add(r, el('td', null, a), el('td', null, b)); t.appendChild(r); }); w.appendChild(t); });
  w.appendChild(boton('Cerrar (Esc)', { al: () => c.remove() })); w.lastChild.style.marginTop = '14px';
  c.appendChild(w); c.addEventListener('click', (e) => { if (e.target === c) c.remove(); }); document.body.appendChild(c);
}
document.getElementById('b-atajos').addEventListener('click', verAtajos);
function alternarCompleta() { S.completa = !document.body.classList.contains('completa'); document.body.classList.toggle('completa', S.completa); requestAnimationFrame(() => window.dispatchEvent(new Event('resize'))); }
function salirCompleta() { document.body.classList.remove('completa'); }

document.addEventListener('keydown', (e) => {
  const cmd = e.metaKey || e.ctrlKey, tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.altKey && e.code === 'KeyD') { e.preventDefault(); const a = document.activeElement; const ta = a && a.tagName === 'TEXTAREA' ? a : (DIC.ta || document.getElementById('fb-general') || document.getElementById('texto-principal')); if (ta && ta._mic) dictar(ta, ta._mic); else if (ta) dictar(ta, null); return; }
  if (cmd && e.shiftKey && tecla === 'e') { if (S.ruta.vista === 'video') { e.preventDefault(); copiarAClaude(S.ruta.etapa); } return; }
  if (cmd && e.key === 'Enter') { if (S.ruta.vista === 'video' && !(e.target.closest && e.target.closest('.nueva'))) { e.preventDefault(); avanzar(); } return; }
  if (e.key === 'Escape') {
    if (document.querySelector('.capa')) { document.querySelector('.capa').remove(); return; }
    if (document.querySelector('.menu')) { cerrarMenu(); return; }
    if (document.body.classList.contains('completa')) { salirCompleta(); return; }
    if (escribiendo()) { document.activeElement.blur(); return; }
    if (S.ruta.vista === 'video') location.hash = '#/';
    return;
  }
  if (escribiendo()) return;
  if (tecla === '?') { verAtajos(); return; }
  if (S.ruta.vista === 'tablero') { if (tecla === 'n' && !cmd) { e.preventDefault(); S.nueva = true; pintar(); } return; }
  if (!cmd && /^[1-4]$/.test(tecla)) { irEtapa(ETAPAS[+tecla - 1].k); return; }
  if (!cmd && tecla === 'p' && (S.ruta.etapa === 'corte' || S.ruta.etapa === 'edicion') && ED.acc) { alternarCompleta(); return; }
  if (!cmd && tecla === 'u' && S.ruta.etapa === 'corte' && ED.subir) { e.preventDefault(); ED.subir(); return; }
  const A = ED.acc; if (!A) return;
  if (cmd && tecla === 'z') { e.preventDefault(); if (S.ruta.etapa === 'corte') (e.shiftKey ? A.rehacer : A.deshacer)(); return; }
  if (cmd || e.altKey) return;
  const f = A[tecla] || A[e.key];
  if (f && (S.ruta.etapa === 'corte' || ['m', 'f', ' ', 'ArrowLeft', 'ArrowRight'].includes(tecla) || ['ArrowLeft', 'ArrowRight'].includes(e.key))) { e.preventDefault(); f(); }
});

// ── arranque ────────────────────────────────────────────────────────────────────────────────
(async () => {
  try { S.estado = (await api('/api/estado')).j; }
  catch (e) { $app.replaceChildren(add(el('div', 'aviso'), el('b', null, 'La app no está arrancada'), el('p', null, 'Ábrela con doble clic en «Abrir edición» (o pídele a tu Claude: «arranca mi app de edición»).'))); return; }
  await irRuta();
})();
