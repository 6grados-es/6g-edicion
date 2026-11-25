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
  const vol = el('button', 'volver'); add(vol, (S.ruta.etapa === 'corte' || S.ruta.etapa === 'edicion') && v.corte.fuente ? '← Tablero' : '← Tablero (Esc)'); vol.addEventListener('click', () => { location.hash = '#/'; }); f.appendChild(vol);
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
    corte: ['Corta la grabación', 'Sube lo que has grabado y pulsa «Copiar a Claude»: la transcribe y te propone un corte. Tú lo ajustas en la línea de tiempo o en el texto (quitar, recuperar, mover trozos) y le pides la versión siguiente. Cuando te guste, «Dar por bueno».'],
    edicion: ['Edita el vídeo', 'Pon los efectos de tu catálogo en la línea de tiempo, deja comentarios generales o con su minuto y pulsa «Copiar a Claude» para la versión siguiente. Lo que ya ha montado Claude está debajo, en «Ver el vídeo que ya está montado».']
  }[k];
  const a = el('div', 'aviso'); add(a, el('b', null, T[0]), el('p', null, T[1])); return a;
}
function siguiente(k) { const i = IDX[k]; return i < 3 ? ETAPAS[i + 1] : null; }
function botonesCab(k, { copiable = true, motivo = '' } = {}) {
  const v = S.v, der = el('div', 'der');
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
    if (!conMinuto) return; 
    const t = tiempo(); notaN.replaceChildren();
    const ta2 = el('textarea'); ta2.rows = 2; ta2.placeholder = 'Qué quieres cambiar en ' + fmt(t.T) + ' (Enter guarda)';
    ta2.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { notaN.replaceChildren(); return; }
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return; e.preventDefault();
      const x = ta2.value.trim(); if (!x) return;
      lista().push({ id: uid(), texto: x, v: ver, t: +t.t.toFixed(2), T: +t.T.toFixed(2) }); notaN.replaceChildren(); guardar(); pintarLista();
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
    if (vivo) { const b = el('button', 'x', '✕'); b.type = 'button'; b.title = 'Quitar'; b.setAttribute('aria-label', 'Quitar comentario'); b.addEventListener('click', () => { v.feedback[k] = lista().filter((y) => y !== x); guardar(); pintarLista(); }); r.appendChild(b); }
    return r;
  }
  pintarLista();
  return box;
}

