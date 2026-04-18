"use client";

import { useState, useEffect, useRef } from "react";
import type { RecommendedStation, Participant } from "@/lib/types";
import { findStation } from "@/data/stations";
import { ChevronRight, Clock, Loader2 } from "lucide-react";
import { getLineColor } from "@/lib/lineColors";

type Mode = "hotspot" | "location";

interface Props {
  results: RecommendedStation[];        // 핫플 포함 모드 후보 (withPopularity=true)
  resultsNoPop: RecommendedStation[];   // 딱 중간 모드 후보 (withPopularity=false)
  participants: Participant[];
  active: boolean;                      // step === 2일 때만 true (hidden 상태에서 재계산 방지)
  onSelect: (station: RecommendedStation) => void;
  onBack: () => void;
}

interface TransitInfo {
  minTime: number | null;
  maxTime: number | null;
  avgTime: number | null;
  hasSameStation: boolean;
  validCount: number;    // 실제 시간이 확인된 참여자 수
  totalCount: number;    // 전체 참여자 수
  loading: boolean;
}

interface RankedData {
  ranked: RecommendedStation[];
  transitMap: Record<string, TransitInfo>;
}

// 최대 N개씩만 병렬 실행 (ODsay 동시 요청 과부하 방지)
async function concurrentMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= items.length) return;
      output[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function fetchTransitTime(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/transit?sx=${fromLng}&sy=${fromLat}&ex=${toLng}&ey=${toLat}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.totalTime ?? null;
  } catch {
    return null;
  }
}

// ODsay 소요시간 기준으로 후보 재정렬 → 상위 5개 반환
// usePopularity=true면 인기도 높은 역에 시간 보너스 적용 (핫플 포함 모드)
async function computeRanking(
  candidates: RecommendedStation[],
  participants: Participant[],
  usePopularity: boolean
): Promise<RankedData> {
  // 후보역 최대 4개씩 병렬 처리 (참여자 3명이면 동시 ODsay 호출 최대 12건)
  const allResults = await concurrentMap(candidates, async (station) => {
    const destStation = findStation(station.name);
    if (!destStation) return { station, times: [], allValid: false };

    const timeResults = await Promise.all(
      participants.map(async (p) => {
        const fromStation = findStation(p.station);
        if (!fromStation) return null;
        if (fromStation.name === destStation.name) return 0; // 출발지 = 목적지
        const time = await fetchTransitTime(
          fromStation.lat, fromStation.lng,
          destStation.lat, destStation.lng
        );
        return time !== null ? Math.max(1, time) : null;
      })
    );

    return {
      station,
      times: timeResults.filter((t): t is number => t !== null),
      allValid: timeResults.every((t) => t !== null),
    };
  }, 4);

  const expected = participants.length;
  // ODsay 실패한 참여자는 120분 패널티로 채워 점수 계산
  // → 데이터 부족한 역이 상위에 오르지 않도록 방지
  const MISSING_PENALTY = 120;

  const sorted = allResults
    .filter(({ times }) => times.length > 0)
    .sort((a, b) => {
      const fillA = Array(Math.max(0, expected - a.times.length)).fill(MISSING_PENALTY);
      const allTimesA = [...a.times, ...fillA];
      const avgA = allTimesA.reduce((s, t) => s + t, 0) / expected;
      const maxA = Math.max(...allTimesA);

      const fillB = Array(Math.max(0, expected - b.times.length)).fill(MISSING_PENALTY);
      const allTimesB = [...b.times, ...fillB];
      const avgB = allTimesB.reduce((s, t) => s + t, 0) / expected;
      const maxB = Math.max(...allTimesB);

      const scoreA = avgA * 0.7 + maxA * 0.3 - (usePopularity ? a.station.popularity * 3 : 0);
      const scoreB = avgB * 0.7 + maxB * 0.3 - (usePopularity ? b.station.popularity * 3 : 0);
      return scoreA - scoreB;
    });

  const top5 = sorted.slice(0, 5);

  const transitMap: Record<string, TransitInfo> = {};
  for (const { station, times } of top5) {
    const hasSameStation = times.some((t) => t === 0);
    const displayTimes = times.map((t) => (t === 0 ? 1 : t));
    const minTime = displayTimes.length > 0 ? Math.min(...displayTimes) : null;
    const maxTime = displayTimes.length > 0 ? Math.max(...displayTimes) : null;
    const avgTime = displayTimes.length > 0
      ? Math.round(displayTimes.reduce((s, t) => s + t, 0) / displayTimes.length)
      : null;
    transitMap[station.name] = {
      minTime, maxTime, avgTime, hasSameStation,
      validCount: displayTimes.length,
      totalCount: expected,
      loading: false,
    };
  }

  return { ranked: top5.map(({ station }) => station), transitMap };
}

