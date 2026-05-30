// Precise residual-French/English detector. For each scouted file, checks
// whether any catalog FR (or EN, for EN-source files) value is STILL present
// literally in the source -> that string was not converted to t(). Skips ICU
// (values containing '{') since their source form differs.
// Usage: node scripts/i18n-residual.mjs [pathSubstring]
import fs from "node:fs";

const KEYPLAN = "C:/Users/Administrator/.claude/plans/mgwork-i18n-keyplan.json";
const ROOT = "c:/Users/Administrator/OneDrive/EXECUTIVE ASISTANT/projects/mgwork";
const NEEDLE = process.argv[2] || "";

const plan = JSON.parse(fs.readFileSync(KEYPLAN, "utf8")).result.files;
const rel = (f) => f.file.replace(/\\/g, "/").replace(/.*projects\/mgwork\//, "").replace(/^.*mgwork\//, "");

// Strip comments, className values, and t()/tc()/getTranslations() key args so
// none of those read as residual UI text. Crude but good enough for this heuristic.
const stripNoise = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/className=("[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, " ")
    .replace(/(?:getTranslations|useTranslations|tc|t)\(\s*[`'"][^`'"]*[`'"]/g, " ");

// Keys whose value legitimately stays verbatim in source (DB/URL filter values,
// or a value identical to a CSS/identifier word).
const ALLOW = new Set([
  "candidates.filter.quickSector.hotellerie", "candidates.filter.quickSector.cuisine",
  "candidates.filter.quickSector.construction", "candidates.filter.quickSector.sante",
  "candidates.filter.quickSector.logistique", "common.none",
]);
const wb = (val, src) => {
  const esc = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-zÀ-ÿ])${esc}(?![A-Za-zÀ-ÿ])`).test(src);
};

let totalResidual = 0;
const dirty = [];
for (const file of plan) {
  const r = rel(file);
  if (NEEDLE && !r.includes(NEEDLE)) continue;
  let raw;
  try { raw = fs.readFileSync(`${ROOT}/${r}`, "utf8"); } catch { console.log(`?? cannot read ${r}`); continue; }
  const src = stripNoise(raw);
  const langs = file.sourceLang === "en" ? ["en"] : file.sourceLang === "mixed" ? ["fr", "en"] : ["fr"];
  const hits = [];
  for (const k of file.keys || []) {
    if (ALLOW.has(k.key)) continue;
    for (const lang of langs) {
      const val = k[lang];
      if (!val || val.includes("{") || val.length < 4) continue;
      const variants = new Set([val, val.replace(/'/g, "&apos;"), val.replace(/'/g, "’")]);
      let found = false;
      for (const v of variants) if (wb(v, src)) { found = true; break; }
      if (found) { hits.push(`${k.key}  «${val}»`); break; }
    }
  }
  // de-dup
  const uniq = [...new Set(hits)];
  if (uniq.length) {
    dirty.push({ file: r, count: uniq.length, hits: uniq });
    totalResidual += uniq.length;
  }
}

dirty.sort((a, b) => b.count - a.count);
for (const d of dirty) {
  console.log(`\n### ${d.file}  (${d.count} residual)`);
  for (const h of d.hits) console.log(`   - ${h}`);
}
console.log(`\n==== ${dirty.length} files with residual literals, ${totalResidual} total ====`);
