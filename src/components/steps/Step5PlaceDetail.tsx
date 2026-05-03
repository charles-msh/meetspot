"use client";

import { useEffect, useState } from "react";
import {
  MapPin, Clock, ArrowLeft,
  ChevronDown, ChevronUp, Loader2, X,
} from "lucide-react";
import type { PlaceItem, RecommendedStation } from "@/lib/types";
import type { PlaceHoursResult } from "@/app/api/place-hours/route";
import { findStation, displayName } from "@/data/stations";
import { LineBadge } from "@/lib/lineColors";
import KakaoMap from "@/components/KakaoMap";

interface Props {
  place: PlaceItem;
  station: RecommendedStation;
  onBack: () => void;
  onRestart: () => void;
}

const DAY_KOR = ["일", "월", "화", "수", "목", "금", "토"];

const defaultImage =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop";

/** 행정구역명 줄임 표현 */
function shortenAddress(addr: string): string {
  return addr
    .replace("서울특별시", "서울")
    .replace("부산광역시", "부산")
    .replace("인천광역시", "인천")
    .replace("대구광역시", "대구")
    .replace("광주광역시", "광주")
    .replace("대전광역시", "대전")
    .replace("울산광역시", "울산")
    .replace("세종특별자치시", "세종")
    .replace("경기도", "경기")
    .replace("강원특별자치도", "강원")
    .replace("강원도", "강원")
    .replace("충청북도", "충북")
    .replace("충청남도", "충남")
    .replace("전북특별자치도", "전북")
    .replace("전라북도", "전북")
    .replace("전라남도", "전남")
    .replace("경상북도", "경북")
    .replace("경상남도", "경남")
    .replace("제주특별자치도", "제주");
}

/** Haversine 직선 거리 (미터) */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 직선거리 → 도보 분 (4 km/h + 1.3× 경로 보정) */
function walkMins(meters: number) {
  return Math.ceil((meters / 66.7) * 1.3);
}

