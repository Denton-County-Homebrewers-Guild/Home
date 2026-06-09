import sharp from "sharp";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const originalsDir = join(root, "originals");
const publicDir = join(root, "public");
const configPath = join(root, "src/config/carousel-images.json");

const MAX_WIDTH = 800;
const QUALITY = 82;

// Extensions we'll try if the listed one isn't found (handles .JPG, .jpeg, etc.)
const CANDIDATE_EXTS = [".jpg", ".jpeg", ".JPG", ".JPEG", ".png", ".PNG"];

const images = JSON.parse(readFileSync(configPath, "utf8"));

let hasErrors = false;

await Promise.all(
  images.map(async (img, i) => {
    const listedExt = extname(img.src);
    const base = basename(img.src, listedExt);
    const dir = dirname(img.src);

    // Find the original — try the listed extension first, then fallbacks
    const extsToTry = [listedExt, ...CANDIDATE_EXTS.filter((e) => e !== listedExt)];
    const srcPath = extsToTry
      .map((e) => join(originalsDir, dir, `${base}${e}`))
      .find(existsSync);

    if (!srcPath) {
      console.error(
        `ERROR [entry ${i + 1}]: Original not found for "${img.src}"\n` +
        `  Looked in: originals${dir}/${base}{${extsToTry.join(",")}}\n` +
        `  Add the file to the originals/ folder and try again.`
      );
      hasErrors = true;
      return;
    }

    const destPath = join(publicDir, dir, `${base}.webp`);
    mkdirSync(dirname(destPath), { recursive: true });

    const originalSize = readFileSync(srcPath).length;
    const meta = await sharp(srcPath).metadata();

    await sharp(srcPath)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(destPath);

    const newSize = readFileSync(destPath).length;
    const saved = (((originalSize - newSize) / originalSize) * 100).toFixed(0);
    console.log(
      `${basename(srcPath)}: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ` +
      `${(newSize / 1024).toFixed(0)}KB (${saved}% smaller, ` +
      `${meta.width}px → ${Math.min(meta.width, MAX_WIDTH)}px)`
    );
  })
);

if (hasErrors) {
  process.exit(1);
}
