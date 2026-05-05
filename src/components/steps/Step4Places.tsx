"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { RecommendedStation, VenueType, MeetingType, PlaceItem, Step4InitialData } from "@/lib/types";
import { UtensilsCrossed, Wine, Coffee, ArrowLeft, Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  station: RecommendedStation;
  venueType: VenueType;
  meetingType: MeetingType;
  onBack: () => void;
  onRestart: () => void;
  onSelectPlace: (place: PlaceItem) => void;
  scrollRef?: React.RefObject<HTMLElement | null>;
  // 브릿지에서 미리 가져온 데이터 — 있으면 스켈레톤 없이 즉시 표시
  initialData?: Step4InitialData;
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
const ITEMS_PER_PAGE = 15; // 카카오 로컬 검색 size=15
const MAX_PAGES = 5;

interface PageEntry { items: PlaceItem[]; total: number; }
type PageCache = Map<string, Map<number, PageEntry>>;

// ── 스켈레톤 카드 (API 로딩 중) ─────────────────────────────────
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

export default function Step4Places({
  station, venueType, meetingType, onBack, onRestart, onSelectPlace, scrollRef, initialData,
}: Props) {
  const [filter, setFilter] = useState("전체");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pageCache, setPageCache] = useState<PageCache>(new Map());
  // 각 filter별로 "처음 0건이 나온 페이지" 추적 → 페이지네이션 동적 축소
  const [firstEmptyPageByFilter, setFirstEmptyPageByFilter] = useState<Map<string, number>>(new Map());

  const venue = venueLabels[venueType];
  const meetingLabel = meetingTypeLabels[meetingType];
  const showFoodFilter = venueType === "restaurant";

  const currentEntry = pageCache.get(filter)?.get(page);

  // ── 크로스-페이지 중복 제거 ──────────────────────────────────
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

  // ── 빈 페이지 감지 → firstEmptyPageByFilter 업데이트 ────────
  useEffect(() => {
    if (!currentEntry || loading) return;
    if (places.length === 0) {
      setFirstEmptyPageByFilter(prev => {
        const existing = prev.get(filter);
        if (existing !== undefined && existing <= page) return prev; // 이미 더 앞 페이지가 비어있음
        const next = new Map(prev);
        next.set(filter, page);
        return next;
      });
    } else {
      // 결과 있는 페이지를 확인 → 더 뒤에 있던 firstEmpty 기록이 있으면 제거
      setFirstEmptyPageByFilter(prev => {
        const existing = prev.get(filter);
        if (existing !== undefined && existing <= page) {
          const next = new Map(prev);
          next.delete(filter);
          return next;
        }
        return prev;
      });
    }
  }, [currentEntry, places.length, filter, page, loading]);

  // ── 동적 페이지 수 계산 ──────────────────────────────────────
  const apiTotal = currentEntry?.total ?? 0;
  const rawTotalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(apiTotal / ITEMS_PER_PAGE)));
  const firstEmpty = firstEmptyPageByFilter.get(filter);
  // 빈 페이지가 감지되면 그 직전까지만 표시; 아직 미탐색 구간은 rawTotalPages 기준
  const totalPages = firstEmpty !== undefined
    ? Math.max(1, firstEmpty - 1)
    : rawTotalPages;

  const buildQuery = useCallback((foodFilter: string) => {
    const keyword = meetingKeywords[meetingType]?.[venueType] || "맛집";
    const filterPart = foodFilter !== "전체" ? ` ${foodFilter}` : "";
    return `${station.name}역 ${keyword}${filterPart}`;
  }, [station.name, meetingType, venueType]);

  const prefetchedRef = useRef<Set<string>>(new Set());
  // imgPreloadedRef: 브라우저 캐시에 이미지까지 적재 완료된 페이지 추적
  const imgPreloadedRef = useRef<Set<string>>(new Set());
  // pageCacheRef: async 함수 안에서 최신 pageCache에 접근하기 위한 동기 미러
  const pageCacheRef = useRef<PageCache>(new Map());
  useEffect(() => { pageCacheRef.current = pageCache; }, [pageCache]);

  // ── fetchPage: API 데이터 가져오기, items 반환 ───────────────
  const fetchPage = useCallback(async (f: string, p: number): Promise<PlaceItem[]> => {
    const key = `${f}:${p}`;
    if (prefetchedRef.current.has(key)) {
      return pageCacheRef.current.get(f)?.get(p)?.items ?? [];
    }
    prefetchedRef.current.add(key);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(buildQuery(f))}&page=${p}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const items: PlaceItem[] = data.items || [];
      setPageCache(prev => {
        const next = new Map(prev);
        if (!next.has(f)) next.set(f, new Map());
        next.get(f)!.set(p, { items, total: data.total ?? 0 });
        return next;
      });
      return items;
    } catch {
      prefetchedRef.current.delete(key);
      return [];
    }
  }, [buildQuery]);

  // ── preloadPageImages: 이미지를 브라우저 캐시에 미리 적재 ────
  // 업체당 앞 3장만 적재 (뒤 이미지는 사용자가 스크롤할 때 자연 로드)
  // 최대 4초 대기 후 타임아웃 (네트워크 느린 환경 대비)
  const preloadPageImages = useCallback(async (f: string, p: number, items: PlaceItem[]) => {
    const key = `imgs:${f}:${p}`;
    if (imgPreloadedRef.current.has(key)) return;
    const urls = items.flatMap(item =>
      (item.imageUrls?.length > 0 ? item.imageUrls : [defaultImage]).slice(0, 3)
    );
    if (urls.length === 0) { imgPreloadedRef.current.add(key); return; }
    await Promise.race([
      Promise.all(urls.map(url => new Promise<void>(resolve => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      }))),
      new Promise<void>(resolve => setTimeout(resolve, 4000)),
    ]);
    imgPreloadedRef.current.add(key);
  }, []);

  // ── 다음 페이지 프리페치 + 이미지 프리로드 (백그라운드) ──────
  // 현재 페이지 표시 중에 다음 페이지 API 데이터 + 이미지를 모두 준비
  // → 페이지 이동 클릭 시 브릿지 없이 즉시 전환
  useEffect(() => {
    if (!currentEntry || loading) return;
    const nextPage = page + 1;
    if (nextPage > rawTotalPages) return;
    const apiKey = `${filter}:${nextPage}`;
    const imgKey = `imgs:${filter}:${nextPage}`;
    if (!prefetchedRef.current.has(apiKey)) {
      // API 먼저 → 완료되면 이미지 프리로드
      fetchPage(filter, nextPage).then(items => {
        if (items.length > 0) preloadPageImages(filter, nextPage, items);
      });
    } else if (!imgPreloadedRef.current.has(imgKey)) {
      // API는 이미 있는데 이미지만 안 된 경우
      const items = pageCacheRef.current.get(filter)?.get(nextPage)?.items ?? [];
      if (items.length > 0) preloadPageImages(filter, nextPage, items);
    }
  }, [currentEntry, loading, filter, page, rawTotalPages, fetchPage, preloadPageImages]);

  useEffect(() => {
    let cancelled = false;
    setFilter("전체");
    setPage(1);
    setPageCache(new Map());
    setFirstEmptyPageByFilter(new Map());
    prefetchedRef.current = new Set();
    imgPreloadedRef.current = new Set();

    // 브릿지에서 미리 가져온 데이터가 있으면 → 즉시 캐시 적재, 스켈레톤 생략
    if (initialData && initialData.size > 0) {
      const cache = new Map<string, Map<number, PageEntry>>();
      for (const [f, data] of initialData) {
        cache.set(f, new Map([[1, data]]));
        prefetchedRef.current.add(`${f}:1`);
        imgPreloadedRef.current.add(`imgs:${f}:1`); // 브릿지에서 이미 프리로드 완료
      }
      setPageCache(cache);
      setLoading(false);
      return () => { cancelled = true; };
    }

    // initialData 없음 (직접 접근 등) → 기존 방식으로 로딩
    async function init() {
      setLoading(true);
      setError("");
      const items = await fetchPage("전체", 1);
      if (items.length === 0 && !prefetchedRef.current.has("전체:1")) {
        setError("장소를 불러오지 못했습니다");
      }
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

    const apiReady = prefetchedRef.current.has(`${filter}:${p}`);
    const imgsReady = imgPreloadedRef.current.has(`imgs:${filter}:${p}`);

    // API 또는 이미지가 아직 준비 안 됐으면 브릿지(스켈레톤) 표시 후 대기
    if (!apiReady || !imgsReady) {
      setLoading(true);
      const items = await fetchPage(filter, p);
      const toPreload = items.length > 0
        ? items
        : pageCacheRef.current.get(filter)?.get(p)?.items ?? [];
      await preloadPageImages(filter, p, toPreload);
      setLoading(false);
    }

    // API + 이미지 모두 준비된 후에 페이지 전환 → 이미지 즉시 표시
    setPage(p);
  }

  async function handleFilterClick(f: string) {
    if (f === filter) return;
    scrollRef?.current?.scrollTo({ top: 0, behavior: "smooth" });
    if (!prefetchedRef.current.has(`${f}:1`)) {
      setLoading(true);
      await fetchPage(f, 1);
      setLoading(false);
    }
    setFilter(f);
    setPage(1);
  }

  function getPageNumbers(): number[] {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, 5];
    if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [page - 2, page - 1, page, page + 1, page + 2];
  }

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
        {loading ? (
          <>{[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}</>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-text-muted text-sm">{error}</p>
            <button
              onClick={() => { prefetchedRef.current.delete(`${filter}:1`); handleFilterClick(filter); }}
              className="mt-3 text-foreground text-sm font-medium underline"
            >
              다시 시도
            </button>
          </div>
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

              {/* 이미지: 개별 스켈레톤 → 로드 완료 시 페이드인 */}
              <div className="flex gap-1 overflow-x-auto scrollbar-hide px-4 pb-3">
                {(place.imageUrls?.length > 0 ? place.imageUrls : [defaultImage]).map((url, j) => (
                  <div
                    key={j}
                    className="shrink-0 w-[120px] h-[120px] bg-gray-200 animate-pulse overflow-hidden"
                  >
                    <img
                      src={url}
                      alt={`${place.title} ${j + 1}`}
                      className="w-full h-full object-cover transition-opacity duration-300"
                      style={{ opacity: 0 }}
                      onLoad={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.opacity = "1";
                        el.parentElement?.classList.remove("animate-pulse", "bg-gray-200");
                      }}
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        if (el.src !== defaultImage) { el.src = defaultImage; return; }
                        el.style.opacity = "1";
                        el.parentElement?.classList.remove("animate-pulse", "bg-gray-200");
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션: 실제 결과 기반으로 동적 표시 */}
      {!loading && places.length > 0 && totalPages > 1 && (
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
