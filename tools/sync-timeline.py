#!/usr/bin/env python3
"""
Regenerate the inlined event data in timeline.html from timeline-data.json.

timeline.html inlines its data so the page works from file:// (a fetch of a
sibling JSON is CORS-blocked). That means two copies. This script makes
timeline-data.json the single source of truth and rewrites the copy in the HTML
between the BEGIN/END markers.

    python3 tools/sync-timeline.py          # rewrite timeline.html
    python3 tools/sync-timeline.py --check  # exit 1 if out of sync (no writes)
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "timeline-data.json"
HTML_PATH = ROOT / "timeline.html"

BEGIN = "/* BEGIN GENERATED EVENTS — edit timeline-data.json, then run tools/sync-timeline.py */"
END = "/* END GENERATED EVENTS */"


def js_str(s: str) -> str:
    """Encode a Python string as a JS double-quoted literal."""
    return json.dumps(s, ensure_ascii=False)


def js_num(x) -> str:
    """Render a number without a pointless trailing .0."""
    if isinstance(x, float) and x.is_integer():
        x = int(x)
    return repr(x)


def event_line(e: dict) -> str:
    if "startYbp" in e:
        time = f"[{js_num(e['startYbp'])},{js_num(e['endYbp'])}]"
    else:
        time = js_num(e["ybp"])
    parts = [
        js_str(e["id"]),
        js_str(e["label"]),
        js_str(e["emoji"]),
        js_str(e["category"]),
        time,
        js_str(e["certainty"]),
        js_str(e["blurb"]),
    ]
    if "year" in e:
        parts.append(js_num(e["year"]))
    return "  E(" + ",".join(parts) + "),"


def build_block(events: list) -> str:
    # Oldest first, so the source reads in chronological order.
    ordered = sorted(events, key=lambda e: -(e.get("ybp", e.get("startYbp"))))
    lines = [BEGIN, "const EVENTS = ["]
    lines += [event_line(e) for e in ordered]
    lines += ["];", END]
    return "\n".join(lines)


def main() -> int:
    check = "--check" in sys.argv
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    html = HTML_PATH.read_text(encoding="utf-8")

    block = build_block(data["events"])
    pattern = re.compile(
        re.escape(BEGIN) + r".*?" + re.escape(END), re.DOTALL
    )
    if not pattern.search(html):
        print("ERROR: generated-block markers not found in timeline.html", file=sys.stderr)
        return 2

    updated = pattern.sub(lambda _: block, html)

    if check:
        if updated != html:
            print("OUT OF SYNC: run  python3 tools/sync-timeline.py", file=sys.stderr)
            return 1
        print(f"in sync ({len(data['events'])} events)")
        return 0

    if updated == html:
        print(f"already in sync ({len(data['events'])} events)")
        return 0

    HTML_PATH.write_text(updated, encoding="utf-8")
    print(f"synced {len(data['events'])} events -> timeline.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
