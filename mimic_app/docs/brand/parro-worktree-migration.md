# Parro Worktree Migration

## 목적

향후 모든 기능 개발을 최신 Parro `origin/dev`에서 시작하고, 기능 개발과 배포 경로를 분리한다. `main`, Production DB, Supabase 설정은 이 절차의 대상이 아니다.

## 고정 규칙

1. 작업 시작 전에 `git fetch origin dev`를 실행한다.
2. 새 기능 브랜치는 최신 `origin/dev`에서 `feat/parro-*` 이름으로 만든다.
3. `216c35fb6b0783524bc21f1600907524b5c06979`가 조상이 아니거나 최신 `origin/dev`가 조상이 아니면 작업을 중단한다.
4. 기능 worktree에는 `.vercel` 링크를 두지 않는다.
5. 수동 배포는 `mimic-parro-deploy` 한 곳에서만 허용하며 `.vercel/project.json`의 `projectName`은 반드시 `parro-guide`여야 한다.
6. feat 완료 후 Production에 직접 배포하지 않는다. 검증된 변경만 `dev` 통합 게이트를 거친다.
7. `main` 병합과 Production 배포는 별도 명시적 승인 없이는 수행하지 않는다.

작업 시작 및 배포 전 guard:

```powershell
.\scripts\assert-parro-worktree.ps1
.\scripts\assert-parro-worktree.ps1 -Deployment
```

## 2026-07-12 이전 매핑

| 기존 보존 브랜치 | 새 Parro 브랜치 | 처리 |
|---|---|---|
| `backup/pc-move-20260712-landing-wip` | `feat/parro-landing` | `3954dead` 기능 diff 이전 |
| `backup/pc-move-20260712-api-wip` | `feat/parro-api` | 수동 텍스트 자동완성 diff 이전 |
| `feat/editor` | `feat/parro-editor` | Live Target Picker만 현재 Studio 구조에 맞춰 이전 |
| `feat/recorder`, 로컬 dev `3f77832` | `feat/parro-recorder` | Parro dev extension 연결 이전 |

기존 브랜치와 worktree는 삭제하지 않는다. API export는 최신 Parro export와 의미 충돌해 자동 cherry-pick하지 않는다. Editor에서는 Live Target Picker만 이전하고, 구 스타일 설문은 보류했으며 이미 최신 dev에서 발전된 민감 입력 로직은 다시 옮기지 않았다.

## Vercel 상태

- `parro-guide`: GitHub `mimic`, root `mimic_app`, Production Branch `main`
- `parro-guide-dev.vercel.app`: `dev` Preview
- `mimic`: Git 연결 해제 상태 유지
- 로컬 Vercel 링크: `mimic-parro-deploy/.vercel/project.json`의 `parro-guide`만 유지

## 통합 전 검증

- `git merge-base --is-ancestor origin/dev HEAD`
- `git diff --check origin/dev...HEAD`
- 앱 변경: `npm run lint`, `$env:NODE_OPTIONS='--use-system-ca'; npm run build`
- Recorder 변경: 영향받는 JavaScript `node --check`
- 이전 전후 기능 patch 또는 기능별 assertion 비교
