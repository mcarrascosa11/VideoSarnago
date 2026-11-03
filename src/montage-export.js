// Montage: several supporter videos (each with its own trim, name and subtitles) in the chosen order,
// followed by the closing with QR. The output orientation follows the first video.
import {shortCues} from './subtitles.js';
import {trimRange, trimCues} from './trim.js';
import {videoLayout} from './layout.js';
import {makeCanvas, drawScaled, paintOutro, paintOverlay, canvasPng} from './visuals.js';
import {getFfmpeg, ffmpegThreads, mountFile, execWatched, disableMultithread} from './ffmpeg.js';
import {FPS, overlayTimeline, cardArgs} from './export-plan.js';
import {montageBodyArgs, voiceArgs, montageMuxArgs} from './montage-plan.js';

export async function exportMontage(props) {
  try {return await renderMontage(props);}
  catch (e) {
    if (!e?.stalled || !e.multithreaded) throw e;
    console.warn('VideoSarnago: FFmpeg multihilo bloqueado, se repite con un solo hilo.', e);
    disableMultithread();
    props.progress('El modo rápido se ha bloqueado. Repitiendo en modo compatible…', 1);
    return renderMontage(props);
  }
}

async function renderMontage(props) {
  const {clips, quality, outro, progress} = props;
  if (!clips?.length) throw new Error('Añade al menos un vídeo.');
  const first = clips[0];
  const {width: w, height: h, orientation} = videoLayout({videoWidth: first.width, videoHeight: first.height}, quality);
  const ffmpeg = await getFfmpeg(progress);
  const threads = ffmpegThreads(ffmpeg);
  const prefix = 'montage_' + Date.now() + '_';
  const files = [];
  const name = n => prefix + n;
  const encode = text => new TextEncoder().encode(text);
  let warning = '', hasAudio = false, probing = false, stage = '', base = 0, span = 0, length = 1, source = null;
  const log = ({message}) => {if (probing && /Stream #0:.*Audio:/.test(message)) hasAudio = true;};
  const onProgress = ({time}) => progress(stage, base + span * Math.min(.99, Math.max(0, time / 1e6 / length)));
  ffmpeg.on('log', log); ffmpeg.on('progress', onProgress);
  async function write(n, data) {const path = name(n); files.push(path); await ffmpeg.writeFile(path, data); return path;}
  async function remove(paths) {
    for (const path of paths) {
      try {await ffmpeg.deleteFile(path);} catch {}
      const i = files.indexOf(path); if (i >= 0) files.splice(i, 1);
    }
  }
  async function run(args, text, start, range, seconds) {
    stage = text; base = start; span = range; length = seconds; progress(text, start);
    const exit = await execWatched(ffmpeg, ['-y', ...args], {timeoutMessage: 'La exportación ha superado 15 minutos. Tus ajustes siguen aquí; prueba con calidad 720p.'});
    if (exit !== 0) throw new Error('No se pudo completar: ' + text);
  }
  const canvas = makeCanvas(w, h);
  async function png(n, painter, data, transparent = false) {
    // Separate alpha canvas: drawScaled intentionally creates an opaque context.
    const c = transparent ? makeCanvas(w, h) : canvas;
    if (transparent) {
      const ctx = c.getContext('2d');
      ctx.scale(w / (orientation === 'landscape' ? 1920 : 1080), h / (orientation === 'landscape' ? 1080 : 1920));
      painter(ctx, data);
    } else drawScaled(c, painter, data);
    return write(n, new Uint8Array(await (await canvasPng(c)).arrayBuffer()));
  }
  const common = {orientation, logo: props.logo, qrImage: props.qrImage, shortUrl: props.shortUrl};
  try {
    const bodies = [], voices = [];
    let total = 0;
    const share = 80 / clips.length;
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i], label = `Vídeo ${i + 1} de ${clips.length}`, from = 2 + share * i;
      let range;
      try {range = trimRange(clip.duration, clip.trimStart ?? 0, clip.trimEnd ?? clip.duration);}
      catch {throw new Error(`Revisa el recorte del vídeo ${i + 1} (${clip.file.name}).`);}
      const duration = Math.ceil(range.duration * FPS - 1e-8) / FPS;
      const data = {...common, name: clip.name || '', role: clip.role || '', cues: shortCues(trimCues(clip.cues || [], range.start, range.end))};
      progress(`${label}: leyendo el original…`, from);
      source = await mountFile(ffmpeg, clip.file);
      const segments = overlayTimeline(data.cues, duration);
      const overlays = [];
      let list = 'ffconcat version 1.0\n', last;
      for (let k = 0; k < segments.length; k++) {
        last = await png(`overlay_${i}_${k}.png`, paintOverlay, {...data, time: segments[k].time}, true);
        overlays.push(last);
        list += `file '${last}'\nduration ${segments[k].duration.toFixed(6)}\n`;
      }
      list += `file '${last}'\n`;
      const overlay = await write(`overlays_${i}.ffconcat`, encode(list));
      overlays.push(overlay);
      const body = name(`body_${i}.mp4`); files.push(body);
      hasAudio = false; probing = true;
      await run(montageBodyArgs(source.path, overlay, body, quality, duration, orientation, range.start, threads, clip.orientation !== orientation),
        `${label}: procesando fotogramas…`, from, share * .85, duration);
      probing = false;
      await remove(overlays);
      const voice = name(`voice_${i}.wav`); files.push(voice);
      await run(voiceArgs({input: source.path, hasAudio, start: range.start, duration, output: voice}),
        `${label}: preparando el audio…`, from + share * .85, share * .15, duration);
      await source.release(); source = null;
      bodies.push(body); voices.push(voice); total += duration;
    }
    const endDuration = Math.ceil(outro * FPS) / FPS;
    const end = await png('end.png', paintOutro, common);
    const ending = name('ending.mp4'); files.push(ending);
    await run(cardArgs(end, ending, endDuration, threads), 'Integrando cierre y QR…', 82, 6, endDuration);
    total += endDuration;
    const videoList = await write('clips.ffconcat', encode(`ffconcat version 1.0\n${[...bodies, ending].map(f => `file '${f}'`).join('\n')}\n`));
    const voiceList = await write('voices.ffconcat', encode(`ffconcat version 1.0\n${voices.map(f => `file '${f}'`).join('\n')}\n`));
    const output = name('final.mp4'); files.push(output);
    const volume = Math.max(0, Math.min(20, Number(props.musicVolume) || 0));
    let music;
    if (volume > 0) {
      try {
        const response = await fetch('/music/first-light-particles-v2.mp3', {signal: AbortSignal.timeout(8000)});
        if (!response.ok) throw new Error('Music unavailable');
        music = await write('music.mp3', new Uint8Array(await response.arrayBuffer()));
      } catch {warning = 'No se pudo cargar la música; se conservan las voces originales.';}
    }
    const mix = () => run(montageMuxArgs({list: videoList, voiceList, music, volume, total, output}), 'Uniendo los vídeos y el audio…', 88, 11, total);
    try {await mix();} catch (e) {
      if (!music || !ffmpeg.loaded) throw e;
      music = null; warning = 'La música falló; se conservan las voces originales.'; await mix();
    }
    const bytes = await ffmpeg.readFile(output);
    if (!bytes.length) throw new Error('El MP4 está vacío.');
    return {blob: new Blob([bytes], {type: 'video/mp4'}), musicWarning: warning};
  } finally {
    ffmpeg.off('log', log); ffmpeg.off('progress', onProgress);
    if (ffmpeg.loaded) {for (const path of files) try {await ffmpeg.deleteFile(path);} catch {} await source?.release();}
  }
}
