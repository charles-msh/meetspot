"use client";

import { useState, useRef, useEffect } from "react";
import type { MeetingInfo, Participant, RecommendedStation, PlaceItem, Step4InitialData } from "@/lib/types";
import type { MeetingType, VenueType } from "@/lib/types";
import { findStation } from "@/data/stations";
import { findBestStations } from "@/lib/midpoint";
import Step1MeetingType from "@/components/steps/Step1MeetingType";
import Step2Location from "@/components/steps/Step2Location";
import Step3Result from "@/components/steps/Step3Result";
import Step4Places from "@/components/steps/Step4Places";
import Step5PlaceDetail from "@/components/steps/Step5PlaceDetail";
import { MapPin, ChevronLeft, Train, Users, Star, UtensilsCrossed, ImageIcon } from "lucide-react";
import { displayName } from "@/data/stations";

const stepLabels = ["약속 유형", "위치 입력", "추천 장소", "장소 목록", "상세 보기"];

// Step4Places와 동일한 키워드 테이블 (브릿지 프리페치용)
const MEETING_KEYWORDS: Record<MeetingType, Record<VenueType, string>> = {
  date:     { restaurant: "데이트 맛집", bar: "분위기 좋은 바",     cafe: "감성 카페" },
  friends:  { restaurant: "맛집",        bar: "술집",               cafe: "카페" },
  work:     { restaurant: "회식 맛집",   bar: "회식 술집",          cafe: "카페" },
  club:     { restaurant: "모임 맛집",   bar: "단체 술집",          cafe: "단체 카페" },
  business: { restaurant: "비즈니스 레스토랑", bar: "분위기 좋은 바", cafe: "조용한 카페" },
  family:   { restaurant: "가족 맛집",   bar: "와인바",             cafe: "카페" },
};
const FOOD_FILTERS = ["전체", "한식", "일식", "중식", "양식", "패스트푸드"];

function getLoadingMessage(pct: number): { main: string; sub: string } {
  if (pct === 0)  return { main: "중간 지점 후보를 뽑고 있어요", sub: "잠시만 기다려 주세요" };
  if (pct < 35)   return { main: "각 역까지 이동 시간을 확인하고 있어요", sub: "실제 대중교통 경로를 계산 중이에요" };
  if (pct < 70)   return { main: "더 많은 경로를 확인하고 있어요", sub: "조금만 더 기다려 주세요" };
  if (pct < 95)   return { main: "거의 다 됐어요!", sub: "최적 장소를 추리고 있어요" };
  return           { main: "결과를 정리하고 있어요", sub: "곧 추천 장소가 나타납니다" };
}

// 브릿지 오버레이 메시지 (전체 진행률 기준)
function getBridgeLoadingMessage(pct: number): { main: string; sub: string } {
  if (pct <  10) return { main: "장소 목록을 가져오고 있어요",   sub: "잠시만 기다려 주세요" };
  if (pct <  60) return { main: "주변 맛집을 찾고 있어요",       sub: "음식 종류별로 검색하고 있어요" };
  if (pct <  80) return { main: "업체 사진을 불러오고 있어요",   sub: "사진을 미리 받아두고 있어요" };
  if (pct <  98) return { main: "거의 다 됐어요!",               sub: "곧 장소 목록이 나타납니다" };
  return          { main: "마무리하고 있어요",                   sub: "곧 장소 목록이 나타납니다" };
}

