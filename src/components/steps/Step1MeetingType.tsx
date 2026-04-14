"use client";

import type { MeetingInfo, MeetingType, VenueType } from "@/lib/types";
import { Users, Heart, UserCheck, Home, Briefcase, MoreHorizontal, UtensilsCrossed, Wine, Coffee } from "lucide-react";

interface Props {
  data: MeetingInfo;
  onChange: (data: MeetingInfo) => void;
  onNext: () => void;
}

const meetingTypes: { value: MeetingType; label: string; icon: React.ReactNode }[] = [
  { value: "date", label: "데이트", icon: <Heart className="w-5 h-5" /> },
  { value: "friends", label: "친구", icon: <UserCheck className="w-5 h-5" /> },
  { value: "family", label: "가족", icon: <Home className="w-5 h-5" /> },
  { value: "work", label: "직장동료", icon: <Briefcase className="w-5 h-5" /> },
  { value: "other", label: "기타", icon: <MoreHorizontal className="w-5 h-5" /> },
];

const venueTypes: { value: VenueType; label: string; icon: React.ReactNode }[] = [
  { value: "restaurant", label: "식당", icon: <UtensilsCrossed className="w-5 h-5" /> },
  { value: "bar", label: "술집", icon: <Wine className="w-5 h-5" /> },
  { value: "cafe", label: "카페", icon: <Coffee className="w-5 h-5" /> },
];

export default function Step1MeetingType({ data, onChange, onNext }: Props) {
  const canProceed = data.peopleCount >= 2 && data.meetingType && data.venueType;

  return (
    <div className="space-y-6">
      {/* 인원수 */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">
          <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          몇 명이서 만나나요?
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onChange({ ...data, peopleCount: Math.max(2, data.peopleCount - 1) })}
            className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center
                       text-lg font-bold hover:bg-surface-hover transition-colors"
          >
            -
          </button>
          <span className="text-2xl font-bold text-primary w-10 text-center">{data.peopleCount}</span>
          <button
            onClick={() => onChange({ ...data, peopleCount: Math.min(10, data.peopleCount + 1) })}
            className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center
                       text-lg font-bold hover:bg-surface-hover transition-colors"
          >
            +
          </button>
          <span className="text-sm text-text-muted">명</span>
        </div>
      </div>

      {/* 약속 유형 */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">
          어떤 약속인가요?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {meetingTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => onChange({ ...data, meetingType: t.value })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
                ${data.meetingType === t.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-surface text-text-muted hover:bg-surface-hover"
                }`}
            >
              {t.icon}
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 장소 유형 */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">
          만나서 어딜 가나요?
        </label>
        <div className="grid grid-cols-3 gap-2">
          {venueTypes.map((t) => (
            <button
              key={t.value}
              onClick={() => onChange({ ...data, venueType: t.value })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
                ${data.venueType === t.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-surface text-text-muted hover:bg-surface-hover"
                }`}
            >
              {t.icon}
              <span className="text-xs font-medium">{t.label}</span>
            </button>
          ))}
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
