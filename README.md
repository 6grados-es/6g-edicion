# Edición · 6 Grados

App local para llevar los vídeos de redes por cuatro etapas: **Idea → Guion → Corte → Edición**. La persona trabaja en la web; su Claude hace cada versión nueva con el botón «Copiar a Claude» de cada etapa. La app no sabe cómo le gustan los vídeos a nadie: eso lo aprende el cerebro de cada persona (ver `CLAUDE.md`).

## Instalar (en el Mac de la persona)
```bash
git clone https://github.com/6grados-es/6g-edicion.git ~/6g-edicion
bash ~/6g-edicion/instalar.sh
```
Instala con Homebrew `node`, `ffmpeg` y `whisper-cpp`, baja el modelo de transcripción (~470 MB, una vez) y abre http://localhost:4710. Después: doble clic en `Abrir edición.command`.

## Qué hay
- `servidor.mjs`: servidor local sin dependencias (127.0.0.1:4710). Cada vídeo es una carpeta en `datos/videos/<id>/`.
- `web/`: la web (sin librerías), con la imagen de Reuniones de 6 Grados, claro y oscuro.
- `herramientas/transcribir.mjs` y `herramientas/montar.mjs`: lo que usa su Claude para transcribir y montar el corte.
- `CLAUDE.md`: lo que lee su Claude (archivos, forma de `video.json` y receta de cada etapa).
- `scripts/capturas.mjs`: capturas de todas las pantallas para revisar el diseño.

`datos/` no se sube nunca: son los vídeos de cada persona.