const MODE_LABELS: Record<Mode, string> = {
  location: "중간 위치 우선",
  hotspot: "핫플 우선",
};

const MODE_DESC: Record<Mode, string> = {
  location: "모두에게 가장 중간인 곳을 추천해드려요",
  hotspot: "맛집이 많으면서 각자 오기 편한 곳을 추천해드려요",
};

export default function Step3Result({ results, resultsNoPop, participants, active, onSelect, onBack }: Props) {
  const [mode, setMode] = useState<Mode>("location");
  const [calculating, setCalculating] = useState(true);
  const [displayRanked, setDisplayRanked] = useState<RecommendedStation[]>([]);
  const [displayTransitMap, setDisplayTransitMap] = useState<Record<string, TransitInfo>>({});

  // 모드별 결과 캐시 (같은 검색 내에서 모드 전환 시 재계산 없이 즉시 표시)
  const cacheRef = useRef<Partial<Record<Mode, RankedData>>>({});
  // 새 검색(results 교체)을 감지해 캐시 무효화
  const prevResultsRef = useRef(results);

  // results가 바뀌면(새 검색) 캐시 초기화 + 기본 모드로 리셋
  useEffect(() => {
    if (prevResultsRef.current !== results) {
      cacheRef.current = {};
      prevResultsRef.current = results;
      setMode("location");
      setDisplayRanked([]);
      setDisplayTransitMap({});
      setCalculating(true);
    }
  }, [results]);

  // ODsay 재정렬 계산 — active(step===2)일 때만 실행
  useEffect(() => {
    if (!active || results.length === 0 || participants.length === 0) return;

    const cached = cacheRef.current[mode];
    if (cached) {
      setDisplayRanked(cached.ranked);
      setDisplayTransitMap(cached.transitMap);
      setCalculating(false);
      return;
    }

    setCalculating(true);
    let cancelled = false;
    const candidates = mode === "hotspot" ? results : resultsNoPop;

    computeRanking(candidates, participants, mode === "hotspot").then((data) => {
      if (cancelled) return;
      cacheRef.current[mode] = data;
      setDisplayRanked(data.ranked);
      setDisplayTransitMap(data.transitMap);
      setCalculating(false);
    });

    return () => { cancelled = true; };
  }, [active, mode, results, resultsNoPop, participants]);

  function formatTransitTime(info: TransitInfo | undefined): React.ReactNode {
    if (!info || info.loading) {
      return <Loader2 className="w-3 h-3 animate-spin text-text-muted" />;
    }
    if (info.minTime === null) {
      return <span className="text-text-muted">시간 정보 없음</span>;
    }
    // 데이터 부족: 일부 참여자 시간 미확인
    if (info.validCount < info.totalCount) {
      return (
        <span>
          최단 {info.minTime}분 · 최장 {info.maxTime}분
          <span className="text-text-muted ml-1">({info.validCount}/{info.totalCount}명 확인)</span>
        </span>
      );
    }
    // 케이스 1: 모두 같은 소요시간
    if (info.minTime === info.maxTime) {
      return <span>모두에게 {info.minTime}분</span>;
    }
    // 케이스 2: 출발지 = 추천역인 참여자가 있음 → 평균 생략
    if (info.hasSameStation) {
      return <span>최단 {info.minTime}분 · 최장 {info.maxTime}분</span>;
    }
    // 일반: 평균 · 최단 · 최장
    return (
      <span>평균 {info.avgTime}분 · 최단 {info.minTime}분 · 최장 {info.maxTime}분</span>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">추천 결과를 찾을 수 없습니다</p>
        <button onClick={onBack} className="mt-4 text-primary text-sm font-medium">
          이전
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 세그먼트 토글 */}
      <div className="flex bg-surface border border-border rounded-xl p-1">
        {(["location", "hotspot"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              mode === m
                ? "bg-white shadow-sm text-foreground"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <p className="text-sm text-text-muted">{MODE_DESC[mode]}</p>

      {calculating ? (
        <div className="text-center py-16 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-text-muted">실제 이동 시간을 계산하는 중이에요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayRanked.map((station, i) => (
            <button
              key={station.name}
              onClick={() => onSelect(station)}
              className={`w-full text-left p-4 rounded-2xl border transition-all hover:shadow-md
                ${i === 0
                  ? "border-primary bg-primary/5 shadow-[0_2px_12px_rgba(108,99,255,0.15)]"
                  : "border-border bg-surface hover:bg-surface-hover"
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${i === 0 ? "bg-primary text-white" : "bg-surface border border-border text-text-muted"}`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">{station.name}</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {station.line.map((l) => (
                        <span key={l} className={`${getLineColor(l)} text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium`}>
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center mt-2 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTransitTime(displayTransitMap[station.name])}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-text-muted mt-2" />
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full py-3.5 rounded-2xl text-sm font-semibold
                   bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
      >
        이전
      </button>
    </div>
  );
}
