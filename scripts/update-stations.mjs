/**
 * stations.ts 업데이트 스크립트
 *
 * 사용법:
 *   node scripts/update-stations.mjs <엑셀파일경로>
 *   예: node scripts/update-stations.mjs "C:/Users/Charles/Downloads/전체_도시철도역사정보_20270228.xlsx"
 *
 * 처리 순서:
 *   1. 엑셀 파일 → 전국 역 목록 변환
 *   2. 현재 stations.ts와 비교 → 추가/삭제 역 리포트
 *   3. 엑셀에 없는 GTX 개통역 확인 → 네이버 API로 좌표 조회 후 자동 추가
 *   4. stations.ts 갱신
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/data/stations.ts");

// ─────────────────────────────────────────
// 알려진 GTX 노선별 역 목록 (개통 여부 관리)
// 새 역 개통 시 여기에 추가
// status: "open" = 개통, "planned" = 예정
// ─────────────────────────────────────────
const GTX_STATIONS = [
  // GTX-A (2024년 개통)
  { name: "운정중앙", line: "GTX-A", status: "open" },
  { name: "킨텍스",   line: "GTX-A", status: "open" },
  { name: "대곡",     line: "GTX-A", status: "open" },
  { name: "연신내",   line: "GTX-A", status: "open" },
  { name: "서울역",   line: "GTX-A", status: "open" },
  { name: "수서",     line: "GTX-A", status: "open" },
  { name: "성남",     line: "GTX-A", status: "open" },
  { name: "구성",     line: "GTX-A", status: "open" },
  { name: "기흥",     line: "GTX-A", status: "open" },
  { name: "동탄",     line: "GTX-A", status: "open" },

  // GTX-B (예정 - 개통 시 status를 "open"으로 변경)
  { name: "인천대입구", line: "GTX-B", status: "planned" },
  { name: "부평",       line: "GTX-B", status: "planned" },
  { name: "부천종합운동장", line: "GTX-B", status: "planned" },
  { name: "신도림",     line: "GTX-B", status: "planned" },
  { name: "여의도",     line: "GTX-B", status: "planned" },
  { name: "용산",       line: "GTX-B", status: "planned" },
  { name: "청량리",     line: "GTX-B", status: "planned" },
  { name: "망우",       line: "GTX-B", status: "planned" },
  { name: "별내",       line: "GTX-B", status: "planned" },
  { name: "마석",       line: "GTX-B", status: "planned" },

  // GTX-C (예정)
  { name: "덕정",   line: "GTX-C", status: "planned" },
  { name: "의정부", line: "GTX-C", status: "planned" },
  { name: "창동",   line: "GTX-C", status: "planned" },
  { name: "광운대", line: "GTX-C", status: "planned" },
  { name: "청량리", line: "GTX-C", status: "planned" },
  { name: "삼성",   line: "GTX-C", status: "planned" },
  { name: "양재",   line: "GTX-C", status: "planned" },
  { name: "과천",   line: "GTX-C", status: "planned" },
  { name: "금정",   line: "GTX-C", status: "planned" },
  { name: "수원",   line: "GTX-C", status: "planned" },
];

// ─────────────────────────────────────────
// 환경변수 로드 (.env.local)
// ─────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;
    const idx = line.indexOf("=");
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    env[k] = v;
  });
  return env;
}

// ─────────────────────────────────────────
// 네이버 지역 검색 API로 역 좌표 조회
// ─────────────────────────────────────────
async function fetchNaverCoords(stationName, lineName, env) {
  const clientId = env.NAVER_CLIENT_ID;
  const clientSecret = env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("  ⚠️  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 없음 → 좌표 조회 스킵");
    return null;
  }

  const query = `${stationName}역 ${lineName}`;
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;

  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
  });
  if (!res.ok) return null;

  const data = await res.json();
  // 카테고리가 지하철/전철인 결과 우선
  const items = data.items ?? [];
  const transit = items.find((item) =>
    (item.category ?? "").includes("지하철") ||
    (item.category ?? "").includes("전철")
  ) ?? items[0];

  if (!transit) return null;

  const lat = parseInt(transit.mapy) / 1e7;
  const lng = parseInt(transit.mapx) / 1e7;
  if (!lat || !lng) return null;

  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

// ─────────────────────────────────────────
// 노선명 정규화 (엑셀 → 내부 ID)
// ─────────────────────────────────────────
function normalizeLine(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/(\d)호선/);
  if (m) {
    const n = m[1];
    if (s.includes("부산")) return `부산${n}`;
    if (s.includes("대구")) return `대구${n}`;
    if (s.includes("광주")) return `광주${n}`;
    if (s.includes("대전")) return `대전${n}`;
    if (s.includes("인천")) return `인천${n}`;
    return n;
  }
  const table = {
    "신분당선": "신분당", "수인·분당선": "수인분당", "수인분당선": "수인분당",
    "분당선": "수인분당", "수인선": "수인분당",
    "경의·중앙선": "경의중앙", "경의중앙선": "경의중앙",
    "공항철도": "공항", "인천국제공항선": "공항",
    "경춘선": "경춘", "경강선": "경강", "서해선": "서해",
    "우이신설선": "우이신설", "신림선": "신림", "진접선": "4",
    "GTX-A": "GTX-A", "GTX-B": "GTX-B", "GTX-C": "GTX-C",
    "김포도시철도": "김포골드", "김포골드라인": "김포골드",
    "용인에버라인": "용인", "에버라인": "용인", "용인경전철": "용인",
    "의정부경전철": "의정부",
    "동해선": "동해", "부산·김해경전철": "부산김해", "부산김해경전철": "부산김해",
    "일산선": "3", "안산과천선": "4",
    "경인선": "1", "경부선": "1", "경원선": "1", "장항선": "1",
    "대경선": "대경",
  };
  for (const [key, val] of Object.entries(table)) {
    if (s.includes(key)) return val;
  }
  return null;
}

// ─────────────────────────────────────────
// 엑셀 → 역 맵 변환
// ─────────────────────────────────────────
async function excelToStationMap(excelPath) {
  // pandas 대신 xlsx 패키지 사용 (Node.js)
  let xlsx;
  try {
    xlsx = require("xlsx");
  } catch {
    console.error("❌ xlsx 패키지가 없습니다. 설치 중...");
    const { execSync } = await import("child_process");
    execSync("npm install xlsx --no-save", { stdio: "inherit" });
    xlsx = require("xlsx");
  }

  const wb = xlsx.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });

  // 헤더 행 제거
  const [, ...dataRows] = rows;

  const stationMap = new Map();
  const SKIP = new Set(["자기부상철도"]);

  for (const row of dataRows) {
    const rawName = String(row[1] ?? "").trim();
    const rawLine = String(row[3] ?? "").trim();
    if (!rawName || !rawLine || SKIP.has(rawLine)) continue;

    // 이름 정제
    const name = rawName.replace(/[\r\n\t]+/g, " ").replace(/ +/g, " ").replace(/역$/, "").trim();
    if (!name) continue;

    const line = normalizeLine(rawLine);
    if (!line) continue;

    const isXfer = String(row[6] ?? "").includes("환승");
    const lat = Math.round(parseFloat(row[9]) * 1e6) / 1e6;
    const lng = Math.round(parseFloat(row[10]) * 1e6) / 1e6;
    if (!lat || !lng) continue;

    if (!stationMap.has(name)) {
      stationMap.set(name, { lat, lng, lines: [], isXfer });
    }
    const s = stationMap.get(name);
    if (!s.lines.includes(line)) s.lines.push(line);
    if (isXfer) s.isXfer = true;
  }

  return stationMap;
}

// ─────────────────────────────────────────
// 현재 stations.ts에서 역 이름 목록 추출
// ─────────────────────────────────────────
function getCurrentStationNames() {
  if (!fs.existsSync(OUTPUT_PATH)) return new Set();
  const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
  const names = new Set();
  for (const m of content.matchAll(/name: "([^"]+)"/g)) {
    names.add(m[1]);
  }
  return names;
}

// ─────────────────────────────────────────
// stations.ts 생성
// ─────────────────────────────────────────
function generateTs(stationMap, gtxExtra) {
  const HIGH = new Set([
    "강남", "홍대입구", "신촌", "건대입구", "합정", "잠실", "서울역", "서울",
    "신림", "구로디지털단지", "사당", "선릉", "역삼", "교대", "판교",
    "수원", "인천", "부산", "부산역", "서면", "동대구", "광주송정", "대전",
  ]);

  const allStations = new Map(stationMap);

  // GTX 역 병합: 엑셀 역에 GTX 노선 추가 or 신규 추가
  for (const [name, data] of gtxExtra) {
    if (allStations.has(name)) {
      const s = allStations.get(name);
      for (const line of data.lines) {
        if (!s.lines.includes(line)) s.lines.push(line);
      }
      if (data.lines.length > 0) s.isXfer = true;
    } else {
      allStations.set(name, data);
    }
  }

  const rows = Array.from(allStations.entries())
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([name, { lat, lng, lines, isXfer }]) => {
      const pop = HIGH.has(name) ? 5 : isXfer ? 3 : 2;
      return `  { name: "${name}", lat: ${lat}, lng: ${lng}, line: ${JSON.stringify(lines)}, popularity: ${pop} },`;
    });

  const today = new Date().toISOString().slice(0, 10);
  return `// 전국 지하철역 데이터 (자동 생성 - ${today})
// 출처: 공공데이터포털 전국도시철도역사정보표준데이터

export interface Station {
  name: string;
  lat: number;
  lng: number;
  line: string[];
  popularity: number; // 1~5
}

export const stations: Station[] = [
${rows.join("\n")}
];

export const uniqueStations = stations;

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
  const excelPath = process.argv[2];
  if (!excelPath) {
    console.error("사용법: node scripts/update-stations.mjs <엑셀파일경로>");
    process.exit(1);
  }
  if (!fs.existsSync(excelPath)) {
    console.error(`❌ 파일 없음: ${excelPath}`);
    process.exit(1);
  }

  const env = loadEnv();

  console.log("📂 엑셀 파일 읽는 중...");
  const newMap = await excelToStationMap(excelPath);
  console.log(`✅ 엑셀에서 ${newMap.size}개 고유 역 추출`);

  // ── diff 리포트 ──────────────────────────
  const prevNames = getCurrentStationNames();
  const newNames = new Set(newMap.keys());

  const added = [...newNames].filter((n) => !prevNames.has(n));
  const removed = [...prevNames].filter((n) => !newNames.has(n) && n !== "uniqueStations");

  console.log("\n📊 변경사항 비교");
  console.log(`  이전: ${prevNames.size}개 → 새로운: ${newNames.size}개`);
  if (added.length > 0) {
    console.log(`\n  ➕ 추가된 역 (${added.length}개):`);
    added.forEach((n) => console.log(`     + ${n}`));
  } else {
    console.log("  ➕ 추가된 역: 없음");
  }
  if (removed.length > 0) {
    console.log(`\n  ➖ 삭제된 역 (${removed.length}개):`);
    removed.forEach((n) => console.log(`     - ${n}`));
  } else {
    console.log("  ➖ 삭제된 역: 없음");
  }

  // ── GTX 개통역 체크 ──────────────────────
  console.log("\n🚄 GTX 개통역 확인 중...");
  const gtxExtra = new Map();
  const openGtx = GTX_STATIONS.filter((s) => s.status === "open");

  for (const gtx of openGtx) {
    const existing = newMap.get(gtx.name);
    if (existing) {
      // 엑셀에 있는 역 → GTX 노선만 추가
      if (!existing.lines.includes(gtx.line)) {
        console.log(`  ℹ️  ${gtx.name}: 엑셀에 있음 → ${gtx.line} 노선 추가`);
        if (!gtxExtra.has(gtx.name)) {
          gtxExtra.set(gtx.name, { ...existing, lines: [...existing.lines] });
        }
        gtxExtra.get(gtx.name).lines.push(gtx.line);
      }
    } else {
      // 엑셀에 없는 역 → 네이버 API로 좌표 조회 후 신규 추가
      console.log(`  🔍 ${gtx.name}: 엑셀에 없음 → 네이버 API 좌표 조회 중...`);
      const coords = await fetchNaverCoords(gtx.name, gtx.line, env);
      if (coords) {
        console.log(`     ✅ ${gtx.name} 좌표 확보 (${coords.lat}, ${coords.lng})`);
        if (!gtxExtra.has(gtx.name)) {
          gtxExtra.set(gtx.name, { lat: coords.lat, lng: coords.lng, lines: [], isXfer: false });
        }
        gtxExtra.get(gtx.name).lines.push(gtx.line);
      } else {
        console.log(`     ❌ ${gtx.name} 좌표 조회 실패 → 수동 확인 필요`);
      }
    }
  }

  // ── stations.ts 생성 ─────────────────────
  const ts = generateTs(newMap, gtxExtra);
  fs.writeFileSync(OUTPUT_PATH, ts, "utf-8");

  const finalCount = (ts.match(/{ name:/g) ?? []).length;
  console.log(`\n💾 stations.ts 저장 완료 (총 ${finalCount}개 역)`);
  console.log("✨ 완료! 내용 확인 후 git commit & push 해주세요.");
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
