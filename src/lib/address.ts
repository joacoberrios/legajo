// Interpretación de una dirección tipeada ("francia 445 godoy cruz"). Lógica pura, con tests.

/** Separa "calle número" del resto (departamento / localidad y provincia). */
export function splitAddress(q: string): { street: string; number: number; place: string; province: string } | null {
  const [main, ...more] = q.trim().replace(/\s+/g, " ").split(",").map((s) => s.trim());
  const words = main.split(" ");
  // La altura es el último número que no forma parte del nombre de la calle ("25 de Mayo", "9 de Julio").
  for (let i = words.length - 1; i > 0; i--) {
    const w = words[i].replace(/^N[°º]/i, "");
    if (!/^\d{1,5}$/.test(w) || /^de$/i.test(words[i + 1] ?? "")) continue;
    const street = words.slice(0, i).filter((x) => !/^N[°º]?$/i.test(x)).join(" ");
    if (!/[A-Za-zÀ-ÿ]/.test(street)) continue;
    const tail = words.slice(i + 1).join(" ");
    const parts = [tail, ...more].filter(Boolean);
    return { street, number: Number(w), place: parts[0] ?? "", province: parts[1] ?? "" };
  }
  return null;
}

/** Número de calle que el usuario tipeó, si lo hay. */
export function typedNumber(q: string): number | null {
  return splitAddress(q)?.number ?? null;
}
