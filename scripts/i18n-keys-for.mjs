// Dump the resolved flat catalog keys for a given source file, using the SAME
// namespace + override rules as scripts/i18n-merge.mjs. Lets the editor map
// each literal -> exact key without guessing.
// Usage: node scripts/i18n-keys-for.mjs <path-substring>
import fs from "node:fs";

const KEYPLAN = "C:/Users/Administrator/.claude/plans/mgwork-i18n-keyplan.json";
const NEEDLE = process.argv[2];
if (!NEEDLE) { console.error("pass a path substring"); process.exit(1); }

const OVERRIDES = {
  "app/candidate/page.tsx": "app.candidate.dashboard",
  "app/enterprise/page.tsx": "app.enterprise.dashboard",
  "app/staff/page.tsx": "app.staff.dashboard",
  "app/admin/page.tsx": "app.admin.dashboard",
};
const CANON = {
  "common.docType.MEDICAL_AUTHORIZATION": { en: "Medical", fr: "Médical" },
  "common.docType.WORK_PERMIT": { en: "Work permit", fr: "Permis de travail" },
  "common.docType.INCORPORATION_CERTIFICATE": { en: "Incorporation certificate", fr: "Certificat d'incorporation" },
  "common.next": { en: "Next", fr: "Suivant" },
  "common.criterion.mobility": { en: "Mobility", fr: "Mobilité" },
};

const plan = JSON.parse(fs.readFileSync(KEYPLAN, "utf8")).result.files;
const rel = (f) => f.file.replace(/\\/g, "/").replace(/.*projects\/mgwork\//, "").replace(/^.*mgwork\//, "");
const nsFor = (file) => { const r = rel(file); for (const k in OVERRIDES) if (r.includes(k)) return OVERRIDES[k]; return file.namespace; };

const hits = plan.filter((f) => rel(f).includes(NEEDLE));
if (!hits.length) { console.error("no plan file matches:", NEEDLE); process.exit(1); }
for (const file of hits) {
  console.log(`\n### ${rel(file)}  [${file.componentType}, src=${file.sourceLang}, ns=${nsFor(file)}]`);
  if (file.switcherNote) console.log(`# switcher: ${file.switcherNote.slice(0,160)}`);
  for (const k of file.keys || []) {
    const flat = k.key.startsWith("common.") ? k.key : nsFor(file) + "." + k.key;
    const v = CANON[flat] || { en: k.en, fr: k.fr };
    console.log(`${flat}\t[${k.kind}]\tFR=${JSON.stringify(v.fr)}\tEN=${JSON.stringify(v.en)}${k.note ? "\t// " + k.note : ""}`);
  }
}
