"use client";

import { useState, useRef, useEffect } from "react";
import { searchStations, displayName, type Station } from "@/data/stations";
import { LineBadge } from "@/lib/lineColors";
import { MapPin, CheckCircle2, Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (stationName: string) => void;
  placeholder?: string;
}

export default function StationSearch({ value, onChange, placeholder = "지하철역 검색..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Station[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const isSelected = value !== "" && query === displayName(value);

  useEffect(() => {
    setQuery(value ? displayName(value) : "");
    if (!value) setHasSearched(false);
  }, [value]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleInput(val: string) {
    setQuery(val);
    setHasSearched(val.trim().length > 0);
    const found = searchStations(val);
    setResults(found);
    setIsOpen(val.trim().length > 0);
    if (!val) onChange("");
  }

  function handleSelect(station: Station) {
    setQuery(displayName(station.name));
    onChange(station.name);
    setIsOpen(false);
    setHasSearched(false);
  }

  return (
    // overflow:visible 이어야 absolute 드롭다운이 카드 밖으로 나올 수 있음
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        {isSelected ? (
          <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]" />
        ) : (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2.5 bg-surface border rounded-xl text-base
                     focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10 focus:border-[#1A1A1A]
                     transition-all placeholder:text-text-muted
                     ${isSelected ? "border-[#1A1A1A] bg-[#F5F5F5]" : "border-border"}`}
        />
      </div>

      {/*
        absolute + top-full: 항상 입력창 바로 아래 위치 → 입력창을 절대 덮지 않음
        fixed 는 iOS Safari에서 키보드 팝업 시 레이아웃 뷰포트 기준으로 어긋나는 버그 있음
        z-[200]: 다른 참여자 카드 위에 표시
      */}
      {isOpen && (
        <ul className="absolute top-full left-0 right-0 z-[200] mt-1
                       bg-white border border-border rounded-xl shadow-lg
                       max-h-[200px] overflow-y-auto">
          {results.length > 0 ? (
            results.map((station) => (
              <li key={station.name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(station)}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-surface-hover
                             flex items-center gap-2 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-medium">{displayName(station.name)}</span>
                  <div className="flex gap-0.5 ml-auto">
                    {station.line.map((l) => (
                      <LineBadge key={l} line={l} />
                    ))}
                  </div>
                </button>
              </li>
            ))
          ) : (
            hasSearched && (
              <li className="px-3 py-4 text-center text-sm text-text-muted flex flex-col items-center gap-1.5">
                <Search className="w-4 h-4" />
                <span>검색 결과가 없습니다</span>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
