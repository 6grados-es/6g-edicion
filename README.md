# Edición · 6 Grados

App local para llevar los vídeos de redes por cuatro etapas: **Idea → Guion → Corte → Edición**. La persona trabaja en la web; su Claude hace cada versión nueva con el botón «Copiar a Claude» de cada etapa. La app no sabe cómo le gustan los vídeos a nadie: eso lo aprende el cerebro de cada persona (ver `CLAUDE.md`).

## Instalar (en el Mac de la persona)
```bash
mkdir -p ~/6g-edicion && curl -fsSL https://github.com/6grados-es/6g-edicion/archive/refs/heads/main.tar.gz | tar -xz --strip-components 1 -C ~/6g-edicion
bash ~/6g-edicion/instalar.sh
```
No hace falta git ni cuenta de GitHub. La misma orden pone la app al día sin tocar `datos/`.
Instala con Homebrew `node`, `ffmpeg` y `whisper-cpp`, baja el modelo de transcripción (~470 MB, una vez) y abre http://localhost:4710. Después: doble clic en `Abrir edición.command`.

## Qué hay
- `servidor.mjs`: servidor local sin dependencias (127.0.0.1:4710). Cada vídeo es una carpeta en `datos/videos/<id>/`.
- `web/`: la web (sin librerías), con la imagen de Reuniones de 6 Grados, claro y oscuro.
- `web/editor/`: el editor de Corte y Edición, traído del editor de las clases de 6 Grados (recortar, recuperar desde o hasta la aguja, imán, reordenar trozos y partes, velocidad; en Edición, las pistas Notas, Vídeo, Visual y Sonido y el catálogo de efectos de cada persona, con su emoji y cómo se hace cada uno, en `datos/efectos.json`). Un ajuste (tecla V) enseña u oculta lo quitado en la línea de tiempo.
- `herramientas/transcribir.mjs` y `herramientas/montar.mjs`: lo que usa su Claude para transcribir y montar el corte. Mientras se revisa, todo sale en borrador (rápido y ligero); la calidad alta se hace solo con la versión final (`--final`, en `final/`, sin pisar nada).
- `CLAUDE.md`: lo que lee su Claude (archivos, forma de `video.json` y receta de cada etapa).
- `scripts/capturas.mjs`: capturas de todas las pantallas para revisar el diseño.

`datos/` no se sube nunca: son los vídeos de cada persona.
