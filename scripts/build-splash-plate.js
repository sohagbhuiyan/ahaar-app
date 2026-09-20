/**
 * Builds `assets/images/brand/splash-plate.png` — the AHAAR logo on a white
 * disc, for the native splash screen.
 *
 * Why a plate at all: the splash background is now brand pink, and the logo is
 * orange-and-green artwork on transparency. Composited straight onto #ff2b85
 * the orange wordmark all but disappears — pink and burnt orange sit too close
 * in hue. On white it reads exactly as drawn, and a white badge on a brand
 * field is a deliberate-looking mark rather than a sticker.
 *
 * Why a circle and not the rounded rectangle you might expect: from Android 12
 * the system draws the splash icon itself and **masks it to a circle**. Expo's
 * plugin feeds this image to `windowSplashScreenAnimatedIcon`, so a wide plate
 * would have its ends cut off on most Android devices in use. A disc is its own
 * mask — the system's circle lands on ours and nothing is lost — and it renders
 * identically on iOS, so both platforms get the same mark from one asset.
 *
 * `AnimatedSplash` redraws this same disc in JS at the same size, so the
 * hand-over from the native splash to the animated one stays invisible. If you
 * change `ART_FRACTION` or the plugin's `imageWidth`, change it there too.
 *
 * Run with `node scripts/build-splash-plate.js` after changing the logo.
 * Needs `pngjs`, which is present in the install tree; add it as a devDependency
 * if that ever stops being true.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Resolved against the working directory, like `reset-project.js` — run this
// from the project root.
const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'assets/images/brand/ahaar-logo.png');
const OUTPUT = path.join(ROOT, 'assets/images/brand/splash-plate.png');

/**
 * How much of the disc's width the artwork spans.
 *
 * The ceiling is set by the artwork's diagonal, not its width: a 366 × 234 mark
 * only fits inside a circle of at least 434 across. At 0.73 the disc is ~500
 * and the corners clear it with room to spare, while the logo still fills the
 * badge rather than floating in it.
 */
const ART_FRACTION = 0.73;

function main() {
  const logo = PNG.sync.read(fs.readFileSync(SOURCE));

  // Trim the transparent margin so the padding below is measured from the
  // artwork itself rather than from whatever the export left around it.
  let minX = logo.width;
  let minY = logo.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < logo.height; y += 1) {
    for (let x = 0; x < logo.width; x += 1) {
      if (logo.data[((logo.width * y + x) << 2) + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`${SOURCE} is fully transparent`);

  const artWidth = maxX - minX + 1;
  const artHeight = maxY - minY + 1;

  const diagonal = Math.hypot(artWidth, artHeight);
  // Kept at the artwork's own resolution — upscaling here would only blur it,
  // since the disc is drawn larger than 1:1 on screen either way.
  const size = Math.round(artWidth / ART_FRACTION);
  if (size < diagonal) {
    throw new Error(
      `ART_FRACTION ${ART_FRACTION} gives a ${size}px disc, too small for a ` +
        `${artWidth}x${artHeight} mark (needs ${Math.ceil(diagonal)}px).`,
    );
  }

  const width = size;
  const height = size;
  const offsetX = Math.round((size - artWidth) / 2);
  const offsetY = Math.round((size - artHeight) / 2);

  const plate = new PNG({ width, height });
  const centre = size / 2;

  // The white disc, its edge antialiased by coverage rather than left as a
  // hard staircase.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre) - centre;
      const coverage = Math.min(Math.max(0.5 - distance, 0), 1);
      const i = (width * y + x) << 2;
      plate.data[i] = 255;
      plate.data[i + 1] = 255;
      plate.data[i + 2] = 255;
      plate.data[i + 3] = Math.round(coverage * 255);
    }
  }

  // The logo over it, source-over with straight alpha.
  for (let y = 0; y < artHeight; y += 1) {
    for (let x = 0; x < artWidth; x += 1) {
      const src = ((logo.width * (minY + y) + (minX + x)) << 2);
      const alpha = logo.data[src + 3] / 255;
      if (alpha === 0) continue;

      const dst = ((width * (offsetY + y) + (offsetX + x)) << 2);
      const dstAlpha = plate.data[dst + 3] / 255;
      const outAlpha = alpha + dstAlpha * (1 - alpha);

      for (let c = 0; c < 3; c += 1) {
        plate.data[dst + c] = Math.round(
          (logo.data[src + c] * alpha + plate.data[dst + c] * dstAlpha * (1 - alpha)) /
            outAlpha,
        );
      }
      plate.data[dst + 3] = Math.round(outAlpha * 255);
    }
  }

  fs.writeFileSync(OUTPUT, PNG.sync.write(plate));
  console.log(
    `splash-plate.png  ${size}x${size} disc  (artwork ${artWidth}x${artHeight}, ` +
      `${(ART_FRACTION * 100).toFixed(0)}% of width, diagonal ${Math.ceil(diagonal)}px)`,
  );
}

main();
