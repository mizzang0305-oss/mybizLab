# Vertical Template Policy

## Rule

MyBiz는 업종별 애플리케이션을 복제하지 않는다.

```text
ONE SERVICE OS ENGINE
        ↓
VerticalTemplate
        ↓
industry-specific fields / workflow / copy
```

공통 고객, 작업, 증빙, 확인, 대금, 동의, 콘텐츠 도메인을 fork하지 않는다. 업종 차이는 template ID, custom fields, 단계·문구, 선택 모듈로 표현한다.

## Availability

| Group | Verticals | Default |
| --- | --- | --- |
| Public V1 | cleaning, hair, installation | enabled |
| Expansion | wig, interior | template only |
| Regulated | medical | `medical_vertical_enabled=false` |
| Legacy optional | restaurant | preserved, not default core |

의료 공개는 일반 동의만으로 허용되지 않으며 medical enablement와 regulated review가 함께 필요하다.
