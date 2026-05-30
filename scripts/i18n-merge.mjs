// WS3b i18n catalog merge — deterministic, parity-by-construction.
// Reads the scout key plan + existing flat catalogs, computes flat dotted keys
// with per-file namespace overrides, detects collisions, and (with --apply)
// merges into en.json/fr.json. Dry-run by default.
//
// Usage:  node scripts/i18n-merge.mjs            (dry run: report only)
//         node scripts/i18n-merge.mjs --apply    (write en.json + fr.json)
//         node scripts/i18n-merge.mjs --area candidate   (limit to one area)

import fs from "node:fs";

const KEYPLAN = "C:/Users/Administrator/.claude/plans/mgwork-i18n-keyplan.json";
const ROOT = "c:/Users/Administrator/OneDrive/EXECUTIVE ASISTANT/projects/mgwork";
const EN = ROOT + "/i18n/en.json";
const FR = ROOT + "/i18n/fr.json";

const APPLY = process.argv.includes("--apply");
const areaIdx = process.argv.indexOf("--area");
const AREA = areaIdx >= 0 ? process.argv[areaIdx + 1] : null;

// Per-file namespace overrides (rel-path substring -> namespace prefix).
// Dashboards reuse widget groups (matches.*, documents.*, chat.*) that also
// exist as dedicated pages -> give each dashboard its own sub-namespace.
const OVERRIDES = {
  "app/candidate/page.tsx": "app.candidate.dashboard",
  "app/enterprise/page.tsx": "app.enterprise.dashboard",
  "app/staff/page.tsx": "app.staff.dashboard",
  "app/admin/page.tsx": "app.admin.dashboard",
};

// Canonical values for shared common.* atoms that the scout filled
// inconsistently across files. First-wins, conflict suppressed.
const CANON = {
  "common.docType.MEDICAL_AUTHORIZATION": { en: "Medical", fr: "Médical" },
  "common.docType.WORK_PERMIT": { en: "Work permit", fr: "Permis de travail" },
  "common.docType.INCORPORATION_CERTIFICATE": { en: "Incorporation certificate", fr: "Certificat d'incorporation" },
  "common.next": { en: "Next", fr: "Suivant" },
  "common.criterion.mobility": { en: "Mobility", fr: "Mobilité" },
};

const plan = JSON.parse(fs.readFileSync(KEYPLAN, "utf8")).result.files;
const en = JSON.parse(fs.readFileSync(EN, "utf8"));
const fr = JSON.parse(fs.readFileSync(FR, "utf8"));

