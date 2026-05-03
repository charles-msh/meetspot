import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;
const redis = Redis.fromEnv();

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Period {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

export interface PlaceHoursResult {
  openNow: boolean | null;
  todayHours: string | null;      // "11:00 ~ 22:00"
  weeklyHours: string[] | null;   // ["일  11:00 ~ 22:00", "월  휴무", ...]
  location: { lat: number; lng: number } | null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("name");
  const station = searchParams.get("station");

  if (!name || !station) {
    return NextResponse.json({ error: "name, station 파라미터 필요" }, { status: 400 });
  }

  // Redis 캐시 (24시간)
  const cacheKey = `hours:${station}:${name}`;
  const cached = await redis.get<PlaceHoursResult>(cacheKey).catch(() => null);
  if (cached) return NextResponse.json(cached);

  const empty: PlaceHoursResult = { openNow: null, todayHours: null, weeklyHours: null, location: null };

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
      await redis.set(cacheKey, empty, { ex: 60 * 60 * 6 }).catch(() => null); // 오류 시 6시간 캐시
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

    const hours = place.currentOpeningHours ?? place.regularOpeningHours ?? null;

    if (!hours) {
      const result: PlaceHoursResult = { ...empty, location };
      await redis.set(cacheKey, result, { ex: 60 * 60 * 24 }).catch(() => null);
      return NextResponse.json(result);
    }

    const openNow: boolean | null = hours.openNow ?? null;
    const periods: Period[] = hours.periods ?? [];

    // 오늘 영업시간
    const todayDay = new Date().getDay(); // 0=일
    const todayPeriod = periods.find((p) => p.open?.day === todayDay);
    const todayHours = todayPeriod
      ? `${fmt(todayPeriod.open.hour, todayPeriod.open.minute)} ~ ${
          todayPeriod.close
            ? fmt(todayPeriod.close.hour, todayPeriod.close.minute)
            : "24:00"
        }`
      : null;

    // 요일별 영업시간 맵 (day 0=일 ~ 6=토)
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

    const result: PlaceHoursResult = { openNow, todayHours, weeklyHours, location };
    await redis.set(cacheKey, result, { ex: 60 * 60 * 24 }).catch(() => null);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(empty);
  }
}
