import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, computeHash, verifyChain, type LedgerRecord, type HashInput } from "./ledger.ts";
import { cleanVin, formatPlate, isValidPlate, normalizePlate } from "./plate.ts";
import { formatPhone, nationalPhone, toWhatsAppNumber } from "./phone.ts";
import { isValidCuit, maskCuit } from "./cuit.ts";

test("CUIT: máscara y dígito verificador", () => {
  assert.equal(maskCuit("20"), "20");
  assert.equal(maskCuit("2012345"), "20-12345");
  assert.equal(maskCuit("20-12345678-6"), "20-12345678-6");
  assert.equal(maskCuit("201234567890000"), "20-12345678-9");
  assert.equal(isValidCuit("20-12345678-6"), true);
  assert.equal(isValidCuit("20-12345678-9"), false);
  assert.equal(isValidCuit("30-71234567-1"), true);
  assert.equal(isValidCuit("99-12345678-6"), false);
});

test("teléfonos fijos y celulares", () => {
  assert.equal(nationalPhone("261 4231234"), "2614231234");
  assert.equal(nationalPhone("(0261) 15 663-7057"), "2616637057");
  assert.equal(formatPhone("2616637057"), "261 663-7057");
  assert.equal(formatPhone("1144445555"), "11 4444-5555");
});

test("celulares argentinos a formato WhatsApp", () => {
  assert.equal(toWhatsAppNumber("261 663-7057"), "5492616637057");
  assert.equal(toWhatsAppNumber("0261 15 663 7057"), "5492616637057");
  assert.equal(toWhatsAppNumber("+54 9 261 663 7057"), "5492616637057");
  assert.equal(toWhatsAppNumber("11 15 4444 5555"), "5491144445555");
  assert.equal(toWhatsAppNumber("2994 15 123456"), "5492994123456");
  assert.equal(toWhatsAppNumber("12345"), null);
});

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

test("VIN leído de foto", () => {
  assert.equal(cleanVin("8AJHA3CD5M4127000"), "8AJHA3CD5M4127000");
  assert.equal(cleanVin("8ajha3cdOm4I27Q00"), "8AJHA3CD0M4127000");
  assert.equal(cleanVin("8AJHA3CD-5M41-27000"), "8AJHA3CD5M4127000");
  assert.equal(cleanVin("8AJHA3CD5M412700"), null);
});

import { fitPlate, parseVehicleCard, plateCandidates, vinCandidates } from "./ocr-parse.ts";

test("OCR: patentes con confusiones típicas", () => {
  assert.deepEqual(fitPlate("AE482KD", "LLDDDLL"), { plate: "AE482KD", fixes: 0 });
  assert.deepEqual(fitPlate("A3482KD", "LLDDDLL"), null);
  assert.equal(fitPlate("AE4B2K0", "LLDDDLL")?.plate, "AE482KO");
  assert.equal(plateCandidates("REPUBLICA ARGENTINA\nAE 4B2 KD")[0].plate, "AE482KD");
  assert.equal(plateCandidates("0KB 9O3")[0].plate, "OKB903");
  assert.equal(plateCandidates("RA\nA E482K D\n")[0].plate, "AE482KD");
  assert.equal(plateCandidates("HOLA").length, 0);
});

test("OCR: VIN dentro de texto", () => {
  assert.deepEqual(vinCandidates("CHASIS N 8AJHA3CD5M 4127000\nMOTOR 1GD123"), ["8AJHA3CD5M4127000"]);
  assert.equal(vinCandidates("9BWZZZ377VTOO4251")[0], "9BWZZZ377VT004251");
});

test("OCR: tarjeta verde", () => {
  const text = `CEDULA DE IDENTIFICACION DEL AUTOMOTOR
DOMINIO: AE 482 KD
MARCA: TOYOTA
MODELO: HILUX 4X4 D/C SRX 2.8 TDI 6 A/T
TIPO: PICK-UP CABINA DOBLE
USO: PRIVADO
MARCA MOTOR: TOYOTA
N° MOTOR: 1GD4567890
MARCA CHASIS: TOYOTA
N° CHASIS: 8AJHA3CD5M4127000
TITULAR: PEREZ JUAN
DOCUMENTO: 12345678`;
  const c = parseVehicleCard(text);
  assert.equal(c.plate, "AE482KD");
  assert.equal(c.make, "TOYOTA");
  assert.equal(c.model, "HILUX 4X4 D/C SRX 2.8 TDI 6 A/T");
  assert.equal(c.bodyType, "PICK-UP CABINA DOBLE");
  assert.equal(c.vin, "8AJHA3CD5M4127000");
  assert.equal(c.engineNumber, "1GD4567890");
  assert.ok(!JSON.stringify(c).includes("PEREZ"));
});

import { samePlateLoose } from "./ocr-parse.ts";

test("OCR: tarjeta verde real (formato DNRPA) con ruido de lectura", () => {
  const text = `REPUBLICA ARGENTINA
CEDULA DE IDENTIFICACION DE VEHICULOS
0 DOMINIO: HG0315 Original
2 MARCA: RENAULT
9 MODELO: CLIO 5 PTAS. PACK
4 TIPO: SEDAN 5 PTAS
USO: PRIVADO
8 CHASIS: 8A1BB270F9L106375
MOTOR: D4FG728Q052177
VENCE: 11/07/2009`;
  const c = parseVehicleCard(text);
  assert.equal(c.plate, "HGO315");
  assert.equal(c.make, "RENAULT");
  assert.equal(c.model, "CLIO 5 PTAS. PACK");
  assert.equal(c.bodyType, "SEDAN 5 PTAS");
  assert.equal(c.vin, "8A1BB270F9L106375");
  assert.equal(c.engineNumber, "D4FG728Q052177");
});

test("OCR: la patente no se arma con la palabra de al lado", () => {
  assert.equal(plateCandidates("HG0315 ORIGINAL")[0].plate, "HGO315");
  assert.equal(plateCandidates("AE 482 KD")[0].plate, "AE482KD");
  assert.ok(samePlateLoose("HGO315", "HG0315"));
  assert.ok(!samePlateLoose("HGO315", "HGO316"));
  assert.ok(!samePlateLoose("HGO315", "AE482KD"));
});
