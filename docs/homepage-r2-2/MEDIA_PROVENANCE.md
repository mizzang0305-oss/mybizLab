# Media provenance

원본은 빌드/런타임에 포함하지 않는다. 아래 공개 원본에서 FFmpeg로 필요한 구간만 변환한 파생본을 `public/media/mybiz-stage2/`에 둔다. 해시와 크기는 `manifest.json`을 기준으로 한다.

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

## 제한

권리와 출처를 우선한 대표 장면이다. 청소는 소파/의자, 미용은 연습 모델, 설치는 작업대 목재 가공이며 실제 고객 프로젝트나 완공 증명으로 사용하지 않는다.
