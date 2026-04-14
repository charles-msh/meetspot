// 수도권 주요 지하철역 데이터 (위도, 경도)
// 인기도(popularity)는 유동인구 + 상권 기반 1~5점

export interface Station {
  name: string;
  lat: number;
  lng: number;
  line: string[];
  popularity: number; // 1~5, 높을수록 유동인구/상권 좋음
}

export const stations: Station[] = [
  // 1호선
  { name: "서울역", lat: 37.5547, lng: 126.9706, line: ["1", "4", "경의중앙"], popularity: 5 },
  { name: "시청", lat: 37.5659, lng: 126.9773, line: ["1", "2"], popularity: 4 },
  { name: "종각", lat: 37.5701, lng: 126.9827, line: ["1"], popularity: 5 },
  { name: "종로3가", lat: 37.5714, lng: 126.9916, line: ["1", "3", "5"], popularity: 4 },
  { name: "종로5가", lat: 37.5708, lng: 127.0020, line: ["1"], popularity: 3 },
  { name: "동대문", lat: 37.5712, lng: 127.0095, line: ["1", "4"], popularity: 4 },
  { name: "신설동", lat: 37.5755, lng: 127.0250, line: ["1", "2"], popularity: 2 },
  { name: "제기동", lat: 37.5808, lng: 127.0347, line: ["1"], popularity: 2 },
  { name: "청량리", lat: 37.5804, lng: 127.0470, line: ["1", "경의중앙"], popularity: 3 },
  { name: "회기", lat: 37.5896, lng: 127.0575, line: ["1", "경의중앙"], popularity: 2 },
  { name: "외대앞", lat: 37.5936, lng: 127.0620, line: ["1"], popularity: 2 },
  { name: "신이문", lat: 37.5968, lng: 127.0672, line: ["1"], popularity: 1 },
  { name: "석계", lat: 37.6152, lng: 127.0660, line: ["1", "6"], popularity: 2 },
  { name: "노원", lat: 37.6555, lng: 127.0619, line: ["4", "7"], popularity: 3 },
  { name: "창동", lat: 37.6533, lng: 127.0476, line: ["1", "4"], popularity: 2 },
  { name: "도봉산", lat: 37.6896, lng: 127.0449, line: ["1", "7"], popularity: 1 },
  { name: "의정부", lat: 37.7382, lng: 127.0459, line: ["1"], popularity: 3 },
  { name: "인천", lat: 37.4563, lng: 126.7052, line: ["1"], popularity: 3 },
  { name: "부평", lat: 37.4897, lng: 126.7234, line: ["1"], popularity: 3 },
  { name: "구로", lat: 37.5033, lng: 126.8824, line: ["1"], popularity: 2 },
  { name: "영등포", lat: 37.5154, lng: 126.9074, line: ["1"], popularity: 3 },
  { name: "용산", lat: 37.5299, lng: 126.9646, line: ["1", "경의중앙"], popularity: 3 },
  { name: "수원", lat: 37.2669, lng: 127.0010, line: ["1"], popularity: 4 },

  // 2호선
  { name: "강남", lat: 37.4979, lng: 127.0276, line: ["2"], popularity: 5 },
  { name: "역삼", lat: 37.5007, lng: 127.0366, line: ["2"], popularity: 4 },
  { name: "선릉", lat: 37.5045, lng: 127.0490, line: ["2", "분당"], popularity: 3 },
  { name: "삼성", lat: 37.5089, lng: 127.0637, line: ["2"], popularity: 4 },
  { name: "잠실", lat: 37.5132, lng: 127.1001, line: ["2", "8"], popularity: 5 },
  { name: "잠실나루", lat: 37.5213, lng: 127.1039, line: ["2"], popularity: 2 },
  { name: "강변", lat: 37.5353, lng: 127.0944, line: ["2"], popularity: 3 },
  { name: "건대입구", lat: 37.5404, lng: 127.0701, line: ["2", "7"], popularity: 5 },
  { name: "성수", lat: 37.5446, lng: 127.0557, line: ["2"], popularity: 4 },
  { name: "왕십리", lat: 37.5615, lng: 127.0370, line: ["2", "5", "경의중앙", "분당"], popularity: 3 },
  { name: "을지로3가", lat: 37.5662, lng: 126.9920, line: ["2", "3"], popularity: 3 },
  { name: "을지로4가", lat: 37.5671, lng: 126.9982, line: ["2", "5"], popularity: 3 },
  { name: "동대문역사문화공원", lat: 37.5651, lng: 127.0079, line: ["2", "4", "5"], popularity: 4 },
  { name: "신당", lat: 37.5660, lng: 127.0179, line: ["2", "6"], popularity: 2 },
  { name: "상왕십리", lat: 37.5653, lng: 127.0290, line: ["2"], popularity: 2 },
  { name: "합정", lat: 37.5495, lng: 126.9137, line: ["2", "6"], popularity: 4 },
  { name: "홍대입구", lat: 37.5571, lng: 126.9260, line: ["2", "경의중앙", "공항"], popularity: 5 },
  { name: "신촌", lat: 37.5553, lng: 126.9367, line: ["2"], popularity: 4 },
  { name: "이대", lat: 37.5569, lng: 126.9464, line: ["2"], popularity: 3 },
  { name: "아현", lat: 37.5578, lng: 126.9560, line: ["2"], popularity: 2 },
  { name: "충정로", lat: 37.5600, lng: 126.9636, line: ["2", "5"], popularity: 2 },
  { name: "교대", lat: 37.4937, lng: 127.0146, line: ["2", "3"], popularity: 3 },
  { name: "서초", lat: 37.4917, lng: 127.0078, line: ["2"], popularity: 3 },
  { name: "방배", lat: 37.4817, lng: 126.9977, line: ["2"], popularity: 2 },
  { name: "사당", lat: 37.4765, lng: 126.9816, line: ["2", "4"], popularity: 4 },
  { name: "낙성대", lat: 37.4767, lng: 126.9637, line: ["2"], popularity: 2 },
  { name: "서울대입구", lat: 37.4816, lng: 126.9529, line: ["2"], popularity: 3 },
  { name: "신림", lat: 37.4842, lng: 126.9296, line: ["2"], popularity: 3 },
  { name: "구로디지털단지", lat: 37.4854, lng: 126.9016, line: ["2"], popularity: 3 },
  { name: "대림", lat: 37.4932, lng: 126.8970, line: ["2", "7"], popularity: 2 },
  { name: "신도림", lat: 37.5088, lng: 126.8913, line: ["1", "2"], popularity: 3 },
  { name: "영등포구청", lat: 37.5244, lng: 126.8963, line: ["2", "5"], popularity: 2 },
  { name: "당산", lat: 37.5347, lng: 126.9023, line: ["2", "9"], popularity: 2 },
  { name: "문래", lat: 37.5179, lng: 126.8988, line: ["2"], popularity: 2 },
  { name: "대치", lat: 37.4948, lng: 127.0635, line: ["2"], popularity: 3 },
  { name: "도곡", lat: 37.4911, lng: 127.0562, line: ["2"], popularity: 2 },
  { name: "종합운동장", lat: 37.5110, lng: 127.0739, line: ["2", "9"], popularity: 3 },
  { name: "신천", lat: 37.5145, lng: 127.0856, line: ["2"], popularity: 3 },

  // 3호선
  { name: "경복궁", lat: 37.5759, lng: 126.9735, line: ["3"], popularity: 4 },
  { name: "안국", lat: 37.5760, lng: 126.9858, line: ["3"], popularity: 4 },
  { name: "충무로", lat: 37.5614, lng: 126.9949, line: ["3", "4"], popularity: 3 },
  { name: "약수", lat: 37.5551, lng: 127.0102, line: ["3", "6"], popularity: 2 },
  { name: "압구정", lat: 37.5270, lng: 127.0283, line: ["3"], popularity: 4 },
  { name: "신사", lat: 37.5168, lng: 127.0203, line: ["3"], popularity: 5 },
  { name: "잠원", lat: 37.5112, lng: 127.0135, line: ["3"], popularity: 2 },
  { name: "고속터미널", lat: 37.5049, lng: 127.0044, line: ["3", "7", "9"], popularity: 4 },
  { name: "남부터미널", lat: 37.4844, lng: 127.0147, line: ["3"], popularity: 2 },
  { name: "양재", lat: 37.4844, lng: 127.0348, line: ["3", "신분당"], popularity: 3 },
  { name: "대화", lat: 37.6765, lng: 126.7465, line: ["3"], popularity: 2 },
  { name: "일산", lat: 37.6608, lng: 126.7700, line: ["3"], popularity: 3 },

  // 4호선
  { name: "혜화", lat: 37.5822, lng: 127.0013, line: ["4"], popularity: 4 },
  { name: "성신여대입구", lat: 37.5929, lng: 127.0167, line: ["4"], popularity: 3 },
  { name: "한성대입구", lat: 37.5886, lng: 127.0065, line: ["4"], popularity: 2 },
  { name: "삼각지", lat: 37.5344, lng: 126.9733, line: ["4", "6"], popularity: 3 },
  { name: "이촌", lat: 37.5318, lng: 126.9654, line: ["4", "경의중앙"], popularity: 2 },
  { name: "동작", lat: 37.5013, lng: 126.9517, line: ["4"], popularity: 2 },
  { name: "총신대입구", lat: 37.4868, lng: 126.9823, line: ["4", "7"], popularity: 2 },
  { name: "명동", lat: 37.5609, lng: 126.9862, line: ["4"], popularity: 5 },
  { name: "회현", lat: 37.5585, lng: 126.9789, line: ["4"], popularity: 3 },
  { name: "미아사거리", lat: 37.6131, lng: 127.0301, line: ["4"], popularity: 3 },
  { name: "수유", lat: 37.6381, lng: 127.0257, line: ["4"], popularity: 3 },
  { name: "쌍문", lat: 37.6487, lng: 127.0347, line: ["4"], popularity: 2 },
  { name: "산본", lat: 37.3575, lng: 126.9323, line: ["4"], popularity: 2 },
  { name: "안산", lat: 37.3232, lng: 126.8544, line: ["4"], popularity: 3 },

  // 5호선
  { name: "광화문", lat: 37.5708, lng: 126.9769, line: ["5"], popularity: 5 },
  { name: "여의도", lat: 37.5219, lng: 126.9243, line: ["5", "9"], popularity: 4 },
  { name: "여의나루", lat: 37.5272, lng: 126.9326, line: ["5"], popularity: 3 },
  { name: "마포", lat: 37.5395, lng: 126.9460, line: ["5"], popularity: 2 },
  { name: "공덕", lat: 37.5440, lng: 126.9515, line: ["5", "6", "경의중앙", "공항"], popularity: 3 },
  { name: "천호", lat: 37.5387, lng: 127.1236, line: ["5", "8"], popularity: 3 },
  { name: "강동", lat: 37.5531, lng: 127.1329, line: ["5"], popularity: 2 },
  { name: "광나루", lat: 37.5455, lng: 127.1037, line: ["5"], popularity: 2 },
  { name: "군자", lat: 37.5573, lng: 127.0796, line: ["5", "7"], popularity: 2 },
  { name: "답십리", lat: 37.5666, lng: 127.0524, line: ["5"], popularity: 2 },
  { name: "청구", lat: 37.5601, lng: 127.0141, line: ["5", "6"], popularity: 2 },
  { name: "행당", lat: 37.5573, lng: 127.0296, line: ["5"], popularity: 1 },
  { name: "마장", lat: 37.5667, lng: 127.0439, line: ["5"], popularity: 1 },
  { name: "김포공항", lat: 37.5622, lng: 126.8013, line: ["5", "9", "공항"], popularity: 3 },
  { name: "발산", lat: 37.5585, lng: 126.8382, line: ["5"], popularity: 2 },
  { name: "까치산", lat: 37.5331, lng: 126.8476, line: ["2", "5"], popularity: 2 },

  // 6호선
  { name: "이태원", lat: 37.5347, lng: 126.9944, line: ["6"], popularity: 4 },
  { name: "녹사평", lat: 37.5345, lng: 126.9872, line: ["6"], popularity: 2 },
  { name: "한강진", lat: 37.5397, lng: 127.0010, line: ["6"], popularity: 2 },
  { name: "동묘앞", lat: 37.5722, lng: 127.0164, line: ["1", "6"], popularity: 3 },
  { name: "상수", lat: 37.5479, lng: 126.9228, line: ["6"], popularity: 3 },
  { name: "망원", lat: 37.5558, lng: 126.9103, line: ["6"], popularity: 3 },
  { name: "마포구청", lat: 37.5632, lng: 126.9018, line: ["6"], popularity: 2 },
  { name: "디지털미디어시티", lat: 37.5771, lng: 126.8997, line: ["6", "경의중앙", "공항"], popularity: 2 },
  { name: "연신내", lat: 37.6190, lng: 126.9212, line: ["3", "6"], popularity: 3 },
  { name: "불광", lat: 37.6104, lng: 126.9295, line: ["3", "6"], popularity: 2 },

  // 7호선
  { name: "강남구청", lat: 37.5173, lng: 127.0410, line: ["7", "분당"], popularity: 3 },
  { name: "학동", lat: 37.5145, lng: 127.0318, line: ["7"], popularity: 3 },
  { name: "논현", lat: 37.5115, lng: 127.0219, line: ["7"], popularity: 3 },
  { name: "반포", lat: 37.5083, lng: 127.0125, line: ["7"], popularity: 2 },
  { name: "내방", lat: 37.4883, lng: 126.9929, line: ["7"], popularity: 2 },
  { name: "이수", lat: 37.4856, lng: 126.9820, line: ["4", "7"], popularity: 3 },
  { name: "남성", lat: 37.4857, lng: 126.9730, line: ["7"], popularity: 2 },
  { name: "숭실대입구", lat: 37.4964, lng: 126.9540, line: ["7"], popularity: 2 },
  { name: "보라매", lat: 37.5013, lng: 126.9393, line: ["7"], popularity: 2 },
  { name: "중곡", lat: 37.5658, lng: 127.0843, line: ["7"], popularity: 2 },
  { name: "용마산", lat: 37.5732, lng: 127.0869, line: ["7"], popularity: 1 },
  { name: "면목", lat: 37.5798, lng: 127.0888, line: ["7"], popularity: 2 },
  { name: "상봉", lat: 37.5962, lng: 127.0855, line: ["7", "경의중앙"], popularity: 2 },
  { name: "태릉입구", lat: 37.6172, lng: 127.0755, line: ["6", "7"], popularity: 2 },

  // 8호선
  { name: "모란", lat: 37.4321, lng: 127.1296, line: ["8"], popularity: 3 },
  { name: "수진", lat: 37.4425, lng: 127.1374, line: ["8"], popularity: 1 },
  { name: "복정", lat: 37.4702, lng: 127.1268, line: ["8", "분당"], popularity: 2 },
  { name: "산성", lat: 37.4568, lng: 127.1508, line: ["8"], popularity: 1 },
  { name: "남한산성입구", lat: 37.4482, lng: 127.1571, line: ["8"], popularity: 1 },
  { name: "문정", lat: 37.4851, lng: 127.1226, line: ["8"], popularity: 3 },
  { name: "장지", lat: 37.4788, lng: 127.1264, line: ["8"], popularity: 2 },
  { name: "가락시장", lat: 37.4926, lng: 127.1183, line: ["3", "8"], popularity: 2 },
  { name: "석촌", lat: 37.5054, lng: 127.1073, line: ["8"], popularity: 3 },
  { name: "잠실", lat: 37.5132, lng: 127.1001, line: ["2", "8"], popularity: 5 },

  // 9호선
  { name: "신논현", lat: 37.5047, lng: 127.0252, line: ["9"], popularity: 4 },
  { name: "사평", lat: 37.5056, lng: 127.0139, line: ["9"], popularity: 2 },
  { name: "동작", lat: 37.5013, lng: 126.9517, line: ["4", "9"], popularity: 2 },
  { name: "노량진", lat: 37.5131, lng: 126.9427, line: ["1", "9"], popularity: 2 },
  { name: "샛강", lat: 37.5171, lng: 126.9316, line: ["9"], popularity: 1 },
  { name: "선유도", lat: 37.5331, lng: 126.8965, line: ["9"], popularity: 1 },
  { name: "가양", lat: 37.5614, lng: 126.8544, line: ["9"], popularity: 2 },
  { name: "염창", lat: 37.5466, lng: 126.8727, line: ["9"], popularity: 2 },
  { name: "등촌", lat: 37.5516, lng: 126.8631, line: ["9"], popularity: 2 },
  { name: "봉은사", lat: 37.5138, lng: 127.0587, line: ["9"], popularity: 2 },
  { name: "언주", lat: 37.5070, lng: 127.0345, line: ["9"], popularity: 2 },

  // 신분당선
  { name: "강남", lat: 37.4979, lng: 127.0276, line: ["2", "신분당"], popularity: 5 },
  { name: "판교", lat: 37.3948, lng: 127.1117, line: ["신분당"], popularity: 4 },
  { name: "정자", lat: 37.3684, lng: 127.1085, line: ["신분당", "분당"], popularity: 3 },
  { name: "미금", lat: 37.3508, lng: 127.1093, line: ["신분당", "분당"], popularity: 2 },
  { name: "동천", lat: 37.3348, lng: 127.1089, line: ["신분당"], popularity: 1 },
  { name: "광교", lat: 37.3012, lng: 127.0442, line: ["신분당"], popularity: 2 },

  // 분당선
  { name: "왕십리", lat: 37.5615, lng: 127.0370, line: ["2", "5", "경의중앙", "분당"], popularity: 3 },
  { name: "서울숲", lat: 37.5433, lng: 127.0446, line: ["분당"], popularity: 4 },
  { name: "압구정로데오", lat: 37.5275, lng: 127.0406, line: ["분당"], popularity: 4 },
  { name: "수서", lat: 37.4875, lng: 127.1018, line: ["3", "분당"], popularity: 3 },
  { name: "야탑", lat: 37.4114, lng: 127.1279, line: ["분당"], popularity: 2 },
  { name: "서현", lat: 37.3853, lng: 127.1232, line: ["분당"], popularity: 3 },
  { name: "수내", lat: 37.3782, lng: 127.1155, line: ["분당"], popularity: 2 },
  { name: "오리", lat: 37.3393, lng: 127.1098, line: ["분당"], popularity: 2 },
  { name: "죽전", lat: 37.3243, lng: 127.1075, line: ["분당"], popularity: 2 },

  // 경의중앙선 주요역
  { name: "수색", lat: 37.5832, lng: 126.8977, line: ["경의중앙"], popularity: 1 },
  { name: "망원", lat: 37.5558, lng: 126.9103, line: ["6", "경의중앙"], popularity: 3 },
  { name: "옥수", lat: 37.5404, lng: 127.0165, line: ["3", "경의중앙"], popularity: 2 },
  { name: "왕십리", lat: 37.5615, lng: 127.0370, line: ["2", "5", "경의중앙", "분당"], popularity: 3 },

  // 공항철도 주요역
  { name: "홍대입구", lat: 37.5571, lng: 126.9260, line: ["2", "경의중앙", "공항"], popularity: 5 },
  { name: "김포공항", lat: 37.5622, lng: 126.8013, line: ["5", "9", "공항"], popularity: 3 },
];

// 중복 제거 (이름 기준)
const seen = new Set<string>();
export const uniqueStations: Station[] = stations.filter(s => {
  if (seen.has(s.name)) return false;
  seen.add(s.name);
  return true;
});

// 역 이름으로 검색
export function searchStations(query: string): Station[] {
  if (!query.trim()) return [];
  const q = query.trim().toLowerCase();
  return uniqueStations
    .filter(s => s.name.toLowerCase().includes(q))
    .slice(0, 10);
}

// 역 이름으로 찾기
export function findStation(name: string): Station | undefined {
  return uniqueStations.find(s => s.name === name);
}
