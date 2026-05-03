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

// autoload=false 필수: autoload=true(기본값)는 document.write()를 사용하므로
// React처럼 이미 로드된 페이지에 동적 주입 시 페이지 전체를 덮어씌워
// readyState=2가 되어도 LatLng/Map/Marker가 undefined인 상태가 됨
const KAKAO_SDK_SRC = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false&libraries=services`;

export default function KakaoMap({ name, address, lat, lng }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
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
      new kakao.maps.Marker({ position: center, map });
      const infowindow = new kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:13px;font-weight:700;white-space:nowrap;">${n}</div>`,
      });
      infowindow.open(map, new kakao.maps.Marker({ position: center, map }));
      setTimeout(() => map.relayout(), 100);
    }

    if (la && ln) {
      renderAt(la, ln);
      return;
    }

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
    function onReady() {
      setSdkReady(true);
      initMap();
    }

    // 이미 완전히 로드된 경우 (바텀시트 재오픈)
    if (window.kakao?.maps?.readyState === 2) {
      onReady();
      return;
    }

    // 로드 중이거나 이미 초기화된 경우
    if (window.kakao?.maps) {
      window.kakao.maps.load(onReady);
      return;
    }

    // 같은 스크립트 태그가 이미 DOM에 있는지 확인
    const existing = document.querySelector(
      `script[src*="dapi.kakao.com/v2/maps"]`
    ) as HTMLScriptElement | null;

    if (existing && existing.dataset.status !== "failed") {
      // 로딩 중인 스크립트 — load/error 이벤트 대기
      const onLoad = () => window.kakao.maps.load(onReady);
      const onError = () => setLoadError(true);
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onError);
      return () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onError);
      };
    }

    // 실패한 스크립트 제거 후 재시도
    if (existing?.dataset.status === "failed") existing.remove();

    // 스크립트 새로 주입 (autoload=false이므로 document.write 미사용)
    const script = document.createElement("script");
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.dataset.status = "loading";
    script.onload = () => {
      script.dataset.status = "loaded";
      // load() 호출로 실제 지도 클래스(kakao.js, services.js) 로딩 시작
      // 콜백은 모든 클래스가 준비된 후에 실행됨
      window.kakao.maps.load(onReady);
    };
    script.onerror = () => {
      script.dataset.status = "failed";
      setLoadError(true);
    };
    document.head.appendChild(script);

    return () => {
      script.onload = null;
      script.onerror = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />

      {!sdkReady && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <p className="text-sm text-text-muted">지도 불러오는 중...</p>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 gap-2">
          <p className="text-sm text-text-muted">위치를 찾을 수 없어요</p>
          <p className="text-xs text-text-muted">{name}</p>
        </div>
      )}
    </div>
  );
}
