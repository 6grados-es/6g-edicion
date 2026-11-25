// El EDITOR de la app de edición de 6 Grados (pasos Corte y Edición), traído del editor de corte de las clases de 6 Grados.
// Vídeo grande, texto con lo cortado tachado y UNA línea de tiempo: la del vídeo final (el montaje), en su orden.
// Se ve la grabación ORIGINAL; lo que se queda son trozos numerados y lo quitado sale en gris (o se oculta, según el ajuste).
// Se recortan los bordes arrastrándolos, se quita o se recupera un trozo, se divide y se reordenan trozos y partes arrastrándolos.
// NO se monta nada aquí: «Copiar a Claude» copia la lista final y es el Claude de la persona quien monta con ffmpeg.
//   pintarEditor(m, ctx)  ctx = { cid, titulo, carpeta, aviso, enviar(texto, tipo), editor:{fuentes, piezas, silencio, version, edicion, efectos},
//                                  montado:{url,archivo}|null, modo, irPaso(k), catalogo, guardarCatalogo(lista), siempre, botonMic(ta) }
//   (puras, para probar:) copiar, firma, ordenCrono, quitarPieza, dividirPieza, restarRango, sumarRango, limitesPieza, huecos,
//                          resumenCambios, textoEncargo, textoBueno, partesDe, moverParte, saltosDe, durMontada, aMontaje, deMontaje,
//                          cortesDe, moverPieza, fundir
// Campos opcionales de cada pieza: s = la PARTE a la que pertenece (las partes se mueven enteras), v = 1 si es una pieza sin voz
// (sus silencios no se acortan), vel = cámara rápida (×vel). editor.silencio = {min, deja}: dentro de cada pieza, los silencios de más
// de `min` s se acortan a `deja` s al montar, y la vista previa los salta igual. editor.version cambia la clave de lo guardado en el
// navegador: un corte nuevo de Claude no queda tapado por lo que se tocó sobre el anterior.
import { mover, fmt } from "./corte.js";
import { instalarFx, TIPOS } from "./corte-fx.js";
import { crearPistas } from "./corte-pistas.js";

const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const MIN = 0.05;                       // una pieza dura al menos 50 ms
const r2 = (x) => Math.round(x * 100) / 100;

// ---------- lo puro: la lista de piezas [{id, f, a, b, t}] en el orden del montaje
export const copiar = (l) => l.map((p) => ({ ...p }));
export const firma = (l) => l.map((p) => p.f + "|" + p.a + "|" + p.b).join(";");
export const ordenCrono = (l, fuentes) => l.slice().sort((x, y) => (fuentes.findIndex((f) => f.id === x.f) - fuentes.findIndex((f) => f.id === y.f)) || x.a - y.a);
const nuevoId = (l) => "p" + (1 + Math.max(0, ...l.map((p) => parseInt(String(p.id).replace(/\D/g, ""), 10) || 0)));
export const quitarPieza = (l, id) => l.filter((p) => p.id !== id);
// Las PARTES del montaje: tramos seguidos de piezas con la misma parte `s` (las que no tienen parte forman su propio tramo).
export function partesDe(l) {
  const r = [];
  l.forEach((p) => { const s = p.s || ""; const u = r[r.length - 1]; if (u && u.s === s) u.ids.push(p.id); else r.push({ s, ids: [p.id] }); });
  return r;
}
// Mueve la parte que está en la posición `desde` (de partesDe) a la posición `hasta`, con todas sus piezas.
export function moverParte(l, desde, hasta) {
  const por = new Map(l.map((p) => [p.id, p]));
  return mover(partesDe(l), desde, hasta).flatMap((x) => x.ids.map((id) => ({ ...por.get(id) })));
}
// Lo que se salta dentro de una pieza al montar: cada silencio de la fuente que cabe entero en la pieza y dura `min` s o más se
// queda en `deja` s (se quita su centro). Las piezas de pantalla (v) no se tocan.
export function saltosDe(p, sil, regla) {
  if (!regla || !p || p.v) return [];
  const m = regla.min == null ? .7 : regla.min, d = regla.deja == null ? .3 : regla.deja;
  return (sil || []).filter(([a, b]) => a >= p.a && b <= p.b && b - a >= m).map(([a, b]) => [r2(a + d / 2), r2(b - d / 2)]);
}
// Cuánto dura una pieza ya montada (sin sus silencios largos y con su cámara rápida), antes de la velocidad general.
export const durMontada = (p, sil, regla) => ((p.b - p.a) - saltosDe(p, sil, regla).reduce((s, [a, b]) => s + (b - a), 0)) / (p.vel > 1 ? p.vel : 1);
// Parte la pieza `id` en `t` (en dos consecutivas); null si t no cae dentro.
export function dividirPieza(l, id, t) {
  const i = l.findIndex((p) => p.id === id), p = l[i];
  if (!p || !(t > p.a + .1 && t < p.b - .1)) return null;
  const r = copiar(l); r[i] = { ...p, b: r2(t) };
  r.splice(i + 1, 0, { ...p, id: nuevoId(l), a: r2(t), b: p.b, t: p.t });
  return r;
}
// Quita el rango [a,b] de la fuente f: recorta o parte las piezas que lo pisan (lo que sobra de una parte conserva su id).
export function restarRango(l, f, a, b) {
  const r = [];
  let ids = l.slice();
  l.forEach((p) => {
    if (p.f !== f || p.b <= a || p.a >= b) { r.push({ ...p }); return; }
    if (p.a < a - MIN) r.push({ ...p, b: r2(a) });
    if (p.b > b + MIN) { const q = { ...p, a: r2(b) }; if (p.a < a - MIN) { q.id = nuevoId(ids); ids = ids.concat([q]); } r.push(q); }
  });
  return r;
}
// Los trozos de [a,b] que no cubre ninguna pieza de la fuente f.
export function huecos(l, f, a, b, dur) {
  const ps = l.filter((p) => p.f === f).sort((x, y) => x.a - y.a), res = [];
  let t = Math.max(0, a); const fin = Math.min(dur == null ? b : dur, b);
  for (const p of ps) { if (p.b <= t) continue; if (p.a >= fin) break; if (p.a > t + MIN) res.push([r2(t), r2(p.a)]); t = Math.max(t, p.b); }
  if (fin > t + MIN) res.push([r2(t), r2(fin)]);
  return res;
}
// Añade como piezas lo que de [a,b] estaba quitado; entran justo detrás de la pieza que les precede en el tiempo (o al final).
export function sumarRango(l, f, a, b, dur, texto) {
  const trozos = huecos(l, f, a, b, dur); if (!trozos.length) return null;
  let r = copiar(l);
  trozos.forEach(([x, y]) => {
    const previas = r.map((p, i) => [p, i]).filter(([p]) => p.f === f && p.b <= x + .001);
    const prev = previas.length ? previas.sort((u, v) => v[0].b - u[0].b)[0] : null, pos = prev ? prev[1] + 1 : r.length;
    r.splice(pos, 0, { id: nuevoId(r), f, a: x, b: y, t: texto || "(recuperado)", ...(prev && prev[0].s ? { s: prev[0].s } : {}) });
  });
  return r;
}
// Hasta dónde se puede mover cada borde de la pieza `id`: sin pisar a la vecina de su fuente ni salirse de la grabación.
export function limitesPieza(l, id, dur) {
  const p = l.find((x) => x.id === id), otras = l.filter((x) => x.f === p.f && x.id !== id);
  const antes = otras.filter((x) => x.b <= p.a + .001).map((x) => x.b), despues = otras.filter((x) => x.a >= p.b - .001).map((x) => x.a);
  return { minA: antes.length ? Math.max(...antes) : 0, maxB: despues.length ? Math.min(...despues) : dur };
}
// Qué ha cambiado respecto a lo que había (por id), en frases para Claude.
export function resumenCambios(lista, base, nombreF) {
  const out = [], por = new Map(base.map((p) => [p.id, p])), ahora = new Set(lista.map((p) => p.id));
  const lab = (p) => nombreF(p.f) + " " + fmt(p.a) + "–" + fmt(p.b);
  base.forEach((p) => { if (!ahora.has(p.id)) out.push("QUITADA la pieza " + (p.n || p.id) + " (" + lab(p) + (p.t ? " · " + p.t : "") + ")"); });
  lista.forEach((p) => {
    const b = por.get(p.id);
    if (!b) { out.push("NUEVA " + lab(p) + (p.t ? " · " + p.t : "")); return; }
    if (b.a !== p.a || b.b !== p.b) out.push("AJUSTADA la pieza " + (b.n || p.id) + ": " + nombreF(b.f) + " " + b.a + "–" + b.b + " s → " + p.a + "–" + p.b + " s");
  });
  const idsBase = base.filter((p) => ahora.has(p.id)).map((p) => p.id), idsAhora = lista.filter((p) => por.has(p.id)).map((p) => p.id);
  if (idsBase.join() !== idsAhora.join()) out.push("REORDENADAS: el orden nuevo está en la lista de abajo");
  return out;
}
export function textoEncargo(ctx, lista, base, fuentes, regla, extra) {
  const nombreF = (id) => (fuentes.find((f) => f.id === id) || { nombre: id }).nombre;
  const piezas = lista.map((p) => ({ id: p.id, f: p.f, a: p.a, b: p.b, t: p.t || "", ...(p.s ? { s: p.s } : {}), ...(p.v ? { v: 1 } : {}), ...(p.vel ? { vel: p.vel } : {}) }));
  const cambios = resumenCambios(lista, base, nombreF), n = +ctx.editor.version || 0, sig = n + 1;
  const primera = !n;
  return "CORTE · «" + ctx.titulo + "» · " + (primera ? "Quiero el corte v1 de mi grabación." : "He ajustado el corte v" + n + " en la app (no se ha montado nada).") +
    "\n\nQUÉ QUIERO: el corte v" + sig + ".\n" +
    (primera ? "1. Si no hay transcripcion.json, transcribe la grabación (node herramientas/transcribir.mjs \"" + ctx.carpeta + "\").\n" +
      "2. Propón el corte como me gustan mis vídeos (lo sabe mi cerebro): fuera silencios largos, arranques en falso y tomas repetidas (de lo repetido, la última toma bien dicha), sin cortar palabras. Respeta lo que ya haya quitado yo (las piezas de abajo) y mis comentarios.\n" +
      "3. Escribe en video.json → corte.piezas la lista nueva (misma forma que la de abajo) y pon corte.version = 1.\n"
      : "1. Escribe en video.json → corte.piezas EXACTAMENTE estas piezas, en este orden, y pon corte.version = " + sig + ". Si mis comentarios piden algo más, cámbialo tú sobre esta lista.\n") +
    (primera ? "4" : "2") + ". Monta el corte: node herramientas/montar.mjs \"" + ctx.carpeta + "\" (deja corte-v" + sig + ".mp4).\n" +
    "Cada pieza es [a, b] en segundos de la grabación ORIGINAL (f = qué grabación). " +
    (regla ? "Dentro de cada pieza que no sea «v», los silencios de " + (regla.min == null ? .7 : regla.min) + " s o más se quedan en " + (regla.deja == null ? .3 : regla.deja) + " s (como en la vista previa); «vel» es cámara rápida. " : "") +
    "\n\nGRABACIONES:\n" + fuentes.map((f) => "- " + f.id + " = " + f.nombre + " (" + fmt(f.dur) + ")").join("\n") +
    (primera ? "" : "\n\nCAMBIOS QUE HE HECHO:\n" + (cambios.length ? cambios.map((c) => "- " + c).join("\n") : "- ninguno (solo confirmo el corte)")) +
    "\n\nPIEZAS EN ORDEN (JSON, para corte.piezas):\n" + JSON.stringify(piezas) +
    "\n\n" + lista.map((p, i) => (i + 1) + ". " + (p.s ? "[" + p.s + "] " : "") + fmt(p.a) + "–" + fmt(p.b) + (p.t ? " · " + p.t : "")).join("\n") + (extra ? "\n\n" + extra : "") +
    "\n\nCuando acabes, dime en una línea qué has cambiado: la app lo enseña sola.";
}
export function textoBueno(ctx, lista, movido) {
  const n = +ctx.editor.version || 0;
  return "CORTE · «" + ctx.titulo + "» · Doy el corte" + (n ? " v" + n : "") + " por BUENO" + (movido ? " con el ajuste que te acabo de pasar" : " tal como está") +
    ". Ya he pasado el vídeo a Edición en la app.\n1. Si no existe corte-v" + n + ".mp4, móntalo: node herramientas/montar.mjs \"" + ctx.carpeta + "\".\n" +
    "2. Prepárame la edición v1 como me gustan mis vídeos (lo sabe mi cerebro; receta en el CLAUDE.md de la app). Los efectos se hacen como dice mi catálogo (datos/efectos.json).\n" +
    "Cuando acabes, dime en una línea que ya está: la app lo enseña sola.";
}

// ---------- el montaje en el tiempo (puras)
// De un segundo de la grabación (dentro de la pieza) a cuánto lleva sonando la pieza ya montada, y al revés.
export function aMontaje(p, t, sl) {
  const q = Math.max(p.a, Math.min(p.b, t)); let s = 0;
  (sl || []).forEach(([a, b]) => { if (q > a) s += Math.min(q, b) - a; });
  return (q - p.a - s) / (p.vel > 1 ? p.vel : 1);
}
export function deMontaje(p, off, sl) {
  let t = p.a + Math.max(0, off) * (p.vel > 1 ? p.vel : 1);
  for (const [a, b] of (sl || [])) { if (t >= a) t += b - a; else break; }
  return Math.min(p.b, t);
}
// Lo CORTADO de cada grabación, colgado de la pieza a la que toca: {id: {antes:[a,b]|null, despues:[a,b]|null}}.
// Cada hueco va detrás de la pieza que le precede en el grabación; el del principio, delante de la primera. Los de menos de `min` s no cuentan.
export function cortesDe(l, fuentes, min) {
  const r = {}, m = min == null ? .6 : min;
  fuentes.forEach((f) => {
    const ps = l.filter((p) => p.f === f.id).sort((x, y) => x.a - y.a);
    ps.forEach((p, i) => {
      const c = { antes: null, despues: null }, fin = i + 1 < ps.length ? ps[i + 1].a : f.dur;
      if (i === 0 && p.a >= m) c.antes = [0, r2(p.a)];
      if (fin - p.b >= m) c.despues = [r2(p.b), r2(fin)];
      r[p.id] = c;
    });
  });
  return r;
}
// Junta las piezas seguidas que son un mismo tramo continuo de la grabación (misma parte y misma velocidad): al recuperar algo cortado
// en medio de una frase vuelve a quedar un solo trozo.
export function fundir(l) {
  const r = [];
  l.forEach((p) => {
    const u = r[r.length - 1];
    if (u && u.f === p.f && Math.abs(p.a - u.b) < .03 && (u.s || "") === (p.s || "") && !u.v === !p.v && (u.vel || 1) === (p.vel || 1)) { u.b = p.b; if (!u.t || u.t === "(recuperado)") u.t = p.t; }
    else r.push({ ...p });
  });
  return r;
}
// Lleva la pieza de `desde` a justo antes de la que hoy está en `k` (k = n la deja al final); toma la parte de su nueva vecina.
export function moverPieza(l, desde, k) {
  const hasta = k > desde ? k - 1 : k; if (hasta === desde || desde < 0 || desde >= l.length) return null;
  const r = mover(l, desde, hasta).map((p) => ({ ...p }));
  if (l.some((p) => p.s)) { const v = r[hasta - 1] || r[hasta + 1]; if (v && v.s) r[hasta].s = v.s; }
  return r;
}

