// Monta el corte: junta en orden las piezas de video.json → corte.piezas que NO están "fuera" y deja
// corte-v<N>.mp4 en la carpeta del vídeo (y lo apunta en corte.montado).
//   node herramientas/montar.mjs <carpeta-del-vídeo>
// Corta al fotograma exacto (recodifica); necesita ffmpeg (brew install ffmpeg).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = path.resolve(process.argv[2] || '.');
const vf = path.join(dir, 'video.json');
const v = JSON.parse(fs.readFileSync(vf, 'utf8'));
const fuente = v.corte && v.corte.fuente;
if (!fuente) { console.error('✘ Este vídeo aún no tiene grabación.'); process.exit(1); }
const ps = (v.corte.piezas || []).filter((p) => !p.fuera && p.b - p.a > 0.04);
if (!ps.length) { console.error('✘ No hay piezas que se queden.'); process.exit(1); }

const tieneAudio = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', path.join(dir, fuente)], { encoding: 'utf8' }).stdout.trim() !== '';
const f = [];
ps.forEach((p, i) => {
  f.push(`[0:v]trim=start=${p.a}:end=${p.b},setpts=PTS-STARTPTS[v${i}]`);
  if (tieneAudio) f.push(`[0:a]atrim=start=${p.a}:end=${p.b},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, p.b - p.a - 0.012).toFixed(3)}:d=0.012[a${i}]`);
});
f.push(ps.map((_, i) => `[v${i}]` + (tieneAudio ? `[a${i}]` : '')).join('') + `concat=n=${ps.length}:v=1:a=${tieneAudio ? 1 : 0}[v]` + (tieneAudio ? '[a]' : ''));
const n = v.corte.version || 1, salida = `corte-v${n}.mp4`;
const args = ['-nostdin', '-loglevel', 'error', '-y', '-i', path.join(dir, fuente), '-filter_complex', f.join(';'), '-map', '[v]'];
if (tieneAudio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(dir, salida + '.tmp.mp4'));
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
if (r.status !== 0) { console.error('✘ ffmpeg ha fallado.'); process.exit(1); }
fs.renameSync(path.join(dir, salida + '.tmp.mp4'), path.join(dir, salida));
const v2 = JSON.parse(fs.readFileSync(vf, 'utf8')); v2.corte.montado = salida;
fs.writeFileSync(vf + '.tmp', JSON.stringify(v2, null, 2) + '\n'); fs.renameSync(vf + '.tmp', vf);
const total = ps.reduce((s, p) => s + p.b - p.a, 0);
console.log(`✔ ${salida}: ${ps.length} piezas, ${Math.floor(total / 60)}:${String(Math.round(total % 60)).padStart(2, '0')}`);
