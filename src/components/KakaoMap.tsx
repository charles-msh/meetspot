"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

interface Props {
  name: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any;
  }
}

export default function KakaoMap({ name, address, lat, lng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [notFound, setNotFound] = useState(false);

  function initMap() {
    if (!mapRef.current || !window.kakao?.maps) return;
    const kakao = window.kakao;

    function renderAt(coordLat: number, coordLng: number) {
      if (!mapRef.current) return;
      const center = new kakao.maps.LatLng(coordLat, coordLng);
      const map = new kakao.maps.Map(mapRef.current, { center, level: 3 });

      const marker = new kakao.maps.Marker({ position: center, map });
      const infowindow = new kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:13px;font-weight:700;white-space:nowrap;">${name}</div>`,
      });
      infowindow.open(map, marker);
    }

    // 좌표가 있으면 바로 렌더
    if (lat && lng) {
      renderAt(lat, lng);
      return;
    }

    // 좌표 없으면 업체명+주소로 Kakao Places 검색
    const ps = new kakao.maps.services.Places();
    const query = address ? `${name} ${address}` : name;
    ps.keywordSearch(query, (data: Record<string, string>[], status: string) => {
      if (status === kakao.maps.services.Status.OK && data.length > 0) {
        renderAt(parseFloat(data[0].y), parseFloat(data[0].x));
      } else {
        setNotFound(true);
      }
    });
  }

  useEffect(() => {
    if (sdkReady) {
      window.kakao.maps.load(initMap);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, lat, lng, name]);

  return (
    <div className="w-full h-full relative">
      <Script
        src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&libraries=services&autoload=false`}
        onLoad={() => {
          window.kakao.maps.load(() => setSdkReady(true));
        }}
      />

      {/* 지도 캔버스 */}
      <div ref={mapRef} className="w-full h-full" />

      {/* 로딩 오버레이 */}
      {!sdkReady && !notFound && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <p className="text-sm text-text-muted">지도 불러오는 중...</p>
        </div>
      )}

      {/* 위치 못 찾은 경우 */}
      {notFound && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-2">
          <p className="text-sm text-text-muted">위치를 찾을 수 없어요</p>
          <p className="text-xs text-text-muted">{name}</p>
        </div>
      )}
    </div>
  );
}
