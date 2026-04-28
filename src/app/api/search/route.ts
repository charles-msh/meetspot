import { NextRequest, NextResponse } from "next/server";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID!;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET!;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query");
  // start: 더 보기 시 이어받을 시작 인덱스 (기본 1)
  const start = parseInt(searchParams.get("start") || "1", 10);

  if (!query) {
    return NextResponse.json({ error: "query 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
    // 네이버 지역 검색 API - max display=5이므로 두 페이지 병렬 요청해서 10개 확보
    const fetchPage = (s: number) =>
      fetch(
        `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=${s}&sort=comment`,
        {
          headers: {
            "X-Naver-Client-Id": NAVER_CLIENT_ID,
            "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
          },
        }
      );

    const [res1, res2] = await Promise.all([fetchPage(start), fetchPage(start + 5)]);

    if (!res1.ok) {
      const err = await res1.text();
      return NextResponse.json({ error: "네이버 API 호출 실패", detail: err }, { status: res1.status });
    }

    const [data1, data2] = await Promise.all([
      res1.json(),
      res2.ok ? res2.json() : Promise.resolve({ items: [] }),
    ]);

    const raw = [...(data1.items || []), ...(data2.items || [])];
    // 동일 업체 중복 제거 (title + roadAddress 기준)
    const seen = new Set<string>();
    const combined = raw.filter((item: Record<string, string>) => {
      const key = `${stripHtml(item.title)}__${item.roadAddress || item.address}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // 네이버 API가 반환하는 total(전체 결과 수)로 hasMore 정확히 판단
    const total: number = data1.total ?? 0;
    const nextStart = start + combined.length;
    const hasMore = nextStart <= total;

    const localData = { items: combined, nextStart, hasMore, total };

    // 이미지 + 블로그 소개 멘트 병렬 수집
    const naverHeaders = {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    };

    const placesWithImages = await Promise.all(
      (localData.items || []).map(async (item: Record<string, string>) => {
        const name = stripHtml(item.title);

        const imgRes = await fetch(
          `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(name)}&display=5&sort=sim`,
          { headers: naverHeaders }
        ).catch(() => null);

        let imageUrls: string[] = [];
        if (imgRes?.ok) {
          const d = await imgRes.json();
          // thumbnail: Naver CDN URL (hotlink 차단 없음), link: 외부 직링크 (차단 많음)
          imageUrls = (d.items || [])
            .map((img: Record<string, string>) => img.thumbnail || img.link || "")
            .filter(Boolean);
        }

        return {
          title: name,
          category: item.category || "",
          address: item.address || "",
          roadAddress: item.roadAddress || "",
          link: item.link || "",
          telephone: item.telephone || "",
          imageUrls,
        };
      })
    );

    return NextResponse.json({ items: placesWithImages, nextStart: localData.nextStart, hasMore: localData.hasMore, total: localData.total });
  } catch (error) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// HTML 태그 제거 유틸
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}
