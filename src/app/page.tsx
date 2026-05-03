"use client";

import { useState, useRef, useEffect } from "react";
import type { MeetingInfo, Participant, RecommendedStation, PlaceItem } from "@/lib/types";
import { findStation } from "@/data/stations";
import { findBestStations } from "@/lib/midpoint";
import Step1MeetingType from "@/components/steps/Step1MeetingType";
import Step2Location from "@/components/steps/Step2Location";
import Step3Result from "@/components/steps/Step3Result";
import Step4Places from "@/components/steps/Step4Places";
import Step5PlaceDetail from "@/components/steps/Step5PlaceDetail";
import { MapPin, ChevronLeft, Train, Users, Star } from "lucide-react";
import { displayName } from "@/data/stations";

const stepLabels = ["약속 유형", "위치 입력", "추천 장소", "장소 목록", "상세 보기"];

function getLoadingMessage(pct: number): { main: string; sub: string } {
  if (pct === 0)  return { main: "중간 지점 후보를 뽑고 있어요", sub: "잠시만 기다려 주세요" };
  if (pct < 35)   return { main: "각 역까지 이동 시간을 확인하고 있어요", sub: "실제 대중교통 경로를 계산 중이에요" };
  if (pct < 70)   return { main: "더 많은 경로를 확인하고 있어요", sub: "조금만 더 기다려 주세요" };
  if (pct < 95)   return { main: "거의 다 됐어요!", sub: "최적 장소를 추리고 있어요" };
  return           { main: "결과를 정리하고 있어요", sub: "곧 추천 장소가 나타납니다" };
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

  function handleSelectStation(station: RecommendedStation) {
    setSelectedStation(station);
    setStep(3);
  }

  function handleSelectPlace(place: PlaceItem) {
    setSelectedPlace(place);
    setStep(4);
  }

  function handleBack() {
    if (computing) setComputing(false);
    if (step > 0) setStep(step - 1);
  }

  function handleRestart() {
    setStep(0);
    setComputing(false);
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
        <h2 className="text-[22px] font-bold tracking-tight mb-4">
          {step === 0 && "어떤 약속인가요?"}
          {step === 1 && "어디서 출발하나요?"}
          {step === 2 && "여기서 만나요!"}
          {step === 3 && `${selectedStation ? displayName(selectedStation.name) : ""}역 근처`}
          {step === 4 && (selectedPlace?.title ?? "")}
        </h2>

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
