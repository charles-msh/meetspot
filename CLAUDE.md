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

## 최근 완료 작업 (2025-05-06)

### 브릿지 오버레이 실시간 진행률 UI (커밋: 7a8790b)
- Step3(추천역) → Step4(장소목록) 전환 시 로딩 오버레이를 step2→step3와 동일한 패턴으로 개선
- prefetchingPlaces 상태 제거 → bridgeProgress { phase, current, total } 상태로 교체
- API 단계(0→60%): 필터별 완료 시마다 진행률 업데이트, UtensilsCrossed 아이콘
- 이미지 단계(60→100%): 이미지 로드 완료 시마다 진행률 업데이트, ImageIcon 아이콘
- src/app/page.tsx 수정

### 이미지 기본 이미지 노출 버그 수정 (커밋: 52da6c0)
- **근본 원인**: Vision API 쿼터 1170/950 초과 → fallback → 원본 URL hotlink 차단 → 이미지 실패
- **조치 1**: Redis에서 `quota:vision:2026-05` 키 삭제(리셋) → Vision API 재활성화
- **조치 2**: 이미지 URL 저장 방식 변경: 원본 URL 추출 제거 → 네이버 CDN URL 그대로 저장
- **조치 3**: 이미지 없는 업체도 1시간 TTL 캐시 저장 → Vision API 중복 소모 방지
- **조치 4**: 캐시 키 v3 → v4 (기존 잘못된 원본 URL 캐시 자동 무효화)
- **조치 5**: getGooglePhotoUrl dead code 제거, Places API quota 로직 제거
- src/app/api/search/route.ts 수정

## 다음 작업 (미완료)
- [ ] dev에서 이미지 정상 노출 확인 후 main merge (운영 배포)
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
- src/app/api/search/route.ts → 카카오 장소 검색 + Naver 이미지 + Vision API 필터링
- src/lib/lineColors.tsx → 노선 컬러 배지 공용 유틸 (공식 HEX 색상)
- src/lib/midpoint.ts → 중간 지점 계산 로직
- src/app/page.tsx → 전체 스텝 흐름 + 브릿지 오버레이

## 기술 메모
- ODsay API는 Referer 헤더로 도메인 인증함 → 서버에서 호출 시 반드시 Referer 추가 필요
- KRIC stationInfo API는 역명 검색 불가, 역코드 3개(railOprIsttCd+lnCd+stinCd) 조합 필요
- Tailwind에서 동적 HEX 색상은 bg-[#HEX] 형식 사용
- 이미지 캐시 키: v4:img:{역명}:{업체명} (v4 = CDN URL 저장 버전)
- Vision API 쿼터: quota:vision:YYYY-MM (Redis, 월 950건 한도)
- 네이버 CDN URL(search.pstatic.net)은 브라우저에서 직접 접근 가능, 외부 원본 URL은 hotlink 차단 많음
