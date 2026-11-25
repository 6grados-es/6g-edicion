// Transcribe la grabación de un vídeo con el tiempo de cada palabra y deja transcripcion.json en su carpeta.
//   node herramientas/transcribir.mjs <carpeta-del-vídeo> [idioma=es]
// Necesita ffmpeg y whisper-cpp (brew install ffmpeg whisper-cpp). El modelo se baja solo la primera vez
// a ~/.cache/6g-edicion/ (small, ~470 MB; con EDICION_MODELO=base usa uno más ligero y menos fino).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const dir = path.resolve(process.argv[2] || '.');
const idioma = process.argv[3] || 'es';
const vf = path.join(dir, 'video.json');
if (!fs.existsSync(vf)) { console.error('✘ No encuentro video.json en ' + dir); process.exit(1); }
const v = JSON.parse(fs.readFileSync(vf, 'utf8'));
const fuente = v.corte && v.corte.fuente;
if (!fuente || !fs.existsSync(path.join(dir, fuente))) { console.error('✘ Este vídeo aún no tiene grabación (corte.fuente).'); process.exit(1); }

const hay = (c) => spawnSync('sh', ['-c', 'command -v ' + c], { encoding: 'utf8' }).status === 0;
if (!hay('ffmpeg')) { console.error('✘ Falta ffmpeg: brew install ffmpeg'); process.exit(1); }
const whisper = ['whisper-cli', 'whisper-cpp', 'main'].find(hay);
if (!whisper) { console.error('✘ Falta whisper-cpp: brew install whisper-cpp'); process.exit(1); }

const nombre = process.env.EDICION_MODELO || 'small';
const cache = path.join(os.homedir(), '.cache', '6g-edicion'); fs.mkdirSync(cache, { recursive: true });
const modelo = path.join(cache, `ggml-${nombre}.bin`);
if (!fs.existsSync(modelo) || fs.statSync(modelo).size < 1e7) {
  console.log(`Bajando el modelo ${nombre} (solo la primera vez)…`);
  const r = spawnSync('curl', ['-fL', '--progress-bar', '-o', modelo + '.tmp', `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${nombre}.bin`], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('✘ No se ha podido bajar el modelo.'); process.exit(1); }
  fs.renameSync(modelo + '.tmp', modelo);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '6g-edicion-'));
const wav = path.join(tmp, 'audio.wav');
let r = spawnSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', path.join(dir, fuente), '-vn', '-ac', '1', '-ar', '16000', wav], { stdio: 'inherit' });
if (r.status !== 0) { console.error('✘ ffmpeg no ha podido sacar el audio.'); process.exit(1); }
console.log('Transcribiendo… (un minuto de vídeo tarda más o menos un minuto)');
r = spawnSync(whisper, ['-m', modelo, '-f', wav, '-l', idioma, '-ml', '1', '-sow', '-oj', '-of', path.join(tmp, 'salida'), '-t', String(Math.max(2, Math.min(8, os.cpus().length - 2)))], { stdio: ['ignore', 'ignore', 'inherit'] });
if (r.status !== 0) { console.error('✘ whisper ha fallado.'); process.exit(1); }
const js = JSON.parse(fs.readFileSync(path.join(tmp, 'salida.json'), 'utf8'));
const palabras = [];
for (const s of js.transcription || []) {
  const p = String(s.text || '').trim(); if (!p || /^\[.*\]$/.test(p)) continue;
  const a = (s.offsets?.from ?? 0) / 1000, b = (s.offsets?.to ?? 0) / 1000;
  // la puntuación suelta va pegada a la palabra anterior
  if (/^[.,;:!?¡¿…»)]+$/.test(p) && palabras.length) { palabras[palabras.length - 1].p += p; palabras[palabras.length - 1].b = Math.max(palabras[palabras.length - 1].b, b); continue; }
  palabras.push({ p, a: +a.toFixed(2), b: +Math.max(b, a + 0.05).toFixed(2) });
}
const destino = path.join(dir, 'transcripcion.json');
fs.writeFileSync(destino + '.tmp', JSON.stringify({ fuente, idioma, modelo: nombre, palabras }, null, 1) + '\n');
fs.renameSync(destino + '.tmp', destino);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✔ ${palabras.length} palabras en ${destino}`);