export default function Step5PlaceDetail({ place, station, onBack, onRestart }: Props) {
  const [hours, setHours] = useState<PlaceHoursResult | null>(null);
  const [hoursLoading, setHoursLoading] = useState(true);
  const [weekExpanded, setWeekExpanded] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const stationData = findStation(station.name);
  const stationDisplayName = displayName(station.name);

  // 오늘 요일 표시용
  const todayIdx = new Date().getDay();
  const todayLabel = DAY_KOR[todayIdx];

  // 영업시간 + 좌표 fetch
  useEffect(() => {
    let cancelled = false;
    async function fetchHours() {
      setHoursLoading(true);
      try {
        const res = await fetch(
          `/api/place-hours?name=${encodeURIComponent(place.title)}&station=${encodeURIComponent(station.name)}`
        );
        if (!cancelled && res.ok) setHours(await res.json());
      } catch { /* ignore */ } finally {
        if (!cancelled) setHoursLoading(false);
      }
    }
    fetchHours();
    return () => { cancelled = true; };
  }, [place.title, station.name]);

  // 지도 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (mapOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mapOpen]);

  // 클립보드 복사
  async function handleCopyAddress() {
    const addr = place.roadAddress || place.address || "";
    if (!addr) return;
    try {
      await navigator.clipboard.writeText(addr);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch { /* 구형 브라우저 무시 */ }
  }

  // 도보 시간 계산: Google Places 좌표 우선, 없으면 선택역 기준
  const walkingInfo = (() => {
    const placeLat = hours?.location?.lat;
    const placeLng = hours?.location?.lng;
    // displayName이 이미 '역'으로 끝나는 경우 중복 방지 (예: 서울역 → '서울역에서', 강남 → '강남역에서')
    const nameBase = stationDisplayName.endsWith("역")
      ? stationDisplayName.slice(0, -1)
      : stationDisplayName;
    if (placeLat && placeLng && stationData) {
      const dist = haversine(stationData.lat, stationData.lng, placeLat, placeLng);
      const mins = walkMins(dist);
      return `${nameBase}역에서 도보 ${mins}분`;
    }
    if (stationData) {
      return `${nameBase}역 근처`;
    }
    return null;
  })();

  // 영업시간 텍스트 조합
  const hoursText = (() => {
    if (hoursLoading) return null;
    if (!hours || hours.openNow === null) return null;
    const statusLabel = hours.openNow ? "영업 중" : "영업 종료";
    const todayStr = hours.todayHours
      ? `오늘(${todayLabel}) ${hours.todayHours}`
      : `오늘(${todayLabel})`;
    return { status: hours.openNow, label: statusLabel, today: todayStr };
  })();

  const photos = place.imageUrls?.length > 0 ? place.imageUrls : [defaultImage];
  const categoryLabel = place.category?.split(">").pop()?.trim() ?? "";
  const displayAddress = shortenAddress(place.roadAddress || place.address || "");

  // 지도에 넘길 좌표 (hours에서 받아온 값)
  const mapLat = hours?.location?.lat ?? null;
  const mapLng = hours?.location?.lng ?? null;

  return (
    <div className="space-y-3">

      {/* ── 주소 복사 토스트 ── */}
      <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        copyToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}>
        <div className="bg-[#111] text-white text-sm font-medium px-4 py-2.5 rounded-2xl shadow-lg whitespace-nowrap">
          주소가 복사됐어요
        </div>
      </div>

      {/* ── 카카오 지도 바텀시트 ── */}
      {mapOpen && (
        <div className="fixed inset-0 z-[300] flex flex-col justify-end">
          {/* 어두운 배경 - 클릭 시 닫기 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMapOpen(false)}
          />

          {/* 시트 본체 */}
          <div className="relative bg-white rounded-t-3xl overflow-hidden"
               style={{ height: "70vh" }}>

            {/* 시트 헤더 */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
              <div className="min-w-0">
                <p className="font-bold text-[15px] truncate">{place.title}</p>
                {displayAddress && (
                  <p className="text-xs text-text-muted mt-0.5 truncate">{displayAddress}</p>
                )}
              </div>
              <button
                onClick={() => setMapOpen(false)}
                className="ml-3 shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface transition-colors"
                aria-label="지도 닫기"
              >
                <X className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* 지도 영역 */}
            <div className="w-full" style={{ height: "calc(70vh - 65px)" }}>
              <KakaoMap
                name={place.title}
                address={place.roadAddress || place.address}
                lat={mapLat}
                lng={mapLng}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 상단 영역: 사진 + 업체명/카테고리 ── */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {/* 사진 스트립 */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {photos.map((url, i) => (
            <div key={i} className="shrink-0 w-[160px] h-[160px] overflow-hidden bg-gray-100">
              <img
                src={url}
                alt={`${place.title} ${i + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
              />
            </div>
          ))}
        </div>

        {/* 업체명 + 카테고리 */}
        <div className="px-4 py-3.5 flex items-center justify-between gap-3">
          <p className="font-bold text-[18px] leading-snug truncate">{place.title}</p>
          {categoryLabel && (
            <span className="shrink-0 text-[11px] text-text-muted bg-surface-hover border border-border px-2 py-0.5 rounded-full">
              {categoryLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── 메타데이터 영역 ── */}
      <div className="bg-surface border border-border rounded-2xl divide-y divide-border">

        {/* 위치 정보 (주소 + 도보시간 통합) */}
        <div className="flex items-start gap-3 px-4 py-3.5">
          <MapPin className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">

            {/* 첫째 줄: 주소 + 복사 · 지도 */}
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm text-foreground leading-snug">
                {displayAddress || "주소 정보 없음"}
              </p>
              <div className="shrink-0 flex items-center gap-2.5 pt-0.5">
                <button
                  onClick={handleCopyAddress}
                  className="text-xs text-[#0068C3] hover:opacity-70 transition-opacity"
                >
                  복사
                </button>
                <button
                  onClick={() => setMapOpen(true)}
                  className="text-xs text-[#0068C3] hover:opacity-70 transition-opacity"
                >
                  지도
                </button>
              </div>
            </div>

            {/* 둘째 줄: 노선 배지 + 도보시간 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {station.line.map((l) => (
                <LineBadge key={l} line={l} />
              ))}
              {hoursLoading ? (
                <Loader2 className="w-3 h-3 animate-spin text-text-muted" />
              ) : walkingInfo ? (
                <span className="text-xs text-text-muted">{walkingInfo}</span>
              ) : (
                <span className="text-xs text-text-muted">{stationDisplayName}역 근처</span>
              )}
            </div>

          </div>
        </div>

        {/* 영업시간 */}
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {hoursLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
              ) : hoursText ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 영업 중 / 영업 종료 뱃지 */}
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                    hoursText.status
                      ? "bg-green-50 text-green-600"
                      : "bg-gray-100 text-text-muted"
                  }`}>
                    {hoursText.label}
                  </span>
                  <span className="text-sm text-foreground">{hoursText.today}</span>
                  {/* 전체 요일 토글 */}
                  {hours?.weeklyHours && (
                    <button
                      onClick={() => setWeekExpanded((v) => !v)}
                      className="ml-auto flex items-center gap-0.5 text-xs text-text-muted hover:text-foreground transition-colors"
                    >
                      {weekExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-muted">영업시간 정보 없음</p>
              )}

              {/* 요일별 영업시간 */}
              {weekExpanded && hours?.weeklyHours && (
                <div className="mt-2.5 space-y-1">
                  {hours.weeklyHours.map((row, i) => {
                    const isToday = i === todayIdx;
                    return (
                      <p key={i} className={`text-xs ${isToday ? "font-semibold text-foreground" : "text-text-muted"}`}>
                        {row}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="space-y-2 pt-1">
        <button
          onClick={onBack}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold
                     bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />
          목록으로
        </button>
        <button
          onClick={onRestart}
          className="w-full py-2 text-sm text-text-muted hover:text-foreground transition-colors"
        >
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
