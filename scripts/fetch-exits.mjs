/**
 * OSM Overpass API로 수도권 전체 지하철 출구 좌표 수집 → stationExits.ts 생성
 * 실행: node scripts/fetch-exits.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ── 1. stations.ts에서 역 목록 파싱 ──────────────────────────────
const stationsTs = fs.readFileSync(path.join(ROOT, "src/data/stations.ts"), "utf-8");
const stationRe = /\{ name: "([^"]+)", lat: ([\d.]+), lng: ([\d.]+)/g;
const stations = [];
for (const m of stationsTs.matchAll(stationRe)) {
  stations.push({ name: m[1], lat: parseFloat(m[2]), lng: parseFloat(m[3]) });
}
console.log(`stations.ts에서 ${stations.length}개 역 로드`);

// ── 2. Overpass API로 출구 노드 수집 ─────────────────────────────
// 여러 미러 서버 (순서대로 시도)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// 수도권 + 부산/대구/광주/대전 주요 도시 bounding box
const QUERIES = [
  // 수도권 (서울 + 경기 + 인천)
  "node[\"railway\"=\"subway_entrance\"](37.2,126.7,37.85,127.35);",
  // 부산
  "node[\"railway\"=\"subway_entrance\"](35.0,128.8,35.35,129.3);",
  // 대구
  "node[\"railway\"=\"subway_entrance\"](35.7,128.4,36.0,128.75);",
  // 광주
  "node[\"railway\"=\"subway_entrance\"](35.0,126.7,35.3,126.95);",
  // 대전
  "node[\"railway\"=\"subway_entrance\"](36.2,127.3,36.5,127.55);",
];

async function fetchFromEndpoint(endpoint, query, timeoutSecs = 90) {
  const ql = `[out:json][timeout:${timeoutSecs}];(${query});out body;`;
  const params = new URLSearchParams({ data: ql });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), (timeoutSecs + 15) * 1000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "meetspot-exit-builder/1.0",
      },
      body: params.toString(),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.elements || [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExitsWithRetry(query, label) {
  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt];
    try {
      console.log(`  [${label}] ${endpoint.replace("https://", "")} 시도...`);
      const elements = await fetchFromEndpoint(endpoint, query);
      console.log(`  [${label}] ✓ ${elements.length}개`);
      return elements;
    } catch (e) {
      console.warn(`  [${label}] ✗ ${e.message} → 다음 서버 시도`);
      if (attempt < OVERPASS_ENDPOINTS.length - 1) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  console.error(`  [${label}] 모든 서버 실패 → 건너뜀`);
  return [];
}

console.log("\nOverpass API에서 출구 데이터 수집 중...\n");
let allExits = [];
const labels = ["수도권", "부산", "대구", "광주", "대전"];
for (let i = 0; i < QUERIES.length; i++) {
  const exits = await fetchExitsWithRetry(QUERIES[i], labels[i]);
  allExits.push(...exits);
  if (i < QUERIES.length - 1) {
    await new Promise(r => setTimeout(r, 2000)); // rate limit
  }
}
console.log(`\n총 ${allExits.length}개 출구 노드 수집\n`);

if (allExits.length === 0) {
  console.error("❌ 출구 데이터를 하나도 가져오지 못했습니다. 네트워크 상태를 확인하세요.");
  process.exit(1);
}

// ── 3. Haversine 거리 계산 ────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── 4. 각 출구 → 가장 가까운 역에 배정 (600m 이내) ──────────────
const exitMap = {}; // { stationName: [ { ref, lat, lng } ] }
let assigned = 0;
let skipped = 0;

for (const node of allExits) {
  const ref = node.tags?.ref || "";
  const lat = node.lat;
  const lng = node.lon;
  if (!ref || !lat || !lng) { skipped++; continue; }

  // 가장 가까운 역 찾기
  let bestStation = null;
  let bestDist = Infinity;
  for (const st of stations) {
    const d = haversine(st.lat, st.lng, lat, lng);
    if (d < bestDist) { bestDist = d; bestStation = st; }
  }

  if (!bestStation || bestDist > 600) { skipped++; continue; }

  const key = bestStation.name;
  if (!exitMap[key]) exitMap[key] = [];
  // 같은 번호 출구 중복 제거 (더 가까운 것 유지)
  const existing = exitMap[key].find((e) => e.ref === ref);
  if (existing) {
    const existingDist = haversine(bestStation.lat, bestStation.lng, existing.lat, existing.lng);
    if (bestDist < existingDist) {
      existing.lat = lat; existing.lng = lng;
    }
  } else {
    exitMap[key].push({ ref, lat, lng });
    assigned++;
  }
}

// 각 역의 출구를 번호 순으로 정렬
for (const key of Object.keys(exitMap)) {
  exitMap[key].sort((a, b) => {
    const na = parseInt(a.ref) || 0;
    const nb = parseInt(b.ref) || 0;
    return na !== nb ? na - nb : a.ref.localeCompare(b.ref);
  });
}

console.log(`배정 완료: ${assigned}개 출구, ${Object.keys(exitMap).length}개 역, ${skipped}개 스킵`);

// 커버리지 미흡 경고
const missed = stations.filter(s => !exitMap[s.name]);
if (missed.length > 0) {
  console.warn(`⚠️  출구 데이터 없는 역 (${missed.length}개): ${missed.slice(0, 10).map(s => s.name).join(", ")}${missed.length > 10 ? " ..." : ""}`);
}

// ── 5. stationExits.ts 생성 ───────────────────────────────────────
const lines = [
  "// 자동 생성 — scripts/fetch-exits.mjs",
  `// 생성일: ${new Date().toISOString().slice(0, 10)}`,
  "// 출처: OpenStreetMap contributors (railway=subway_entrance)",
  "",
  "export interface ExitCoord {",
  "  ref: string;   // 출구 번호 (\"1\", \"2\", ...)",
  "  lat: number;",
  "  lng: number;",
  "}",
  "",
  "// key: stations.ts의 name 필드와 동일",
  "export const stationExits: Record<string, ExitCoord[]> = {",
];

for (const [stName, exits] of Object.entries(exitMap).sort()) {
  const entries = exits
    .map((e) => `    { ref: "${e.ref}", lat: ${e.lat.toFixed(7)}, lng: ${e.lng.toFixed(7)} }`)
    .join(",\n");
  lines.push(`  "${stName}": [\n${entries},\n  ],`);
}

lines.push("};");
lines.push("");

const output = lines.join("\n");
const outPath = path.join(ROOT, "src/data/stationExits.ts");
fs.writeFileSync(outPath, output, "utf-8");
console.log(`\n✅ ${outPath} 생성 완료 (${(output.length / 1024).toFixed(1)} KB)`);
