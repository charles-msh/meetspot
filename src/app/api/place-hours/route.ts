import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { findStation } from "@/data/stations";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY!;
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

/**
 * 카카오 Local Search로 역 출구 조회 후 장소에서 가장 가까운 출구 반환
 *
 * 핵심 원리:
 * - 역 중심 좌표(stations.ts) 근처에서 "${역명}역 출구" 검색 → 번호 출구 POI 수집
 * - 각 출구↔장소 거리(haversine)를 계산해 최솟값 출구 선택
 * - 이렇게 해야 "N번 출구" POI가 실제로 반환됨 (장소 좌표 기준 검색은 결과 없음)
 */
async function findNearestExit(
  placeLat: number,
  placeLng: number,
  stationName: string
): Promise<NearestExit | null> {
  if (!KAKAO_REST_API_KEY) return null;
  try {
    // 1단계: stations.ts 에서 역 중심 좌표 가져오기
    const stData = findStation(stationName);
    const searchLat = stData?.lat ?? placeLat;
    const searchLng = stData?.lng ?? placeLng;

    // 2단계: 역 중심 좌표 기준으로 출구 검색
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", `${stationName}역 출구`);
    url.searchParams.set("category_group_code", "SW8");
    url.searchParams.set("x", String(searchLng));
    url.searchParams.set("y", String(searchLat));
    url.searchParams.set("radius", "600");
    url.searchParams.set("sort", "distance");
    url.searchParams.set("size", "15");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const docs: { place_name: string; x: string; y: string }[] =
      data.documents ?? [];

    // 3단계: "N번 출구" 패턴 필터링
    const exits = docs.filter((d) => /\d+번\s*출구/.test(d.place_name));
    if (exits.length === 0) return null;

    // 4단계: 각 출구↔장소 haversine 거리로 가장 가까운 출구 선택
    let best = exits[0];
    let bestDist = haversine(
      placeLat, placeLng,
      parseFloat(exits[0].y), parseFloat(exits[0].x)
    );
    for (const exit of exits.slice(1)) {
      const d = haversine(placeLat, placeLng, parseFloat(exit.y), parseFloat(exit.x));
      if (d < bestDist) { best = exit; bestDist = d; }
    }

    return {
      name: best.place_name,
      distanceM: Math.round(bestDist),
      walkMins: calcWalkMins(bestDist),
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

  // v3: 캐시 키 버전 업 (nearestExit 검색 로직 개선으로 기존 캐시 무효화)
  const cacheKey = `hoursv3:${station}:${name}`;
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

    // 오늘 영업시간
    const todayDay = new Date().getDay();
    const todayPeriod = periods.find((p) => p.open?.day === todayDay);
    const todayHours = todayPeriod
      ? `${fmt(todayPeriod.open.hour, todayPeriod.open.minute)} ~ ${
          todayPeriod.close
            ? fmt(todayPeriod.close.hour, todayPeriod.close.minute)
            : "24:00"
        }`
      : null;

    // 요일별 영업시간
    const weekMap: Record<number, string> = {};
    for (const p of periods) {
      const d = p.open?.day;
      if (d === undefined) continue;
      const open = fmt(p.open.hour, p.open.minute);
      const close = p.close ? fmt(p.close.hour, p.close.minute) : "24:00";
      weekMap[d] = `${open} ~ ${close}`;
    }
    const weeklyHours = [0, 1, 2, 3, 4, 5, 6].map((d) =>
      weekMap[d] ? `${DAY_LABELS[d]}  ${weekMap[d]}` : `${DAY_LABELS[d]}  휴무`
    );

    const result: PlaceHoursResult = { openNow, todayHours, weeklyHours, location, nearestExit };
    await redis.set(cacheKey, result, { ex: 60 * 60 * 24 }).catch(() => null);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(empty);
  }
}
