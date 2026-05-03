import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { findStation } from "@/data/stations";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY!;
const TMAP_APP_KEY = process.env.TMAP_APP_KEY!;
const redis = Redis.fromEnv();

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Period {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

export interface NearestExit {
  /** 카카오 place_name 그대로: "이촌역 4번 출구" */
  name: string;
  /** 장소로부터의 직선거리(m) */
  distanceM: number;
  /** 도보 분 (haversine × 보정) */
  walkMins: number;
}

export interface PlaceHoursResult {
  openNow: boolean | null;
  todayHours: string | null;      // "11:00 ~ 22:00"
  weeklyHours: string[] | null;   // ["일  11:00 ~ 22:00", "월  휴무", ...]
  location: { lat: number; lng: number } | null;
  nearestExit: NearestExit | null;
}

// 도보 분 (4 km/h + 1.3× 경로 보정)
function calcWalkMins(meters: number) {
  return Math.ceil((meters / 66.7) * 1.3);
}

/** Haversine 직선 거리 (미터) */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** T map 보행자 경로 API로 출구→장소 실제 도보 시간(초) 조회 */
async function tmapWalkSeconds(
  startLng: number, startLat: number,
  endLng: number,   endLat: number,
): Promise<number | null> {
  if (!TMAP_APP_KEY) return null;
  try {
    const res = await fetch(
      "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "appKey": TMAP_APP_KEY,
        },
        body: JSON.stringify({
          startX: String(startLng),
          startY: String(startLat),
          endX:   String(endLng),
          endY:   String(endLat),
          startName: "출구",
          endName:   "목적지",
          reqCoordType: "WGS84GEO",
          resCoordType: "WGS84GEO",
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    // GeoJSON FeatureCollection — 첫 번째 Feature의 totalTime(초)
    const totalTime = data?.features?.[0]?.properties?.totalTime;
    return typeof totalTime === "number" ? totalTime : null;
  } catch {
    return null;
  }
}

/**
 * ① 카카오: 역 중심 좌표 기준으로 모든 번호 출구 POI 수집
 * ② T map: 각 출구 → 장소 실제 도보 시간 병렬 조회
 * ③ 도보 시간이 가장 짧은 출구 반환
 */
async function findNearestExit(
  placeLat: number,
  placeLng: number,
  stationName: string
): Promise<NearestExit | null> {
  if (!KAKAO_REST_API_KEY) return null;
  try {
    // 1단계: stations.ts에서 역 중심 좌표 조회
    const stData = findStation(stationName);
    const searchLat = stData?.lat ?? placeLat;
    const searchLng = stData?.lng ?? placeLng;

    // 2단계: 카카오 키워드 검색으로 출구 POI 조회 (두 번 시도)
    async function fetchExits(useCategory: boolean) {
      const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      url.searchParams.set("query", `${stationName}역 출구`);
      if (useCategory) url.searchParams.set("category_group_code", "SW8");
      url.searchParams.set("x", String(searchLng));
      url.searchParams.set("y", String(searchLat));
      url.searchParams.set("radius", "1000");
      url.searchParams.set("sort", "distance");
      url.searchParams.set("size", "15");
      const r = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.documents ?? []) as { place_name: string; x: string; y: string }[];
    }

    // SW8 카테고리로 먼저 시도 → 출구 없으면 카테고리 없이 재시도
    let docs = await fetchExits(true);
    let exits = docs.filter((d) => /\d+번\s*출구/.test(d.place_name));
    if (exits.length === 0) {
      docs = await fetchExits(false);
      exits = docs.filter((d) => /\d+번\s*출구/.test(d.place_name));
    }
    if (exits.length === 0) return null;

    // 4단계: 모든 출구에 대해 T map 도보 시간 병렬 조회
    const times = await Promise.all(
      exits.map((exit) =>
        tmapWalkSeconds(
          parseFloat(exit.x), parseFloat(exit.y),
          placeLng, placeLat,
        )
      )
    );

    // 5단계: 도보 시간 기준으로 최솟값 출구 선택
    //  T map 실패 시 haversine fallback
    let bestIdx = 0;
    let bestSecs = times[0] ?? Infinity;
    for (let i = 1; i < exits.length; i++) {
      const secs = times[i] ?? Infinity;
      if (secs < bestSecs) { bestIdx = i; bestSecs = secs; }
    }

    const best = exits[bestIdx];
    const distM = Math.round(
      haversine(placeLat, placeLng, parseFloat(best.y), parseFloat(best.x))
    );

    // T map 시간이 있으면 사용, 없으면 haversine 추정
    const walkMinsVal = bestSecs < Infinity
      ? Math.ceil(bestSecs / 60)
      : calcWalkMins(distM);

    return {
      name: best.place_name,
      distanceM: distM,
      walkMins: walkMinsVal,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("name");
  const station = searchParams.get("station");

  if (!name || !station) {
    return NextResponse.json({ error: "name, station 파라미터 필요" }, { status: 400 });
  }

  // v6: 영업시간 표기법 개선 (todayHours 합산, weeklyHours 점심/저녁 라벨)
  const cacheKey = `hoursv6:${station}:${name}`;
  const cached = await redis.get<PlaceHoursResult>(cacheKey).catch(() => null);
  if (cached) return NextResponse.json(cached);

  const empty: PlaceHoursResult = {
    openNow: null, todayHours: null, weeklyHours: null,
    location: null, nearestExit: null,
  };

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.currentOpeningHours,places.regularOpeningHours,places.location",
      },
      body: JSON.stringify({
        textQuery: `${name} ${station}역`,
        languageCode: "ko",
        maxResultCount: 1,
      }),
    });

    if (!res.ok) {
      await redis.set(cacheKey, empty, { ex: 60 * 60 * 6 }).catch(() => null);
      return NextResponse.json(empty);
    }

    const data = await res.json();
    const place = data.places?.[0];

    if (!place) {
      await redis.set(cacheKey, empty, { ex: 60 * 60 * 6 }).catch(() => null);
      return NextResponse.json(empty);
    }

    const location = place.location
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null;

    // 좌표 있으면 카카오로 가장 가까운 출구 조회 (병렬)
    const [hours, nearestExit] = await Promise.all([
      Promise.resolve(place.currentOpeningHours ?? place.regularOpeningHours ?? null),
      location ? findNearestExit(location.lat, location.lng, station) : Promise.resolve(null),
    ]);

    if (!hours) {
      const result: PlaceHoursResult = { ...empty, location, nearestExit };
      await redis.set(cacheKey, result, { ex: 60 * 60 * 24 }).catch(() => null);
      return NextResponse.json(result);
    }

    const openNow: boolean | null = hours.openNow ?? null;
    const periods: Period[] = hours.periods ?? [];

    const todayDay = new Date().getDay();
    const fmtPeriod = (p: Period) =>
      `${fmt(p.open.hour, p.open.minute)} ~ ${p.close ? fmt(p.close.hour, p.close.minute) : "24:00"}`;

    // 타임대 라벨 (시작 시간 기준: ~15시 이전 = 점심, 이후 = 저녁)
    function periodLabel(p: Period, idx: number, total: number): string {
      if (total === 1) return "";
      if (p.open.hour < 15) return "점심 ";
      return "저녁 ";
    }

    // 요일별 periods 수집
    const weekMap: Record<number, Period[]> = {};
    for (const p of periods) {
      const d = p.open?.day;
      if (d === undefined) continue;
      if (!weekMap[d]) weekMap[d] = [];
      weekMap[d].push(p);
    }

    // todayHours: 복수 타임이면 첫 open ~ 마지막 close 로 합쳐서 표시
    const todayPeriods = weekMap[todayDay] ?? [];
    const todayHours = (() => {
      if (todayPeriods.length === 0) return null;
      if (todayPeriods.length === 1) return fmtPeriod(todayPeriods[0]);
      const firstOpen = fmt(todayPeriods[0].open.hour, todayPeriods[0].open.minute);
      const last = todayPeriods[todayPeriods.length - 1];
      const lastClose = last.close ? fmt(last.close.hour, last.close.minute) : "24:00";
      return `${firstOpen} ~ ${lastClose}`;
    })();

    // weeklyHours: 복수 타임이면 "점심 11:00~14:30, 저녁 17:00~22:00" 형태
    const weeklyHours = [0, 1, 2, 3, 4, 5, 6].map((d) => {
      const ps = weekMap[d];
      if (!ps || ps.length === 0) return `${DAY_LABELS[d]}  휴무`;
      const times = ps.map((p, i) => `${periodLabel(p, i, ps.length)}${fmtPeriod(p)}`).join(", ");
      return `${DAY_LABELS[d]}  ${times}`;
    });

    const result: PlaceHoursResult = { openNow, todayHours, weeklyHours, location, nearestExit };
    await redis.set(cacheKey, result, { ex: 60 * 60 * 24 }).catch(() => null);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(empty);
  }
}
