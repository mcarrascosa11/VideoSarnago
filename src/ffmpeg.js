// FFmpeg.wasm loader shared by transcription and export.
// With cross-origin isolation (COOP/COEP headers in vercel.json) it uses the
// multithreaded core; otherwise it falls back to the single-thread core.
// Cores load from jsDelivr: copying the 32 MB wasm into every Vercel deployment filled the storage quota.
const CORE_VERSION = '0.12.10';
let loading = null;
let instance = null;

export const multithreaded = () => typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';

// Threads for libx264 and the decoder. Capped: more threads give little gain in wasm and use much more memory.
export function ffmpegThreads(ffmpeg = instance) {
  if (!ffmpeg?.multithreaded) return 1;
  return Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
}

async function load(mt, status) {
  const [{FFmpeg}, {toBlobURL}] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')]);
  const base = `https://cdn.jsdelivr.net/npm/@ffmpeg/${mt ? 'core-mt' : 'core'}@${CORE_VERSION}/dist/esm`;
  const ffmpeg = new FFmpeg();
  let timer;
  try {
    status('Cargando motor de vídeo (solo la primera vez: ~31 MB)…');
    const [coreURL, wasmURL, workerURL] = await Promise.all([
      toBlobURL(base + '/ffmpeg-core.js', 'text/javascript'),
      toBlobURL(base + '/ffmpeg-core.wasm', 'application/wasm'),
      mt ? toBlobURL(base + '/ffmpeg-core.worker.js', 'text/javascript') : undefined,
    ]);
    await Promise.race([
      ffmpeg.load(mt ? {coreURL, wasmURL, workerURL} : {coreURL, wasmURL}),
      new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('No se pudo cargar el motor de vídeo. Recarga la página y comprueba la conexión.')), 90000);}),
    ]);
  } catch (e) {ffmpeg.terminate(); throw new Error(e?.message || String(e));}
  finally {clearTimeout(timer);}
  ffmpeg.multithreaded = mt;
  return ffmpeg;
}

export function getFfmpeg(status = () => {}) {
  if (instance?.loaded) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      let ffmpeg;
      if (multithreaded()) {
        try {ffmpeg = await load(true, status);}
        catch (e) {console.warn('VideoSarnago: FFmpeg multihilo no disponible, se usa un solo hilo.', e);}
      }
      return ffmpeg || await load(false, status);
    })().then(ffmpeg => {instance = ffmpeg; return ffmpeg;}).finally(() => {loading = null;});
  }
  return loading;
}

// Start downloading FFmpeg in the background so it is ready when needed.
export function preloadFfmpeg() {getFfmpeg().catch(() => {});}

let mounts = 0;
// Expose the original File to FFmpeg without copying it into wasm memory (WORKERFS).
// Falls back to copying if the core does not support mounting.
export async function mountFile(ffmpeg, file) {
  const dir = `/input_${Date.now()}_${++mounts}`;
  try {
    await ffmpeg.createDir(dir);
    await ffmpeg.mount('WORKERFS', {files: [file]}, dir);
    return {path: `${dir}/${file.name}`, release: async () => {
      try {await ffmpeg.unmount(dir);} catch {}
      try {await ffmpeg.deleteDir(dir);} catch {}
    }};
  } catch {
    try {await ffmpeg.deleteDir(dir);} catch {}
    const path = `${dir.slice(1)}.${(file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    await ffmpeg.writeFile(path, new Uint8Array(await file.arrayBuffer()));
    return {path, release: async () => {try {await ffmpeg.deleteFile(path);} catch {}}};
  }
}
