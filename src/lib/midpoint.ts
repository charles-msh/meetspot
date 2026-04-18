import { uniqueStations, type Station } from "@/data/stations";
import type { RecommendedStation } from "./types";

// 두 지점 간 거리 계산 (km) - Haversine 공식
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 참여자들의 위치에서 최적의 만남 장소 추천
// withPopularity: true = 번화함 가중치 포함 (핫플 포함 모드), false = 위치만 (딱 중간 모드)
export function findBestStations(
  participantStations: Station[],
  withPopularity = true
): RecommendedStation[] {
  if (participantStations.length === 0) return [];

  // 1. 기하학적 중심점 계산
  const centerLat =
    participantStations.reduce((sum, s) => sum + s.lat, 0) /
    participantStations.length;
  const centerLng =
    participantStations.reduce((sum, s) => sum + s.lng, 0) /
    participantStations.length;

  // 2. 모든 역에 대해 점수 계산
  const scored = uniqueStations.map((station) => {
    // 각 참여자의 역에서 이 역까지의 평균 거리
    const distances = participantStations.map((ps) =>
      haversineDistance(ps.lat, ps.lng, station.lat, station.lng)
    );
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;

    // 최대 거리 (가장 멀리서 오는 사람)
    const maxDistance = Math.max(...distances);

    // 중심점과의 거리
    const distFromCenter = haversineDistance(
      centerLat, centerLng,
      station.lat, station.lng
    );

    // 종합 점수 계산 (낮을수록 좋음)
    // - 평균 거리가 가까울수록 좋음 (가중치 40%)
    // - 최대 거리가 작을수록 좋음 = 공평함 (가중치 30%)
    // - withPopularity=true면 인기도 높을수록 유리 (핫플 포함 모드)
    const distanceScore = avgDistance * 0.4 + maxDistance * 0.3;
    const popularityBonus = withPopularity ? (5 - station.popularity) * 2 : 0;
    const score = distanceScore + popularityBonus;

    return {
      name: station.name,
      line: station.line,
      score,
      avgDistance: Math.round(avgDistance * 10) / 10,
      popularity: station.popularity,
    };
  });

  // 3. 점수 순 정렬 후 상위 20개 반환 (Step3에서 실제 소요시간 기준으로 재정렬)
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, 20);
}
