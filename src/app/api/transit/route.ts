import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const ODSAY_API_KEY = process.env.ODSAY_API_KEY!;
const redis = Redis.fromEnv();

// ODsay 429(동시 요청 초과) 시 exponential backoff 재시도
// 시도 간격: 600ms → 1200ms → 2400ms → 4800ms (최대 4회 재시도)
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 600;

async function callODsayWithRetry(urlStr: string, referer: string, route: string): Promise<{ data: unknown; attempts: number }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[ODsay 429] 재시도 ${attempt}/${MAX_RETRIES}, ${delay}ms 대기 route=${route}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const res = await fetch(urlStr, { headers: { Referer: referer } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json() as { error?: { code: number; msg?: string }; result?: { path?: unknown[] } };

    // 429: rate limit → 재시도
    if ((data as { error?: { code: number } }).error?.code === 429) {
      if (attempt < MAX_RETRIES) continue;
      // 모든 재시도 소진
      console.error(`[ODsay 429] 재시도 모두 실패 route=${route}`);
      return { data, attempts: attempt + 1 };
    }

    // 429 외 에러 또는 성공 → 즉시 반환
    return { data, attempts: attempt + 1 };
  }

  // 타입 가드용 (도달 불가)
  throw new Error("unreachable");
}

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

    // 캐시 미스 → ODsay API 호출 (429 시 자동 재시도)
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

    const route = `${sx},${sy}→${ex},${ey}`;
    const { data } = await callODsayWithRetry(url.toString(), referer, route);
    const d = data as { error?: { code: number; msg?: string }; result?: { path?: { info: { totalTime: number } }[] } };

    if (d.error) {
      // ODsay 에러 코드: -100=쿼터초과, -99=키오류, 10=경로없음, 11=거리너무가까움, 429=동시요청초과
      console.error(`[ODsay Error] code=${d.error.code} msg=${d.error.msg} route=${route}`);
      return NextResponse.json({ error: d.error.msg || "경로를 찾을 수 없습니다", code: d.error.code }, { status: 400 });
    }

    // 여러 경로 중 최단 시간 추출
    const paths = d.result?.path || [];
    if (paths.length === 0) {
      return NextResponse.json({ totalTime: null, error: "경로 없음" });
    }

    // 최단 소요시간 경로
    const bestPath = paths.reduce((best, p) =>
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
