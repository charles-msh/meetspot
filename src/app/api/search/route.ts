import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID!;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET!;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const redis = Redis.fromEnv();

// ── Google API 월별 호출 제한 (무료 한도 95% 선에서 차단) ──
const LIMITS = {
  places: 950,  // Places API 무료 한도 1,000건
  vision: 950,  // Vision API 무료 한도 1,000건
};

function monthKey(api: "places" | "vision") {
  const now = new Date();
  return `quota:${api}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function checkAndIncrement(api: "places" | "vision"): Promise<boolean> {
  try {
    const key = monthKey(api);
    const count = await redis.incr(key);
    // 처음 생성 시 만료일 월말로 설정 (32일이면 다음 달 확실히 넘김)
    if (count === 1) await redis.expire(key, 60 * 60 * 24 * 32);
    return count <= LIMITS[api];
  } catch {
    return true; // Redis 오류 시 일단 허용
  }
}

// 음식 관련 Vision API 라벨 (메뉴판·빈 그릇 등 비음식 라벨 제외)
const FOOD_LABELS = new Set([
  "Food", "Dish", "Cuisine", "Recipe", "Ingredient", "Meal", "Cooking",
  "Fast food", "Junk food", "Street food", "Comfort food",
  "Korean food", "Japanese cuisine", "Chinese food", "Italian food",
  "Pizza", "Sushi", "Ramen", "Noodle", "Rice", "Soup", "Stew",
  "Meat", "Beef", "Pork", "Chicken", "Seafood", "Fish", "Shrimp",
  "Vegetable", "Salad", "Bread", "Cake", "Dessert", "Snack",
  "Drink", "Beverage", "Coffee", "Beer", "Wine",
]);

// Google Vision API로 이미지 중 음식 사진 필터링 → 상위 6장 반환
async function filterFoodImages(imageUrls: string[]): Promise<string[]> {
  if (imageUrls.length === 0) return [];

  // 월별 한도 초과 시 Vision API 스킵 → 원본 최대 6장 반환
  const allowed = await checkAndIncrement("vision");
  if (!allowed) {
    console.warn("[Vision API] 월 한도 초과 - fallback");
    return imageUrls.slice(0, 6);
  }

  try {
    const requests = imageUrls.map((url) => ({
      image: { source: { imageUri: url } },
      features: [{ type: "LABEL_DETECTION", maxResults: 10 }],
    }));

    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_PLACES_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );
    if (!res.ok) return imageUrls.slice(0, 6);

    const data = await res.json();
    const scored: { url: string; score: number }[] = [];

    (data.responses || []).forEach((resp: Record<string, unknown>, i: number) => {
      const labels = (resp.labelAnnotations as { description: string; score: number }[]) || [];
      // 음식 라벨 점수 합산
      const foodScore = labels
        .filter((l) => FOOD_LABELS.has(l.description))
        .reduce((sum, l) => sum + l.score, 0);
      if (foodScore > 0) {
        scored.push({ url: imageUrls[i], score: foodScore });
      }
    });

    // 음식 점수 높은 순 정렬 → 상위 6장
    scored.sort((a, b) => b.score - a.score);
    const filtered = scored.map((s) => s.url).slice(0, 6);

    // 음식 사진이 하나도 없으면 원본 그대로 최대 6장
    return filtered.length > 0 ? filtered : imageUrls.slice(0, 6);
  } catch {
    return imageUrls.slice(0, 6);
  }
}

// Google Places API (New) - 업체명+역이름으로 검색 → 사진 1장 URL 반환
async function getGooglePhotoUrl(placeName: string, stationName: string): Promise<string> {
  // 월별 한도 초과 시 Places API 스킵
  const allowed = await checkAndIncrement("places");
  if (!allowed) {
    console.warn("[Places API] 월 한도 초과 - fallback");
    return "";
  }

  try {
    const query = `${placeName} ${stationName}역`;
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.photos",
      },
      body: JSON.stringify({ textQuery: query, languageCode: "ko", maxResultCount: 1 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const photoName = data.places?.[0]?.photos?.[0]?.name;
    if (!photoName) return "";

    const photoRes = await fetch(
      `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=600&key=${GOOGLE_PLACES_API_KEY}`
    );
    if (!photoRes.ok) return "";
    return photoRes.url;
  } catch {
    return "";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query");
  const start = parseInt(searchParams.get("start") || "1", 10);

  if (!query) {
    return NextResponse.json({ error: "query 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
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
    const seen = new Set<string>();
    const combined = raw.filter((item: Record<string, string>) => {
      const name = stripHtml(item.title).replace(/\s/g, "").toLowerCase();
      const addr = (item.roadAddress || item.address || "").replace(/\s/g, "");
      // 이름만으로도 중복 체크 (주소 없는 경우 대비), 이름+주소로도 체크
      const keyByName = name;
      const keyByAddr = addr ? `${name}__${addr}` : "";
      if (seen.has(keyByName)) return false;
      seen.add(keyByName);
      if (keyByAddr) seen.add(keyByAddr);
      return true;
    });

    const total: number = data1.total ?? 0;
    const nextStart = start + 10; // 중복 제거 후 길이 기준이 아닌 Naver에서 소비한 위치 기준
    const hasMore = nextStart <= total;

    const naverHeaders = {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    };

    const stationName = query.split("역 ")[0] || query;

    const placesWithImages = await Promise.all(
      combined.map(async (item: Record<string, string>) => {
        const name = stripHtml(item.title);

        // Redis 캐시 확인 (TTL 30일)
        const cacheKey = `img:${stationName}:${name}`;
        const cached = await redis.get<string[]>(cacheKey).catch(() => null);
        if (cached) {
          return {
            title: name,
            category: item.category || "",
            address: item.address || "",
            roadAddress: item.roadAddress || "",
            link: item.link || "",
            telephone: item.telephone || "",
            imageUrls: cached,
          };
        }

        // 1) Google Places 사진 시도
        const googlePhotoUrl = await getGooglePhotoUrl(name, stationName);

        let imageUrls: string[] = [];

        if (googlePhotoUrl) {
          // Google 사진 있으면 1장
          imageUrls = [googlePhotoUrl];
        } else {
          // Naver 이미지 10장 수집 → Vision API로 음식 사진 필터링
          const imgRes = await fetch(
            `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(name)}&display=10&sort=sim`,
            { headers: naverHeaders }
          ).catch(() => null);

          if (imgRes?.ok) {
            const d = await imgRes.json();
            const naverUrls: string[] = (d.items || [])
              .map((img: Record<string, string>) => img.thumbnail || img.link || "")
              .filter(Boolean);

            // Vision API로 음식 사진 필터링
            imageUrls = await filterFoodImages(naverUrls);
          }
        }

        // Redis에 30일 캐시 저장
        if (imageUrls.length > 0) {
          await redis.set(cacheKey, imageUrls, { ex: 60 * 60 * 24 * 30 }).catch(() => null);
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

    // 현재 API 사용량 조회 (모니터링용)
    const [placesCount, visionCount] = await Promise.all([
      redis.get<number>(monthKey("places")).catch(() => 0),
      redis.get<number>(monthKey("vision")).catch(() => 0),
    ]);

    return NextResponse.json({
      items: placesWithImages, nextStart, hasMore, total,
      _quota: { places: placesCount ?? 0, vision: visionCount ?? 0, limits: LIMITS },
    });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "");
}
