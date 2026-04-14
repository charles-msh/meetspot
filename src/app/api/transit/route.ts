import { NextRequest, NextResponse } from "next/server";

const ODSAY_API_KEY = process.env.ODSAY_API_KEY!;

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

  try {
    // ODsay API 키는 이미 URL-safe한 경우가 많지만, 혹시 모르니 두 방식 모두 시도
    const url = new URL("https://api.odsay.com/v1/api/searchPubTransPathT");
    url.searchParams.set("SX", sx);
    url.searchParams.set("SY", sy);
    url.searchParams.set("EX", ex);
    url.searchParams.set("EY", ey);
    url.searchParams.set("apiKey", ODSAY_API_KEY);

    const res = await fetch(url.toString());

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

    return NextResponse.json({
      totalTime: bestPath.info.totalTime, // 총 소요시간 (분)
    });
  } catch (error) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
