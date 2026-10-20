# Vídeo Sarnago

Herramienta interna para crear Reels de apoyo a la campaña **Abrigar el Refugio**: portada a partir de un fotograma, subtítulos revisables, footer y cierre con QR a la campaña de Goteo.

## Uso

1. Sube el vídeo (vertical u horizontal) y escribe nombre y cargo. La portada usa un fotograma del vídeo o una imagen que subas.
2. Si hace falta, recorta el principio y el final con «Empezar aquí» y «Terminar aquí».
3. Genera los subtítulos automáticamente (Whisper, en el navegador) o importa un SRT, y revísalos.
4. Descarga la portada PNG (vertical/horizontal y 4:5 para la cuadrícula).
5. Pulsa **Crear Reel**. El MP4 se genera fotograma a fotograma desde el archivo original con FFmpeg.wasm (no se graba la pantalla). Se descarga como `26CrowdfundingVideo_NOMBRE.mp4`.

El enlace de la campaña es fijo (https://www.goteo.org/project/abriguemos-el-refugio): el QR y el footer lo usan automáticamente.

**Privacidad:** el vídeo se procesa en tu navegador y no se sube a ningún servidor. **No subas los vídeos originales a este repositorio** (es público); guárdalos en Drive. `.gitignore` ya bloquea los archivos de vídeo.

## Rendimiento

- La web se sirve con aislamiento de origen (cabeceras COOP/COEP en `vercel.json` y `vite.config.js`). Así FFmpeg usa su versión multihilo (hasta 4 hilos) y Whisper también usa varios hilos. Si el navegador no lo permite (p. ej. Safari), todo funciona igual con un solo hilo.
- Whisper usa la tarjeta gráfica (WebGPU) cuando está disponible; si falla, pasa al procesador automáticamente y, como último recurso, al modo de un solo hilo.
- FFmpeg se precarga en cuanto eliges el vídeo y lee el archivo original sin copiarlo entero a memoria (WORKERFS).
- Cada entrada y filtro de FFmpeg fija su número de hilos: el valor automático depende de los núcleos y, en ordenadores con muchos, agota los 32 hilos del motor wasm y lo bloquea. Si aun así se bloquea (60 s sin actividad), se repite automáticamente con un solo hilo.
- FFmpeg (~31 MB) y ONNX Runtime (~21 MB) se cargan desde jsDelivr para no llenar la cuota de Vercel. El modelo de Whisper se descarga de Hugging Face la primera vez y queda en la caché del navegador (con tarjeta gráfica la descarga es mayor, ~590 MB; con procesador, ~250 MB).

Se recomienda Chrome actualizado en ordenador y vídeos de 30–90 s.

## Orientación

Se detecta con las dimensiones que decodifica el navegador. Vertical: 720 × 1280 o 1080 × 1920. Horizontal: 1280 × 720 o 1920 × 1080, con portada y cierre en dos columnas y el encuadre completo ajustado con márgenes del color de marca. La portada para cuadrícula siempre es 4:5.

## Recorte

Los subtítulos se editan con los tiempos del vídeo original. Al exportar el MP4 o el SRT se quitan los que quedan fuera del recorte, se ajustan los que cruzan los bordes y se desplazan al nuevo inicio. La voz se recorta en sincronía; la música no cambia.

## Subtítulos

Bloques de hasta cinco palabras, hasta dos líneas, en caja centrada. Si solo hay tiempos de frase completa, la duración se reparte según el número de palabras, conservando todo el texto.

## Desarrollo

```bash
npm install
npm run dev      # con las mismas cabeceras COOP/COEP que producción
npm run build
node --test export-plan.test.mjs subtitles.test.mjs ffmpeg.test.mjs
```

Vite, JavaScript nativo, canvas, qrcode, Transformers.js y FFmpeg.wasm. Despliegue estático en Vercel.

Estructura de `src/`: `app.js` (interfaz), `visuals.js` (diseño de portada, subtítulos y cierre), `offline-export.js` + `export-plan.js` (render con FFmpeg), `ffmpeg.js` (carga del motor y lectura del archivo), `transcribe.js` + `whisper.worker.js` (subtítulos automáticos), `subtitles.js`, `trim.js`, `layout.js`, `campaign.js`.

Música: “First Light Particles”, Yoiyami · CC0.
