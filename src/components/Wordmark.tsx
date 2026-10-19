const PATH =
  "M0 0h11v60h-11zM0 49h40v11h-40zM53 0h11v60h-11zM53 0h46v11h-46zM53 24.5h38v11h-38zM53 49h46v11h-46zM112 0h46v11h-46zM112 0h11v60h-11zM112 49h46v11h-46zM147 24.5h11v35.5h-11zM135 24.5h23v11h-23zM171 0h46v11h-46zM171 0h11v60h-11zM206 0h11v60h-11zM171 31.2h46v11h-46zM265 0h11v60h-11zM230 49h46v11h-46zM230 33h11v27h-11zM289 0h46v11h-46zM289 49h46v11h-46zM289 0h11v60h-11zM324 0h11v60h-11z";

/** Logotipo de Legajo (vector, sin fuentes). */
export function Wordmark({ height = 20, color = "currentColor", dot = "#FF6A1A", className }: { height?: number; color?: string; dot?: string; className?: string }) {
  return (
    <svg role="img" aria-label="Legajo" viewBox="0 0 335 60" height={height} width={(height * 335) / 60} className={className}>
      <path fill={color} d={PATH} />
      <rect x="29" y="0" width="11" height="11" fill={dot} />
    </svg>
  );
}
