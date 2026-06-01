document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  DataStore.init();

  const $ = id => document.getElementById(id);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const charts = {};
  const pageTitles = {
    dashboard: 'Dashboard',
    performance: 'Performance',
    attendance: 'Attendance',
    quizzes: 'Quiz Center',
    tasks: 'Task Manager',
    portfolio: 'Portfolio',
    store: 'Student Store',
    analytics: 'Analytics',
    profile: 'Profile',
  };
  let storeSearch = '';
  let storeCategory = 'all';
  const themes = [
    { id: 'amrita', label: 'Amrita Glow' },
    { id: 'dark', label: 'Midnight Violet' },
    { id: 'ocean', label: 'Ocean Cyan' },
    { id: 'sunset', label: 'Sunset Coral' },
    { id: 'forest', label: 'Forest Lime' },
    { id: 'light', label: 'Clean Light' },
  ];

  let currentSemIndex = Math.max(0, DataStore.getUser().semester - 1);
  let taskFilter = 'all';
  let portfolioFilter = 'all';
  let isApplyingRemoteSnapshot = false;
  let quizState = {
    cat: '',
    questions: [],
    index: 0,
    correct: 0,
    timer: null,
    timeLeft: 30,
    startedAt: 0,
  };

  function isAdminMode() {
    const runtime = window.STUDENT_PORTAL_RUNTIME_CONFIG || {};
    return runtime.deviceMode === 'admin' || DataStore.getUser().role === 'admin';
  }

  function canEditPortalData() {
    return isAdminMode();
  }

  function getAccessibleSemesters() {
    const semesters = DataStore.getMarks().semesters || [];
    if (isAdminMode()) return semesters;

    const currentSemester = Number(DataStore.getUser().semester) || 1;
    const visible = semesters.filter(item => Number(item.sem) <= currentSemester);
    return visible.length ? visible : semesters.slice(0, 1);
  }

  function getAccessSummary() {
    if (isAdminMode()) {
      return {
        label: 'Admin View',
        banner: 'Admin mode is active. Marks, attendance, tasks, portfolio, and profile data can be changed from this device.',
      };
    }

    return {
      label: 'Student View',
      banner: 'Student mode is active. Academic data is read-only here and should be updated from the admin-managed database or main computer.',
    };
  }

  function getPortalDocId() {
    const runtime = window.STUDENT_PORTAL_RUNTIME_CONFIG || {};
    const settings = DataStore.getSettings();
    const user = DataStore.getUser();
    const raw = runtime.portalKey || settings.loginId || user.rollNo || user.email || user.uid || 'student-portal';

    return String(raw)
      .trim()
      .toLowerCase()
      .replace(/[.#$/\[\]\s]+/g, '_');
  }

  setTimeout(() => $('loader').classList.add('done'), 450);

  initAuth();
  initTheme();
  initNavigation();
  initNotifications();
  initModals();
  initForms();
  initStore();
  initCart();
  initContactForm();
  initProfileAvatar();
  initBackendBridge();

  if (DataStore.getUser().loggedIn) {
    showApp();
  }

  function initAuth() {
    $('login-form').addEventListener('submit', event => {
      event.preventDefault();
      const loginId = $('login-email').value.trim();
      const password = $('login-password').value;
      const settings = DataStore.getSettings();
      const user = DataStore.getUser();
      const isAdminLogin = loginId.toLowerCase() === String(settings.adminLoginId || 'admin').toLowerCase()
        && password === String(settings.adminPassword || 'admin123');
      const allowedIds = [
        settings.loginId,
        user.email,
        user.rollNo,
      ].map(item => String(item || '').trim().toLowerCase());
      if (!isAdminLogin && (!allowedIds.includes(loginId.toLowerCase()) || password !== settings.loginPassword)) {
        toast('Invalid login credentials');
        return;
      }
      DataStore.saveUser({
        ...user,
        role: isAdminLogin ? 'admin' : 'student',
        loggedIn: true,
      }, { silent: true });
      DataStore.addActivity(isAdminLogin ? 'Signed in to portal as admin' : 'Signed in to portal', 'auth');
      showApp();
      toast(isAdminLogin ? 'Admin mode enabled' : 'Signed in successfully');
    });

    $('btn-logout').addEventListener('click', () => {
      DataStore.saveUser({ ...DataStore.getUser(), loggedIn: false }, { silent: true });
      $('app').classList.add('hidden');
      $('login-overlay').classList.remove('hidden');
      toast('Signed out');
    });

    $('avatar-initials').addEventListener('click', () => navigate('profile'));
  }

  function showApp() {
    $('login-overlay').classList.add('hidden');
    $('app').classList.remove('hidden');
    renderShell();
    const hash = location.hash.replace('#', '');
    navigate(pageTitles[hash] ? hash : 'dashboard');
  }

  function initTheme() {
    applyTheme(DataStore.getSettings().theme);
    $('theme-toggle').addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const currentIndex = themes.findIndex(theme => theme.id === currentTheme);
      const nextTheme = themes[(currentIndex + 1) % themes.length].id;
      applyTheme(nextTheme);
      DataStore.saveSettings({ theme: nextTheme });
      toast(`${themeLabel(nextTheme)} enabled`);
      redrawCurrentPage();
    });
  }

  function applyTheme(themeId) {
    const safeTheme = themes.some(theme => theme.id === themeId) ? themeId : 'amrita';
    document.documentElement.setAttribute('data-theme', safeTheme);
    $('theme-toggle').textContent = themeLabel(safeTheme);
  }

  function initNavigation() {
    $$('.nav-item[data-page]').forEach(item => {
      item.addEventListener('click', event => {
        event.preventDefault();
        navigate(item.dataset.page);
      });
    });

    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-goto]');
      if (trigger) navigate(trigger.dataset.goto);
    });

    $('sidebar-toggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    $('quick-add-task').addEventListener('click', () => {
      if (!canEditPortalData()) {
        toast('Task updates are locked for student view');
        return;
      }
      navigate('tasks');
      setTimeout(() => $('task-input').focus(), 80);
    });

    window.addEventListener('hashchange', () => {
      const page = location.hash.replace('#', '');
      if (pageTitles[page]) navigate(page, true);
    });

    window.addEventListener('storage', event => {
      if (!event.key || !event.key.startsWith('sp_')) return;
      renderShell();
      redrawCurrentPage();
      toast('Data update synced');
    });
  }

  function initBackendBridge() {
    if (!window.FirebaseBridge || typeof window.FirebaseBridge.init !== 'function') {
      setBackendStatus('Local Mode', false);
      return;
    }

    patchMutationsForCloudSync();
    window.FirebaseBridge.init({
      getData: () => DataStore.exportSnapshot(),
      getDocId: () => getPortalDocId(),
      applyData: snapshot => {
        isApplyingRemoteSnapshot = true;
        DataStore.importSnapshot(snapshot, { silent: true });
        isApplyingRemoteSnapshot = false;
        renderShell();
        redrawCurrentPage();
        toast('Cloud update received');
      },
      onStatus: state => setBackendStatus(state.text, state.isOnline),
    });
  }

  function patchMutationsForCloudSync() {
    const names = [
      'saveUser',
      'saveSettings',
      'saveMarks',
      'upsertSubject',
      'deleteSubject',
      'updateSubjectMark',
      'saveAttendance',
      'updateAttendance',
      'markAttendance',
      'saveTasks',
      'addTask',
      'updateTask',
      'deleteTask',
      'saveQuizScores',
      'addQuizScore',
      'saveNotifications',
      'pushNotification',
      'savePortfolio',
      'addProject',
      'addActivity',
      'resetAll',
      'importSnapshot',
    ];
    names.forEach(name => {
      if (typeof DataStore[name] !== 'function') return;
      const original = DataStore[name];
      DataStore[name] = function patchedMutation(...args) {
        const result = original.apply(DataStore, args);
        if (!isApplyingRemoteSnapshot && window.FirebaseBridge && typeof window.FirebaseBridge.scheduleSync === 'function') {
          window.FirebaseBridge.scheduleSync();
        }
        return result;
      };
    });
  }

  function setBackendStatus(text, isOnline) {
    const chip = $('backend-status');
    if (!chip) return;
    chip.textContent = text;
    chip.classList.toggle('status-online', Boolean(isOnline));
    chip.classList.toggle('status-offline', !isOnline);
  }

  function navigate(page, fromHash = false) {
    $$('.page').forEach(item => item.classList.remove('active'));
    $$('.nav-item[data-page]').forEach(item => item.classList.toggle('active', item.dataset.page === page));

    const target = $(`page-${page}`);
    if (!target) return;
    target.classList.add('active');
    $('page-title').textContent = pageTitles[page] || 'Dashboard';
    $('sidebar').classList.remove('open');
    if (!fromHash) location.hash = page;

    redrawPage(page);
  }

  function redrawCurrentPage() {
    const active = document.querySelector('.page.active');
    if (active) redrawPage(active.id.replace('page-', ''));
  }

  function redrawPage(page) {
    renderShell();
    if (page === 'dashboard') renderDashboard();
    if (page === 'performance') renderPerformance();
    if (page === 'attendance') renderAttendance();
    if (page === 'quizzes') renderQuizCategories();
    if (page === 'tasks') renderTasks();
    if (page === 'portfolio') renderPortfolio();
    if (page === 'store') renderStore();
    if (page === 'analytics') renderAnalytics();
    if (page === 'profile') renderProfile();
  }

  function initNotifications() {
    $('notif-btn').addEventListener('click', event => {
      event.stopPropagation();
      $('notif-panel').classList.toggle('hidden');
    });
    document.addEventListener('click', event => {
      if (!$('notif-panel').contains(event.target) && event.target !== $('notif-btn')) {
        $('notif-panel').classList.add('hidden');
      }
    });
    $('notif-clear').addEventListener('click', () => {
      const notifications = DataStore.getNotifications().map(item => ({ ...item, read: true }));
      DataStore.saveNotifications(notifications);
      renderNotifications();
    });
  }

  function initModals() {
    $('modal-close').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', event => {
      if (event.target === $('modal-overlay')) closeModal();
    });
  }

  function initForms() {
    $('marks-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!canEditPortalData()) {
        toast('Marks can only be edited from the admin-managed portal');
        return;
      }
      const code = $('marks-subject').value;
      const saved = DataStore.updateSubjectMark(
        DataStore.getMarks().semesters[currentSemIndex].sem,
        code,
        $('marks-internal').value,
        $('marks-external').value
      );
      if (saved) {
        toast(`Marks saved for ${saved.code}`);
        renderPerformance();
      }
    });

    $('marks-subject').addEventListener('change', fillMarksForm);

    $('subject-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!canEditPortalData()) {
        toast('Subject records can only be edited from the admin-managed portal');
        return;
      }
      const sem = getAccessibleSemesters()[currentSemIndex];
      const originalCode = $('subject-original-code').value;
      const nextCode = $('subject-code').value.trim().toUpperCase();
      const nextName = $('subject-name').value.trim();
      if (!nextCode || !nextName) {
        toast('Subject name and code are required');
        return;
      }
      const saved = DataStore.upsertSubject(sem.sem, {
        name: nextName,
        code: nextCode,
        credits: $('subject-credits').value,
        internal: $('subject-internal').value,
        external: $('subject-external').value,
      });
      if (saved && originalCode && originalCode !== saved.code) {
        DataStore.deleteSubject(sem.sem, originalCode);
      }
      toast(`${saved.code} saved`);
      resetSubjectForm();
      renderPerformance();
      renderShell();
    });

    $('subject-cancel-edit').addEventListener('click', resetSubjectForm);

    $('attendance-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!canEditPortalData()) {
        toast('Attendance can only be edited from the admin-managed portal');
        return;
      }
      const saved = DataStore.updateAttendance(
        $('attendance-subject').value,
        $('attendance-attended').value,
        $('attendance-total').value
      );
      if (saved) {
        toast(`Attendance saved for ${saved.code}`);
        renderAttendance();
      }
    });

    $('attendance-subject').addEventListener('change', fillAttendanceForm);

    $('task-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!canEditPortalData()) {
        toast('Tasks can only be edited from the admin-managed portal');
        return;
      }
      const text = $('task-input').value.trim();
      if (!text) return toast('Task title is required');

      const id = $('task-edit-id').value;
      const payload = {
        text,
        priority: $('task-priority').value,
        deadline: $('task-deadline').value,
        category: 'general',
      };

      if (id) {
        DataStore.updateTask(id, payload);
        toast('Task updated');
      } else {
        DataStore.addTask(payload);
        toast('Task added');
      }
      resetTaskForm();
      renderTasks();
      renderShell();
    });

    $('task-cancel-edit').addEventListener('click', resetTaskForm);

    $$('.filter-btn[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.filter-btn[data-filter]').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        taskFilter = btn.dataset.filter;
        renderTasks();
      });
    });

    $('portfolio-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!canEditPortalData()) {
        toast('Portfolio entries can only be edited from the admin-managed portal');
        return;
      }
      const title = $('pf-title').value.trim();
      if (!title) return toast('Project title is required');

      DataStore.addProject({
        title,
        desc: $('pf-desc').value.trim(),
        category: $('pf-category').value,
        tech: $('pf-tech').value.split(',').map(item => item.trim()).filter(Boolean),
        imageUrl: $('pf-image').value.trim(),
        liveUrl: $('pf-live').value.trim(),
      });
      event.target.reset();
      toast('Project added');
      renderPortfolio();
    });

    $$('[data-pf-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('[data-pf-filter]').forEach(item => item.classList.remove('active'));
        btn.classList.add('active');
        portfolioFilter = btn.dataset.pfFilter;
        renderPortfolio();
      });
    });

    $('profile-form').addEventListener('submit', event => {
      event.preventDefault();
      if (!canEditPortalData()) {
        toast('Profile changes should come from the admin-managed database');
        return;
      }
      DataStore.saveUser({
        name: $('profile-name').value.trim(),
        rollNo: $('profile-roll').value.trim(),
        school: $('profile-school').value.trim(),
        email: $('profile-email').value.trim(),
        phone: $('profile-phone').value.trim(),
        college: $('profile-college').value.trim(),
        branch: $('profile-branch').value.trim(),
        semester: Number($('profile-semester').value) || 1,
      });
      DataStore.saveSettings({
        lowAttendanceLimit: Number($('settings-att-limit').value) || 75,
        loginId: $('settings-login-id').value.trim(),
        loginPassword: $('settings-login-password').value,
        theme: $('settings-theme').value,
      });
      applyTheme($('settings-theme').value);
      renderShell();
      toast('Profile saved');
    });

    $('settings-theme').addEventListener('change', () => {
      applyTheme($('settings-theme').value);
      DataStore.saveSettings({ theme: $('settings-theme').value });
      redrawCurrentPage();
      toast(`${themeLabel($('settings-theme').value)} enabled`);
    });

    $('reset-demo-data').addEventListener('click', () => {
      if (!canEditPortalData()) {
        toast('Reset is available only in admin view');
        return;
      }
      if (!confirm('Reset all local demo data?')) return;
      DataStore.resetAll();
      showApp();
      toast('Demo data reset');
    });

    $('quiz-retry').addEventListener('click', () => startQuiz(quizState.cat));
    $('quiz-back').addEventListener('click', renderQuizCategories);
  }

  function renderShell() {
    const user = DataStore.getUser();
    const avatarBtn = $('avatar-initials');
    if (user.avatar) {
      avatarBtn.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      avatarBtn.textContent = initials(user.name);
    }
    $('topbar-semester').textContent = `Semester ${user.semester} - 2026`;
    $('access-status').textContent = getAccessSummary().label;
    $('access-banner').textContent = getAccessSummary().banner;
    $('access-banner').classList.remove('hidden');
    $('access-banner').classList.toggle('admin', isAdminMode());
    syncAccessUi();
    renderNotifications();
    const cartCount = DataStore.getCartCount();
    $('cart-badge').textContent = cartCount ? String(cartCount) : '';
  }

  function syncAccessUi() {
    const readOnly = !canEditPortalData();
    const forms = ['marks-form', 'subject-form', 'attendance-form', 'task-form', 'portfolio-form', 'profile-form'];

    forms.forEach(id => {
      const form = $(id);
      if (!form) return;
      form.classList.toggle('readonly-form', readOnly);
      form.querySelectorAll('input, select, textarea, button').forEach(element => {
        if (element.id === 'settings-theme') return;
        element.disabled = readOnly;
      });
    });

    $('quick-add-task').classList.toggle('hidden', readOnly);
    $('reset-demo-data').classList.toggle('hidden', readOnly);
  }

  function renderNotifications() {
    const notifications = DataStore.getNotifications();
    const unread = notifications.filter(item => !item.read).length;
    $('notif-badge').textContent = unread ? String(unread) : '';
    $('notif-list').innerHTML = notifications.length ? notifications.slice(0, 12).map(item => `
      <article class="notif-item ${item.read ? '' : 'unread'}">
        <strong>${escapeHtml(item.text)}</strong>
        <small>${timeAgo(item.time)} - ${escapeHtml(item.type)}</small>
      </article>
    `).join('') : emptyMarkup('No notifications yet');
  }

  function renderDashboard() {
    const user = DataStore.getUser();
    const marks = DataStore.getMarks();
    const visibleSemesters = getAccessibleSemesters();
    const attendance = DataStore.getAttendance();
    const tasks = DataStore.getTasks();
    const scores = DataStore.getQuizScores();
    const currentSemester = visibleSemesters.find(item => Number(item.sem) === Number(user.semester)) || visibleSemesters[visibleSemesters.length - 1] || marks.semesters[0];
    const completedSems = visibleSemesters.filter(semester => semester.subjects.some(item => item.gradePoint > 0));
    const overallAttendance = average(attendance.map(item => item.percentage));

    $('welcome-name').textContent = `${greeting()}, ${user.name.split(' ')[0] || 'Student'}`;
    $('dash-cgpa').textContent = DataStore.calcCGPA(completedSems);
    $('dash-sgpa').textContent = DataStore.calcSGPA(currentSemester.subjects);
    $('dash-attendance').textContent = `${overallAttendance.toFixed(1)}%`;
    $('stat-subjects').textContent = currentSemester.subjects.length;
    $('stat-tasks-pending').textContent = tasks.filter(item => !item.done).length;
    $('stat-quizzes-taken').textContent = scores.length;
    $('stat-best-score').textContent = scores.length ? `${Math.max(...scores.map(item => item.score))}%` : 'Pending';

    renderDeadlines();
    renderActivity('activity-list', 6);
    drawDashboardCharts(marks, attendance);
  }

  function renderDeadlines() {
    const deadlines = DataStore.getTasks()
      .filter(item => !item.done && item.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 6);

    $('deadlines-list').innerHTML = deadlines.length ? deadlines.map(item => {
      const overdue = new Date(item.deadline) < startOfToday();
      return `
        <article class="compact-item">
          <div>
            <strong>${escapeHtml(item.text)}</strong>
            <small>${capitalize(item.priority)} priority</small>
          </div>
          <span class="status-pill">${overdue ? 'Overdue' : item.deadline}</span>
        </article>
      `;
    }).join('') : emptyMarkup('No upcoming deadlines');
  }

  function drawDashboardCharts(marks, attendance) {
    const completed = marks.semesters.filter(semester => semester.subjects.some(item => item.gradePoint > 0));
    renderChart('sgpa', $('chart-sgpa'), {
      type: 'bar',
      data: {
        labels: completed.map(item => `Sem ${item.sem}`),
        datasets: [{
          label: 'SGPA',
          data: completed.map(item => Number(DataStore.calcSGPA(item.subjects)) || 0),
          backgroundColor(ctx) {
            const c = ctx.chart.ctx, a = ctx.chart.chartArea;
            if (!a) return 'rgba(124,92,255,0.5)';
            const g = c.createLinearGradient(0, a.bottom, 0, a.top);
            g.addColorStop(0, 'rgba(124,92,255,0.12)');
            g.addColorStop(1, 'rgba(124,92,255,0.75)');
            return g;
          },
          borderColor: 'rgba(124,92,255,0.9)',
          borderWidth: 2,
          borderRadius: 12,
          borderSkipped: false,
          hoverBackgroundColor: 'rgba(124,92,255,0.88)',
        }],
      },
      options: chartOptions(10),
    });

    const limit = DataStore.getSettings().lowAttendanceLimit;
    renderChart('attendanceDash', $('chart-attendance'), {
      type: 'bar',
      data: {
        labels: attendance.map(item => item.code),
        datasets: [{
          label: 'Attendance %',
          data: attendance.map(item => item.percentage),
          backgroundColor: attendance.map(item => item.percentage < limit ? 'rgba(255,92,122,0.6)' : 'rgba(43,213,118,0.5)'),
          borderColor: attendance.map(item => item.percentage < limit ? 'rgba(255,92,122,0.9)' : 'rgba(43,213,118,0.85)'),
          borderWidth: 2,
          borderRadius: 12,
          borderSkipped: false,
          hoverBackgroundColor: attendance.map(item => item.percentage < limit ? 'rgba(255,92,122,0.85)' : 'rgba(43,213,118,0.78)'),
        }],
      },
      options: chartOptions(100),
    });
  }

  function renderPerformance() {
    const semesters = getAccessibleSemesters();
    if (!semesters.length) return;
    if (!semesters[currentSemIndex]) currentSemIndex = Math.max(0, semesters.length - 1);
    const semester = semesters[currentSemIndex];
    const completed = semesters.filter(sem => sem.subjects.some(item => item.gradePoint > 0));

    $('semester-tabs').innerHTML = semesters.map((sem, index) => `
      <button class="sem-tab ${index === currentSemIndex ? 'active' : ''}" data-sem-index="${index}">Semester ${sem.sem}</button>
    `).join('');
    $$('#semester-tabs .sem-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSemIndex = Number(btn.dataset.semIndex);
        renderPerformance();
      });
    });

    $('marks-subject').innerHTML = semester.subjects.map(item => `<option value="${item.code}">${item.code} - ${escapeHtml(item.name)}</option>`).join('');
    fillMarksForm();

    $('marks-sem-title').textContent = `Semester ${semester.sem} marks`;
    $('marks-sgpa-cell').textContent = `SGPA ${DataStore.calcSGPA(semester.subjects)}`;
    $('marks-tbody').innerHTML = semester.subjects.map(item => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${item.code}</td>
        <td>${item.credits}</td>
        <td>${item.internal}</td>
        <td>${item.external}</td>
        <td>${item.total}</td>
        <td>${item.grade}</td>
      </tr>
    `).join('');
    renderSubjectDatabase(semester);

    $('perf-cgpa').textContent = DataStore.calcCGPA(completed);
    $('cgpa-breakdown').innerHTML = completed.map(item => `<span>Sem ${item.sem}: ${DataStore.calcSGPA(item.subjects)}</span>`).join('');

    renderChart('sgpaTrend', $('chart-sgpa-trend'), {
      type: 'line',
      data: {
        labels: completed.map(item => `Sem ${item.sem}`),
        datasets: [{
          label: 'SGPA',
          data: completed.map(item => Number(DataStore.calcSGPA(item.subjects)) || 0),
          borderColor: '#7c5cff',
          borderWidth: 3,
          backgroundColor(ctx) {
            const c = ctx.chart.ctx, a = ctx.chart.chartArea;
            if (!a) return 'rgba(124,92,255,0.1)';
            const g = c.createLinearGradient(0, a.top, 0, a.bottom);
            g.addColorStop(0, 'rgba(124,92,255,0.34)');
            g.addColorStop(0.55, 'rgba(124,92,255,0.08)');
            g.addColorStop(1, 'rgba(124,92,255,0.01)');
            return g;
          },
          tension: 0.42,
          fill: true,
          pointRadius: 6,
          pointBackgroundColor: '#7c5cff',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 9,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#7c5cff',
        }],
      },
      options: chartOptions(10),
    });

    renderChart('subjectPerf', $('chart-subject-perf'), {
      type: 'bar',
      data: {
        labels: semester.subjects.map(item => item.code),
        datasets: [{
          label: 'Marks',
          data: semester.subjects.map(item => item.total),
          backgroundColor(ctx) {
            const c = ctx.chart.ctx, a = ctx.chart.chartArea;
            if (!a) return 'rgba(38,168,255,0.5)';
            const g = c.createLinearGradient(0, a.bottom, 0, a.top);
            g.addColorStop(0, 'rgba(38,168,255,0.1)');
            g.addColorStop(1, 'rgba(38,168,255,0.7)');
            return g;
          },
          borderColor: 'rgba(38,168,255,0.9)',
          borderWidth: 2,
          borderRadius: 12,
          borderSkipped: false,
          hoverBackgroundColor: 'rgba(38,168,255,0.85)',
        }],
      },
      options: chartOptions(100),
    });
  }

  function fillMarksForm() {
    const semester = getAccessibleSemesters()[currentSemIndex];
    if (!semester) return;
    const selected = semester.subjects.find(item => item.code === $('marks-subject').value) || semester.subjects[0];
    if (!selected) return;
    $('marks-subject').value = selected.code;
    $('marks-internal').value = selected.internal;
    $('marks-external').value = selected.external;
  }

  function renderSubjectDatabase(semester) {
    $('subject-db-tbody').innerHTML = semester.subjects.length ? semester.subjects.map(item => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${item.code}</td>
        <td>${item.credits}</td>
        <td>${item.total}</td>
        <td>${item.grade}</td>
        <td>
          ${canEditPortalData() ? `
          <div class="task-actions">
            <button class="btn-ghost" data-subject-edit="${item.code}">Edit</button>
            <button class="btn-ghost" data-subject-delete="${item.code}">Delete</button>
          </div>` : '<span class="locked-actions">Admin only</span>'}
        </td>
      </tr>
    `).join('') : `<tr><td colspan="6">No subjects yet</td></tr>`;

    $$('[data-subject-edit]').forEach(btn => btn.addEventListener('click', () => editSubject(btn.dataset.subjectEdit)));
    $$('[data-subject-delete]').forEach(btn => btn.addEventListener('click', () => deleteSubject(btn.dataset.subjectDelete)));
  }

  function editSubject(code) {
    if (!canEditPortalData()) {
      toast('Subject editing is locked for student view');
      return;
    }
    const semester = getAccessibleSemesters()[currentSemIndex];
    const subject = semester.subjects.find(item => item.code === code);
    if (!subject) return;
    $('subject-original-code').value = subject.code;
    $('subject-name').value = subject.name;
    $('subject-code').value = subject.code;
    $('subject-credits').value = subject.credits;
    $('subject-internal').value = subject.internal;
    $('subject-external').value = subject.external;
    $('subject-submit-btn').textContent = 'Save subject';
    $('subject-cancel-edit').classList.remove('hidden');
    $('subject-name').focus();
  }

  function deleteSubject(code) {
    if (!canEditPortalData()) {
      toast('Subject deletion is locked for student view');
      return;
    }
    const semester = getAccessibleSemesters()[currentSemIndex];
    if (!confirm(`Delete subject ${code}?`)) return;
    DataStore.deleteSubject(semester.sem, code);
    toast(`${code} deleted`);
    resetSubjectForm();
    renderPerformance();
  }

  function resetSubjectForm() {
    $('subject-form').reset();
    $('subject-original-code').value = '';
    $('subject-credits').value = 3;
    $('subject-internal').value = 0;
    $('subject-external').value = 0;
    $('subject-submit-btn').textContent = 'Add subject';
    $('subject-cancel-edit').classList.add('hidden');
  }

  function renderAttendance() {
    const attendance = DataStore.getAttendance();
    const limit = DataStore.getSettings().lowAttendanceLimit;
    const overall = average(attendance.map(item => item.percentage));

    $('att-overall-pct').textContent = `${overall.toFixed(1)}%`;
    drawAttendanceRing(overall);

    $('attendance-subject').innerHTML = attendance.map(item => `<option value="${item.code}">${item.code} - ${escapeHtml(item.subject)}</option>`).join('');
    fillAttendanceForm();

    $('att-grid').innerHTML = attendance.map(item => `
      <article class="glass-card att-card ${item.percentage < limit ? 'danger' : ''}">
        <div class="att-title">
          <strong>${escapeHtml(item.subject)}</strong>
          <span>${item.code}</span>
        </div>
        <div class="att-pct">${item.percentage.toFixed(1)}%</div>
        <div class="att-bar"><div style="width:${item.percentage}%"></div></div>
        <small class="text-muted">${item.attended}/${item.totalClasses} classes attended</small>
        ${canEditPortalData() ? `
        <div class="att-actions">
          <button class="btn-ghost" data-att-present="${item.code}">Present</button>
          <button class="btn-ghost" data-att-absent="${item.code}">Absent</button>
        </div>` : '<small class="locked-note">Attendance changes are handled by admin.</small>'}
      </article>
    `).join('');

    $$('[data-att-present]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canEditPortalData()) {
          toast('Attendance changes are locked for student view');
          return;
        }
        DataStore.markAttendance(btn.dataset.attPresent, true);
        toast('Marked present');
        renderAttendance();
      });
    });

    $$('[data-att-absent]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!canEditPortalData()) {
          toast('Attendance changes are locked for student view');
          return;
        }
        DataStore.markAttendance(btn.dataset.attAbsent, false);
        toast('Marked absent');
        renderAttendance();
      });
    });

    renderChart('attBar', $('chart-att-bar'), {
      type: 'bar',
      data: {
        labels: attendance.map(item => item.code),
        datasets: [
          {
            label: 'Attended',
            data: attendance.map(item => item.attended),
            backgroundColor: 'rgba(43,213,118,0.5)',
            borderColor: 'rgba(43,213,118,0.85)',
            borderWidth: 2,
            borderRadius: { topLeft: 12, topRight: 12 },
            borderSkipped: 'bottom',
            hoverBackgroundColor: 'rgba(43,213,118,0.78)',
          },
          {
            label: 'Missed',
            data: attendance.map(item => item.totalClasses - item.attended),
            backgroundColor: 'rgba(255,92,122,0.45)',
            borderColor: 'rgba(255,92,122,0.8)',
            borderWidth: 2,
            borderRadius: { topLeft: 12, topRight: 12 },
            borderSkipped: 'bottom',
            hoverBackgroundColor: 'rgba(255,92,122,0.72)',
          },
        ],
      },
      options: stackedChartOptions(),
    });
  }

  function fillAttendanceForm() {
    const selected = DataStore.getAttendance().find(item => item.code === $('attendance-subject').value) || DataStore.getAttendance()[0];
    if (!selected) return;
    $('attendance-subject').value = selected.code;
    $('attendance-attended').value = selected.attended;
    $('attendance-total').value = selected.totalClasses;
  }

  function drawAttendanceRing(percent) {
    const canvas = $('att-ring');
    const ctx = canvas.getContext('2d');
    const cx = 82, cy = 82, radius = 60;
    const isLow = percent < DataStore.getSettings().lowAttendanceLimit;
    const color = isLow ? '#ff5c7a' : '#2bd576';
    const glow = isLow ? 'rgba(255,92,122,0.35)' : 'rgba(43,213,118,0.35)';
    const target = (percent / 100) * Math.PI * 2;
    let progress = 0;
    const step = target / 36;

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 12;
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progress);
      ctx.stroke();
      ctx.restore();

      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progress);
      ctx.stroke();

      if (progress < target) {
        progress = Math.min(progress + step, target);
        requestAnimationFrame(frame);
      }
    }
    frame();
  }

  function renderQuizCategories() {
    clearInterval(quizState.timer);
    const bank = DataStore.getQuizBank();
    $('quiz-categories').style.display = '';
    $('quiz-play').classList.add('hidden');
    $('quiz-result').classList.add('hidden');
    $('quiz-categories').innerHTML = Object.keys(bank).map(category => `
      <button class="quiz-cat-card" data-cat="${escapeHtml(category)}">
        <strong>${escapeHtml(category)}</strong>
        <span>${bank[category].length} questions - 30 seconds each</span>
      </button>
    `).join('');
    $$('.quiz-cat-card').forEach(card => card.addEventListener('click', () => startQuiz(card.dataset.cat)));
    renderLeaderboard();
  }

  function startQuiz(category) {
    const source = DataStore.getQuizBank()[category];
    if (!source) return;
    quizState = {
      cat: category,
      questions: [...source].sort(() => Math.random() - 0.5).slice(0, 10),
      index: 0,
      correct: 0,
      timer: null,
      timeLeft: 30,
      startedAt: Date.now(),
    };
    $('quiz-categories').style.display = 'none';
    $('quiz-result').classList.add('hidden');
    $('quiz-play').classList.remove('hidden');
    $('quiz-cat-label').textContent = category;
    showQuestion();
  }

  function showQuestion() {
    const question = quizState.questions[quizState.index];
    $('quiz-progress').textContent = `${quizState.index + 1} / ${quizState.questions.length}`;
    $('quiz-question').textContent = question.q;
    $('quiz-options').innerHTML = question.options.map((option, index) => `
      <button class="quiz-opt" data-answer="${index}">${escapeHtml(option)}</button>
    `).join('');
    $$('.quiz-opt').forEach(btn => btn.addEventListener('click', () => answerQuiz(Number(btn.dataset.answer))));
    quizState.timeLeft = 30;
    $('quiz-timer').textContent = '30s';
    $('timer-fill').style.width = '100%';
    clearInterval(quizState.timer);
    quizState.timer = setInterval(() => {
      quizState.timeLeft -= 1;
      $('quiz-timer').textContent = `${quizState.timeLeft}s`;
      $('timer-fill').style.width = `${(quizState.timeLeft / 30) * 100}%`;
      if (quizState.timeLeft <= 0) answerQuiz(-1);
    }, 1000);
  }

  function answerQuiz(answerIndex) {
    clearInterval(quizState.timer);
    const question = quizState.questions[quizState.index];
    $$('.quiz-opt').forEach(btn => {
      const index = Number(btn.dataset.answer);
      btn.classList.add('disabled');
      if (index === question.answer) btn.classList.add('correct');
      if (index === answerIndex && answerIndex !== question.answer) btn.classList.add('wrong');
    });
    if (answerIndex === question.answer) quizState.correct += 1;
    setTimeout(() => {
      quizState.index += 1;
      if (quizState.index < quizState.questions.length) showQuestion();
      else endQuiz();
    }, 850);
  }

  function endQuiz() {
    const total = quizState.questions.length;
    const score = Math.round((quizState.correct / total) * 100);
    const elapsed = Math.round((Date.now() - quizState.startedAt) / 1000);

    $('quiz-play').classList.add('hidden');
    $('quiz-result').classList.remove('hidden');
    $('result-icon').textContent = score >= 80 ? 'Excellent' : score >= 50 ? 'Good effort' : 'Needs practice';
    $('result-title').textContent = `${score}% in ${quizState.cat}`;
    $('result-subtitle').textContent = `You answered ${quizState.correct} of ${total} correctly.`;
    $('rs-score').textContent = `${score}%`;
    $('rs-correct').textContent = quizState.correct;
    $('rs-wrong').textContent = total - quizState.correct;
    $('rs-time').textContent = `${elapsed}s`;

    DataStore.addQuizScore({
      cat: quizState.cat,
      score,
      correct: quizState.correct,
      total,
      time: elapsed,
      date: new Date().toLocaleDateString(),
    });
    renderLeaderboard();
    renderShell();
  }

  function renderLeaderboard() {
    const scores = DataStore.getQuizScores().slice(0, 10);
    $('leaderboard-empty').classList.toggle('hidden', scores.length > 0);
    $('leaderboard-tbody').innerHTML = scores.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.cat)}</td>
        <td>${item.score}%</td>
        <td>${item.correct}/${item.total}</td>
        <td>${item.time}s</td>
        <td>${escapeHtml(item.date || new Date(item.createdAt).toLocaleDateString())}</td>
      </tr>
    `).join('');
  }

  function renderTasks() {
    const tasks = filteredTasks();
    $('task-list').innerHTML = tasks.length ? tasks.map(item => `
      <article class="task-item ${item.done ? 'done' : ''}" data-task-id="${item.id}">
        <button class="task-check" data-task-toggle="${item.id}" ${canEditPortalData() ? '' : 'disabled'}>${item.done ? 'OK' : ''}</button>
        <strong class="task-text">${escapeHtml(item.text)}</strong>
        <span class="task-priority ${item.priority}">${escapeHtml(item.priority)}</span>
        <span class="task-deadline">${item.deadline || 'No date'}</span>
        <div class="task-actions">
          ${canEditPortalData() ? `
          <button class="btn-ghost" data-task-edit="${item.id}">Edit</button>
          <button class="btn-ghost" data-task-delete="${item.id}">Delete</button>` : '<span class="locked-actions">Admin only</span>'}
        </div>
      </article>
    `).join('') : emptyMarkup('No tasks match this filter');

    $$('[data-task-toggle]').forEach(btn => btn.addEventListener('click', () => {
      if (!canEditPortalData()) {
        toast('Task updates are locked for student view');
        return;
      }
      const task = DataStore.getTasks().find(item => item.id === btn.dataset.taskToggle);
      if (task) DataStore.updateTask(task.id, { done: !task.done });
      renderTasks();
      renderShell();
    }));

    $$('[data-task-edit]').forEach(btn => btn.addEventListener('click', () => editTask(btn.dataset.taskEdit)));
    $$('[data-task-delete]').forEach(btn => btn.addEventListener('click', () => {
      if (!canEditPortalData()) {
        toast('Task deletion is locked for student view');
        return;
      }
      DataStore.deleteTask(btn.dataset.taskDelete);
      toast('Task deleted');
      renderTasks();
      renderShell();
    }));
  }

  function filteredTasks() {
    const tasks = DataStore.getTasks();
    if (taskFilter === 'pending') return tasks.filter(item => !item.done);
    if (taskFilter === 'completed') return tasks.filter(item => item.done);
    if (['high', 'medium', 'low'].includes(taskFilter)) return tasks.filter(item => item.priority === taskFilter);
    return tasks;
  }

  function editTask(id) {
    if (!canEditPortalData()) {
      toast('Task editing is locked for student view');
      return;
    }
    const task = DataStore.getTasks().find(item => item.id === id);
    if (!task) return;
    $('task-edit-id').value = task.id;
    $('task-input').value = task.text;
    $('task-priority').value = task.priority;
    $('task-deadline').value = task.deadline || '';
    $('task-submit-btn').textContent = 'Save task';
    $('task-cancel-edit').classList.remove('hidden');
    $('task-input').focus();
  }

  function resetTaskForm() {
    $('task-form').reset();
    $('task-edit-id').value = '';
    $('task-priority').value = 'medium';
    $('task-submit-btn').textContent = 'Add task';
    $('task-cancel-edit').classList.add('hidden');
  }

  function renderPortfolio() {
    const user = DataStore.getUser();
    const pfAvatar = $('pf-avatar');
    if (user.avatar) {
      pfAvatar.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      pfAvatar.textContent = initials(user.name);
    }
    $('pf-about-name').textContent = user.name || 'Student';
    $('pf-about-bio').textContent = `${user.branch || 'Computer Science'} student passionate about web development, AI, and building impactful software solutions.`;
    $('pf-about-college').textContent = [user.school, user.college].filter(Boolean).join(' - ');

    const skills = [
      { name: 'HTML / CSS', level: 90 },
      { name: 'JavaScript', level: 82 },
      { name: 'Python', level: 75 },
      { name: 'Java', level: 70 },
      { name: 'Data Structures', level: 78 },
      { name: 'React / Next.js', level: 60 },
      { name: 'Git & GitHub', level: 85 },
      { name: 'Database (SQL)', level: 68 },
    ];
    $('skills-grid').innerHTML = skills.map(s => `
      <div class="skill-item">
        <span>${escapeHtml(s.name)} <span>${s.level}%</span></span>
        <div class="skill-bar"><div class="skill-fill" data-level="${s.level}"></div></div>
      </div>
    `).join('');
    setTimeout(() => {
      $$('.skill-fill').forEach(el => { el.style.width = el.dataset.level + '%'; });
    }, 80);

    const achievements = [
      { icon: '🏆', title: 'Dean\'s List', desc: 'Sem 1 & 2' },
      { icon: '💻', title: '6+ Projects', desc: 'Portfolio built' },
      { icon: '📊', title: 'CGPA 8.5+', desc: 'Consistent performer' },
      { icon: '🎯', title: 'Quiz Master', desc: '80%+ avg score' },
      { icon: '📅', title: '90% Attendance', desc: 'Regular student' },
      { icon: '🚀', title: 'Hackathon', desc: 'Top 10 finisher' },
    ];
    $('achievements-grid').innerHTML = achievements.map(a => `
      <div class="achievement-card">
        <span class="achievement-icon">${a.icon}</span>
        <strong>${escapeHtml(a.title)}</strong>
        <small>${escapeHtml(a.desc)}</small>
      </div>
    `).join('');

    const projects = DataStore.getPortfolio();
    const visible = portfolioFilter === 'all' ? projects : projects.filter(item => item.category === portfolioFilter);
    $('portfolio-grid').innerHTML = visible.length ? visible.map(item => `
      <button class="pf-card" data-project-id="${item.id}">
        <div class="pf-image" ${item.imageUrl ? `style="background-image:url('${escapeAttr(item.imageUrl)}')"` : ''}></div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.desc || 'No description added yet.')}</p>
        <div class="pf-tags">${item.tech.map(tag => `<span class="pf-tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </button>
    `).join('') : emptyMarkup('No projects in this category');

    $$('[data-project-id]').forEach(card => card.addEventListener('click', () => showProject(card.dataset.projectId)));
    const heading = document.querySelector('#page-portfolio .glass-card h3');
    if (heading && heading.textContent === 'Add project') heading.textContent = canEditPortalData() ? 'Add project' : 'Projects are managed by admin';
  }

  function showProject(id) {
    const project = DataStore.getPortfolio().find(item => item.id === id);
    if (!project) return;
    $('modal-body').innerHTML = `
      <div class="pf-image" ${project.imageUrl ? `style="height:190px;background-image:url('${escapeAttr(project.imageUrl)}')"` : 'style="height:150px"'}></div>
      <h2>${escapeHtml(project.title)}</h2>
      <p class="text-muted">${escapeHtml(project.desc || '')}</p>
      <div class="pf-tags">${project.tech.map(tag => `<span class="pf-tag">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="button-row" style="margin-top:18px">
        ${project.liveUrl ? `<a class="btn-primary" href="${escapeAttr(project.liveUrl)}" target="_blank" rel="noreferrer">Open live</a>` : ''}
        ${project.repoUrl ? `<a class="btn-ghost" href="${escapeAttr(project.repoUrl)}" target="_blank" rel="noreferrer">Repository</a>` : ''}
      </div>
    `;
    $('modal-overlay').classList.remove('hidden');
  }

  function closeModal() {
    $('modal-overlay').classList.add('hidden');
  }

  function renderAnalytics() {
    const tasks = DataStore.getTasks();
    const attendance = DataStore.getAttendance();
    const activity = DataStore.getActivity();
    const completed = tasks.length ? Math.round((tasks.filter(item => item.done).length / tasks.length) * 100) : 0;

    $('analytics-completion').textContent = `${completed}%`;
    $('analytics-low-att').textContent = attendance.filter(item => item.percentage < DataStore.getSettings().lowAttendanceLimit).length;
    $('analytics-projects').textContent = DataStore.getPortfolio().length;
    $('analytics-events').textContent = activity.length;
    renderActivity('analytics-activity', 14);

    const priorities = ['high', 'medium', 'low'];
    renderChart('taskPriority', $('chart-task-priority'), {
      type: 'doughnut',
      data: {
        labels: priorities.map(capitalize),
        datasets: [{
          data: priorities.map(priority => tasks.filter(item => item.priority === priority).length),
          backgroundColor: ['rgba(255,92,122,0.72)', 'rgba(255,190,69,0.72)', 'rgba(43,213,118,0.72)'],
          borderColor: ['rgba(255,92,122,0.95)', 'rgba(255,190,69,0.95)', 'rgba(43,213,118,0.95)'],
          borderWidth: 2,
          hoverBackgroundColor: ['#ff5c7a', '#ffbe45', '#2bd576'],
          hoverBorderColor: '#ffffff',
          hoverBorderWidth: 3,
          hoverOffset: 10,
          spacing: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        animation: { animateRotate: true, duration: 1000, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: getChartTextColor(),
              font: { size: 12, weight: 600 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 20,
            },
          },
          tooltip: tooltipConfig(),
        },
      },
    });
  }

  function renderActivity(targetId, limit) {
    const activity = DataStore.getActivity().slice(0, limit);
    $(targetId).innerHTML = activity.length ? activity.map(item => `
      <article class="compact-item">
        <div>
          <strong>${escapeHtml(item.text)}</strong>
          <small>${escapeHtml(item.type)} - ${timeAgo(item.time)}</small>
        </div>
      </article>
    `).join('') : emptyMarkup('No activity recorded yet');
  }

  function renderProfile() {
    const user = DataStore.getUser();
    const settings = DataStore.getSettings();
    $('profile-name').value = user.name || '';
    $('profile-roll').value = user.rollNo || '';
    $('profile-school').value = user.school || '';
    $('profile-email').value = user.email || '';
    $('profile-phone').value = user.phone || '';
    $('profile-college').value = user.college || '';
    $('profile-branch').value = user.branch || '';
    $('profile-semester').value = user.semester || 1;
    $('settings-att-limit').value = settings.lowAttendanceLimit || 75;
    $('settings-login-id').value = settings.loginId || user.rollNo || user.email || '';
    $('settings-login-password').value = settings.loginPassword || '';
    $('settings-theme').value = themes.some(theme => theme.id === settings.theme) ? settings.theme : 'amrita';
    renderProfileAvatar(user);
  }

  function renderProfileAvatar(user) {
    const preview = $('profile-avatar-preview');
    if (!preview) return;
    if (user.avatar) {
      preview.innerHTML = `<img src="${user.avatar}" alt="Profile">`;
    } else {
      preview.textContent = initials(user.name);
    }
  }

  function initProfileAvatar() {
    const input = $('profile-avatar-input');
    const remove = $('profile-avatar-remove');
    if (!input || !remove) return;
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        toast('Image must be under 2 MB');
        e.target.value = '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        toast('Please select an image file');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        DataStore.saveUser({ avatar: reader.result }, { silent: true });
        renderProfileAvatar(DataStore.getUser());
        renderShell();
        toast('Profile picture updated');
      };
      reader.readAsDataURL(file);
    });

    remove.addEventListener('click', () => {
      DataStore.saveUser({ avatar: '' }, { silent: true });
      renderProfileAvatar(DataStore.getUser());
      renderShell();
      toast('Profile picture removed');
    });
  }

  function renderChart(key, canvas, config) {
    if (!canvas || !window.Chart) return;
    if (charts[key]) charts[key].destroy();
    charts[key] = new Chart(canvas, config);
  }

  function tooltipConfig() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      backgroundColor: light ? 'rgba(255,255,255,0.94)' : 'rgba(15,17,28,0.94)',
      titleColor: light ? '#151827' : '#f4f6fb',
      bodyColor: light ? 'rgba(21,24,39,0.78)' : 'rgba(244,246,251,0.8)',
      borderColor: light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      cornerRadius: 10,
      padding: { x: 14, y: 10 },
      titleFont: { size: 13, weight: '700' },
      bodyFont: { size: 12, weight: '500' },
      displayColors: true,
      boxPadding: 5,
      usePointStyle: true,
      caretSize: 6,
    };
  }

  function chartOptions(max) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: tooltipConfig(),
      },
      scales: {
        x: axisOptions(),
        y: { ...axisOptions(), beginAtZero: true, max },
      },
    };
  }

  function stackedChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: getChartTextColor(),
            font: { size: 12, weight: 600 },
            usePointStyle: true,
            pointStyle: 'roundRect',
            padding: 18,
          },
        },
        tooltip: tooltipConfig(),
      },
      scales: {
        x: { ...axisOptions(), stacked: true },
        y: { ...axisOptions(), stacked: true, beginAtZero: true },
      },
    };
  }

  function axisOptions() {
    return {
      ticks: { color: getChartTextColor(), font: { size: 11, weight: 500 }, padding: 8 },
      grid: { color: getChartGridColor(), borderDash: [4, 4] },
      border: { display: false },
    };
  }

  function getChartTextColor() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(21,24,39,.62)' : 'rgba(244,246,251,.58)';
  }

  function getChartGridColor() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(21,24,39,.06)' : 'rgba(255,255,255,.06)';
  }

  function average(values) {
    const nums = values.filter(value => Number.isFinite(value));
    return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 0;
  }

  function startOfToday() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  function initials(name) {
    return String(name || 'Student')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  }

  function capitalize(value) {
    return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1);
  }

  function themeLabel(themeId) {
    return themes.find(theme => theme.id === themeId)?.label || 'Amrita Glow';
  }

  function timeAgo(time) {
    const seconds = Math.max(0, Math.floor((Date.now() - Number(time)) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function emptyMarkup(text) {
    return `<p class="empty-state">${escapeHtml(text)}</p>`;
  }

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    $('toast-root').appendChild(node);
    setTimeout(() => node.remove(), 2600);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
  }

  // ── STORE MODULE ──
  const productEmoji = {
    'stationery': '📒',
    'electronics': '⚡',
    'books': '📚',
    'accessories': '🎒',
  };

  function initStore() {
    $('store-search').addEventListener('input', e => {
      storeSearch = e.target.value.toLowerCase();
      renderStore();
    });
    $('store-filter').addEventListener('change', e => {
      storeCategory = e.target.value;
      renderStore();
    });
  }

  function renderStore() {
    let products = DataStore.getStoreProducts();
    if (storeCategory !== 'all') products = products.filter(p => p.category === storeCategory);
    if (storeSearch) products = products.filter(p => p.name.toLowerCase().includes(storeSearch) || p.desc.toLowerCase().includes(storeSearch));

    $('store-grid').innerHTML = products.length ? products.map((p, i) => `
      <div class="product-card" style="animation-delay:${i * 0.06}s">
        <div class="product-image">
          <span class="product-icon">${productEmoji[p.category] || '📦'}</span>
          ${p.rating >= 4.7 ? '<span class="product-badge">Popular</span>' : ''}
        </div>
        <div class="product-body">
          <h4>${escapeHtml(p.name)}</h4>
          <p>${escapeHtml(p.desc)}</p>
          <div class="product-meta">
            <span class="product-price">₹${p.price}</span>
            <span class="product-rating">★ ${p.rating}</span>
          </div>
        </div>
        <button class="btn-primary" data-add-cart="${p.id}">Add to Cart</button>
      </div>
    `).join('') : emptyMarkup('No products found');

    $$('[data-add-cart]').forEach(btn => {
      btn.addEventListener('click', () => {
        DataStore.addToCart(btn.dataset.addCart);
        toast('Added to cart');
        renderShell();
      });
    });
  }

  // ── CART MODULE ──
  function initCart() {
    $('cart-btn').addEventListener('click', e => {
      e.stopPropagation();
      openCart();
    });
    $('cart-close').addEventListener('click', closeCart);
    $('cart-backdrop').addEventListener('click', closeCart);
    $('cart-clear').addEventListener('click', () => {
      DataStore.clearCart();
      renderCartSidebar();
      renderShell();
      toast('Cart cleared');
    });
    $('cart-checkout').addEventListener('click', () => {
      if (DataStore.getCartCount() === 0) return toast('Cart is empty');
      toast('Checkout is a demo — thanks for browsing!');
      DataStore.clearCart();
      renderCartSidebar();
      renderShell();
    });
  }

  function openCart() {
    renderCartSidebar();
    $('cart-sidebar').classList.add('open');
    $('cart-backdrop').classList.add('open');
  }

  function closeCart() {
    $('cart-sidebar').classList.remove('open');
    $('cart-backdrop').classList.remove('open');
  }

  function renderCartSidebar() {
    const cart = DataStore.getCart();
    const products = DataStore.getStoreProducts();

    if (!cart.length) {
      $('cart-body').innerHTML = emptyMarkup('Your cart is empty');
      $('cart-total-amount').textContent = '₹0';
      return;
    }

    $('cart-body').innerHTML = cart.map(item => {
      const p = products.find(pr => pr.id === item.productId);
      if (!p) return '';
      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <strong>${escapeHtml(p.name)}</strong>
            <small>₹${p.price} each</small>
          </div>
          <div>
            <div class="cart-item-controls">
              <button class="cart-qty-btn" data-cart-minus="${p.id}">−</button>
              <span class="cart-qty">${item.qty}</span>
              <button class="cart-qty-btn" data-cart-plus="${p.id}">+</button>
            </div>
            <button class="cart-remove" data-cart-remove="${p.id}">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    $('cart-total-amount').textContent = `₹${DataStore.getCartTotal()}`;

    $$('[data-cart-plus]').forEach(btn => btn.addEventListener('click', () => {
      const ci = DataStore.getCart().find(i => i.productId === btn.dataset.cartPlus);
      if (ci) DataStore.updateCartQty(btn.dataset.cartPlus, ci.qty + 1);
      renderCartSidebar();
      renderShell();
    }));

    $$('[data-cart-minus]').forEach(btn => btn.addEventListener('click', () => {
      const ci = DataStore.getCart().find(i => i.productId === btn.dataset.cartMinus);
      if (ci) DataStore.updateCartQty(btn.dataset.cartMinus, ci.qty - 1);
      renderCartSidebar();
      renderShell();
    }));

    $$('[data-cart-remove]').forEach(btn => btn.addEventListener('click', () => {
      DataStore.removeFromCart(btn.dataset.cartRemove);
      renderCartSidebar();
      renderShell();
      toast('Item removed');
    }));
  }

  // ── CONTACT FORM ──
  function initContactForm() {
    const form = $('contact-form');
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      let valid = true;
      const name = $('contact-name').value.trim();
      const email = $('contact-email').value.trim();
      const subject = $('contact-subject').value.trim();
      const message = $('contact-message').value.trim();

      $('err-contact-name').textContent = '';
      $('err-contact-email').textContent = '';
      $('err-contact-subject').textContent = '';
      $('err-contact-msg').textContent = '';

      if (!name) { $('err-contact-name').textContent = 'Name is required'; valid = false; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('err-contact-email').textContent = 'Valid email required'; valid = false; }
      if (!subject) { $('err-contact-subject').textContent = 'Subject is required'; valid = false; }
      if (!message) { $('err-contact-msg').textContent = 'Message is required'; valid = false; }

      if (!valid) return;
      toast('Message sent successfully! (demo)');
      form.reset();
      DataStore.addActivity('Contact form submitted', 'portfolio');
    });
  }
});
