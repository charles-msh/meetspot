"use client";

import { useState, useEffect } from "react";
import type { RecommendedStation, Participant } from "@/lib/types";
import { findStation } from "@/data/stations";
import { Star, ChevronRight, Clock, Loader2 } from "lucide-react";
import { getLineColor } from "@/lib/lineColors";

interface Props {
  results: RecommendedStation[];
  participants: Participant[];
  onSelect: (station: RecommendedStation) => void;
  onBack: () => void;
}

function PopularityStars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < count ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`}
        />
      ))}
    </div>
  );
}

// 추천역별 소요시간 데이터
interface TransitInfo {
  minTime: number | null;
  maxTime: number | null;
  loading: boolean;
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

export default function Step3Result({ results, participants, onSelect, onBack }: Props) {
  // ranked: 실제 소요시간 기준으로 재정렬된 최종 5개
  const [ranked, setRanked] = useState<RecommendedStation[]>([]);
  const [transitMap, setTransitMap] = useState<Record<string, TransitInfo>>({});
  const [calculating, setCalculating] = useState(true);

  useEffect(() => {
    async function rankByTransitTime() {
      setCalculating(true);
      setRanked([]);
      setTransitMap({});

      // 후보 20개 전부 병렬로 소요시간 조회
      const allResults = await Promise.all(
        results.map(async (station) => {
          const destStation = findStation(station.name);
          if (!destStation) return { station, times: [] };

          const timeResults = await Promise.all(
            participants.map(async (p) => {
              const fromStation = findStation(p.station);
              if (!fromStation) return null;
              if (fromStation.name === destStation.name) return 1;
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
          };
        })
      );

      // 실제 평균 소요시간 기준으로 정렬, 시간 정보 없는 역은 후순위
      const sorted = allResults
        .filter(({ times }) => times.length > 0)
        .sort((a, b) => {
          const avgA = a.times.reduce((s, t) => s + t, 0) / a.times.length;
          const avgB = b.times.reduce((s, t) => s + t, 0) / b.times.length;
          // 평균 70% + 최대 30% (공평함 반영)
          const scoreA = avgA * 0.7 + Math.max(...a.times) * 0.3;
          const scoreB = avgB * 0.7 + Math.max(...b.times) * 0.3;
          return scoreA - scoreB;
        });

      const top5 = sorted.slice(0, 5);

      const newTransitMap: Record<string, TransitInfo> = {};
      for (const { station, times } of top5) {
        newTransitMap[station.name] = {
          minTime: Math.min(...times),
          maxTime: Math.max(...times),
          loading: false,
        };
      }

      setRanked(top5.map(({ station }) => station));
      setTransitMap(newTransitMap);
      setCalculating(false);
    }

    if (results.length > 0 && participants.length > 0) {
      rankByTransitTime();
    }
  }, [results, participants]);

  function formatTransitTime(info: TransitInfo | undefined): React.ReactNode {
    if (!info || info.loading) {
      return <Loader2 className="w-3 h-3 animate-spin text-text-muted" />;
    }
    if (info.minTime === null) {
      return <span className="text-text-muted">시간 정보 없음</span>;
    }
    if (info.minTime === info.maxTime) {
      return <span>약 {info.minTime}분</span>;
    }
    // 2번: 최단/최장 맥락 표시
    return (
      <span>
        최단 {info.minTime}분 · 최장 {info.maxTime}분
      </span>
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

  if (calculating) {
    return (
      <div className="text-center py-16 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-text-muted">실제 이동 시간을 계산하는 중이에요</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        모두에게 가깝고 놀기 좋은 역을 추천해드려요
      </p>

      <div className="space-y-3">
        {ranked.map((station, i) => (
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
                    {i === 0 && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        BEST
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {station.line.map((l) => (
                      <span key={l} className={`${getLineColor(l)} text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium`}>
                        {l}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTransitTime(transitMap[station.name])}
                    </span>
                    <PopularityStars count={station.popularity} />
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-text-muted mt-2" />
            </div>
          </button>
        ))}
      </div>

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
