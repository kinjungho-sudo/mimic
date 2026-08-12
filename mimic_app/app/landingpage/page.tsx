import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  BookMarked,
  BookOpenCheck,
  Check,
  CircleHelp,
  FileText,
  FolderKanban,
  Hand,
  Link2,
  MousePointer2,
  Play,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/common/BrandMark";
import {
  HeroRecordingDemo,
  ProductDemo,
} from "@/components/landing/ProductDemo";
import styles from "./page.module.css";

const EDU_ROUTES = {
  landing: "/landingpage",
  instructor: "https://parro-edu-dev.vercel.app/edu/instructor",
  join: "https://parro-edu-dev.vercel.app/edu/join",
} as const;

const educationUses = [
  ["기업 SOP · 직무교육", "업무 절차를 화면으로 실습"],
  ["신규 직원 온보딩", "입사 첫날부터 바로 따라하기"],
  ["AI배움터 · 시니어 교육", "낯선 디지털 도구도 끝까지 완주"],
  ["대학 · KDT · 교육기관", "개발·데이터·AI 실습을 그대로 반복"],
];

const capabilities = [
  ["녹화", "클릭과 화면을 자동 기록"],
  ["AI 초안", "행동별 단계로 자동 정리"],
  ["편집", "설명과 강조를 빠르게 보강"],
  ["공유", "링크 하나로 바로 학습"],
  ["내보내기", "PDF·PPTX·Word로 배포"],
  ["직접 실습", "실제 화면에서 바로 실행"],
];

