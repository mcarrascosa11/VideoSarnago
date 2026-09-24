import {makeCanvas, drawScaled, paintFrame, paintOutro} from './visuals.js';

export function supportedRecordingMime() {
  const types = [
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return typeof MediaRecorder !== 'undefined' ? types.find(x => MediaRecorder.isTypeSupported(x)) || '' : '';
}

function waitForEvent(element, name, failure = 'error') {
  return new Promise((resolve, reject) => {
    const done = () => {clear(); resolve();};
    const fail = () => {clear(); reject(new Error('No se pudo leer o reproducir el vídeo.'));};
    const clear = () => {
      element.removeEventListener(name, done);
      element.removeEventListener(failure, fail);
    };
    element.addEventListener(name, done, {once:true});
    element.addEventListener(failure, fail, {once:true});
  });
}

async function holdFrame(seconds, render) {
  if (seconds <= 0) return;
  const began = performance.now();
  await new Promise(resolve => {
    function tick(now) {
      render();
      if (now - began >= seconds * 1000) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

export async function recordReel({file, name, role, photo, logo, qrImage, shortUrl, cues, outro, quality, musicVolume = 7.5, progress}) {
  if (!file) throw new Error('Debes seleccionar un vídeo.');
  const mime = supportedRecordingMime();
  if (!mime) throw new Error('Este navegador no permite grabar vídeo. Prueba con Chrome actualizado.');
  const w = quality === 1080 ? 1080 : 720;
  const h = quality === 1080 ? 1920 : 1280;
  const canvas = makeCanvas(w, h);
  const props = {name, role, photo, logo, qrImage, shortUrl, cues};
  const video = document.createElement('video');
  const url = URL.createObjectURL(file);
  video.src = url; video.playsInline = true; video.preload = 'auto';
  const audio = new (window.AudioContext || window.webkitAudioContext)();
  const audioSource = audio.createMediaElementSource(video);
  const music = document.createElement('audio');
  music.src = '/music/first-light-particles.mp3';
  music.preload = 'auto'; music.loop = true; music.crossOrigin = 'anonymous';
  const musicSource = audio.createMediaElementSource(music);
  const musicGain = audio.createGain();
  musicGain.gain.value = Math.max(0, Math.min(0.2, Number(musicVolume) / 100));
  const audioOut = audio.createMediaStreamDestination();
  audioSource.connect(audioOut);
  musicSource.connect(musicGain).connect(audioOut);
  const frames = canvas.captureStream(25);
  const combined = new MediaStream([...frames.getVideoTracks(), ...audioOut.stream.getAudioTracks()]);
  let recorder;
  const parts = [];
  let raf = 0;
  const listenError = e => console.error('VideoSarnago recorder', e);
  try {
    if (video.readyState < 2) await waitForEvent(video, 'loadeddata');
    const length = video.duration;
    if (!Number.isFinite(length) || length <= 0) throw new Error('No se pudo obtener la duración del vídeo.');
    recorder = new MediaRecorder(combined, {mimeType:mime, videoBitsPerSecond:quality === 1080 ? 6_000_000 : 3_300_000, audioBitsPerSecond:128_000});
    recorder.addEventListener('dataavailable', ev => {if (ev.data && ev.data.size) parts.push(ev.data);});
    recorder.addEventListener('error', listenError);
    let stopResolve, stopReject;
    const finished = new Promise((resolve, reject) => {stopResolve = resolve; stopReject = reject;});
    recorder.addEventListener('stop', () => stopResolve(), {once:true});
    await audio.resume();
    try { await music.play(); } catch { throw new Error('No se pudo cargar la música de fondo.'); }
    drawScaled(canvas, paintFrame, {...props,video,time:0});
    recorder.start(1000);
    await video.play();
    progress('Grabando el vídeo…', 5);
    const playback = new Promise((resolve, reject) => {
      video.addEventListener('ended', resolve, {once:true});
      video.addEventListener('error', () => reject(new Error('Falló la reproducción del vídeo original.')), {once:true});
    });
    let drawing = true;
    function renderBody() {
      if (!drawing) return;
      drawScaled(canvas, paintFrame, {...props, video, time:video.currentTime});
      progress('Grabando el vídeo…', 5 + Math.round(Math.min(1, video.currentTime / length) * 80));
      raf = requestAnimationFrame(renderBody);
    }
    renderBody();
    await playback;
    drawing = false;
    cancelAnimationFrame(raf);
    progress('Añadiendo cierre y QR…', 90);
    await holdFrame(outro, () => drawScaled(canvas, paintOutro, props));
    await new Promise(r => setTimeout(r, 250));
    recorder.stop();
    await finished;
    const blob = new Blob(parts, {type:mime.split(';')[0]});
    if (!blob.size) throw new Error('La grabación resultó vacía.');
    return {blob, isMp4: mime.startsWith('video/mp4')};
  } finally {
    cancelAnimationFrame(raf);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    combined.getTracks().forEach(t => t.stop());
    frames.getTracks().forEach(t => t.stop());
    video.pause(); music.pause(); video.removeAttribute('src'); video.load(); music.removeAttribute('src'); music.load();
    URL.revokeObjectURL(url);
    await audio.close().catch(() => {});
  }
}
