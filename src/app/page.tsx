"use client";

import { useState } from "react";
import type { MeetingInfo, Participant, RecommendedStation } from "@/lib/types";
import { findStation } from "@/data/stations";
import { findBestStations } from "@/lib/midpoint";
import Step1MeetingType from "@/components/steps/Step1MeetingType";
import Step2Location from "@/components/steps/Step2Location";
import Step3Result from "@/components/steps/Step3Result";
import Step4Places from "@/components/steps/Step4Places";
import { MapPin, ChevronLeft, Train } from "lucide-react";
import { displayName } from "@/data/stations";

const stepLabels = ["약속 유형", "위치 입력", "추천 장소", "상세 보기"];

// 진행률 구간별 상태 메시지
function getLoadingMessage(pct: number): { main: string; sub: string } {
  if (pct === 0)  return { main: "중간 지점 후보를 뽑고 있어요", sub: "잠시만 기다려 주세요" };
  if (pct < 35)   return { main: "각 역까지 이동 시간을 확인하고 있어요", sub: "실제 대중교통 경로를 계산 중이에요" };
  if (pct < 70)   return { main: "더 많은 경로를 확인하고 있어요", sub: "조금만 더 기다려 주세요" };
  if (pct < 95)   return { main: "거의 다 됐어요!", sub: "최적 장소를 추리고 있어요" };
  return           { main: "결과를 정리하고 있어요", sub: "곧 추천 장소가 나타납니다" };
}

export default function Home() {
  const [step, setStep] = useState(0);

  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    peopleCount: 2,
    meetingType: "friends",
    venueType: "restaurant",
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [results, setResults] = useState<RecommendedStation[]>([]);
  const [resultsNoPop, setResultsNoPop] = useState<RecommendedStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<RecommendedStation | null>(null);
  const [computing, setComputing] = useState(false);
  // ODsay 진행률: { current, total }
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
  }

  const progressPct = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const loadingMsg = getLoadingMessage(progressPct);

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* 전체 화면 로딩 오버레이 (계산 중일 때) */}
      {computing && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-10 gap-10">
          {/* 아이콘 */}
          <div className="w-20 h-20 rounded-3xl bg-primary flex items-center justify-center shadow-lg">
            <Train className="w-10 h-10 text-white" />
          </div>

          {/* 상태 메시지 */}
          <div className="text-center space-y-2 w-full">
            <p className="text-lg font-bold text-foreground transition-all duration-500">
              {loadingMsg.main}
            </p>
            <p className="text-sm text-text-muted transition-all duration-500">
              {loadingMsg.sub}
            </p>
          </div>

          {/* 진행률 바 */}
          <div className="w-full space-y-3">
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-right text-sm font-semibold text-primary">
              {progressPct}%
            </p>
          </div>

          {/* 취소 */}
          <button
            onClick={handleBack}
            className="text-sm text-text-muted hover:text-foreground transition-colors"
          >
            취소
          </button>
        </div>
      )}

      {/* 헤더 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-2">
          {step > 0 ? (
            <button
              onClick={handleBack}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-surface transition-colors"
              aria-label="이전 단계"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" />
            </div>
          )}
          <h1 className="font-bold text-lg">
            만나<span className="text-primary">spot</span>
          </h1>
        </div>
      </header>

      {/* 프로그레스 바 */}
      <div className="max-w-md mx-auto w-full px-4 pt-4">
        <div className="flex items-center gap-1">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex-1">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  i <= step ? "bg-primary" : "bg-border"
                }`}
              />
              <p className={`text-[10px] mt-1 text-center transition-colors ${
                i === step ? "text-primary font-semibold" : "text-text-muted"
              }`}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        {/* Step 별 타이틀 */}
        <div className="mb-6">
          <h2 className="text-xl font-bold">
            {step === 0 && "어떤 약속인가요?"}
            {step === 1 && "어디서 출발하나요?"}
            {step === 2 && "여기서 만나요!"}
            {step === 3 && `${selectedStation ? displayName(selectedStation.name) : ""}역 근처`}
          </h2>
        </div>

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

        {/* Step3Result: 결과가 있는 동안 마운트 유지 (hidden으로 숨김)
            → 다른 단계로 이동해도 ODsay 계산 결과가 보존돼 매번 재계산하지 않음 */}
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
          />
        )}
      </main>

      {/* 푸터 */}
      <footer className="border-t border-border py-3">
        <p className="text-center text-[10px] text-text-muted">
          만나spot beta · 수도권 지하철역 기반
        </p>
      </footer>
    </div>
  );
}
