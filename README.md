# 경기 초등 전보맵 (Find My School)

경기도 공립 초등학교의 **인사구역(갑/을/병)** 과 거주지 기준 **자동차·대중교통** 이동 시간을 비교하는 웹앱입니다.

## 기능

- 시·군·급지 필터로 학교 목록/지도 표시
- 거주지 주소 검색 또는 지도 클릭으로 출발지 지정
- 가까운 학교(최대 15곳)에 대해 자동차·대중교통 소요시간 조회
- 학교 상세: 급지, 주소, 홈페이지, (선택) 학급·학생 수

## 데이터 출처

| 항목 | 출처 |
|------|------|
| 급지 | 2027 경기도교육공무원인사관리세부기준 별표1 |
| 좌표 | OpenStreetMap (동기화 시 카카오 지오코딩으로 보강 가능) |
| 학교 기본정보 | 선택: NEIS / 학교알리미 |
| 경로 | 카카오모빌리티(자동차), 카카오맵 경로조회(대중교통) |

## 로컬 실행

```bash
cp .env.example .env.local
# NEXT_PUBLIC_KAKAO_JS_KEY, KAKAO_REST_KEY 입력

npm install
npm run dev
```

카카오 개발자 콘솔에서:

1. 앱 생성 후 **JavaScript 키** / **REST API 키** 발급
2. 플랫폼 → Web 도메인에 `http://localhost:3000` 등록
3. 카카오맵 / 카카오모빌리티(길찾기) 사용 설정 활성화

## 데이터 갱신

```bash
# HWPX에서 급지 JSON 재생성
python3 scripts/parse-zones.py --hwpx "/path/to/기준.hwpx" --out data/gyeonggi-zones-2027.json

# 학교 마스터(좌표 매칭) 재생성
# 선택: NEIS_API_KEY, KAKAO_REST_KEY
python3 scripts/sync-schools.py --zones data/gyeonggi-zones-2027.json --out data/schools.json
```

## Render 배포

`render.yaml` 블루프린트를 사용하거나 Web Service를 직접 생성합니다.

- Build: `npm install && npm run build`
- Start: `npm run start` (`0.0.0.0:$PORT`)
- 환경변수: `NEXT_PUBLIC_KAKAO_JS_KEY`, `KAKAO_REST_KEY`, (선택) `SCHOOLINFO_API_KEY`
- 카카오 콘솔 Web 도메인에 Render URL 등록

## 참고

- 도보·자전거 경로는 제공하지 않습니다.
- 경로 API 쿼터 보호를 위해 목록 전체 일괄 조회 대신 **「경로 조회」** 버튼으로 상위 15개만 요청합니다.
- OSM에 없는 학교는 목록에는 보이지만 지도 마커/경로가 없을 수 있습니다. `sync-schools.py`에 카카오 키를 넣고 재실행하면 보강됩니다.
