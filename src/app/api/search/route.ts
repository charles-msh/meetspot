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

// 음식 관련 Vision API 라벨
// 매장 외관·인테리어에도 붙는 "Fast food", "Restaurant", "Menu" 등은 제외
// 실제 음식·재료가 찍힌 사진만 선별
const FOOD_LABELS = new Set([
  "Food", "Dish", "Cuisine", "Recipe", "Ingredient", "Meal", "Cooking",
  "Pizza", "Sushi", "Ramen", "Noodle", "Rice", "Soup", "Stew", "Dumpling",
  "Meat", "Beef", "Pork", "Chicken", "Seafood", "Fish", "Shrimp", "Crab",
  "Vegetable", "Salad", "Bread", "Cake", "Dessert", "Snack", "Baking",
  "Drink", "Beverage", "Coffee", "Beer", "Wine", "Cocktail",
  "Hamburger", "Sandwich", "Taco", "Pasta", "Steak", "Barbecue",
]);

// foodScore 최소 임계값: 이 이상이어야 음식 사진으로 분류
const FOOD_SCORE_THRESHOLD = 0.5;

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
    // Naver CDN은 Google 서버의 직접 접근을 차단 → 우리 서버에서 먼저 fetch해서 base64로 변환
    const imageContents = await Promise.all(
      imageUrls.map(async (url, idx) => {
        try {
          const r = await fetch(url, {
            headers: {
              "Referer": "https://www.naver.com",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (!r.ok) {
            console.warn(`[Vision] img[${idx}] fetch 실패: ${r.status} ${url.slice(0, 80)}`);
            return null;
          }
          const buf = await r.arrayBuffer();
          // 5KB 미만 = 지나치게 작은 썸네일 → 화질 불량으로 제외
          if (buf.byteLength < 5000) {
            console.warn(`[Vision] img[${idx}] 파일 크기 미달: ${buf.byteLength}bytes`);
            return null;
          }
          console.log(`[Vision] img[${idx}] fetch 성공: ${buf.byteLength}bytes`);
          return Buffer.from(buf).toString("base64");
        } catch (e) {
          console.warn(`[Vision] img[${idx}] fetch 예외: ${e}`);
          return null;
        }
      })
    );
    const b64Count = imageContents.filter(Boolean).length;
    console.log(`[Vision] base64 변환 성공: ${b64Count}/${imageUrls.length}장`);

    const requests = imageUrls.map((url, i) => {
      const b64 = imageContents[i];
      return b64
        ? { image: { content: b64 }, features: [{ type: "LABEL_DETECTION", maxResults: 10 }] }
        : { image: { source: { imageUri: url } }, features: [{ type: "LABEL_DETECTION", maxResults: 10 }] };
    });

    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_PLACES_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      }
    );
    if (!res.ok) {
      console.warn(`[Vision] API 응답 오류: ${res.status}`);
      return imageUrls.slice(0, 6);
    }

    const data = await res.json();
    const scored: { url: string; score: number }[] = [];

    (data.responses || []).forEach((resp: Record<string, unknown>, i: number) => {
      const labels = (resp.labelAnnotations as { description: string; score: number }[]) || [];
      const topLabels = labels.slice(0, 5).map(l => `${l.description}(${l.score.toFixed(2)})`).join(",");
      // 음식 라벨 점수 합산
      const foodScore = labels
        .filter((l) => FOOD_LABELS.has(l.description))
        .reduce((sum, l) => sum + l.score, 0);
      console.log(`[Vision] img[${i}] foodScore=${foodScore.toFixed(2)} labels=${topLabels}`);
      if (foodScore >= FOOD_SCORE_THRESHOLD) {
        scored.push({ url: imageUrls[i], score: foodScore });
      }
    });

    // 음식 점수 높은 순 정렬 → 상위 6장
    scored.sort((a, b) => b.score - a.score);
    const filtered = scored.map((s) => s.url).slice(0, 6);

    // 음식 사진이 하나도 없으면 빈 배열 반환 (엉뚱한 이미지 노출 방지)
    return filtered;
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

    // 역명 자체가 도시명인 경우 '역' 유지 (서울역→서울 하면 도시 전체로 검색됨)
    const CITY_STATIONS = new Set([
      "서울", "부산", "인천", "대전", "대구", "광주", "울산",
      "수원", "전주", "청주", "춘천", "제주", "목포", "여수",
      "순천", "창원", "진주", "포항", "경주", "안동", "강릉",
      "원주", "천안", "평택",
    ]);
    const imageStationQuery = CITY_STATIONS.has(stationName)
      ? `${stationName}역`
      : stationName;

    const placesWithImages = await Promise.all(
      combined.map(async (item: Record<string, string>) => {
        const name = stripHtml(item.title);

        // Redis 캐시 확인 (TTL 7일 / v2: prefix로 이전 캐시 자동 무효화)
        const cacheKey = `v2:img:${stationName}:${name}`;
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

        // Naver 이미지 10장 수집 → Vision API로 음식 사진 필터링
        // (Google Places는 외관 사진 위주라 제외)
        let imageUrls: string[] = [];

        const imgRes = await fetch(
          `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(`${name} ${imageStationQuery} 맛집`)}&display=10&sort=sim`,
          { headers: naverHeaders }
        ).catch(() => null);

        if (imgRes?.ok) {
          const d = await imgRes.json();
          const naverUrls: string[] = (d.items || [])
            .map((img: Record<string, string>) => {
              const thumb = img.thumbnail || "";
              // b150(150x150 크롭) → w600(600px 원본 비율) 으로 업스케일
              return thumb.replace(/type=b\d+/g, "type=w600").replace(/type=a\d+/g, "type=w600");
            })
            .filter(Boolean);

          imageUrls = await filterFoodImages(naverUrls);
        }

        // Redis에 7일 캐시 저장 (30일은 오래된 잘못된 이미지가 계속 노출되는 문제 있었음)
        if (imageUrls.length > 0) {
          await redis.set(cacheKey, imageUrls, { ex: 60 * 60 * 24 * 7 }).catch(() => null);
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
