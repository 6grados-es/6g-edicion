// servidor.mjs — el puente local de la app de edición de 6 Grados. Sin dependencias: node servidor.mjs
// Sirve la web en http://localhost:4710 y guarda todo en la carpeta datos/ (un vídeo = una carpeta).
// Solo escucha en este ordenador. Las reglas de los archivos están en CLAUDE.md.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = Number(process.env.EDICION_PUERTO || 4710);
const DATOS = path.resolve(process.env.EDICION_DATOS || path.join(DIR, 'datos'));
const VIDEOS = path.join(DATOS, 'videos');
fs.mkdirSync(VIDEOS, { recursive: true });

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.srt': 'text/plain; charset=utf-8', '.ass': 'text/plain; charset=utf-8'
};
const ES_VIDEO = /\.(mp4|m4v|mov|webm)$/i;
const ETAPAS = ['idea', 'guion', 'corte', 'edicion', 'terminado'];

// ── utilidades ──────────────────────────────────────────────────────────────────────────────
const idValido = (id) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(id || '');
const nombreValido = (n) => /^[^/\\]{1,120}$/.test(n || '') && !n.startsWith('.');
function carpeta(id) { if (!idValido(id)) throw Object.assign(new Error('id no válido'), { code: 400 }); return path.join(VIDEOS, id); }
function slug(t) {
  return String(t || 'video').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'video';
}
const hoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };   // fecha local, no UTC
function leerJson(f, def) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } }
function escribirJson(f, obj) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n'); fs.renameSync(tmp, f); }
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': TIPOS['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function cuerpo(req, max = 5e6) {
  return new Promise((ok, mal) => {
    let b = ''; req.setEncoding('utf8');
    req.on('data', (c) => { b += c; if (b.length > max) { req.destroy(); mal(new Error('demasiado grande')); } });
    req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { mal(e); } });
  });
}

