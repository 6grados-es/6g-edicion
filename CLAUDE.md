# App de edición de 6 Grados (lo lee Claude)

Web local para llevar vídeos de redes por cuatro etapas: **Idea → Guion → Corte → Edición**. La persona trabaja en la web; tú haces cada versión nueva cuando te pega el texto de «Copiar a Claude». La app es un hueco: **no sabe cómo le gustan los vídeos a nadie**. Eso vive en su cerebro.

## Antes de cada encargo
1. Lee en su cerebro lo que haya sobre sus vídeos, sus redes y su estilo (busca «vídeos», «redes», «guion», «reels», «Instagram», el nombre de su marca). Si no hay nada, mira cómo son sus vídeos publicados y pregúntale lo que dudes antes de inventar.
2. Haz el encargo (abajo, por etapa).
3. **Aprende**: lo que te diga en sus comentarios que valga para la próxima vez («los ganchos más cortos», «nada de música», «subtítulos en amarillo») apúntalo en su cerebro, en la ficha de sus vídeos o redes (créala si no existe), con sus palabras. Así cada versión sale mejor sin repetirlo.
4. Dile en una línea que ya está: la web lo enseña sola (vigila los archivos cada 2 s).

## Arrancar
- Doble clic en `Abrir edición.command` (o `node servidor.mjs` en segundo plano desde esta carpeta) y abre http://localhost:4710. Si ya está abierta, no pasa nada.
- Necesita Node.js. Para Corte y Edición, también `ffmpeg` y `whisper-cpp` (`brew install ffmpeg whisper-cpp`).

## Dónde está cada cosa
Cada vídeo es una carpeta: `datos/videos/<id>/` (el id es `AAAA-MM-DD-titulo`). Dentro:

| Archivo | Qué es |
|---|---|
| `video.json` | Todo lo del vídeo (forma abajo). Lo escribe también la web: léelo justo antes de cambiarlo y cambia solo tus campos. |
| `guion-v1.md`, `guion-v2.md`… | Cada versión del guion. No borres las anteriores. La persona puede retocar la última en la web: sus cambios mandan. |
| La grabación (`*.mov`, `*.mp4`) | La sube la persona; su nombre está en `corte.fuente`. No la toques. |
| `transcripcion.json` | Texto de la grabación con el tiempo de cada palabra: `{"palabras": [{"p": "Hola", "a": 0.32, "b": 0.61}, …]}` (segundos de la grabación original). |
| `corte-vN.mp4` | El corte montado en borrador (sale de `herramientas/montar.mjs`). |
| `edicion-v1.mp4`, `edicion-v2.mp4`… | Cada versión de la edición, en borrador, y cómo se hizo en `edicion-vN.json`. No borres las anteriores. |
| `.onda-*.json` | La forma del sonido para la línea de tiempo. La hace la web; no los toques. |

| `final/` | Las versiones finales en alta calidad (solo cuando la persona da el vídeo por bueno). Nunca se pisan. |
| `encargo-<etapa>.md` | Lo último que la persona copió para ti en esa etapa (por si no te llega bien pegado). |
| `datos/efectos.json` | Su catálogo de efectos (fuera de las carpetas de vídeo): `[{"id", "icono", "nombre", "como", "vista", "dur", "emoji"?}]` (`icono`: uno de los iconos planos de la web, como zoom, texto, caja, blur, clic, estrella, flecha, lupa, raya, imagen, sonido, musica, corazon, check, comentar o video; `emoji` solo en los de vista «emoji»: es lo que sale en el vídeo). `como` dice cómo se hace ese efecto: síguelo al pie de la letra. Si te pide uno que no está, hazlo y añádelo con su icono y cómo lo has hecho. |