// ---------- la interfaz (como el editor de grabación: vídeo grande, transcripción con lo cortado tachado y una línea de tiempo)
// La línea de tiempo y el reloj son los del MONTAJE: lo que se ve de izquierda a derecha es el vídeo final, en su orden.
export function pintarEditor(m, ctx) {
  const fuentes = ctx.editor.fuentes, F = new Map(fuentes.map((f) => [f.id, f]));
  // El paso Edición: mismo editor con el corte FIJO (el del último vídeo montado, del disco, nunca el del navegador), las pistas de
  // efectos y el panel de efectos en vez del texto.
  const fxM = ctx.modo === "edicion", ED = (fxM && ctx.editor.edicion) || null, edV = (ED && ED.version) || "";
  const base = copiar(ED && Array.isArray(ED.piezas) && ED.piezas.length ? ED.piezas : ctx.editor.piezas), baseFirma = firma(base);
  const regla = ctx.editor.silencio || null, verD = ctx.editor.version || "";
  const K = "6g-edicion.corte.ed.v1:" + ctx.cid + (verD ? ":" + verD : ""), buenoK = fxM ? "6g-edicion.edicion.bueno.v1:" + ctx.cid + (edV ? ":v" + edV : "") : "6g-edicion.corte.bueno.v1:" + ctx.cid + (verD ? ":" + verD : "");
  let lista = copiar(base);
  if (!fxM) try {
    const g = JSON.parse(localStorage.getItem(K));
    if (g && Array.isArray(g.piezas) && g.piezas.length && g.piezas.every((p) => p && F.has(p.f) && isFinite(p.a) && isFinite(p.b) && p.b > p.a)) lista = g.piezas.map((p) => ({ id: String(p.id), f: p.f, a: +p.a, b: +p.b, t: p.t || "", ...(p.s ? { s: String(p.s) } : {}), ...(p.v ? { v: 1 } : {}), ...(p.vel > 1 ? { vel: +p.vel } : {}) }));
  } catch (e) {}
  const VEL = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4], PPM = +ctx.ppm || 0;   // velocidades fijas y, si la persona tiene una, sus palabras por minuto
  let vel = 1; try { const g = +localStorage.getItem("x-corte-vel"); if (g >= .5 && g <= 4) vel = g; } catch (e) {}
  const fv = (x) => String(Math.round(x * 100) / 100).replace(".", ",") + "×";
  let iman = true; try { iman = localStorage.getItem("x-corte-iman") !== "0"; } catch (e) {}
  let verQuitado = true; try { verQuitado = localStorage.getItem("x-corte-quitado") !== "0"; } catch (e) {}
  let hist = [], fut = [], sel = null, cur = 0, enviado = false, armado = 0, zoom = 0, raf = 0, sonando = false, oyeCorte = null;
  let M = [], total = 0, cortes = {}, pps = 4, act = null, arr = null, burbuja = null, fx = null, pistas = null;
  const ondas = {}, pal = {}, V = {}, abiertos = new Set();
  const silDe = (p) => (F.get(p.f) || { silencios: [] }).silencios;
  const saltos = (p) => saltosDe(p, silDe(p), regla);
  const dM = (p) => durMontada(p, silDe(p), regla);
  const cambiado = () => firma(lista) !== baseFirma;
  const esBueno = () => { try { return !!localStorage.getItem(buenoK); } catch (e) { return false; } };
  function guardarLocal() { try { if (cambiado()) localStorage.setItem(K, JSON.stringify({ piezas: lista, ts: Date.now() })); else localStorage.removeItem(K); } catch (e) {} }
  function cambiar(nueva, texto, idCur) {
    if (!nueva || fxM) return;   // en Edición el corte no se toca
    const idAhora = idCur || (lista[cur] && lista[cur].id);
    hist.push(lista); if (hist.length > 100) hist.shift(); fut = []; lista = nueva; enviado = false;
    if (sel && sel.tipo === "pieza" && !lista.some((p) => p.id === sel.id)) sel = null;
    if (sel && sel.tipo === "corte") sel = null;
    const j = lista.findIndex((p) => p.id === idAhora); cur = j >= 0 ? j : Math.min(cur, Math.max(0, lista.length - 1));
    guardarLocal(); refrescar(); if (texto) vivo.textContent = texto;
  }

  // --- esqueleto
  const caja = el("section", "x-cl-t x-lm" + (fxM ? " x-lm-edicion" : "")); caja.tabIndex = -1;
  const cab = el("div", "x-lm-cab"); caja.appendChild(cab);
  const cabI = el("div", "x-lm-cab-i"); cab.appendChild(cabI);
  cabI.appendChild(el("h2", "x-lm-h", fxM ? "Edición" + (edV ? " V" + edV : "") : "Corte"));
  const meta = el("p", "x-lm-meta"); cabI.appendChild(meta);
  if (fxM) {   // si en este navegador el Corte tiene cambios sin enviar, aquí no salen: se avisa en una línea
    let g = null; try { g = JSON.parse(localStorage.getItem("6g-edicion.corte.ed.v1:" + ctx.cid + (verD ? ":" + verD : ""))); } catch (e) {}
    if (g && Array.isArray(g.piezas) && g.piezas.length) cabI.appendChild(el("p", "x-lm-aviso", "El corte tiene cambios sin enviar: aquí ves el último montado" + (edV ? " (V" + edV + ")" : "") + "."));
  }
  const cabD = el("div", "x-lm-cab-d"); cab.appendChild(cabD);
  const boton = (padre, cls, txt, tit) => { const b = el("button", cls, txt); b.type = "button"; if (tit) { b.title = tit; b.setAttribute("aria-label", tit); } padre.appendChild(b); return b; };
  const bUndo = boton(cabD, "x-lm-b x-lm-ico x-lm-solo-movil", "Deshacer", "Deshacer (Cmd + Z)"), bRedo = boton(cabD, "x-lm-b x-lm-ico x-lm-solo-movil", "Rehacer", "Rehacer (Cmd + Mayús + Z)");
  const estado = el("span", "x-lm-estado"); cabD.appendChild(estado);
  // pantalla completa: esconde todo lo que no es el editor (cabecera, título, pasos); se recuerda en este navegador
  const bFull = boton(cabD, "x-lm-b", "Pantalla completa (P)", "Deja solo el editor en la pantalla (tecla P; Esc para salir)");
  let full = false, vigia = null;
  function ponerFull(si) {
    si = !!si; if (si === full) return; full = si;
    document.querySelectorAll("[data-x-lm-fuera]").forEach((x) => x.removeAttribute("data-x-lm-fuera")); document.querySelectorAll("[data-x-lm-anc]").forEach((x) => x.removeAttribute("data-x-lm-anc"));
    if (vigia) { vigia.disconnect(); vigia = null; }
    if (full) {
      for (let n = caja; n && n.parentNode && n !== document.body; n = n.parentNode) {
        if (n !== caja) n.setAttribute("data-x-lm-anc", "");
        [...n.parentNode.children].forEach((x) => { if (x !== n && !/^(SCRIPT|STYLE|LINK)$/.test(x.tagName) && (x.tagName === "HEADER" || x.tagName === "NAV" || getComputedStyle(x).position !== "fixed")) x.setAttribute("data-x-lm-fuera", ""); });
      }
      vigia = new MutationObserver(() => { if (!caja.isConnected) ponerFull(false); }); vigia.observe(document.body, { childList: true, subtree: true });
    }
    document.documentElement.classList.toggle("x-lm-solo", full); caja.classList.toggle("x-lm-full", full);
    bFull.textContent = (full ? "Salir de pantalla completa" : "Pantalla completa") + " (P)"; bFull.setAttribute("aria-pressed", full ? "true" : "false");
    try { localStorage.setItem("x-corte-full", full ? "1" : "0"); } catch (err) {}
    requestAnimationFrame(() => { caja.scrollIntoView({ block: "start" }); pintarPista(); });
  }
  bFull.addEventListener("click", () => ponerFull(!full));
  const bBueno = boton(cabD, "x-lm-b", "Dar por bueno", "Dar el corte por bueno (Cmd + Intro, dos veces)");
  const bEnviar = boton(cabD, "x-lm-b x-lm-rojo x-co-enviar", "Copiar a Claude", "Copia el encargo para pegarlo en tu Claude; solo entonces se monta el vídeo (Cmd + Mayús + E)");
  bEnviar.textContent = "Copiar a Claude (⇧⌘E)";

  const medio = el("div", "x-lm-medio"); caja.appendChild(medio);
  const visor = el("div", "x-lm-visor"); medio.appendChild(visor);
  const pant = el("div", "x-lm-pant"); visor.appendChild(pant);
  const nota = el("p", "x-lm-nota"); nota.hidden = true; pant.appendChild(nota);
  const ctl = el("div", "x-lm-ctl"); visor.appendChild(ctl);
  const bPlay = boton(ctl, "x-lm-play", "▶ (Espacio)", "Reproducir o pausar (barra espaciadora o tecla K)");
  const bM5 = boton(ctl, "x-lm-b", "−5 s (←)", "Atrás 5 segundos (flecha izquierda o tecla J)"), bP5 = boton(ctl, "x-lm-b", "+5 s (→)", "Adelante 5 segundos (flecha derecha o tecla L)");
  const tiempo = el("span", "x-lm-t"); ctl.appendChild(tiempo);
  const bVel = boton(ctl, "x-lm-b x-lm-bvel", fv(vel) + " (S)", "Velocidad: pulsa para cambiarla (tecla S más rápido, Mayús + S más lento)");
  const lado = el("div", "x-lm-lado"); medio.appendChild(lado);
  const tabs = el("div", "x-lm-tabs"); tabs.setAttribute("role", "tablist"); lado.appendChild(tabs);
  const tabTr = boton(tabs, "x-lm-tab", "Texto (T)", "Ver el texto (tecla T)"), tabFb = boton(tabs, "x-lm-tab", "Comentarios", "Ver los comentarios (tecla F)"), tabFx = boton(tabs, "x-lm-tab", "Efectos (E)", "Efectos sobre el vídeo, de tu catálogo (tecla E)");
  if (fxM) tabTr.remove(); else tabFx.remove();   // Texto es del paso Corte; los efectos, del paso Edición
  const tr = el("div", "x-lm-tr"); tr.setAttribute("aria-label", "Transcripción: lo cortado sale tachado"); lado.appendChild(tr);
  const fb = el("div", "x-lm-fb"); fb.hidden = true; lado.appendChild(fb);
  const fxP = el("div", "x-lm-fb x-fx-panel"); fxP.hidden = true; lado.appendChild(fxP);

  const herr = el("div", "x-lm-herr"); caja.appendChild(herr);
  const FLECHA = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 14 4 9l5-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
  const bUndo2 = boton(herr, "x-lm-b x-lm-undo", "", "Deshacer el último cambio (Cmd + Z o Ctrl + Z)"); bUndo2.innerHTML = FLECHA + "<span>Deshacer</span>";
  const bRedo2 = boton(herr, "x-lm-b x-lm-undo x-lm-redo", "", "Rehacer (Cmd + Mayús + Z)"); bRedo2.innerHTML = FLECHA + "<span>Rehacer (⇧⌘Z)</span>";
  const bDividir = boton(herr, "x-lm-b x-lm-bdiv", "Dividir", "Parte el trozo en dos justo donde está el vídeo (Cmd + B o tecla B)");
  const bQuitar = boton(herr, "x-lm-b", "Quitar", "Quita del montaje el trozo elegido (queda cortado: se puede recuperar). Tecla de borrar ⌫, Supr o X");
  const bRecuperar = boton(herr, "x-lm-b x-lm-brec", "Recuperar", "Vuelve a meter en el montaje lo cortado que has elegido (tecla R)");
  bDividir.textContent = "Dividir (B)"; bQuitar.textContent = "Quitar (⌫)"; bRecuperar.textContent = "Recuperar (R)";
  const bRecDesde = boton(herr, "x-lm-b x-lm-rec", "Recuperar desde la aguja", "Devuelve al montaje solo lo que va de la aguja al final de este corte (tecla D)");
  const bRecHasta = boton(herr, "x-lm-b x-lm-rec", "Recuperar hasta la aguja", "Devuelve al montaje solo lo que va del principio de este corte a la aguja (tecla H)");
  bRecDesde.textContent = "Recuperar desde la aguja (D)"; bRecHasta.textContent = "Recuperar hasta la aguja (H)"; bRecDesde.hidden = bRecHasta.hidden = true;
  const herr2 = el("div", "x-lm-herr2"); const info = el("span", "x-lm-info"); info.setAttribute("aria-live", "polite"); herr2.appendChild(info); herr2.appendChild(bRecDesde); herr2.appendChild(bRecHasta); herr.after(herr2);
  const bIman = boton(herr, "x-lm-b x-lm-biman", "Imán (N)", "Con el imán, el borde de un trozo se pega a la aguja al arrastrarlo (tecla N)");
  const pintarIman = () => { bIman.textContent = "Imán: " + (iman ? "sí" : "no") + " (N)"; bIman.setAttribute("aria-pressed", iman ? "true" : "false"); };
  function alternarIman() { iman = !iman; try { localStorage.setItem("x-corte-iman", iman ? "1" : "0"); } catch (err) {} pintarIman(); ctx.aviso(iman ? "Imán activado: el borde se pega a la aguja" : "Imán desactivado"); }
  bIman.addEventListener("click", alternarIman); pintarIman();
  // Ajuste: ver u ocultar en la línea de tiempo lo que se ha quitado (en el texto sigue tachado). Se recuerda en este navegador.
  const bQuitado = boton(herr, "x-lm-b x-lm-bquit", "", "Enseña u oculta en la línea de tiempo los trozos quitados (tecla V)");
  const pintarQuitado = () => { bQuitado.textContent = "Ver lo quitado: " + (verQuitado ? "sí" : "no") + " (V)"; bQuitado.setAttribute("aria-pressed", verQuitado ? "true" : "false"); };
  function alternarQuitado() { verQuitado = !verQuitado; try { localStorage.setItem("x-corte-quitado", verQuitado ? "1" : "0"); } catch (err) {} pintarQuitado(); if (!verQuitado && oyeCorte) { oyeCorte = null; sel = null; } refrescar(); ctx.aviso(verQuitado ? "Lo quitado se ve en gris en la línea de tiempo" : "Lo quitado ya no sale en la línea de tiempo (sigue tachado en el texto)"); }
  bQuitado.addEventListener("click", alternarQuitado); pintarQuitado();
  if (fxM) [bDividir, bQuitar, bRecuperar, bIman, bQuitado, bRecDesde, bRecHasta].forEach((b) => b.remove());   // en Edición el corte no se toca: solo se deshacen efectos
  const zl = el("label", "x-lm-zoom"); zl.appendChild(el("span", "x-lm-zt", "Zoom (− +)")); zl.appendChild(el("span", "", "−")); const zr = document.createElement("input"); zr.type = "range"; zr.min = "0"; zr.max = "100"; zr.value = "0"; zr.setAttribute("aria-label", "Acercar la línea de tiempo"); zr.addEventListener("change", () => zr.blur()); zl.appendChild(zr); zl.appendChild(el("span", "", "+")); herr.appendChild(zl);
  const bAtajos = boton(herr, "x-lm-b x-lm-batajos", "Atajos (?)", "Atajos de teclado (tecla ?)"); herr.insertBefore(bAtajos, zl);

  const marco = el("div", "x-lm-marco"); caja.appendChild(marco);
  const carril = el("div", "x-lm-carril"); marco.appendChild(carril);
  const aguja = el("div", "x-lm-aguja"); carril.appendChild(aguja);
  { const asa = el("div", "x-lm-asa"); asa.title = "Arrastra para mover la aguja"; aguja.appendChild(asa); }
  const ayuda = el("p", "x-lm-ayuda", fxM ? "El corte ya está hecho y aquí no se mueve · pulsa una marca para elegir el efecto · arrastra sus bordes para estirarlo o su centro para moverlo · sobre el vídeo, el elegido se mueve y cambia de tamaño · clic en otro sitio lo suelta · clic derecho para comentar o quitar"
    : "Arrastra un trozo o una parte para cambiar el orden · arrastra un borde para recortar · lo gris está cortado: púlsalo y dale a reproducir para oírlo, o recupéralo");
  if (fxM) carril.classList.add("x-pz-on");
  caja.appendChild(ayuda);
  const pie = el("div", "x-lm-pie"); caja.appendChild(pie);
  const bVolver = boton(pie, "x-lm-enl", "Volver al corte original (O)", "Volver al corte original (tecla O)");
  const det = document.createElement("details"); det.className = "x-lm-montado";
  det.appendChild(el("summary", "", "Ver el vídeo que ya está montado")); const cuerpoDet = el("div", "x-lm-montado-c"); det.appendChild(cuerpoDet); pie.appendChild(det);
  const vivo = el("p", "x-co-vivo"); vivo.setAttribute("aria-live", "polite"); caja.appendChild(vivo);
  m.appendChild(caja);

  // --- los vídeos: uno por grabación (copia ligera), a la vista solo el que suena
  function videoDe(f) {
    if (V[f] !== undefined) return V[f];
    const s = F.get(f); if (!s || !s.ligera) return (V[f] = null);
    const v = document.createElement("video"); v.className = "x-lm-video x-co-video"; v.playsInline = true; v.preload = "auto"; v.dataset.f = f; v.hidden = true; v.src = s.ligera;
    v.setAttribute("aria-label", s.nombre);
    v.addEventListener("click", () => (sonando ? pausa() : play()));
    v.addEventListener("seeked", () => { if (v === act && !sonando) { pintarAguja(); refrescarBarra(); } });
    pant.insertBefore(v, nota); return (V[f] = v);
  }
  function activar(f) {
    const v = videoDe(f);
    Object.values(V).forEach((x) => { if (x && x !== v) { x.pause(); x.hidden = true; } });
    nota.hidden = !!v; if (!v) { nota.textContent = "La grabación " + ((F.get(f) || {}).nombre || f) + " no está en la carpeta del vídeo."; act = null; return Promise.resolve(false); }
    v.hidden = false; act = v;
    if (v.readyState >= 1) return Promise.resolve(true);
    return new Promise((res) => { const ok = () => { v.removeEventListener("error", mal); res(true); }, mal = () => { v.removeEventListener("loadedmetadata", ok); res(false); }; v.addEventListener("loadedmetadata", ok, { once: true }); v.addEventListener("error", mal, { once: true }); });
  }

  // --- reproducción: siempre el montaje (salta lo cortado y los silencios largos, y pasa de un trozo al siguiente)
  const tocar = () => { const p = act && act.play(); if (p && p.catch) p.catch(() => {}); };
  function play() {
    if (!lista.length) return; sonando = true; pintarPlay();
    if (oyeCorte) { if (act && act.dataset.f === oyeCorte.f && act.currentTime >= oyeCorte.b - .06) return trasCorte(oyeCorte); activar(oyeCorte.f).then((ok) => { if (ok && sonando) { tocar(); bucle(); } }); return; }
    if (cur >= lista.length - 1 && act && lista[cur] && act.dataset.f === lista[cur].f && act.currentTime >= lista[cur].b - .08) { cur = 0; if (act.dataset.f === lista[0].f) act.currentTime = lista[0].a; }
    const p = lista[cur];
    activar(p.f).then((ok) => {
      if (!ok || !sonando) { if (!ok) pausa(); return; }
      // la aguja manda: si está justo al final del trozo (o un pelo más allá, tras recortar hasta ella) se sigue con el siguiente; no se vuelve al principio
      if (act.currentTime >= p.b - .05 && act.currentTime <= p.b + .5 && cur + 1 < lista.length) { tocar(); siguiente(); bucle(); return; }
      if (act.currentTime < p.a - .05 || act.currentTime > p.b) act.currentTime = p.a;
      tocar(); bucle();
    });
  }
  // Tras oír algo cortado, el montaje sigue por el trozo que viene detrás de ese corte (sin parar).
  function trasCorte(c) {
    let i = lista.findIndex((p) => p.f === c.f && Math.abs(p.a - c.b) < .08);
    if (i < 0) { const j = lista.findIndex((p) => p.f === c.f && Math.abs(p.b - c.a) < .08); if (j >= 0) i = j + 1; }
    if (i < 0) { const k = ordenCrono(lista, fuentes).find((p) => p.f === c.f && p.a >= c.b - .08); i = k ? lista.indexOf(k) : -1; }
    if (i < 0 || i >= lista.length) { oyeCorte = null; sel = null; pausa(); marcar(); return; }
    sel = null; irA(i, lista[i].a, true);
  }
  function pausa() { sonando = false; cancelAnimationFrame(raf); Object.values(V).forEach((x) => x && x.pause()); pintarPlay(); pintarAguja(); refrescarBarra(); }
  function siguiente() {
    const p = lista[cur];
    if (cur + 1 >= lista.length) { pausa(); return; }
    cur++; const n = lista[cur];
    if (n.f === p.f) { if (Math.abs(n.a - p.b) > .05) act.currentTime = n.a; }
    else { act.pause(); activar(n.f).then((ok) => { if (!ok) return pausa(); act.currentTime = n.a; if (sonando) tocar(); }); }
    marcar();
  }
  function bucle() {
    cancelAnimationFrame(raf);
    const paso = () => {
      if (!caja.isConnected) { Object.values(V).forEach((x) => x && x.pause()); return; }
      if (!sonando) return;
      const v = act;
      if (v && oyeCorte) { if (v.playbackRate !== vel) v.playbackRate = vel; if (v.currentTime >= oyeCorte.b - .03) { trasCorte(oyeCorte); return; } }
      else if (v) {
        const p = lista[cur]; if (!p) { pausa(); return; }
        if (v.dataset.f === p.f && !v.seeking) {
          const t = v.currentTime, sl = saltos(p).find(([x, y]) => t >= x && t < y - .02), q = p.vel > 1 ? Math.min(16, p.vel * vel) : vel;
          if (v.playbackRate !== q) v.playbackRate = q;
          if (sl) v.currentTime = sl[1];
          else if (t >= p.b - .04) siguiente();
          else if (t < p.a - .3) v.currentTime = p.a;
        }
      }
      pintarAguja(); raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
  }
  // Va al segundo `t` de la grabación dentro del trozo `i` del montaje.
  function irA(i, t, tocarYa) {
    if (i < 0 || i >= lista.length) return Promise.resolve();
    oyeCorte = null; cur = i; const p = lista[i];
    return activar(p.f).then((ok) => { if (!ok) return; act.currentTime = Math.max(p.a, Math.min(p.b - .02, t == null ? p.a : t)); if (tocarYa) sonando = true; if (sonando) { tocar(); bucle(); } pintarPlay(); marcar(); pintarAguja(); refrescarBarra(); });
  }
  function oirCorte(c, t) {
    if (sonando) pausa(); oyeCorte = c; sel = { tipo: "corte", ...c };
    activar(c.f).then((ok) => { if (!ok) return; act.currentTime = t == null ? c.a : Math.max(c.a, Math.min(c.b - .1, t)); pintarPlay(); marcar(); pintarAguja(); refrescarBarra(); });
  }
  // Mover la aguja a mano (pulsar un trozo, una parte, una palabra o una nota) deja el vídeo en pausa: se oye al dar a reproducir.
  const irPausa = (i, t) => { if (sonando) pausa(); return irA(i, t); };
  const tMont = () => { const p = lista[cur]; if (!p || !M[cur]) return 0; return M[cur].t0 + (act && act.dataset.f === p.f ? aMontaje(p, act.currentTime, saltos(p)) : 0); };
  function irMontaje(T) {
    T = Math.max(0, Math.min(total - .05, T));
    let i = M.findIndex((x) => T < x.t0 + x.d); if (i < 0) i = M.length - 1;
    return irA(i, deMontaje(lista[i], T - M[i].t0, saltos(lista[i])));
  }
  bPlay.addEventListener("click", () => (sonando ? pausa() : play()));
  bM5.addEventListener("click", () => irMontaje(tMont() - 5)); bP5.addEventListener("click", () => irMontaje(tMont() + 5));
  // --- ventanitas (velocidad y atajos): se abren bajo su botón y se cierran al pulsar fuera
  function emergente(b, pintar) {
    let pop = null;
    const fuera = (ev) => { if (pop && !pop.contains(ev.target) && !b.contains(ev.target)) cerrar(); };
    function cerrar() { if (!pop) return; pop.remove(); pop = null; b.setAttribute("aria-expanded", "false"); document.removeEventListener("pointerdown", fuera, true); }
    function abrir() {
      if (pop) return cerrar();
      pop = el("div", "x-lm-pop"); pintar(pop); caja.appendChild(pop); b.setAttribute("aria-expanded", "true");
      const r = b.getBoundingClientRect(), c = caja.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.max(0, Math.min(c.width - w, r.right - c.left - w)) + "px";
      pop.style.top = (r.bottom + 8 + h > innerHeight && r.top - 8 - h > 0 ? r.top - c.top - h - 8 : r.bottom - c.top + 8) + "px";
      document.addEventListener("pointerdown", fuera, true);
    }
    b.addEventListener("click", abrir);
    return { abrir, cerrar, repintar: () => { if (pop) { pop.textContent = ""; pintar(pop); } } };
  }
  // palabras por minuto de lo hablado en el montaje (sin los trozos a cámara rápida) y el múltiplo que lo deja en PPM
  function ritmo() {
    let n = 0, d = 0;
    lista.forEach((p, i) => { const W = pal[p.f]; if (p.vel > 1 || !W || !M[i]) return; n += W.filter((w) => w[0] >= p.a - .05 && w[0] < p.b).length; d += M[i].d; });
    return d > 20 && n > 20 ? n / (d / 60) : 0;
  }
  function ponerVel(x) {
    vel = Math.max(.5, Math.min(4, Math.round(x * 100) / 100)); bVel.textContent = fv(vel) + " (S)"; try { localStorage.setItem("x-corte-vel", vel); } catch (e) {}
    if (act && !oyeCorte && lista[cur] && lista[cur].vel > 1) act.playbackRate = Math.min(16, lista[cur].vel * vel); else if (act) act.playbackRate = vel;
    popVel.repintar(); vivo.textContent = "Velocidad " + fv(vel);
  }
  const popVel = emergente(bVel, (pop) => {
    const r = PPM ? ritmo() : 0, mult = r ? Math.max(.5, Math.min(4, Math.round((PPM / r) * 100) / 100)) : 0;
    pop.classList.add("x-lm-pvel");
    const c = el("div", "x-lm-pv-c"); c.appendChild(el("b", "", "Velocidad")); c.appendChild(el("span", "x-lm-pv-n", fv(vel))); pop.appendChild(c);
    const rg = document.createElement("input"); rg.type = "range"; rg.min = ".5"; rg.max = "4"; rg.step = ".05"; rg.value = String(vel); rg.setAttribute("aria-label", "Velocidad del vídeo"); pop.appendChild(rg);
    rg.addEventListener("input", () => { vel = +rg.value; c.lastChild.textContent = fv(vel); bVel.textContent = fv(vel) + " (S)"; if (act) act.playbackRate = lista[cur] && lista[cur].vel > 1 && !oyeCorte ? Math.min(16, lista[cur].vel * vel) : vel; });
    rg.addEventListener("change", () => ponerVel(+rg.value));
    const fila = el("div", "x-lm-pv-f"); pop.appendChild(fila);
    VEL.forEach((x) => { const b = boton(fila, "x-lm-b" + (Math.abs(vel - x) < .005 ? " x-lm-on" : ""), fv(x)); b.addEventListener("click", () => ponerVel(x)); });
    if (mult) {
      const b = boton(pop, "x-lm-b x-lm-ppm" + (Math.abs(vel - mult) < .005 ? " x-lm-on" : ""), "", "El múltiplo que deja el vídeo en " + PPM + " palabras por minuto");
      b.innerHTML = "<b>" + fv(mult) + "</b><span>para ir a " + PPM + " palabras por minuto</span>"; b.addEventListener("click", () => ponerVel(mult));
      pop.appendChild(el("p", "x-lm-pv-p", "Ahora hablas a " + Math.round(r) + " palabras por minuto. A " + fv(vel) + " queda en " + Math.round(r * vel) + "."));
    }
  });
  // Los atajos son los de CapCut de escritorio donde hay equivalente; lo que CapCut no tiene (recuperar, notas, pestañas) lleva letra propia.
  const ATAJOS = [["Espacio", "Reproducir o pausar"], ["← →", "5 s atrás o adelante (también J y L)"], ["Mayús + ← →", "Un fotograma atrás o adelante"], ["↑ ↓", "Corte anterior o siguiente (trozo)"], ["Inicio · Fin", "Ir al principio o al final"],
    ["Cmd + B (o B)", "Dividir donde está la aguja"], ["Q", "Quitar lo que queda a la izquierda de la aguja en el trozo"], ["W", "Quitar lo que queda a la derecha de la aguja en el trozo"], ["⌫ (borrar), Supr o X", "Quitar el trozo elegido o, si no hay ninguno elegido, el de la aguja"],
    ["P", "Pantalla completa: solo el editor (Esc para salir)"], ["E", "Ir al paso Edición (efectos sobre el vídeo)"], ["1 a 9", "Añadir un efecto en la aguja (en el paso Edición)"], ["[ ]", "El efecto elegido empieza o acaba en la aguja"], ["Clic derecho", "Menú del trozo o del corte: quitar, dividir, recuperar, mover"], ["Alt + ← →", "Mover el trozo elegido antes o después"], ["Alt + ↑ ↓", "Subir o bajar la parte entera"], ["Cmd + Z", "Deshacer (con Mayús, rehacer)"],
    ["Cmd + + · Cmd + −", "Acercar o alejar la línea de tiempo (también + y − solos)"], ["Mayús + Z", "Ver la línea de tiempo entera"], ["Cmd + rueda", "Acercar con el ratón (o pellizcando)"],
    ["N", "Activar o desactivar el imán de la aguja"], ["V", "Ver u ocultar lo quitado en la línea de tiempo"], ["S", "Más rápido (con Mayús, más lento)"], ["Cmd + Mayús + E", "Enviar o copiar a Claude"],
    ["R", "Recuperar entero el corte elegido"], ["D", "Recuperar desde la aguja (con la aguja dentro de algo cortado)"], ["H", "Recuperar hasta la aguja"],
    ["M", "Comentario en el minuto de la aguja"], ["T · F", "Ver el texto o los comentarios"], ["Cmd + Intro", "Dar por bueno (dos veces para confirmar)"], ["O", "Volver al corte original"],
    ["Arrastrar la aguja", "Mover el punto del vídeo, también dentro de lo cortado"], ["Esc", "Cancelar un arrastre"], ["?", "Abrir o cerrar esta lista"]];
  if (fxM) ATAJOS.splice(0, ATAJOS.length, ["Espacio", "Reproducir o pausar"], ["← →", "5 s atrás o adelante (también J y L)"], ["Mayús + ← →", "Un fotograma atrás o adelante"], ["↑ ↓", "Trozo anterior o siguiente"], ["Inicio · Fin", "Ir al principio o al final"],
    ["1 a 9", "Añadir aquí el efecto de tu catálogo con ese número"], ["[ ]", "El efecto elegido empieza o acaba en la aguja"], ["C", "Comentar el efecto elegido (Enter guarda)"], ["⌫ (borrar) o Supr", "Quitar el efecto elegido"], ["Clic derecho en una marca", "Ir, empezar o acabar en la aguja, comentar, quitar"],
    ["Arrastrar el elegido sobre el vídeo", "Moverlo (por el centro) o cambiar su tamaño (por sus esquinas y bordes)"], ["Clic fuera del elegido", "Soltarlo (también solo, al salir de su tramo reproduciendo)"],
    ["Cmd + Z · Cmd + Mayús + Z", "Deshacer o rehacer un cambio de efectos"], ["Esc", "Cancelar el marcado o soltar el elegido"], ["Cmd + + · Cmd + −", "Acercar o alejar la línea de tiempo (también + y − solos)"], ["Mayús + Z", "Ver la línea de tiempo entera"],
    ["S", "Más rápido (con Mayús, más lento)"], ["M", "Comentario en el minuto de la aguja"], ["E · F", "Ver los efectos o los comentarios"], ["T", "Volver al paso Corte"], ["P", "Pantalla completa: solo el editor"],
    ["Cmd + Mayús + E", "Enviar o copiar a Claude"], ["Cmd + Intro", "Dar por buena (dos veces para confirmar)"], ["?", "Abrir o cerrar esta lista"]);
  const popAtajos = emergente(bAtajos, (pop) => {
    pop.classList.add("x-lm-pat"); pop.appendChild(el("b", "", "Atajos de teclado"));
    const dl = el("dl", ""); ATAJOS.forEach(([k, t]) => { dl.appendChild(el("dt", "", k)); dl.appendChild(el("dd", "", t)); }); pop.appendChild(dl);
  });
  function ponerZoom(z) {
    z = Math.max(0, Math.min(100, Math.round(z))); if (z === zoom) return; zoom = z; zr.value = String(z); pintarPista();
    requestAnimationFrame(() => requestAnimationFrame(() => { const m = /(-?[\d.]+)px/.exec(aguja.style.transform || ""); if (m) marco.scrollLeft = Math.max(0, +m[1] - marco.clientWidth / 2); }));
  }
  marco.addEventListener("wheel", (e) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); ponerZoom(zoom - Math.sign(e.deltaY) * 5); }, { passive: false });
  function pintarPlay() { bPlay.textContent = (sonando ? "❚❚" : "▶") + " (Espacio)"; bPlay.setAttribute("aria-label", sonando ? "Pausa" : "Reproducir"); }

  // --- la línea de tiempo: partes (arriba) y, debajo, sus trozos con la onda; lo cortado, en gris rayado
  const elBl = new Map();
  function onda(cv, f, a, b, sl, vel, color) {
    const w = Math.max(1, cv.clientWidth || parseFloat(cv.style.width) || 1), h = 64, dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const O = ondas[f]; g.fillStyle = color;
    if (!O || !O.v) { g.fillRect(0, h / 2 - .5, w, 1); return; }
    const dt = O.dt || .25, pz = { a, b, vel }, dur = durMontada(pz, null, null) - (sl || []).reduce((s, [x, y]) => s + (y - x), 0) / (vel > 1 ? vel : 1), paso = 3;
    for (let x = 0; x < w; x += paso) {
      const t0 = deMontaje(pz, (x / w) * dur, sl), t1 = deMontaje(pz, ((x + paso) / w) * dur, sl);
      let mx = 0; for (let i = Math.floor(t0 / dt), n = Math.max(i, Math.floor(t1 / dt)); i <= n; i++) mx = Math.max(mx, O.v[i] || 0);
      const alto = Math.max(1.5, (mx / 99) * (h - 14));
      g.beginPath(); if (g.roundRect) g.roundRect(x, (h - alto) / 2, 2, alto, 1); else g.rect(x, (h - alto) / 2, 2, alto); g.fill();
    }
  }
  // miniaturas del vídeo dentro del trozo (como grabación): una cada ~128 px, la del segundo que cae en su centro
  const fuenteDe = (f) => fuentes.find((x) => x.id === f);
  function minis(capa, p, sl, ancho) {
    const F = fuenteDe(p.f), m = F && F.minis; capa.textContent = "";
    if (!m) return;
    const alto = 72, tw = alto * m.w / m.h, n = Math.max(1, Math.ceil(ancho / tw)), pz = { a: p.a, b: p.b, vel: p.vel };
    const dur = durMontada(pz, null, null) - (sl || []).reduce((s, [x, y]) => s + (y - x), 0) / (p.vel > 1 ? p.vel : 1);
    const tope = Math.max(0, Math.floor((F.dur || p.b) / m.dt));
    for (let k = 0; k < n; k++) {
      const t = deMontaje(pz, Math.min(1, ((k + .5) * tw) / Math.max(1, ancho)) * dur, sl), i = Math.min(tope, Math.max(0, Math.round(t / m.dt)));
      const d = document.createElement("i"); d.style.width = tw + "px";
      d.style.backgroundImage = "url(" + m.url + ")"; d.style.backgroundSize = (m.cols * tw) + "px auto";
      d.style.backgroundPosition = (-(i % m.cols) * tw) + "px " + (-Math.floor(i / m.cols) * alto) + "px";
      capa.appendChild(d);
    }
  }
  const STUB = 5, HUECO = 3, HUECO_P = 14, CAP_CT = 15;   // lo cortado sale COMPLETO, a su tamaño (como en grabación); un corte de más de 15 s se pinta como 15 s y lleva su duración escrita
  const enPista = (c) => (fxM || !verQuitado ? null : c || null);   // en Edición no salen los huecos de lo cortado; en Corte, según el ajuste
  const anchoCt = (c) => Math.max(STUB, Math.min(CAP_CT, c[1] - c[0]) * pps);
  function pintarPista() {
    [...carril.children].forEach((x) => { if (x !== aguja) x.remove(); }); elBl.clear();
    const P = partesDe(lista), por = new Map(lista.map((p, i) => [p.id, i]));
    let nStub = 0, visCt = 0; if (!fxM) lista.forEach((p) => { const c = cortes[p.id]; if (c) [c.antes, c.despues].forEach((x) => { if (x) { nStub++; visCt += Math.min(CAP_CT, x[1] - x[0]); } }); });
    const W = Math.max(320, marco.clientWidth - 28); const fijo = nStub * HUECO + lista.length * HUECO + P.length * HUECO_P + (fxM ? 76 : 0);
    pps = Math.max(.4, (W - fijo) / Math.max(1, total + visCt)) * (1 + (zoom / 100) * 11);
    P.forEach((x, pi) => {
      const g = el("div", "x-lm-grupo"); g.dataset.i = pi;
      const d = x.ids.reduce((s, id) => s + M[por.get(id)].d, 0);
      const chip = el("div", "x-lm-chip"); chip.title = (x.s || "Todo el vídeo") + " · " + fmt(d) + " · arrástrala para moverla entera";
      chip.innerHTML = '<b>' + (pi + 1) + '</b><span>' + esc(x.s || "Todo el vídeo") + '</span><i>' + fmt(d) + "</i>";
      g.appendChild(chip);
      const fila = el("div", "x-lm-fila"); g.appendChild(fila);
      x.ids.forEach((id) => {
        const i = por.get(id), p = lista[i], c = cortes[id] || {};
        if (enPista(c.antes)) fila.appendChild(stub(p.f, c.antes));
        const b = el("div", "x-lm-bl" + (p.v ? " x-lm-pant-b" : "")); b.dataset.id = id; b.style.width = Math.max(10, M[i].d * pps) + "px";
        b.title = "Trozo " + (i + 1) + " · " + fmt(M[i].d) + (p.t ? " · " + p.t : "");
        const cv = document.createElement("canvas"); cv.className = "x-lm-cv"; b.appendChild(cv);
        const mn = el("div", "x-lm-min"); b.appendChild(mn); minis(mn, p, saltos(p), Math.max(10, M[i].d * pps));
        if (p.vel > 1) b.appendChild(el("span", "x-lm-etq", "×" + p.vel));
        if (!fxM) { b.appendChild(el("i", "x-lm-borde x-lm-borde-a")); b.appendChild(el("i", "x-lm-borde x-lm-borde-b")); }
        fila.appendChild(b); elBl.set(id, b);
        if (enPista(c.despues)) fila.appendChild(stub(p.f, c.despues));
      });
      carril.appendChild(g);
    });
    carril.appendChild(aguja);
    requestAnimationFrame(() => {
      lista.forEach((p) => { const b = elBl.get(p.id); if (b) onda(b.firstChild, p.f, p.a, p.b, saltos(p), p.vel, "#fff"); });
      carril.querySelectorAll(".x-lm-ct").forEach((c) => onda(c.firstChild, c.dataset.f, +c.dataset.a, +c.dataset.b, [], 1, "#8b9099"));
      marcar(); pintarAguja(); if (pistas) pistas.pintar();
    });
  }
  function stub(f, [a, b]) {
    const s = el("button", "x-lm-ct"); s.type = "button"; s.dataset.f = f; s.dataset.a = a; s.dataset.b = b;
    const w = anchoCt([a, b]), largo = b - a > CAP_CT; s.style.width = w + "px";
    const cv = document.createElement("canvas"); cv.className = "x-lm-cv"; s.appendChild(cv);
    if (w >= 24) { const mn = el("div", "x-lm-min"); s.appendChild(mn); minis(mn, { f, a, b: largo ? a + CAP_CT : b, vel: 1 }, [], w); }   // lo cortado se ve como el trozo que era, apagado
    if (largo) s.classList.add("x-lm-ct-largo");
    if (largo || w > 64) s.appendChild(el("span", "x-lm-ct-d", (w > 130 ? "cortado · " : "") + fmt(b - a)));
    s.title = "Cortado · " + fmt(b - a) + " · púlsalo y dale a reproducir para oírlo; «Recuperar» lo devuelve"; s.setAttribute("aria-label", s.title);
    return s;
  }
  const izq = (e) => e.getBoundingClientRect().left - carril.getBoundingClientRect().left;   // posición dentro del carril (offsetLeft ya es relativo al carril: sumarlo por niveles lo contaba dos veces)
  function pintarAguja() {
    let x = null;
    if (oyeCorte) { const s = [...carril.querySelectorAll(".x-lm-ct")].find((e) => e.dataset.f === oyeCorte.f && Math.abs(+e.dataset.a - oyeCorte.a) < .01); if (s && act) x = izq(s) + s.offsetWidth * Math.max(0, Math.min(1, (act.currentTime - oyeCorte.a) / (oyeCorte.b - oyeCorte.a))); }
    else { const p = lista[cur], b = p && elBl.get(p.id); if (b) { const fr = M[cur].d ? (act && act.dataset.f === p.f ? aMontaje(p, act.currentTime, saltos(p)) : 0) / M[cur].d : 0; x = izq(b) + b.offsetWidth * Math.max(0, Math.min(1, fr)); } }
    aguja.hidden = x == null; if (x != null) { aguja.style.transform = "translateX(" + x + "px)"; if (sonando && !arr && (x < marco.scrollLeft + 10 || x > marco.scrollLeft + marco.clientWidth - 40)) marco.scrollLeft = Math.max(0, x - 60); }
    tiempo.textContent = (oyeCorte ? "cortado" : fmt(tMont())) + " / " + fmt(total);
    if (!fb.hidden) bNota.lastChild.textContent = "Nota en " + (oyeCorte ? "lo cortado" : fmt(tMont())) + " (M)";
    if (sonando) marcar();
    if (fx) fx.tick();
    if (pistas) pistas.tick();
  }
  let ultSuena = null;
  function marcar() {
    const p = oyeCorte ? null : lista[cur];
    elBl.forEach((b, id) => { b.classList.toggle("x-lm-suena", !!p && p.id === id); b.classList.toggle("x-lm-sel", !fxM && !!sel && sel.tipo === "pieza" && sel.id === id); });
    carril.querySelectorAll(".x-lm-ct").forEach((s) => s.classList.toggle("x-lm-sel", !!sel && sel.tipo === "corte" && sel.f === s.dataset.f && Math.abs(sel.a - s.dataset.a) < .01));
    tr.querySelectorAll(".x-lm-pz").forEach((r) => { r.classList.toggle("x-lm-suena", !!p && p.id === r.dataset.id); r.classList.toggle("x-lm-sel", !!sel && sel.tipo === "pieza" && sel.id === r.dataset.id); });
    tr.querySelectorAll(".x-lm-cut").forEach((s) => s.classList.toggle("x-lm-sel", !!sel && sel.tipo === "corte" && sel.f === s.dataset.f && Math.abs(sel.a - s.dataset.a) < .01));
    const idS = p ? p.id : null;
    if (idS !== ultSuena) { ultSuena = idS; const r = idS && tr.querySelector('.x-lm-pz[data-id="' + idS + '"]'); if (r && !arr) { const a = r.offsetTop - tr.offsetTop, h = tr.clientHeight; if (a < tr.scrollTop + 8 || a + r.offsetHeight > tr.scrollTop + h - 8) tr.scrollTop = Math.max(0, a - h / 3); } }
  }
  zr.addEventListener("input", () => { zoom = +zr.value; pintarPista(); });   // con teclas: + − 0 (ponerZoom)
  let reT = 0; addEventListener("resize", () => { clearTimeout(reT); reT = setTimeout(() => { if (caja.isConnected) pintarPista(); }, 120); });

  // --- arrastrar para cambiar el orden (un trozo, o una parte entera): la caja se inclina y sigue al cursor, y las demás se apartan en vivo
  function arrastre(e, o) {
    let activo = false, k = o.de, px = e.clientX, py = e.clientY, rf = 0, fant = null, E = [], R = [], s0 = 0, dx = 0, dy = 0;
    const x0 = px, y0 = py, timer = setTimeout(empezar, 350), X = o.eje === "x";
    const desp = () => (o.cont ? (X ? o.cont.scrollLeft : o.cont.scrollTop) : 0);
    function empezar() {
      if (activo) return; activo = true; arr = o; clearTimeout(timer); if (o.antes) o.antes();
      try { getSelection().removeAllRanges(); } catch (err) {}
      document.body.classList.add("x-lm-arr"); E = o.els(); const yo = E[o.de]; if (!yo) return;
      s0 = desp(); R = E.map((x) => { const r = x.getBoundingClientRect(); return X ? [r.left, r.right] : [r.top, r.bottom]; });
      // la caja que se lleva: una copia inclinada que sigue al cursor (como en la hoja de distracciones)
      const r = yo.getBoundingClientRect(), w = Math.min(r.width, 420), h = Math.min(r.height, 200);
      fant = yo.cloneNode(true); fant.classList.remove("x-lm-sel", "x-lm-suena"); fant.classList.add("x-lm-fant"); fant.removeAttribute("title");
      const c0 = yo.querySelectorAll("canvas"), c1 = fant.querySelectorAll("canvas");
      c0.forEach((c, i) => { try { c1[i].width = c.width; c1[i].height = c.height; c1[i].getContext("2d").drawImage(c, 0, 0); } catch (err) {} });
      Object.assign(fant.style, { width: w + "px", height: h + "px", transform: "" });
      dx = Math.max(8, Math.min(px - r.left, w - 8)); dy = Math.max(8, Math.min(py - r.top, h - 8));
      caja.appendChild(fant); yo.classList.add("x-lm-ag"); E.forEach((x) => x.classList.add("x-lm-desliza"));
      try { navigator.vibrate && navigator.vibrate(15); } catch (err) {}
      vivo.textContent = o.etiqueta + ": suelta donde quieras que quede. Escape cancela."; colocar(); rf = requestAnimationFrame(auto);
    }
    // las demás se apartan en vivo y dejan el hueco donde va a caer
    function colocar() {
      if (!activo || !fant) return;
      fant.style.left = (px - dx) + "px"; fant.style.top = (py - dy) + "px";
      const pos = (X ? px : py) + desp() - s0, de = o.de; k = 0;
      R.forEach(([a, b], i) => { if (pos > (a + b) / 2) k = i + 1; });
      const h = k > de ? k - 1 : k, tam = R[de][1] - R[de][0] + (X ? 3 : 0);
      E.forEach((x, i) => {
        let d = 0;
        if (i === de) d = h > de ? R[h][1] - R[de][1] : h < de ? R[h][0] - R[de][0] : 0;
        else if (de < i && i <= h) d = -tam; else if (h <= i && i < de) d = tam;
        x.style.transform = d ? (X ? "translateX(" : "translateY(") + Math.round(d) + "px)" : "";
      });
    }
    function auto() {
      if (!activo) return; const c = o.cont;
      if (c) { const r = c.getBoundingClientRect(); if (X) { if (px < r.left + 70) c.scrollLeft -= 16; else if (px > r.right - 70) c.scrollLeft += 16; } else { if (py < r.top + 50) c.scrollTop -= 12; else if (py > r.bottom - 50) c.scrollTop += 12; } colocar(); }
      rf = requestAnimationFrame(auto);
    }
    const mv = (ev) => { px = ev.clientX; py = ev.clientY; if (!activo) { if (Math.hypot(px - x0, py - y0) > 6) empezar(); return; } ev.preventDefault(); colocar(); };
    const tecla = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); fin(true); } };
    const arriba = () => fin(false), cancel = () => fin(true);
    function fin(cancelado) {
      clearTimeout(timer); cancelAnimationFrame(rf);
      document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", arriba, true); document.removeEventListener("pointercancel", cancel, true); document.removeEventListener("keydown", tecla, true);
      if (!activo) { if (!cancelado && o.clic) o.clic(); return; }
      arr = null; document.body.classList.remove("x-lm-arr"); if (fant) fant.remove();
      E.forEach((x) => { x.classList.remove("x-lm-ag", "x-lm-desliza"); x.style.transform = ""; });
      if (o.despues) o.despues();
      if (cancelado) { vivo.textContent = "Movimiento cancelado"; return; }
      o.soltar(k);
    }
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", arriba, true); document.addEventListener("pointercancel", cancel, true); document.addEventListener("keydown", tecla, true);
  }
  const velEncargo = () => { const r = PPM ? ritmo() : 0; if (Math.abs(vel - 1) < .005 && !r) return ""; return "VELOCIDAD: lo he revisado en el editor a " + fv(vel) + (r ? ". Hablo a " + Math.round(r) + " palabras por minuto; el múltiplo para " + PPM + " es " + fv(PPM / r) + "." : "."); };
  const moverP = (de, k) => { const h = k > de ? k - 1 : k; if (h !== de) cambiar(moverParte(lista, de, h), "Parte movida a la posición " + (h + 1)); else vivo.textContent = "La parte se queda donde estaba"; };
  carril.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const borde = e.target.closest(".x-lm-borde"), bl = e.target.closest(".x-lm-bl"), ct = e.target.closest(".x-lm-ct"), chip = e.target.closest(".x-lm-chip");
    if (e.target.closest(".x-lm-asa")) { e.preventDefault(); return frotar(e); }
    if (fxM) {   // en Edición los trozos no se arrastran ni se recortan: pulsar uno solo mueve la aguja
      if (bl) { e.preventDefault(); const i = lista.findIndex((p) => p.id === bl.dataset.id), p = lista[i], r = bl.getBoundingClientRect(); irPausa(i, deMontaje(p, ((e.clientX - r.left) / r.width) * M[i].d, saltos(p))); }
      else if (chip) { e.preventDefault(); const P = partesDe(lista), de = +chip.parentNode.dataset.i, i = lista.findIndex((p) => p.id === P[de].ids[0]); if (i >= 0) irPausa(i); }
      return;
    }
    if (ct) return;
    if (borde && bl) { e.preventDefault(); return recortar(e, bl, borde.classList.contains("x-lm-borde-a") ? "a" : "b"); }
    if (bl) {
      e.preventDefault(); const i = lista.findIndex((p) => p.id === bl.dataset.id), p = lista[i], r = bl.getBoundingClientRect(), fr = (e.clientX - r.left) / r.width;
      return arrastre(e, { eje: "x", de: i, cont: marco, etiqueta: "Trozo " + (i + 1) + (p.t ? " · " + p.t.slice(0, 40) : ""), els: () => lista.map((x) => elBl.get(x.id)),
        clic: () => { sel = { tipo: "pieza", id: p.id }; irPausa(i, deMontaje(p, fr * M[i].d, saltos(p))); },
        soltar: (k) => { const n = moverPieza(lista, i, k); if (n) { sel = { tipo: "pieza", id: p.id }; cambiar(n, "Trozo movido a la posición " + ((k > i ? k - 1 : k) + 1) + " de " + lista.length, p.id); } } });
    }
    if (chip) {
      e.preventDefault(); const g = chip.parentNode, de = +g.dataset.i, P = partesDe(lista);
      return arrastre(e, { eje: "x", de, cont: marco, etiqueta: "Parte " + (de + 1) + " · " + (P[de].s || "sin nombre"), els: () => [...carril.querySelectorAll(".x-lm-grupo")],
        clic: () => { const i = lista.findIndex((p) => p.id === P[de].ids[0]); sel = { tipo: "pieza", id: lista[i].id }; irPausa(i); }, soltar: (k) => moverP(de, k) });
    }
  });
  carril.addEventListener("click", (e) => {
    const ct = e.target.closest(".x-lm-ct"); if (!ct) return;
    const r = ct.getBoundingClientRect(), a = +ct.dataset.a, b = +ct.dataset.b;
    oirCorte({ f: ct.dataset.f, a, b }, a + (b - a) * Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))));
  });
  // arrastrar la aguja: recorre trozos y cortes, en pausa; se queda donde se suelta
  function frotar(e) {
    if (sonando) pausa(); aguja.classList.add("x-lm-coge"); let pend = null, ocupado = false, movido = false;
    const ir = async (x) => {
      let best = null, bd = 1e9;
      for (const q of carril.querySelectorAll(".x-lm-bl,.x-lm-ct")) { const c = q.getBoundingClientRect(); if (!c.width) continue; const d = x < c.left ? c.left - x : x > c.right ? x - c.right : 0; if (d < bd) { bd = d; best = q; } if (!d) break; }
      if (!best) return;
      const c = best.getBoundingClientRect(), fr = Math.max(0, Math.min(1, (x - c.left) / Math.max(1, c.width)));
      if (best.classList.contains("x-lm-bl")) { const i = lista.findIndex((p) => p.id === best.dataset.id); if (i < 0) return; sel = { tipo: "pieza", id: lista[i].id }; await irA(i, deMontaje(lista[i], fr * M[i].d, saltos(lista[i]))); }
      else { const k = { f: best.dataset.f, a: +best.dataset.a, b: +best.dataset.b }; oyeCorte = k; sel = { tipo: "corte", ...k }; if (await activar(k.f)) { act.currentTime = Math.min(k.b - .02, k.a + (k.b - k.a) * fr); marcar(); pintarAguja(); refrescarBarra(); } }
    };
    const bombea = async () => { if (ocupado) return; ocupado = true; while (pend != null) { const x = pend; pend = null; await ir(x); } ocupado = false; };
    const mv = (ev) => { ev.preventDefault(); if (!movido && Math.abs(ev.clientX - e.clientX) < 2) return; movido = true; pend = ev.clientX; bombea(); };
    const fin = () => { document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", fin, true); document.removeEventListener("pointercancel", fin, true); aguja.classList.remove("x-lm-coge"); pintarAguja(); refrescarBarra(); };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", fin, true); document.addEventListener("pointercancel", fin, true);
  }
  // recortar: arrastrar el borde de un trozo (no puede pisar al vecino de su mismo grabación)
  function recortar(e, bl, lado) {
    const i = lista.findIndex((p) => p.id === bl.dataset.id), p = lista[i], lim = limitesPieza(lista, p.id, F.get(p.f).dur), x0 = e.clientX, velP = p.vel > 1 ? p.vel : 1;
    if (sonando) pausa();
    // la aguja NO se mueve: es la referencia. Si está en este mismo grabación, el borde se pega a ella al acercarse (imán)
    const tA = act && act.dataset.f === p.f ? r2(act.currentTime) : null, IMAN = 14;
    let n = { ...p }, movido = false, pegado = false; sel = { tipo: "pieza", id: p.id }; marcar(); bl.classList.add("x-lm-recorta");
    // lo que se quita del trozo crece como corte a su lado (y al revés), para que el resto de la línea no se mueva
    const w0 = bl.offsetWidth; let ct = lado === "a" ? bl.previousElementSibling : bl.nextElementSibling, ctW0 = 0, ctNuevo = false;
    if (ct && ct.classList.contains("x-lm-ct")) ctW0 = ct.offsetWidth;
    else { ct = el("button", "x-lm-ct"); ct.type = "button"; ct.style.width = "0px"; ct.style.marginLeft = ct.style.marginRight = "-1.5px"; bl.parentNode.insertBefore(ct, lado === "a" ? bl : bl.nextSibling); ctNuevo = true; }
    const mv = (ev) => {
      movido = true; const dt = ((ev.clientX - x0) / pps) * velP, umbral = (IMAN / pps) * velP;
      let v = lado === "a" ? p.a + dt : p.b + dt; const antes = pegado;
      pegado = iman && tA != null && Math.abs(v - tA) <= umbral && (lado === "a" ? tA >= lim.minA && tA <= p.b - .2 : tA <= lim.maxB && tA >= p.a + .2);
      if (pegado) v = tA;
      if (lado === "a") n.a = r2(Math.max(lim.minA, Math.min(v, p.b - .2))); else n.b = r2(Math.min(lim.maxB, Math.max(v, p.a + .2)));
      if (pegado && !antes) { try { navigator.vibrate && navigator.vibrate(8); } catch (err) {} }
      bl.classList.toggle("x-lm-iman", pegado); aguja.classList.toggle("x-lm-iman", pegado);
      const w = Math.max(10, dM(n) * pps); bl.style.width = w + "px"; ct.style.width = Math.max(0, ctW0 + (w0 - w)) + "px";
      onda(bl.firstChild, n.f, n.a, n.b, saltosDe(n, silDe(n), regla), n.vel, "#fff");
      { const mn = bl.querySelector(".x-lm-min"); if (mn) minis(mn, n, saltosDe(n, silDe(n), regla), w); }
      info.textContent = "Trozo " + (i + 1) + " · dura " + fmt(dM(n)) + (pegado ? " · pegado a la aguja" : " (" + (lado === "a" ? "empieza" : "acaba") + " en " + (lado === "a" ? n.a : n.b).toFixed(1) + " s de la grabación)");
    };
    const fin = () => {
      document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", fin, true); document.removeEventListener("pointercancel", fin, true);
      aguja.classList.remove("x-lm-iman"); if (ctNuevo) ct.remove();
      if (!movido || (n.a === p.a && n.b === p.b)) { refrescar(); return; }
      // dónde queda la aguja: en el mismo segundo de la grabación; si ese segundo ya no está en el montaje, sobre el corte que lo contiene
      const idCur = lista[cur] && lista[cur].id, enEste = tA != null && tA >= n.a - .01 && tA <= n.b + .01, eraDeEste = !oyeCorte && idCur === p.id;
      const l = copiar(lista); l[i].a = n.a; l[i].b = n.b;
      if (lado === "a") { oyeCorte = null; if (sonando) pausa(); sel = { tipo: "pieza", id: p.id }; cambiar(l, "Trozo " + (i + 1) + " recortado: la aguja está en su nuevo inicio", p.id); irA(lista.findIndex((x) => x.id === p.id), n.a); return; }
      if (enEste) { oyeCorte = null; cambiar(l, "Trozo " + (i + 1) + " recortado" + (pegado ? " justo en la aguja" : ""), p.id); }
      else cambiar(l, "Trozo " + (i + 1) + " recortado", idCur);
      if (!enEste && tA != null && (eraDeEste || oyeCorte)) {
        const c = [...carril.querySelectorAll(".x-lm-ct")].find((x) => x.dataset.f === p.f && tA >= +x.dataset.a - .01 && tA <= +x.dataset.b + .01);
        if (c) { oyeCorte = { f: p.f, a: +c.dataset.a, b: +c.dataset.b }; sel = { tipo: "corte", ...oyeCorte }; } else oyeCorte = null;
        marcar(); pintarAguja(); refrescarBarra();
      }
    };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", fin, true); document.addEventListener("pointercancel", fin, true);
  }

  // --- la transcripción: por partes, con la hora del montaje; lo cortado sale tachado
  const palDe = (f, a, b) => (pal[f] || []).filter((w) => { const c = (w[0] + w[1]) / 2; return c >= a && c < b; });
  const spanW = (w, f, c) => '<span class="w' + (c ? " c" : "") + '" data-f="' + esc(f) + '" data-a="' + w[0] + '" data-b="' + w[1] + '">' + esc(w[2]) + "</span> ";
  function htmlCorte(f, [a, b]) {
    const ws = palDe(f, a, b), k = f + "|" + a, id = 'data-f="' + esc(f) + '" data-a="' + a + '" data-b="' + b + '"';
    if (!ws.length) return b - a >= 2 ? '<span class="x-lm-cut x-lm-mudo" ' + id + ' title="Cortado: pulsa para verlo">' + fmt(b - a) + " sin voz</span> " : "";
    if (ws.length > 14 && !abiertos.has(k)) return '<span class="x-lm-cut" ' + id + ">" + ws.slice(0, 5).map((w) => spanW(w, f, 1)).join("") + '<button type="button" class="x-lm-mas" data-k="' + esc(k) + '" title="Ver todo lo cortado aquí">… ' + fmt(b - a) + " cortado</button></span> ";
    return '<span class="x-lm-cut" ' + id + ">" + ws.map((w) => spanW(w, f, 1)).join("") + "</span> ";
  }
  function pintarTr() {
    const arriba = tr.scrollTop, P = partesDe(lista), por = new Map(lista.map((p, i) => [p.id, i])); tr.innerHTML = "";
    P.forEach((x, pi) => {
      const sec = el("section", "x-lm-parte"); sec.dataset.i = pi;
      const d = x.ids.reduce((s, id) => s + M[por.get(id)].d, 0);
      const h = el("header", "x-lm-ph"); h.title = "Mantén pulsado y arrastra para mover la parte entera";
      h.innerHTML = '<span class="x-lm-agarre" aria-hidden="true">⠿</span><b>' + (pi + 1) + '</b><span class="x-lm-pt">' + esc(x.s || "Todo el vídeo") + '</span><i>' + fmt(d) + "</i>" +
        '<button type="button" class="x-lm-fl" data-d="-1" title="Subir esta parte (Alt + ↑)" aria-label="Subir la parte ' + (pi + 1) + ' (Alt + ↑)"' + (pi === 0 ? " disabled" : "") + '>▲ (⌥↑)</button><button type="button" class="x-lm-fl" data-d="1" title="Bajar esta parte (Alt + ↓)" aria-label="Bajar la parte ' + (pi + 1) + ' (Alt + ↓)"' + (pi === P.length - 1 ? " disabled" : "") + ">▼ (⌥↓)</button>";
      sec.appendChild(h);
      x.ids.forEach((id) => {
        const i = por.get(id), p = lista[i], c = cortes[id] || {}, ws = palDe(p.f, p.a, p.b);
        const fila = el("div", "x-lm-pz"); fila.dataset.id = id;
        fila.innerHTML = '<span class="x-lm-tm">' + fmt(M[i].t0) + '</span><p class="x-lm-tx">' + (c.antes ? htmlCorte(p.f, c.antes) : "") +
          (ws.length && !p.v ? ws.map((w) => spanW(w, p.f, 0)).join("") : '<span class="x-lm-desc" data-id="' + esc(id) + '">' + (p.v || p.vel > 1 ? "Pantalla" + (p.vel > 1 ? " ×" + p.vel : "") + " · " : "") + esc(p.t || "sin voz") + "</span> ") +
          (c.despues ? htmlCorte(p.f, c.despues) : "") + "</p>";
        sec.appendChild(fila);
      });
      tr.appendChild(sec);
    });
    // lo grabado que no se usa en ningún trozo (un grabación entero descartado): al final, tachado, por si se quiere recuperar
    fuentes.filter((f) => !lista.some((p) => p.f === f.id)).forEach((f) => {
      const sec = el("section", "x-lm-parte x-lm-fuera"); abiertos.add(f.id + "|0");
      sec.innerHTML = '<header class="x-lm-fh"><span class="x-lm-pt">Sin usar · ' + esc(f.nombre) + '</span><i>' + fmt(f.dur) + '</i></header><div class="x-lm-pz x-lm-pz-f"><span class="x-lm-tm"></span><p class="x-lm-tx">' + (htmlCorte(f.id, [0, r2(f.dur)]) || '<span class="x-lm-cut x-lm-mudo" data-f="' + esc(f.id) + '" data-a="0" data-b="' + r2(f.dur) + '">' + fmt(f.dur) + " sin transcribir</span>") + "</p></div>";
      tr.appendChild(sec);
    });
    tr.scrollTop = arriba; ultSuena = null; marcar();
  }
  tr.addEventListener("pointerdown", (e) => {
    cerrarBurbuja(e);
    const h = e.target.closest(".x-lm-ph"); if (!h || e.button !== 0 || e.target.closest(".x-lm-fl")) return;
    e.preventDefault(); const de = +h.parentNode.dataset.i, P = partesDe(lista);
    arrastre(e, { eje: "y", de, cont: tr, etiqueta: "Parte " + (de + 1) + " · " + (P[de].s || "sin nombre"), els: () => [...tr.querySelectorAll(".x-lm-parte")],
      antes: () => tr.classList.add("x-lm-plegado"), despues: () => tr.classList.remove("x-lm-plegado"),
      clic: () => { const i = lista.findIndex((p) => p.id === P[de].ids[0]); sel = { tipo: "pieza", id: lista[i].id }; irPausa(i); }, soltar: (k) => moverP(de, k) });
  });
  tr.addEventListener("click", (e) => {
    const fl = e.target.closest(".x-lm-fl"); if (fl) { const de = +fl.closest(".x-lm-parte").dataset.i, h = de + (+fl.dataset.d); if (h >= 0) cambiar(moverParte(lista, de, h), "Parte movida a la posición " + (h + 1)); return; }
    const mas = e.target.closest(".x-lm-mas"); if (mas) { abiertos.add(mas.dataset.k); pintarTr(); return; }
    if (!getSelection().isCollapsed) return;
    const cut = e.target.closest(".x-lm-cut"), w = e.target.closest(".w"), fila = e.target.closest(".x-lm-pz");
    if (cut) { const c = { f: cut.dataset.f, a: +cut.dataset.a, b: +cut.dataset.b }; oirCorte(c); if (w && act) activar(c.f).then(() => { act.currentTime = +w.dataset.a; }); return; }
    if (fila && fila.dataset.id) { const i = lista.findIndex((p) => p.id === fila.dataset.id); if (i < 0) return; sel = { tipo: "pieza", id: lista[i].id }; irPausa(i, w ? +w.dataset.a : null); }
  });
  // seleccionar texto: cortar lo que se queda o recuperar lo tachado
  function cerrarBurbuja(e) { if (burbuja && !(e && burbuja.contains(e.target))) { burbuja.remove(); burbuja = null; } }
  tr.addEventListener("pointerup", () => setTimeout(() => {
    const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount || arr) return;
    const rg = s.getRangeAt(0), ws = [...tr.querySelectorAll(".w")].filter((w) => rg.intersectsNode(w) && s.containsNode(w, true));
    if (!ws.length) return;
    const f = ws[0].dataset.f, corta = ws.every((w) => !w.classList.contains("c")), recup = ws.every((w) => w.classList.contains("c"));
    if (!ws.every((w) => w.dataset.f === f) || (!corta && !recup)) return;
    const todas = pal[f] || [], a0 = +ws[0].dataset.a, b1 = +ws[ws.length - 1].dataset.b;
    const ia = todas.findIndex((w) => w[0] === a0), ib = todas.findIndex((w) => w[1] === b1 && w[0] >= a0);
    const a = r2(ia > 0 ? Math.max(a0 - .25, (todas[ia - 1][1] + a0) / 2) : Math.max(0, a0 - .1)), b = r2(ib >= 0 && ib + 1 < todas.length ? Math.min(b1 + .25, (b1 + todas[ib + 1][0]) / 2) : b1 + .1);
    cerrarBurbuja(); const r = rg.getBoundingClientRect();
    burbuja = el("div", "x-lm-burbuja"); const bt = boton(burbuja, "x-lm-b x-lm-rojo", corta ? "Cortar esto" : "Recuperar esto"); bt.textContent = corta ? "Cortar esto" : "Recuperar esto";
    bt.addEventListener("click", () => {
      cerrarBurbuja(); getSelection().removeAllRanges();
      if (corta) cambiar(restarRango(lista, f, a, b), "Cortado: " + ws.length + (ws.length === 1 ? " palabra" : " palabras"));
      else { const n = sumarRango(lista, f, a, b, F.get(f).dur); if (n) cambiar(fundir(n), "Recuperado: vuelve al montaje detrás del trozo que le precede"); }
    });
    document.body.appendChild(burbuja);
    burbuja.style.left = Math.max(8, Math.min(innerWidth - burbuja.offsetWidth - 8, r.left + r.width / 2 - burbuja.offsetWidth / 2)) + "px"; burbuja.style.top = Math.max(8, r.top - burbuja.offsetHeight - 8) + "px";
  }, 0));
  tr.addEventListener("scroll", () => cerrarBurbuja());

  // --- acciones
  const piezaSel = () => (sel && sel.tipo === "pieza" ? lista.find((p) => p.id === sel.id) : null);
  function quitarSel() { const p = piezaSel(); if (!p) return ctx.aviso("Elige antes un trozo: púlsalo en la línea de tiempo o en el texto"); if (lista.length < 2) return ctx.aviso("No se puede quitar el único trozo"); cambiar(quitarPieza(lista, p.id), "Trozo quitado: sigue a la vista en gris; con R vuelve");
    const c = [...carril.querySelectorAll(".x-lm-ct")].find((x) => x.dataset.f === p.f && p.a >= +x.dataset.a - .01 && p.b <= +x.dataset.b + .01);
    if (c) { sel = { tipo: "corte", f: p.f, a: +c.dataset.a, b: +c.dataset.b }; marcar(); refrescarBarra(); } }
  function recuperarSel() {
    if (!sel || sel.tipo !== "corte") return ctx.aviso("Pulsa antes algo cortado (gris rayado en la línea de tiempo o tachado en el texto)");
    const n = sumarRango(lista, sel.f, sel.a, sel.b, F.get(sel.f).dur); if (!n) return ctx.aviso("Eso ya está en el montaje");
    oyeCorte = null; cambiar(fundir(n), "Recuperado: vuelve al montaje detrás del trozo que le precede (arrástralo si va en otro sitio)");
  }
  // con la aguja dentro de algo cortado se puede recuperar solo un lado: de la aguja en adelante o hasta la aguja
  const enCorteT = () => (sel && sel.tipo === "corte" && act && act.dataset.f === sel.f && act.currentTime > sel.a + .15 && act.currentTime < sel.b - .15 ? r2(act.currentTime) : null);
  function recuperarParte(lado) {
    const t = enCorteT(); if (t == null) return ctx.aviso("Pon antes la aguja dentro de algo cortado");
    const f = sel.f, a = lado === "desde" ? t : sel.a, b = lado === "desde" ? sel.b : t;
    const n = sumarRango(lista, f, a, b, F.get(f).dur); if (!n) return ctx.aviso("Eso ya está en el montaje");
    oyeCorte = null; cambiar(fundir(n), "Recuperado " + fmt(b - a) + (lado === "desde" ? " desde la aguja" : " hasta la aguja") + ": lo demás sigue cortado");
    const i = lista.findIndex((p) => p.f === f && t >= p.a - .02 && t <= p.b + .02); if (i >= 0) { sel = { tipo: "pieza", id: lista[i].id }; irA(i, t); }
  }
  // Q y W, como en CapCut: quitan del trozo lo que queda a la izquierda o a la derecha de la aguja (queda cortado y se puede recuperar)
  function recortarAguja(lado) {
    const p = lista[cur]; if (!p || oyeCorte || !act || act.dataset.f !== p.f) return ctx.aviso("Pon antes la aguja dentro de un trozo");
    const t = r2(act.currentTime); if (t < p.a + .2 || t > p.b - .2) return ctx.aviso("La aguja está muy pegada al borde del trozo");
    if (sonando) pausa(); const l = copiar(lista); if (lado === "a") l[cur].a = t; else l[cur].b = t;
    sel = { tipo: "pieza", id: p.id }; cambiar(l, lado === "a" ? "Quitado lo de la izquierda de la aguja (" + fmt(t - p.a) + ")" : "Quitado lo de la derecha de la aguja (" + fmt(p.b - t) + ")", p.id); pintarAguja();
  }
  function dividirAqui() {
    const p = lista[cur]; if (!p || oyeCorte || !act || act.dataset.f !== p.f) return ctx.aviso("Coloca el vídeo dentro de un trozo para dividirlo");
    const n = dividirPieza(lista, p.id, r2(act.currentTime)); if (!n) return ctx.aviso("Demasiado cerca del borde del trozo"); cambiar(n, "Trozo dividido en " + fmt(tMont()), p.id);
  }
  // --- clic derecho sobre un trozo o un corte (en la pista o en el texto): las mismas acciones de la barra, con su atajo
  const ico = (d) => '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
  const ICO = {
    dividir: ico('<rect x="2.5" y="7" width="7" height="10" rx="2"/><rect x="14.5" y="7" width="7" height="10" rx="2"/><path d="M12 3v18" stroke-dasharray="2.5 2.5"/>'),
    quitar: ico('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
    quitarIzq: ico('<path d="M12 3v18"/><rect x="14.5" y="7" width="7" height="10" rx="2"/><path d="M3 9l6 6M9 9l-6 6"/>'),
    quitarDer: ico('<path d="M12 3v18"/><rect x="2.5" y="7" width="7" height="10" rx="2"/><path d="M15 9l6 6M21 9l-6 6"/>'),
    antes: ico('<path d="M20 12H5M11 6l-6 6 6 6"/>'),
    despues: ico('<path d="M4 12h15M13 6l6 6-6 6"/>'),
    nota: ico('<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>'),
    play: ico('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
    recuperar: ico('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    recDesde: ico('<path d="M5 3v18"/><path d="M9 12h11M15 7l5 5-5 5"/>'),
    recHasta: ico('<path d="M19 3v18"/><path d="M15 12H4M9 7l-5 5 5 5"/>'),
  };
  let menu = null;
  const cerrarMenu = () => { if (menu) { menu.remove(); menu = null; document.removeEventListener("pointerdown", fueraMenu, true); document.removeEventListener("keydown", escMenu, true); removeEventListener("scroll", cerrarMenu); removeEventListener("blur", cerrarMenu); } };
  const fueraMenu = (e) => { if (menu && !menu.contains(e.target)) cerrarMenu(); };
  const escMenu = (e) => { if (e.key === "Escape") { e.stopPropagation(); cerrarMenu(); } };
  const tecla = (key, o) => document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...(o || {}) }));
  caja.addEventListener("contextmenu", (e) => {
    if (fxM) return;   // en Edición el clic derecho es de las marcas de efecto (corte-pistas.js)
    const ct = e.target.closest(".x-lm-ct, .x-lm-cut"), pz = !ct && e.target.closest(".x-lm-bl, .x-lm-pz");
    if (!ct && !(pz && pz.dataset.id)) return;
    e.preventDefault(); cerrarMenu(); let ops;
    if (ct) {
      const c = { f: ct.dataset.f, a: +ct.dataset.a, b: +ct.dataset.b };
      if (!(sel && sel.tipo === "corte" && sel.f === c.f && sel.a === c.a && sel.b === c.b)) oirCorte(c);
      const t = enCorteT();
      ops = [["Recuperar todo (R)", recuperarSel, ICO.recuperar], t != null && ["Recuperar desde la aguja (D)", () => recuperarParte("desde"), ICO.recDesde], t != null && ["Recuperar hasta la aguja (H)", () => recuperarParte("hasta"), ICO.recHasta], ["Oír lo cortado (Espacio)", () => { if (!sonando) play(); }, ICO.play]];
    } else {
      const i = lista.findIndex((p) => p.id === pz.dataset.id); if (i < 0) return;
      // la aguja va a donde está el ratón: así «Dividir aquí» parte justo en ese punto
      const p = lista[i], w = e.target.closest(".w"), bl = e.target.closest(".x-lm-bl"); let t = null;
      if (w && w.dataset.a) t = +w.dataset.a; else if (bl) { const r = bl.getBoundingClientRect(); t = p.a + (p.b - p.a) * Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))); }
      sel = { tipo: "pieza", id: p.id }; irPausa(i, t);
      ops = [["Dividir aquí (B)", dividirAqui, ICO.dividir], ["Quitar el trozo (⌫)", quitarSel, ICO.quitar], ["Quitar lo de la izquierda (Q)", () => recortarAguja("a"), ICO.quitarIzq], ["Quitar lo de la derecha (W)", () => recortarAguja("b"), ICO.quitarDer],
        i > 0 && ["Mover antes (⌥←)", () => tecla("ArrowLeft", { altKey: true }), ICO.antes], i < lista.length - 1 && ["Mover después (⌥→)", () => tecla("ArrowRight", { altKey: true }), ICO.despues], ["Nota aquí (M)", nuevaNota, ICO.nota], ["Reproducir desde aquí (Espacio)", () => { if (!sonando) play(); }, ICO.play]];
    }
    abrirMenu(e, ops);
  });
  function abrirMenu(e, ops) {
    cerrarMenu();
    menu = el("div", "x-lm-menu"); menu.setAttribute("role", "menu");
    ops.filter(Boolean).forEach(([t, f, d]) => { const b = boton(menu, "x-lm-mi", "", ""); b.innerHTML = d + "<span></span>"; b.lastChild.textContent = t; b.removeAttribute("title"); b.setAttribute("role", "menuitem"); b.addEventListener("click", () => { cerrarMenu(); f(); }); });
    document.body.appendChild(menu);
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(e.clientX, innerWidth - w - 8)) + scrollX + "px"; menu.style.top = Math.max(8, Math.min(e.clientY, innerHeight - h - 8)) + scrollY + "px";
    document.addEventListener("pointerdown", fueraMenu, true); document.addEventListener("keydown", escMenu, true); addEventListener("scroll", cerrarMenu); addEventListener("blur", cerrarMenu);
  }
  bQuitar.addEventListener("click", quitarSel); bRecuperar.addEventListener("click", recuperarSel); bRecDesde.addEventListener("click", () => recuperarParte("desde")); bRecHasta.addEventListener("click", () => recuperarParte("hasta")); bDividir.addEventListener("click", dividirAqui);
  const deshacer = (de, a) => { if (!de.length) return; const id = lista[cur] && lista[cur].id; a.push(lista); lista = de.pop(); enviado = false; sel = null; oyeCorte = null; const j = lista.findIndex((p) => p.id === id); cur = j >= 0 ? j : Math.min(cur, lista.length - 1); guardarLocal(); refrescar(); };
  // en Edición, deshacer y rehacer son de los efectos (el corte no cambia)
  const undo = () => (fxM ? fx.deshacer() || ctx.aviso("No hay nada que deshacer") : deshacer(hist, fut)), redo = () => (fxM ? fx.rehacer() || ctx.aviso("No hay nada que rehacer") : deshacer(fut, hist));
  bUndo.addEventListener("click", undo); bRedo.addEventListener("click", redo);
  bUndo2.addEventListener("click", undo); bRedo2.addEventListener("click", redo);
  const teclas = (e) => {
    if (!caja.isConnected) { document.removeEventListener("keydown", teclas); return; }
    if (e.__lm) return; e.__lm = 1;   // escucha en el editor y en el documento: la página corta el paso de las teclas hacia fuera
    const t = e.target, k = e.key, K = k.length === 1 ? k.toLowerCase() : k;
    const barra = !!t && t.tagName === "INPUT" && t.type === "range";   // una barra (zoom, velocidad) no se queda con las teclas: solo con sus flechas
    if (!caja.offsetParent || arr || (t && ((/TEXTAREA|INPUT|SELECT|SUMMARY/.test(t.tagName) && !barra) || t.isContentEditable))) return;
    if (barra && /^Arrow/.test(k) && !e.altKey && !e.metaKey && !e.ctrlKey) return;
    const hecho = () => { e.preventDefault(); if (t && (t.tagName === "BUTTON" || barra)) t.blur(); };
    if (e.metaKey || e.ctrlKey) {
      if (K === "z") { hecho(); (e.shiftKey ? bRedo : bUndo).click(); }
      else if (K === "b") { hecho(); if (!fxM) dividirAqui(); }
      else if (k === "+" || k === "=") { hecho(); ponerZoom(zoom + 8); }
      else if (k === "-" || k === "_") { hecho(); ponerZoom(zoom - 8); }
      else if (K === "e" && e.shiftKey) { hecho(); if (bEnviar.disabled) ctx.aviso("No hay cambios ni feedback que enviar"); else bEnviar.click(); }
      else if (k === "Enter") { hecho(); bBueno.click(); }
      return;
    }
    if (fxM) {   // Edición: teclas de los efectos; las del corte (mover, cortar, recuperar, imán, volver al original) no hacen nada
      if (fx && !e.shiftKey && !e.altKey && fx.tecla(k)) { hecho(); return; }
      if (e.altKey || (!e.shiftKey && /^[qwbrdhxnov]$/.test(K))) { hecho(); return; }
      if (k === "Delete" || k === "Backspace") { hecho(); return ctx.aviso("Elige antes un efecto: púlsalo en la línea de tiempo"); }
    }
    const iSel = () => { const p = piezaSel(); return p ? lista.indexOf(p) : cur; };
    if (e.altKey && (k === "ArrowUp" || k === "ArrowDown")) {
      e.preventDefault(); hecho(); const P = partesDe(lista), id = (piezaSel() || lista[cur] || {}).id, de = P.findIndex((x) => x.ids.includes(id)), h = de + (k === "ArrowUp" ? -1 : 1);
      if (de >= 0 && h >= 0 && h < P.length) cambiar(moverParte(lista, de, h), "Parte movida a la posición " + (h + 1)); else vivo.textContent = "La parte se queda donde estaba";
      return;
    }
    if (e.altKey && (k === "ArrowLeft" || k === "ArrowRight")) {
      hecho(); const p = piezaSel(); if (!p) return ctx.aviso("Elige antes un trozo");
      const i = lista.indexOf(p), n = moverPieza(lista, i, k === "ArrowLeft" ? i - 1 : i + 2);
      if (n) cambiar(n, "Trozo movido a la posición " + (i + (k === "ArrowLeft" ? 0 : 2)) + " de " + lista.length, p.id);
      return;
    }
    if (e.altKey) return;
    if (k === " " || K === "k") { hecho(); bPlay.click(); }
    else if (k === "ArrowLeft" || k === "ArrowRight") { hecho(); if (e.shiftKey && sonando) pausa(); irMontaje(tMont() + (k === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 / 30 : 5)); }
    else if (K === "j" || K === "l") { hecho(); irMontaje(tMont() + (K === "j" ? -5 : 5)); }
    else if (k === "Home") { hecho(); irMontaje(0); }
    else if (k === "End") { hecho(); irMontaje(total); }
    else if (K === "z" && e.shiftKey) { hecho(); ponerZoom(0); }
    else if (K === "q") { hecho(); recortarAguja("a"); }
    else if (K === "w") { hecho(); recortarAguja("b"); }
    else if (k === "ArrowUp" || k === "ArrowDown") { hecho(); const i = Math.max(0, Math.min(lista.length - 1, iSel() + (k === "ArrowUp" ? -1 : 1))); sel = { tipo: "pieza", id: lista[i].id }; irA(i); }
    else if (k === "+" || k === "=") { hecho(); ponerZoom(zoom + 8); }
    else if (k === "-" || k === "_") { hecho(); ponerZoom(zoom - 8); }
    else if (k === "0") { hecho(); ponerZoom(0); }
    else if (K === "b") { hecho(); dividirAqui(); }
    else if (K === "r") { hecho(); recuperarSel(); }
    else if (k === "Delete" || k === "Backspace" || K === "x") { hecho(); if (!piezaSel() && !oyeCorte && lista[cur]) sel = { tipo: "pieza", id: lista[cur].id }; quitarSel(); }
    else if (K === "s") { hecho(); ponerVel(vel + (e.shiftKey ? -.25 : .25)); }
    else if (k === "<" || k === ",") { hecho(); ponerVel(vel - .25); }
    else if (k === ">" || k === ".") { hecho(); ponerVel(vel + .25); }
    else if (K === "m") { hecho(); nuevaNota(); }
    else if (K === "n") { hecho(); alternarIman(); }
    else if (K === "v") { hecho(); alternarQuitado(); }
    else if (K === "d") { hecho(); recuperarParte("desde"); }
    else if (K === "h") { hecho(); recuperarParte("hasta"); }
    else if (K === "e") { hecho(); if (fxM) verLado("fx"); else if (ctx.irPaso) ctx.irPaso("edicion"); }
    else if (K === "t") { hecho(); if (!fxM) verLado("tr"); else if (ctx.irPaso) ctx.irPaso("corte"); }
    else if (K === "f") { hecho(); verLado("fb"); }
    else if (K === "o") { hecho(); if (cambiado()) bVolver.click(); else ctx.aviso("El corte ya es el original"); }
    else if (k === "?") { hecho(); popAtajos.abrir(); }
    else if (K === "p") { hecho(); ponerFull(!full); }
    else if (k === "Escape") { popAtajos.cerrar(); popVel.cerrar(); if (full) ponerFull(false); }
  };
  document.addEventListener("keydown", teclas); caja.addEventListener("keydown", teclas);
  caja.addEventListener("pointerdown", () => { if (!caja.contains(document.activeElement) || document.activeElement === document.body) caja.focus({ preventScroll: true }); });

  bVolver.addEventListener("click", () => { if (!cambiado()) return; pausa(); hist.push(lista); fut = []; lista = copiar(base); sel = null; oyeCorte = null; cur = 0; enviado = false; guardarLocal(); refrescar(); ctx.aviso("Corte original recuperado (se puede deshacer)"); });
  // el encargo del paso Edición: qué ha cambiado en los efectos y qué versión toca
  function textoEdicion() {
    const v = +edV || 0, sig = v + 1, cam = fx.cambios(), f = textoFb(), x = fx.texto(), cm = fx.comentarios(), cv = +ctx.editor.version || 0, ve = velEncargo();
    return "EDICIÓN · «" + ctx.titulo + "» · " + (v ? "He revisado la edición v" + v + " en la app (no se ha montado nada)." : "Quiero la edición v1.") +
      "\n\nQUÉ QUIERO: la edición v" + sig + ".\n" +
      (v ? "1. Parte de cómo hiciste la v" + v + " (edicion-v" + v + ".json) y aplica los efectos y mis comentarios de abajo.\n"
        : "1. Monta el corte si no está (node herramientas/montar.mjs \"" + ctx.carpeta + "\" → corte-v" + cv + ".mp4) y edítalo como me gustan mis vídeos (lo sabe mi cerebro), con los efectos y comentarios de abajo.\n") +
      "2. Cada efecto se hace como dice su «cómo se hace» de mi catálogo (datos/efectos.json). Si te pido un efecto que no está en el catálogo, hazlo y añádelo al catálogo con su emoji y cómo se hace.\n" +
      "3. Guarda edicion-v" + sig + ".mp4 en borrador (rápido; la calidad alta se hace solo cuando la dé por buena; no borres las anteriores), cómo lo has hecho en edicion-v" + sig + ".json, y en video.json pon \"edicion\": {\"version\": " + sig + ", \"video\": \"edicion-v" + sig + ".mp4\", \"sobre\": " + cv + ", \"piezas\": (las del corte v" + cv + "), \"efectos\": (la lista de EFECTOS de abajo, con sus id)}" + (v ? "" : " y \"etapa\": \"edicion\"") + ".\n" +
      "El corte NO cambia: es el v" + cv + " (" + lista.length + " trozos). Carpeta: " + ctx.carpeta +
      (cam.length ? "\n\nCAMBIOS EN LOS EFECTOS" + (v ? " (respecto a la v" + v + ")" : "") + ":\n" + cam.map((c) => "- " + c).join("\n") : "") +
      (cm ? "\n\n" + cm : "") + (x ? "\n\n" + x : "") + (f ? "\n\n" + f : "") + (ve ? "\n\n" + ve : "") +
      "\n\nCuando acabes, dime en una línea qué has hecho: la app lo enseña sola.";
  }
  bEnviar.addEventListener("click", async () => {
    if (fxM) { const ok = await ctx.enviar(textoEdicion(), "orden"); if (ok !== false) { enviado = true; FB.env = firmaFb(); guardarFb(); fx.enviado(); pintarCab(); } return; }
    const f = textoFb(), ve = velEncargo(); const ok = await ctx.enviar(textoEncargo(ctx, lista, base, fuentes, regla, [ve, f].filter(Boolean).join("\n\n")), "orden"); if (ok !== false) { enviado = true; FB.env = firmaFb(); guardarFb(); fx.enviado(); pintarCab(); } });
  bBueno.addEventListener("click", async () => {
    if (esBueno()) { try { localStorage.removeItem(buenoK); } catch (e) {} armado = 0; pintarCab(); return ctx.aviso(fxM ? "Quitado: la edición vuelve a estar por revisar" : "Quitado: el corte vuelve a estar por revisar"); }
    if (fxM) {
      if (fx.pend()) return ctx.aviso("Hay cambios en los efectos sin enviar: envíalos a Claude antes de dar la edición por buena");
      if (!armado) { armado = 1; pintarCab(); setTimeout(() => { if (armado) { armado = 0; pintarCab(); } }, 5000); return; }
      armado = 0; const ok = await ctx.enviar("EDICIÓN · «" + ctx.titulo + "» · Doy la edición" + (edV ? " v" + edV : "") + " por BUENA.\n1. Hazme la versión final en alta calidad como dice el CLAUDE.md de la app (desde la grabación original, en final/, sin tocar lo que ya he visto) y apúntala en video.json → edicion.final.\n2. Apunta en mi cerebro lo que hayas aprendido de este vídeo para los siguientes.\nCuando acabes, dime en una línea dónde está el vídeo final.", "bueno");
      if (ok === false) return; try { localStorage.setItem(buenoK, String(Date.now())); } catch (e) {} pintarCab(); return ctx.aviso("Edición dada por buena");
    }
    if (cambiado() && !enviado) return ctx.aviso("Hay cambios sin enviar: envíalos a Claude antes de dar el corte por bueno");
    if (!armado) { armado = 1; pintarCab(); setTimeout(() => { if (armado) { armado = 0; pintarCab(); } }, 5000); return; }
    armado = 0; const ok = await ctx.enviar(textoBueno(ctx, lista, cambiado()), "bueno"); if (ok === false) return;
    try { localStorage.setItem(buenoK, String(Date.now())); } catch (e) {} pintarCab(); ctx.aviso("Corte dado por bueno");
  });
  function pintarCab() {
    if (fxM) {
      const n = fx ? fx.n() : (ctx.editor.efectos || []).length, xp = !!fx && fx.pend(), fp = fbPend();
      meta.textContent = fmt(total) + " · " + lista.length + (lista.length === 1 ? " trozo" : " trozos") + " · " + n + (n === 1 ? " efecto" : " efectos");
      meta.title = "El corte del vídeo " + (edV ? "V" + edV : "montado") + (ED && ED.sobre ? " (corte " + ED.sobre + ")" : "") + ", fijo. Duración antes de acelerar. Vídeo local: solo en este Mac; no se renderiza nada hasta enviarlo.";
      estado.className = "x-lm-estado" + (xp || fp ? " x-lm-cambiado" : "");
      estado.textContent = xp ? "Cambios sin enviar" : fp ? "Feedback sin enviar" : enviado ? "Enviado a Claude" : esBueno() ? "Dada por buena" : "";
      bEnviar.disabled = !xp && !fp && !ctx.siempre; bVolver.hidden = true;
      bBueno.textContent = (esBueno() ? "Quitar «dada por buena»" : (armado ? "Pulsa otra vez para confirmar" : "Dar por buena")) + " (⌘↵)";
      bBueno.title = "Dar la edición por buena: Claude la deja lista para publicar (Cmd + Intro, dos veces)";
      return;
    }
    const c = cambiado(), P = partesDe(lista).length;
    meta.textContent = "Queda en " + fmt(total) + " · " + (P > 1 ? P + " partes · " : "") + lista.length + (lista.length === 1 ? " trozo" : " trozos");
    meta.title = (ctx.editor.nota ? ctx.editor.nota + " · " : "") + "Antes de acelerar" + (regla ? ", con los silencios largos ya acortados" : "") + ". Vídeo local: solo en este Mac, no se renderiza nada hasta enviarlo.";
    estado.className = "x-lm-estado" + (c && !enviado ? " x-lm-cambiado" : ""); estado.textContent = c ? (enviado ? "Cambios enviados" : "Cambios sin enviar") : (esBueno() ? "Dado por bueno" : "");
    const fp = fbPend();
    if (!c && fp) { estado.className = "x-lm-estado x-lm-cambiado"; estado.textContent = "Feedback sin enviar"; }
    const xp = !!fx && fx.pend(); if (!c && !fp && xp) { estado.className = "x-lm-estado x-lm-cambiado"; estado.textContent = "Edición sin enviar"; }
    bEnviar.disabled = !c && !fp && !xp && !ctx.siempre; bVolver.hidden = !c;
    bBueno.textContent = (esBueno() ? "Quitar «dado por bueno»" : (armado ? "Pulsa otra vez para confirmar" : "Dar por bueno")) + " (⌘↵)";
  }
  function refrescarBarra() {
    if (fxM) {
      if (!fx) return;
      bUndo.disabled = bUndo2.disabled = !fx.nDes(); bRedo.disabled = bRedo2.disabled = !fx.nReh();
      bUndo2.lastChild.textContent = (fx.nDes() ? "Deshacer · " + fx.nDes() : "Deshacer") + " (⌘Z)";
      const e = fx.todos().find((x) => x.id === fx.elegido());
      info.textContent = e ? "Elegido: " + TIPOS[e.tipo].n.toLowerCase() + (e.q ? " · " + e.q : "") + " · ⌫ lo quita · C lo comenta" : "";
      return;
    }
    const p = piezaSel(), q = lista[cur];
    bQuitar.disabled = !p; bRecuperar.disabled = !(sel && sel.tipo === "corte"); bUndo.disabled = bUndo2.disabled = !hist.length; bRedo.disabled = bRedo2.disabled = !fut.length;
    { const t = enCorteT(); bRecDesde.hidden = bRecHasta.hidden = t == null; bRecuperar.textContent = (t == null ? "Recuperar" : "Recuperar todo") + " (R)"; if (t != null) { bRecDesde.textContent = "Recuperar desde la aguja · " + fmt(sel.b - t) + " (D)"; bRecHasta.textContent = "Recuperar hasta la aguja · " + fmt(t - sel.a) + " (H)"; } }
    bUndo2.lastChild.textContent = (hist.length ? "Deshacer · " + hist.length : "Deshacer") + " (⌘Z)";
    const dentro = !!q && !oyeCorte && !!act && act.dataset.f === q.f && act.currentTime > q.a + .1 && act.currentTime < q.b - .1;
    bDividir.disabled = !dentro; bDividir.textContent = (dentro ? "Dividir en " + fmt(tMont()) : "Dividir") + " (B)";
    info.textContent = sel && sel.tipo === "corte" ? "Cortado · " + fmt(sel.b - sel.a) + " de " + ((F.get(sel.f) || {}).nombre || "") + " · «Recuperar» lo devuelve al montaje"
      : p ? "Trozo " + (lista.indexOf(p) + 1) + " · " + fmt(dM(p)) + (p.t ? " · " + p.t : "") : "";
  }
  function refrescar() {
    let t = 0; M = lista.map((p) => { const d = dM(p), x = { t0: t, d }; t += d; return x; }); total = t; cortes = cortesDe(lista, fuentes);
    const sl = marco.scrollLeft; pintarCab(); pintarPista(); marco.scrollLeft = sl; pintarTr(); refrescarBarra(); if (fx) fx.repintar();
  }


  // --- feedback: comentarios generales (Enter guarda uno y deja la caja lista para el siguiente) y notas con su minuto.
  // Se guarda solo en este navegador, uno por paso (Corte y Edición son encargos distintos), y viaja con «Copiar a Claude».
  const FK = fxM ? "6g-edicion.edicion.fb.v1:" + ctx.cid + (edV ? ":v" + edV : "") : "6g-edicion.corte.fb.v1:" + ctx.cid + (verD ? ":" + verD : "");
  let FB = { generales: [], borrador: "", notas: [], env: "" };
  try {
    const g = JSON.parse(localStorage.getItem(FK));
    if (g && Array.isArray(g.notas)) {
      const gen = Array.isArray(g.generales) ? g.generales.filter((c) => c && String(c.txt || "").trim()).map((c) => ({ id: String(c.id || "g" + Math.random().toString(36).slice(2, 8)), txt: String(c.txt) }))
        : String(g.general || "").trim() ? [{ id: "g0", txt: String(g.general).trim() }] : [];   // antes: una sola caja de texto
      FB = { generales: gen, borrador: String(g.borrador || ""), notas: g.notas.filter((n) => n && n.id).map((n) => ({ id: String(n.id), T: n.T == null ? null : +n.T, f: n.f || "", t: +n.t || 0, txt: String(n.txt || ""), fija: (n.fija == null ? !!String(n.txt || "").trim() : !!n.fija) ? 1 : 0 })), env: String(g.env || "") };
      // una sola nota a medias como mucho (la última); las demás a medias con texto pasan a guardadas y las vacías se van
      const med = FB.notas.filter((n) => !n.fija); med.slice(0, -1).forEach((n) => { if (n.txt.trim()) n.fija = 1; else FB.notas = FB.notas.filter((x) => x !== n); });
    }
  } catch (e) {}
  const notasCon = () => FB.notas.filter((n) => n.txt.trim());
  const genCon = () => FB.generales.map((c) => c.txt.trim()).concat(FB.borrador.trim() ? [FB.borrador.trim()] : []).filter(Boolean);   // lo escrito sin Enter también viaja
  const firmaFb = () => JSON.stringify([genCon(), notasCon().map((n) => [n.T, n.f, n.t, n.txt.trim()])]);
  const hayFb = () => genCon().length > 0 || notasCon().length > 0;
  const fbPend = () => hayFb() && firmaFb() !== FB.env;
  function guardarFb() { try { if (hayFb() || FB.notas.length || FB.generales.length) localStorage.setItem(FK, JSON.stringify(FB)); else localStorage.removeItem(FK); } catch (e) {} pintarTabs(); if (pistas) pistas.pintar(); }
  const horaNota = (n) => (n.T == null ? "cortado" : fmt(n.T));
  function textoFb() {
    if (!hayFb()) return "";
    const nom = (id) => (F.get(id) || { nombre: id }).nombre;
    const g = genCon();
    return (fxM ? "MIS COMENTARIOS SOBRE LA EDICIÓN (aplícalos además de los efectos):" : "MIS COMENTARIOS SOBRE ESTE CORTE (aplícalos además de las piezas):") +
      (g.length ? "\nGENERAL:\n" + g.map((x, i) => (i + 1) + ". " + x).join("\n") : "") +
      (notasCon().length ? "\nCON SU MINUTO (minuto del vídeo tal como queda cortado · grabación y segundo del original):\n" + notasCon().slice().sort((x, y) => (x.T == null ? 1e9 : x.T) - (y.T == null ? 1e9 : y.T)).map((n) => "- " + horaNota(n) + " (" + nom(n.f) + ", " + n.t.toFixed(1) + " s) · " + n.txt.trim()).join("\n") : "");
  }
  function pintarTabs() {
    const n = notasCon().length + genCon().length;
    tabTr.classList.toggle("x-on", !tr.hidden); tabFb.classList.toggle("x-on", !fb.hidden); tabFx.classList.toggle("x-on", !fxP.hidden); tabTr.setAttribute("aria-selected", !tr.hidden); tabFb.setAttribute("aria-selected", !fb.hidden); tabFx.setAttribute("aria-selected", !fxP.hidden);
    tabFx.textContent = "Efectos" + (fx && fx.n() ? " · " + fx.n() : "") + " (E)";
    tabFb.textContent = "Comentarios" + (n ? " · " + n : "") + " (F)"; if (caja.isConnected) pintarCab();
  }
  function verLado(cual) { if (cual === (fxM ? "tr" : "fx")) cual = fxM ? "fx" : "tr"; if (cual !== "fx" && fx) fx.cancelar(); fb.hidden = cual !== "fb"; fxP.hidden = cual !== "fx"; tr.hidden = cual === "fb" || cual === "fx"; pintarTabs(); if (cual !== "tr") pintarAguja(); if (!fxM) try { localStorage.setItem("x-corte-lado", cual); } catch (e) {} }
  // --- edición: efectos sobre el vídeo (desenfoque, zoom, recuadro, subrayado, clic); ver corte-fx.js
  // primer momento del montaje en que se ve algo de [a, b] de esa fuente (un efecto puede empezar en lo cortado y seguir en un trozo que se queda)
  const primero = (f, a, b) => { let m = null; lista.forEach((p, i) => { if (p.f !== f || !M[i] || p.b <= a + .02 || p.a >= (b == null ? a : b) - .02 && !(a >= p.a - .02 && a <= p.b + .02)) return; const t = Math.max(p.a, a), T = M[i].t0 + aMontaje(p, t, saltos(p)); if (!m || T < m.T) m = { T, t, i }; }); return m; };
  const montDe = (f, a, b) => { const m = primero(f, a, b); return m ? m.T : null; };
  fx = instalarFx({ ctx, pant, panel: fxP, el, boton, fmt, F, verD, edV, seed: ctx.editor.efectos, guardarCatalogo: ctx.guardarCatalogo, botonMic: ctx.botonMic, catalogoEjemplo: ctx.catalogoEjemplo,
    enCorte: (e) => { const m = primero(e.f, e.a, e.b); if (!m) return null; const T0 = m.T, p = lista[m.i], fin = Math.min(e.b, p.b); return [T0, T0 + Math.max(.05, aMontaje(p, fin, saltos(p)) - aMontaje(p, m.t, saltos(p)))]; }, video: () => act, sonando: () => sonando, pausa: () => pausa(), montDe, tMont: () => (oyeCorte ? null : tMont()), abrir: () => verLado("fx"),
    ir: (f, a, b) => { const m = primero(f, a, b); return m ? irPausa(m.i, m.t + .02) : irNota({ f, t: a, T: null }); }, aviso: (x) => ctx.aviso(x), alCambiar: () => { pintarTabs(); refrescarBarra(); if (pistas) pistas.pintar(); }, dims: (f) => { const s = F.get(f); return s && s.ancho && s.alto ? { w: s.ancho, h: s.alto } : null; } });
  if (fxM) pistas = crearPistas(carril, { el, boton, fmt, fx, lista: () => lista, M: () => M, elBl, izq, saltos, aMontaje, pps: () => pps, video: () => act,
    notas: () => FB.notas, irNota: (n) => irNota(n), verFb: () => verLado("fb"), menu: (ev, ops) => abrirMenu(ev, ops) });
  tabFx.addEventListener("click", () => verLado("fx"));
  tabTr.addEventListener("click", () => verLado("tr")); tabFb.addEventListener("click", () => verLado("fb"));
  // Soltar el efecto elegido al pinchar en cualquier otro sitio (vídeo vacío, pista vacía, un trozo, el panel). «si yo pincho
  // en otro lado se deseleccione el elemento visual que tengo marcado». Se quedan: el propio elegido (asas y ✕), las marcas, su ficha,
  // la barra de reproducción, la cabecera, la de herramientas (deshacer, zoom) y el asa de la aguja. Un clic en el vídeo que solo suelta no da a reproducir.
  let tragar = false;
  const QUEDA = ".x-fx-sel, .x-pz-m, .x-fx-elegido, .x-lm-ctl, .x-lm-cab, .x-lm-herr, .x-lm-tabs, .x-lm-menu, .x-lm-asa";   // la aguja se arrastra con el elegido puesto: así [ y ] tienen sobre qué actuar
  if (fxM) {
    caja.addEventListener("pointerdown", (e) => { tragar = false; if (!fx || !fx.elegido() || e.target.closest(QUEDA)) return; fx.elegir(null); tragar = !!e.target.closest(".x-lm-pant"); }, true);
    pant.addEventListener("click", (e) => { if (tragar) { tragar = false; e.preventDefault(); e.stopPropagation(); } }, true);
  }
  const crece = (ta) => { ta.style.height = "auto"; ta.style.height = Math.max(44, ta.scrollHeight + 2) + "px"; };
  // Las cajas para escribir (comentario general y nota con minuto) van FIJAS arriba; lo ya guardado se desplaza debajo.
  // «que las cajitas de feedback general y la de nota con minutos… esté fijado arriba siempre». Lo guardado (Enter) queda como fila
  // fija: no se edita al pincharla, solo se borra con su ✕ («le doy a enter… ya se cierra… no lo podría editar»).
  const fijo = el("div", "x-lm-fb-fijo"); fb.appendChild(fijo);
  fijo.appendChild(el("label", "x-lm-fb-l", "Comentarios generales"));
  const taGen = document.createElement("textarea"); taGen.className = "x-lm-fb-ta x-lm-fb-nuevo"; taGen.rows = 1; taGen.placeholder = "Escribe y pulsa Enter"; taGen.value = FB.borrador; fijo.appendChild(taGen); if (ctx.botonMic) fijo.appendChild(ctx.botonMic(taGen));
  taGen.setAttribute("aria-label", "Comentario general nuevo: Enter lo guarda");
  taGen.addEventListener("input", () => { FB.borrador = taGen.value; crece(taGen); guardarFb(); });
  taGen.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault(); e.stopPropagation();
    const t = taGen.value.trim(); if (!t) return;
    FB.generales.push({ id: "g" + Date.now().toString(36), txt: t }); FB.borrador = ""; taGen.value = ""; crece(taGen); guardarFb(); pintarGen();
  });
  const filaN = el("div", "x-lm-fb-fila"); fijo.appendChild(filaN);
  filaN.appendChild(el("span", "x-lm-fb-l", "Notas con su minuto"));
  const bNota = boton(filaN, "x-lm-b x-lm-fb-mas", "", "Añade una nota en el punto donde está la aguja (tecla M)"); bNota.innerHTML = "<b>＋</b> <span>Nota en 0:00 (M)</span>";
  const borrN = el("div", "x-lm-fb-nborr"); fijo.appendChild(borrN);
  const listaG = el("ol", "x-lm-fb-gen"); fb.appendChild(listaG);
  function pintarGen() {
    listaG.innerHTML = "";
    FB.generales.forEach((c, i) => {
      const li = el("li", "x-lm-fb-g x-lm-fb-fija"); li.appendChild(el("b", "x-lm-fb-gn", String(i + 1)));
      li.appendChild(el("p", "x-lm-fb-txt", c.txt));
      const q = boton(li, "x-lm-fb-x", "✕", "Borrar este comentario"); q.addEventListener("click", () => { FB.generales = FB.generales.filter((x) => x !== c); guardarFb(); pintarGen(); });
      listaG.appendChild(li);
    });
  }
  const listaN = el("div", "x-lm-fb-notas"); fb.appendChild(listaN);
  const pieFb = el("p", "x-lm-fb-pie", "Va todo junto al pulsar «Copiar a Claude», arriba."); fb.appendChild(pieFb);
  function irNota(n) {
    const i = lista.findIndex((p) => p.f === n.f && n.t >= p.a - .02 && n.t <= p.b + .02);
    if (i >= 0) return irPausa(i, n.t);
    const c = [...carril.querySelectorAll(".x-lm-ct")].find((x) => x.dataset.f === n.f && n.t >= +x.dataset.a - .02 && n.t <= +x.dataset.b + .02);
    if (c) { pausa(); oyeCorte = { f: n.f, a: +c.dataset.a, b: +c.dataset.b }; sel = { tipo: "corte", ...oyeCorte }; return activar(n.f).then((ok) => { if (ok) act.currentTime = n.t; marcar(); pintarAguja(); refrescarBarra(); }); }
    if (n.T != null) irMontaje(n.T);
  }
  // la nota que se está escribiendo (una como mucho, sin «fija») va arriba; las guardadas, abajo y por minuto
  const borrador = () => FB.notas.find((n) => !n.fija);
  function pintarNotas(foco) {
    listaN.innerHTML = ""; borrN.innerHTML = "";
    const bn = borrador();
    if (bn) {
      const f = el("div", "x-lm-fb-n");
      const h = boton(f, "x-lm-fb-h", horaNota(bn), "Ir a este punto del vídeo"); h.addEventListener("click", () => irNota(bn));
      const ta = document.createElement("textarea"); ta.className = "x-lm-fb-ta x-lm-fb-nota-ta"; ta.rows = 1; ta.placeholder = "Qué cambiarías aquí · Enter la guarda"; ta.value = bn.txt; ta.setAttribute("aria-label", "Nota en " + horaNota(bn) + ": Enter la guarda"); f.appendChild(ta); if (ctx.botonMic) f.appendChild(ctx.botonMic(ta));
      ta.addEventListener("input", () => { bn.txt = ta.value; crece(ta); guardarFb(); });
      ta.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault(); e.stopPropagation();
        if (!ta.value.trim()) return;
        bn.txt = ta.value.trim(); bn.fija = 1; guardarFb(); pintarNotas(); caja.focus({ preventScroll: true });
      });
      const q = boton(f, "x-lm-fb-x", "✕", "Borrar esta nota"); q.addEventListener("click", () => { FB.notas = FB.notas.filter((x) => x !== bn); guardarFb(); pintarNotas(); });
      borrN.appendChild(f); crece(ta); if (foco === bn.id) ta.focus({ preventScroll: true });
    }
    const fijas = FB.notas.filter((n) => n.fija);
    if (!fijas.length && !bn) listaN.appendChild(el("p", "x-lm-fb-vacio", "Para el vídeo donde quieras comentar algo y pulsa «＋ Nota»."));
    fijas.slice().sort((x, y) => (x.T == null ? 1e9 : x.T) - (y.T == null ? 1e9 : y.T)).forEach((n) => {
      const f = el("div", "x-lm-fb-n x-lm-fb-fija");
      const h = boton(f, "x-lm-fb-h", horaNota(n), "Ir a este punto del vídeo"); h.addEventListener("click", () => irNota(n));
      const t = el("p", "x-lm-fb-txt", n.txt); t.title = "Ir a este punto del vídeo"; t.addEventListener("click", () => irNota(n)); f.appendChild(t);
      const q = boton(f, "x-lm-fb-x", "✕", "Borrar esta nota"); q.addEventListener("click", () => { FB.notas = FB.notas.filter((x) => x !== n); guardarFb(); pintarNotas(); });
      listaN.appendChild(f);
    });
  }
  function nuevaNota() {
    const p = lista[cur]; if (!act || (!oyeCorte && !p)) return ctx.aviso("Coloca antes el vídeo en el punto que quieres comentar");
    if (sonando) pausa();
    // si había una a medias: con texto se guarda (cuenta aunque no se pulsara Enter); vacía, se cambia por la nueva
    const bn = borrador(); if (bn) { if (bn.txt.trim()) { bn.txt = bn.txt.trim(); bn.fija = 1; } else FB.notas = FB.notas.filter((x) => x !== bn); }
    const n = { id: "n" + Date.now().toString(36), T: oyeCorte ? null : r2(tMont()), f: act.dataset.f, t: r2(act.currentTime), txt: "" };
    FB.notas.push(n); verLado("fb"); guardarFb(); pintarNotas(n.id);
  }
  bNota.addEventListener("click", nuevaNota);
  pintarGen(); pintarNotas(); crece(taGen); { let g = "tr"; try { g = localStorage.getItem("x-corte-lado") || "tr"; } catch (e) {} verLado(fxM ? "fx" : g === "fb" ? g : "tr"); }

  // --- «Ver el vídeo que ya está montado»: solo si se abre (no se carga hasta entonces)
  det.addEventListener("toggle", () => {
    cuerpoDet.innerHTML = ""; if (!det.open) return;
    if (!ctx.montado) { cuerpoDet.appendChild(el("p", "x-cl-meta", "El vídeo montado aún no existe en este Mac.")); return; }
    const v = document.createElement("video"); v.controls = true; v.preload = "metadata"; v.playsInline = true; v.className = "x-co-video"; v.src = ctx.montado.url; cuerpoDet.appendChild(v);
    cuerpoDet.appendChild(el("p", "x-cl-meta", /^final\//.test(ctx.montado.archivo || "") ? "Es la versión final en alta calidad (" + ctx.montado.archivo + "), la que se publica." : "Es " + (ctx.montado.archivo || "el vídeo montado") + ", en borrador, tal como lo dejó Claude (no refleja lo que cambies aquí hasta que lo monte de nuevo)."));
  });
  if (fxM && ctx.montado) det.open = true;   // en Edición lo primero que se quiere ver es el vídeo que ha hecho Claude

  refrescar();
  try { if (localStorage.getItem("x-corte-full") === "1") ponerFull(true); } catch (e) {}
  // la onda y las palabras llegan después: se repinta cuando están
  Promise.all(fuentes.map(async (f) => {
    try { if (f.onda) { const r = await fetch(f.onda); if (r.ok) ondas[f.id] = await r.json(); } } catch (e) {}
    try { if (f.palabras) { const r = await fetch(f.palabras); if (r.ok) pal[f.id] = await r.json(); } } catch (e) {}
  })).then(() => { if (caja.isConnected) { pintarPista(); pintarTr(); } });
  if (lista[0]) irA(0);
  return caja;
}
