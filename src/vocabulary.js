// Own words that Whisper does not know (Sarnago, hacendera…): after transcribing, every word that is
// close enough to one of them, or two words that together are, is rewritten correctly.
export const DEFAULT_VOCABULARY = 'Sarnago, hacendera';

const plain = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// How it sounds in Spanish, so that Zarnago = Sarnago and asendera = hacendera.
export function soundKey(word) {
  return plain(word).replace(/ch/g, '1').replace(/h/g, '').replace(/1/g, 'ch').replace(/qu/g, 'k')
    .replace(/c(?=[ei])/g, 's').replace(/z/g, 's').replace(/c/g, 'k').replace(/v/g, 'b')
    .replace(/g(?=[ei])/g, 'j').replace(/ll/g, 'y').replace(/(.)\1+/g, '$1');
}

export function parseVocabulary(text) {
  return String(text || '').split(/[,;\n]+/).map(w => w.trim()).filter(w => /^[\p{L}-]+$/u.test(w))
    .map(word => ({word, key: soundKey(word), proper: word[0] !== word[0].toLowerCase()}));
}

function distance(a, b) {
  const row = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}
// One sound of difference for words of five letters or more; shorter words must sound the same.
const allowed = length => length >= 5 ? 1 : 0;

// The corrected word for `core` and how far it was ({word, d}), or null when it is not one of ours.
function match(core, entries) {
  if (!/^[\p{L}-]+$/u.test(core)) return null;
  const key = soundKey(core);
  let best = null;
  for (const entry of entries) {
    const forms = [[key, '']];
    if (key.endsWith('s') && !entry.key.endsWith('s')) forms.push([key.slice(0, -1), 's']);
    for (const [form, plural] of forms) {
      if (Math.abs(form.length - entry.key.length) > 1) continue;
      const d = distance(form, entry.key);
      if (d > allowed(entry.key.length) || (best && best.d <= d)) continue;
      let word = entry.word + plural;
      if (!entry.proper) word = core[0] !== core[0].toLowerCase() ? word[0].toUpperCase() + word.slice(1) : word.toLowerCase();
      best = {word, d};
    }
  }
  return best;
}

const split = token => token.match(/^([¿¡"«“(]*)(.*?)([.,;:!?»”")…]*)$/u).slice(1);

export function fixText(text, entries) {
  if (!entries.length) return text;
  const words = String(text).split(/\s+/).filter(Boolean), out = [];
  for (let i = 0; i < words.length; i++) {
    const [pre, core, post] = split(words[i]);
    const single = match(core, entries);
    if (single) {out.push(pre + single.word + post); continue;}
    // Two words that together are one of ours ("Sar nago", "a cendera"), when together they fit better than the second alone.
    if (i + 1 < words.length && !post) {
      const [, core2, post2] = split(words[i + 1]);
      const merged = core2 && (core + core2).length >= 6 ? match(core + core2, entries) : null;
      const alone = merged && match(core2, entries);
      if (merged && (!alone || merged.d < alone.d)) {out.push(pre + merged.word + post2); i++; continue;}
    }
    out.push(words[i]);
  }
  return out.join(' ');
}

export function fixVocabulary(cues, vocabulary) {
  const entries = Array.isArray(vocabulary) ? vocabulary : parseVocabulary(vocabulary);
  return (cues || []).map(cue => ({...cue, text: fixText(cue.text, entries)}));
}
