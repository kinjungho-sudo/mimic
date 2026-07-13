# MIMIC 개발 환경 최종 이관 안내

작성일: 2026-07-13 KST  
원격 저장소: `https://github.com/kinjungho-sudo/mimic.git`

이 문서는 기존 Windows 개발 PC를 포맷한 뒤 Mac mini와 집의 Windows 데스크톱에서 MIMIC 개발을 재개하기 위한 최종 안내서다. 환경변수와 개인정보 파일은 별도 보관본에서 복원하고 GitHub에는 올리지 않는다.

## 1. 최종 기준점

| 용도 | 원격 브랜치 | 확인 커밋 |
|---|---|---|
| 운영 기준 | `origin/main` | `0a163cf` |
| 최신 개발 통합 | `origin/dev` | `d6b0158` |
| 첫 실행 온보딩 최신 작업 | `origin/backup/pc-move-20260713-onboarding` | `1569005` |
| Recorder 스토어 패키징 작업 | `origin/backup/pc-move-20260713-recorder-store` | `027de97` |
| API 텍스트 작업 | `origin/backup/pc-move-20260712-api-wip` | `0baab89` |
| Desktop Native Host 설치기 | `origin/backup/pc-move-20260712-desktop-wip` | `968d1b4` |
| Parro 리브랜딩 WIP | `origin/backup/pc-move-20260712-dev-wip` | `f8627f7` |
| Landing WIP | `origin/backup/pc-move-20260712-landing-wip` | `3954dea` |

전체 원격 브랜치는 다음 명령으로 확인한다.

```bash
git fetch origin --prune
git branch -r
```

백업 브랜치는 보존용이다. 새 기능 통합은 `origin/dev`에서 새 브랜치를 만든 뒤 필요한 백업 브랜치를 검토해 merge 또는 cherry-pick한다.

## 2. Mac mini 기본 설치

```bash
xcode-select --install
brew install git node@24
brew link --overwrite node@24
npm install -g vercel
```

저장소를 clone한다.

```bash
mkdir -p ~/Developer
cd ~/Developer
git clone https://github.com/kinjungho-sudo/mimic.git
cd mimic
git config core.autocrlf input
git fetch origin --prune
git fsck --full
```

`mimic_app` 의존성을 설치한다.

```bash
cd ~/Developer/mimic/mimic_app
export NODE_OPTIONS='--use-system-ca'
npm ci
```

별도로 옮긴 `.env.local`과 `.env.development.local`을 `mimic_app/`에 복사한다. `vercel env pull`은 기존 파일을 덮어쓸 수 있으므로 복사한 파일과 비교하기 전에는 실행하지 않는다.

```bash
vercel login
vercel link --repo
vercel whoami
```

Chrome에서 `chrome://extensions`를 열고 개발자 모드를 켠 뒤 `mimic_recorder/`를 압축 해제된 확장 프로그램으로 로드한다.

Windows PowerShell/레지스트리 기반 Desktop Native Host 설치기는 macOS에서 실행되지 않는다. macOS에서는 웹 앱과 Recorder 개발을 진행하고, Windows Native Host 실동작 검증은 Windows 데스크톱에서 수행한다.

## 3. Windows 데스크톱 기본 설치