// Firma de una carpeta: cambia cuando cambia cualquier archivo (lo usa la web para ver al momento lo que hace Claude).
function firma(dir) {
  let s = '';
  try { for (const n of fs.readdirSync(dir).sort()) { if (n.endsWith('.tmp') || n.startsWith('.')) continue; const st = fs.statSync(path.join(dir, n)); s += n + ':' + st.size + ':' + Math.round(st.mtimeMs) + ';'; } } catch {}
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function base(titulo) {
  return {
    titulo: titulo || 'Vídeo sin título', etapa: 'idea', creado: hoy(), idea: '',
    guion: { version: 0 },
    corte: { fuente: null, piezas: [], version: 0 },
    edicion: { version: 0, video: null },
    feedback: { guion: [], corte: [], edicion: [] }
  };
}
function normalizar(v) {
  const b = base(v.titulo);
  const o = { ...b, ...v };
  o.guion = { ...b.guion, ...(v.guion || {}) };
  o.corte = { ...b.corte, ...(v.corte || {}) };
  o.edicion = { ...b.edicion, ...(v.edicion || {}) };
  o.feedback = { ...b.feedback, ...(v.feedback || {}) };
  if (!ETAPAS.includes(o.etapa)) o.etapa = 'idea';
  return o;
}

function guiones(dir) {
  const out = {};
  for (const n of fs.readdirSync(dir)) { const m = n.match(/^guion-v(\d+)\.md$/); if (m) out[m[1]] = fs.readFileSync(path.join(dir, n), 'utf8'); }
  return out;
}
function archivos(dir) {
  return fs.readdirSync(dir).filter((n) => !n.startsWith('.') && !n.endsWith('.tmp')).map((n) => {
    const st = fs.statSync(path.join(dir, n)); return { nombre: n, bytes: st.size, video: ES_VIDEO.test(n) };
  });
}
function resumen(id) {
  const dir = carpeta(id);
  const v = normalizar(leerJson(path.join(dir, 'video.json'), {}));
  const g = guiones(dir); const vs = Object.keys(g).map(Number);
  return { id, ...v, guionVersiones: vs.sort((a, b) => a - b), firma: firma(dir) };
}
function completo(id) {
  const dir = carpeta(id);
  if (!fs.existsSync(path.join(dir, 'video.json'))) return null;
  const v = normalizar(leerJson(path.join(dir, 'video.json'), {}));
  return {
    id, carpeta: dir, ...v, guiones: guiones(dir), archivos: archivos(dir),
    transcripcion: leerJson(path.join(dir, 'transcripcion.json'), null),
    ondas: leerOndas(dir), firma: firma(dir), mtime: Math.round(fs.statSync(path.join(dir, 'video.json')).mtimeMs)
  };
}

// ── onda del audio (picos) con ffmpeg, si está instalado; se guarda en .onda-<archivo>.json ────────────
const enMarcha = new Set();
function leerOndas(dir) {
  const out = {};
  for (const n of fs.readdirSync(dir)) { const m = n.match(/^\.onda-(.+)\.json$/); if (m) out[m[1]] = leerJson(path.join(dir, n), null); }
  return out;
}
function prepararOnda(dir, nombre) {
  const destino = path.join(dir, '.onda-' + nombre + '.json'); const clave = destino;
  if (fs.existsSync(destino) || enMarcha.has(clave)) return;
  enMarcha.add(clave);
  const PASO = 0.05, SR = 8000, N = Math.round(SR * PASO);
  const ff = spawn('ffmpeg', ['-v', 'error', '-i', path.join(dir, nombre), '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], { stdio: ['ignore', 'pipe', 'ignore'] });
  const picos = []; let resto = Buffer.alloc(0), max = 0, cuenta = 0;
  ff.stdout.on('data', (c) => {
    const b = Buffer.concat([resto, c]); const pares = b.length - (b.length % 2);
    for (let i = 0; i < pares; i += 2) { const s = Math.abs(b.readInt16LE(i)); if (s > max) max = s; if (++cuenta === N) { picos.push(max); max = 0; cuenta = 0; } }
    resto = b.subarray(pares);
  });
  ff.on('error', () => enMarcha.delete(clave));   // no hay ffmpeg: la web pinta sin onda
  ff.on('close', (code) => {
    enMarcha.delete(clave);
    if (code !== 0 || !picos.length) return;
    const top = Math.max(...picos) || 1;
    escribirJson(destino, { paso: PASO, picos: picos.map((p) => Math.round((p / top) * 100)) });
  });
}

// ── archivos de vídeo con Range (para poder saltar en la línea de tiempo, también en Safari) ────────
function servirArchivo(req, res, f) {
  let st; try { st = fs.statSync(f); } catch { res.writeHead(404); return res.end(); }
  if (!st.isFile()) { res.writeHead(404); return res.end(); }
  const tipo = TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream';
  const r = req.headers.range && req.headers.range.match(/bytes=(\d*)-(\d*)/);
  if (r) {
    let a = r[1] === '' ? null : Number(r[1]), b = r[2] === '' ? null : Number(r[2]);
    if (a === null) { a = Math.max(0, st.size - b); b = st.size - 1; } else if (b === null || b >= st.size) b = st.size - 1;
    if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': tipo, 'Content-Length': b - a + 1, 'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    return fs.createReadStream(f, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
}

// ── rutas ───────────────────────────────────────────────────────────────────────────────────
const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = decodeURIComponent(url.pathname);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origen = req.headers.origin || '';
    if (origen && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origen)) return json(res, 403, { error: 'origen' });
  }
  try {
    if (p === '/api/estado') return json(res, 200, { ok: true, carpeta: DIR, datos: DATOS, videos: VIDEOS });

    if (p === '/api/videos' && req.method === 'GET') {
      const lista = fs.readdirSync(VIDEOS).filter((n) => idValido(n) && fs.existsSync(path.join(VIDEOS, n, 'video.json'))).map(resumen);
      return json(res, 200, { videos: lista });
    }
    if (p === '/api/videos' && req.method === 'POST') {
      const { titulo, idea } = await cuerpo(req);
      let id = hoy() + '-' + slug(titulo), i = 2; while (fs.existsSync(path.join(VIDEOS, id))) id = hoy() + '-' + slug(titulo) + '-' + i++;
      const dir = carpeta(id); fs.mkdirSync(dir, { recursive: true });
      const v = base(String(titulo || '').trim() || 'Vídeo sin título'); v.idea = String(idea || '');
      escribirJson(path.join(dir, 'video.json'), v);
      return json(res, 200, completo(id));
    }

    let m = p.match(/^\/api\/videos\/([^/]+)(?:\/(.*))?$/);
    if (m) {
      const id = m[1], resto = m[2] || '', dir = carpeta(id);
      if (!fs.existsSync(path.join(dir, 'video.json'))) return json(res, 404, { error: 'no existe ese vídeo' });

      if (resto === '' && req.method === 'GET') {
        const v = completo(id);
        const fuentes = [v.corte.fuente, v.corte.montado, v.edicion.video, ...v.archivos.filter((a) => a.video).map((a) => a.nombre)].filter(Boolean);
        for (const f of new Set(fuentes)) if (fs.existsSync(path.join(dir, f))) prepararOnda(dir, f);
        return json(res, 200, v);
      }
      if (resto === 'firma') return json(res, 200, { firma: firma(dir) });

      // guarda video.json entero; si Claude lo ha cambiado mientras tanto (mtime distinto), devuelve 409 con lo nuevo
      if (resto === 'json' && req.method === 'PUT') {
        const { datos, mtime } = await cuerpo(req);
        const f = path.join(dir, 'video.json');
        const actual = Math.round(fs.statSync(f).mtimeMs);
        if (mtime && Math.abs(actual - mtime) > 1) return json(res, 409, completo(id));
        if (!datos || typeof datos !== 'object') return json(res, 400, { error: 'faltan datos' });
        escribirJson(f, normalizar(datos));
        return json(res, 200, { ok: true, mtime: Math.round(fs.statSync(f).mtimeMs), firma: firma(dir) });
      }
      m = resto.match(/^guion\/(\d+)$/);
      if (m && req.method === 'PUT') {
        const { texto } = await cuerpo(req);
        const f = path.join(dir, `guion-v${Number(m[1])}.md`);
        const tmp = f + '.tmp'; fs.writeFileSync(tmp, String(texto ?? '')); fs.renameSync(tmp, f);
        return json(res, 200, { ok: true, firma: firma(dir) });
      }
      // subir la grabación: el cuerpo es el archivo tal cual (?nombre=grabacion.mov)
      if (resto === 'subir' && req.method === 'POST') {
        const nombre = path.basename(url.searchParams.get('nombre') || '');
        if (!nombreValido(nombre) || !ES_VIDEO.test(nombre)) return json(res, 400, { error: 'Solo vídeos (.mp4, .mov, .m4v, .webm)' });
        const f = path.join(dir, nombre), tmp = f + '.tmp';
        await new Promise((ok, mal) => { const w = fs.createWriteStream(tmp); req.pipe(w); w.on('finish', ok); w.on('error', mal); req.on('error', mal); });
        fs.renameSync(tmp, f);
        const vf = path.join(dir, 'video.json'); const v = normalizar(leerJson(vf, {}));
        v.corte.fuente = nombre; v.corte.piezas = []; v.corte.version = 0; escribirJson(vf, v);
        prepararOnda(dir, nombre);
        return json(res, 200, completo(id));
      }
      return json(res, 404, { error: 'ruta' });
    }

    // los archivos de cada vídeo (vídeos, guiones, subtítulos…)
    m = p.match(/^\/media\/([^/]+)\/([^/]+)$/);
    if (m) { const dir = carpeta(m[1]); if (!nombreValido(m[2])) return json(res, 400, { error: 'nombre' }); return servirArchivo(req, res, path.join(dir, m[2])); }

    // la web
    const rel = p === '/' ? 'index.html' : p.slice(1);
    if (!/^(index\.html|app\.js|estilo\.css|marca\/[a-z0-9._-]+|marca\/fuentes\/[a-z0-9._-]+)$/i.test(rel)) return json(res, 404, { error: 'no existe' });
    return servirArchivo(req, res, path.join(DIR, 'web', rel));
  } catch (e) {
    return json(res, e.code === 400 ? 400 : 500, { error: String(e.message || e) });
  }
});

servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') { console.log(`  ✔ Ya está abierta en http://localhost:${PUERTO}`); process.exit(0); }
  throw e;
});
servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`\n  Edición · 6 Grados\n  Abierta en http://localhost:${PUERTO}\n  Datos en ${DATOS.replace(os.homedir(), '~')}\n  Cierra esta ventana para apagarla.\n`);
});
