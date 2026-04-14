"use client";

import { useState, useEffect } from "react";
import type { RecommendedStation, Participant } from "@/lib/types";
import { findStation } from "@/data/stations";
import { Star, ChevronRight, Clock, Loader2 } from "lucide-react";

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

function getLineColor(line: string): string {
  const colors: Record<string, string> = {
    "1": "bg-blue-600", "2": "bg-green-500", "3": "bg-orange-500",
    "4": "bg-sky-400", "5": "bg-purple-500", "6": "bg-amber-700",
    "7": "bg-olive-600", "8": "bg-pink-500", "9": "bg-amber-400",
    "신분당": "bg-red-500", "분당": "bg-yellow-500", "경의중앙": "bg-teal-500",
    "공항": "bg-blue-400",
  };
  return colors[line] || "bg-gray-400";
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
  const [transitMap, setTransitMap] = useState<Record<string, TransitInfo>>({});

  useEffect(() => {
    // 각 추천역에 대해 모든 참여자의 소요시간 조회
    async function loadTransitTimes() {
      const newMap: Record<string, TransitInfo> = {};

      // 먼저 모든 역을 loading 상태로 설정
      for (const station of results) {
        newMap[station.name] = { minTime: null, maxTime: null, loading: true };
      }
      setTransitMap({ ...newMap });

      // 각 추천역에 대해 순차적으로 조회 (API 호출량 관리)
      for (const station of results) {
        const destStation = findStation(station.name);
        if (!destStation) {
          newMap[station.name] = { minTime: null, maxTime: null, loading: false };
          setTransitMap({ ...newMap });
          continue;
        }

        const times: number[] = [];
        for (const p of participants) {
          const fromStation = findStation(p.station);
          if (!fromStation) continue;

          // 같은 역이면 0분
          if (fromStation.name === destStation.name) {
            times.push(0);
            continue;
          }

          const time = await fetchTransitTime(
            fromStation.lat, fromStation.lng,
            destStation.lat, destStation.lng
          );
          if (time !== null) times.push(time);
        }

        if (times.length > 0) {
          newMap[station.name] = {
            minTime: Math.min(...times),
            maxTime: Math.max(...times),
            loading: false,
          };
        } else {
          newMap[station.name] = { minTime: null, maxTime: null, loading: false };
        }
        setTransitMap({ ...newMap });
      }
    }

    if (results.length > 0 && participants.length > 0) {
      loadTransitTimes();
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
    return <span>{info.minTime}분~{info.maxTime}분</span>;
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">추천 결과를 찾을 수 없습니다</p>
        <button onClick={onBack} className="mt-4 text-primary text-sm font-medium">
          다시 입력하기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        모두에게 가깝고 놀기 좋은 역을 추천해드려요
      </p>

      <div className="space-y-3">
        {results.map((station, i) => (
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
        다시 입력하기
      </button>
    </div>
  );
}
