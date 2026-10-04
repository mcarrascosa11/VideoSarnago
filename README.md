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
## Orientación del vídeo

La orientación se detecta a partir de las dimensiones decodificadas por el navegador. Los vídeos verticales mantienen su diseño y exportación actuales (720 × 1280 o 1080 × 1920). Los horizontales se exportan a 1280 × 720 o 1920 × 1080, con portada y cierre en dos columnas, subtítulos y footer adaptados. El encuadre horizontal completo se ajusta proporcionalmente al espacio disponible, con márgenes del color de marca cuando hacen falta. La portada para cuadrícula sigue siendo 4:5.

Validación: `node --test export-plan.test.mjs music.test.mjs` y `npm run build`. Se han comprobado exportaciones MP4 reales en navegador con vídeo H.264 y audio AAC, en ambas orientaciones y calidades, incluyendo portada, subtítulos, footer y cierre.

## Recortar el principio y el final

Tras cargar un vídeo, revisa el selector de fotogramas y usa «Empezar aquí» y «Terminar aquí», o escribe los tiempos en segundos. «Reproducir recorte» reproduce el tramo con sonido; «Restablecer vídeo completo» elimina los límites. El resumen muestra la duración conservada. La portada y el cierre siguen añadiéndose al tramo seleccionado.

Los subtítulos se editan con los tiempos del original. Al exportar el MP4 o descargar el SRT, se excluyen los subtítulos fuera del recorte, se limitan los que cruzan sus bordes y se desplazan sus tiempos al nuevo inicio. La voz se recorta y sincroniza con el vídeo; la música mantiene su comportamiento actual. El recorte funciona en vertical y horizontal.

## Subtítulos breves y campaña automática

Los subtítulos se muestran en bloques de un máximo de cinco palabras, con tipografía más grande, hasta dos líneas y una caja centrada ajustada al texto. Se aplica a la transcripción, los SRT importados, las ediciones manuales, la vista previa y las exportaciones MP4/SRT. Cuando solo hay tiempos de una frase completa, sus bloques reparten esa duración según el número de palabras; se conserva todo el texto.

El enlace fijo es https://www.goteo.org/project/abriguemos-el-refugio. El QR y el footer lo usan automáticamente. Ya no hay que introducirlo ni se reutilizan enlaces antiguos guardados en el navegador.

Pruebas: `node --test export-plan.test.mjs music.test.mjs subtitles.test.mjs`. Exportación real desde los controles de la web verificada en vertical y horizontal con un SRT largo y sin introducir enlace de campaña.