const rel = (f) =>
  f.file.replace(/\\/g, "/").replace(/.*projects\/mgwork\//, "").replace(/^.*mgwork\//, "");

const areaOf = (r) => {
  const m = r.match(/app\/(candidate|enterprise|staff|admin)\//);
  if (m) return m[1];
  if (/cand-/.test(r)) return "candidate";
  if (/enterprise-shell/.test(r)) return "enterprise";
  if (/staff-shell/.test(r)) return "staff";
  if (/admin-shell/.test(r)) return "admin";
  return "shell";
};

const nsFor = (file) => {
  const r = rel(file);
  for (const k in OVERRIDES) if (r.includes(k)) return OVERRIDES[k];
  return file.namespace;
};

const flatFor = (file, key) =>
  key.startsWith("common.") ? key : nsFor(file) + "." + key;

// Build additions
const add = {}; // flat -> { en, fr, sources:Set, area }
const valueConflicts = [];
for (const file of plan) {
  const r = rel(file);
  const a = areaOf(r);
  if (AREA && a !== AREA && !(file.keys || []).some((k) => k.key.startsWith("common."))) continue;
  for (const k of file.keys || []) {
    const flat = flatFor(file, k.key);
    if (CANON[flat]) {
      add[flat] = { en: CANON[flat].en, fr: CANON[flat].fr, sources: (add[flat]?.sources || new Set()).add(r), area: add[flat]?.area || a };
      continue;
    }
    if (add[flat]) {
      if (add[flat].en !== k.en || add[flat].fr !== k.fr) {
        valueConflicts.push({ flat, A: { ...add[flat], src: [...add[flat].sources][0] }, B: { en: k.en, fr: k.fr, src: r } });
      }
      add[flat].sources.add(r);
    } else {
      add[flat] = { en: k.en, fr: k.fr, sources: new Set([r]), area: a };
    }
  }
}

// Existing-key clashes (don't silently overwrite a real translation)
const existingClash = [];
for (const flat in add) {
  if (flat in en && en[flat] !== add[flat].en) existingClash.push({ flat, existing: en[flat], proposed: add[flat].en });
}

// Leaf/parent prefix conflicts across the FULL merged keyset
const allKeys = [...new Set([...Object.keys(en), ...Object.keys(add)])];
const prefixConflicts = [];
const sortedNew = Object.keys(add).sort();
for (const key of allKeys) {
  const pfx = key + ".";
  for (const other of sortedNew) {
    if (other !== key && other.startsWith(pfx)) { prefixConflicts.push([key, other]); break; }
  }
}

// Report
const uniq = Object.keys(add).length;
const reused = Object.keys(add).filter((k) => k in en).length;
console.log(`\n=== i18n merge ${APPLY ? "APPLY" : "DRY-RUN"}${AREA ? " area=" + AREA : ""} ===`);
console.log(`plan files: ${plan.length}`);
console.log(`unique flat keys produced: ${uniq}  (already-present in en.json: ${reused}, new: ${uniq - reused})`);
const byArea = {};
for (const k in add) byArea[add[k].area] = (byArea[add[k].area] || 0) + 1;
console.log("by area:", JSON.stringify(byArea));

console.log(`\nVALUE CONFLICTS (same key, different fr/en): ${valueConflicts.length}`);
for (const c of valueConflicts.slice(0, 40)) console.log(`  ! ${c.flat}\n      A[${c.A.src}] en="${c.A.en}"\n      B[${c.B.src}] en="${c.B.en}"`);

console.log(`\nEXISTING-KEY CLASHES (would overwrite existing en.json value): ${existingClash.length}`);
for (const c of existingClash.slice(0, 40)) console.log(`  ~ ${c.flat}  existing="${c.existing}"  proposed="${c.proposed}"`);

console.log(`\nLEAF/PARENT PREFIX CONFLICTS (break nest expansion): ${prefixConflicts.length}`);
for (const c of prefixConflicts.slice(0, 60)) console.log(`  X "${c[0]}"  is a prefix of  "${c[1]}"`);

if (APPLY) {
  if (valueConflicts.length || prefixConflicts.length) {
    console.log("\nABORT: resolve conflicts before --apply.");
    process.exit(1);
  }
  // Preserve existing key order; append NEW keys (sorted) for a clean diff.
  let added = 0;
  const newFlat = Object.keys(add).filter((k) => !(k in en)).sort();
  for (const flat of newFlat) { en[flat] = add[flat].en; fr[flat] = add[flat].fr; added++; }
  fs.writeFileSync(EN, JSON.stringify(en, null, 2) + "\n", "utf8");
  fs.writeFileSync(FR, JSON.stringify(fr, null, 2) + "\n", "utf8");
  const enKeys = Object.keys(JSON.parse(fs.readFileSync(EN, "utf8")));
  const frKeys = Object.keys(JSON.parse(fs.readFileSync(FR, "utf8")));
  const onlyEn = enKeys.filter((k) => !frKeys.includes(k));
  const onlyFr = frKeys.filter((k) => !enKeys.includes(k));
  console.log(`\nAPPLIED: +${added} new keys. en=${enKeys.length} fr=${frKeys.length}  parity: onlyEn=${onlyEn.length} onlyFr=${onlyFr.length}`);
  if (onlyEn.length) console.log("  onlyEn:", onlyEn.slice(0, 20));
  if (onlyFr.length) console.log("  onlyFr:", onlyFr.slice(0, 20));
}
