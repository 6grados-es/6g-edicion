// Panel de EFECTOS del paso Edición (app de edición de 6 Grados; traído del editor de las clases de 6 Grados).
// Los efectos NO vienen fijos: salen del catálogo de cada persona (datos/efectos.json), cada uno con su emoji, su nombre, «cómo se hace»
// (lo que lee su Claude para hacerlo) y un ASPECTO para la vista previa (VISTAS). La persona añade, cambia o quita efectos del catálogo.
// Cada efecto puesto en un vídeo es { id, tipo, f, a, b, x, y, w, h, de }: tipo = id del efecto en el catálogo, f = grabación, a–b = segundos
// de la grabación ORIGINAL (así sobrevive a recortes y cambios de orden), caja en fracciones 0–1 del fotograma.
// Campos propios: texto (aspectos «texto» y «flecha»), num (recuadro numerado); com = comentarios sobre ESE efecto.
// Aquí solo se PREVISUALIZA encima del vídeo: no se monta nada. Viaja con «Copiar a Claude» en el bloque EFECTOS.
// Se guarda en este navegador (por vídeo, corte y versión de la edición: una versión nueva abre limpia); cada efecto es una marca en su
// pista (corte-pistas.js); este panel añade en la aguja, enseña el elegido, guarda los quitados y edita el catálogo.

