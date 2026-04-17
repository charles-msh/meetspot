"use client";

import { useState, useRef, useEffect } from "react";
import { searchStations, type Station } from "@/data/stations";
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

  const isSelected = value !== "" && query === value;

  useEffect(() => {
    setQuery(value);
    if (!value) setHasSearched(false);
  }, [value]);

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
    setIsOpen(val.trim().length > 0); // 결과 없어도 열어서 "없음" 메시지 표시
    if (!val) onChange("");
  }

  function handleSelect(station: Station) {
    setQuery(station.name);
    onChange(station.name);
    setIsOpen(false);
    setHasSearched(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        {/* 왼쪽 아이콘: 선택됐으면 체크, 아니면 핀 */}
        {isSelected ? (
          <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
        ) : (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2.5 bg-surface border rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all placeholder:text-text-muted
                     ${isSelected ? "border-green-400 bg-green-50" : "border-border"}`}
        />
      </div>

      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg
                       max-h-48 overflow-y-auto">
          {results.length > 0 ? (
            results.map((station) => (
              <li key={station.name}>
                <button
                  type="button"
                  onClick={() => handleSelect(station)}
                  className="w-full px-3 py-2.5 text-left text-sm hover:bg-surface-hover
                             flex items-center gap-2 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-medium">{station.name}</span>
                  <div className="flex gap-0.5 ml-auto">
                    {station.line.map((l) => (
                      <LineBadge key={l} line={l} />
                    ))}
                  </div>
                </button>
              </li>
            ))
          ) : (
            /* 3번: 검색 결과 없음 안내 */
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