`video.json`:
```json
{
  "titulo": "…", "etapa": "idea | guion | corte | edicion | terminado", "creado": "AAAA-MM-DD",
  "idea": "lo que quiere contar",
  "guion":   { "version": 2 },
  "corte":   { "fuente": "grabacion.mov", "version": 2, "montado": "corte-v2.mp4",
               "piezas": [ { "id": "p1", "f": "g", "a": 0.4, "b": 3.4, "t": "Hola, hoy…" },
                           { "id": "p3", "f": "g", "a": 8.1, "b": 12.0, "t": "…", "vel": 1.5 } ],
               "silencio": { "min": 0.7, "deja": 0.3 } },
  "edicion": { "version": 1, "video": "edicion-v1.mp4", "sobre": 2, "piezas": [ … las del corte v2 … ],
               "efectos": [ { "id": "e1", "tipo": "zoom", "f": "g", "a": 1.2, "b": 3.2, "x": 0.2, "y": 0.3, "w": 0.5, "h": 0.3 } ],
               "final": "final/edicion-v1.mp4" }
}
```
- `corte.piezas` son **las que se quedan, en el orden del vídeo final** (la persona puede reordenarlas en la web): `a`–`b` en segundos de la grabación original, `f` = qué grabación (`"g"` es `corte.fuente`). Opcionales: `s` (parte a la que pertenece), `vel` (cámara rápida), `v: 1` (pieza sin voz: no se le quitan silencios). Lo que la persona deja hecho a mano en la web te llega en el encargo: respétalo.
- `corte.silencio` solo si la persona lo quiere (lo dice su cerebro): dentro de cada pieza, los silencios de `min` s o más se quedan en `deja` s, como en la vista previa.
- Los comentarios (generales y con su minuto) y los efectos que pone en la web **te llegan en el texto que pega**; no están en `video.json`.
- `etapa` solo avanza: la mueve la persona con sus botones; tú la pones solo cuando el texto te lo dice.

## Borrador mientras se revisa, alta calidad solo al final
Mientras la persona revisa, cada versión es un **borrador**: rápido y ligero (alto ≤ 1280, `-preset veryfast -crf 23`). Así cada vuelta tarda poco. La calidad alta se hace **solo cuando da el vídeo por bueno**, en un archivo aparte dentro de `final/`, y sin tocar nada de lo que ya vio:
- Desde la grabación original (no desde el borrador): `node herramientas/montar.mjs "<carpeta>" --final` y rehaz encima la edición que aprobó (la de `edicion-vN.json`), a 1080×1920 si es vertical.
- `libx264 -crf 18 -preset medium -pix_fmt yuv420p -movflags +faststart`, audio AAC 192k.
- Un final **no se pisa nunca**: si ya existe, el nuevo va con `-2`, `-3`…
- Apunta en `video.json` `edicion.final` con la ruta del archivo final.

## Cada etapa
**Idea → Guion.** Escribe `guion-v1.md` con su idea y su estilo. Un guion por escenas: qué se ve, qué se dice (o la voz en off) y el texto en pantalla si lo hay, con el gancho al principio. Pon `guion.version` y `etapa: "guion"`.

**Guion vN → vN+1.** Parte de `guion-vN.md` tal como está (puede haberlo retocado) y de sus comentarios del texto que pega, y escribe `guion-vN+1.md`; sube `guion.version`.

**Corte.** Con la grabación ya subida:
1. Si no hay `transcripcion.json`: `node herramientas/transcribir.mjs "<carpeta del vídeo>"` (baja el modelo la primera vez).
2. Propón las piezas: fuera silencios largos, arranques en falso, muletillas y tomas repetidas (de lo repetido, la última toma bien dicha), sin cortar dentro de una palabra (usa los tiempos de la transcripción y deja unas décimas de aire). Si el encargo trae una lista de piezas hecha por ella, esa manda.
3. Escribe `corte.piezas`, sube `corte.version` y monta el borrador: `node herramientas/montar.mjs "<carpeta del vídeo>"` → `corte-vN.mp4`.

**Edición.** La persona pone en la web los efectos de su catálogo (con su sitio en el vídeo y su tiempo) y sus comentarios; todo te llega en el texto.
1. Parte del corte montado (`corte-vN.mp4`; si no está, móntalo) y edítalo según su estilo y su catálogo: cada efecto, como dice su «cómo se hace». Formato vertical 1080×1920 para reels si no dice otra cosa.
2. Guarda el borrador `edicion-vN.mp4` y cómo lo has hecho (órdenes y decisiones, efecto por efecto) en `edicion-vN.json` para poder rehacerlo.
3. Pon en `video.json` lo que diga el encargo (`edicion.version`, `video`, `sobre`, `piezas`, `efectos`).
4. Cuando la dé por buena: la versión final en alta calidad (arriba) y apunta en su cerebro lo aprendido.

## No
- No cambies nada de `web/` ni `servidor.mjs` salvo que te pidan cambiar la app.
- No borres vídeos, grabaciones ni versiones viejas sin que te lo pida.
- No publiques nada en redes: la app termina en Edición.
