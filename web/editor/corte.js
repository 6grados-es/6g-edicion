// Dos utilidades del editor: el formato de minutos y mover un elemento de una lista (traídas del editor de las clases de 6 Grados).
export const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
// Mueve el elemento de `desde` a la posición `hasta` (índices de la lista de antes; hasta = 0..n-1 deja ahí el elemento).
export function mover(lista, desde, hasta) {
  if (desde < 0 || desde >= lista.length) return lista.slice();
  hasta = Math.max(0, Math.min(lista.length - 1, hasta));
  const r = lista.slice(); const [x] = r.splice(desde, 1); r.splice(hasta, 0, x); return r;
}
