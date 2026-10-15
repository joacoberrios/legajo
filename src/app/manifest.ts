import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Legajo — la historia clínica de cada auto",
    short_name: "Legajo",
    description: "Historial verificado de cada auto, cargado por los talleres.",
    start_url: "/taller",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F2EE",
    theme_color: "#15171A",
    lang: "es-AR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
