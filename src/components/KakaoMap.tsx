"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  name: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
}

// Leaflet CSS CDN — injected once into <head>
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_ICON_BASE = "https://unpkg.com/leaflet@1.9.4/dist/images";

function ensureLeafletCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector('link[data-leaflet-css]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS_URL;
  link.dataset.leafletCss = "1";
  document.head.appendChild(link);
}

export default function KakaoMap({ name, address, lat, lng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Keep latest props accessible inside the async init without re-running effect
  const propsRef = useRef({ name, address, lat, lng });
  propsRef.current = { name, address, lat, lng };
  const destroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        ensureLeafletCss();

        // Dynamic import avoids SSR issues — Leaflet requires window/document
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const L = (await import("leaflet")) as any;
        const Leaflet = L.default ?? L;

        if (cancelled || !mapRef.current) return;

        // Fix default marker icon path broken by webpack bundling
        delete Leaflet.Icon.Default.prototype._getIconUrl;
        Leaflet.Icon.Default.mergeOptions({
          iconUrl: `${LEAFLET_ICON_BASE}/marker-icon.png`,
          iconRetinaUrl: `${LEAFLET_ICON_BASE}/marker-icon-2x.png`,
          shadowUrl: `${LEAFLET_ICON_BASE}/marker-shadow.png`,
        });

        const { name: n, address: addr, lat: la, lng: ln } = propsRef.current;

        let coordLat = la ?? undefined;
        let coordLng = ln ?? undefined;

        // No coordinates → geocode via OpenStreetMap Nominatim (free, no key)
        if (!coordLat || !coordLng) {
          const query = addr ? `${n} ${addr}` : n;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
              query
            )}&format=json&limit=1&countrycodes=kr`,
            {
              headers: {
                "Accept-Language": "ko",
                "User-Agent": "meetspot/1.0 (https://meetspot-chi.vercel.app)",
              },
            }
          );
          if (!res.ok) throw new Error("geocode request failed");
          const data: { lat: string; lon: string }[] = await res.json();
          if (data.length === 0) throw new Error("location not found");
          coordLat = parseFloat(data[0].lat);
          coordLng = parseFloat(data[0].lon);
        }

        if (cancelled || !mapRef.current) return;

        const map = Leaflet.map(mapRef.current, {
          center: [coordLat, coordLng],
          zoom: 17,
          zoomControl: true,
        });

        destroyRef.current = () => map.remove();

        Leaflet.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
            maxZoom: 19,
          }
        ).addTo(map);

        Leaflet.marker([coordLat, coordLng])
          .addTo(map)
          .bindPopup(
            `<strong style="font-size:13px;white-space:nowrap;">${n}</strong>`
          )
          .openPopup();

        // Recalculate size after bottom-sheet CSS transition finishes
        setTimeout(() => map.invalidateSize(), 150);

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setLoading(false);
          setLoadError(true);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      destroyRef.current?.();
      destroyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once — latest props read via propsRef

  return (
    <div className="w-full h-full relative">
      {/* 지도 캔버스 */}
      <div ref={mapRef} className="w-full h-full" />

      {/* 로딩 오버레이 */}
      {loading && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <p className="text-sm text-text-muted">지도 불러오는 중...</p>
        </div>
      )}

      {/* 에러 */}
      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-2">
          <p className="text-sm text-text-muted">위치를 찾을 수 없어요</p>
          <p className="text-xs text-text-muted">{name}</p>
        </div>
      )}
    </div>
  );
}
