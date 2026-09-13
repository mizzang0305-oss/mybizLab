# Design spec

## 기존 문제와 참고 시안 해석

기존 페이지는 운영 흐름은 정확했지만 첫 화면이 합성 도해 중심이라 업종별 실제 작업감과 제품 가치 연결이 약했다. 제공된 시안에서 채택한 것은 어두운 Hero, 좌측의 강한 카피, 우측의 작업 장면, 아래의 업종/Before-After/브랜드 흐름이다. 확인되지 않은 가격·고객 수·후기·서명 이미지는 채택하지 않았다.

정보 구조는 `Hero → 업종 선택 → Before/After와 확인 → 홈페이지 옵션 → 업무 기록 원칙 → FAQ/CTA`다.

## 방향

- Tone: deep navy `#0b111a`, ivory `#f6f2ea`, warm gold `#e6b06b`.
- Desktop Hero: copy 44%, video 56%; H1 최대 88px.
- Mobile Hero: copy → CTA → 480×600 video.
- Breakpoints: 360/390/430은 단일 열, 768/1024는 넓은 단일 열과 제한적 2열, 1440은 44:56 Hero와 2열 경험.
- 업종 선택은 핵심 3개만 ARIA tabs로 제공한다. 가발·인테리어는 비활성 확장 안내다.
- 반복 카드 대신 큰 장면, 경계선, 정보 밀도 차이를 사용한다.

## Interaction

- `activeIndustry`: `cleaning | hair | installation` 단일 상태.
- 업종 전환 시 video source, poster, chapter copy, Before/After, 업체명, 홈페이지 Preview가 함께 바뀐다.
- 확인·동의·업체 검토는 업종 또는 revision 변경 시 초기화한다.
- Before/After는 같은 좌표의 두 프레임을 `clip-path`로 비교한다.

## 접근성·영상 정책

- muted, `playsInline`, loop, poster, 명시적 pause/play를 제공한다.
- `prefers-reduced-motion`, Save-Data, 비가시 영역, background tab, modal open에서는 자동 재생하지 않는다.
- 자동 재생 거부/오류 시 poster와 수동 재생 경로를 유지한다.
- tablist는 roving `tabIndex`, Arrow/Home/End 키를 지원한다.
