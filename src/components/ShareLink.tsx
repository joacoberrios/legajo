"use client";

import { useState } from "react";

/** Compartir un link por WhatsApp, copiarlo o imprimir la página. */
export function ShareLink({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid grid-cols-3 gap-2 print:hidden">
      <a href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`} target="_blank" rel="noreferrer" className="btn-primary text-sm">
        WhatsApp
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
        className="btn-secondary text-sm"
      >
        {copied ? "Copiado" : "Copiar link"}
      </button>
      <button type="button" onClick={() => window.print()} className="btn-secondary text-sm">
        PDF
      </button>
    </div>
  );
}
