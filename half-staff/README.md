# For Every Life

Static browser app at `/half-staff/`, linked from the homepage and shared navigation. No build step or API key is required. Serve the repository over HTTP (for example `python3 -m http.server 8765`).

## Data

Primary feed: https://www.gannett-cdn.com/experiments/usatoday/_data/mass-killings/incidents.json

Attribution and methodology: Associated Press / USA TODAY / Northeastern University Mass Killing Database, https://cssh.northeastern.edu/sccj/mass-killing-database/ . This app is independent and is not endorsed by the source organizations.

The adapter uses source `metaType` values `mass_shooting` and `mass_public_shooting` and requires `victims >= 4`. The source counts victims separately from perpetrators. It includes private/family as well as public shootings. Do not substitute GVA total-fatality counts without checking perpetrator inclusion.

Checks occur on open, manual refresh and every 15 minutes while visible. There is no background notification or backend scraper. Browser access to the feed was verified during development; upstream availability/schema/CORS can change. The source may lag events or revise counts. Recomputing from the full record applies corrections without double-counting incidents.

The bundled `snapshot.json` is a reduced copy of the public feed dated September 15, 2026 (517 shooting records). It omits narratives, names, street addresses and coordinates. Browser cache and snapshot are fallbacks; the UI reports failures and source dates. A successful network fetch must not be interpreted as real-time completeness. Update the snapshot from the same feed when maintaining the app.

## Flag model

Each year starts at 100%. Each qualifying incident halves the current height. Every victim adds `holdHours` to the remaining hold, which begins immediately if no hold remains. Afterward recovery is linear, at 100 percentage points per `riseHours`. A second incident during recovery halves the partially recovered height. Replays use source dates at midnight UTC as a disclosed visualization convention, not actual attack times. Past years stop at December 31; current year stops at now. Changing the year starts a separate yearly remembrance, not continuous all-history mourning.

Settings persist locally. Demo incidents are explicitly fictional, in memory only, and do not enter the real record or totals. The flag is symbolic and not an official half-staff notice.

## Checks

`node half-staff/core.test.cjs`
`node half-staff/app.test.cjs`
