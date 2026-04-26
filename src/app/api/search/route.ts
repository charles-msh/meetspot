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

    const combined = [...(data1.items || []), ...(data2.items || [])];
    // 네이버 API가 반환하는 total(전체 결과 수)로 hasMore 정확히 판단
    const total: number = data1.total ?? 0;
    const nextStart = start + combined.length;
    const hasMore = nextStart <= total;

    const localData = { items: combined, nextStart, hasMore, total };

    // 네이버 이미지 검색 API (각 장소의 대표 이미지)
    const placesWithImages = await Promise.all(
      (localData.items || []).map(async (item: Record<string, string>) => {
        let imageUrl = "";
        try {
          const imgRes = await fetch(
            `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(
              stripHtml(item.title)
            )}&display=1&sort=sim`,
            {
              headers: {
                "X-Naver-Client-Id": NAVER_CLIENT_ID,
                "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
              },
            }
          );
          if (imgRes.ok) {
            const imgData = await imgRes.json();
            imageUrl = imgData.items?.[0]?.link || imgData.items?.[0]?.thumbnail || "";
          }
        } catch {
          // 이미지 못 가져오면 빈 문자열
        }

        return {
          title: stripHtml(item.title),
          category: item.category || "",
          address: item.address || "",
          roadAddress: item.roadAddress || "",
          link: item.link || "",
          description: item.description || "",
          telephone: item.telephone || "",
          imageUrl,
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
