import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const ODSAY_API_KEY = process.env.ODSAY_API_KEY!;
const redis = Redis.fromEnv();

// ODsay 대중교통 길찾기 API
// 출발 좌표 → 도착 좌표 간 대중교통 소요시간(분) 반환
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sx = searchParams.get("sx"); // 출발 경도
  const sy = searchParams.get("sy"); // 출발 위도
  const ex = searchParams.get("ex"); // 도착 경도
  const ey = searchParams.get("ey"); // 도착 위도

  if (!sx || !sy || !ex || !ey) {
    return NextResponse.json({ error: "sx, sy, ex, ey 파라미터가 필요합니다" }, { status: 400 });
  }

  // 캐시 키: 좌표 소수점 4자리로 고정 (같은 경로는 항상 같은 키)
  const cacheKey = `transit:${parseFloat(sx).toFixed(4)}:${parseFloat(sy).toFixed(4)}:${parseFloat(ex).toFixed(4)}:${parseFloat(ey).toFixed(4)}`;

  try {
    // 캐시에서 먼저 조회 (0분은 과거 버그로 잘못 저장된 값 → 무효 처리)
    const cached = await redis.get<number>(cacheKey);
    if (cached !== null && cached > 0) {
      return NextResponse.json({ totalTime: cached, cached: true });
    }

    // 캐시 미스 → ODsay API 호출
    const url = new URL("https://api.odsay.com/v1/api/searchPubTransPathT");
    url.searchParams.set("SX", sx);
    url.searchParams.set("SY", sy);
    url.searchParams.set("EX", ex);
    url.searchParams.set("EY", ey);
    url.searchParams.set("apiKey", ODSAY_API_KEY);

    // ODsay는 Referer 헤더로 도메인 인증을 함
    // 서버 사이드 호출 시 Referer가 없어서 인증 실패하므로 명시적으로 추가
    const referer = process.env.NODE_ENV === "production"
      ? "https://meetspot-chi.vercel.app"
      : "http://localhost:3000";

    const res = await fetch(url.toString(), {
      headers: { Referer: referer },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: "ODsay API 호출 실패", detail: err }, { status: res.status });
    }

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.msg || "경로를 찾을 수 없습니다", code: data.error.code, raw: JSON.stringify(data) }, { status: 400 });
    }

    // 여러 경로 중 최단 시간 추출
    const paths = data.result?.path || [];
    if (paths.length === 0) {
      return NextResponse.json({ totalTime: null, error: "경로 없음" });
    }

    // 최단 소요시간 경로
    const bestPath = paths.reduce((best: { info: { totalTime: number } }, p: { info: { totalTime: number } }) =>
      p.info.totalTime < best.info.totalTime ? p : best
    );

    const totalTime: number = bestPath.info.totalTime;

    // 유효한 값만 캐시에 저장 (0분은 저장하지 않음)
    if (totalTime > 0) {
      await redis.set(cacheKey, totalTime, { ex: 604800 });
    }

    return NextResponse.json({ totalTime });
  } catch (error) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
