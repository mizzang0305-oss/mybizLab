# Media provenance

영상 원본은 빌드/런타임에 포함하지 않는다. 아래 공개 원본에서 FFmpeg로 필요한 구간만 변환한 파생본을 `public/media/mybiz-stage2/`에 둔다. 해시와 크기는 `manifest.json`을 기준으로 한다.

| ID | 원본·저작자 | 라이선스 | 화면상 고지 |
| --- | --- | --- | --- |
| cleaning | [Sofa cleaning.webm](https://commons.wikimedia.org/wiki/File:Sofa_cleaning.webm), GolhaMedia | CC BY-SA 4.0 | 연출 영상, 실제 고객 아님 |
| hair | [Haircut practice - Tokyo area](https://commons.wikimedia.org/wiki/File:Haircut_practice_-_Tokyo_area_-_2013_1_30.webm), Tokyo | CC BY 4.0 | 연습 모델, 실제 고객 아님 |
| installation | [Carpentry 03.ogv](https://commons.wikimedia.org/wiki/File:Carpentry_03.ogv), Mostafameraji | CC BY-SA 4.0 | 목공 준비 장면, 실제 고객 아님 |

## 파생 규격

- desktop: H.264 MP4, 960×540, 24fps, 12s, audio 없음, fast-start.
- mobile: H.264 MP4, 480×600, 24fps, 12s, audio 없음, fast-start.
- poster/before/after/thumbnail: WebP.
- 원본 SHA-256과 주요 파생본 SHA-256은 `public/media/mybiz-stage2/manifest.json`에 고정한다.

## 업종 정합성 보강 이미지 (R2.2 visual alignment)

사용자 레이아웃 리뷰에 따라 카드와 전후 비교는 Built-in Image Generation으로 새로 제작했다. 모두 실제 고객 사례가 아닌 업종 설명용 연출 예시이며 화면에도 동일하게 고지한다.

| 화면 | 장면 | 생성 제약 |
| --- | --- | --- |
| 청소 | 같은 욕실 세면대의 물때 제거 전/후 | 동일 구도·동일 공간, 청소 상태만 변경 |
| 미용실 | 같은 성인 고객의 긴 머리/레이어드 보브 | 뒷모습, 얼굴 비식별, 헤어 상태만 변경 |
| 설치·수리 | 같은 거실 벽의 선반 설치 전/후 | 동일 벽·동일 구도, 설치 상태만 변경 |
| 가발·두피 | 성인 고객의 맞춤 가발 피팅 | 얼굴 비식별, 실제 피팅 업무가 보이는 구도 |
| 인테리어·확장 | 완공 직전 공간의 마감 실측 | 실측 도구와 작업자가 보이는 구도 |

- 원본 생성 파일은 Codex 생성 이미지 보관소에 유지하고, 프로젝트에는 WebP 최적화본만 복사했다.
- 생성 이미지에는 로고·문자·워터마크·실제 업체명·실제 고객 정보가 없다.
- 사용 프롬프트는 동일 대상 정렬, 업종 식별성, 얼굴 비식별, 허위 텍스트 금지를 공통 제약으로 사용했다.

## 제한

영상은 권리와 출처를 우선한 공정 참고 장면이고, 정적 이미지는 업종 정합성을 위해 생성한 연출 예시다. 어느 쪽도 실제 고객 프로젝트, 완공 증명, 성과 수치로 사용하지 않는다.
