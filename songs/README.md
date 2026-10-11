# Songbook

Static page served at `/songs/` by the existing repository hosting. Deliberately absent from the home page and shared navigation. The robots meta tag requests no indexing; this is not access control.

`library.js` contains 211 distinct tab links from 281 playlist memberships, captured October 10, 2026:

- Level 1: 63
- First Versions: 204
- Level 2: 8
- Performing: 6

Duplicates are merged by exact URL, preserving distinct versions and every playlist membership. One First Versions entry uses a personal Ultimate Guitar tab URL and may require signing in. 209 user-supplied ChordPro arrangements are included as arrangements across 207 tab records; 4 records currently link to Ultimate Guitar without inline text. The supplied First Versions PDF is included in full. No lyric or tab text was retrieved from Ultimate Guitar.

The supplied Unknown Legend chords are attached to its tab record; Blackbird (ver 2) is attached to its non-official tab record, with the supplied version label preserved. Drunken Angel has two supplied arrangements selectable in the reader.

## Content

Add supplied tab or lyric text in an optional `content` field in `library.js` to publish it. Plain text is rendered safely with whitespace preserved. All records have this shape:

```json
{
  "title": "Song title",
  "artist": "Artist name",
  "playlists": ["Level 1", "Performing"],
  "type": "Chords",
  "url": "https://tabs.ultimate-guitar.com/tab/artist/song-chords-123",
  "content": "User-supplied plain text goes here."
}
```

Visitors can import a JSON array of records or attach a `.txt` file to a selected song. Browser imports are stored locally, merge by tab URL, and are not published or synchronized between devices. Imports accept only HTTPS links on tabs.ultimate-guitar.com and the four supported playlists. Text imports are limited to 1 MB; JSON imports to 5 MB.

No dependencies or build step. Serve the repository root with any static web server and visit `/songs/`.

The latest supplied batch added 36 arrangements across 35 previously link-only tabs. Twelve repeated files were skipped. Both distinct Wayside – Back In Time exports are retained and labeled in the reader.
