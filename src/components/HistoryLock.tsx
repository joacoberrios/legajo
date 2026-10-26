import Link from "next/link";
import { FREE_RECORDS_FOR_OTHERS } from "@/lib/billing-plans";

/** Lo que se ve en lugar de los registros ocultos cuando la cuenta no tiene el plan que los habilita. */
export function HistoryLock({ hidden, agency, href }: { hidden: number; agency: boolean; href: string }) {
  if (hidden <= 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-line bg-white p-5 text-center">
      <p className="font-mono text-2xl font-bold">+{hidden}</p>
      <p className="mt-1 text-sm font-semibold">
        {hidden === 1 ? "registro anterior oculto" : "registros anteriores ocultos"}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        {agency
          ? "Con un plan de agencia ves el historial completo de cualquier auto y emitís informes verificados."
          : `Ves completos los autos que atendiste. De los demás, los últimos ${FREE_RECORDS_FOR_OTHERS}. Con Taller Pro ves todo.`}
      </p>
      <Link href={href} className="mt-4 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-white">
        {agency ? "Ver planes" : "Pasar a Taller Pro"}
      </Link>
    </div>
  );
}

/** Mensajes de error al emitir un informe con el cobro activo. */
export const REPORT_ERRORS: Record<string, string> = {
  verificacion: "Los informes verificados se habilitan cuando verifiquemos el CUIT de tu agencia.",
  plan: "Para emitir informes verificados necesitás un plan de agencia.",
  cupo: "Usaste todos los informes del mes. Podés comprar un informe extra desde «Plan».",
};
