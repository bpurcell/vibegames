# Slab — pottery template studio

Buildless browser tool for cups, butter dishes, shallow conical bowls, narrowing or flared vases, rectangular planters, and lidded boxes. Open `pottery-template/` through the repository's local HTTP server.

- Finished exterior height and rim/base diameters, in millimeters or inches.
- Wet slab thickness and total wet-to-fired linear shrinkage.
- Interactive 3D form, flat wall and floor patterns, and approximate brim capacity.
- Full-size SVG export and US Letter/A4 printing with 10 mm tile overlap and a 50 mm calibration line. Browser print dialogs can save as PDF.

## Geometry and assembly

Wet dimensions = fired dimensions / (1 − shrinkage / 100). Thickness is the wet rolled slab thickness and is not independently enlarged. The floor sits beneath the wall, so its thickness is subtracted from total wet height. Wall development uses the slab's mid-thickness circumference: a rectangle for cylinders, or an annular sector for conical frustums. The floor disk matches the exterior base diameter. The side seam is a butt joint with no added overlap.

Print at actual size, disable headers/footers, and verify the calibration line. Align the repeated 10 mm grid in tile overlaps. Score, slip, compress and bevel contact edges as appropriate. Uniform shrinkage and an ideal neutral surface are assumptions; clay distortion and compressed seams require testing. The canvas preview is illustrative. Vases allow inward taper. Handles and curved, non-developable surfaces are not included.

## Checks

`node --test pottery-template/*.test.mjs`

`node --check pottery-template/app.mjs`

The source is also hosted through Sites as project `appgprj_6acd85a5ef308191a394800c694e517c`. The repository copy remains self-contained for GitHub Pages.

## Additional forms

`forms.mjs` defines each form’s controls, validation, parts, cut quantities, and assembly notes. Lengths and widths are finished exterior dimensions; slab thickness remains wet thickness.

- **Butter dish:** four cover walls plus roof and a separate flat plate. Plate border is added on every side. Cover height excludes the plate. No lip or knob is included.
- **Shallow bowl:** a conical wall and floor, with a wider permitted rim and lower height.
- **Vase:** a cylindrical or conical wall, including a narrowing opening. The smaller sector edge is the opening for narrowing forms.
- **Planter:** two full-length long walls, two short walls fitted between them, and a floor with three 6 mm finished drainage holes. No saucer.
- **Lidded box:** the same corner construction, a flat lid, and two underside locator strips. Body height excludes the lid. Fired clearance applies on each side; wet strip placement is printed on its pattern.

Each unique template prints once, with CUT quantities for repeated pieces. The preview offers a lifted/closed cover switch. Dimensions are retained while switching forms within the current page session. The SVG includes every unique part at actual millimeter size; follow the web assembly notes for joining and lid placement. Clay behavior and firing can change the fit.
