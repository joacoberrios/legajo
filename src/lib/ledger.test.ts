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
  assert.equal(a.backedCount, 0);
  assert.equal(a.score, 40 + 12 + 12 + 10); // sin respaldo no suma esos 14
});

test("un registro sin adjuntos conserva el hash v1 (registros viejos siguen verificando)", () => {
  const base: HashInput = {
    vehicleId: "v1", workshopId: "w1", userId: "u1", type: "service", odometerKm: 1000, performedOn: "2026-01-01",
    items: ["Cambio de aceite"], notes: null, correctsId: null, prevHash: null, createdAt: new Date("2026-01-01T10:00:00Z"),
  };
  assert.equal(computeHash(base), computeHash({ ...base, attachments: [] }));
  assert.notEqual(computeHash(base), computeHash({ ...base, attachments: [{ kind: "odometer", sha256: "a".repeat(64) }] }));
});

test("adjuntos: cambiar un archivo rompe la cadena y el respaldo suma puntaje", () => {
  const recs = chain([
    { workshopId: "w1", type: "origin", odometerKm: 10, performedOn: "2021-02-01", createdAt: new Date("2026-01-01T10:00:00Z") },
    { workshopId: "w1", type: "service", odometerKm: 50000, performedOn: "2026-06-01", createdAt: new Date("2026-06-01T10:00:00Z") },
  ]);
  // Rearmo la cadena con adjuntos en ambos registros
  let prev: string | null = null;
  const sealed = recs.map((r, i) => {
    const input: HashInput = { ...r, prevHash: prev, attachments: [{ kind: i === 0 ? "document" : "odometer", sha256: String(i).repeat(64) }] };
    const hash = computeHash(input);
    prev = hash;
    return { ...input, id: r.id, hash };
  });
  const ok = analyze(sealed, now);
  assert.equal(ok.chainOk, true);
  assert.equal(ok.backedCount, 2);
  assert.equal(ok.score, 40 + 8 + 12 + 10 + 14);

  sealed[0].attachments = [{ kind: "document", sha256: "f".repeat(64) }]; // alguien reemplaza el comprobante
  assert.equal(analyze(sealed, now).chainOk, false);
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
