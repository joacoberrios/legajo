"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { LeafletMouseEvent, Map as LMap, Marker } from "leaflet";

export type Point = { lat: number; lng: number };

const MENDOZA: Point = { lat: -32.8895, lng: -68.8458 };

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const TILES = [
  {
    // Esri: gratis y sin clave para este uso.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    options: { maxZoom: 19, attribution: "Tiles &copy; Esri" },
  },
  { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", options: { maxZoom: 19, attribution: OSM } },
];

/**
 * Mapa interactivo (OpenStreetMap + Leaflet). Tocar el mapa o arrastrar el pin mueve el punto.
 * `point` controla el pin desde afuera (búsqueda o GPS); `onPick` avisa cuando el usuario lo mueve.
 */
export function MapPicker({ point, onPick }: { point: Point | null; onPick: (p: Point) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);
  const resize = useRef<ResizeObserver | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  // Crear el mapa una sola vez (Leaflet necesita window: se importa recién en el navegador).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
      if (cancelled || !box.current || map.current) return;
      leaflet.current = L;
      const start = point ?? MENDOZA;
      const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([start.lat, start.lng], point ? 17 : 12);
      // Mapa base gratuito. Si el primero no carga (bloqueo o caída), se cambia solo al siguiente.
      let current = 0;
      let errors = 0;
      let layer = L.tileLayer(TILES[0].url, TILES[0].options).addTo(m);
      const onError = () => {
        if (++errors < 4 || current >= TILES.length - 1) return;
        current++;
        errors = 0;
        m.removeLayer(layer);
        layer = L.tileLayer(TILES[current].url, TILES[current].options).addTo(m);
        layer.on("tileerror", onError);
      };
      layer.on("tileerror", onError);
      m.on("click", (e: LeafletMouseEvent) => {
        place(e.latlng);
        pick.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.current = m;
      if (point) place(point);
      // El contenedor puede cambiar de tamaño (al montar, al aparecer resultados): recalcular.
      setTimeout(() => m.invalidateSize(), 200);
      if (typeof ResizeObserver !== "undefined") {
        resize.current = new ResizeObserver(() => m.invalidateSize());
        resize.current.observe(box.current);
      }
    })();
    return () => {
      cancelled = true;
      resize.current?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function place(p: Point) {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    if (!marker.current) {
      const icon = L.divIcon({ className: "", html: '<div class="legajo-pin"></div>', iconSize: [30, 30], iconAnchor: [15, 30] });
      const mk = L.marker([p.lat, p.lng], { draggable: true, icon }).addTo(m);
      mk.on("dragend", () => {
        const ll = mk.getLatLng();
        pick.current({ lat: ll.lat, lng: ll.lng });
      });
      marker.current = mk;
    } else {
      marker.current.setLatLng([p.lat, p.lng]);
    }
  }

  // Cuando el punto llega de afuera (búsqueda o GPS), mover pin y centrar.
  useEffect(() => {
    if (!point || !map.current) return;
    place(point);
    map.current.setView([point.lat, point.lng], Math.max(map.current.getZoom(), 17));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.lat, point?.lng]);

  return <div ref={box} className="h-64 w-full rounded-2xl border border-line" role="application" aria-label="Mapa: tocá para marcar el taller" />;
}
