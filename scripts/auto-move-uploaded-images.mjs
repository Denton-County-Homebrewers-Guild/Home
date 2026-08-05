#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const originalsImagesDir = join(root, "originals", "images");

const RAW_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

function knownCategories() {
  return readdirSync(originalsImagesDir).filter((name) =>
    statSync(join(originalsImagesDir, name)).isDirectory()
  );
}

function addedPublicImageFiles(baseRef) {
  const output = execFileSync(
    "git",
    ["diff", "--diff-filter=A", "--name-only", "-z", `${baseRef}...HEAD`, "--", "public/images"],
    { cwd: root, encoding: "utf8" }
  );
  return output.split("\0").filter((path) => path.length > 0);
}

function parseCandidate(relPath, categories) {
  const parts = relPath.split("/");
  if (parts.length !== 4) return null;
  const [, , category, filename] = parts;
  if (!categories.includes(category)) return null;
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return null;
  const ext = filename.slice(lastDot + 1).toLowerCase();
  if (!RAW_EXTENSIONS.has(ext)) return null;
  return { category, filename };
}

function main() {
  const baseRef = process.argv[2] || "origin/main";
  const categories = knownCategories();
  const candidates = addedPublicImageFiles(baseRef)
    .map((relPath) => ({ relPath, parsed: parseCandidate(relPath, categories) }))
    .filter((c) => c.parsed !== null);

  if (candidates.length === 0) {
    console.log("No raw image uploads found under public/images/. Nothing to move.");
    return;
  }

  for (const { relPath, parsed } of candidates) {
    const destRel = join("originals", "images", parsed.category, parsed.filename);
    const destAbs = join(root, destRel);
    if (existsSync(destAbs)) {
      console.warn(`WARNING: ${destRel} already exists — overwriting with ${relPath}`);
    }
    console.log(`Moving ${relPath} -> ${destRel}`);
    execFileSync("git", ["mv", "-f", relPath, destRel], { cwd: root, stdio: "inherit" });
  }
}

main();
