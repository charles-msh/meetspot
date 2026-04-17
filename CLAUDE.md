@AGENTS.md

# 현재 작업 상태 (대화 이어받기용)

## 프로젝트 개요
- 만나spot: 여러 사람의 중간 지하철역 추천 앱 (Next.js 16, Vercel 배포)
- 운영 URL: https://meetspot-chi.vercel.app
- 개발 URL: https://meetspot-git-dev-charles-mshs-projects.vercel.app
- GitHub: https://github.com/charles-msh/meetspot

## 브랜치 운영 규칙
- `dev` 브랜치에서 작업 → 개발 URL에서 확인 → 문제 없으면 `main`에 merge → 운영 자동 배포
- dev/main 모두 push 시 Vercel 자동 배포됨

## 환경변수 (.env.local 및 Vercel에 설정됨)
- NAVER_CLIENT_ID / NAVER_CLIENT_SECRET → 장소 검색 (Step4)
- ODSAY_API_KEY=QhCryWciknzq0wmjGl6Uzw → 지하철 소요시간 (ODsay Basic, 1000건/일, 활성화 상태)
- KRIC API 서비스 키: $2a$10$KtaiKy3rQXkqmFIV1yhux.gR4RlEYlyaNtnWTZiZnJQZSPBnqbhF6 (역사별 정보 API)
- KV_REST_API_URL / KV_REST_API_TOKEN 등 → Upstash Redis 캐시 (Vercel KV 대체)

## 완료된 작업
- [x] GitHub + Vercel 배포 (main=운영, dev=개발 브랜치 분리)
- [x] Upstash Redis 캐시 연동 (/api/transit 결과 7일 캐시)
- [x] ODsay 소요시간 수정 (Referer 헤더 누락이 원인 → 수정 완료)
- [x] 노선 컬러 배지 공용화 (src/lib/lineColors.tsx)
- [x] Step2 역 검색 결과에 컬러 배지 추가
- [x] 지하철 노선 색상을 실제 공식 HEX 코드로 교체 (수도권/부산/대구/광주/대전)
- [x] dev 브랜치 고정 URL 확인 (자동 생성됨)

## 완료된 UI/UX 개선 (오늘)
- [x] 역 선택 완료 피드백 (체크 아이콘 + 초록 테두리)
- [x] 소요시간 맥락 표시 ("최단 X분 · 최장 Y분")
- [x] 역 검색 결과 없음 안내
- [x] "처음부터 다시" 버튼 약화 (텍스트 링크로)
- [x] 필터 스크롤 힌트 (페이드 아웃)

## 다음 작업 (미완료)
- [ ] 전국 역 데이터 통합
  - 현재: src/data/stations.ts에 수도권 약 100개 역만 하드코딩
  - 목표: 전국 모든 역 검색 가능하게 (길음역 등 누락된 역 포함)
  - 결정된 방향: KRIC XLSX 파일 다운로드 → 변환 스크립트로 stations.ts 업데이트
  - KRIC 역사정보 파일: https://data.kric.go.kr/rips/M_01_01/detail.do?id=32 (전체기관)
  - KRIC stationInfo API로 각 역의 정확한 좌표 조회 (railOprIsttCd+lnCd+stinCd 필요)
  - 작업 순서: 사용자가 XLSX 다운로드 → 제가 변환 스크립트 작성 → stations.ts 재생성

## 주요 파일 구조
- src/data/stations.ts → 현재 역 데이터 (수도권 약 100개, 하드코딩)
- src/components/StationSearch.tsx → 역 검색 컴포넌트 (로컬 검색)
- src/components/steps/Step3Result.tsx → 추천역 결과 + 소요시간
- src/app/api/transit/route.ts → ODsay API + Upstash 캐시 + Referer 헤더
- src/app/api/search/route.ts → Naver 장소 검색
- src/lib/lineColors.tsx → 노선 컬러 배지 공용 유틸 (공식 HEX 색상)
- src/lib/midpoint.ts → 중간 지점 계산 로직

## 기술 메모
- ODsay API는 Referer 헤더로 도메인 인증함 → 서버에서 호출 시 반드시 Referer 추가 필요
- KRIC stationInfo API는 역명 검색 불가, 역코드 3개(railOprIsttCd+lnCd+stinCd) 조합 필요
- Tailwind에서 동적 HEX 색상은 bg-[#HEX] 형식 사용
