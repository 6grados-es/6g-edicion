#!/usr/bin/env node
// Capturas de todas las pantallas con Chrome sin ventana (no trae nada al frente ni suena). Solo para revisar el diseño.
//   EDICION_PUERTO=4711 EDICION_DATOS=<datos inventados> node servidor.mjs   (en otra terminal)
//   BASE=http://localhost:4711 node scripts/capturas.mjs <carpeta> [prefijo]
// Cada pantalla en claro y oscuro, a 1280, 820 y 390 px, entera de arriba abajo.
// Los ids de PANTALLAS son los del juego de datos inventados (ver CLAUDE.md del repo: nunca datos de un cliente real).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [carpeta, prefijo = ''] = process.argv.slice(2);
if (!carpeta) { console.error('Uso: node scripts/capturas.mjs <carpeta> [prefijo]'); process.exit(1); }
mkdirSync(carpeta, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:4711';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PUERTO = 9333 + Math.floor(Math.random() * 400);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const PANTALLAS = (process.env.PANTALLAS ? JSON.parse(process.env.PANTALLAS) : [
  ['tablero', '#/'],
  ['nueva-idea', '#/', `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))`],
  ['idea', '#/v/2026-11-25-tres-especias-para-la-digestion/idea'],
  ['guion', '#/v/2026-11-24-hummus-de-calabaza-para-el-otono/guion'],
  ['corte-subir', '#/v/2026-11-24-hummus-de-calabaza-para-el-otono/corte'],
  ['corte', '#/v/2026-11-23-crema-de-lentejas-rojas/corte'],
  ['corte-sin-quitado', '#/v/2026-11-23-crema-de-lentejas-rojas/corte', `(() => { const b = document.querySelector('.x-lm-bquit'); if (b && /sí/.test(b.textContent)) b.click(); })()`],
  ['corte-comentarios', '#/v/2026-11-23-crema-de-lentejas-rojas/corte', `(() => { const b = document.querySelector('.x-lm-bquit'); if (b && /no/.test(b.textContent)) b.click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true })); })()`],
  ['edicion-sin-montar', '#/v/2026-11-23-crema-de-lentejas-rojas/edicion'],
  ['edicion', '#/v/2026-11-21-golden-milk-antes-de-dormir/edicion'],
  ['edicion-catalogo', '#/v/2026-11-21-golden-milk-antes-de-dormir/edicion', `(() => { const b = document.querySelector('.x-fx-catnuevo'); if (b) b.click(); const f = document.querySelector('.x-fx-catform'); if (f) f.scrollIntoView({ block: 'center' }); })()`],
  ['atajos', '#/v/2026-11-23-crema-de-lentejas-rojas/corte', `document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))`],
]);
const ANCHOS = (process.env.ANCHOS || '1280,820,390').split(',').map(Number);
const TEMAS = (process.env.TEMAS || 'claro,oscuro').split(',');

const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cap-'))}`,
  '--no-first-run', '--hide-scrollbars', '--disable-gpu', '--mute-audio', '--disable-audio-output', '--autoplay-policy=user-gesture-required', 'about:blank'], { stdio: 'ignore' });
process.on('exit', () => chrome.kill());

let ws; let n = 0; const pend = new Map();
async function conectar() {
  for (let i = 0; i < 50; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json();
      const p = l.find((x) => x.type === 'page');
      if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; }); break; }
    } catch { /* aún arrancando */ }
    await espera(200);
  }
  if (!ws) throw new Error('Chrome no arranca');
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
}
const cdp = (method, params = {}) => new Promise((ok) => { const id = ++n; pend.set(id, (d) => ok(d.result || d)); ws.send(JSON.stringify({ id, method, params })); });
const js = async (expression) => (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

async function ir(url, tema, ancho) {
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: 900, deviceScaleFactor: 2, mobile: ancho < 500 });
  await cdp('Page.navigate', { url: BASE + '/' });
  await espera(300);
  await js(`localStorage.setItem('6g-edicion.tema', '${tema === 'oscuro' ? 'oscuro' : ''}'); true`);
  await cdp('Page.navigate', { url: BASE + '/?c=' + Date.now() + url });
  for (let i = 0; i < 40; i++) { if (await js(`!!document.querySelector('#app h1')`)) break; await espera(200); }
  await js(`HTMLMediaElement.prototype.play = function () { this.muted = true; return Promise.resolve(); }; document.fonts.ready.then(() => true)`);
  if (/\/(corte|edicion)$/.test(url)) for (let i = 0; i < 30; i++) { if (await js(`!!document.querySelector('.x-lm, #zona-subir, .vacio')`)) break; await espera(200); }
  await espera(1200); // ondas y primer fotograma del vídeo
}

async function foto(nombre, ancho) {
  // el vídeo del editor mide en vh: se fija a lo que mide con la ventana normal, para que no crezca al hacer la ventana tan alta como la página
  await js(`document.querySelectorAll('.x-lm-pant').forEach((p) => { p.style.maxHeight = p.getBoundingClientRect().height + 'px'; }); true`);
  const h = Math.min(await js('Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)'), 3200);
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: Math.max(h, 700), deviceScaleFactor: 2, mobile: ancho < 500 });
  await js('window.scrollTo(0, 0); true');
  await espera(500);
  const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(carpeta, nombre + '.png'), Buffer.from(data, 'base64'));
}

await conectar();
await cdp('Page.enable');
for (const [nom, url, accion] of PANTALLAS) {
  for (const tema of TEMAS) for (const ancho of ANCHOS) {
    await ir(url, tema, ancho);
    if (accion) { await js(accion); await espera(500); }
    await foto(`${prefijo}${nom}-${tema}-${ancho}`, ancho);
    process.stdout.write('.');
  }
}
console.log('\n✔ capturas en ' + carpeta);
process.exit(0);
