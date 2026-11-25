// Monta el corte: junta en su orden las piezas de video.json → corte.piezas y deja el vídeo en la carpeta del vídeo.
//   node herramientas/montar.mjs <carpeta-del-vídeo>           BORRADOR para revisar: corte-v<N>.mp4, ligero (alto ≤ 1280, rápido)
//   node herramientas/montar.mjs <carpeta-del-vídeo> --final   ALTA CALIDAD para la versión final: final/corte-v<N>.mp4
//                                                              (tamaño original, crf 18; nunca pisa un final que ya exista)
// Mientras se revisa, todo va en borrador (rápido); la calidad alta se hace solo cuando la persona da el vídeo por bueno,
// en un archivo aparte, sin tocar lo que ella ya vio.
// Piezas (las que escribe la web, en el orden del montaje): {id, f, a, b, s?, v?, vel?}. f = qué grabación ("g" = corte.fuente,
// u otra si corte.fuentes = {"id": "archivo"}); a–b en segundos de esa grabación; vel = cámara rápida; v = sin voz.
// También vale la forma antigua: todas las piezas de la grabación en orden, con "fuera": true en las que se quitan.
// Si corte.silencio = {min, deja}: dentro de cada pieza (salvo las «v»), los silencios de min s o más se quedan en deja s,
// como en la vista previa de la web (los silencios salen de los huecos entre palabras de transcripcion.json).
// Corta al fotograma exacto (recodifica); necesita ffmpeg (brew install ffmpeg).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2), FINAL = args.includes('--final');
const dir = path.resolve(args.find((x) => !x.startsWith('--')) || '.');
const vf = path.join(dir, 'video.json');
const v = JSON.parse(fs.readFileSync(vf, 'utf8'));
const c = v.corte || {};
if (!c.fuente) { console.error('✘ Este vídeo aún no tiene grabación.'); process.exit(1); }
const fuentes = { g: c.fuente, ...(c.fuentes || {}) };
const r2 = (x) => Math.round(x * 100) / 100;

// las piezas en el orden del montaje
let ps = Array.isArray(c.piezas) ? c.piezas : [];
if (ps.some((p) => 'fuera' in p) || !ps.some((p) => p.f)) ps = ps.filter((p) => !p.fuera).map((p) => ({ ...p, f: p.f || 'g' }));
ps = ps.filter((p) => p.b - p.a > 0.04);
if (!ps.length) { console.error('✘ No hay piezas que se queden.'); process.exit(1); }
for (const p of ps) if (!fuentes[p.f] || !fs.existsSync(path.join(dir, fuentes[p.f]))) { console.error('✘ No encuentro la grabación «' + p.f + '» (' + (fuentes[p.f] || 'sin nombre') + ').'); process.exit(1); }

// silencios largos: se quitan del centro de cada uno (igual que la web)
const regla = c.silencio || null;
const palabras = (() => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'transcripcion.json'), 'utf8')).palabras || []; } catch { return []; } })();
function silencios(dur) { const r = []; let t = 0; palabras.forEach((w) => { if (w.a - t >= 0.2) r.push([t, w.a]); t = Math.max(t, w.b); }); if (dur - t >= 0.2) r.push([t, dur]); return r; }
function tramos(p) {
  if (!regla || p.v || p.f !== 'g' || !palabras.length) return [[p.a, p.b]];
  const m = regla.min == null ? 0.7 : regla.min, d = regla.deja == null ? 0.3 : regla.deja;
  const saltos = silencios(p.b + 1).filter(([a, b]) => a >= p.a && b <= p.b && b - a >= m).map(([a, b]) => [r2(a + d / 2), r2(b - d / 2)]);
  const out = []; let t = p.a; saltos.forEach(([a, b]) => { if (a - t > 0.04) out.push([t, a]); t = b; }); if (p.b - t > 0.04) out.push([t, p.b]);
  return out;
}

