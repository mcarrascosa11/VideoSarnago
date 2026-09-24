import {portraitMp4Args} from './video-format.js';
import {normalizeWhisper} from './subtitles.js';

let ffmpegInstance = null;
let whisperWorker = null;

export async function getFfmpeg(status = () => {}) {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  status('Cargando motor de audio (primera vez: ~31 MB)…');
  const [{FFmpeg}, {toBlobURL}] = await Promise.all([
    import('@ffmpeg/ffmpeg'),
    import('@ffmpeg/util')
  ]);
  const ffmpeg = new FFmpeg();
  const base = new URL('/ffmpeg/', location.origin).href.replace(/\/$/,'');
  let timer;
  try {
    await Promise.race([
      (async()=>ffmpeg.load({
        coreURL: await toBlobURL(base + '/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL(base + '/ffmpeg-core.wasm', 'application/wasm')
      }))(),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('No se pudo cargar el motor de audio. Recarga la página y comprueba la conexión.')),90000);})
    ]);
  } catch(e) {ffmpeg.terminate();throw new Error(e?.message || String(e));}
  finally {clearTimeout(timer);}
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
    const outputText = await new Promise((resolve,reject) => {
      if (!whisperWorker) whisperWorker=new Worker(new URL('./whisper.worker.js',import.meta.url),{type:'module'});
      const worker=whisperWorker;
      const timer=setTimeout(()=>fail('La transcripción ha superado 10 minutos. Comprueba la conexión y vuelve a intentarlo.'),600000);
      function cleanup(){clearTimeout(timer);worker.onmessage=null;worker.onerror=null;}
      function fail(message){cleanup();worker.terminate();whisperWorker=null;reject(new Error(message));}
      worker.onerror=e=>fail(e.message || 'No se pudo iniciar el motor de subtítulos.');
      worker.onmessage=({data})=>{
        if(data.type==='status')status(data.text);
        else if(data.type==='result'){cleanup();resolve({chunks:data.chunks});}
        else if(data.type==='error')fail(data.message);
      };
      worker.postMessage({wave,language},[wave.buffer]);
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

export async function convertToMp4(blob, status = () => {}, quality = 720) {
  const ffmpeg = await getFfmpeg(status);
  const {fetchFile} = await import('@ffmpeg/util');
  const input = 'video_render_' + Date.now() + (blob.type.includes('mp4') ? '.mp4' : '.webm');
  const output = 'video_output_' + Date.now() + '.mp4';
  try {
    status('Preparando MP4 vertical 9:16 compatible…');
    await ffmpeg.writeFile(input, await fetchFile(blob));
    const exit = await ffmpeg.exec(portraitMp4Args(input,output,quality));
    if (exit !== 0) throw new Error('La conversión MP4 ha fallado.');
    const bytes = await ffmpeg.readFile(output);
    const copied = bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    return new Blob([copied],{type:'video/mp4'});
  } finally {
    try {await ffmpeg.deleteFile(input);} catch{}
    try {await ffmpeg.deleteFile(output);} catch{}
  }
}