export default function EduLandingPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <header className={styles.header}>
          <Link
            className={styles.brand}
            href={EDU_ROUTES.landing}
            aria-label="Parro EDU 홈"
          >
            <BrandMark size={34} />
            <strong>Parro</strong>
            <span>EDU</span>
          </Link>
          <nav aria-label="주요 메뉴">
            <a href="#experience">제품 체험</a>
            <a href="#workflow">작동 방식</a>
            <a href="#use-cases">교육 활용</a>
            <a href="#instructor">강사용 기능</a>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/auth/login">로그인</Link>
            <Link className={styles.headerCta} href="/auth/login">
              무료로 시작 <ArrowRight size={14} />
            </Link>
          </div>
        </header>

        <div className={styles.heroCircle} />
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <i />
              AI HANDS-ON LEARNING
            </div>
            <h1>
              보여주고
              <br />
              따라하고
              <br />
              <em>해내는 수업</em>
            </h1>
            <p>
              한 번 시연하면 AI가 실습 가이드로 완성합니다
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryCta} href="/auth/login">
                <Play size={15} fill="currentColor" />첫 가이드 만들기
              </Link>
              <a className={styles.textCta} href="#experience">
                실제 흐름 보기 <ArrowDownRight size={16} />
              </a>
            </div>
          </div>

          <div className={styles.heroArt}>
            <div className={styles.heroProductCard}>
              <span>오늘의 실습</span>
              <strong>Canva로 발표자료 만들기</strong>
              <div className={styles.heroSteps}>
                <span>
                  <i>1</i>템플릿 선택하기 <Check size={13} />
                </span>
                <span>
                  <i>2</i>발표 제목 수정하기 <Check size={13} />
                </span>
                <span data-active>
                  <i>3</i>공유 링크 복사하기 <MousePointer2 size={13} />
                </span>
              </div>
            </div>
            <Image
              className={styles.heroMascot}
              src="/brand/parro-edu-hero-v2.png"
              alt="실습 가이드를 안내하는 Parro EDU 마스코트"
              width={1310}
              height={1201}
              priority
            />
            <p>
              강사의 시연을
              <br />
              <strong>AI 실습 가이드로!</strong>
            </p>
          </div>
        </div>
      </section>

      <section className={styles.promiseBar} aria-label="Parro EDU 핵심 흐름">
        <span>01</span>
        <strong>기록</strong>
        <i />
        <span>02</span>
        <strong>AI 편집</strong>
        <i />
        <span>03</span>
        <strong>링크 공유</strong>
        <i />
        <span>04</span>
        <strong>직접 실습</strong>
      </section>

      <section className={styles.experience} id="experience">
        <div className={styles.darkHeading}>
          <span>THE REAL PARRO FLOW</span>
          <h2>
            설명보다 빠른
            <br />
            <em>실제 제품 체험</em>
          </h2>
          <p>기록부터 실제 화면 안내까지 직접 확인하세요</p>
        </div>
        <div className={styles.realDemo}>
          <HeroRecordingDemo variant="education" />
        </div>
      </section>

      <section className={styles.workflow} id="workflow">
        <div className={styles.workflowIntro}>
          <span>ONE RECORDING, A COMPLETE LESSON</span>
          <h2>
            한 번 녹화하고
            <br />
            수업으로 완성
          </h2>
          <p>AI 편집부터 공유까지 하나의 흐름으로</p>
        </div>
        <div className={styles.productDemoWrap}>
          <ProductDemo variant="education" />
        </div>
      </section>

      <section className={styles.featureShowcase}>
        <header className={styles.featureShowcaseHeading}>
          <span>PARRO EDU IN ACTION</span>
          <h2>기능마다 실제 화면으로</h2>
          <p>만들고 연습하고 지원하는 전체 흐름</p>
        </header>

        <article className={styles.featureCard} data-tone="practice">
          <div className={styles.featureCopy}>
            <span>01 · PRACTICE</span>
            <h3>연습하기</h3>
            <p>가이드 문서 위에서 실제처럼 반복 학습</p>
            <ul>
              <li><Check size={14} />단계별 화면 확대</li>
              <li><Check size={14} />클릭 지점 집중 안내</li>
              <li><Check size={14} />완료까지 반복 실행</li>
            </ul>
          </div>
          <div className={styles.practiceViewer}>
            <div className={styles.mockBrowserBar}><i /><i /><i /><span>Canva로 수업 발표자료 만들기</span></div>
            <div className={styles.practiceScreen}>
              <Image src="/edu/demo/canva-presentation-step-03.png" alt="Parro 연습하기 학습 화면" fill sizes="(max-width: 900px) 100vw, 760px" />
              <div className={styles.practiceDim} />
              <div className={styles.practiceFocus}><span>공유</span></div>
              <div className={styles.practiceCoach}>
                <span>3</span>
                <p><strong>공유 링크를 복사하세요</strong>발표자료를 학습자에게 공유합니다</p>
                <Image src="/brand/parro-3d-talk.png" alt="안내하는 Parro" width={72} height={72} />
              </div>
              <div className={styles.practiceControls}><small>3 / 3</small><button>이전</button><button>완료</button></div>
            </div>
          </div>
        </article>

        <article className={styles.featureCard} data-tone="playbook">
          <div className={styles.featureCopy}>
            <span>02 · PLAYBOOK</span>
            <h3>플레이북</h3>
            <p>여러 가이드와 설명을 하나의 수업으로</p>
            <ul>
              <li><Check size={14} />블록 기반 문서 편집</li>
              <li><Check size={14} />가이드 바로 삽입</li>
              <li><Check size={14} />링크 하나로 공유</li>
            </ul>
          </div>
          <div className={styles.playbookMock}>
            <header><div><BookMarked size={18} /><strong>신입 강사 수업 운영 플레이북</strong></div><button><Link2 size={13} />공유</button></header>
            <aside><span>목차</span><b>수업 시작 전</b><b>실습 진행</b><b>질문 대응</b></aside>
            <main>
              <span>강사 플레이북</span>
              <h4>실습 수업 운영 가이드</h4>
              <p>수업 준비부터 학습자 지원까지 한 흐름으로 확인하세요</p>
              <div className={styles.playbookGuide}><FileText size={20} /><div><small>가이드 임베드</small><strong>GitHub 저장소 만들고 첫 커밋 올리기</strong><span>5단계 · 약 12분</span></div><Play size={15} /></div>
              <h5>수업 중 확인할 항목</h5>
              <label><i />도움 요청 대기열 확인</label>
              <label><i />3단계 체류 학습자 확인</label>
            </main>
          </div>
        </article>

        <article className={styles.featureCard} data-tone="dashboard" id="instructor">
          <div className={styles.featureCopy}>
            <span>03 · INSTRUCTOR</span>
            <h3>강사 대시보드</h3>
            <p>수강생의 현재 상태와 손들기를 실시간으로</p>
            <div className={styles.featureLinks}>
              <Link href={EDU_ROUTES.instructor}>강사 화면 체험 <ArrowRight size={15} /></Link>
            </div>
          </div>
          <div className={styles.learnerViewer}>
            <header><div><strong>GitHub 협업 기초</strong><span>LIVE</span></div><small>50명 실습 중</small></header>
            <div className={styles.learnerStats}><span><small>정상 진행</small><strong>34</strong></span><span><small>도움 요청</small><strong>6</strong></span><span><small>완료</small><strong>5</strong></span></div>
            <div className={styles.learnerBody}>
              <section><b>수강생 학습 상태</b>{[
                ["김민서", "3 / 5", "도움 요청"],
                ["박지훈", "2 / 5", "도움 요청"],
                ["이서연", "4 / 5", "진행 중"],
                ["최도윤", "5 / 5", "완료"],
              ].map(([name, step, state], index) => <div key={name} data-alert={index < 2}><i>{name[0]}</i><strong>{name}<small>{step}</small></strong><em>{state}</em>{index < 2 && <Hand size={15} />}</div>)}</section>
              <aside><CircleHelp size={20} /><span>손들기</span><strong>Private 설정에서 다음 버튼이 안 보여요</strong><small>김민서 · 3단계 · 9분 대기</small><button>지원하기</button></aside>
            </div>
          </div>
        </article>

        <article className={styles.featureCard} data-tone="classroom">
          <div className={styles.featureCopy}>
            <span>04 · CLASS & WORKSPACE</span>
            <h3>클래스와 워크스페이스</h3>
            <p>수업은 클래스로 운영하고 자료는 팀과 함께</p>
            <div className={styles.featureLinks}>
              <Link href={EDU_ROUTES.join}>수강생 화면 체험 <ArrowRight size={15} /></Link>
            </div>
          </div>
          <div className={styles.classMock}>
            <aside><BrandMark size={24} /><b>내 클래스</b><span data-active><Users size={14} />GitHub 협업 기초</span><b>워크스페이스</b><span><FolderKanban size={14} />AI 교육 운영팀</span><span><FolderKanban size={14} />공통 수업 자료</span></aside>
            <main><header><div><small>CLASS CODE</small><strong>PARRO50</strong></div><button>초대하기</button></header><h4>오늘의 실습</h4><div className={styles.classLesson}><BookOpenCheck size={22} /><div><strong>GitHub 저장소 만들고 첫 커밋 올리기</strong><span>50명 참여 · 34명 진행 · 5명 완료</span></div><em>진행 중</em></div><h4>공유 자료</h4><div className={styles.workspaceFiles}><span><FileText size={16} />실습 전 체크리스트<small>플레이북</small></span><span><FileText size={16} />GitHub 기초 가이드<small>매뉴얼</small></span></div></main>
          </div>
        </article>
      </section>

      <section className={styles.capabilitySection}>
        <div className={styles.capabilityHeading}>
          <span>WHAT PARRO ALREADY DOES</span>
          <h2>
            기록부터 실습까지
            <br />
            하나의 흐름으로
          </h2>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilities.map(([title, body], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.useCases} id="use-cases">
        <div className={styles.useCasesTitle}>
          <span>BUILT FOR EDUCATION</span>
          <h2>
            모든 실습 교육에
          </h2>
          <p>배우고 직접 해내야 하는 모든 현장</p>
        </div>
        <div className={styles.useCaseList}>
          {educationUses.map(([title, body], index) => (
            <article key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
              <ArrowDownRight size={22} />
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div>
          <span>PARRO EDU</span>
          <h2>
            지금, 첫 실습 가이드를
            <br />
            만들어보세요
          </h2>
        </div>
        <p>
          한 번 만들고 반복해서 활용하세요
        </p>
        <Link href="/auth/login">
          첫 가이드 만들기 <ArrowRight size={17} />
        </Link>
        <Image
          src="/brand/parro-3d-talk.png"
          alt="Parro EDU"
          width={260}
          height={260}
        />
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}>
          <BrandMark size={27} />
          <strong>Parro</strong>
          <span>EDU</span>
        </div>
        <div>
          <Link href="/legal/terms">이용약관</Link>
          <Link href="/legal/privacy">개인정보처리방침</Link>
          <Link href="mailto:kinjungho@gmail.com">문의하기</Link>
        </div>
        <p>© 2026 Parro EDU</p>
      </footer>
    </main>
  );
}
