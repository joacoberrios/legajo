import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, computeHash, verifyChain, type LedgerRecord, type HashInput } from "./ledger.ts";
import { formatPlate, isValidPlate, normalizePlate } from "./plate.ts";

function chain(inputs: Omit<HashInput, "prevHash" | "vehicleId" | "userId" | "items" | "notes" | "correctsId">[]): LedgerRecord[] {
  const out: LedgerRecord[] = [];
  let prev: string | null = null;
  inputs.forEach((i, n) => {
    const base: HashInput = { vehicleId: "v1", userId: "u1", items: [], notes: null, correctsId: null, prevHash: prev, ...i };
    const hash = computeHash(base);
    out.push({ ...base, id: `r${n}`, hash });
    prev = hash;
  });
  return out;
}

const now = new Date("2026-10-13T12:00:00Z");

test("una cadena válida verifica y puntúa", () => {
  const recs = chain([
    { workshopId: "w1", type: "origin", odometerKm: 10, performedOn: "2021-02-01", createdAt: new Date("2026-01-01T10:00:00Z") },
    { workshopId: "w2", type: "service", odometerKm: 40000, performedOn: "2025-08-01", createdAt: new Date("2026-01-02T10:00:00Z") },
    { workshopId: "w1", type: "service", odometerKm: 50000, performedOn: "2026-06-01", createdAt: new Date("2026-06-01T10:00:00Z") },
  ]);
  assert.equal(verifyChain(recs).ok, true);
  const a = analyze(recs, now);
  assert.equal(a.chainOk, true);
  assert.equal(a.kmIssues, 0);
  assert.equal(a.workshops, 2);
  assert.equal(a.currentKm, 50000);
  assert.equal(a.score, 50 + 12 + 12 + 10);
});

test("alterar un registro rompe la cadena y el puntaje cae a 0", () => {
  const recs = chain([
    { workshopId: "w1", type: "service", odometerKm: 30000, performedOn: "2025-01-01", createdAt: new Date("2025-01-01T10:00:00Z") },
    { workshopId: "w1", type: "service", odometerKm: 40000, performedOn: "2026-01-01", createdAt: new Date("2026-01-01T10:00:00Z") },
  ]);
  recs[0].odometerKm = 20000;
  const a = analyze(recs, now);
  assert.equal(a.chainOk, false);
  assert.equal(a.score, 0);
});

test("un retroceso de km se detecta y una corrección lo anula", () => {
  const recs = chain([
    { workshopId: "w1", type: "service", odometerKm: 50000, performedOn: "2025-01-01", createdAt: new Date("2025-01-01T10:00:00Z") },
    { workshopId: "w1", type: "service", odometerKm: 45000, performedOn: "2026-01-01", createdAt: new Date("2026-01-01T10:00:00Z") },
  ]);
  assert.equal(analyze(recs, now).kmIssues, 1);

  // El taller corrige el primer registro (km mal tipeado: eran 40.000)
  const prev = recs[1].hash;
  const fix: HashInput = {
    vehicleId: "v1", workshopId: "w1", userId: "u1", type: "correction", odometerKm: 40000, performedOn: "2025-01-01",
    items: [], notes: "Km mal cargado", correctsId: "r0", prevHash: prev, createdAt: new Date("2026-01-05T10:00:00Z"),
  };
  const all = [...recs, { ...fix, id: "r2", hash: computeHash(fix) }];
  const a = analyze(all, now);
  assert.equal(a.chainOk, true);
  assert.equal(a.kmIssues, 0);
});

test("patentes", () => {
  assert.equal(normalizePlate("ae 482-kd"), "AE482KD");
  assert.equal(isValidPlate("AE482KD"), true);
  assert.equal(isValidPlate("OKB903"), true);
  assert.equal(isValidPlate("12345"), false);
  assert.equal(formatPlate("AE482KD"), "AE 482 KD");
  assert.equal(formatPlate("OKB903"), "OKB 903");
});
