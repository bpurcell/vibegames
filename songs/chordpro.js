/* Convert supplied ChordPro into aligned, plain-text chord-over-lyric lines. */
function chordProToText(source) {
  const result = [];
  for (const line of source.replace(/\r\n?/g, '\n').split('\n')) {
    const directive = line.match(/^\{([^}:]+)(?::\s*(.*))?\}$/);
    if (directive) {
      const [, key, value = ''] = directive;
      if (['title','t','artist'].includes(key)) continue;
      if (['comment','c','comment_italic'].includes(key)) result.push(`[${value}]`);
      else if (key === 'capo') result.push(`Capo: ${value}`);
      else result.push(value ? `${key}: ${value}` : `[${key}]`);
      continue;
    }
    if (!/\[[^\]]+\]/.test(line)) { result.push(line); continue; }
    let lyrics = '', chords = '', end = 0;
    for (const match of line.matchAll(/\[([^\]]+)\]/g)) {
      lyrics += line.slice(end, match.index);
      const column = Math.max(lyrics.length, chords.length ? chords.length + 1 : 0);
      lyrics = lyrics.padEnd(column);
      chords = chords.padEnd(column) + match[1];
      end = match.index + match[0].length;
    }
    lyrics += line.slice(end);
    result.push(chords.trimEnd());
    if (lyrics.trim()) result.push(lyrics.trimEnd());
  }
  return result.join('\n').trim();
}
if (typeof module !== 'undefined') module.exports = {chordProToText};
