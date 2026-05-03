"use client";

import { useEffect, useRef, useState } from "react";

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

const KAKAO_SDK_SRC = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&libraries=services`;

export default function KakaoMap({ name, address, lat, lng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // 최신 props를 initMap 안에서 참조하기 위한 ref
  const propsRef = useRef({ name, address, lat, lng });
  propsRef.current = { name, address, lat, lng };

  function initMap() {
    const { name: n, address: addr, lat: la, lng: ln } = propsRef.current;
    if (!mapRef.current || !window.kakao?.maps) return;
    const kakao = window.kakao;

    function renderAt(coordLat: number, coordLng: number) {
      if (!mapRef.current) return;
      const center = new kakao.maps.LatLng(coordLat, coordLng);
      const map = new kakao.maps.Map(mapRef.current, { center, level: 3 });
      const marker = new kakao.maps.Marker({ position: center, map });
      const infowindow = new kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:13px;font-weight:700;white-space:nowrap;">${n}</div>`,
      });
      infowindow.open(map, marker);
    }

    if (la && ln) {
      renderAt(la, ln);
      return;
    }

    // 좌표 없으면 Kakao Places로 업체명+주소 검색
    const ps = new kakao.maps.services.Places();
    const query = addr ? `${n} ${addr}` : n;
    ps.keywordSearch(query, (data: Record<string, string>[], status: string) => {
      if (status === kakao.maps.services.Status.OK && data.length > 0) {
        renderAt(parseFloat(data[0].y), parseFloat(data[0].x));
      } else {
        setLoadError(true);
      }
    });
  }

  useEffect(() => {
    // 이미 SDK 로드돼 있으면 (바텀시트 재오픈 등) 바로 초기화
    if (window.kakao?.maps) {
      setSdkReady(true);
      initMap();
      return;
    }

    // 이미 같은 스크립트 태그가 DOM에 있으면 (로딩 중) load 이벤트만 대기
    const existing = document.querySelector(
      `script[src*="dapi.kakao.com/v2/maps"]`
    ) as HTMLScriptElement | null;

    if (existing) {
      const onLoad = () => { setSdkReady(true); initMap(); };
      const onError = () => setLoadError(true);
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onError);
      return () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onError);
      };
    }

    // 스크립트 없으면 새로 주입
    const script = document.createElement("script");
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.onload = () => { setSdkReady(true); initMap(); };
    script.onerror = () => setLoadError(true);
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 마운트 시 1회 실행 - props는 propsRef로 최신 값 참조

  return (
    <div className="w-full h-full relative">
      {/* 지도 캔버스 */}
      <div ref={mapRef} className="w-full h-full" />

      {/* 로딩 오버레이 */}
      {!sdkReady && !loadError && (
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
