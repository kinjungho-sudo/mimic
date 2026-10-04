'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  Filter,
  GraduationCap,
  Hand,
  LayoutDashboard,
  MessageCircle,
  PlayCircle,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import styles from './dashboard.module.css';

type LearnerStatus = 'help' | 'stuck' | 'learning' | 'done' | 'idle';
type FilterValue = 'all' | LearnerStatus;

type Learner = {
  id: number;
  name: string;
  initials: string;
  color: string;
  status: LearnerStatus;
  step: number;
  total: number;
  stepTitle: string;
  duration: string;
  lastSeen: string;
  retries: number;
  message?: string;
};

const learners: Learner[] = [
  { id: 1, name: '김민서', initials: '김', color: '#DDF7F2', status: 'help', step: 4, total: 8, stepTitle: 'API 키 입력하기', duration: '8분 42초', lastSeen: '방금 전', retries: 3, message: 'API 키를 입력했는데 다음 단계로 넘어가지 않아요.' },
  { id: 2, name: '박지훈', initials: '박', color: '#E7ECFF', status: 'stuck', step: 4, total: 8, stepTitle: 'API 키 입력하기', duration: '12분 18초', lastSeen: '1분 전', retries: 4 },
  { id: 3, name: '이서연', initials: '이', color: '#FFF0E7', status: 'learning', step: 6, total: 8, stepTitle: '자동화 실행하기', duration: '2분 11초', lastSeen: '방금 전', retries: 0 },
  { id: 4, name: '최도윤', initials: '최', color: '#F0E9FF', status: 'done', step: 8, total: 8, stepTitle: '결과 확인하기', duration: '완료', lastSeen: '3분 전', retries: 1 },
  { id: 5, name: '정하은', initials: '정', color: '#E4F5FF', status: 'help', step: 3, total: 8, stepTitle: '새 프로젝트 만들기', duration: '6분 03초', lastSeen: '방금 전', retries: 2, message: '강사 화면과 버튼 위치가 달라요.' },
  { id: 6, name: '오준호', initials: '오', color: '#FFF6D9', status: 'learning', step: 5, total: 8, stepTitle: '워크플로 연결하기', duration: '1분 35초', lastSeen: '방금 전', retries: 0 },
  { id: 7, name: '한유진', initials: '한', color: '#E8F8E7', status: 'idle', step: 2, total: 8, stepTitle: '계정으로 로그인하기', duration: '4분 50초', lastSeen: '7분 전', retries: 1 },
  { id: 8, name: '임재현', initials: '임', color: '#FFE7EC', status: 'done', step: 8, total: 8, stepTitle: '결과 확인하기', duration: '완료', lastSeen: '5분 전', retries: 0 },
];

const filterLabels: Record<FilterValue, string> = {
  all: '전체 24',
  help: '손들기 3',
  stuck: '막힘 4',
  learning: '진행 중 8',
  done: '완료 9',
  idle: '이탈 위험 2',
};

const statusMeta: Record<LearnerStatus, { label: string; detail: string }> = {
  help: { label: '손들기', detail: '도움 요청' },
  stuck: { label: '막힘', detail: '5분 이상 정체' },
  learning: { label: '진행 중', detail: '정상 실습 중' },
  done: { label: '완료', detail: '전체 단계 완료' },
  idle: { label: '이탈 위험', detail: '활동 없음' },
};

const bottlenecks = [
  { step: 1, label: 'Parro 실습 시작', count: 1, width: 18 },
  { step: 2, label: '계정으로 로그인하기', count: 3, width: 34 },
  { step: 3, label: '새 프로젝트 만들기', count: 5, width: 52 },
  { step: 4, label: 'API 키 입력하기', count: 11, width: 100, hot: true },
  { step: 5, label: '워크플로 연결하기', count: 7, width: 67 },
  { step: 6, label: '자동화 실행하기', count: 4, width: 43 },
  { step: 7, label: '오류 수정하기', count: 6, width: 58 },
  { step: 8, label: '결과 확인하기', count: 2, width: 25 },
];