export default function Home() {
  const [step, setStep] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

  // 단계 이동 시 항상 최상단으로 스크롤
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [step]);
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    peopleCount: 2,
    meetingType: "friends",
    venueType: "restaurant",
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [results, setResults] = useState<RecommendedStation[]>([]);
  const [resultsNoPop, setResultsNoPop] = useState<RecommendedStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<RecommendedStation | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [bridgeProgress, setBridgeProgress] = useState<{
    phase: "api" | "images";
    current: number;
    total: number;
  } | null>(null);
  const [step4InitialData, setStep4InitialData] = useState<Step4InitialData | null>(null);

  function handleFindMidpoint() {
    const stationData = participants
      .map((p) => findStation(p.station))
      .filter((s) => s !== undefined);
    if (stationData.length < 2) return;
    setProgress({ current: 0, total: 0 });
    setResults(findBestStations(stationData, true));
    setResultsNoPop(findBestStations(stationData, false));
    setComputing(true);
  }

  function handleProgress(current: number, total: number) {
    setProgress({ current, total });
  }

  function handleResultsReady() {
    setComputing(false);
    setStep((prev) => (prev === 1 ? 2 : prev));
  }

  async function handleSelectStation(station: RecommendedStation) {
    setSelectedStation(station);

    // 브릿지: 모든 필터의 1페이지 데이터를 병렬로 미리 가져옴
    const keyword = MEETING_KEYWORDS[meetingInfo.meetingType]?.[meetingInfo.venueType] ?? "맛집";
    const isRestaurant = meetingInfo.venueType === "restaurant";
    const filters = isRestaurant ? FOOD_FILTERS : ["전체"];

    // API 단계 시작
    setBridgeProgress({ phase: "api", current: 0, total: filters.length });

    const buildQuery = (f: string) => {
      const filterPart = f !== "전체" ? ` ${f}` : "";
      return `${station.name}역 ${keyword}${filterPart}`;
    };

    // API 병렬 호출 (최대 10초) – 완료 시마다 진행률 업데이트
    let apiCompleted = 0;
    const apiResults = await Promise.race([
      Promise.all(
        filters.map(async (f) => {
          try {
            const res = await fetch(`/api/search?query=${encodeURIComponent(buildQuery(f))}&page=1`);
            if (!res.ok) {
              setBridgeProgress({ phase: "api", current: ++apiCompleted, total: filters.length });
              return [f, null] as const;
            }
            const data = await res.json();
            setBridgeProgress({ phase: "api", current: ++apiCompleted, total: filters.length });
            return [f, { items: (data.items || []) as PlaceItem[], total: (data.total ?? 0) as number }] as const;
          } catch {
            setBridgeProgress({ phase: "api", current: ++apiCompleted, total: filters.length });
            return [f, null] as const;
          }
        })
      ),
      new Promise<typeof filters extends string[] ? [string, null][] : never>((resolve) =>
        setTimeout(() => resolve(filters.map(f => [f, null] as const) as [string, null][]), 10_000)
      ),
    ]);

    const initialData: Step4InitialData = new Map(
      apiResults.filter(([, v]) => v !== null) as [string, { items: PlaceItem[]; total: number }][]
    );

    // 이미지 브라우저 캐시 적재 (업체당 앞 3장, 최대 5초)
    const allItems = [...initialData.values()].flatMap(d => d.items);
    const allUrls = allItems.flatMap(item => (item.imageUrls ?? []).slice(0, 3));
    if (allUrls.length > 0) {
      // 이미지 단계 시작
      setBridgeProgress({ phase: "images", current: 0, total: allUrls.length });
      let imgCompleted = 0;
      await Promise.race([
        Promise.all(allUrls.map(url => new Promise<void>(resolve => {
          const img = new Image();
          img.onload = () => {
            setBridgeProgress({ phase: "images", current: ++imgCompleted, total: allUrls.length });
            resolve();
          };
          img.onerror = () => {
            setBridgeProgress({ phase: "images", current: ++imgCompleted, total: allUrls.length });
            resolve();
          };
          img.src = url;
        }))),
        new Promise<void>(resolve => setTimeout(resolve, 5_000)),
      ]);
    }

    setStep4InitialData(initialData);
    setBridgeProgress(null);
    setStep(3);
  }

  function handleSelectPlace(place: PlaceItem) {
    setSelectedPlace(place);
    setStep(4);
  }

  function handleBack() {
    if (computing) setComputing(false);
    if (bridgeProgress) setBridgeProgress(null);
    if (step > 0) setStep(step - 1);
  }

  function handleRestart() {
    setStep(0);
    setComputing(false);
    setBridgeProgress(null);
    setMeetingInfo({ peopleCount: 2, meetingType: "friends", venueType: "restaurant" });
    setParticipants([]);
    setResults([]);
    setResultsNoPop([]);
    setSelectedStation(null);
    setSelectedPlace(null);
  }

  const progressPct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const loadingMsg = getLoadingMessage(progressPct);

  // 브릿지 진행률: API 단계 0→60%, 이미지 단계 60→100%
  const bridgePct = bridgeProgress
    ? bridgeProgress.phase === "api"
      ? Math.round((bridgeProgress.current / Math.max(bridgeProgress.total, 1)) * 60)
      : Math.round(60 + (bridgeProgress.current / Math.max(bridgeProgress.total, 1)) * 40)
    : 0;
  const bridgeMsg = getBridgeLoadingMessage(bridgePct);

  return (
    <div className="h-dvh bg-background flex flex-col overflow-hidden">

      {/* ── 로딩 오버레이 ── */}
      {computing && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-[#111] flex items-center justify-center mb-8">
            {progressPct === 0 && <Users className="w-7 h-7 text-white" />}
            {progressPct > 0 && progressPct < 70 && <Train className="w-7 h-7 text-white" />}
            {progressPct >= 70 && <Star className="w-7 h-7 text-white" />}
          </div>
          <p className="text-[17px] font-bold text-foreground text-center leading-snug mb-1">
            {loadingMsg.main}
          </p>
          <p className="text-sm text-text-muted text-center mb-10">
            {loadingMsg.sub}
          </p>
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-2">
              {/* 진행 바만 브랜드 컬러 사용 */}
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-right text-xs font-medium text-text-muted">{progressPct}%</p>
          </div>
        </div>
      )}

      {/* ── 장소 목록 브릿지 오버레이 ── */}
      {bridgeProgress && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-8">
          <div className="w-14 h-14 rounded-2xl bg-[#111] flex items-center justify-center mb-8">
            {bridgeProgress.phase === "api"
              ? <UtensilsCrossed className="w-7 h-7 text-white" />
              : <ImageIcon className="w-7 h-7 text-white" />
            }
          </div>
          <p className="text-[17px] font-bold text-foreground text-center leading-snug mb-1">
            {bridgeMsg.main}
          </p>
          <p className="text-sm text-text-muted text-center mb-10">
            {bridgeMsg.sub}
          </p>
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-surface rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${bridgePct}%` }}
              />
            </div>
            <p className="text-right text-xs font-medium text-text-muted">{bridgePct}%</p>
          </div>
        </div>
      )}

      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border">
        <div className="max-w-md mx-auto px-4 h-13 flex items-center gap-2">
          {step > 0 ? (
            <button
              onClick={handleBack}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface transition-colors"
              aria-label="이전 단계"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            /* 로고 아이콘: 브랜드 컬러 없이 검정 */
            <div className="w-7 h-7 rounded-lg bg-[#111] flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <button
            onClick={handleRestart}
            className="font-bold text-[17px] tracking-tight text-foreground hover:opacity-70 transition-opacity"
          >
            만나<span className="text-primary">spot</span>
          </button>
        </div>
      </header>

      {/* ── 스텝 인디케이터 ── */}
      <div className="max-w-md mx-auto w-full px-4 pt-4">
        <div className="flex gap-1.5">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full h-[3px] rounded-full transition-all duration-300 ${
                i <= step ? "bg-primary" : "bg-border"
              }`} />
              {/* 라벨: 현재 단계만 진하게, 컬러 없이 */}
              <span className={`text-[10px] transition-colors ${
                i === step ? "text-foreground font-semibold" : "text-text-muted"
              }`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 메인 ── */}
      <main ref={mainRef} className="flex-1 overflow-y-auto max-w-md mx-auto w-full px-4 pt-4 pb-6">
        {step < 3 && (
          <h2 className="text-[22px] font-bold tracking-tight mb-4">
            {step === 0 && "어떤 약속인가요?"}
            {step === 1 && "어디서 출발하나요?"}
            {step === 2 && "여기서 만나요!"}
          </h2>
        )}

        {step === 0 && (
          <Step1MeetingType
            data={meetingInfo}
            onChange={setMeetingInfo}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <Step2Location
            peopleCount={meetingInfo.peopleCount}
            participants={participants}
            onChange={setParticipants}
            onNext={handleFindMidpoint}
            onBack={() => setStep(0)}
          />
        )}
        {results.length > 0 && (
          <div className={step !== 2 ? "hidden" : ""}>
            <Step3Result
              results={results}
              resultsNoPop={resultsNoPop}
              participants={participants}
              onReady={handleResultsReady}
              onProgress={handleProgress}
              onSelect={handleSelectStation}
              onBack={() => setStep(1)}
            />
          </div>
        )}
        {step === 3 && selectedStation && (
          <Step4Places
            station={selectedStation}
            venueType={meetingInfo.venueType}
            meetingType={meetingInfo.meetingType}
            onBack={() => setStep(2)}
            onRestart={handleRestart}
            onSelectPlace={handleSelectPlace}
            scrollRef={mainRef}
            initialData={step4InitialData ?? undefined}
          />
        )}
        {step === 4 && selectedPlace && selectedStation && (
          <Step5PlaceDetail
            place={selectedPlace}
            station={selectedStation}
            onBack={() => setStep(3)}
            onRestart={handleRestart}
          />
        )}
      </main>

      {/* ── 푸터 ── */}
      <footer className="border-t border-border py-3">
        <p className="text-center text-[10px] text-text-muted">
          만나spot beta · 수도권 지하철역 기반
        </p>
      </footer>
    </div>
  );
}
