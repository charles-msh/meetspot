"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { RecommendedStation, VenueType, MeetingType, PlaceItem } from "@/lib/types";
import { UtensilsCrossed, Wine, Coffee, ArrowLeft, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  station: RecommendedStation;
  venueType: VenueType;
  meetingType: MeetingType;
  onBack: () => void;
  onRestart: () => void;
  onSelectPlace: (place: PlaceItem) => void;
  scrollRef?: React.RefObject<HTMLElement | null>;
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

const meetingKeywords: Record<MeetingType, Record<VenueType, string>> = {
  date: { restaurant: "데이트 맛집", bar: "분위기 좋은 바", cafe: "감성 카페" },
  friends: { restaurant: "맛집", bar: "술집", cafe: "카페" },
  work: { restaurant: "회식 맛집", bar: "회식 술집", cafe: "카페" },
  club: { restaurant: "모임 맛집", bar: "단체 술집", cafe: "단체 카페" },
  business: { restaurant: "비즈니스 레스토랑", bar: "분위기 좋은 바", cafe: "조용한 카페" },
  family: { restaurant: "가족 맛집", bar: "와인바", cafe: "카페" },
};

const foodFilters = ["전체", "한식", "일식", "중식", "양식", "패스트푸드"];
const defaultImage = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop";
const ITEMS_PER_PAGE = 10;
const MAX_PAGES = 5;
const IMAGE_LOAD_TIMEOUT_MS = 4000; // 이미지 로드 최대 대기시간

interface PageEntry { items: PlaceItem[]; total: number; }
type PageCache = Map<string, Map<number, PageEntry>>;

// ── 스켈레톤 카드 컴포넌트 ───────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-4 pt-3.5 pb-3">
        <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 w-1/3 bg-gray-100 rounded animate-pulse mt-1.5" />
      </div>
      <div className="flex gap-1 px-4 pb-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shrink-0 w-[120px] h-[120px] bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function Step4Places({ station, venueType, meetingType, onBack, onRestart, onSelectPlace, scrollRef }: Props) {
  const [filter, setFilter] = useState("전체");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageCache, setPageCache] = useState<PageCache>(new Map());
  const [imagesReady, setImagesReady] = useState(false);
  const prefetchedRef = useRef<Set<string>>(new Set());
  const imageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const venue = venueLabels[venueType];
  const meetingLabel = meetingTypeLabels[meetingType];
  const showFoodFilter = venueType === "restaurant";

  const currentEntry = pageCache.get(filter)?.get(page);
  const total = currentEntry?.total ?? 0;
  const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));

  // ── 크로스-페이지 중복 제거 ──────────────────────────────────
  // 현재 페이지 이전에 이미 표시된 업체명을 수집
  const seenBeforeCurrentPage = useMemo(() => {
    const seen = new Set<string>();
    const filterCache = pageCache.get(filter);
    if (filterCache && page > 1) {
      for (let p = 1; p < page; p++) {
        filterCache.get(p)?.items.forEach(item => seen.add(item.title));
      }
    }
    return seen;
  }, [pageCache, filter, page]);

  const places = (currentEntry?.items ?? []).filter(
    item => !seenBeforeCurrentPage.has(item.title)
  );

  // ── 이미지 프리로드 → 전부 로드되면 화면 전환 ────────────────
  useEffect(() => {
    if (loading) return;
    if (places.length === 0) { setImagesReady(true); return; }

    setImagesReady(false);

    const urls = places.flatMap(p =>
      p.imageUrls?.length > 0 ? p.imageUrls.slice(0, 3) : [defaultImage]
    );

    if (urls.length === 0) { setImagesReady(true); return; }

    // 최대 대기시간 타이머 (느린 네트워크 대비)
    if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
    imageTimerRef.current = setTimeout(() => setImagesReady(true), IMAGE_LOAD_TIMEOUT_MS);

    let remaining = urls.length;
    const done = () => {
      remaining--;
      if (remaining <= 0) {
        if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
        setImagesReady(true);
      }
    };

    for (const url of urls) {
      const img = new window.Image();
      img.onload = done;
      img.onerror = done;
      img.src = url;
    }

    return () => {
      if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, filter]);

  const buildQuery = useCallback((foodFilter: string) => {
    const keyword = meetingKeywords[meetingType]?.[venueType] || "맛집";
    const filterPart = foodFilter !== "전체" ? ` ${foodFilter}` : "";
    return `${station.name}역 ${keyword}${filterPart}`;
  }, [station.name, meetingType, venueType]);

  const fetchPage = useCallback(async (f: string, p: number): Promise<boolean> => {
    const key = `${f}:${p}`;
    if (prefetchedRef.current.has(key)) return true;
    prefetchedRef.current.add(key);
    try {
      const start = (p - 1) * ITEMS_PER_PAGE + 1;
      const res = await fetch(`/api/search?query=${encodeURIComponent(buildQuery(f))}&start=${start}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPageCache(prev => {
        const next = new Map(prev);
        if (!next.has(f)) next.set(f, new Map());
        next.get(f)!.set(p, { items: data.items || [], total: data.total ?? 0 });
        return next;
      });
      return true;
    } catch {
      prefetchedRef.current.delete(key);
      return false;
    }
  }, [buildQuery]);

  // 마운트: 전체 1페이지 → 나머지 필터 1페이지 백그라운드 프리패치
  useEffect(() => {
    let cancelled = false;
    setFilter("전체");
    setPage(1);
    setPageCache(new Map());
    setImagesReady(false);
    prefetchedRef.current = new Set();

    async function init() {
      setLoading(true);
      setError("");
      const ok = await fetchPage("전체", 1);
      if (!ok) setError("장소를 불러오지 못했습니다");
      setLoading(false);

      if (!showFoodFilter || cancelled) return;
      for (const f of foodFilters.filter(f => f !== "전체")) {
        if (cancelled) break;
        await fetchPage(f, 1);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station.name, meetingType, venueType]);

  async function goToPage(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    scrollRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
    setImagesReady(false);
    setPage(p);
    if (!prefetchedRef.current.has(`${filter}:${p}`)) {
      setLoading(true);
      await fetchPage(filter, p);
      setLoading(false);
    }
  }

  async function handleFilterClick(f: string) {
    if (f === filter) return;
    scrollRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
    setImagesReady(false);
    setFilter(f);
    setPage(1);
    if (!prefetchedRef.current.has(`${f}:1`)) {
      setLoading(true);
      await fetchPage(f, 1);
      setLoading(false);
    }
  }

  function getPageNumbers(): number[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  }

  // 로딩 중이거나 이미지 아직 준비 안 됨 → 스켈레톤 표시
  const showSkeleton = loading || (!imagesReady && !error);

  return (
    <div className="space-y-4">
      {/* 약속 컨텍스트 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          {venue.icon}
          <span className="font-semibold">{venue.label}</span>
        </div>
        <span className="text-text-muted text-sm">·</span>
        <span className="text-sm text-text-muted">{meetingLabel}에 딱 맞는 추천</span>
      </div>

      {/* 음식 필터 */}
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
        {error ? (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">{error}</p>
            <button
              onClick={() => { prefetchedRef.current.delete(`${filter}:1`); handleFilterClick(filter); }}
              className="mt-3 text-foreground text-sm font-medium underline"
            >
              다시 시도
            </button>
          </div>
        ) : showSkeleton ? (
          /* 스켈레톤 카드: 데이터 로딩 중 또는 이미지 프리로드 중 */
          <>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </>
        ) : places.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            <Search className="w-4 h-4 mx-auto mb-2" />
            해당 조건의 장소를 찾지 못했습니다
          </div>
        ) : (
          places.map((place, i) => (
            <div
              key={i}
              onClick={() => onSelectPlace(place)}
              className="bg-surface border border-border rounded-2xl overflow-hidden hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer"
            >
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

      {/* 페이지네이션 */}
      {!showSkeleton && places.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 py-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted
                       disabled:opacity-30 hover:bg-surface-hover transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {getPageNumbers().map((p) => (
            <button
              key={p}
              onClick={() => goToPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-all
                ${p === page
                  ? "bg-[#111] text-white"
                  : "text-text-muted hover:bg-surface-hover"
                }`}
            >
              {p}
            </button>
          ))}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted
                       disabled:opacity-30 hover:bg-surface-hover transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
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
