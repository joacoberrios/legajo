"use client";

export function PrintButton({ label = "Imprimir sticker" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary">
      {label}
    </button>
  );
}
