"use client";

import type { MeetingInfo, MeetingType, VenueType } from "@/lib/types";
import { Users, Heart, Briefcase, Trophy, Building2, Home, UtensilsCrossed, Wine, Coffee } from "lucide-react";

interface Props {
  data: MeetingInfo;
  onChange: (data: MeetingInfo) => void;
  onNext: () => void;
}

const meetingTypes: { value: MeetingType; label: string; icon: React.ReactNode }[] = [
  { value: "date",     label: "데이트",   icon: <Heart      className="w-5 h-5" /> },
  { value: "friends",  label: "친구",     icon: <Users      className="w-5 h-5" /> },
  { value: "work",     label: "회식",     icon: <UtensilsCrossed className="w-5 h-5" /> },
  { value: "club",     label: "동호회",   icon: <Trophy     className="w-5 h-5" /> },
  { value: "business", label: "비즈니스", icon: <Building2  className="w-5 h-5" /> },
  { value: "family",   label: "가족",     icon: <Home       className="w-5 h-5" /> },
];

const venueTypes: { value: VenueType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "restaurant", label: "식당", icon: <UtensilsCrossed className="w-5 h-5" />, desc: "맛집·음식점" },
  { value: "bar",        label: "술집", icon: <Wine           className="w-5 h-5" />, desc: "바·이자카야" },
  { value: "cafe",       label: "카페", icon: <Coffee         className="w-5 h-5" />, desc: "카페·디저트" },
];

export default function Step1MeetingType({ data, onChange, onNext }: Props) {
  const canProceed = data.peopleCount >= 2 && data.meetingType && data.venueType;

  return (
    <div className="space-y-7">
      {/* 인원수 */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">
          몇 명이서 만나나요?
        </label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => onChange({ ...data, peopleCount: Math.max(2, data.peopleCount - 1) })}
            className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center
                       text-xl font-bold hover:bg-surface-hover transition-colors select-none"
          >
            −
          </button>
          <span className="text-3xl font-bold text-primary w-12 text-center tabular-nums">
            {data.peopleCount}
          </span>
          <button
            onClick={() => onChange({ ...data, peopleCount: Math.min(10, data.peopleCount + 1) })}
            className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center
                       text-xl font-bold hover:bg-surface-hover transition-colors select-none"
          >
            +
          </button>
          <span className="text-sm text-text-muted">명</span>
        </div>
      </div>

      {/* 약속 유형 — 3×2 그리드 */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">
          어떤 약속인가요?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {meetingTypes.map((t) => {
            const selected = data.meetingType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onChange({ ...data, meetingType: t.value })}
                className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl border transition-all
                  ${selected
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-surface text-text-muted hover:bg-surface-hover"
                  }`}
              >
                <span className={selected ? "text-primary" : "text-text-muted"}>
                  {t.icon}
                </span>
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 장소 유형 — 3열 가로 카드 */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">
          만나서 어딜 가나요?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {venueTypes.map((t) => {
            const selected = data.venueType === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onChange({ ...data, venueType: t.value })}
                className={`flex flex-col items-center gap-2 py-3.5 rounded-2xl border transition-all
                  ${selected
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-surface text-text-muted hover:bg-surface-hover"
                  }`}
              >
                <span className={selected ? "text-primary" : "text-text-muted"}>
                  {t.icon}
                </span>
                <div className="text-center">
                  <p className="text-xs font-semibold">{t.label}</p>
                  <p className={`text-[10px] mt-0.5 ${selected ? "text-primary/70" : "text-text-muted"}`}>
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 다음 버튼 */}
      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all
                   bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed
                   shadow-[0_4px_16px_rgba(108,99,255,0.3)]"
      >
        다음으로
      </button>
    </div>
  );
}
