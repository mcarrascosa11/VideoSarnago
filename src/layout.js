export function videoLayout(video, quality = 1080) {
  const landscape = video.videoWidth > video.videoHeight;
  const short = quality === 1080 ? 1080 : 720;
  return {orientation: landscape ? 'landscape' : 'portrait', width: landscape ? short * 16 / 9 : short, height: landscape ? short : short * 16 / 9};
}
