export type MeetingType = "date" | "friends" | "work" | "club" | "business" | "family";
export type VenueType = "restaurant" | "bar" | "cafe";

export interface MeetingInfo {
  peopleCount: number;
  meetingType: MeetingType;
  venueType: VenueType;
}

export interface Participant {
  id: number;
  name: string;
  station: string; // 지하철역 이름
}

export interface RecommendedStation {
  name: string;
  line: string[];
  score: number; // 종합 점수 (거리 + 인기도)
  avgDistance: number; // 평균 거리 (km)
  popularity: number;
}

export interface Place {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  link: string;
  description: string;
}

export interface PlaceItem {
  title: string;
  category: string;
  address: string;
  roadAddress: string;
  link: string;
  telephone: string;
  imageUrls: string[];
}
