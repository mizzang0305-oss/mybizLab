# MyBiz Stage 2 R2.2 Cinematic Homepage

R2.1의 서비스 운영 흐름을 바꾸지 않고, 공개 홈페이지에서 청소·미용실·설치·수리의 작업 장면과 전후 기록을 실제 재생 가능한 영상으로 설명하는 프런트엔드 전용 변경이다.

## 범위

- 하나의 `activeIndustry`가 Hero, 전후 비교, 확인 시연, 홈페이지 패키지를 동기화한다.
- 영상은 저장소에 포함된 권리 명시 파생본만 재생한다.
- 확인·동의·업체 검토는 브라우저 메모리의 시연 상태이며 서버에 저장되지 않는다.
- Production 배포, DB/RLS/migration, 결제, 서명, 외부 게시 기능은 변경하지 않는다.

## 문서

- [DESIGN_SPEC.md](./DESIGN_SPEC.md)
- [COPY_KO.md](./COPY_KO.md)
- [HERO_STORYBOARDS.md](./HERO_STORYBOARDS.md)
- [MEDIA_PROVENANCE.md](./MEDIA_PROVENANCE.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [HANDOVER.md](./HANDOVER.md)
