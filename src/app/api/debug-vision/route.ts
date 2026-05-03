import { NextResponse } from "next/server";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

// Vercel 서버에서 Naver CDN fetch + Vision API 동작 확인용 임시 엔드포인트
export async function GET() {
  const keyPreview = GOOGLE_PLACES_API_KEY
    ? `${GOOGLE_PLACES_API_KEY.slice(0, 8)}...` : "undefined";
  const testUrl =
    "https://search.pstatic.net/common/?type=b150&src=https%3A%2F%2Fldb-phinf.pstatic.net%2F20250115_209%2F1736929842430yFyGK_PNG%2F37%25B8%25AE%25B4%25BA%25BE%25F3_%25B5%25B7%25C4%25DA%25C3%25F7%25B6%25F3%25B8%25E0_%252B_%25B5%25B7%25C4%25AB%25C3%25F7.png";

  // 1) Naver CDN fetch 테스트
  let fetchStatus = 0;
  let byteLength = 0;
  let base64: string | null = null;

  let contentType = "";
  try {
    const r = await fetch(testUrl, {
      headers: {
        Referer: "https://www.naver.com",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    fetchStatus = r.status;
    contentType = r.headers.get("content-type") || "";
    if (r.ok) {
      const buf = await r.arrayBuffer();
      byteLength = buf.byteLength;
      base64 = Buffer.from(buf).toString("base64");
    }
  } catch (e) {
    return NextResponse.json({ v: 2, error: "fetch 예외", detail: String(e) });
  }

  if (!base64) {
    return NextResponse.json({ fetchStatus, byteLength, error: "base64 변환 실패" });
  }

  // 2) Vision API 테스트
  const vRes = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_PLACES_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          { image: { content: base64 }, features: [{ type: "LABEL_DETECTION", maxResults: 10 }] },
        ],
      }),
    }
  );

  const vData = await vRes.json();
  const labels = (vData.responses?.[0]?.labelAnnotations || []).map(
    (l: { description: string; score: number }) => `${l.description}(${l.score.toFixed(2)})`
  );

  return NextResponse.json({
    v: 4,
    keyPreview,
    fetchStatus,
    contentType,
    byteLength,
    base64Head: base64.slice(0, 20),
    base64Length: base64.length,
    visionStatus: vRes.status,
    visionRaw: vData,
    labels,
  });
}
