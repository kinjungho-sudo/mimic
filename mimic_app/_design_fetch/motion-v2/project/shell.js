/* MIMIC — Sidebar + Topbar renderer
   Usage: in HTML, place <div data-sidebar="<active>"></div> and <div data-topbar="<usage>"></div>.
   Active values: home | my-manuals | shared | team-manuals | team-shared | settings | mypage
   Usage values for topbar: <todayCount> (out of 3) */

(function () {
  const sidebarHTML = (active) => {
    const item = (key, icon, label, badge, disabled) => `
      <a href="${routeOf(key)}" class="nav-item ${active === key ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}" data-nav="${key}">
        <span class="nav-item__icon">${icon}</span>
        <span class="nav-item__label">${label}</span>
        ${badge ? `<span class="nav-item__badge">${badge}</span>` : ''}
      </a>`;

    return `
      <a href="Landing.html" class="brand-mini">
        <span class="brand-mini__mark">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.2" y="5.2" width="11" height="2.4" rx="1.2" fill="white" fill-opacity="0.5"/><rect x="3.2" y="10.8" width="14" height="2.4" rx="1.2" fill="white"/><rect x="3.2" y="16.4" width="8" height="2.4" rx="1.2" fill="white" fill-opacity="0.5"/><circle cx="18.7" cy="17.6" r="3.6" fill="white"/><path d="M17.6 16.1 L20.1 17.6 L17.6 19.1 Z" fill="#4F46E5"/></svg>
        </span>
        MIMIC
      </a>

      <div class="workspace-head">
        <span class="ws-avatar">정</span>
        <span class="workspace-head__name">jungho@comindworks.com 's workspace</span>
        <span class="workspace-head__caret">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>

      ${item('home', ic_home(), '홈')}

      <div class="nav-section">나의 워크스페이스</div>
      ${item('my-manuals', ic_doc(), '내 매뉴얼')}
      ${item('shared', ic_link(), '공유한 매뉴얼')}

      <div class="nav-section">팀 워크스페이스 <span class="nav-item__badge" style="margin-left:6px;">곧 출시</span></div>
      ${item('team-manuals', ic_users(), '팀 매뉴얼', null, true)}
      ${item('team-shared', ic_link(), '팀 공유', null, true)}

      <div class="sidebar-divider"></div>

      <div class="sidebar-foot">
        ${item('settings', ic_cog(), '설정')}
        ${item('mypage', ic_user(), '마이페이지')}
        ${item('help', ic_help(), '이용 방법')}
      </div>
    `;
  };

  const routeOf = (key) => ({
    home: 'Dashboard.html',
    'my-manuals': 'Dashboard.html',
    shared: 'Dashboard.html',
    'team-manuals': '#',
    'team-shared': '#',
    settings: '#',
    mypage: 'My Page.html',
    help: 'Help.html',
  }[key] || '#');

  // Icons
  const ic_home = () => svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a1 1 0 0 1-1-1v-5h-4v5a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V9z"/>');
  const ic_doc = () => svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>');
  const ic_link = () => svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>');
  const ic_users = () => svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>');
  const ic_cog = () => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
  const ic_user = () => svg('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
  const ic_help = () => svg('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>');

  function svg(inner) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }

  // Topbar
  const topbarHTML = (todayCount = 2, options = {}) => {
    const tc = Number(todayCount);
    const usageClass = tc >= 3 ? 'is-danger' : tc >= 2 ? 'is-warn' : '';
    return `
      <div class="topbar__search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input placeholder="매뉴얼 검색..." />
        <span class="topbar__kbd">⌘ K</span>
      </div>
      <div class="topbar__right">
        ${options.newButton !== false ? `<button class="btn btn--primary btn--sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          새 매뉴얼
        </button>` : ''}
        <button class="usage-chip ${usageClass}">
          <span class="usage-chip__dot"></span>
          오늘 매뉴얼 ${tc}/3
        </button>
        <button class="icon-btn" aria-label="알림">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          <span class="notif"></span>
        </button>
        <span class="avatar">정</span>
      </div>
    `;
  };

  // Mount
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-sidebar]').forEach(el => {
      el.className = 'sidebar';
      el.innerHTML = sidebarHTML(el.dataset.sidebar || 'home');
    });
    document.querySelectorAll('[data-topbar]').forEach(el => {
      el.className = 'topbar';
      const count = parseInt(el.dataset.usage || '2', 10);
      const newBtn = el.dataset.newBtn !== 'false';
      el.innerHTML = topbarHTML(count, { newButton: newBtn });
    });
  });
})();
