"use client";

import { useState, useEffect, useCallback } from "react";
import type { RecommendedStation, VenueType, MeetingType } from "@/lib/types";
import { UtensilsCrossed, Wine, Coffee, ArrowLeft, Search, Loader2, Phone, Copy, Check, Instagram } from "lucide-react";
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
  "전체", "한식", "일식", "중식", "양식", "치킨", "삼겹살", "회/초밥", "분식", "피자", "햄버거", "베트남", "태국"
];

const defaultImage = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop";

interface PlaceItem {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  link: string;
  description: string;
  telephone: string;
  imageUrl: string;
}

export default function Step4Places({ station, venueType, meetingType, onBack, onRestart }: Props) {
  const [filter, setFilter] = useState("전체");
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [nextStart, setNextStart] = useState<number>(1);
  const [hasMore, setHasMore] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const venue = venueLabels[venueType];
  const meetingLabel = meetingTypeLabels[meetingType];

  const showFoodFilter = venueType === "restaurant";

  const buildQuery = useCallback((foodFilter: string) => {
    const keyword = meetingKeywords[meetingType]?.[venueType] || "맛집";
    const filterPart = foodFilter !== "전체" ? ` ${foodFilter}` : "";
    return `${station.name}역 ${keyword}${filterPart}`;
  }, [station.name, meetingType, venueType]);

  const fetchPlaces = useCallback(async (foodFilter: string) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(buildQuery(foodFilter))}&start=1`);
      if (!res.ok) throw new Error("API 호출 실패");
      const data = await res.json();
      setPlaces(data.items || []);
      setNextStart(data.nextStart ?? 11);
      setHasMore(data.hasMore ?? false);
    } catch {
      setError("장소를 불러오지 못했습니다");
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const fetchMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);

    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(buildQuery(filter))}&start=${nextStart}`);
      if (!res.ok) throw new Error("API 호출 실패");
      const data = await res.json();
      setPlaces((prev) => {
        // title+roadAddress 기준 중복 제거
        const existingKeys = new Set(prev.map((p) => `${p.title}__${p.roadAddress}`));
        const newItems = (data.items || []).filter(
          (p: PlaceItem) => !existingKeys.has(`${p.title}__${p.roadAddress}`)
        );
        return [...prev, ...newItems];
      });
      setNextStart(data.nextStart ?? nextStart + 10);
      setHasMore(data.hasMore ?? false);
    } catch {
      // 더 보기 실패는 조용히 무시
    } finally {
      setLoadingMore(false);
    }
  }, [buildQuery, filter, nextStart, loadingMore]);

  useEffect(() => {
    fetchPlaces(filter);
  }, [fetchPlaces, filter]);

  function handleFilterClick(f: string) {
    setFilter(f);
  }

  function naverSearchUrl(title: string) {
    return `https://search.naver.com/search.naver?query=${encodeURIComponent(title)}`;
  }

  function instaSearchUrl(title: string) {
    return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(title)}`;
  }

  async function copyAddress(idx: number, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {
      // clipboard 불가 환경 대비
    }
  }

  // 네이버 카테고리에서 간단한 태그 추출
  function extractTag(category: string): string {
    const parts = category.split(">");
    return parts[parts.length - 1]?.trim() || "맛집";
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
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            {foodFilters.map((f) => (
              <button
                key={f}
                onClick={() => handleFilterClick(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                  ${filter === f
                    ? "bg-[#111] text-white"
                    : "bg-surface border border-border text-text-muted hover:bg-surface-hover"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none" />
        </div>
      )}

      {/* 장소 리스트 */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <Loader2 className="w-6 h-6 text-[#999] animate-spin" />
            <p className="text-sm text-text-muted">{meetingLabel}에 딱 맞는 장소를 찾는 중...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">{error}</p>
            <button onClick={() => fetchPlaces(filter)} className="mt-3 text-foreground text-sm font-medium underline">
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
              className="bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all"
            >
              {/* 상단: 썸네일 + 텍스트 */}
              <div className="flex gap-3 p-3.5 pb-3">
                {/* 정방형 썸네일 */}
                <div className="relative w-[88px] h-[88px] shrink-0 rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={place.imageUrl || defaultImage}
                    alt={place.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = defaultImage; }}
                  />
                  {i === 0 && (
                    <div className="absolute top-1.5 left-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#111] text-white font-bold shadow-sm">
                        TOP
                      </span>
                    </div>
                  )}
                </div>

                {/* 텍스트 정보 */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <p className="font-bold text-sm leading-snug truncate">{place.title}</p>
                    {place.roadAddress && (
                      <p className="text-[11px] text-text-muted mt-0.5 truncate">{place.roadAddress}</p>
                    )}
                    {place.telephone && (
                      <p className="text-[11px] text-text-muted">{place.telephone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {place.category.split(">").slice(-2).map((cat, ci) => (
                      <span key={ci} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0F0F0] text-[#666] font-medium">
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 하단: 액션 버튼 4개 */}
              <div className="border-t border-border grid grid-cols-4">
                {/* 네이버 */}
                <a
                  href={naverSearchUrl(place.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 py-2.5 hover:bg-surface-hover transition-colors"
                >
                  <span className="w-5 h-5 rounded-[5px] bg-[#03C75A] flex items-center justify-center
                                   text-white text-[10px] font-extrabold leading-none">N</span>
                  <span className="text-[10px] text-text-muted font-medium">네이버</span>
                </a>

                {/* 인스타그램 */}
                <a
                  href={instaSearchUrl(place.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 py-2.5 hover:bg-surface-hover transition-colors
                             border-l border-border"
                >
                  <Instagram className="w-5 h-5 text-[#E1306C]" />
                  <span className="text-[10px] text-text-muted font-medium">인스타</span>
                </a>

                {/* 전화 */}
                {place.telephone ? (
                  <a
                    href={`tel:${place.telephone.replace(/-/g, "")}`}
                    className="flex flex-col items-center gap-1 py-2.5 hover:bg-surface-hover transition-colors
                               border-l border-border"
                  >
                    <Phone className="w-5 h-5 text-[#555]" />
                    <span className="text-[10px] text-text-muted font-medium">전화</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-2.5 opacity-30 border-l border-border cursor-not-allowed">
                    <Phone className="w-5 h-5 text-[#555]" />
                    <span className="text-[10px] text-text-muted font-medium">전화</span>
                  </div>
                )}

                {/* 주소 복사 */}
                <button
                  onClick={() => copyAddress(i, place.roadAddress || place.address)}
                  className="flex flex-col items-center gap-1 py-2.5 hover:bg-surface-hover transition-colors
                             border-l border-border"
                >
                  {copiedIdx === i ? (
                    <Check className="w-5 h-5 text-[#22C55E]" />
                  ) : (
                    <Copy className="w-5 h-5 text-[#555]" />
                  )}
                  <span className={`text-[10px] font-medium ${copiedIdx === i ? "text-[#22C55E]" : "text-text-muted"}`}>
                    {copiedIdx === i ? "복사됨" : "주소복사"}
                  </span>
                </button>
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
