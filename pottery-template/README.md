# Slab — pottery template studio

Buildless browser tool for straight or outward-tapered cups. Open `pottery-template/` through the repository's local HTTP server.

- Finished exterior height and rim/base diameters, in millimeters or inches.
- Wet slab thickness and total wet-to-fired linear shrinkage.
- Interactive 3D form, flat wall and floor patterns, and approximate brim capacity.
- Full-size SVG export and US Letter/A4 printing with 10 mm tile overlap and a 50 mm calibration line. Browser print dialogs can save as PDF.

## Geometry and assembly

Wet dimensions = fired dimensions / (1 − shrinkage / 100). Thickness is the wet rolled slab thickness and is not independently enlarged. The floor sits beneath the wall, so its thickness is subtracted from total wet height. Wall development uses the slab's mid-thickness circumference: a rectangle for cylinders, or an annular sector for conical frustums. The floor disk matches the exterior base diameter. The side seam is a butt joint with no added overlap.

Print at actual size, disable headers/footers, and verify the calibration line. Align the repeated 10 mm grid in tile overlaps. Score, slip, compress and bevel contact edges as appropriate. Uniform shrinkage and an ideal neutral surface are assumptions; clay distortion and compressed seams require testing. The canvas preview is illustrative. Handles and inward taper are outside this first version.

## Checks

`node --test pottery-template/geometry.test.mjs`

`node --check pottery-template/app.mjs`

The source is also hosted through Sites as project `appgprj_6acd85a5ef308191a394800c694e517c`. The repository copy remains self-contained for GitHub Pages.
