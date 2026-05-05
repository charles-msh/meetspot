/**
 * 단위 테스트: sortLines, getPageNumbers, API 쿼리 변형 로직
 * 실행: node scripts/unit-test.mjs
 */

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    console.log(`     actual  : ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ── 1. sortLines ──────────────────────────────────────────────────
console.log("\n[1] sortLines 노선 정렬");

const LINE_ORDER = {
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "신분당": 10, "수인분당": 11, "분당": 12, "경의중앙": 13, "공항": 14,
  "경춘": 15, "경강": 16, "서해": 17, "우이신설": 18, "신림": 19,
  "GTX-A": 20, "GTX-B": 21, "GTX-C": 22,
  "김포골드": 23, "용인": 24, "의정부": 25,
  "부산1": 30, "부산2": 31, "부산3": 32, "부산4": 33, "동해": 34, "부산김해": 35,
  "대구1": 40, "대구2": 41, "대구3": 42,
  "광주1": 50, "대전1": 60,
};
function sortLines(lines) {
  return [...lines].sort((a, b) => (LINE_ORDER[a] ?? 99) - (LINE_ORDER[b] ?? 99));
}

assert("가산디지털단지: [7,1] → [1,7]", sortLines(["7", "1"]), ["1", "7"]);
assert("신도림: [2,1] → [1,2]", sortLines(["2", "1"]), ["1", "2"]);
assert("고속터미널: [3,7,9] → [3,7,9]", sortLines(["3", "7", "9"]), ["3", "7", "9"]);
assert("환승역: [9,수인분당] → [9,수인분당]", sortLines(["수인분당", "9"]), ["9", "수인분당"]);
assert("경의중앙+공항: [공항,경의중앙] → [경의중앙,공항]", sortLines(["공항", "경의중앙"]), ["경의중앙", "공항"]);
assert("단일 노선: [5] → [5]", sortLines(["5"]), ["5"]);
assert("부산+서울 혼재: [부산1,2] → [2,부산1]", sortLines(["부산1", "2"]), ["2", "부산1"]);
assert("GTX 정렬: [GTX-C,GTX-A,GTX-B]", sortLines(["GTX-C", "GTX-A", "GTX-B"]), ["GTX-A", "GTX-B", "GTX-C"]);
assert("지방 도시 순서: [대전1,광주1,대구1,부산1]", sortLines(["대전1", "광주1", "대구1", "부산1"]), ["부산1", "대구1", "광주1", "대전1"]);

// ── 2. getPageNumbers ─────────────────────────────────────────────
console.log("\n[2] getPageNumbers 페이지 번호 계산");

function getPageNumbers(page, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, 5];
  if (page >= totalPages - 2) return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [page - 2, page - 1, page, page + 1, page + 2];
}

assert("totalPages=3, page=2 → [1,2,3]", getPageNumbers(2, 3), [1, 2, 3]);
assert("totalPages=5, page=1 → [1,2,3,4,5]", getPageNumbers(1, 5), [1, 2, 3, 4, 5]);
assert("totalPages=5, page=3 → [1,2,3,4,5]", getPageNumbers(3, 5), [1, 2, 3, 4, 5]);
assert("totalPages=5, page=4 → [1,2,3,4,5]", getPageNumbers(4, 5), [1, 2, 3, 4, 5]);
assert("totalPages=5, page=5 → [1,2,3,4,5]", getPageNumbers(5, 5), [1, 2, 3, 4, 5]);

// ── 3. 쿼리 변형 페이지 인덱스 ──────────────────────────────────
console.log("\n[3] API 쿼리 변형 (페이지→쿼리 매핑)");

const PAGE_SUFFIX_PAIRS = [
  ["", ""],
  [" 추천", " 인기"],
  [" 유명", " 맛있는"],
  [" 가볼만한", " 특색있는"],
  [" 분위기", " 괜찮은"],
];
const MAX_PAGES_TOTAL = 50;
const ITEMS_PER_PAGE = 10;

function dropStation(q) {
  return q.replace(/([가-힣A-Za-z0-9()]+)역\s/, "$1 ");
}
function getPageIdx(start) {
  return Math.min(Math.floor((start - 1) / 10), PAGE_SUFFIX_PAIRS.length - 1);
}
function buildQueries(query, start) {
  const pageIdx = getPageIdx(start);
  const [s1, s2] = PAGE_SUFFIX_PAIRS[pageIdx];
  return [query + s1, dropStation(query) + s2];
}

// dropStation 테스트
assert("역 제거: '강남역 맛집' → '강남 맛집'", dropStation("강남역 맛집"), "강남 맛집");
assert("역 제거: '홍대입구역 카페' → '홍대입구 카페'", dropStation("홍대입구역 카페"), "홍대입구 카페");
assert("역 제거: '서울역 고기집' → '서울 고기집'", dropStation("서울역 고기집"), "서울 고기집");
assert("역 제거: '가산디지털단지역 맛집' → '가산디지털단지 맛집'", dropStation("가산디지털단지역 맛집"), "가산디지털단지 맛집");

// 페이지별 쿼리 빌드 테스트
assert("start=1  → [원본, 역제거]",    buildQueries("강남역 맛집", 1),  ["강남역 맛집", "강남 맛집"]);
assert("start=11 → [원본+추천, 역제거+인기]", buildQueries("강남역 맛집", 11), ["강남역 맛집 추천", "강남 맛집 인기"]);
assert("start=21 → [원본+유명, 역제거+맛있는]", buildQueries("강남역 맛집", 21), ["강남역 맛집 유명", "강남 맛집 맛있는"]);
assert("start=51 → 최대 클램프 (4페이지 변형)",  buildQueries("강남역 맛집", 51), ["강남역 맛집 분위기", "강남 맛집 괜찮은"]);

// ── 4. totalPages 계산 ───────────────────────────────────────────
console.log("\n[4] totalPages 계산");

const MAX_PAGES = 5;
function calcTotalPages(total) {
  return Math.min(MAX_PAGES, Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)));
}

assert("total=50 → 5 pages", calcTotalPages(50), 5);
assert("total=0  → 1 page (빈 결과도 최소 1)", calcTotalPages(0), 1);
assert("total=15 → 2 pages", calcTotalPages(15), 2);
assert("total=10 → 1 page", calcTotalPages(10), 1);
assert("total=11 → 2 pages", calcTotalPages(11), 2);

// ── 5. 페이지네이션 표시 조건 ────────────────────────────────────
console.log("\n[5] 페이지네이션 UI 표시 조건");

function shouldShowPagination(loading, placesLength, totalPages) {
  return !loading && placesLength > 0 && totalPages > 1;
}

assert("결과 있음(10건) + total=50 → 표시됨", shouldShowPagination(false, 10, 5), true);
assert("로딩 중 → 숨김", shouldShowPagination(true, 10, 5), false);
assert("결과 없음 → 숨김", shouldShowPagination(false, 0, 5), false);
assert("1페이지뿐(total≤10) → 숨김", shouldShowPagination(false, 5, 1), false);
assert("결과 있음(8건) + 2페이지 → 표시됨", shouldShowPagination(false, 8, 2), true);

// ── 결과 요약 ─────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`결과: ${passed}개 통과 / ${failed}개 실패`);
if (failed > 0) process.exit(1);