관리자 PowerShell에서 필요한 도구를 설치한다.

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
npm i -g vercel
```

새 PowerShell을 열고 clone한다.

```powershell
New-Item -ItemType Directory -Path "$HOME\Developer" -Force
Set-Location "$HOME\Developer"
git clone https://github.com/kinjungho-sudo/mimic.git
Set-Location mimic
git config core.autocrlf true
git fetch origin --prune
git fsck --full
```

앱 의존성을 설치한다.

```powershell
Set-Location "$HOME\Developer\mimic\mimic_app"
$env:NODE_OPTIONS='--use-system-ca'
npm.cmd ci
```

별도로 옮긴 환경파일을 `mimic_app\`에 복사한다. Chrome Recorder는 `mimic_recorder\`를 압축 해제된 확장 프로그램으로 로드한다.

Desktop Native Host는 다음 백업 브랜치의 안내와 설치 스크립트를 사용한다.

```text
origin/backup/pc-move-20260712-desktop-wip
mimic_desktop/native-host/README.md
mimic_desktop/native-host/installer/install.ps1
```

## 4. 진행 중 작업을 worktree로 복원

기본 clone은 `main`으로 유지하고, 개발 통합과 진행 중 작업을 별도 폴더로 연다.

Mac mini:

```bash
cd ~/Developer/mimic
git worktree add -b local/dev ../mimic-dev origin/dev
git worktree add -b local/onboarding ../mimic-onboarding origin/backup/pc-move-20260713-onboarding
git worktree add -b local/recorder-store ../mimic-recorder-store origin/backup/pc-move-20260713-recorder-store
```

Windows 데스크톱:

```powershell
Set-Location "$HOME\Developer\mimic"
git worktree add -b local/dev ../mimic-dev origin/dev
git worktree add -b local/onboarding ../mimic-onboarding origin/backup/pc-move-20260713-onboarding
git worktree add -b local/recorder-store ../mimic-recorder-store origin/backup/pc-move-20260713-recorder-store
```

같은 로컬 브랜치 이름은 한 clone 안에서 한 번만 사용할 수 있다. 각 장비의 clone은 서로 독립적이므로 위 명령을 각각 실행해도 된다.

## 5. 과거 stash 복원

stash 3개는 GitHub 백업 브랜치로 보존되어 있다. 필요한 장비 한 곳에서만 등록한다.

```bash
git stash store -m "PC migration: recorder sidepanel" origin/backup/pc-move-20260712-stash-recorder-sidepanel
git stash store -m "PC migration: guide toc" origin/backup/pc-move-20260712-stash-guide-toc
git stash store -m "PC migration: collaboration wip" origin/backup/pc-move-20260712-stash-collaboration-wip
git stash list
```

적용 전에 반드시 내용을 확인한다.

```bash
git stash show --stat 'stash@{0}'
```

## 6. 두 장비에서 동시에 개발할 때의 규칙

Mac mini와 Windows 데스크톱에서 같은 브랜치를 동시에 수정하지 않는다.

- Mac 작업 브랜치 예: `device/mac-editor`
- Windows 작업 브랜치 예: `device/windows-recorder`
- 다른 장비로 이동하기 전에 반드시 commit과 push를 완료한다.
- 작업을 시작할 때 `git fetch origin --prune`을 먼저 실행한다.
- feature 브랜치는 최신 `origin/dev`를 반영한 뒤 작업한다.
- 통합 흐름은 `feat/* -> dev -> main`을 유지한다.
- `.env*`, `.vercel/`, 인증서, 토큰은 Git에 추가하지 않는다.

장비를 바꿔 이어서 작업할 때:

```bash
git fetch origin --prune
git switch <branch-name>
git pull --rebase
```

## 7. 복원 완료 판정

각 장비에서 다음을 확인한다.

```bash
git remote -v
git branch -r
git fsck --full
git status
node --version
npm --version
vercel --version
```

추가 확인 항목:

1. `mimic_app`에서 `npm ci`가 성공한다.
2. 개발 환경변수를 복사한 뒤 앱이 실행된다.
3. Chrome이 `mimic_recorder`를 정상 로드한다.
4. Windows에서는 Desktop Native Host 설치와 연결을 확인한다.
5. `origin/dev`, 온보딩 백업, Recorder 스토어 백업 브랜치가 보인다.

## 8. 보안 메모

과거 로컬 히스토리에는 `mimic_recorder/.env`가 추적된 적이 있다. GitHub에는 해당 파일을 제거한 `backup/pc-move-20260712-pre-reword` 정제 브랜치가 보존되어 있다. 별도 이전한 키와 토큰은 새 장비 복원 후 교체 여부를 확인한다.
