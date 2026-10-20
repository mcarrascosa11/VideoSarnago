import {normalizeWhisper} from './subtitles.js';
import {getFfmpeg, mountFile} from './ffmpeg.js';

let whisperWorker = null;

// mode 'fast': WebGPU, or multithreaded WASM. mode 'safe': single-thread WASM (original behaviour).
function runWhisper(wave, language, mode, status) {
  return new Promise((resolve, reject) => {
    if (!whisperWorker) whisperWorker = new Worker(new URL('./whisper.worker.js', import.meta.url), {type: 'module'});
    const worker = whisperWorker;
    const timer = setTimeout(() => fail('La transcripción ha superado 10 minutos. Comprueba la conexión y vuelve a intentarlo.'), 600000);
    function cleanup() {clearTimeout(timer); worker.onmessage = null; worker.onerror = null;}
    function fail(message) {cleanup(); worker.terminate(); whisperWorker = null; reject(new Error(message));}
    worker.onerror = e => fail(e.message || 'No se pudo iniciar el motor de subtítulos.');
    worker.onmessage = ({data}) => {
      if (data.type === 'status') status(data.text);
      else if (data.type === 'result') {cleanup(); resolve(data.chunks);}
      else if (data.type === 'error') fail(data.message);
    };
    // The wave is copied (not transferred) so a failed fast attempt can be retried in safe mode.
    worker.postMessage({wave, language, mode});
  });
}

export async function automaticSubtitles(file, language, length, status = () => {}) {
  if (!file) throw new Error('Primero debes subir el vídeo.');
  const ffmpeg = await getFfmpeg(status);
  const output = 'voice_output_' + Date.now() + '.f32';
  let source;
  try {
    status('Extrayendo el audio original…');
    source = await mountFile(ffmpeg, file);
    const exit = await ffmpeg.exec(['-i', source.path, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', output]);
    if (exit !== 0) throw new Error('No se pudo extraer el audio. Prueba a exportar el vídeo en MP4 H.264.');
    const data = await ffmpeg.readFile(output);
    if (!data || !data.length) throw new Error('El vídeo no contiene una pista de audio legible.');
    const wave = new Float32Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    let chunks;
    try {chunks = await runWhisper(wave, language, 'fast', status);}
    catch (e) {
      console.warn('VideoSarnago: transcripción rápida no disponible, se repite en modo seguro.', e);
      status('Reintentando la transcripción en modo compatible…');
      chunks = await runWhisper(wave, language, 'safe', status);
    }
    if (!chunks?.length) throw new Error('Whisper no ha detectado frases. Puedes importar un SRT.');
    const cues = normalizeWhisper(chunks, length);
    if (!cues.length) throw new Error('La transcripción no contiene frases con tiempos válidos.');
    return cues;
  } finally {
    await source?.release();
    try {await ffmpeg.deleteFile(output);} catch {}
  }
}
