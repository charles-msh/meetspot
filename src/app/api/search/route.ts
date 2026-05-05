import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY!;
const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID!;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET!;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

interface KakaoDocument {
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  place_url: string;
  phone: string;
}

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

// ── 메뉴판·간판 이미지 즉시 탈락 라벨 ───────────────────────────
// 이 라벨 중 하나라도 score > DISQUALIFY_THRESHOLD 이면 음식 점수와 무관하게 제외
// 메뉴판: Text(0.98)/Font(0.95) / 간판: Signage(0.92)/Banner(0.88) 등
const DISQUALIFY_LABELS = new Set([
  "Text", "Font", "Document", "Signage", "Poster", "Banner",
  "Paper", "Brand", "Logo", "Label", "Handwriting", "Receipt",
]);
const DISQUALIFY_THRESHOLD = 0.75;

// ── 카테고리별 Vision 라벨 부스트 (1.8배 가중) ──────────────────
// 업체 카테고리에 맞는 라벨에 높은 점수를 줘서 카테고리와 맞지 않는
// 이미지를 자연스럽게 걸러냄
const CATEGORY_BOOST_LABELS: Array<{ keywords: string[]; labels: string[] }> = [
  {
    keywords: ["베이커리", "제과", "빵"],
    labels: ["Bread", "Baking", "Cake", "Pastry", "Dessert", "Snack"],
  },
  {
    keywords: ["카페", "커피", "티"],
    labels: ["Coffee", "Drink", "Beverage", "Tea", "Dessert", "Cake"],
  },
  {
    keywords: ["초밥", "스시", "횟집", "회"],
    labels: ["Sushi", "Seafood", "Fish"],
  },
  {
    keywords: ["라멘", "라면"],
    labels: ["Ramen", "Noodle", "Soup"],
  },
  {
    keywords: ["일식"],
    labels: ["Sushi", "Ramen", "Noodle", "Seafood"],
  },
  {
    keywords: ["고기", "삼겹", "갈비", "구이", "바베큐", "스테이크"],
    labels: ["Meat", "Beef", "Pork", "Barbecue", "Steak"],
  },
  {
    keywords: ["해물", "해산물"],
    labels: ["Seafood", "Shrimp", "Crab", "Fish"],
  },
  {
    keywords: ["치킨", "닭"],
    labels: ["Chicken", "Meat"],
  },
  {
    keywords: ["국밥", "해장", "탕", "찌개", "전골"],
    labels: ["Soup", "Stew", "Meal"],
  },
  {
    keywords: ["냉면", "국수", "우동", "파스타", "면"],
    labels: ["Noodle", "Pasta", "Soup"],
  },
  {
    keywords: ["피자"],
    labels: ["Pizza"],
  },
  {
    keywords: ["햄버거", "버거"],
    labels: ["Hamburger", "Meat"],
  },
  {
    keywords: ["분식", "떡볶이"],
    labels: ["Noodle", "Rice", "Snack"],
  },
  {
    keywords: ["아이스크림", "디저트"],
    labels: ["Dessert", "Snack", "Cake"],
  },
  {
    keywords: ["술집", "이자카야", "호프", "바"],
    labels: ["Beer", "Wine", "Cocktail", "Drink"],
  },
  {
    keywords: ["중식", "중국"],
    labels: ["Noodle", "Rice", "Dumpling"],
  },
  {
    keywords: ["양식"],
    labels: ["Pasta", "Pizza", "Steak", "Sandwich"],
  },
  {
    keywords: ["샐러드"],
    labels: ["Salad", "Vegetable"],
  },
  {
    keywords: ["샌드위치"],
    labels: ["Sandwich", "Bread"],
  },
];

/** 카테고리 문자열 → 부스트할 Vision 라벨 Set 반환 */
function getBoostLabels(category: string): Set<string> {
  const c = category.toLowerCase();
  const boosted = new Set<string>();
  for (const { keywords, labels } of CATEGORY_BOOST_LABELS) {
    if (keywords.some(kw => c.includes(kw))) {
      labels.forEach(l => boosted.add(l));
    }
  }
  return boosted;
}

/** 카테고리 → Naver 이미지 검색 키워드 (Layer 1) */
function getCategoryImageKeyword(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("베이커리") || c.includes("제과") || c.includes("빵")) return "빵 베이커리";
  if (c.includes("카페") || c.includes("커피")) return "카페 음료";
  if (c.includes("초밥") || c.includes("스시")) return "초밥 스시";
  if (c.includes("라멘") || c.includes("라면")) return "라멘 라면";
  if (c.includes("일식")) return "일식 음식";
  if (c.includes("고기") || c.includes("삼겹") || c.includes("갈비") || c.includes("구이")) return "고기 구이";
  if (c.includes("해물") || c.includes("해산물") || c.includes("횟집") || c.includes("회")) return "해물 해산물 회";
  if (c.includes("치킨") || c.includes("닭")) return "치킨 닭";
  if (c.includes("국밥") || c.includes("해장") || c.includes("찌개") || c.includes("탕")) return "국밥 찌개";
  if (c.includes("냉면")) return "냉면";
  if (c.includes("파스타")) return "파스타";
  if (c.includes("피자")) return "피자";
  if (c.includes("햄버거") || c.includes("버거")) return "햄버거 버거";
  if (c.includes("분식") || c.includes("떡볶이")) return "분식 떡볶이";
  if (c.includes("아이스크림") || c.includes("디저트")) return "디저트 아이스크림";
  if (c.includes("술집") || c.includes("이자카야") || c.includes("호프")) return "술 안주";
  if (c.includes("중식") || c.includes("중국")) return "중식 음식";
  if (c.includes("양식")) return "양식 음식";
  if (c.includes("한식")) return "한식 음식";
  if (c.includes("샐러드")) return "샐러드";
  return "음식"; // 기본값
}

