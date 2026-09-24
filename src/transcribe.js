import {normalizeWhisper} from './subtitles.js';

let ffmpegInstance = null;
let pipelineInstance = null;

export async function getFfmpeg(status = () => {}) {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  status('Cargando motor de audio (primera vez: ~31 MB)…');
  const [{FFmpeg}, {toBlobURL}] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util')
  ]);
  const ffmpeg = new FFmpeg();
  const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(base + '/ffmpeg-core.js', 'text/javascript'),
    wasmURL: await toBlobURL(base + '/ffmpeg-core.wasm', 'application/wasm')
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function automaticSubtitles(file, language, length, status = () => {}) {
  if (!file) throw new Error('Primero debes subir el vídeo.');
  if (file.size > 250 * 1024 * 1024) throw new Error('Para transcribir localmente, utiliza un vídeo de menos de 250 MB o importa un SRT.');
  const ffmpeg = await getFfmpeg(status);
  const {fetchFile} = await import('@ffmpeg/util');
  const input = 'voice_input_' + Date.now() + '.' + ((file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, ''));
  const output = 'voice_output_' + Date.now() + '.f32';
  try {
    status('Extrayendo el audio original…');
    await ffmpeg.writeFile(input, await fetchFile(file));
    const exit = await ffmpeg.exec(['-i',input,'-vn','-ac','1','-ar','16000','-f','f32le',output]);
    if (exit !== 0) throw new Error('No se pudo extraer el audio. Prueba a exportar el vídeo en MP4 H.264.');
    const data = await ffmpeg.readFile(output);
    if (!data || !data.length) throw new Error('El vídeo no contiene una pista de audio legible.');
    const raw = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const wave = new Float32Array(raw);
    status('Cargando Whisper en español (la primera vez descarga el modelo)…');
    const {pipeline, env} = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    if (!pipelineInstance) {
      pipelineInstance = await pipeline('automatic-speech-recognition','Xenova/whisper-tiny',{
        device:'wasm',
        dtype:'q8',
        progress_callback: p => {if (p.status === 'progress') status('Descargando modelo: ' + Math.round(p.progress || 0) + '%');}
      });
    }
    status('Transcribiendo. Mantén abierta esta pestaña…');
    const outputText = await pipelineInstance(wave,{
      language:language || 'spanish',
      task:'transcribe',
      chunk_length_s:25,
      stride_length_s:4,
      return_timestamps:true
    });
    if (!outputText?.chunks?.length) throw new Error('Whisper no ha detectado frases. Puedes importar un SRT.');
    const cues = normalizeWhisper(outputText.chunks, length);
    if (!cues.length) throw new Error('La transcripción no contiene frases con tiempos válidos.');
    return cues;
  } finally {
    try {await ffmpeg.deleteFile(input);} catch{}
    try {await ffmpeg.deleteFile(output);} catch{}
  }
}

export async function convertToMp4(blob, status = () => {}) {
  const ffmpeg = await getFfmpeg(status);
  const {fetchFile} = await import('@ffmpeg/util');
  const input = 'video_render_' + Date.now() + '.webm';
  const output = 'video_output_' + Date.now() + '.mp4';
  try {
    status('Convirtiendo WebM a MP4 en tu ordenador…');
    await ffmpeg.writeFile(input, await fetchFile(blob));
    const exit = await ffmpeg.exec(['-i',input,'-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-movflags','+faststart',output]);
    if (exit !== 0) throw new Error('La conversión MP4 ha fallado.');
    const bytes = await ffmpeg.readFile(output);
    const copied = bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    return new Blob([copied],{type:'video/mp4'});
  } finally {
    try {await ffmpeg.deleteFile(input);} catch{}
    try {await ffmpeg.deleteFile(output);} catch{}
  }
}
