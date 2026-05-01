"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { RecommendedStation, VenueType, MeetingType } from "@/lib/types";
import { UtensilsCrossed, Wine, Coffee, ArrowLeft, Search, Loader2 } from "lucide-react";
import { displayName } from "@/data/stations";

interface Props {
  station: RecommendedStation;
  venueType: VenueType;
  meetingType: MeetingType;
  onBack: () => void;
  onRestart: () => void;
}

const venueLabels: Record<VenueType, { label: string; icon: React.ReactNode }> = {
  restaurant: { label: "맛집", icon: <UtensilsCrossed className="w-4 h-4" /> },
  bar: { label: "술집", icon: <Wine className="w-4 h-4" /> },
  cafe: { label: "카페", icon: <Coffee className="w-4 h-4" /> },
};

const meetingTypeLabels: Record<MeetingType, string> = {
  date: "데이트",
  friends: "친구 모임",
  work: "회식",
  club: "동호회 모임",
  business: "비즈니스",
  family: "가족 모임",
};

// 약속 유형별 검색 키워드 (네이버 검색에 반영)
const meetingKeywords: Record<MeetingType, Record<VenueType, string>> = {
  date: {
    restaurant: "데이트 맛집",
    bar: "분위기 좋은 바",
    cafe: "감성 카페",
  },
  friends: {
    restaurant: "맛집",
    bar: "술집",
    cafe: "카페",
  },
  work: {
    restaurant: "회식 맛집",
    bar: "회식 술집",
    cafe: "카페",
  },
  club: {
    restaurant: "모임 맛집",
    bar: "단체 술집",
    cafe: "단체 카페",
  },
  business: {
    restaurant: "비즈니스 레스토랑",
    bar: "분위기 좋은 바",
    cafe: "조용한 카페",
  },
  family: {
    restaurant: "가족 맛집",
    bar: "와인바",
    cafe: "카페",
  },
};

const foodFilters = [
  "전체", "한식", "일식", "중식", "양식", "패스트푸드"
];

const defaultImage = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop";

interface PlaceItem {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  link: string;
  telephone: string;
  imageUrls: string[];
}

// 캐시 타입: 필터명 → { items, nextStart, hasMore }
interface CacheEntry { items: PlaceItem[]; nextStart: number; hasMore: boolean; }

