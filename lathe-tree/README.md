# Little Pine — Lathe Tree Studio

Buildless browser app for designing small spindle-turned decorative trees. Serve the repository root and open `lathe-tree/`.

- Live shaded turned-form preview, with pointer and keyboard viewing controls.
- Dimensioned cut profile and two-page US Letter print preview.
- Height (3–8 inches), maximum diameter (1–4.5 inches), 2–5 tiers and trunk height (0.25–1.5 inches).
- Direct vector PDF download and browser printing. Print Actual Size / 100%, disable headers and footers, and verify both sides of the one-inch square.
- Browser-local settings; no account, external dependencies or server required.

Measurements start at the finished bottom, excluding mounting waste. The trunk diameter is 30% of the maximum diameter. Tier rim diameters taper by `(1 - tierIndex / tierCount)^0.8`; valleys are 62% of the next rim diameter. Rims and valleys share a height and describe the ends of a horizontal shoulder. The tip is idealized; preserve mounting support and finish the tip separately as appropriate. Preview grain and lighting are illustrative, not a material simulation or cutting sequence.

`model.mjs` supplies one inch-based geometry and one point-based page description for screen preview, browser print and downloadable PDF. One point equals 1/72 inch; nothing is automatically shrunk to fit. Inputs are deliberately constrained to fit a Letter sheet. Pages include a full-size profile and a separate cut table/turning plan.

Checks: `node --test lathe-tree/model.test.mjs` and `node --check lathe-tree/app.mjs`.

Sites project: `appgprj_6acd89ce9c88819194065df0995f50e6`. The repository copy remains self-contained for GitHub Pages.

## Curvature

The side-curvature slider bows each tier inward from 0% (straight cone) to 100% (deep sweep). Default 55%. Radius along each rising slope is `rTop + (rBottom - rTop) * (1 - q)^(1 + 1.8 * curve)`, with 32 segments per slope. Rims, valleys, trunk and station heights stay fixed. All previews and outputs share the sampled profile.
