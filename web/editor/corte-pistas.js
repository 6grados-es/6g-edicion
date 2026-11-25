// Las PISTAS del paso Edición, bajo la línea de tiempo del montaje (que en Edición es fija: el corte ya está hecho).
// «la línea del vídeo y luego… la línea de audio de efectos de sonido… donde aparece lo del click… luego la línea
// de efectos visuales… que sea claramente en la línea de tiempo donde están los efectos». Forma copiada de una mesa de edición
// (filas con icono, barras, aguja que las cruza, notas como puntos, clic derecho); estilo de la app de clases.
//   Notas  · un punto por nota de feedback con minuto (clic: va a ese punto y abre Feedback)
//   Vídeo  · los trozos del corte (los pinta el editor; aquí solo su etiqueta)
//   Visual · desenfoque, zoom, recuadro, subrayado, logo, flecha, lupa e imagen: una barra con su icono del largo de su tramo; lo que se pisa baja a otra fila
//   Sonido · los clics
// Una marca se elige con un clic (y la aguja va a su inicio si estaba fuera), se estira por sus bordes (8 px), se mueve por el
// centro y se quita con el clic derecho (que también lo comenta: un cuadradito blanco en la marca dice que lleva comentario). Las posiciones salen de la geometría de los trozos ya pintados: x = borde del trozo +
// fracción del tiempo montado dentro de él.
import { TIPOS, ICO_FX, V, icoDe } from "./corte-fx.js";

const FILA = 26, ROTULO = 76, BORDE = 8;

