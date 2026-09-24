export function parseClock(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  const parts = normalized.split(':').map(Number);
  if (!parts.length || parts.some(v => !Number.isFinite(v))) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatClock(seconds, srt = false) {
  const ms = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const hh = Math.floor(ms / 3600000), mm = Math.floor(ms / 60000) % 60;
  const ss = Math.floor(ms / 1000) % 60, rem = ms % 1000;
  const p = n => String(n).padStart(2, '0');
  return p(hh) + ':' + p(mm) + ':' + p(ss) + (srt ? ',' : '.') + String(rem).padStart(3, '0');
}

export function parseSrt(source) {
  const input = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  return input.split(/\n{2,}/).map(block => {
    const lines = block.trim().split('\n');
    const ti = lines.findIndex(l => l.includes('-->'));
    if (ti < 0) return null;
    const [start, end] = lines[ti].split('-->').map(x => parseClock(x.trim().split(/\s+/)[0]));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const text = lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    return text ? { start, end, text } : null;
  }).filter(Boolean).sort((a, b) => a.start - b.start);
}

export function toSrt(cues) {
  return cues.filter(c => c.text && c.end > c.start).sort((a, b) => a.start - b.start)
    .map((c, i) => String(i + 1) + '\n' + formatClock(c.start, true) + ' --> ' + formatClock(c.end, true) + '\n' + c.text.trim() + '\n').join('\n');
}

export function normalizeWhisper(chunks, duration) {
  const result = [];
  for (const c of chunks || []) {
    const text = String(c.text || '').trim().replace(/\s+/g, ' ');
    let a = Math.max(0, Number(c.timestamp?.[0] || 0));
    let b = Number(c.timestamp?.[1] ?? duration ?? a + 3);
    if (!Number.isFinite(b)) b = a + 3;
    if (duration) b = Math.min(b, duration);
    if (!text || b <= a) continue;
    const words = text.split(/\s+/);
    const chunksOfWords = [];
    let group = [];
    for (const word of words) {
      if (group.length >= 9 || (group.join(' ').length + word.length > 68 && group.length >= 4)) {
        chunksOfWords.push(group); group = [];
      }
      group.push(word);
      if (/[.!?]$/.test(word) && group.length >= 4) { chunksOfWords.push(group); group = []; }
    }
    if (group.length) chunksOfWords.push(group);
    let cursor = a;
    const totalChars = chunksOfWords.reduce((sum, w) => sum + w.join(' ').length, 0);
    for (let i = 0; i < chunksOfWords.length; i++) {
      const part = chunksOfWords[i].join(' ');
      const end = i === chunksOfWords.length - 1 ? b : Math.min(b, cursor + (b - a) * part.length / totalChars);
      result.push({start: +cursor.toFixed(2), end: +end.toFixed(2), text: part});
      cursor = end;
    }
  }
  return result.filter(c => c.end - c.start > .12);
}
