import { NextRequest, NextResponse } from "next/server";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID!;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET!;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ error: "query 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
    // 네이버 지역 검색 API (장소 정보 + 주소 + 카테고리)
    const localRes = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=10&sort=comment`,
      {
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        },
      }
    );

    if (!localRes.ok) {
      const err = await localRes.text();
      return NextResponse.json({ error: "네이버 API 호출 실패", detail: err }, { status: localRes.status });
    }

    const localData = await localRes.json();

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

    return NextResponse.json({ items: placesWithImages });
  } catch (error) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// HTML 태그 제거 유틸
function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}
