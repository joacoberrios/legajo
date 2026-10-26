import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

const POINTS = [
  {
    title: "Lo carga el taller",
    text: "No el vendedor.",
    icon: <path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L21 12l-9 9-3-3 9-9-1.6-1.6a4 4 0 0 1-4.9-4.9l2.4 2.4 2-2z" />,
  },
  {
    title: "No se puede tocar",
    text: "Cada registro queda sellado.",
    icon: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  {
    title: "Km con foto",
    text: "Del tablero, en cada visita.",
    icon: (
      <>
        <path d="M4 17a8 8 0 1 1 16 0" />
        <path d="M12 17l4-5M4 17h16" />
      </>
    ),
  },
];

/**
 * Explicación de un vistazo para quien llega sin saber qué es Legajo (por ejemplo, escaneando el QR de un parabrisas).
 * `headline` cambia según el contexto: el informe de un auto, un sticker sin activar o la portada.
 */
export function PitchIntro({ headline, sub }: { headline: string; sub: string }) {
  return (
    <section className="space-y-5 rounded-3xl bg-ink px-5 pt-5 pb-6 text-paper">
      <Wordmark height={18} color="#F3F2EE" />
      <div className="space-y-2">
        <h1 className="text-[28px] leading-[1.05] font-black tracking-tight">{headline}</h1>
        <p className="text-sm leading-snug text-[#C9C7BF]">{sub}</p>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {POINTS.map((p) => (
          <li key={p.title} className="space-y-2 rounded-2xl bg-[#1E2125] px-3 py-3">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF6A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {p.icon}
            </svg>
            <p className="text-[13px] leading-tight font-bold">{p.title}</p>
            <p className="text-[11px] leading-snug text-[#9A9890]">{p.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Qué puede hacer cada visitante: comprador, taller, agencia o dueño. */
export function PitchActions() {
  return (
    <section className="space-y-3">
      <h2 className="font-bold">¿Y vos?</h2>
      <div className="space-y-2">
        <Action
          href="/registro"
          title="Tengo un taller"
          text="Sumate gratis: cada trabajo que hacés queda firmado con tu nombre en la historia del auto."
          cta="Registrar mi taller"
        />
        <Action
          href="/registro?tipo=agencia"
          title="Vendo autos"
          text="Revisá el historial antes de tomar un usado y mostrale a tu cliente un informe verificado."
          cta="Cuenta de agencia"
        />
        <div className="card space-y-1 px-4 py-3.5">
          <p className="font-bold">Voy a comprar un usado</p>
          <p className="text-sm leading-snug text-muted">Antes de pagar, pedí su Legajo. Si no tiene, llevalo a un taller con Legajo para que quede registrado el estado de hoy.</p>
        </div>
        <Link href="/planes" className="block text-center text-sm font-semibold text-muted underline">Ver planes y precios</Link>
        <div className="card space-y-1 px-4 py-3.5">
          <p className="font-bold">Tengo un auto</p>
          <p className="text-sm leading-snug text-muted">Pedile a tu mecánico que cargue cada service. Cuando lo vendas, vale más un auto que demuestra cómo lo cuidaste.</p>
        </div>
      </div>
    </section>
  );
}

function Action({ href, title, text, cta }: { href: string; title: string; text: string; cta: string }) {
  return (
    <Link href={href} className="card block space-y-2 px-4 py-3.5">
      <p className="font-bold">{title}</p>
      <p className="text-sm leading-snug text-muted">{text}</p>
      <p className="text-sm font-semibold text-accent">{cta} →</p>
    </Link>
  );
}