export default function Step4Places({ station, venueType, meetingType, onBack, onRestart }: Props) {
  const [filter, setFilter] = useState("전체");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  // 필터별 결과 캐시
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const prefetchedRef = useRef<Set<string>>(new Set());

  const venue = venueLabels[venueType];
  const meetingLabel = meetingTypeLabels[meetingType];
  const showFoodFilter = venueType === "restaurant";

  // 현재 필터의 캐시 데이터
  const current = cache.get(filter);
  const places = current?.items ?? [];
  const nextStart = current?.nextStart ?? 11;
  const hasMore = current?.hasMore ?? false;

  const buildQuery = useCallback((foodFilter: string) => {
    const keyword = meetingKeywords[meetingType]?.[venueType] || "맛집";
    const filterPart = foodFilter !== "전체" ? ` ${foodFilter}` : "";
    return `${station.name}역 ${keyword}${filterPart}`;
  }, [station.name, meetingType, venueType]);

  // 특정 필터 fetch → 캐시 저장
  const fetchFilter = useCallback(async (f: string, showLoading = false): Promise<boolean> => {
    if (prefetchedRef.current.has(f)) return true;
    prefetchedRef.current.add(f);
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(buildQuery(f))}&start=1`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCache(prev => new Map(prev).set(f, {
        items: data.items || [],
        nextStart: data.nextStart ?? 11,
        hasMore: data.hasMore ?? false,
      }));
      return true;
    } catch {
      prefetchedRef.current.delete(f); // 실패 시 재시도 허용
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [buildQuery]);

  // 마운트 시: "전체" 먼저 로드 → 나머지 필터 순차 백그라운드 프리패치
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError("");
      const ok = await fetchFilter("전체", false);
      if (!ok) setError("장소를 불러오지 못했습니다");
      setLoading(false);

      if (!showFoodFilter || cancelled) return;
      // 나머지 필터 순차적으로 백그라운드 패치 (500ms 간격)
      const rest = foodFilters.filter(f => f !== "전체");
      for (const f of rest) {
        if (cancelled) break;
        await fetchFilter(f, false);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.name, meetingType, venueType]);

  const fetchMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(buildQuery(filter))}&start=${nextStart}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCache(prev => {
        const entry = prev.get(filter);
        if (!entry) return prev;
        const existingKeys = new Set(
          entry.items.map(p => p.title.replace(/\s/g, "").toLowerCase())
        );
        const newItems = (data.items || []).filter(
          (p: PlaceItem) => !existingKeys.has(p.title.replace(/\s/g, "").toLowerCase())
        );
        return new Map(prev).set(filter, {
          items: [...entry.items, ...newItems],
          nextStart: data.nextStart ?? nextStart + 10,
          hasMore: data.hasMore ?? false,
        });
      });
    } catch {
      // 조용히 무시
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, filter, nextStart, loadingMore]);

  async function handleFilterClick(f: string) {
    setFilter(f);
    // 아직 캐시 없으면 즉시 fetch (백그라운드가 아직 못 가져온 경우)
    if (!prefetchedRef.current.has(f)) {
      setLoading(true);
      await fetchFilter(f, false);
      setLoading(false);
    }
  }


  return (
    <div className="space-y-4">
      {/* 선택된 역 정보 */}
      <div className="bg-surface border border-border rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted font-medium">약속 장소</p>
            <p className="text-lg font-bold mt-0.5">{displayName(station.name)}역 근처</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-foreground justify-end">
              {venue.icon}
              <span className="font-medium">{venue.label}</span>
            </div>
            <p className="text-[10px] text-text-muted mt-0.5">{meetingLabel}에 딱 맞는 추천</p>
          </div>
        </div>
      </div>

      {/* 음식 필터 (식당일 때만) */}
      {/* 5번: 오른쪽 페이드 아웃으로 스크롤 가능 암시 */}
      {showFoodFilter && (
        <div className="flex flex-wrap gap-2">
          {foodFilters.map((f) => (
            <button
              key={f}
              onClick={() => handleFilterClick(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all
                ${filter === f
                  ? "bg-[#111] text-white"
                  : "bg-surface border border-border text-text-muted hover:bg-surface-hover"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* 장소 리스트 */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="w-6 h-6 text-[#999] animate-spin" />
            <p className="text-sm text-text-muted">{meetingLabel}에 딱 맞는 장소를 찾는 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">{error}</p>
            <button onClick={() => { prefetchedRef.current.delete(filter); handleFilterClick(filter); }} className="mt-3 text-foreground text-sm font-medium underline">
              다시 시도
            </button>
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            해당 조건의 장소를 찾지 못했습니다
          </div>
        ) : (
          places.map((place, i) => (
            <div
              key={i}
              className="bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-sm transition-all"
            >
              {/* 업체명 + 카테고리 + 아이콘 */}
              <div className="px-4 pt-3.5 pb-3 flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] leading-snug">{place.title}</p>
                  {place.category && (
                    <p className="text-[12px] text-text-muted mt-0.5">
                      {place.category.split(">").pop()?.trim()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {place.link?.includes("catchtable.co.kr") && (
                    <a
                      href={place.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-6 h-6 rounded-lg overflow-hidden hover:opacity-75 transition-opacity"
                      title="캐치테이블"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none">
                        <rect width="48" height="48" rx="10" fill="#FF4B36"/>
                        <text x="50%" y="58%" dominantBaseline="middle" textAnchor="middle"
                          fill="white" fontSize="22" fontWeight="800" fontFamily="sans-serif">C</text>
                      </svg>
                    </a>
                  )}
                </div>
              </div>

              {/* 가로 스크롤 사진 스트립 */}
              <div className="flex gap-1 overflow-x-auto scrollbar-hide px-4 pb-3">
                {(place.imageUrls?.length > 0 ? place.imageUrls : [defaultImage]).map((url, j) => (
                  <div key={j} className="shrink-0 w-[120px] h-[120px] overflow-hidden bg-gray-100">
                    <img
                      src={url}
                      alt={`${place.title} ${j + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 더 보기 버튼 */}
      {!loading && places.length > 0 && hasMore && (
        <button
          onClick={fetchMore}
          disabled={loadingMore}
          className="w-full py-3 rounded-2xl text-sm font-medium border border-border
                     bg-surface hover:bg-surface-hover transition-colors
                     flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loadingMore ? (
            <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
          ) : (
            "결과 더 보기"
          )}
        </button>
      )}

      {/* 하단 버튼 */}
      <div className="space-y-2 pt-2">
        <button
          onClick={onBack}
          className="w-full py-3.5 rounded-2xl text-sm font-semibold
                     bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4 inline mr-1 -mt-0.5" />
          다른 역 선택
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
