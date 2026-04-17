/**
 * 전국 지하철역 데이터 자동 수집 스크립트
 *
 * 데이터 출처: 공공데이터포털 - 전국도시철도역사정보표준데이터 (15013205)
 * API: https://api.data.go.kr/openapi/tn_pubr_public_subway_info_api
 *
 * 환경변수:
 *   DATA_GO_KR_API_KEY  공공데이터포털 발급 인증키 (필수)
 *
 * 실행:
 *   node scripts/fetch-stations.mjs
 *   node scripts/fetch-stations.mjs --dry-run   # API 응답 구조만 확인
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/data/stations.ts");

const API_KEY = process.env.DATA_GO_KR_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!API_KEY) {
  console.error("❌ 환경변수 DATA_GO_KR_API_KEY 가 설정되지 않았습니다.");
  console.error("   .env.local에 추가하거나 GitHub Secrets에 등록해주세요.");
  process.exit(1);
}

// ─────────────────────────────────────────
// 노선명 정규화 (API 반환값 → 내부 ID)
// ─────────────────────────────────────────
function normalizeLine(rawLineName) {
  const name = rawLineName?.trim() ?? "";

  // 지역 접두어 감지
  const isBusan = name.includes("부산");
  const isDaegu = name.includes("대구");
  const isGwangju = name.includes("광주");
  const isDaejeon = name.includes("대전");
  const isIncheon = name.includes("인천");

  // 호선 번호 추출
  const numMatch = name.match(/(\d)호선/);
  const lineNum = numMatch?.[1];

  if (lineNum) {
    if (isBusan) return `부산${lineNum}`;
    if (isDaegu) return `대구${lineNum}`;
    if (isGwangju) return `광주${lineNum}`;
    if (isDaejeon) return `대전${lineNum}`;
    if (isIncheon) return `인천${lineNum}`;
    return lineNum; // 수도권 1~9호선
  }

  // 이름 기반 매핑
  const named = {
    "신분당선": "신분당",
    "수인·분당선": "수인분당",
    "수인분당선": "수인분당",
    "경의·중앙선": "경의중앙",
    "경의중앙선": "경의중앙",
    "공항철도": "공항",
    "경춘선": "경춘",
    "경강선": "경강",
    "서해선": "서해",
    "우이신설선": "우이신설",
    "신림선": "신림",
    "GTX-A": "GTX-A",
    "GTX-B": "GTX-B",
    "GTX-C": "GTX-C",
    "김포도시철도": "김포골드",
    "김포골드라인": "김포골드",
    "용인에버라인": "용인",
    "용인경전철": "용인",
    "의정부경전철": "의정부",
    "동해선": "동해",
    "부산·김해경전철": "부산김해",
    "부산김해경전철": "부산김해",
  };

  for (const [key, val] of Object.entries(named)) {
    if (name.includes(key)) return val;
  }

  // 알 수 없는 노선은 원본 이름 반환 (badgeColor: gray)
  console.warn(`  ⚠️  알 수 없는 노선명: "${name}" (그대로 사용)`);
  return name;
}

// ─────────────────────────────────────────
// 인기도 계산 (환승역 여부 + 대형 터미널)
// ─────────────────────────────────────────
const HIGH_POPULARITY = new Set([
  "강남", "홍대입구", "신촌", "건대입구", "합정", "잠실", "서울역", "서울",
  "신림", "구로디지털단지", "사당", "선릉", "역삼", "교대", "판교",
  "수원", "인천", "부산", "부산역", "서면", "동대구", "광주송정",
]);

function calcPopularity(statnNm, isTransfer) {
  if (HIGH_POPULARITY.has(statnNm)) return 5;
  if (isTransfer) return 3;
  return 2;
}

// ─────────────────────────────────────────
// API 호출 (전체 페이지)
// ─────────────────────────────────────────
async function fetchAllStations() {
  const BASE_URL =
    "http://api.data.go.kr/openapi/tn_pubr_public_subway_info_api";
  const NUM_ROWS = 1000;
  let page = 1;
  const all = [];

  console.log("📡 공공데이터포털 API 호출 시작...");

  while (true) {
    const url = new URL(BASE_URL);
    url.searchParams.set("serviceKey", API_KEY);
    url.searchParams.set("pageNo", String(page));
    url.searchParams.set("numOfRows", String(NUM_ROWS));
    url.searchParams.set("type", "json");

    console.log(`  → 페이지 ${page} 요청 중...`);
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();

    // --dry-run: API 응답 구조 확인 후 종료
    if (DRY_RUN) {
      console.log("\n📋 API 응답 구조 (첫 2개 항목):");
      const items = json?.response?.body?.items?.item;
      console.log(JSON.stringify(items?.slice(0, 2) ?? json, null, 2));
      console.log("\n✅ --dry-run 완료. 위 필드명 확인 후 스크립트를 조정하세요.");
      process.exit(0);
    }

    const body = json?.response?.body;
    if (!body) {
      console.error("❌ 응답 형식 오류:", JSON.stringify(json, null, 2));
      throw new Error("API 응답 형식이 예상과 다릅니다.");
    }

    const items = body?.items?.item ?? [];
    all.push(...(Array.isArray(items) ? items : [items]));

    const totalCount = Number(body.totalCount ?? 0);
    console.log(`  ✓ ${all.length} / ${totalCount} 역 수집됨`);

    if (all.length >= totalCount || items.length === 0) break;
    page++;
  }

  return all;
}

// ─────────────────────────────────────────
// 변환: API item → Station
// ─────────────────────────────────────────
function transformItem(item) {
  // 실제 API 필드명에 맞게 조정 (--dry-run으로 먼저 확인)
  const name =
    item.statnNm ??       // 예상 필드명 1
    item.subwaySttnNm ??  // 예상 필드명 2
    item.stnNm ??
    item.stationNm ??
    null;

  const lineName =
    item.lnNm ??
    item.subwayLineNm ??
    item.lnNme ??
    null;

  const lat = parseFloat(
    item.lat ?? item.latitude ?? item.yLat ?? "0"
  );
  const lng = parseFloat(
    item.lot ?? item.longitude ?? item.xLot ?? item.lng ?? "0"
  );

  const isTransfer =
    (item.trnsfYn ?? item.transferYn ?? "N").toUpperCase() === "Y";

  if (!name || !lineName || lat === 0 || lng === 0) return null;

  return {
    name,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    line: normalizeLine(lineName),
    isTransfer,
  };
}

// ─────────────────────────────────────────
// 중복 역 병합 (같은 이름 = 여러 노선)
// ─────────────────────────────────────────
function mergeByName(items) {
  const map = new Map();

  for (const item of items) {
    const key = item.name;
    if (map.has(key)) {
      const existing = map.get(key);
      if (!existing.line.includes(item.line)) {
        existing.line.push(item.line);
      }
      existing.isTransfer = true;
    } else {
      map.set(key, { ...item, line: [item.line] });
    }
  }

  return Array.from(map.values());
}

// ─────────────────────────────────────────
// stations.ts 생성
// ─────────────────────────────────────────
function generateTs(stations) {
  const now = new Date().toISOString().slice(0, 10);
  const lines = stations
    .map((s) => {
      const lineArr = JSON.stringify(s.line);
      return `  { name: "${s.name}", lat: ${s.lat}, lng: ${s.lng}, line: ${lineArr}, popularity: ${s.popularity} },`;
    })
    .join("\n");

  return `// 전국 지하철역 데이터 (자동 생성 - ${now})
// 출처: 공공데이터포털 전국도시철도역사정보표준데이터 (15013205)
// 스크립트: scripts/fetch-stations.mjs

export interface Station {
  name: string;
  lat: number;
  lng: number;
  line: string[];
  popularity: number; // 1~5
}

export const stations: Station[] = [
${lines}
];

export function findStation(name: string): Station | undefined {
  return stations.find((s) => s.name === name);
}

export function searchStations(query: string): Station[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return stations
    .filter((s) => s.name.toLowerCase().includes(q))
    .slice(0, 10);
}
`;
}

// ─────────────────────────────────────────
// 메인
// ─────────────────────────────────────────
async function main() {
  const rawItems = await fetchAllStations();
  console.log(`\n✅ 총 ${rawItems.length}개 레코드 수집 완료`);

  const transformed = rawItems
    .map(transformItem)
    .filter(Boolean);

  const merged = mergeByName(transformed);
  console.log(`📦 병합 후 고유 역: ${merged.length}개`);

  const stations = merged
    .map(({ name, lat, lng, line, isTransfer }) => ({
      name,
      lat,
      lng,
      line,
      popularity: calcPopularity(name, isTransfer),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const ts = generateTs(stations);
  fs.writeFileSync(OUTPUT_PATH, ts, "utf-8");
  console.log(`💾 저장 완료: ${OUTPUT_PATH}`);
  console.log(`🚇 총 ${stations.length}개 역`);
}

main().catch((err) => {
  console.error("❌ 오류 발생:", err.message);
  process.exit(1);
});
