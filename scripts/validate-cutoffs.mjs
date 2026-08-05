import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");

const schools = JSON.parse(
  readFileSync(path.join(dataDir, "schools.json"), "utf-8"),
);
const cutoffs = JSON.parse(
  readFileSync(path.join(dataDir, "transfer-cutoffs.json"), "utf-8"),
);

const schoolOffices = new Set(schools.schools.map((s) => s.office));
const cutoffOffices = new Set(Object.keys(cutoffs.regions));

let ok = true;

for (const office of schoolOffices) {
  if (!cutoffOffices.has(office)) {
    console.error(`MISSING region in transfer-cutoffs.json: ${office}`);
    ok = false;
  }
}
for (const office of cutoffOffices) {
  if (!schoolOffices.has(office)) {
    console.error(`EXTRA region in transfer-cutoffs.json not in schools.json: ${office}`);
    ok = false;
  }
}

for (const [office, entries] of Object.entries(cutoffs.regions)) {
  const years = entries.map((e) => e.year);
  const expected = cutoffs.years;
  if (JSON.stringify(years) !== JSON.stringify(expected)) {
    console.error(`${office}: years ${JSON.stringify(years)} !== expected ${JSON.stringify(expected)}`);
    ok = false;
  }
  for (const e of entries) {
    const hasCutoff = e.cutoff != null;
    const hasStatus = e.status != null;
    if (hasCutoff === hasStatus) {
      console.error(`${office} ${e.year}: entry must have exactly one of cutoff/status, got ${JSON.stringify(e)}`);
      ok = false;
    }
    if (hasCutoff && !e.zone) {
      console.error(`${office} ${e.year}: cutoff present without zone`);
      ok = false;
    }
    if ((e.status === "특만기" || e.status === "일반") && e.rank == null) {
      console.error(`${office} ${e.year}: status ${e.status} requires rank`);
      ok = false;
    }
  }
}

// Regression guard for the city != office bug: every distinct `city` in
// schools.json must resolve (via its `office`) to a key present in
// transfer-cutoffs.json's `regions`. This is the actual invariant the
// CutoffPanel UI depends on (it is called with `city`, not `office`).
const cityToOffice = new Map();
for (const s of schools.schools) {
  cityToOffice.set(s.city, s.office);
}
for (const [city, office] of cityToOffice) {
  if (!cutoffOffices.has(office)) {
    console.error(
      `CITY UNRESOLVED: city "${city}" maps to office "${office}", which is not in transfer-cutoffs.json regions`,
    );
    ok = false;
  }
}

if (!ok) {
  console.error("VALIDATION FAILED");
  process.exit(1);
}
console.log(
  `OK: ${cutoffOffices.size} regions, ${cutoffs.years.length} years each, ${cityToOffice.size} cities resolve`,
);