export function crearPistas(carril, api) {
  // api: { el, boton, fmt, fx, lista(), M(), elBl, izq(el), saltos(p), aMontaje, pps(), video(), notas(), irNota(n), menu(ev, ops) }
  const { el, fx } = api;
  const capa = el("div", "x-pz"); capa.setAttribute("aria-label", "Pistas de la edición");
  let marcas = [];
  const etiqueta = (padre, txt, ico) => { const r = el("div", "x-pz-rot"); r.innerHTML = (ico || "") + "<span></span>"; r.lastChild.textContent = txt; padre.appendChild(r); return r; };
  function fila(cls, top, alto, txt, ico) { const f = el("div", "x-pz-fila " + cls); f.style.top = top + "px"; f.style.height = alto + "px"; etiqueta(f, txt, ico); capa.appendChild(f); return f; }
  // x (en el carril) de un segundo `t` de la grabación dentro del trozo i del montaje
  function xDe(i, t) {
    const L = api.lista(), M = api.M(), p = L[i], b = p && api.elBl.get(p.id);
    if (!b || !M[i] || !M[i].d) return null;
    return api.izq(b) + b.offsetWidth * Math.max(0, Math.min(1, api.aMontaje(p, t, api.saltos(p)) / M[i].d));
  }
  // el tramo [x0, x1] de un efecto: la primera racha de trozos seguidos del montaje donde se ve
  function tramo(e) {
    const L = api.lista(); let x0 = null, x1 = null, prev = -2;
    for (let i = 0; i < L.length; i++) {
      const p = L[i], toca = p.f === e.f && p.b > e.a + .01 && p.a < e.b - .01;
      if (!toca) { if (x0 != null) break; continue; }
      if (x0 != null && i !== prev + 1) break;
      const a = xDe(i, Math.max(p.a, e.a)), b = xDe(i, Math.min(p.b, e.b)); if (a == null) continue;
      if (x0 == null) x0 = a; x1 = b; prev = i;
    }
    return x0 == null ? null : [x0, x1];
  }
  const velEn = (e) => { const p = api.lista().find((q) => q.f === e.f && e.a >= q.a - .02 && e.a <= q.b + .02); return p && p.vel > 1 ? p.vel : 1; };

  function pintar() {
    capa.textContent = ""; marcas = [];
    const g = carril.querySelector(".x-lm-grupo"), bl = carril.querySelector(".x-lm-bl");
    if (!g || !bl) return;
    const cr = carril.getBoundingClientRect(), top0 = g.getBoundingClientRect().bottom - cr.top + 10, blTop = bl.getBoundingClientRect().top - cr.top;
    // Visual: se reparten en filas para que nada se tape
    const FX = fx.todos(), sel = fx.elegido();
    const vis = [], son = [];
    FX.forEach((e) => { const r = tramo(e); if (!r) return; (TIPOS[e.tipo].pista === "sonido" ? son : vis).push({ e, x0: r[0], x1: r[1] }); });
    vis.sort((p, q) => p.x0 - q.x0); const fin = [];
    vis.forEach((m) => { const w = Math.max(14, m.x1 - m.x0); let k = fin.findIndex((x) => x <= m.x0 - 2); if (k < 0) { k = fin.length; fin.push(0); } fin[k] = m.x0 + w; m.k = k; });
    const nV = Math.max(1, fin.length), hV = nV * FILA;
    // filas: Notas arriba (en el hueco del carril), Vídeo (solo su rótulo, encima de los trozos), Visual y Sonido debajo
    const fN = fila("x-pz-notas", 0, 22, "Notas", ICO_FX.nota);
    fila("x-pz-video", blTop, bl.offsetHeight, "Vídeo", ICO_FX.video);
    const fV = fila("x-pz-visual", top0, hV, "Visual", ICO_FX.visual);
    const fS = fila("x-pz-sonido", top0 + hV + 6, FILA, "Sonido", ICO_FX.sonido);
    carril.style.paddingBottom = (hV + 6 + FILA + 10) + "px";
    const marca = (padre, m, k) => {
      const e = m.e, clic = V(e) === "clic", w = clic ? 20 : Math.max(14, m.x1 - m.x0);
      const b = el("button", "x-pz-m x-pz-" + V(e) + (e.id === sel ? " x-pz-sel" : "") + (e.de === "claude" ? "" : " x-pz-tuyo") + (w < 24 ? " x-pz-estrecha" : "")); b.type = "button"; b.dataset.id = e.id;
      b.style.left = (clic ? m.x0 - 10 : m.x0) + "px"; b.style.width = w + "px"; b.style.top = (k * FILA + 3) + "px"; b.style.height = (FILA - 6) + "px";
      b.innerHTML = icoDe(e.tipo) + (w >= 70 ? "<span></span>" : "");
      if (w >= 70) b.lastChild.textContent = e.q || TIPOS[e.tipo].n;
      if (!clic && w >= 20) { b.appendChild(el("i", "x-pz-b x-pz-ba")); b.appendChild(el("i", "x-pz-b x-pz-bb")); }
      const nc = (e.com || []).length; if (nc) b.appendChild(el("i", "x-pz-cd"));
      const t = TIPOS[e.tipo].n + (e.q ? " · " + e.q : "") + " · dura " + (e.b - e.a).toFixed(1).replace(".", ",") + " s" + (e.de === "claude" ? " · propuesto" : " · tuyo") + (nc ? " · " + nc + (nc === 1 ? " comentario" : " comentarios") : "");
      b.title = t + " · clic: elegir · arrastra para moverlo" + (clic ? "" : " o sus bordes para estirarlo") + " · clic derecho: más"; b.setAttribute("aria-label", t);
      padre.appendChild(b); marcas.push({ el: b, e, m });
    };
    vis.forEach((m) => marca(fV, m, m.k)); son.forEach((m) => marca(fS, m, 0));
    // notas de feedback con minuto: un punto
    (api.notas() || []).forEach((n) => {
      if (n.T == null) return; const L = api.lista(), i = L.findIndex((p) => p.f === n.f && n.t >= p.a - .02 && n.t <= p.b + .02); if (i < 0) return;
      const x = xDe(i, n.t); if (x == null) return;
      const d = el("button", "x-pz-nota"); d.type = "button"; d.style.left = (x - 7) + "px"; d.title = api.fmt(n.T) + " · " + (n.txt.trim() || "nota sin texto"); d.setAttribute("aria-label", "Nota en " + d.title);
      d.addEventListener("click", (ev) => { ev.stopPropagation(); api.irNota(n); api.verFb(); }); fN.appendChild(d);
    });
    if (!capa.isConnected) carril.appendChild(capa);
    tick();
  }
  // la marca que está bajo la aguja se enciende
  function tick() {
    const v = api.video(); if (!v) return; const t = v.currentTime, f = v.dataset.f;
    marcas.forEach(({ el: b, e }) => b.classList.toggle("x-pz-bajo", e.f === f && t >= e.a && t < e.b));
  }

  // elegir, mover y estirar (los clics solo se mueven)
  capa.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    const b = ev.target.closest(".x-pz-m");
    if (!b) { if (ev.target.closest(".x-pz-visual, .x-pz-sonido") && !ev.target.closest(".x-pz-rot")) fx.elegir(null); return; }
    ev.preventDefault(); ev.stopPropagation();
    const yo = marcas.find((x) => x.el === b); if (!yo) return;
    const e = yo.e, borde = ev.target.closest(".x-pz-b"), lado = borde ? (borde.classList.contains("x-pz-ba") ? "a" : "b") : null;
    const x0 = ev.clientX, l0 = parseFloat(b.style.left), w0 = parseFloat(b.style.width), k = velEn(e);
    let movido = false, a = e.a, bb = e.b;
    const mv = (m) => {
      const dx = m.clientX - x0; if (!movido && Math.abs(dx) < 3) return; movido = true; b.classList.add("x-pz-coge");
      const dt = (dx / Math.max(.01, api.pps())) * k;
      if (lado === "a") { a = Math.max(0, Math.min(e.b - .1, e.a + dt)); bb = e.b; const nw = Math.max(14, w0 - (a - e.a) / k * api.pps()); b.style.left = (l0 + w0 - nw) + "px"; b.style.width = nw + "px"; }
      else if (lado === "b") { a = e.a; bb = Math.max(e.a + .1, e.b + dt); b.style.width = Math.max(14, w0 + (bb - e.b) / k * api.pps()) + "px"; }
      else { const d = Math.max(-e.a, dt); a = e.a + d; bb = e.b + d; b.style.left = (l0 + d / k * api.pps()) + "px"; }
      b.title = (Math.round(a * 100) / 100) + "–" + (Math.round(bb * 100) / 100) + " s de la grabación";
    };
    const fin = (m) => {
      document.removeEventListener("pointermove", mv, true); document.removeEventListener("pointerup", fin, true); document.removeEventListener("pointercancel", fin, true);
      b.classList.remove("x-pz-coge");
      if (m.type === "pointercancel") return pintar();
      if (!movido) return fx.elegir(e.id, true);
      fx.ajustar(e.id, a, bb);
    };
    document.addEventListener("pointermove", mv, true); document.addEventListener("pointerup", fin, true); document.addEventListener("pointercancel", fin, true);
  });
  capa.addEventListener("contextmenu", (ev) => {
    const b = ev.target.closest(".x-pz-m"); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const yo = marcas.find((x) => x.el === b); if (!yo) return; const e = yo.e;
    fx.elegir(e.id, false);
    api.menu(ev, [["Ir a este efecto", () => fx.elegir(e.id, true), icoDe(e.tipo)],
      V(e) === "clic" ? ["Ponerlo en la aguja ([)", () => fx.borde("a"), ICO_FX.clic] : ["Empieza en la aguja ([)", () => fx.borde("a"), ICO_FX.visual],
      V(e) !== "clic" && ["Acaba en la aguja (])", () => fx.borde("b"), ICO_FX.visual],
      ["Comentar (C)", () => fx.comentar(e.id), ICO_FX.comentar],
      ["Quitar (⌫)", () => fx.quitar(e.id), ICO_FX.papelera]]);
  });
  return { pintar, tick, ROTULO };
}
