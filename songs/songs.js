(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const key = 'ben-songbook-v1';
  const playlists = ['Level 1', 'First Versions', 'Level 2', 'Performing'];
  function validate(records) {
    if (!Array.isArray(records)) throw new Error('Use a JSON array of songs.');
    return records.map((r, i) => {
      if (!r || typeof r.title !== 'string' || !r.title.trim() || typeof r.artist !== 'string') throw new Error(`Song ${i + 1} needs a title and artist.`);
      const url = new URL(r.url);
      if (url.protocol !== 'https:' || url.hostname !== 'tabs.ultimate-guitar.com') throw new Error(`Song ${i + 1} needs an Ultimate Guitar tab link.`);
      if (!Array.isArray(r.playlists) || !r.playlists.length || r.playlists.some(p => !playlists.includes(p))) throw new Error(`Song ${i + 1} needs a supported playlist.`);
      return {title:r.title.trim(), artist:r.artist, url:url.href, playlists:[...new Set(r.playlists)], type:typeof r.type === 'string' ? r.type : 'Chords', content:typeof r.content === 'string' ? r.content : '', arrangements:Array.isArray(r.arrangements) ? r.arrangements.filter(a => a && typeof a.label === 'string' && typeof a.chordpro === 'string').map(a => ({label:a.label,chordpro:a.chordpro})) : []};
    });
  }
  const published = validate(window.SONG_LIBRARY || []);
  let imported = [];
  try { imported = validate(JSON.parse(localStorage.getItem(key) || '[]')); }
  catch { $('import-status').textContent = 'Saved imports could not be loaded. You can import them again.'; }
  let songs = [], selected = null, sort = 'title', direction = 1, frame = 0;
  function rebuild() {
    const merged = new Map(published.map(s => [s.url, {...s}]));
    for (const song of imported) merged.set(song.url, song);
    songs = [...merged.values()];
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(imported)); return true; }
    catch { $('import-status').textContent = 'Loaded for this session only. Browser storage is unavailable or full.'; return false; }
  }
  function text(tag, value, className) {
    const el = document.createElement(tag); el.textContent = value;
    if (className) el.className = className;
    return el;
  }
  function render() {
    const query = $('search').value.trim().toLocaleLowerCase();
    const filtered = songs.filter(s => (!query || `${s.title} ${s.artist}`.toLocaleLowerCase().includes(query)) && (!$('playlist').value || s.playlists.includes($('playlist').value)));
    filtered.sort((a,b) => direction * String(a[sort]).localeCompare(String(b[sort]), undefined, {numeric:true, sensitivity:'base'}) || a.title.localeCompare(b.title));
    $('rows').replaceChildren();
    for (const s of filtered) {
      const row = document.createElement('tr');
      row.classList.toggle('selected', s.url === selected?.url);
      const title = document.createElement('td'), button = text('button',s.title);
      button.setAttribute('aria-pressed', String(s.url === selected?.url));
      button.addEventListener('click', () => choose(s, true)); title.append(button); title.append(text('span', s.content || s.arrangements.length ? 'Reader ready' : 'Link only', 'availability')); row.append(title, text('td',s.artist));
      const groups = document.createElement('td'); s.playlists.forEach(p => groups.append(text('span',p,'badge'))); row.append(groups,text('td',s.type));
      const linkCell = document.createElement('td'), link = text('a','View tab ↗');
      link.href = s.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label',`${s.title} on Ultimate Guitar`); linkCell.append(link); row.append(linkCell); $('rows').append(row);
    }
    $('count').textContent = `${filtered.length} of ${songs.length} tabs`;
    $('empty').hidden = filtered.length > 0;
    $('empty').textContent = songs.length ? 'No songs match. Try another search or playlist.' : 'Your song library is waiting for its first songs.';
    document.querySelectorAll('[data-sort]').forEach(button => {
      button.parentElement.setAttribute('aria-sort', button.dataset.sort === sort ? (direction === 1 ? 'ascending' : 'descending') : 'none');
      button.querySelector('span').textContent = button.dataset.sort === sort ? (direction === 1 ? '↑' : '↓') : '';
    });
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; $('play').textContent = 'Start auto-scroll'; }
  function choose(song, focus = false) {
    stop(); selected = song;
    $('reader-title').textContent = song?.title || 'Pick a song to start';
    $('reader-meta').textContent = song ? `${song.artist} · ${song.type} · ${song.playlists.join(' / ')}` : 'Your tabs and lyrics will appear here.';
    $('original').hidden = !song;
    if (song) $('original').href = song.url;
    $('arrangement').replaceChildren();
    if (song?.content) $('arrangement').append(new Option('Imported text', 'text'));
    song?.arrangements.forEach((a, i) => $('arrangement').append(new Option(a.label, String(i))));
    $('arrangement-label').hidden = !song || (!song.content && !song.arrangements.length);
    updateReader();
    $('sheet').scrollTop = 0; $('sheet').scrollLeft = 0;
    $('play').disabled = !song || (!song.content && !song.arrangements.length); $('top').disabled = !song; $('import-text').disabled = !song;
    render();
    if (focus) $('sheet').focus({preventScroll:false});
  }
  function updateReader() {
    stop();
    const choice = $('arrangement').value;
    $('content').textContent = selected ? choice === 'text' ? selected.content : selected.arrangements[Number(choice)] ? chordProToText(selected.arrangements[Number(choice)].chordpro) : 'No supplied text for this version yet.\nOpen the original tab on Ultimate Guitar.' : 'Choose a song from the table above.';
    $('sheet').scrollTop = 0;
  }
  $('arrangement').addEventListener('change', updateReader);
  $('play').addEventListener('click', () => {
    if (frame) { stop(); return; }
    if ($('sheet').scrollTop + $('sheet').clientHeight >= $('sheet').scrollHeight - 1) $('sheet').scrollTop = 0;
    let previous = 0, position = $('sheet').scrollTop;
    $('play').textContent = 'Pause auto-scroll';
    function tick(time) {
      if (previous) position += Math.min(time - previous, 100) / 1000 * Number($('speed').value);
      previous = time; $('sheet').scrollTop = position;
      if ($('sheet').scrollTop + $('sheet').clientHeight >= $('sheet').scrollHeight - 1) { stop(); return; }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  });
  ['wheel','touchstart','keydown'].forEach(event => $('sheet').addEventListener(event,stop,{passive:true}));
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  $('top').addEventListener('click', () => { stop(); $('sheet').scrollTop = 0; });
  $('speed').addEventListener('input', () => { $('speed-value').textContent = `${$('speed').value} px/s`; });
  $('font-size').addEventListener('change', () => { $('content').style.fontSize = `${$('font-size').value}px`; });
  $('search').addEventListener('input',render); $('playlist').addEventListener('change',render);
  document.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click',() => { direction = sort === button.dataset.sort ? -direction : 1; sort = button.dataset.sort; render(); }));
  $('import-library').addEventListener('change',async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 5000000) throw new Error('Choose a library smaller than 5 MB.');
      const records = validate(JSON.parse(await file.text()));
      const merged = new Map(imported.map(s => [s.url,s])); records.forEach(s => merged.set(s.url,s)); imported = [...merged.values()];
      const persisted = save(); rebuild(); choose(songs.find(s => s.url === selected?.url) || null);
      if (persisted) $('import-status').textContent = `Imported ${records.length} tabs into this browser.`;
    } catch(error) { $('import-status').textContent = error.message; }
    event.target.value = '';
  });
  $('import-text').addEventListener('change',async event => {
    const file = event.target.files[0], song = selected; if (!file || !song) return;
    try {
      if (file.size > 1000000) throw new Error('Choose a text file smaller than 1 MB.');
      const updated = {...song, content:await file.text()}; imported = imported.filter(s => s.url !== song.url); imported.push(updated);
      const persisted = save(); rebuild(); if (selected?.url === song.url) choose(updated);
      if (persisted) $('import-status').textContent = `Saved text for ${song.title} in this browser.`;
    } catch(error) { $('import-status').textContent = error.message; }
    event.target.value = '';
  });
  $('reset').addEventListener('click',() => {
    if (!confirm('Clear imported songs and text from this browser? Published songs will remain.')) return;
    imported = []; const persisted = save(); rebuild(); choose(null);
    if (persisted) $('import-status').textContent = 'Browser imports cleared.';
  });
  rebuild(); render();
})();
