@AGENTS.md

# 현재 작업 상태 (대화 이어받기용)

## 프로젝트 개요
- 만나spot: 여러 사람의 중간 지하철역 추천 앱 (Next.js 16, Vercel 배포)
- 운영 URL: https://meetspot-chi.vercel.app
- 개발 URL: https://meetspot-9qcz2f5bv-charles-mshs-projects.vercel.app
- GitHub: https://github.com/charles-msh/meetspot (main=운영, dev=개발)

## 환경변수 (.env.local 및 Vercel에 설정됨)
- NAVER_CLIENT_ID / NAVER_CLIENT_SECRET → 장소 검색 (Step4)
- ODSAY_API_KEY → 지하철 소요시간 (ODsay Basic, 1000건/일)
- KV_REST_API_URL / KV_REST_API_TOKEN 등 → Upstash Redis 캐시

## 완료된 작업
- [x] GitHub + Vercel 배포 (main/dev 브랜치 분리)
- [x] Upstash Redis 캐시 연동 (/api/transit 결과 7일 캐시)
- [x] ODsay 소요시간 수정 (Referer 헤더 누락이 원인이었음)
- [x] 노선 컬러 배지 공용화 (src/lib/lineColors.ts)
- [x] Step2 역 검색 결과에 컬러 배지 추가

## 미완료 작업 (다음에 이어서)
- [ ] KRIC API 전국 역 데이터 통합
  - API URL: https://openapi.kric.go.kr/openapi/convenientInfo/stationInfo
  - 서비스 키: 사용자에게 재확인 필요 (현재 키가 "등록되지 않은 서비스키" 오류 발생)
  - 목적: 현재 stations.ts의 수동 데이터(~100개) → 전국 모든 역으로 확대
  - 길음역 등 누락된 역 검색 가능하게
  - 환승역 정보 포함

## 주요 파일 구조
- src/data/stations.ts → 현재 역 데이터 (수도권 약 100개, 하드코딩)
- src/components/StationSearch.tsx → 역 검색 컴포넌트
- src/components/steps/Step3Result.tsx → 추천역 결과 + 소요시간
- src/app/api/transit/route.ts → ODsay API + Upstash 캐시
- src/app/api/search/route.ts → Naver 장소 검색
- src/lib/lineColors.ts → 노선 컬러 배지 공용 유틸
- src/lib/midpoint.ts → 중간 지점 계산 로직