export default function EduInstructorDashboardPage() {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [selectedLearner, setSelectedLearner] = useState<Learner>(learners[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resolvedIds, setResolvedIds] = useState<number[]>([]);

  const visibleLearners = useMemo(() => {
    if (filter === 'all') return learners;
    return learners.filter((learner) => learner.status === filter);
  }, [filter]);

  const openLearner = (learner: Learner) => {
    setSelectedLearner(learner);
    setDrawerOpen(true);
  };

  const resolveHelp = (id: number) => {
    setResolvedIds((current) => current.includes(id) ? current : [...current, id]);
  };

  return (
    <div className={styles.appShell}>
      <style jsx global>{`
        .parro-language-switcher { display: none !important; }
      `}</style>
      <aside className={styles.sidebar}>
        <Link href="/home" className={styles.brand} aria-label="Parro 홈으로">
          <BrandMark size={32} />
          <span>Parro</span>
          <b>EDU</b>
        </Link>

        <div className={styles.courseMini}>
          <div className={styles.courseIcon}><GraduationCap size={18} /></div>
          <div>
            <span>현재 클래스</span>
            <strong>AI 자동화 3기</strong>
          </div>
          <ChevronDown size={15} />
        </div>

        <nav className={styles.nav} aria-label="강사 대시보드 메뉴">
          <span className={styles.navLabel}>수업 운영</span>
          <button className={styles.navActive}><LayoutDashboard size={17} />실시간 현황</button>
          <button><Users size={17} />수강생 관리<span>24</span></button>
          <button><Hand size={17} />손들기 요청<i>3</i></button>
          <span className={styles.navLabel}>교안 개선</span>
          <button><BookOpen size={17} />실습 가이드</button>
          <button><BarChart3 size={17} />학습 분석</button>
          <button><MessageCircle size={17} />피드백 모음</button>
        </nav>

        <div className={styles.sidebarGuide}>
          <div><Sparkles size={16} /></div>
          <strong>Parro가 찾은 개선 포인트</strong>
          <p>4단계에서 수강생 11명이 반복해서 멈췄어요.</p>
          <button>인사이트 보기 <ArrowUpRight size={13} /></button>
        </div>

        <button className={styles.profile}>
          <span>김</span>
          <div><strong>김정호 강사</strong><small>클래스 관리자</small></div>
          <Settings size={16} />
        </button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <span>2026 KDT · AI 업무자동화 과정</span>
            <h1>안녕하세요, 김정호 강사님</h1>
            <p>수강생의 실습 흐름과 도움이 필요한 순간을 확인하세요.</p>
          </div>
          <div className={styles.headerActions}>
            <label className={styles.search}>
              <Search size={16} />
              <input aria-label="수강생 검색" placeholder="수강생 검색" />
            </label>
            <button className={styles.iconButton} aria-label="알림"><Bell size={18} /><i /></button>
            <button className={styles.sessionButton}><span /> 실습 진행 중 <ChevronDown size={15} /></button>
          </div>
        </header>

        <section className={styles.content}>
          <div className={styles.liveStrip}>
            <div><span className={styles.liveDot} />LIVE</div>
            <strong>ChatGPT API로 업무 자동화 만들기</strong>
            <span>시작 후 42분</span>
            <button><Eye size={15} />수강생 화면 보기</button>
          </div>

          <section className={styles.metrics} aria-label="오늘의 실습 지표">
            <article>
              <div className={styles.metricIconGreen}><Users size={19} /></div>
              <div><span>참여 수강생</span><strong>24<small>명</small></strong><p>전체 26명 중 92%</p></div>
            </article>
            <article>
              <div className={styles.metricIconBlue}><PlayCircle size={19} /></div>
              <div><span>실습 진행 중</span><strong>8<small>명</small></strong><p>평균 5 / 8단계</p></div>
            </article>
            <article>
              <div className={styles.metricIconOrange}><Hand size={19} /></div>
              <div><span>도움이 필요해요</span><strong>7<small>명</small></strong><p className={styles.warningText}>손들기 3 · 막힘 4</p></div>
            </article>
            <article>
              <div className={styles.metricIconPurple}><CheckCircle2 size={19} /></div>
              <div><span>실습 완료</span><strong>9<small>명</small></strong><p className={styles.positiveText}>지난 수업보다 +11%p</p></div>
            </article>
          </section>

          <div className={styles.dashboardGrid}>
            <section className={styles.card + ' ' + styles.learnerCard}>
              <div className={styles.cardHeader}>
                <div><h2>수강생 실시간 상태</h2><p>현재 단계와 정체 시간을 한눈에 확인합니다.</p></div>
                <button className={styles.smallOutline}><Filter size={14} />필터</button>
              </div>

              <div className={styles.filters} role="tablist" aria-label="수강생 상태 필터">
                {(Object.keys(filterLabels) as FilterValue[]).map((value) => (
                  <button key={value} role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={filter === value ? styles.filterActive : ''}>
                    {filterLabels[value]}
                  </button>
                ))}
              </div>

              <div className={styles.tableWrap}>
                <table>
                  <thead><tr><th>수강생</th><th>상태</th><th>현재 단계</th><th>단계 체류</th><th>최근 활동</th><th><span className={styles.srOnly}>메뉴</span></th></tr></thead>
                  <tbody>
                    {visibleLearners.map((learner) => (
                      <tr key={learner.id} onClick={() => openLearner(learner)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && openLearner(learner)}>
                        <td><span className={styles.avatar} style={{ background: learner.color }}>{learner.initials}</span><strong>{learner.name}</strong></td>
                        <td><span className={`${styles.status} ${styles[`status_${learner.status}`]}`}>{learner.status === 'help' && <Hand size={12} />}{statusMeta[learner.status].label}</span></td>
                        <td>
                          <div className={styles.stepCell}><strong>{learner.step} / {learner.total}</strong><span>{learner.stepTitle}</span></div>
                          <div className={styles.progress}><i style={{ width: `${learner.step / learner.total * 100}%` }} /></div>
                        </td>
                        <td className={learner.status === 'stuck' || learner.status === 'help' ? styles.hotTime : ''}>{learner.duration}</td>
                        <td>{learner.lastSeen}</td>
                        <td><button aria-label={`${learner.name} 상세 보기`}><ChevronRight size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className={styles.rightRail}>
              <section className={styles.card + ' ' + styles.helpCard}>
                <div className={styles.cardHeader}>
                  <div><h2>손들기 요청</h2><p>먼저 확인이 필요한 3건</p></div>
                  <span className={styles.liveCount}>3</span>
                </div>
                {[learners[0], learners[4]].map((learner) => {
                  const resolved = resolvedIds.includes(learner.id);
                  return (
                    <article key={learner.id} className={resolved ? styles.helpResolved : ''}>
                      <div className={styles.helpTop}>
                        <span className={styles.avatar} style={{ background: learner.color }}>{learner.initials}</span>
                        <div><strong>{learner.name}</strong><small>{learner.step}단계 · {learner.lastSeen}</small></div>
                        <span className={styles.handBubble}>{resolved ? <Check size={14} /> : <Hand size={14} />}</span>
                      </div>
                      <p>{resolved ? '강사가 확인한 요청입니다.' : learner.message}</p>
                      <div className={styles.helpActions}>
                        <button onClick={() => openLearner(learner)}>상황 보기</button>
                        <button onClick={() => resolveHelp(learner.id)} disabled={resolved}>{resolved ? '확인 완료' : '확인했어요'}</button>
                      </div>
                    </article>
                  );
                })}
                <button className={styles.viewAll}>모든 요청 보기 <ChevronRight size={14} /></button>
              </section>

              <section className={styles.card + ' ' + styles.alertCard}>
                <div className={styles.alertIcon}><AlertTriangle size={18} /></div>
                <div><strong>2명이 이탈 위험 상태예요</strong><p>7분 이상 활동이 없는 수강생을 확인해 주세요.</p></div>
                <button><ChevronRight size={17} /></button>
              </section>
            </aside>
          </div>

          <div className={styles.insightGrid}>
            <section className={styles.card + ' ' + styles.bottleneckCard}>
              <div className={styles.cardHeader}>
                <div><h2>단계별 막힘 분석</h2><p>반복·중단·도움 요청 로그를 합산한 결과입니다.</p></div>
                <button className={styles.periodButton}>오늘 수업 <ChevronDown size={14} /></button>
              </div>
              <div className={styles.chartLegend}><span><i />정체 수강생</span><small>단위: 명</small></div>
              <div className={styles.bars}>
                {bottlenecks.map((item) => (
                  <div key={item.step} className={item.hot ? styles.hotBarRow : ''}>
                    <span>{item.step}</span>
                    <div><i style={{ width: `${item.width}%` }} /><em>{item.count}</em></div>
                    <strong>{item.label}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.card + ' ' + styles.improveCard}>
              <div className={styles.insightBadge}><Sparkles size={14} />AI 교안 개선 제안</div>
              <h2>4단계 설명을 보강하면<br />막힘을 가장 크게 줄일 수 있어요.</h2>
              <p>‘API 키 입력하기’에서 평균 체류 시간이 다른 단계보다 <strong>2.4배</strong> 길고, 전체 도움 요청의 <strong>46%</strong>가 집중됐습니다.</p>
              <div className={styles.recommendation}>
                <span>추천 개선</span>
                <ul>
                  <li><CheckCircle2 size={15} />API 키 복사 위치를 이미지로 추가</li>
                  <li><CheckCircle2 size={15} />입력 후 저장 버튼을 강조 표시</li>
                  <li><CheckCircle2 size={15} />화면 버전 차이 안내 문구 추가</li>
                </ul>
              </div>
              <button className={styles.primaryButton}><BookOpen size={16} />4단계 교안 개선하기 <ArrowUpRight size={15} /></button>
            </section>
          </div>

          <section className={styles.feedbackFlow} aria-label="손들기 피드백 흐름">
            <div><span>1</span><Hand size={18} /><p><strong>수강생 손들기</strong><small>현재 단계에서 도움 요청</small></p></div>
            <ChevronRight size={18} />
            <div><span>2</span><Clock3 size={18} /><p><strong>상황 로그 첨부</strong><small>단계·체류·재시도 자동 기록</small></p></div>
            <ChevronRight size={18} />
            <div><span>3</span><UserRoundCheck size={18} /><p><strong>강사 개입</strong><small>필요한 수강생부터 지원</small></p></div>
            <ChevronRight size={18} />
            <div><span>4</span><Sparkles size={18} /><p><strong>교안 개선</strong><small>반복 막힘을 다음 수업에 반영</small></p></div>
          </section>
        </section>
      </main>

      {drawerOpen && (
        <>
          <button className={styles.drawerBackdrop} aria-label="상세 닫기" onClick={() => setDrawerOpen(false)} />
          <aside className={styles.drawer} aria-label={`${selectedLearner.name} 실습 상세`}>
            <div className={styles.drawerHeader}>
              <div><span className={styles.avatarLarge} style={{ background: selectedLearner.color }}>{selectedLearner.initials}</span><p><strong>{selectedLearner.name}</strong><small>수강생 상세 · 실시간</small></p></div>
              <button onClick={() => setDrawerOpen(false)} aria-label="닫기"><X size={19} /></button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.drawerStatus}>
                <span className={`${styles.status} ${styles[`status_${selectedLearner.status}`]}`}>{statusMeta[selectedLearner.status].label}</span>
                <strong>{selectedLearner.step} / {selectedLearner.total}단계</strong>
                <p>{statusMeta[selectedLearner.status].detail}</p>
                <div className={styles.progress}><i style={{ width: `${selectedLearner.step / selectedLearner.total * 100}%` }} /></div>
              </div>
              {selectedLearner.message && <div className={styles.messageBox}><Hand size={17} /><div><span>수강생이 남긴 메시지</span><p>“{selectedLearner.message}”</p></div></div>}
              <section className={styles.currentStep}>
                <span>현재 실습 단계</span>
                <h3>{selectedLearner.step}. {selectedLearner.stepTitle}</h3>
                <dl><div><dt>단계 체류 시간</dt><dd>{selectedLearner.duration}</dd></div><div><dt>재시도</dt><dd>{selectedLearner.retries}회</dd></div><div><dt>최근 활동</dt><dd>{selectedLearner.lastSeen}</dd></div></dl>
              </section>
              <section className={styles.timeline}>
                <h3>최근 실습 로그</h3>
                <div className={styles.timelineHot}><span><AlertTriangle size={13} /></span><p><strong>동일 동작 재시도</strong><small>저장 버튼을 3회 클릭했어요 · 방금 전</small></p></div>
                <div><span><RotateCcw size={13} /></span><p><strong>{selectedLearner.step}단계 다시 시작</strong><small>가이드를 재실행했어요 · 2분 전</small></p></div>
                <div><span><Check size={13} /></span><p><strong>{Math.max(1, selectedLearner.step - 1)}단계 완료</strong><small>정상적으로 다음 단계로 이동 · 9분 전</small></p></div>
              </section>
            </div>
            <div className={styles.drawerFooter}>
              <button><MessageCircle size={16} />메시지 보내기</button>
              <button onClick={() => resolveHelp(selectedLearner.id)}><Check size={16} />확인 완료</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
