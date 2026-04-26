"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSelected = value !== "" && query === displayName(value);

  // 드롭다운 위치를 input 기준으로 계산 (fixed 포지셔닝용)
  const updateDropdownPos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    setQuery(value ? displayName(value) : "");
    if (!value) setHasSearched(false);
  }, [value]);

  // 드롭다운 열릴 때 위치 계산 + 스크롤/리사이즈 시 재계산
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPos();
    window.addEventListener("scroll", updateDropdownPos, true);
    window.addEventListener("resize", updateDropdownPos);
    return () => {
      window.removeEventListener("scroll", updateDropdownPos, true);
      window.removeEventListener("resize", updateDropdownPos);
    };
  }, [isOpen, updateDropdownPos]);

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
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        {isSelected ? (
          <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]" />
        ) : (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => {
            if (results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2.5 bg-surface border rounded-xl text-base
                     focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]/10 focus:border-[#1A1A1A]
                     transition-all placeholder:text-text-muted
                     ${isSelected ? "border-[#1A1A1A] bg-[#F5F5F5]" : "border-border"}`}
        />
      </div>

      {/* 드롭다운: fixed 포지셔닝으로 부모 overflow에 잘리지 않음 */}
      {isOpen && (
        <ul
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          className="fixed z-[200] bg-white border border-border rounded-xl shadow-lg
                     max-h-48 overflow-y-auto"
        >
          {results.length > 0 ? (
            results.map((station) => (
              <li key={station.name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()} // blur 방지
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