// Los aspectos que sabe pintar la vista previa (el vídeo final lo hace Claude según «cómo se hace»).
export const VISTAS = {
  zona: { n: "Caja con su emoji", que: "marca la zona con el emoji y el nombre del efecto", dur: 2.5 },
  texto: { n: "Texto en pantalla", que: "un texto encima del vídeo", dur: 2.5 },
  emoji: { n: "Emoji grande", que: "el emoji entra con un pequeño salto", dur: 1.5 },
  zoom: { n: "Zoom", que: "acerca la imagen a esa zona", dur: 2 },
  caja: { n: "Recuadro", que: "marco y el resto más oscuro; puede llevar número", dur: 2.5 },
  raya: { n: "Subrayado", que: "línea que avanza bajo un texto", dur: 2 },
  blur: { n: "Desenfoque", que: "tapa la zona", dur: 3 },
  clic: { n: "Clic", que: "onda y sonido de clic en un punto", dur: .6, pista: "sonido" },
  lupa: { n: "Lupa", que: "la zona se ve ampliada en el centro", dur: 2.5 },
  flecha: { n: "Flecha", que: "flecha que señala con un rótulo", dur: 2.5 },
};
// El catálogo de ejemplo cuando la persona aún no tiene el suyo: herramientas neutras, sin estilo de nadie.
export const EJEMPLO = [
  { id: "zoom", emoji: "🔍", nombre: "Zoom", vista: "zoom", dur: 2, como: "Acerca la imagen a la zona marcada, entrando y saliendo suave (unos 0,4 s), sin salirse del fotograma." },
  { id: "texto", emoji: "💬", nombre: "Texto en pantalla", vista: "texto", dur: 2.5, como: "Escribe el texto del efecto encima del vídeo, dentro de la caja marcada, legible en el móvil." },
  { id: "recuadro", emoji: "🟥", nombre: "Recuadro", vista: "caja", dur: 2.5, como: "Marco alrededor de la zona marcada y el resto del fotograma un poco más oscuro." },
  { id: "desenfoque", emoji: "🌫️", nombre: "Desenfoque", vista: "blur", dur: 3, como: "Desenfoca la zona marcada (un dato que no se debe ver) mientras esté en pantalla." },
  { id: "clic", emoji: "👆", nombre: "Clic", vista: "clic", dur: .6, como: "Onda que se abre en el punto marcado y, a la vez, sonido de clic." },
  { id: "emoji", emoji: "✨", nombre: "Emoji", vista: "emoji", dur: 1.5, como: "El emoji del efecto, grande, en la caja marcada, entrando con un pequeño salto." },
];
// TIPOS: los efectos del catálogo, con la forma que usa el editor (n nombre, k tecla, dur, pista, que, emoji, vista, como).
// Un efecto puesto en un vídeo cuyo tipo ya no está en el catálogo se sigue viendo como caja con su nombre.
const CAT = {};
const suelto = (id) => ({ n: String(id), k: "", dur: 2.5, pista: "visual", que: "efecto que ya no está en el catálogo", emoji: "✨", vista: "zona", como: "" });
export const TIPOS = new Proxy(CAT, { get: (o, k) => (typeof k !== "string" || k in o || k === "then" || k === "toJSON" ? o[k] : suelto(k)) });
export const V = (e) => TIPOS[e.tipo].vista, VT = (t) => TIPOS[t].vista;
const escE = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function limpiarCatalogo(l) {
  const vistos = new Set();
  return (Array.isArray(l) ? l : []).map((x, i) => {
    if (!x || !String(x.nombre || "").trim()) return null;
    let id = String(x.id || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "efecto-" + (i + 1);
    while (vistos.has(id)) id += "-b"; vistos.add(id);
    const vista = VISTAS[x.vista] ? x.vista : "zona", dur = +x.dur > 0 && +x.dur <= 60 ? Math.round(+x.dur * 10) / 10 : VISTAS[vista].dur;
    return { id, emoji: String(x.emoji || "✨").trim().slice(0, 8) || "✨", nombre: String(x.nombre).trim().slice(0, 40), vista, dur, como: String(x.como || "").trim().slice(0, 2000) };
  }).filter(Boolean);
}
export function ponerCatalogo(l) {
  Object.keys(CAT).forEach((k) => delete CAT[k]);
  limpiarCatalogo(l).forEach((x, i) => {
    CAT[x.id] = { n: x.nombre, k: i < 9 ? String(i + 1) : "", dur: x.dur, pista: VISTAS[x.vista].pista || "visual", que: x.como || VISTAS[x.vista].que, emoji: x.emoji, vista: x.vista, como: x.como };
  });
}
ponerCatalogo(EJEMPLO);
export const FLECHA_TXT = "Mira aquí";
const ico = (d) => '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + "</svg>";
export const ICO_FX = {
  blur: ico('<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M4 4l16 16"/>'),
  zoom: ico('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5M11 8.5v5M8.5 11h5"/>'),
  caja: ico('<rect x="4" y="6" width="16" height="12" rx="2"/>'),
  raya: ico('<path d="M6 5v6a6 6 0 0 0 12 0V5"/><path d="M4 20h16"/>'),
  clic: ico('<path d="M9 9l4.5 11 1.6-4.6L19.7 14z"/><path d="M5 3v3M3 5h3M9.5 3.5l-1 2M3.5 9.5l2-1"/>'),
  logo: ico('<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.5"/>'),
  flecha: ico('<path d="M12 4v13M6 11l6 6 6-6"/><path d="M5 21h14"/>'),
  lupa: ico('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 20 20M10 7.5v5M7.5 10h5"/>'),
  imagen: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>'),
  comentar: ico('<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12h5"/>'),
  sonido: ico('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  visual: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-4 4 3 3-2 6 4"/>'),
  nota: ico('<path d="M4 5h16v11H10l-5 4v-4H4z"/>'),
  video: ico('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>'),
  papelera: ico('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
};
export const icoDe = (tipo) => '<span class="x-fx-emo" aria-hidden="true">' + escE(TIPOS[tipo].emoji) + "</span>";
const FLECHA_SVG = '<svg viewBox="0 0 40 50" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="M14 2h12v24h10L20 48 4 26h10z" fill="#DC0A06" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>';
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
const lim = (x, a, b) => Math.max(a, Math.min(b, x));
const suave = (p) => { p = lim(p, 0, 1); return p * p * (3 - 2 * p); };
// lo que lleva de más cada efecto, en palabras (para el texto de Claude)
const extra = (e) => (V(e) === "texto" || V(e) === "flecha" ? " · texto «" + (e.texto || "") + "»" : V(e) === "caja" && e.num ? " · número " + e.num : "");
const nomE = (e) => TIPOS[e.tipo].emoji + " " + TIPOS[e.tipo].n.toUpperCase() + " (" + e.tipo + ")";

// Texto del bloque EFECTOS del encargo. dims(f) da el tamaño en píxeles de la grabación; enCorte(e) = [desde, hasta] en el vídeo cortado.
export function textoFx(fx, nombreF, dims, enCorte) {
  if (!fx.length) return "";
  const orden = fx.slice().sort((p, q) => (p.f === q.f ? p.a - q.a : String(p.f).localeCompare(String(q.f))));
  const usados = [...new Set(orden.map((e) => e.tipo))];
  return "CÓMO SE HACE CADA EFECTO (de mi catálogo, datos/efectos.json):\n" + usados.map((t) => "- " + TIPOS[t].emoji + " " + TIPOS[t].n + " (" + t + "): " + (TIPOS[t].como || "(sin descripción: hazlo como lo entiendas y apúntalo en el catálogo)")).join("\n") +
    "\n\nEFECTOS (tiempos en segundos de la grabación ORIGINAL y, entre paréntesis, en el vídeo ya cortado; caja x, y, ancho, alto en fracciones 0–1 del fotograma y, si se sabe, en píxeles):\n" +
    orden.map((e) => {
      const d = dims && dims(e.f), px = d ? " · px " + Math.round(e.x * d.w) + "," + Math.round(e.y * d.h) + "," + Math.round(e.w * d.w) + "," + Math.round(e.h * d.h) + " de " + d.w + "×" + d.h : "";
      const c = enCorte && enCorte(e), cc = c ? " (en el corte " + c[0].toFixed(2) + "–" + c[1].toFixed(2) + " s)" : " (cae en algo cortado: no sale)";
      return "- " + nomE(e) + " · id " + e.id + " · " + nombreF(e.f) + " " + e.a.toFixed(2) + "–" + e.b.toFixed(2) + " s" + cc + " · caja " + [e.x, e.y, e.w, e.h].map(r3).join(", ") + px + extra(e) + (e.de === "claude" ? " · lo propuso Claude" : "");
    }).join("\n");
}

// Lo que ha cambiado respecto a lo que montó Claude (la semilla): para el encargo de la versión siguiente.
export function cambiosFx(semilla, fx, nombreF) {
  const caja = (e) => [e.x, e.y, e.w, e.h].map(r3).join(", ");
  const k = (e) => [e.tipo, e.f, r2(e.a), r2(e.b), caja(e), extra(e)].join("|");
  const S = new Map(semilla.map((e) => [e.id, e])), A = new Map(fx.map((e) => [e.id, e]));
  const d = (e) => TIPOS[e.tipo].emoji + " " + TIPOS[e.tipo].n + (e.q ? " · " + e.q : "") + " · " + nombreF(e.f) + " " + e.a.toFixed(2) + "–" + e.b.toFixed(2) + " s";
  const out = [];
  fx.filter((e) => !S.has(e.id)).forEach((e) => out.push("AÑADIDO · " + d(e) + " · caja " + caja(e) + extra(e)));
  semilla.filter((e) => !A.has(e.id)).forEach((e) => out.push("QUITADO · " + d(e)));
  fx.filter((e) => S.has(e.id) && k(e) !== k(S.get(e.id))).forEach((e) => { const o = S.get(e.id); out.push("AJUSTADO · " + d(o) + " → " + e.a.toFixed(2) + "–" + e.b.toFixed(2) + " s" + (caja(o) !== caja(e) ? " · caja " + caja(e) : "") + (extra(o) !== extra(e) ? (extra(e) || " · sin número") : "")); });
  return out;
}

// Comentarios de la persona sobre un efecto concreto (no sobre un minuto): un bloque aparte del encargo.
export function comentariosFx(fx, nombreF, horaDe) {
  const con = fx.filter((e) => e.com && e.com.length).sort((p, q) => (p.f === q.f ? p.a - q.a : String(p.f).localeCompare(String(q.f))));
  if (!con.length) return "";
  return "MIS COMENTARIOS SOBRE EFECTOS CONCRETOS (comento ESE efecto, no un minuto; aplícalo a ese efecto):\n" + con.map((e) => {
    const h = horaDe ? horaDe(e) : null;
    return "- " + nomE(e) + (e.q ? " · " + e.q : "") + " · " + nombreF(e.f) + " " + e.a.toFixed(2) + "–" + e.b.toFixed(2) + " s" + (h ? " (en el montaje " + h + ")" : "") + extra(e) + "\n" + e.com.map((c) => "  · " + c).join("\n");
  }).join("\n");
}

export function instalarFx(api) {
  const { ctx, pant, panel, el, boton, fmt } = api;
  const CLAVE = "6g-edicion.corte.fx.v1:" + ctx.cid + (api.verD ? ":" + api.verD : "") + (api.edV ? ":v" + api.edV : "");
  const limpio = (e, i) => {
    if (!(e && TIPOS[e.tipo] && isFinite(e.a) && isFinite(e.b) && e.b > e.a && [e.x, e.y, e.w, e.h].every(isFinite))) return null;
    const r = { id: String(e.id || "s" + i), tipo: e.tipo, f: String(e.f), a: +e.a, b: +e.b, x: lim(+e.x, 0, 1), y: lim(+e.y, 0, 1), w: lim(+e.w, 0, 1), h: lim(+e.h, 0, 1), ...(e.de ? { de: String(e.de) } : {}), ...(e.q ? { q: String(e.q).slice(0, 70) } : {}) };
    if (V(e) === "flecha" || V(e) === "texto") r.texto = String(e.texto == null || !String(e.texto).trim() ? (V(e) === "flecha" ? FLECHA_TXT : TIPOS[e.tipo].n) : e.texto).slice(0, 120);
    if (V(e) === "caja" && Number.isInteger(+e.num) && +e.num >= 1 && +e.num <= 99) r.num = +e.num;
    const com = Array.isArray(e.com) ? e.com.map((c) => String(c || "").trim().slice(0, 500)).filter(Boolean) : [];
    if (com.length) r.com = com;
    return r;
  };
  const semilla = (api.seed || []).map((e, i) => limpio({ ...e, de: e.de || "claude" }, i)).filter(Boolean);
  // la firma cuenta todo lo que la persona puede tocar (también números, rótulos y comentarios): así «Enviar» se enciende y se guarda
  const firma = (l) => JSON.stringify(l.map((e) => [e.tipo, e.f, r2(e.a), r2(e.b), r3(e.x), r3(e.y), r3(e.w), r3(e.h), e.texto || "", e.num || 0, e.com || []]));
  const firmaSemilla = firma(semilla);
  let FX = semilla.map((e) => ({ ...e })), Q = [], env = "", sel = null, modo = null, nid = 1, hist = [], fut = [];
  let selDentro = false, arrastra = false, comAbierto = false, comBorr = "", nClics = 0;
  const sonados = new Set();
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE));
    if (g && Array.isArray(g.fx)) { FX = g.fx.map(limpio).filter(Boolean); Q = (Array.isArray(g.quitados) ? g.quitados : []).map(limpio).filter(Boolean).filter((e) => !FX.some((x) => x.id === e.id)); env = String(g.env || ""); }
  } catch (e) {}
  const nombreF = (id) => (api.F.get(id) || { nombre: id }).nombre;
  const guardar = () => {
    try { if (firma(FX) === firmaSemilla && !Q.length && !env) localStorage.removeItem(CLAVE); else localStorage.setItem(CLAVE, JSON.stringify({ fx: FX, quitados: Q, env })); } catch (e) {}
    pintarPanel(); tick(); api.alCambiar();
  };
  const pend = () => { const f = firma(FX); return f !== firmaSemilla && f !== env; };
  // deshacer: hasta 50 estados de {efectos, quitados}, solo en memoria
  const foto = () => JSON.stringify({ fx: FX, q: Q });
  const apuntar = () => { hist.push(foto()); if (hist.length > 50) hist.shift(); fut = []; };
  function volverA(de, a) {
    if (!de.length) return false; a.push(foto()); const s = JSON.parse(de.pop()); FX = s.fx; Q = s.q;
    if (sel && !FX.some((e) => e.id === sel)) sel = null; modo = null; pintarModo(); guardar(); return true;
  }

  // --- capa encima del vídeo: ocupa el mismo sitio que la imagen (el vídeo va «contenido» y puede dejar bandas)
  const capa = el("div", "x-fx-capa"); pant.appendChild(capa);
  const guia = el("div", "x-fx-guia"); guia.hidden = true; capa.appendChild(guia);
  const nodos = new Map();
  function encajar() {
    const v = api.video(); if (!v || !v.videoWidth) { capa.hidden = true; return null; }
    const W = pant.clientWidth, H = pant.clientHeight, k = Math.min(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k;
    capa.hidden = false; capa.style.left = (W - w) / 2 + "px"; capa.style.top = (H - h) / 2 + "px"; capa.style.width = w + "px"; capa.style.height = h + "px";
    return { w, h, ox: (W - w) / 2, oy: (H - h) / 2, W, H };
  }
  // el clic suena con el MISMO fichero que se mezcla en el vídeo montado (ext/clic.wav): lo que se oye al revisar es lo que sale.
  // Se carga al abrir el editor (antes se cargaba al primer clic y ese primero se veía sin sonar: la persona, 24-nov, «siempre que sea el botón
  // del click tiene que estar el sonido del click a la vez»).
  let ctxAudio = null, buf = null, carga = null;
  const URL_CLIC = new URL("./clic.wav", import.meta.url).href;
  function cargarClic() {
    if (carga) return carga;
    carga = (async () => { try { ctxAudio = ctxAudio || new (window.AudioContext || window.webkitAudioContext)(); if (!buf) { const r = await fetch(URL_CLIC); buf = await ctxAudio.decodeAudioData(await r.arrayBuffer()); } } catch (e) { carga = null; } })();
    return carga;
  }
  function sonarClic() {
    nClics++; pant.dataset.clics = String(nClics);
    const ya = () => { try { if (ctxAudio.state === "suspended") ctxAudio.resume(); const s = ctxAudio.createBufferSource(); s.buffer = buf; s.connect(ctxAudio.destination); s.start(); } catch (e) {} };
    if (buf && ctxAudio) ya(); else cargarClic().then(() => { if (buf) ya(); });
  }
  cargarClic();
  const nodo = (e) => {
    const n = el("div", "x-fx x-fx-" + V(e));
    if (V(e) === "clic") { n.appendChild(el("i", "")); n.appendChild(el("i", "")); }
    if (V(e) === "raya") n.appendChild(el("i", ""));
    if (V(e) === "emoji" || V(e) === "texto" || V(e) === "zona") n.appendChild(el("div", "x-fx-in"));
    if (V(e) === "flecha") { const c = el("div", "x-fx-in"); c.appendChild(el("span", "x-fx-rot")); const s = el("div", "x-fx-fl"); s.innerHTML = FLECHA_SVG; c.appendChild(s); n.appendChild(c); }
    if (V(e) === "lupa") { const v = el("div", "x-fx-lupa-v"); v.appendChild(document.createElement("canvas")); v.hidden = true; capa.appendChild(v); n._v = v; }
    capa.appendChild(n); nodos.set(e.id, n); return n;
  };
  const ASAS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  function soltarSel(por) { sel = null; selDentro = false; comAbierto = false; pintarPanel(); api.alCambiar(); if (por) api.aviso(por); }
  function tick() {
    const v = api.video(), c = encajar();
    pintarAqui();
    if (!v || !c) { nodos.forEach((n) => { if (n._v) n._v.remove(); n.remove(); }); nodos.clear(); return; }
    const t = v.currentTime, f = v.dataset.f, son = api.sonando();
    // reproduciendo, el elegido se suelta solo cuando la aguja sale de su tramo (la persona, 24-nov: «si la línea de tiempo avanza…
    // automáticamente deseleccione ese elemento»). Solo al salir: elegir sin mover la aguja no lo suelta.
    if (sel && son && !arrastra) {
      const e = FX.find((x) => x.id === sel);
      if (e) { const den = f === e.f && t >= e.a - .03 && t <= e.b; if (den) selDentro = true; else if (selDentro || (f === e.f && t > e.b + .05)) soltarSel(); }
    }
    const vivos = FX.filter((e) => e.f === f && ((t >= e.a && t < e.b) || e.id === sel));
    nodos.forEach((n, id) => { if (!vivos.some((e) => e.id === id)) { if (n._v) n._v.remove(); n.remove(); nodos.delete(id); } });
    let z = null;
    vivos.forEach((e) => {
      const dentro = t >= e.a && t < e.b, p = lim((t - e.a) / (e.b - e.a), 0, 1), seg = t - e.a, resta = e.b - t, quieto = e.id === sel && !son;
      // en pausa, logo, imagen, flecha y lupa se ven ya del todo (si no, parado en su primer fotograma aún no han entrado)
      const fijo = quieto || !son;
      const n = nodos.get(e.id) || nodo(e), esSel = e.id === sel && !modo;
      n.classList.toggle("x-fx-sel", e.id === sel); n.classList.toggle("x-fx-fuera", !dentro); n.classList.toggle("x-fx-mueve", esSel);
      // el elegido lleva su ✕ en la esquina y asas para moverlo y cambiar su tamaño
      let x = n.querySelector(".x-fx-x");
      if (esSel && !x) {
        x = boton(n, "x-fx-x", "✕", "Quitar este efecto (⌫)"); x.dataset.id = e.id;
        x.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); ev.preventDefault(); });
        x.addEventListener("click", (ev) => { ev.stopPropagation(); ev.preventDefault(); quitar(x.dataset.id); });
      } else if (x && !esSel) x.remove();
      if (x) x.classList.toggle("x-fx-x-izq", e.x + e.w > .88);
      const asas = n.querySelectorAll(".x-fx-asa");
      if (esSel && V(e) !== "clic" && !asas.length) ASAS.forEach((d) => { const a = el("i", "x-fx-asa x-fx-asa-" + d); a.dataset.d = d; n.appendChild(a); });
      else if ((!esSel || V(e) === "clic") && asas.length) asas.forEach((a) => a.remove());
      n.style.left = e.x * 100 + "%"; n.style.top = e.y * 100 + "%"; n.style.width = e.w * 100 + "%"; n.style.height = e.h * 100 + "%";
      if (V(e) === "raya") n.firstChild.style.width = (dentro ? suave(seg / ((e.b - e.a) * .6)) * 100 : 100) + "%";
      // el elegido, en pausa, se ve entero (con su ✕): si no, en su primer fotograma el recuadro aún está entrando y casi no se ve
      if (V(e) === "caja") {
        n.style.opacity = dentro && !quieto ? String(Math.min(suave(seg / .2), suave(resta / .2))) : "";
        let b = n.querySelector(".x-fx-num"); if (e.num && !b) { b = el("b", "x-fx-num"); n.appendChild(b); } else if (!e.num && b) { b.remove(); b = null; }
        if (b) b.textContent = String(e.num);
        n.classList.toggle("x-fx-connum", !!e.num);   // el número ocupa la esquina: su asa no se pinta (quedan las otras siete)
      }
      if (V(e) === "clic") {
        const q = dentro ? p : 1; n.children[0].style.transform = "translate(-50%,-50%) scale(" + (.3 + q * 2.2) + ")"; n.children[0].style.opacity = String(dentro ? 1 - q : .6); n.children[1].style.transform = "translate(-50%,-50%) scale(" + (dentro ? 1 - .35 * Math.sin(q * Math.PI) : 1) + ")";
        // nunca onda sin sonido: cada vez que la onda se pinta reproduciendo, suena (una vez por pasada)
        if (son && dentro && !sonados.has(e.id)) { sonados.add(e.id); sonarClic(); }
      }
      if (V(e) === "zoom" && dentro && !modo && !arrastra) { const k = Math.min(suave(seg / .45), suave(resta / .45)), s = lim(.8 / Math.max(e.w, e.h), 1.25, 2.6); const o = (c) => lim(c - .5 / s, 0, 1 - 1 / s) / (1 - 1 / s); z = { s: 1 + (s - 1) * k, cx: o(e.x + e.w / 2), cy: o(e.y + e.h / 2) }; }
      if (V(e) === "emoji") {
        const c = n.firstChild; if (c.textContent !== TIPOS[e.tipo].emoji) c.textContent = TIPOS[e.tipo].emoji;
        c.style.fontSize = Math.max(14, e.h * capa.clientHeight * .78) + "px";
        // pop: 0,6 → 1,1 en 0,18 s y vuelve a 1 a los 0,32 s; aparece en 0,12 s y se va en 0,2 s
        const s = !dentro || fijo ? 1 : seg < .18 ? .6 + .5 * suave(seg / .18) : seg < .32 ? 1.1 - .1 * suave((seg - .18) / .14) : 1;
        c.style.transform = "scale(" + s + ")"; c.style.opacity = !dentro || fijo ? "" : String(Math.min(suave(seg / .12), suave(resta / .2)));
      }
      if (V(e) === "texto" || V(e) === "zona") {
        const c = n.firstChild, txt = V(e) === "texto" ? (e.texto || TIPOS[e.tipo].n) : TIPOS[e.tipo].emoji + " " + TIPOS[e.tipo].n;
        if (c.textContent !== txt) c.textContent = txt;
        if (V(e) === "texto") c.style.fontSize = Math.max(10, Math.min(e.h * capa.clientHeight * .42, e.w * capa.clientWidth / Math.max(4, txt.length) * 1.7)) + "px";
        const k = !dentro || fijo ? 1 : Math.min(suave(seg / .15), suave(resta / .15));
        c.style.opacity = !dentro || fijo ? "" : String(k);
      }
      if (V(e) === "flecha") {
        const c = n.firstChild, rot = c.firstChild, fl = c.lastChild, hp = e.h * c0(c, "h");
        if (rot.textContent !== (e.texto || FLECHA_TXT)) rot.textContent = e.texto || FLECHA_TXT;
        rot.style.fontSize = Math.max(9, hp * .16) + "px";
        // rebote: sube y baja |sin(t · 1,5π)| · 12 % del alto de la caja
        fl.style.transform = "translateY(" + (dentro && !fijo ? -Math.abs(Math.sin(seg * 1.5 * Math.PI)) * .12 * hp : 0) + "px)";
        c.style.opacity = !dentro || fijo ? "" : String(Math.min(suave(seg / .2), suave(resta / .2)));
      }
      if (V(e) === "lupa") {
        const vv = n._v, ver = dentro && !quieto && !modo && !arrastra;
        vv.hidden = !ver;
        if (ver) {
          // la zona, ampliada y centrada: 70 % del ancho (o 80 % del alto si no cabe), entra y sale en 0,25 s
          const asp = (e.w * c.w) / Math.max(1, e.h * c.h); let Lw = .7 * c.w, Lh = Lw / asp; if (Lh > .8 * c.h) { Lh = .8 * c.h; Lw = Lh * asp; }
          const cv = vv.firstChild, dpr = Math.min(2, devicePixelRatio || 1), k = son ? Math.min(suave(seg / .25), suave(resta / .25)) : 1;
          cv.style.width = Lw + "px"; cv.style.height = Lh + "px"; const W = Math.round(Lw * dpr), H = Math.round(Lh * dpr); if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H;
          try { cv.getContext("2d").drawImage(v, e.x * v.videoWidth, e.y * v.videoHeight, Math.max(1, e.w * v.videoWidth), Math.max(1, e.h * v.videoHeight), 0, 0, W, H); } catch (err) {}
          vv.style.opacity = String(k); cv.style.transform = "scale(" + (.9 + .1 * k) + ")";
        }
      }
    });
    // un clic que ya no está en su tramo puede volver a sonar en la pasada siguiente (también si ha salido de «vivos»)
    sonados.forEach((id) => { const e = FX.find((x) => x.id === id); if (!e || e.f !== f || t < e.a || t >= e.b) sonados.delete(id); });
    // el zoom mueve la imagen y la capa a la vez; el origen se elige para que la zona quede centrada sin salirse del fotograma (igual que en el montaje final)
    const tr = z ? "scale(" + z.s + ")" : "", ox = z ? (c.ox + z.cx * c.w) + "px " + (c.oy + z.cy * c.h) + "px" : "";
    v.style.transform = tr; v.style.transformOrigin = ox;
    capa.style.transform = tr; capa.style.transformOrigin = z ? z.cx * c.w + "px " + z.cy * c.h + "px" : "";
  }
  const c0 = (c, eje) => (eje === "h" ? capa.clientHeight : capa.clientWidth);

  // --- mover y redimensionar el elegido sobre el vídeo: por el centro se mueve, por sus asas (esquinas y bordes) cambia de tamaño.
  capa.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || modo) return;
    const n = ev.target.closest(".x-fx-mueve"); if (!n || ev.target.closest(".x-fx-x")) return;
    const e = FX.find((x) => x.id === sel); if (!e) return;
    ev.preventDefault(); ev.stopPropagation();
    arrastra = true; tick(); n.classList.add("x-fx-coge");
    const R = capa.getBoundingClientRect(), asa = ev.target.closest(".x-fx-asa"), d = asa ? asa.dataset.d : "", x0 = ev.clientX, y0 = ev.clientY, o = { x: e.x, y: e.y, w: e.w, h: e.h };
    let movido = false;
    const mv = (m) => {
      if (!movido && Math.hypot(m.clientX - x0, m.clientY - y0) < 3) return;
      if (!movido) { apuntar(); movido = true; }
      const dx = (m.clientX - x0) / R.width, dy = (m.clientY - y0) / R.height; let { x, y, w, h } = o;
      if (!d) { x = lim(o.x + dx, 0, 1 - o.w); y = lim(o.y + dy, 0, 1 - o.h); }
      else {
        if (d.includes("w")) { x = lim(o.x + dx, 0, o.x + o.w - .02); w = o.x + o.w - x; }
        if (d.includes("e")) w = lim(o.w + dx, .02, 1 - o.x);
        if (d.includes("n")) { y = lim(o.y + dy, 0, o.y + o.h - .012); h = o.y + o.h - y; }
        if (d.includes("s")) h = lim(o.h + dy, .012, 1 - o.y);
      }
      e.x = r3(x); e.y = r3(y); e.w = r3(w); e.h = r3(h); tick();
    };
    const fin = (m) => {
      document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", fin, true); document.removeEventListener("pointercancel", fin, true);
      arrastra = false; n.classList.remove("x-fx-coge");
      if (movido && m.type === "pointercancel") { Object.assign(e, o); hist.pop(); tick(); return; }
      if (!movido) { tick(); return; }
      delete e.de; guardar(); api.aviso(TIPOS[e.tipo].n + (d ? ": tamaño cambiado" : ": movido") + " (⌘Z lo deshace)");
    };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", fin, true); document.addEventListener("pointercancel", fin, true);
  });

  // --- panel: «Añadir aquí» (en la aguja), la ficha del elegido y los quitados. La lista entera vive en la línea de tiempo.
  const sec = (cls, titulo) => { const s = el("section", "x-fx-sec " + (cls || "")); const h = el("h3", "x-fx-h"); h.textContent = titulo; s.appendChild(h); panel.appendChild(s); return [s, h]; };
  const [sAdd, hAdd] = sec("x-fx-add", "Añadir aquí");
  const barra = el("div", "x-fx-barra"); sAdd.appendChild(barra);
  let bs = {};
  function pintarBarra() {
    barra.textContent = ""; bs = {};
    Object.entries(TIPOS).forEach(([tipo, T]) => {
      const b = boton(barra, "x-lm-b x-fx-mas", "", "Añade «" + T.n + "» donde está la aguja: " + T.que + (T.k ? " (tecla " + T.k + ")" : ""));
      b.innerHTML = icoDe(tipo) + "<span></span>"; b.lastChild.textContent = T.n + (T.k ? " (" + T.k + ")" : ""); b.addEventListener("click", () => empezar(tipo)); bs[tipo] = b;
    });
    if (!Object.keys(TIPOS).length) barra.appendChild(el("p", "x-fx-vacio", "Tu catálogo está vacío: crea tu primer efecto abajo."));
  }
  pintarBarra();
  const ayuda = el("p", "x-fx-ayuda", ""); sAdd.appendChild(ayuda);
  // al añadir un logo o una imagen se elige cuál antes de marcarlo (y luego se cambia en su ficha)
  const desplegable = (opc, val, alCambiar, etq) => {
    const s = document.createElement("select"); s.className = "x-fx-sel-d"; s.setAttribute("aria-label", etq);
    Object.entries(opc).forEach(([k, v]) => { const o = document.createElement("option"); o.value = k; o.textContent = v[0]; s.appendChild(o); });
    s.value = val; s.addEventListener("change", () => { alCambiar(s.value); s.blur(); }); return s;
  };
  const [sSel] = sec("x-fx-elegido", "Elegido");
  const ficha = el("div", "x-fx-ficha"); sSel.appendChild(ficha);
  const cortados = el("p", "x-fx-cort"); cortados.hidden = true; panel.appendChild(cortados);
  const [sQ, hQ] = sec("x-fx-quit", "Quitados");
  const listaQ = el("div", "x-fx-qlista"); sQ.appendChild(listaQ);
  panel.appendChild(el("p", "x-lm-fb-pie", "Solo es una vista previa: nada se monta hasta que lo pegues en tu Claude con «Copiar a Claude»."));
  // --- el catálogo de la persona: emoji, nombre, cómo se hace y aspecto en la vista previa. Se guarda en datos/efectos.json.
  const [sCat, hCat] = sec("x-fx-catalogo", "Tu catálogo de efectos");
  const listaCat = el("div", "x-fx-catlista"); sCat.appendChild(listaCat);
  const bNuevo = boton(sCat, "x-lm-b x-fx-catnuevo", "＋ Efecto nuevo", "Crea un efecto tuyo: su emoji, su nombre y cómo se hace");
  let editando = null;   // id del efecto del catálogo que se está editando, o "nuevo"
  const catActual = () => Object.entries(CAT).map(([id, T]) => ({ id, emoji: T.emoji, nombre: T.n, vista: T.vista, dur: T.dur, como: T.como || "" }));
  async function guardarCat(l, aviso) {
    const ok = api.guardarCatalogo ? await api.guardarCatalogo(limpiarCatalogo(l)) : true;
    if (ok === false) return false;
    ponerCatalogo(l); editando = null; pintarBarra(); pintarCat(); pintarPanel(); tick(); api.alCambiar(); if (aviso) api.aviso(aviso); return true;
  }
  function formCat(x) {
    const fm = el("form", "x-fx-catform"); fm.noValidate = true;
    const campoT = (txt, nodo) => { const l = el("label", "x-fx-campo"); l.appendChild(el("span", "", txt)); l.appendChild(nodo); fm.appendChild(l); return nodo; };
    const iE = campoT("Emoji", document.createElement("input")); iE.value = x.emoji || "✨"; iE.maxLength = 8; iE.className = "x-fx-iemo";
    const iN = campoT("Nombre", document.createElement("input")); iN.value = x.nombre || ""; iN.maxLength = 40; iN.placeholder = "p. ej. Texto del gancho";
    const iC = campoT("Cómo se hace", document.createElement("textarea")); iC.value = x.como || ""; iC.rows = 3; iC.placeholder = "Lo que lee tu Claude para hacerlo: tamaño, color, cuánto dura, sonido…"; iC.className = "x-lm-fb-ta";
    const iV = campoT("Se ve como", document.createElement("select")); Object.entries(VISTAS).forEach(([k, v]) => { const o = document.createElement("option"); o.value = k; o.textContent = v.n; iV.appendChild(o); }); iV.value = x.vista || "zona";
    const iD = campoT("Dura (s)", document.createElement("input")); iD.type = "number"; iD.min = ".1"; iD.max = "60"; iD.step = ".1"; iD.value = String(x.dur || VISTAS[iV.value].dur);
    if (api.botonMic) iC.parentNode.appendChild(api.botonMic(iC));
    const ac = el("div", "x-fx-ac"); fm.appendChild(ac);
    const bG = boton(ac, "x-lm-b x-lm-rojo", "Guardar", "Guarda el efecto en tu catálogo"); bG.type = "submit";
    const bX = boton(ac, "x-lm-b", "Cancelar"); bX.addEventListener("click", () => { editando = null; pintarCat(); });
    if (x.id) { const bB = boton(ac, "x-lm-b x-fx-bq", "Quitar del catálogo", "Los efectos ya puestos en vídeos se quedan"); bB.addEventListener("click", () => guardarCat(catActual().filter((y) => y.id !== x.id), "«" + x.nombre + "» quitado del catálogo")); }
    fm.addEventListener("keydown", (ev) => { ev.stopPropagation(); if (ev.key === "Escape") { editando = null; pintarCat(); } });
    fm.addEventListener("submit", (ev) => {
      ev.preventDefault(); if (!iN.value.trim()) { iN.focus(); return api.aviso("Ponle un nombre al efecto"); }
      const nuevo = { id: x.id || iN.value, emoji: iE.value, nombre: iN.value, como: iC.value, vista: iV.value, dur: +iD.value };
      const l = catActual(); const k = l.findIndex((y) => y.id === x.id); if (k >= 0) l[k] = nuevo; else l.push(nuevo);
      guardarCat(l, "«" + iN.value.trim() + "» guardado en tu catálogo");
    });
    requestAnimationFrame(() => { if (fm.isConnected) iN.focus({ preventScroll: true }); });
    return fm;
  }
  function pintarCat() {
    listaCat.textContent = ""; hCat.textContent = "Tu catálogo de efectos · " + Object.keys(CAT).length;
    Object.entries(CAT).forEach(([id, T]) => {
      if (editando === id) { listaCat.appendChild(formCat({ id, emoji: T.emoji, nombre: T.n, vista: T.vista, dur: T.dur, como: T.como })); return; }
      const f = el("div", "x-fx-catfila"); f.innerHTML = icoDe(id) + "<span><b></b><i></i></span>";
      f.querySelector("b").textContent = T.n + (T.k ? " (" + T.k + ")" : ""); f.querySelector("i").textContent = T.como || "Sin «cómo se hace»: tu Claude lo hará como lo entienda.";
      const b = boton(f, "x-lm-b", "Cambiar", "Cambia este efecto del catálogo"); b.addEventListener("click", () => { editando = id; pintarCat(); });
      listaCat.appendChild(f);
    });
    if (editando === "nuevo") listaCat.appendChild(formCat({ vista: "zona" }));
    bNuevo.hidden = editando === "nuevo";
    if (api.catalogoEjemplo) sCat.classList.add("x-fx-ejemplo");
  }
  bNuevo.addEventListener("click", () => { editando = "nuevo"; pintarCat(); });
  pintarCat();
  let aquiAntes = "";
  function pintarAqui() { const t = api.tMont ? api.tMont() : null, x = "Añadir aquí" + (t == null ? "" : " · " + fmt(t)); if (x !== aquiAntes) { aquiAntes = x; hAdd.textContent = x; } }
  function pintarModo() {
    Object.entries(bs).forEach(([t, b]) => { b.classList.toggle("x-on", modo === t); b.setAttribute("aria-pressed", modo === t ? "true" : "false"); });
    pant.classList.toggle("x-fx-dibuja", !!modo);
    ayuda.textContent = modo ? (VT(modo) === "clic" ? "Toca en el vídeo el punto del clic. Esc lo cancela." : VT(modo) === "raya" ? "Arrastra sobre la línea de texto: la raya sale debajo, sin tachar. Esc lo cancela."
      : VT(modo) === "lupa" ? "Arrastra sobre el vídeo la zona que se verá ampliada (una URL, un texto pequeño). Esc lo cancela."
      : ["emoji", "flecha", "texto", "zona"].includes(VT(modo)) ? "Toca en el vídeo dónde va (o arrastra su caja). Esc lo cancela."
      : "Arrastra sobre el vídeo la zona de «" + TIPOS[modo].n + "». Esc lo cancela.")
      : "Pausa donde quieras, elige uno y márcalo sobre el vídeo.";
  }
  function empezar(tipo) {
    const v = api.video(); if (!v) return api.aviso("La grabación no está en la carpeta del vídeo");
    if (api.sonando()) api.pausa(); modo = modo === tipo ? null : tipo; pintarModo(); tick();
  }
  function cancelar() { if (!modo) return false; modo = null; guia.hidden = true; pintarModo(); tick(); return true; }
  // tamaño por defecto si se toca sin arrastrar (en fracciones; k = ancho/alto de la imagen en pantalla)
  const DEF = { emoji: (k) => [.22, Math.min(.5, .22 * k)], flecha: () => [.16, .24], texto: () => [.8, .1], zona: () => [.5, .16] };
  const SITIO = {};
  pant.addEventListener("pointerdown", (e) => {
    if (!modo || e.button !== 0) return;
    const v = api.video(), c = encajar(); if (!v || !c) return;
    e.preventDefault(); e.stopPropagation();
    const R = capa.getBoundingClientRect(), fr = (ev) => ({ x: lim((ev.clientX - R.left) / R.width, 0, 1), y: lim((ev.clientY - R.top) / R.height, 0, 1) });
    const p0 = fr(e), tipo = modo; let p1 = p0;
    const pinta = () => { guia.hidden = false; guia.style.left = Math.min(p0.x, p1.x) * 100 + "%"; guia.style.top = Math.min(p0.y, p1.y) * 100 + "%"; guia.style.width = Math.abs(p1.x - p0.x) * 100 + "%"; guia.style.height = Math.abs(p1.y - p0.y) * 100 + "%"; };
    const mv = (ev) => { p1 = fr(ev); if (VT(tipo) !== "clic") pinta(); };
    const fin = (ev) => {
      document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", fin, true); document.removeEventListener("pointercancel", fin, true);
      guia.hidden = true; if (ev.type === "pointercancel") return;
      let x = Math.min(p0.x, p1.x), y = Math.min(p0.y, p1.y), w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
      if (VT(tipo) === "clic") { w = .06; h = w * R.width / R.height; x = lim(p1.x - w / 2, 0, 1 - w); y = lim(p1.y - h / 2, 0, 1 - h); }
      else if (w < .02 || h < .012) {
        if (!DEF[VT(tipo)]) { api.aviso("Arrastra un recuadro más grande"); return; }
        [w, h] = DEF[VT(tipo)](R.width / R.height); w = Math.min(w, 1); h = Math.min(h, 1); x = lim(p1.x - w / 2, 0, 1 - w); y = lim(p1.y - h / 2, 0, 1 - h);
        if (SITIO[VT(tipo)]) [x, y] = SITIO[VT(tipo)];
      }
      const a = Math.floor(v.currentTime * 100) / 100, nuevo = { id: "e" + Date.now().toString(36) + (nid++), tipo, f: v.dataset.f, a, b: r2(Math.min(a + TIPOS[tipo].dur, (v.duration || a + TIPOS[tipo].dur))), x: r3(x), y: r3(y), w: r3(w), h: r3(h),
        ...(VT(tipo) === "flecha" ? { texto: FLECHA_TXT } : VT(tipo) === "texto" ? { texto: TIPOS[tipo].n } : {}) };
      tragarClic = true; setTimeout(() => { tragarClic = false; }, 400);   // el clic que sigue al soltar no da a reproducir
      apuntar(); FX.push(nuevo); sel = nuevo.id; selDentro = false; modo = null; pintarModo(); guardar(); api.aviso("Añadido: " + TIPOS[tipo].n + " en " + horaDe(nuevo));
    };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", fin, true); document.addEventListener("pointercancel", fin, true);
  }, true);
  let tragarClic = false;
  pant.addEventListener("click", (e) => { if (modo || tragarClic) { tragarClic = false; e.preventDefault(); e.stopPropagation(); } }, true);

  const horaDe = (e) => { const T = api.montDe(e.f, e.a, e.b); return T == null ? "cortado" : fmt(T); };
  const dura = (e) => (e.b - e.a).toFixed(1).replace(".", ",") + " s";
  const quien = (e) => (e.de === "claude" ? "propuesto por Claude" : "tuyo");
  // cambiar un campo propio del elegido (logo, imagen, rótulo, número): cuenta como ajuste y ⌘Z lo deshace
  function campo(nombre, valor) {
    const e = FX.find((x) => x.id === sel); if (!e) return;
    if ((e[nombre] == null ? "" : String(e[nombre])) === (valor == null ? "" : String(valor))) return;
    apuntar(); if (valor == null || valor === "") delete e[nombre]; else e[nombre] = valor; delete e.de; guardar();
  }
  function pintarPanel() {
    const e = FX.find((x) => x.id === sel);
    ficha.innerHTML = "";
    if (!e) ficha.appendChild(el("p", "x-fx-vacio", "Pulsa un efecto en la línea de tiempo para verlo aquí. Sobre el vídeo se mueve por el centro y cambia de tamaño por sus esquinas. Para quitarlo: su ✕, clic derecho en la línea o ⌫."));
    else {
      const cab = el("div", "x-fx-fcab"); cab.innerHTML = icoDe(e.tipo) + "<span><b></b><i></i></span>"; ficha.appendChild(cab);
      cab.querySelector("b").textContent = TIPOS[e.tipo].n + (e.q ? " · " + e.q : "");
      cab.querySelector("i").textContent = horaDe(e) + " · dura " + dura(e) + " · " + quien(e);
      // lo propio de cada tipo: qué logo, qué imagen, el rótulo de la flecha o el número del recuadro (se guarda al soltar o con Enter)
      if (V(e) === "flecha" || V(e) === "texto") {
        const l = el("label", "x-fx-campo"); l.appendChild(el("span", "", V(e) === "texto" ? "Texto" : "Rótulo"));
        const i = document.createElement("input"); i.type = "text"; i.maxLength = 120; i.value = e.texto || (V(e) === "flecha" ? FLECHA_TXT : TIPOS[e.tipo].n); i.setAttribute("aria-label", "Texto (Enter lo guarda)"); l.appendChild(i); ficha.appendChild(l);
        const ok = () => campo("texto", i.value.trim() || (V(e) === "flecha" ? FLECHA_TXT : TIPOS[e.tipo].n));
        i.addEventListener("change", ok); i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); i.blur(); } });
      }
      if (V(e) === "caja") {
        const l = el("label", "x-fx-campo"); l.appendChild(el("span", "", "Número"));
        const i = document.createElement("input"); i.type = "number"; i.min = "1"; i.max = "99"; i.step = "1"; i.placeholder = "sin"; i.value = e.num || ""; i.className = "x-fx-num-i"; i.setAttribute("aria-label", "Número del recuadro (vacío: sin número; Enter lo guarda)"); l.appendChild(i); ficha.appendChild(l);
        const ok = () => { const v = parseInt(i.value, 10); campo("num", v >= 1 && v <= 99 ? v : null); };
        i.addEventListener("change", ok); i.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); ev.stopPropagation(); i.blur(); } });
        if (e.num) { const q = boton(l, "x-lm-b x-fx-sinnum", "Quitar número", "Deja el recuadro sin número"); q.addEventListener("click", () => campo("num", null)); }
      }
      const ac = el("div", "x-fx-ac"); ficha.appendChild(ac);
      const b1 = boton(ac, "x-lm-b", "Empieza aquí ([)", "El efecto empieza donde está la aguja (tecla [)"), b2 = boton(ac, "x-lm-b", "Acaba aquí (])", "El efecto acaba donde está la aguja (tecla ])");
      const bc = boton(ac, "x-lm-b x-fx-bcom", "", "Comentar este efecto: el comentario va con él a Claude (tecla C)"); bc.innerHTML = ICO_FX.comentar + "<span>Comentar (C)</span>";
      const b3 = boton(ac, "x-lm-b x-fx-bq", "", "Quita este efecto (tecla ⌫)");
      b3.innerHTML = ICO_FX.papelera + "<span>Quitar (⌫)</span>";
      if (V(e) === "clic") { b1.textContent = "Ponerlo aquí ([)"; b1.title = "El clic pasa a sonar donde está la aguja (tecla [)"; b2.remove(); }
      b1.addEventListener("click", () => borde("a")); b2.addEventListener("click", () => borde("b")); b3.addEventListener("click", () => quitar()); bc.addEventListener("click", () => comentar(e.id));
      // comentarios sobre este efecto
      if ((e.com && e.com.length) || comAbierto) {
        const cs = el("div", "x-fx-com"); ficha.appendChild(cs); cs.appendChild(el("span", "x-fx-h", "Comentarios a este efecto"));
        (e.com || []).forEach((c, i) => {
          const f = el("div", "x-fx-comf"); f.appendChild(el("p", "", c));
          const q = boton(f, "x-lm-fb-x", "✕", "Borrar este comentario"); q.addEventListener("click", () => { apuntar(); e.com.splice(i, 1); if (!e.com.length) delete e.com; guardar(); }); cs.appendChild(f);
        });
        if (comAbierto) {
          const ta = document.createElement("textarea"); ta.className = "x-lm-fb-ta x-fx-com-ta"; ta.rows = 1; ta.placeholder = "Qué cambiarías de este efecto · Enter lo guarda"; ta.value = comBorr; ta.setAttribute("aria-label", "Comentario sobre este efecto: Enter lo guarda"); cs.appendChild(ta);
          let hecho = false;
          const guardarCom = (cerrar) => { const t = ta.value.trim(); hecho = true; comBorr = ""; if (cerrar) comAbierto = false; if (t) { apuntar(); e.com = (e.com || []).concat([t.slice(0, 500)]); guardar(); } else pintarPanel(); api.alCambiar(); };
          ta.addEventListener("input", () => { comBorr = ta.value; });
          ta.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); ev.stopPropagation(); guardarCom(true); } else if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); hecho = true; comAbierto = false; comBorr = ""; pintarPanel(); } });
          // lo escrito sin Enter también cuenta: al salir de la caja se guarda
          ta.addEventListener("blur", () => { if (!hecho && ta.isConnected && ta.value.trim()) guardarCom(true); });
          requestAnimationFrame(() => { if (ta.isConnected) ta.focus({ preventScroll: true }); });
        }
      }
    }
    const nc = FX.filter((x) => api.montDe(x.f, x.a, x.b) == null).length;
    cortados.hidden = !nc; cortados.textContent = nc + (nc === 1 ? " efecto cae" : " efectos caen") + " en trozos cortados: no salen en el vídeo.";
    sQ.hidden = !Q.length; hQ.textContent = "Quitados · " + Q.length; listaQ.innerHTML = "";
    Q.forEach((q) => {
      const f = el("div", "x-fx-qfila"); const t = el("span", "x-fx-qt"); t.innerHTML = icoDe(q.tipo) + "<span></span>"; t.lastChild.textContent = TIPOS[q.tipo].n + (q.q ? " · " + q.q : "") + " · " + horaDe(q); f.appendChild(t);
      const b = boton(f, "x-lm-b", "Volver a ponerlo", "Devuelve este efecto a su sitio"); b.addEventListener("click", () => volver(q.id)); listaQ.appendChild(f);
    });
  }
  function comentar(id) {
    const e = FX.find((x) => x.id === (id || sel)); if (!e) return api.aviso("Elige antes un efecto en la línea de tiempo");
    if (api.sonando()) api.pausa();
    if (sel !== e.id) comBorr = ""; sel = e.id; selDentro = false; comAbierto = true; cancelar();
    if (api.abrir) api.abrir(); pintarPanel(); tick(); api.alCambiar();
  }
  function borde(lado) {
    const e = FX.find((x) => x.id === sel), v = api.video(); if (!e || !v) return api.aviso("Elige antes un efecto en la línea de tiempo");
    if (v.dataset.f !== e.f) return api.aviso("La aguja está en otra grabación");
    const t = r2(v.currentTime);
    if (V(e) === "clic") { const d = e.b - e.a; apuntar(); e.a = t; e.b = r2(t + d); }
    else if (lado === "a") { if (t >= e.b - .1) return api.aviso("Tiene que empezar antes de su final"); apuntar(); e.a = t; }
    else { if (t <= e.a + .1) return api.aviso("Tiene que acabar después de su principio"); apuntar(); e.b = t; }
    delete e.de; guardar();
  }
  function quitar(id) {
    const i = FX.findIndex((x) => x.id === (id || sel)); if (i < 0) return false;
    apuntar(); const e = FX[i]; FX.splice(i, 1); Q.push(e); if (sel === e.id) { sel = null; comAbierto = false; } guardar(); api.aviso(TIPOS[e.tipo].n + " quitado (⌘Z lo deshace)"); return true;
  }
  function volver(id) { const i = Q.findIndex((x) => x.id === id); if (i < 0) return; apuntar(); const e = Q[i]; Q.splice(i, 1); FX.push(e); sel = e.id; selDentro = false; guardar(); api.aviso(TIPOS[e.tipo].n + " vuelve a su sitio"); }
  // mover o estirar desde la línea de tiempo (a y b en segundos de la grabación)
  function ajustar(id, a, b) {
    const e = FX.find((x) => x.id === id); if (!e) return;
    a = r2(Math.max(0, a)); b = r2(Math.max(a + .1, b)); if (a === e.a && b === e.b) return;
    apuntar(); e.a = a; e.b = b; delete e.de; sel = id; selDentro = false; guardar();
  }
  function elegir(id, ir) {
    const e = id && FX.find((x) => x.id === id);
    if (!e || e.id !== sel) {   // un comentario a medias no se pierde al soltar el efecto: se guarda con él
      const s0 = comAbierto && comBorr.trim() && FX.find((x) => x.id === sel);
      if (s0) { apuntar(); s0.com = (s0.com || []).concat([comBorr.trim().slice(0, 500)]); try { localStorage.setItem(CLAVE, JSON.stringify({ fx: FX, quitados: Q, env })); } catch (err) {} }
      comAbierto = false; comBorr = "";
    }
    sel = e ? e.id : null; selDentro = false; if (e) cancelar();
    if (e && ir) { const v = api.video(), t = v && v.dataset.f === e.f ? v.currentTime : null; if (t == null || t < e.a - .02 || t > e.b) api.ir(e.f, e.a, e.b); }
    pintarPanel(); tick(); api.alCambiar();
  }

  // teclas propias del paso Edición (el editor las pasa todas: las pistas se ven siempre)
  function tecla(k) {
    const tipo = Object.keys(TIPOS).find((t) => TIPOS[t].k === k);
    if (tipo) { api.abrir && api.abrir(); empezar(tipo); return true; }
    if (k === "Escape") { if (cancelar()) return true; if (sel) { elegir(null); return true; } return false; }
    if (k === "[") { borde("a"); return true; }
    if (k === "]") { borde("b"); return true; }
    if ((k === "c" || k === "C") && sel) { comentar(sel); return true; }
    if ((k === "Backspace" || k === "Delete") && sel) return quitar();
    return false;
  }
  new ResizeObserver(() => tick()).observe(pant);
  pintarModo(); pintarPanel();
  return {
    tick, tecla, cancelar, pend, n: () => FX.length, hay: () => FX.length > 0, repintar: pintarPanel,
    todos: () => FX, elegido: () => sel, elegir, ajustar, quitar, borde, comentar, nQuitados: () => Q.length,
    deshacer: () => volverA(hist, fut), rehacer: () => volverA(fut, hist), nDes: () => hist.length, nReh: () => fut.length,
    cambios: () => cambiosFx(semilla, FX, nombreF),
    texto: () => textoFx(FX, nombreF, api.dims, api.enCorte),
    comentarios: () => comentariosFx(FX, nombreF, (e) => { const T = api.montDe(e.f, e.a, e.b); return T == null ? null : fmt(T); }),
    enviado: () => { env = firma(FX); guardar(); },
  };
}
