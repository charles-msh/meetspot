"use client";

import type { Participant } from "@/lib/types";
import StationSearch from "@/components/StationSearch";
import { User } from "lucide-react";

interface Props {
  peopleCount: number;
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const defaultNames = ["나", "친구1", "친구2", "친구3", "친구4", "친구5", "친구6", "친구7", "친구8", "친구9"];

export default function Step2Location({ peopleCount, participants, onChange, onNext, onBack }: Props) {
  // 인원수에 맞게 참여자 목록 동기화
  const current = Array.from({ length: peopleCount }, (_, i) => {
    return participants[i] || { id: i, name: defaultNames[i] || `참여자${i + 1}`, station: "" };
  });

  function updateParticipant(index: number, field: "name" | "station", value: string) {
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  const allFilled = current.every((p) => p.station.trim() !== "");

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        각자의 출발 지하철역을 입력해주세요
      </p>

      <div className="space-y-3">
        {current.map((p, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <input
                type="text"
                value={p.name}
                onChange={(e) => updateParticipant(i, "name", e.target.value)}
                className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
                placeholder="이름"
              />
            </div>
            <StationSearch
              value={p.station}
              onChange={(val) => updateParticipant(i, "station", val)}
              placeholder="출발 지하철역 검색"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 py-3.5 rounded-2xl text-sm font-semibold
                     bg-surface border border-border text-foreground hover:bg-surface-hover transition-colors"
        >
          이전
        </button>
        <button
          onClick={onNext}
          disabled={!allFilled}
          className="flex-[2] py-3.5 rounded-2xl text-white font-semibold text-sm transition-all
                     bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-[0_4px_16px_rgba(108,99,255,0.3)]"
        >
          중간 지점 찾기
        </button>
      </div>
    </div>
  );
}
