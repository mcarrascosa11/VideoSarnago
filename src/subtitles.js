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

// Preserve model segment boundaries without inventing timings from character counts.
export function normalizeWhisper(chunks, duration) {
  const words = (chunks || []).map((c,i) => {
    const text=String(c.text || '').trim().replace(/\s+/g,' ');
    const start=Number(c.timestamp?.[0]);
    const end=Number(c.timestamp?.[1] ?? chunks[i+1]?.timestamp?.[0] ?? duration);
    return {text,start:Math.max(0,start),end:Math.min(end,duration || Infinity)};
  }).filter(w=>w.text && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end>=w.start);
  const result=[];let group=null;
  const flush=()=>{if(group && group.end>group.start) result.push(group);group=null;};
  for(const word of words){
    if(group && (word.start-group.end>.7 || word.end-group.start>5 || group.text.length+word.text.length>68)) flush();
    if(!group)group={...word};
    else {group.text+=' '+word.text;group.end=Math.max(group.end,word.end);}
    if(/[.!?]$/.test(word.text))flush();
  }
  flush();return result;
}

export function needsReview(cue) {
  const words=cue.text.toLowerCase().replace(/[.,!?;:]/g,'').split(/\s+/);
  const seen=new Map();
  for(let i=0;i+2<words.length;i++){
    const phrase=words.slice(i,i+3).join(' ');seen.set(phrase,(seen.get(phrase)||0)+1);
    if(seen.get(phrase)>=3)return true;
  }
  return cue.text.length / Math.max(.01,cue.end-cue.start)>30;
}
