# Vídeo Sarnago

Herramienta interna para crear Reels de apoyo a la campaña **Abrigar el Refugio**, con portada a partir de un fotograma, subtítulos revisables, footer y cierre con QR.

## Uso

1. Sube el vídeo vertical y una imagen para la portada; escribe nombre y cargo.
2. Introduce la URL **real de la nueva campaña** de Goteo en Ajustes.
3. Genera los subtítulos automáticamente (Whisper en el navegador) o importa un SRT y revísalos.
4. Descarga la portada PNG (1080×1920 o 1080×1350).
5. Pulsa **Crear Reel**. Mantén la pestaña visible: se graba en tiempo real. Si el navegador no soporta MP4 nativo, la aplicación convierte WebM a MP4 con FFmpeg.wasm.

El vídeo se procesa en tu navegador y no se sube al servidor. Whisper descarga su modelo la primera vez. Para generar subtítulos se necesita conexión la primera vez y suficiente memoria RAM. La aplicación ofrece importación manual de SRT si falla el modelo. Los logotipos son opcionales y puedes cargarlos desde Ajustes.

## Desarrollo

```bash
npm install
npm run dev
npm run build
```

Proyecto Vite, JavaScript nativo, canvas + MediaRecorder, qrcode, Transformers.js y FFmpeg.wasm. Despliegue estático en Vercel.

**Limitaciones:** la exportación de vídeo tarda aproximadamente la duración del vídeo original, más el tiempo de transcripción; algunos navegadores necesitan conversión adicional para entregar MP4. Se recomienda Chrome actualizado en un ordenador, vídeos originales MP4 de 30–90 s y un máximo orientativo de 250 MB. Ningún vídeo ni dato personal se almacena en la web. No se genera QR hasta introducir la URL definitiva de la nueva campaña.