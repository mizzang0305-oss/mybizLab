# R2.2 handover

## 상태

- Base: R2.1 branch `codex/mybiz-stage2-r2-hardening`.
- R2.2: stacked branch `codex/mybiz-stage2-r2-2-cinematic-home`.
- Homepage state owner: `MyBizFieldLandingPage`.
- Runtime media registry: `media/mediaManifest.ts`.
- Media provenance registry: `public/media/mybiz-stage2/manifest.json`.

## 운영 경계

- R2.2는 public homepage presentation과 in-memory demo interaction만 변경한다.
- 고객 확인·동의·업체 검토는 실제 레코드가 아니다.
- R2.1 DB/RLS certification과 migration promotion 상태를 변경하지 않는다.
- human Preview approval은 자동 테스트와 별도다.

## 롤백

R2.2 commit/PR을 revert하거나 stacked branch를 폐기한다. DB/Production rollback은 필요하지 않다.

## 다음 단계

Owner가 실제 Preview에서 영상 품질, 모바일 첫 화면, copy hierarchy, 업종 전환의 일관성을 확인한다. 승인 전에는 base branch 또는 main에 merge하지 않는다.

핵심 3업종 필수 미디어는 모두 확보됐다. 가발·인테리어 전용 영상만 확장 예정이며 이번 완료 조건에는 포함되지 않는다.

```powershell
gh pr view 176 --repo mizzang0305-oss/mybizLab --web
```
