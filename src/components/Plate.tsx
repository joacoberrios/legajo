import { formatPlate } from "@/lib/plate";

export function Plate({ plate, size = "md" }: { plate: string; size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "lg"
      ? "text-2xl px-3 py-1.5 border-[3px]"
      : size === "sm"
        ? "text-xs px-2 py-1 border-[1.5px]"
        : "text-sm px-2.5 py-1 border-2";
  return (
    <span className={`inline-block rounded-md border-ink bg-white font-mono font-semibold tracking-wider whitespace-nowrap text-ink ${cls}`}>
      {formatPlate(plate)}
    </span>
  );
}