// Google Vision API로 이미지 중 음식 사진 필터링 → 상위 6장 반환
// category: 카카오 카테고리 문자열 (e.g. "음식점 > 베이커리")
async function filterFoodImages(imageUrls: string[], category: string = ""): Promise<string[]> {
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
    const boostLabels = getBoostLabels(category);
    const BOOST = 1.8; // 카테고리 일치 라벨 가중치

    (data.responses || []).forEach((resp: Record<string, unknown>, i: number) => {
      const labels = (resp.labelAnnotations as { description: string; score: number }[]) || [];
      const topLabels = labels.slice(0, 5).map(l => `${l.description}(${l.score.toFixed(2)})`).join(",");

      // 메뉴판·간판 감지 시 즉시 탈락
      const disqualifier = labels.find(
        l => DISQUALIFY_LABELS.has(l.description) && l.score >= DISQUALIFY_THRESHOLD
      );
      if (disqualifier) {
        console.log(`[Vision] img[${i}] ❌ 탈락(${disqualifier.description} ${disqualifier.score.toFixed(2)}) labels=${topLabels}`);
        return;
      }

      // 음식 라벨 점수 합산 (카테고리 일치 라벨은 BOOST배 가중)
      const foodScore = labels
        .filter((l) => FOOD_LABELS.has(l.description))
        .reduce((sum, l) => {
          const multiplier = boostLabels.has(l.description) ? BOOST : 1.0;
          return sum + l.score * multiplier;
        }, 0);
      const boostedList = labels.filter(l => boostLabels.has(l.description)).map(l => l.description).join(",");
      console.log(`[Vision] img[${i}] foodScore=${foodScore.toFixed(2)} boosted=[${boostedList}] labels=${topLabels}`);
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
  const page = parseInt(searchParams.get("page") || "1", 10);

  if (!query) {
    return NextResponse.json({ error: "query 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
    // 카카오 로컬 검색: 페이지당 15건, pageable_count 기반 정확한 페이지네이션
    // 중복 없이 최대 45건 탐색 가능 (page 1~3, size=15)
    const kakaoRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&page=${page}&size=15`,
      { headers: { "Authorization": `KakaoAK ${KAKAO_REST_API_KEY}` } }
    );

    if (!kakaoRes.ok) {
      const err = await kakaoRes.text();
      return NextResponse.json({ error: "카카오 API 호출 실패", detail: err }, { status: kakaoRes.status });
    }

    const kakaoData = await kakaoRes.json();
    const documents: KakaoDocument[] = kakaoData.documents || [];
    const meta = kakaoData.meta || {};
    const pageableCount: number = meta.pageable_count ?? 0;
    const isEnd: boolean = meta.is_end ?? true;

    const combined = documents.map(doc => ({
      title: doc.place_name,
      category: doc.category_name,
      address: doc.address_name,
      roadAddress: doc.road_address_name,
      link: doc.place_url,
      telephone: doc.phone,
    }));

    // pageable_count가 실제 페이지 수 결정 (e.g. 45 → 3페이지)
    const total = pageableCount;
    const hasMore = !isEnd;

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
      combined.map(async (item) => {
        // 카카오는 plain text 반환 (Naver와 달리 HTML 태그 없음)
        const name = item.title;

        // Redis 캐시 확인 (TTL 7일 / v3: 원본 URL 저장으로 캐시 무효화)
        const cacheKey = `v3:img:${stationName}:${name}`;
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

        // Layer 1: 카테고리 기반 이미지 검색 쿼리
        // "업체명 + 카테고리 키워드"로 관련성 높은 이미지를 처음부터 가져옴
        const imgKeyword = getCategoryImageKeyword(item.category);
        console.log(`[Image] "${name}" category="${item.category}" → keyword="${imgKeyword}"`);

        const imgRes = await fetch(
          `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(`${name} ${imgKeyword}`)}&display=10&sort=sim`,
          { headers: naverHeaders }
        ).catch(() => null);

        if (imgRes?.ok) {
          const d = await imgRes.json();

          // Vision API용 w600 CDN URL (서버→서버 fetch가 안정적)
          const naverUrls: string[] = (d.items || [])
            .map((img: Record<string, string>) => {
              const thumb = img.thumbnail || "";
              return thumb.replace(/type=b\d+/g, "type=w600").replace(/type=a\d+/g, "type=w600");
            })
            .filter(Boolean);

          // Layer 2: 카테고리 부스트 가중치 Vision 필터링
          const filtered = await filterFoodImages(naverUrls, item.category);

          // 저장/표시용은 원본 URL 추출 (CDN URL의 src 파라미터)
          // 네이버 CDN: https://search.pstatic.net/common/?src=원본URL&type=w600
          imageUrls = filtered.map((cdnUrl) => {
            try {
              const u = new URL(cdnUrl);
              if (u.hostname === "search.pstatic.net") {
                const src = u.searchParams.get("src");
                if (src) return src; // 원본 URL 반환
              }
            } catch { /* URL 파싱 실패 시 CDN URL 그대로 사용 */ }
            return cdnUrl;
          });
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
      items: placesWithImages, hasMore, total,
      _quota: { places: placesCount ?? 0, vision: visionCount ?? 0, limits: LIMITS },
    });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

