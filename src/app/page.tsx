"use client";

import { useState } from "react";
import type { MeetingInfo, Participant, RecommendedStation } from "@/lib/types";
import { findStation } from "@/data/stations";
import { findBestStations } from "@/lib/midpoint";
import Step1MeetingType from "@/components/steps/Step1MeetingType";
import Step2Location from "@/components/steps/Step2Location";
import Step3Result from "@/components/steps/Step3Result";
import Step4Places from "@/components/steps/Step4Places";
import { MapPin, ChevronLeft, Loader2 } from "lucide-react";

const stepLabels = ["약속 유형", "위치 입력", "추천 장소", "상세 보기"];

export default function Home() {
  const [step, setStep] = useState(0);

  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo>({
    peopleCount: 2,
    meetingType: "friends",
    venueType: "restaurant",
  });

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [results, setResults] = useState<RecommendedStation[]>([]);          // 핫플 포함 모드 후보
  const [resultsNoPop, setResultsNoPop] = useState<RecommendedStation[]>([]); // 딱 중간 모드 후보
  const [selectedStation, setSelectedStation] = useState<RecommendedStation | null>(null);
  // 2단계에서 ODsay 계산 중 여부 (계산 완료 후 3단계로 전환)
  const [computing, setComputing] = useState(false);

  function handleFindMidpoint() {
    const stationData = participants
      .map((p) => findStation(p.station))
      .filter((s) => s !== undefined);

    if (stationData.length < 2) return;

    setResults(findBestStations(stationData, true));
    setResultsNoPop(findBestStations(stationData, false));
    setComputing(true);
    // setStep(2)는 Step3Result 계산 완료 후 onReady에서 호출
  }

  function handleResultsReady() {
    setComputing(false);
    // 여전히 2단계(위치 입력)에 있을 때만 3단계로 전환
    setStep((prev) => (prev === 1 ? 2 : prev));
  }

  function handleSelectStation(station: RecommendedStation) {
    setSelectedStation(station);
    setStep(3);
  }

  function handleBack() {
    // 계산 중 뒤로 가면 로딩 해제
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

  return (
    <div className="min-h-dvh bg-background flex flex-col">
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
            {step === 3 && `${selectedStation?.name}역 근처`}
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
          <div className="relative">
            <Step2Location
              peopleCount={meetingInfo.peopleCount}
              participants={participants}
              onChange={setParticipants}
              onNext={handleFindMidpoint}
              onBack={() => setStep(0)}
            />
            {computing && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-text-muted">중간 지점을 찾는 중이에요</p>
              </div>
            )}
          </div>
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
