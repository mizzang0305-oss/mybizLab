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

| 업종 | pairId | Before / After | sourceType / 권리 상태 | 용도·제약 |
| --- | --- | --- | --- | --- |
| 청소 | `cleaning-sofa-generated-v3` | `cleaning-sofa-before-v3.webp` / `cleaning-sofa-after-v3.webp` | `ai-generated-staged-image`; synthetic=true; actualCustomer=false; project use approved | 동일 소파·공간·카메라, 청결 상태만 변경. 영상의 소파 패브릭 클리닝 공정과 Job copy를 일치시킴. |
| 미용실 | `hair-bob-generated-v3` | `hair-before.webp` / `hair-after.webp` | `ai-generated-staged-image`; synthetic=true; actualCustomer=false; project use approved | 같은 성인 모델의 뒷모습, 얼굴 비식별, 헤어 길이와 스타일만 변경. |
| 설치·수리 | `installation-shelf-generated-v3` | `installation-before.webp` / `installation-after.webp` | `ai-generated-staged-image`; synthetic=true; actualCustomer=false; project use approved | 동일 벽·구도, 맞춤 선반 제작·설치 결과만 변경. |
| 가발·두피 | `wig-fitting-generated-v1` | `wig-before-v1.webp` / `wig-after-v1.webp` | `ai-generated-staged-image`; synthetic=true; actualCustomer=false; medicalClaim=false; project use approved | 동일 성인 모델·의상·장소·카메라. 치료·발모가 아닌 부분가발 피팅 전후. |
| 인테리어 | `interior-livingroom-generated-v1` | `interior-before-v1.webp` / `interior-after-v1.webp` | `ai-generated-staged-image`; synthetic=true; actualCustomer=false; actualProject=false; project use approved | 동일 창문·문·방 구조·카메라. 마감·조명·가구 스타일만 변경. |

모든 pair는 `sameSubject=true`, `sameLocation=true`, `sameCamera=true`, `sameStructure=true`로 육안 검수했다. 최종 WebP의 SHA-256과 byte size는 `public/media/mybiz-stage2/manifest.json`의 `visual_examples`에 고정한다.

- 원본 생성 파일은 Codex 생성 이미지 보관소에 유지하고, 프로젝트에는 WebP 최적화본만 복사했다.
- 생성 이미지에는 로고·문자·워터마크·실제 업체명·실제 고객 정보가 없다.
- 사용 프롬프트는 동일 대상 정렬, 업종 식별성, 얼굴 비식별, 허위 텍스트 금지를 공통 제약으로 사용했다. 이번 최종 보강은 Built-in Image Generation으로 `cleaning sofa`, `wig fitting`, `interior living room` 3개 diptych를 생성한 뒤 좌우를 독립 WebP로 최적화했다.

## 제한

영상은 권리와 출처를 우선한 공정 참고 장면이고, 정적 이미지는 업종 정합성을 위해 생성한 연출 예시다. 어느 쪽도 실제 고객 프로젝트, 완공 증명, 성과 수치로 사용하지 않는다. 가발·인테리어는 적합한 무비용 전용 영상이 없어 `VIDEO_STATUS=NOT_AVAILABLE_YET`이며 다른 업종 영상을 재사용하지 않는다.
