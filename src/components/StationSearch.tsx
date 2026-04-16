"use client";

import { useState, useRef, useEffect } from "react";
import { searchStations, type Station } from "@/data/stations";
import { LineBadge } from "@/lib/lineColors";
import { MapPin } from "lucide-react";

interface Props {
  value: string;
  onChange: (stationName: string) => void;
  placeholder?: string;
}

export default function StationSearch({ value, onChange, placeholder = "지하철역 검색..." }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Station[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
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
    const found = searchStations(val);
    setResults(found);
    setIsOpen(found.length > 0);
    if (!val) onChange("");
  }

  function handleSelect(station: Station) {
    setQuery(station.name);
    onChange(station.name);
    setIsOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2.5 bg-surface border border-border rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all placeholder:text-text-muted"
        />
      </div>

      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-border rounded-xl shadow-lg
                       max-h-48 overflow-y-auto">
          {results.map((station) => (
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
          ))}
        </ul>
      )}
    </div>
  );
}
