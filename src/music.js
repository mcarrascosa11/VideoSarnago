// Background music is optional and must never prevent exporting the original audio.
export async function startMusic({music, gain, volume, timeoutMs = 6000}) {
  const level = Number(volume);
  if (!Number.isFinite(level) || level <= 0) return '';
  let timer;
  let onError;
  try {
    gain.gain.value = Math.min(0.2, level / 100);
    music.preload = 'auto';
    music.loop = true;
    music.src = '/music/first-light-particles-v2.mp3';
    await Promise.race([
      new Promise((_, reject) => {
        onError = () => reject(new Error('Music unavailable'));
        music.addEventListener('error', onError, {once: true});
        timer = setTimeout(onError, timeoutMs);
      }),
      music.play(),
    ]);
    return '';
  } catch {
    gain.gain.value = 0;
    music.pause();
    music.removeAttribute('src');
    music.load();
    return 'La música no se pudo cargar. Se ha conservado el audio original del vídeo.';
  } finally {
    clearTimeout(timer);
    if (onError) music.removeEventListener('error', onError);
  }
}
