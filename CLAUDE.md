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
| `corte-vN.mp4` | El corte montado (sale de `herramientas/montar.mjs`). |
| `edicion-v1.mp4`, `edicion-v2.mp4`… | Cada versión de la edición. No borres las anteriores. |
| `.onda-*.json` | La forma del sonido para la línea de tiempo. La hace la web; no los toques. |

`video.json`:
```json
{
  "titulo": "…", "etapa": "idea | guion | corte | edicion | terminado", "creado": "AAAA-MM-DD",
  "idea": "lo que quiere contar",
  "guion":   { "version": 2 },
  "corte":   { "fuente": "grabacion.mov", "version": 1, "montado": "corte-v1.mp4",
               "piezas": [ { "a": 0, "b": 3.4, "fuera": false }, { "a": 3.4, "b": 5.1, "fuera": true } ] },
  "edicion": { "version": 1, "video": "edicion-v1.mp4" },
  "feedback": { "guion": [ { "id": "…", "texto": "…", "v": 2 } ],
                "corte": [ { "id": "…", "texto": "…", "v": 1, "t": 12.4, "T": 9.8 } ],
                "edicion": [] }
}
```
- `corte.piezas` cubre **toda** la grabación, en orden y sin huecos: `a`–`b` en segundos de la grabación original; `"fuera": true` es lo que se corta. Lo que la persona ha cortado o recuperado a mano en la web se respeta.
- En `feedback`, `v` es la versión que comenta; `T` es el minuto del vídeo tal como lo ve (en el corte, ya cortado) y `t` el segundo del archivo. No borres comentarios: cuando subes la versión, los de la anterior quedan como historial.
- `etapa` solo avanza: la mueve la persona con su botón; tú la pones solo cuando el texto de «Copiar a Claude» te lo dice.

## Cada etapa
**Idea → Guion.** Escribe `guion-v1.md` con su idea y su estilo. Un guion por escenas: qué se ve, qué se dice (o la voz en off) y el texto en pantalla si lo hay, con el gancho al principio. Pon `guion.version` y `etapa: "guion"`.

**Guion vN → vN+1.** Parte de `guion-vN.md` tal como está (puede haberlo retocado), aplica sus comentarios con `v: N` y escribe `guion-vN+1.md`; sube `guion.version`.

**Corte.** Con la grabación ya subida:
1. Si no hay `transcripcion.json`: `node herramientas/transcribir.mjs "<carpeta del vídeo>"` (baja el modelo la primera vez).
2. Propón las piezas: fuera silencios de más de ~0,7 s, arranques en falso, muletillas y tomas repetidas (de lo repetido, la última toma bien dicha), sin cortar dentro de una palabra (usa los tiempos de la transcripción y deja unas décimas de aire). Respeta lo que ya haya cortado o recuperado ella, y sus comentarios con `v` igual a la versión actual.
3. Escribe `corte.piezas` y sube `corte.version`.

**Edición.**
1. Monta el corte: `node herramientas/montar.mjs "<carpeta del vídeo>"` → `corte-vN.mp4`.
2. Edítalo con ffmpeg (o lo que tengas) según su estilo: formato vertical 1080×1920 para reels si no dice otra cosa, subtítulos quemados si los usa, texto del gancho, música solo si te da una. Guarda cómo lo has hecho (comandos y decisiones) en `edicion-vN.json` para poder rehacerlo.
3. Guarda `edicion-vN.mp4`, pon `edicion: {"version": N, "video": "edicion-vN.mp4"}` y, si te lo pide el texto, `etapa: "edicion"`.
4. Para la siguiente versión, parte de `edicion-vN.json` y aplica sus comentarios con minuto (`T`).

## No
- No cambies `index.html`, `app.js`, `estilo.css` ni `servidor.mjs` salvo que te pidan cambiar la app.
- No borres vídeos, grabaciones ni versiones viejas sin que te lo pida.
- No publiques nada en redes: la app termina en Edición.
