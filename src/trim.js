export function trimRange(duration, start = 0, end = duration) {
  if (![duration,start,end].every(Number.isFinite) || duration <= 0 || start < 0 || end > duration + .001 || end <= start || start >= duration) throw new Error('El inicio debe ser anterior al final y ambos deben estar dentro del vídeo.');
  return {start,end:Math.min(end,duration),duration:Math.min(end,duration)-start};
}
export function trimCues(cues, start, end) {
  return cues.filter(c=>c.end>start&&c.start<end).map(c=>({...c,start:Math.max(c.start,start)-start,end:Math.min(c.end,end)-start}));
}