// ── editor de Corte y Edición: el de las clases de 6 Grados (web/editor/), con los datos de este vídeo ─────────────
const ED = { nuevo: null, subir: null, desmontar() { ED.nuevo = null; } };
const EDM = { mod: null, fx: null };
async function modulosEditor() {
  if (!EDM.mod) [EDM.mod, EDM.fx] = await Promise.all([import('./editor/corte-editor.js'), import('./editor/corte-fx.js')]);
  if (S.catalogo === undefined) { try { S.catalogo = (await api('/api/efectos')).j.efectos; } catch (e) { S.catalogo = null; } }
  EDM.fx.ponerCatalogo(S.catalogo && S.catalogo.length ? S.catalogo : EDM.fx.EJEMPLO);
  return EDM;
}
// duración y tamaño de un vídeo, leídos del propio archivo (una vez por archivo)
const METAS = new Map();
function metaVideo(src) {
  if (METAS.has(src)) return METAS.get(src);
  const pr = new Promise((ok) => {
    const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    let hecho = false; const fin = (r) => { if (hecho) return; hecho = true; ok(r); v.removeAttribute('src'); v.load(); };
    v.onloadedmetadata = () => fin(isFinite(v.duration) && v.duration > 0 ? { dur: v.duration, ancho: v.videoWidth, alto: v.videoHeight } : null);
    v.onerror = () => fin(null); setTimeout(() => fin(null), 10000); v.src = src;
  });
  METAS.set(src, pr); pr.then((r) => { if (!r) METAS.delete(src); }); return pr;
}
// los huecos entre palabras de la transcripción (para acortar silencios si la persona lo tiene puesto en corte.silencio)
function silenciosDe(ws, dur) {
  const r = []; if (!ws || !ws.length) return r; let t = 0;
  ws.forEach((w) => { if (w.a - t >= 0.2) r.push([+t.toFixed(2), +w.a.toFixed(2)]); t = Math.max(t, w.b); });
  if (dur - t >= 0.2) r.push([+t.toFixed(2), +dur.toFixed(2)]);
  return r;
}
// las piezas del corte en la forma del editor: [{id, f, a, b, t}] en el orden del montaje. Acepta la forma antigua
// ({a, b, fuera} con todas las piezas de la grabación) y, si no hay ninguna, una sola pieza con toda la grabación.
function piezasEditor(v, dur) {
  const ps = Array.isArray(v.corte.piezas) ? v.corte.piezas : [], ws = (v.transcripcion && v.transcripcion.palabras) || [];
  const texto = (a, b) => { const t = ws.filter((w) => (w.a + w.b) / 2 >= a && (w.a + w.b) / 2 < b).map((w) => w.p).join(' '); return t.length > 60 ? t.slice(0, 57) + '…' : t; };
  if (ps.length && ps.every((p) => p && p.f && isFinite(p.a) && isFinite(p.b))) return ps.map((p, i) => ({ ...p, id: String(p.id || 'p' + (i + 1)), t: p.t || texto(p.a, p.b) }));
  const quedan = ps.filter((p) => p && !p.fuera && isFinite(p.a) && isFinite(p.b) && p.b > p.a);
  if (quedan.length) return quedan.map((p, i) => ({ id: 'p' + (i + 1), f: 'g', a: +(+p.a).toFixed(2), b: +(+p.b).toFixed(2), t: texto(p.a, p.b) }));
  return [{ id: 'p1', f: 'g', a: 0, b: +dur.toFixed(2), t: texto(0, dur) }];
}
async function copiarTexto(t) {
  window.__ultimoCopiado = t;
  if (Array.isArray(window.__clip)) { window.__clip.push(t); return; }   // las pruebas no tocan el portapapeles de nadie
  try { await navigator.clipboard.writeText(t); }
  catch (e) { const ta = el('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
}
// lo que manda el editor («Copiar a Claude» y «Dar por bueno»): se copia con la cabecera de la app y se deja en la carpeta
async function enviarDesdeEditor(k, texto, tipo) {
  const v = S.v, E = S.estado || {};
  const t = cabeceraClaude(ETAPAS[IDX[k]].n).concat(['Las órdenes «node herramientas/…» se lanzan desde la carpeta de la app: ' + (E.carpeta || '') + '.', '', '']).join('\n') + texto;
  await copiarTexto(t);
  api('/api/videos/' + v.id + '/encargo/' + k, { method: 'POST', body: JSON.stringify({ texto: t }) }).catch(() => {});
  if (tipo === 'bueno' && k === 'corte') {
    if (IDX[v.etapa] <= IDX.corte) { v.etapa = 'edicion'; guardar(true); }
    toast('Copiado: pégalo en tu Claude (⌘V). El vídeo pasa a Edición.', 4200); setTimeout(() => irEtapa('edicion'), 400);
  } else if (tipo === 'bueno' && k === 'edicion') {
    v.etapa = 'terminado'; guardar(true); toast('¡Lista! Copiado para tu Claude; el vídeo está en «Listos».', 4200);
  } else toast('Copiado. Pégalo en tu Claude (⌘V): cuando termine, lo verás aquí solo.', 4200);
  return true;
}
function panelEditor(k) {
  const v = S.v, p = el('section', 'panel panel-editor');
  const src = '/media/' + v.id + '/' + encodeURIComponent(v.corte.fuente);
  const cargando = el('p', 'ayuda-linea', 'Abriendo el editor…'); p.appendChild(cargando);
  (async () => {
    const [{ mod }, meta] = await Promise.all([modulosEditor(), metaVideo(src)]);
    if (!p.isConnected || S.v !== v) return;
    const dur = (meta && meta.dur) || ((v.corte.piezas || []).reduce((m, x) => Math.max(m, +x.b || 0), 0)) || 0;
    if (!dur) { cargando.textContent = 'No se ha podido leer la grabación (' + v.corte.fuente + '). Prueba a subirla otra vez.'; return; }
    const ws = (v.transcripcion && v.transcripcion.palabras) || [], piezas = piezasEditor(v, dur);
    const n = v.edicion.version, cn = v.corte.version, hay = (f) => f && v.archivos.some((a) => a.nombre === f);
    const edV = hay(v.edicion.final) ? v.edicion.final : v.edicion.video;
    const montado = k === 'edicion' ? (hay(edV) ? { url: '/media/' + v.id + '/' + edV.split('/').map(encodeURIComponent).join('/'), archivo: edV } : null)
      : (hay('corte-v' + cn + '.mp4') ? { url: '/media/' + v.id + '/corte-v' + cn + '.mp4', archivo: 'corte-v' + cn + '.mp4' } : null);
    const ctx = {
      cid: v.id, titulo: v.titulo, carpeta: v.carpeta, modo: k === 'edicion' ? 'edicion' : 'corte', siempre: true, montado,
      editor: {
        fuentes: [{ id: 'g', nombre: v.corte.fuente, dur, ancho: meta && meta.ancho, alto: meta && meta.alto, ligera: src, silencios: silenciosDe(ws, dur),
          onda: '/api/videos/' + v.id + '/editor/onda?f=' + encodeURIComponent(v.corte.fuente), palabras: '/api/videos/' + v.id + '/editor/palabras' }],
        piezas, silencio: v.corte.silencio || null, version: cn || 0,
        edicion: n ? { version: n, piezas: Array.isArray(v.edicion.piezas) ? v.edicion.piezas : null, sobre: v.edicion.sobre || cn } : null,
        efectos: Array.isArray(v.edicion.efectos) ? v.edicion.efectos : []
      },
      aviso: (x) => toast(x), enviar: (texto, tipo) => enviarDesdeEditor(k, texto, tipo), irPaso: (x) => irEtapa(x), botonMic,
      catalogoEjemplo: !(S.catalogo && S.catalogo.length),
      guardarCatalogo: async (lista) => { try { const { status } = await api('/api/efectos', { method: 'PUT', body: JSON.stringify({ efectos: lista }) }); if (status !== 200) throw new Error(status); S.catalogo = lista; return true; } catch (e) { toast('No se ha podido guardar el catálogo: ' + e.message); return false; } }
    };
    const caja = mod.pintarEditor(p, ctx);
    cargando.replaceWith(caja); ED.nuevo = caja;
    if (k === 'corte') {
      const otra = el('p', 'ayuda-linea'); otra.append('Grabación: ' + v.corte.fuente + ' · ');
      const cam = el('button', 'volver', '¿Otra grabación? Súbela'); cam.style.margin = '0'; cam.addEventListener('click', () => { ED.desmontar(); p.replaceChildren(zonaSubir()); }); otra.appendChild(cam);
      p.appendChild(otra);
    }
  })().catch((e) => { cargando.textContent = 'No se ha podido abrir el editor: ' + e.message; });
  return p;
}

// CORTE
function panelCorte() {
  const v = S.v;
  if (v.corte.fuente) return panelEditor('corte');
  const p = el('section', 'panel');
  add(p, add(el('div', 'panel-cab'), add(el('h2'), 'Corte'), el('span', 'meta', 'Falta la grabación'), botonesCab('corte', { copiable: false, motivo: 'Primero sube tu grabación' })));
  p.appendChild(zonaSubir());
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
    x.onload = () => { if (x.status !== 200) { toast('No se ha podido subir: ' + (JSON.parse(x.responseText || '{}').error || x.status)); prog.hidden = true; return; } S.v = JSON.parse(x.responseText); S.firma = S.v.firma; toast('Grabación subida. Ahora «Copiar a Claude» para que la transcriba y proponga el corte.', 4200); pintar(); };
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
  const v = S.v;
  if (v.corte.fuente) return panelEditor('edicion');
  const p = el('section', 'panel');
  add(p, add(el('div', 'panel-cab'), add(el('h2'), 'Edición'), el('span', 'meta', 'Aún sin edición'), botonesCab('edicion', { copiable: false, motivo: 'Primero tiene que haber una grabación en Corte' })));
  const vac = el('div', 'vacio'); add(vac, el('b', null, 'Aún no hay grabación'), el('p', null, 'Primero sube tu grabación en la etapa Corte.')); p.appendChild(vac);
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
  }
  return L.join('\n');
}
async function copiarAClaude(k) {
  const b = document.getElementById('b-copiar'); if (b && b.disabled) return;
  if (S.pendiente) await guardarYa();
  const t = textoClaude(k); await copiarTexto(t);
  api('/api/videos/' + S.v.id + '/encargo/' + k, { method: 'POST', body: JSON.stringify({ texto: t }) }).catch(() => {});
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
  ['Corte y Edición', [['Todos los atajos del editor', '? (dentro del editor)'], ['Reproducir o pausar', 'Espacio'], ['Nota con su minuto', 'M'], ['Dividir · Quitar · Recuperar', 'B · ⌫ · R'], ['Recuperar desde / hasta la aguja', 'D · H'], ['Imán · Ver lo quitado', 'N · V'], ['Pantalla completa', 'P']]]
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
function salirCompleta() { document.body.classList.remove('completa'); }

const conEditor = () => !!(ED.nuevo && ED.nuevo.isConnected);
document.addEventListener('keydown', (e) => {
  const cmd = e.metaKey || e.ctrlKey, tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.altKey && e.code === 'KeyD') { e.preventDefault(); const a = document.activeElement; const ta = a && a.tagName === 'TEXTAREA' ? a : (DIC.ta || document.getElementById('fb-general') || document.getElementById('texto-principal') || document.querySelector('.x-lm-fb-nuevo:not([hidden])')); if (ta && ta._mic) dictar(ta, ta._mic); else if (ta) dictar(ta, null); return; }
  if (e.key === 'Escape' && document.querySelector('.capa')) { document.querySelector('.capa').remove(); return; }
  if (e.key === 'Escape' && document.querySelector('.menu')) { cerrarMenu(); return; }
  // con el editor abierto, las teclas son suyas (las de las clases: en Edición los números ponen efectos; T y E cambian de etapa)
  if (conEditor()) return;
  if (cmd && e.shiftKey && tecla === 'e') { if (S.ruta.vista === 'video') { e.preventDefault(); copiarAClaude(S.ruta.etapa); } return; }
  if (cmd && e.key === 'Enter') { if (S.ruta.vista === 'video' && !(e.target.closest && e.target.closest('.nueva'))) { e.preventDefault(); avanzar(); } return; }
  if (e.key === 'Escape') {
    if (escribiendo()) { document.activeElement.blur(); return; }
    if (S.ruta.vista === 'video') location.hash = '#/';
    return;
  }
  if (escribiendo()) return;
  if (tecla === '?') { verAtajos(); return; }
  if (S.ruta.vista === 'tablero') { if (tecla === 'n' && !cmd) { e.preventDefault(); S.nueva = true; pintar(); } return; }
  if (!cmd && /^[1-4]$/.test(tecla)) { irEtapa(ETAPAS[+tecla - 1].k); return; }
  if (!cmd && tecla === 'u' && S.ruta.etapa === 'corte' && ED.subir) { e.preventDefault(); ED.subir(); return; }
});

// ── arranque ────────────────────────────────────────────────────────────────────────────────
(async () => {
  try { S.estado = (await api('/api/estado')).j; }
  catch (e) { $app.replaceChildren(add(el('div', 'aviso'), el('b', null, 'La app no está arrancada'), el('p', null, 'Ábrela con doble clic en «Abrir edición» (o pídele a tu Claude: «arranca mi app de edición»).'))); return; }
  await irRuta();
})();