const entradas = [...new Set(ps.map((p) => p.f))], idx = Object.fromEntries(entradas.map((f, i) => [f, i]));
const probar = (f, q) => spawnSync('ffprobe', ['-v', 'error', ...q, '-of', 'csv=p=0', path.join(dir, fuentes[f])], { encoding: 'utf8' }).stdout.trim();
const conAudio = Object.fromEntries(entradas.map((f) => [f, probar(f, ['-select_streams', 'a', '-show_entries', 'stream=index']) !== '']));
const audio = entradas.every((f) => conAudio[f]);
const [ancho, alto] = probar(entradas[0], ['-select_streams', 'v:0', '-show_entries', 'stream=width,height']).split(',').map(Number);
// borrador: alto como mucho 1280 (vertical) o ancho 1280 (horizontal); final: el tamaño de la grabación
const escala = FINAL ? `scale=${ancho || -2}:${alto || -2}` : (alto >= ancho ? "scale=-2:'min(1280,ih)'" : "scale='min(1280,iw)':-2");

const atempo = (x) => { const r = []; while (x > 2) { r.push('atempo=2'); x /= 2; } r.push('atempo=' + x.toFixed(4)); return r.join(','); };
const f = []; let n = 0;
ps.forEach((p) => {
  const vel = p.vel > 1 ? p.vel : 1, e = idx[p.f];
  tramos(p).forEach(([a, b]) => {
    f.push(`[${e}:v]trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)/${vel},${escala},setsar=1${entradas.length > 1 ? ",fps=30" : ""}[v${n}]`);
    if (audio) f.push(`[${e}:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS${vel > 1 ? ',' + atempo(vel) : ''},afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, (b - a) / vel - 0.012).toFixed(3)}:d=0.012[a${n}]`);
    n++;
  });
});
f.push(Array.from({ length: n }, (_, i) => `[v${i}]` + (audio ? `[a${i}]` : '')).join('') + `concat=n=${n}:v=1:a=${audio ? 1 : 0}[v]` + (audio ? '[a]' : ''));

const N = c.version || 1;
let salida = FINAL ? path.join('final', `corte-v${N}.mp4`) : `corte-v${N}.mp4`;
if (FINAL) {   // un final no se pisa nunca: si ya existe, va con -2, -3…
  fs.mkdirSync(path.join(dir, 'final'), { recursive: true });
  for (let i = 2; fs.existsSync(path.join(dir, salida)); i++) salida = path.join('final', `corte-v${N}-${i}.mp4`);
}
const ff = ['-nostdin', '-loglevel', 'error', '-y', ...entradas.flatMap((x) => ['-i', path.join(dir, fuentes[x])]), '-filter_complex', f.join(';'), '-map', '[v]'];
if (audio) ff.push('-map', '[a]', '-c:a', 'aac', '-b:a', FINAL ? '192k' : '128k');
ff.push('-c:v', 'libx264', ...(FINAL ? ['-preset', 'medium', '-crf', '18'] : ['-preset', 'veryfast', '-crf', '23']), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(dir, salida + '.tmp.mp4'));
const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
if (r.status !== 0 || !fs.existsSync(path.join(dir, salida + '.tmp.mp4')) || !fs.statSync(path.join(dir, salida + '.tmp.mp4')).size) { console.error('✘ ffmpeg ha fallado.'); process.exit(1); }
fs.renameSync(path.join(dir, salida + '.tmp.mp4'), path.join(dir, salida));
const v2 = JSON.parse(fs.readFileSync(vf, 'utf8'));
if (FINAL) v2.corte.final = salida; else v2.corte.montado = salida;
fs.writeFileSync(vf + '.tmp', JSON.stringify(v2, null, 2) + '\n'); fs.renameSync(vf + '.tmp', vf);
const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(dir, salida)], { encoding: 'utf8' }).stdout.trim()) || 0;
console.log(`✔ ${salida} (${FINAL ? 'alta calidad' : 'borrador'}): ${ps.length} piezas, ${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')}`);
