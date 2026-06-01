// Student Portal data layer.
// This keeps the current app usable with localStorage while matching the
// document shapes that should later move to Firebase Auth + Firestore.

const DataStore = (() => {
  'use strict';

  const KEYS = {
    USER: 'sp_user',
    TASKS: 'sp_tasks',
    QUIZ_SCORES: 'sp_quiz_scores',
    MARKS: 'sp_marks',
    ATTENDANCE: 'sp_attendance',
    NOTIFICATIONS: 'sp_notifications',
    PORTFOLIO: 'sp_portfolio',
    SETTINGS: 'sp_settings',
    ACTIVITY: 'sp_activity',
    MIGRATION: 'sp_migration_profile',
    STORE_CART: 'sp_store_cart',
  };

  const DEFAULT_USER = {
    uid: 'local-student-user',
    role: 'student',
    name: 'Student Name',
    rollNo: 'ROLL-001',
    school: 'School Name',
    branch: 'Computer Science & Engineering',
    semester: 2,
    email: 'student@example.com',
    phone: '0000000000',
    college: 'College Name',
    avatar: '',
    loggedIn: false,
  };

  const DEFAULT_SETTINGS = {
    theme: 'amrita',
    lowAttendanceLimit: 75,
    notificationsEnabled: true,
    loginId: 'student',
    loginPassword: 'student123',
    adminLoginId: 'admin',
    adminPassword: 'admin123',
  };

  const PROFILE_MIGRATION_VERSION = 'generic-student-profile-v1';

  const DEFAULT_MARKS = {
    semesters: [
      {
        sem: 1,
        subjects: [
          subject('Mathematics I', 'MA101', 4, 38, 52),
          subject('Physics', 'PH101', 4, 35, 45),
          subject('Chemistry', 'CH101', 3, 30, 40),
          subject('English', 'EN101', 2, 40, 48),
          subject('Programming in C', 'CS101', 4, 42, 50),
        ],
      },
      {
        sem: 2,
        subjects: [
          subject('Mathematics II', 'MA201', 4, 36, 48),
          subject('Data Structures', 'CS201', 4, 40, 52),
          subject('Digital Electronics', 'EC201', 3, 28, 42),
          subject('Environmental Science', 'EV201', 2, 35, 40),
          subject('OOP with Java', 'CS202', 4, 44, 48),
        ],
      },
      {
        sem: 3,
        subjects: [
          subject('Mathematics III', 'MA301', 4, 32, 44),
          subject('Database Management', 'CS301', 4, 42, 50),
          subject('Computer Networks', 'CS302', 3, 34, 46),
          subject('Operating Systems', 'CS303', 4, 38, 48),
          subject('Web Technologies', 'CS304', 3, 45, 50),
        ],
      },
      {
        sem: 4,
        subjects: [
          subject('Design & Analysis of Algorithms', 'CS401', 4, 40, 0),
          subject('Software Engineering', 'CS402', 3, 38, 0),
          subject('Artificial Intelligence', 'CS403', 4, 42, 0),
          subject('Computer Architecture', 'CS404', 3, 35, 0),
          subject('Discrete Mathematics', 'MA401', 3, 36, 0),
        ],
      },
    ],
  };

  const DEFAULT_ATTENDANCE = [
    { subject: 'Design & Analysis of Algorithms', code: 'CS401', totalClasses: 42, attended: 38 },
    { subject: 'Software Engineering', code: 'CS402', totalClasses: 36, attended: 30 },
    { subject: 'Artificial Intelligence', code: 'CS403', totalClasses: 40, attended: 36 },
    { subject: 'Computer Architecture', code: 'CS404', totalClasses: 38, attended: 26 },
    { subject: 'Discrete Mathematics', code: 'MA401', totalClasses: 34, attended: 28 },
  ];

  const DEFAULT_TASKS = [
    task('Complete DAA assignment on Dynamic Programming', 'high', '2026-05-08', 'assignment'),
    task('Prepare for AI mid-semester exam', 'high', '2026-05-12', 'exam'),
    task('Submit Software Engineering project report', 'medium', '2026-05-10', 'project'),
    task('Read Chapter 5 - Computer Architecture', 'low', '2026-05-04', 'study', true),
    task('Practice discrete math proofs', 'medium', '2026-05-15', 'study'),
  ];

  const DEFAULT_NOTIFICATIONS = [
    notification('DAA assignment due in 3 days', 'warning', Date.now() - 3600000),
    notification('New quiz available: Data Structures', 'info', Date.now() - 7200000),
    notification('AI mid-semester exam on May 12', 'alert', Date.now() - 86400000),
    notification('Attendance below 75% in Computer Architecture', 'danger', Date.now() - 172800000),
    { ...notification('Semester 3 results published - SGPA: 9.44', 'success', Date.now() - 604800000), read: true },
  ];

  const DEFAULT_PORTFOLIO = [
    project('Student Portal', 'A full-featured SPA student dashboard with glassmorphism design.', 'dev', ['HTML', 'CSS', 'JavaScript']),
    project('Chat Application', 'Real-time chat app concept with rooms, typing state, and message history.', 'dev', ['Node.js', 'Socket.io']),
    project('Brand Identity Kit', 'A visual identity package for a college tech club.', 'design', ['Figma', 'Illustrator']),
    project('ML Sentiment Analyzer', 'NLP experiment to classify text sentiment from student feedback.', 'experiment', ['Python', 'scikit-learn']),
    project('E-Commerce UI', 'Responsive storefront UI with animated product cards.', 'design', ['CSS', 'JavaScript']),
    project('IoT Weather Station', 'Arduino-based weather monitoring dashboard concept.', 'experiment', ['Arduino', 'Firebase']),
  ];

  const QUIZ_BANK = {
    'Data Structures': [
      quiz('What is the time complexity of binary search?', ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'], 1),
      quiz('Which data structure uses FIFO?', ['Stack', 'Queue', 'Tree', 'Graph'], 1),
      quiz('What is the worst case of quicksort?', ['O(n log n)', 'O(n)', 'O(n^2)', 'O(log n)'], 2),
      quiz('A complete binary tree with n nodes has height:', ['O(n)', 'O(log n)', 'O(n^2)', 'O(sqrt n)'], 1),
      quiz('Which traversal gives sorted order in a BST?', ['Preorder', 'Postorder', 'Inorder', 'Level order'], 2),
      quiz('Hash table average search time is:', ['O(n)', 'O(log n)', 'O(1)', 'O(n^2)'], 2),
      quiz('Which algorithm can create a minimum spanning tree?', ['Dijkstra', 'Kruskal', 'Bellman-Ford', 'Floyd'], 1),
      quiz('A stack is commonly used in:', ['BFS', 'DFS', 'Both', 'Neither'], 1),
      quiz('AVL tree is a type of:', ['B-tree', 'Self-balancing BST', 'Heap', 'Trie'], 1),
      quiz('Linked list advantage over array:', ['Random access', 'Dynamic size', 'Cache locality', 'Less memory always'], 1),
    ],
    'Operating Systems': [
      quiz('Which scheduling algorithm is non-preemptive by default?', ['Round Robin', 'FCFS', 'SJF Preemptive', 'Priority Preemptive'], 1),
      quiz('Deadlock requires how many necessary conditions?', ['2', '3', '4', '5'], 2),
      quiz('Virtual memory uses:', ['RAM only', 'Disk only', 'RAM + Disk', 'Cache only'], 2),
      quiz('Which is a page replacement algorithm?', ['FCFS', 'LRU', 'SJF', 'Round Robin'], 1),
      quiz('Semaphore is used for:', ['Memory management', 'Synchronization', 'Scheduling', 'I/O buffering'], 1),
      quiz('Thrashing occurs when there is:', ['Too much CPU', 'Too much paging', 'Too many files', 'Disk corruption'], 1),
      quiz('Which is not a process state?', ['Ready', 'Running', 'Compiling', 'Blocked'], 2),
      quiz("Banker's algorithm handles:", ['Starvation', 'Deadlock avoidance', 'Thrashing', 'Fragmentation'], 1),
      quiz('Context switching is handled by:', ['Compiler', 'OS kernel', 'User', 'Browser'], 1),
      quiz('RAID stands for:', ['Random Array of Inexpensive Disks', 'Redundant Array of Independent Disks', 'Reliable Array of Input Data', 'None'], 1),
    ],
    'Database Management': [
      quiz('SQL stands for:', ['Structured Query Language', 'Simple Query Language', 'Standard Query Logic', 'None'], 0),
      quiz('Primary key allows:', ['Duplicates', 'Nulls', 'Neither duplicates nor nulls', 'Both'], 2),
      quiz('Which normal form removes transitive dependency?', ['1NF', '2NF', '3NF', 'BCNF'], 2),
      quiz('JOIN combines:', ['Rows of same table only', 'Rows from related tables', 'Columns only', 'Indexes only'], 1),
      quiz('ACID means:', ['Atomicity, Consistency, Isolation, Durability', 'All Correct Input Data', 'Automatic Control of Input Data', 'None'], 0),
      quiz('Foreign key references:', ['Same table only', 'Primary key of another table', 'Any column', 'Index'], 1),
      quiz('Which is a NoSQL database?', ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle'], 2),
      quiz('Index usually improves:', ['Insert speed', 'Query speed', 'Delete speed', 'Storage compression'], 1),
      quiz('A view in SQL is a:', ['Physical table', 'Virtual table', 'Index', 'Procedure'], 1),
      quiz('Which is a transaction isolation level?', ['READ COMMITTED', 'COMPILED', 'EXECUTED', 'LINKED'], 0),
    ],
    'Computer Networks': [
      quiz('HTTP default port:', ['21', '22', '80', '443'], 2),
      quiz('TCP is:', ['Connectionless', 'Connection-oriented', 'Both', 'Neither'], 1),
      quiz('IPv4 has how many bits?', ['16', '32', '64', '128'], 1),
      quiz('DNS resolves:', ['IP to MAC', 'Domain to IP', 'Port to process', 'MAC to IP'], 1),
      quiz('Which OSI layer handles routing?', ['Physical', 'Data Link', 'Network', 'Transport'], 2),
      quiz('UDP is:', ['Reliable', 'Unreliable', 'Connection-oriented', 'Encrypted by default'], 1),
      quiz('Subnet mask 255.255.255.0 means:', ['/8', '/16', '/24', '/32'], 2),
      quiz('FTP commonly uses ports:', ['20/21', '22', '80', '443'], 0),
      quiz('OSI model has how many layers?', ['5', '6', '7', '8'], 2),
      quiz('ARP resolves:', ['IP to MAC', 'MAC to IP', 'Domain to IP', 'IP to Domain'], 0),
    ],
    'General Knowledge': [
      quiz('Who invented the World Wide Web?', ['Bill Gates', 'Tim Berners-Lee', 'Steve Jobs', 'Mark Zuckerberg'], 1),
      quiz('Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Saturn'], 1),
      quiz('Chemical symbol for Gold:', ['Go', 'Gd', 'Au', 'Ag'], 2),
      quiz('How many continents are there?', ['5', '6', '7', '8'], 2),
      quiz('Who painted the Mona Lisa?', ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], 2),
      quiz('Largest ocean:', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3),
      quiz('DNA stands for:', ['Deoxyribonucleic Acid', 'Dinitrogen Acid', 'Dynamic Nucleic Acid', 'None'], 0),
      quiz('Approximate speed of light:', ['3x10^6 m/s', '3x10^8 m/s', '3x10^10 m/s', '3x10^4 m/s'], 1),
      quiz('Which gas do plants absorb?', ['O2', 'N2', 'CO2', 'H2'], 2),
      quiz('First computer programmer in history:', ['Alan Turing', 'Ada Lovelace', 'Charles Babbage', 'Grace Hopper'], 1),
    ],
  };

  const STORE_PRODUCTS = [
    { id: 'prod-1', name: 'Premium Notebook Pack', desc: 'Set of 5 ruled notebooks with premium paper, perfect for lectures.', price: 249, category: 'stationery', image: '', rating: 4.5 },
    { id: 'prod-2', name: 'Scientific Calculator', desc: 'Casio FX-991EX advanced scientific calculator for engineering.', price: 1499, category: 'electronics', image: '', rating: 4.8 },
    { id: 'prod-3', name: 'USB-C Hub Dock', desc: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card, and PD charging.', price: 1899, category: 'electronics', image: '', rating: 4.3 },
    { id: 'prod-4', name: 'Mechanical Pencil Set', desc: 'Precision 0.5mm mechanical pencils with extra lead refills.', price: 199, category: 'stationery', image: '', rating: 4.6 },
    { id: 'prod-5', name: 'Wireless Earbuds', desc: 'Noise-cancelling TWS earbuds with 30hr battery, ideal for study.', price: 2499, category: 'electronics', image: '', rating: 4.7 },
    { id: 'prod-6', name: 'DSA Textbook', desc: 'Introduction to Algorithms (CLRS) — 4th Edition hardcover.', price: 899, category: 'books', image: '', rating: 4.9 },
    { id: 'prod-7', name: 'Laptop Stand', desc: 'Ergonomic aluminium laptop riser with adjustable height.', price: 1299, category: 'accessories', image: '', rating: 4.4 },
    { id: 'prod-8', name: 'Desk Organizer', desc: 'Multi-compartment wooden desk caddy for pens, cables & gadgets.', price: 599, category: 'accessories', image: '', rating: 4.2 },
    { id: 'prod-9', name: 'Coding Poster Set', desc: 'Set of 3 cheat-sheet posters: Git, Linux, and Big-O complexity.', price: 349, category: 'stationery', image: '', rating: 4.1 },
    { id: 'prod-10', name: 'Blue Light Glasses', desc: 'Anti-blue-light glasses to reduce eye strain during screen time.', price: 699, category: 'accessories', image: '', rating: 4.5 },
  ];

  function subject(name, code, credits, internal, external) {
    return applyGrade({ name, code, credits, internal, external });
  }

  function task(text, priority, deadline, category, done = false) {
    return {
      id: cryptoId(),
      text,
      done,
      priority,
      deadline,
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function project(title, desc, category, tech) {
    return {
      id: cryptoId(),
      title,
      desc,
      category,
      tech,
      imageUrl: '',
      repoUrl: '',
      liveUrl: '',
      createdAt: Date.now(),
    };
  }

  function notification(text, type, time = Date.now()) {
    return { id: cryptoId(), text, type, time, read: false };
  }

  function quiz(q, options, answer) {
    return { q, options, answer };
  }

  function cryptoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function ensure(key, value) {
    if (!load(key)) save(key, value);
  }

  function init() {
    ensure(KEYS.USER, DEFAULT_USER);
    ensure(KEYS.MARKS, DEFAULT_MARKS);
    ensure(KEYS.ATTENDANCE, normalizeAttendance(DEFAULT_ATTENDANCE));
    ensure(KEYS.TASKS, DEFAULT_TASKS);
    ensure(KEYS.QUIZ_SCORES, []);
    ensure(KEYS.NOTIFICATIONS, DEFAULT_NOTIFICATIONS);
    ensure(KEYS.PORTFOLIO, DEFAULT_PORTFOLIO);
    ensure(KEYS.SETTINGS, DEFAULT_SETTINGS);
    ensure(KEYS.ACTIVITY, []);
    ensure(KEYS.STORE_CART, []);
    migrateRequestedProfile();
  }

  function migrateRequestedProfile() {
    if (localStorage.getItem(KEYS.MIGRATION) === PROFILE_MIGRATION_VERSION) return;
    const currentUser = load(KEYS.USER) || DEFAULT_USER;
    const currentSettings = load(KEYS.SETTINGS) || DEFAULT_SETTINGS;
    save(KEYS.USER, {
      ...currentUser,
      role: currentUser.role || DEFAULT_USER.role,
      name: DEFAULT_USER.name,
      rollNo: DEFAULT_USER.rollNo,
      school: DEFAULT_USER.school,
      college: DEFAULT_USER.college,
      semester: DEFAULT_USER.semester,
      email: DEFAULT_USER.email,
      phone: DEFAULT_USER.phone,
      branch: DEFAULT_USER.branch,
      avatar: '',
      updatedAt: Date.now(),
    });
    save(KEYS.SETTINGS, {
      ...DEFAULT_SETTINGS,
      ...currentSettings,
      loginId: DEFAULT_SETTINGS.loginId,
      loginPassword: DEFAULT_SETTINGS.loginPassword,
      theme: currentSettings.theme === 'dark' || currentSettings.theme === 'light' ? DEFAULT_SETTINGS.theme : currentSettings.theme,
    });
    localStorage.setItem(KEYS.MIGRATION, PROFILE_MIGRATION_VERSION);
  }

  function getUser() {
    return { ...DEFAULT_USER, ...(load(KEYS.USER) || {}) };
  }

  function saveUser(user, options = {}) {
    save(KEYS.USER, { ...getUser(), ...user, updatedAt: Date.now() });
    if (!options.silent) addActivity('Profile updated', 'profile');
  }

  function getSettings() {
    return { ...DEFAULT_SETTINGS, ...(load(KEYS.SETTINGS) || {}) };
  }

  function saveSettings(settings) {
    save(KEYS.SETTINGS, { ...getSettings(), ...settings });
  }

  function getMarks() {
    const marks = load(KEYS.MARKS) || DEFAULT_MARKS;
    marks.semesters.forEach(sem => {
      sem.subjects = sem.subjects.map(applyGrade);
    });
    return marks;
  }

  function saveMarks(marks) {
    save(KEYS.MARKS, marks);
  }

  function upsertSubject(semNumber, payload) {
    const marks = getMarks();
    const sem = marks.semesters.find(item => Number(item.sem) === Number(semNumber));
    if (!sem) return null;
    const code = String(payload.code || '').trim().toUpperCase();
    const name = String(payload.name || '').trim();
    if (!code || !name) return null;
    const existing = sem.subjects.find(item => item.code === code);
    const nextSubject = applyGrade({
      name,
      code,
      credits: Math.max(1, Number(payload.credits) || 1),
      internal: Number(payload.internal) || 0,
      external: Number(payload.external) || 0,
    });

    if (existing) {
      Object.assign(existing, nextSubject);
      addActivity(`Updated subject ${code}`, 'performance');
      pushNotification(`Subject updated: ${code}`, 'success');
    } else {
      sem.subjects.push(nextSubject);
      addActivity(`Added subject ${code}`, 'performance');
      pushNotification(`Subject added: ${code}`, 'success');
    }

    saveMarks(marks);
    return nextSubject;
  }

  function deleteSubject(semNumber, code) {
    const marks = getMarks();
    const sem = marks.semesters.find(item => Number(item.sem) === Number(semNumber));
    if (!sem) return false;
    const before = sem.subjects.length;
    sem.subjects = sem.subjects.filter(item => item.code !== code);
    if (sem.subjects.length === before) return false;
    saveMarks(marks);
    addActivity(`Deleted subject ${code}`, 'performance');
    pushNotification(`Subject deleted: ${code}`, 'warning');
    return true;
  }

  function updateSubjectMark(semNumber, code, internal, external) {
    const marks = getMarks();
    const sem = marks.semesters.find(item => Number(item.sem) === Number(semNumber));
    if (!sem) return null;
    const target = sem.subjects.find(item => item.code === code);
    if (!target) return null;
    target.internal = clamp(Number(internal), 0, 50);
    target.external = clamp(Number(external), 0, 50);
    applyGrade(target);
    saveMarks(marks);
    addActivity(`Updated marks for ${target.code}`, 'performance');
    pushNotification(`Marks updated for ${target.code}`, 'success');
    return target;
  }

  function getAttendance() {
    return normalizeAttendance(load(KEYS.ATTENDANCE) || DEFAULT_ATTENDANCE);
  }

  function saveAttendance(attendance) {
    save(KEYS.ATTENDANCE, normalizeAttendance(attendance));
  }

  function updateAttendance(code, attended, totalClasses) {
    const attendance = getAttendance();
    const row = attendance.find(item => item.code === code);
    if (!row) return null;
    row.totalClasses = Math.max(0, Number(totalClasses) || 0);
    row.attended = clamp(Number(attended) || 0, 0, row.totalClasses);
    saveAttendance(attendance);
    addActivity(`Updated attendance for ${row.code}`, 'attendance');
    if (row.percentage < getSettings().lowAttendanceLimit) {
      pushNotification(`Attendance below ${getSettings().lowAttendanceLimit}% in ${row.subject}`, 'danger');
    }
    return row;
  }

  function markAttendance(code, present) {
    const attendance = getAttendance();
    const row = attendance.find(item => item.code === code);
    if (!row) return null;
    row.totalClasses += 1;
    if (present) row.attended += 1;
    saveAttendance(attendance);
    addActivity(`${present ? 'Marked present' : 'Marked absent'} for ${row.code}`, 'attendance');
    return row;
  }

  function getTasks() {
    return load(KEYS.TASKS) || [];
  }

  function saveTasks(tasks) {
    save(KEYS.TASKS, tasks);
  }

  function addTask(payload) {
    const tasks = getTasks();
    const newTask = task(payload.text, payload.priority || 'medium', payload.deadline || '', payload.category || 'general');
    tasks.unshift(newTask);
    saveTasks(tasks);
    addActivity(`Added task: ${newTask.text}`, 'tasks');
    pushNotification(`New task added: ${newTask.text}`, 'info');
    return newTask;
  }

  function updateTask(id, payload) {
    const tasks = getTasks();
    const target = tasks.find(item => item.id === id);
    if (!target) return null;
    Object.assign(target, payload, { updatedAt: Date.now() });
    saveTasks(tasks);
    addActivity(`Updated task: ${target.text}`, 'tasks');
    return target;
  }

  function deleteTask(id) {
    const tasks = getTasks();
    const target = tasks.find(item => item.id === id);
    saveTasks(tasks.filter(item => item.id !== id));
    if (target) addActivity(`Deleted task: ${target.text}`, 'tasks');
  }

  function getQuizScores() {
    return load(KEYS.QUIZ_SCORES) || [];
  }

  function saveQuizScores(scores) {
    save(KEYS.QUIZ_SCORES, scores);
  }

  function addQuizScore(score) {
    const scores = getQuizScores();
    scores.unshift({ id: cryptoId(), ...score, createdAt: Date.now() });
    saveQuizScores(scores);
    addActivity(`Completed quiz: ${score.cat} (${score.score}%)`, 'quiz');
    pushNotification(`Quiz completed: ${score.cat} - ${score.score}%`, 'success');
  }

  function getQuizBank() {
    return QUIZ_BANK;
  }

  function getNotifications() {
    return load(KEYS.NOTIFICATIONS) || [];
  }

  function saveNotifications(notifications) {
    save(KEYS.NOTIFICATIONS, notifications);
  }

  function pushNotification(text, type = 'info') {
    if (!getSettings().notificationsEnabled) return;
    const notifications = getNotifications();
    notifications.unshift(notification(text, type));
    saveNotifications(notifications.slice(0, 40));
  }

  function getPortfolio() {
    return load(KEYS.PORTFOLIO) || [];
  }

  function savePortfolio(projects) {
    save(KEYS.PORTFOLIO, projects);
  }

  function addProject(payload) {
    const projects = getPortfolio();
    const newProject = {
      ...project(payload.title, payload.desc, payload.category, payload.tech),
      imageUrl: payload.imageUrl || '',
      repoUrl: payload.repoUrl || '',
      liveUrl: payload.liveUrl || '',
    };
    projects.unshift(newProject);
    savePortfolio(projects);
    addActivity(`Added portfolio project: ${newProject.title}`, 'portfolio');
    return newProject;
  }

  function getActivity() {
    return load(KEYS.ACTIVITY) || [];
  }

  function addActivity(text, type = 'system') {
    const activity = getActivity();
    activity.unshift({ id: cryptoId(), text, type, time: Date.now() });
    save(KEYS.ACTIVITY, activity.slice(0, 60));
  }

  function getStoreProducts() {
    return STORE_PRODUCTS;
  }

  function getCart() {
    return load(KEYS.STORE_CART) || [];
  }

  function saveCart(cart) {
    save(KEYS.STORE_CART, cart);
  }

  function addToCart(productId) {
    const cart = getCart();
    const existing = cart.find(i => i.productId === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ productId, qty: 1 });
    }
    saveCart(cart);
    addActivity(`Added item to cart`, 'store');
    return cart;
  }

  function removeFromCart(productId) {
    const cart = getCart().filter(i => i.productId !== productId);
    saveCart(cart);
    return cart;
  }

  function updateCartQty(productId, qty) {
    const cart = getCart();
    const item = cart.find(i => i.productId === productId);
    if (!item) return cart;
    if (qty <= 0) return removeFromCart(productId);
    item.qty = qty;
    saveCart(cart);
    return cart;
  }

  function clearCart() {
    saveCart([]);
    addActivity('Cleared shopping cart', 'store');
  }

  function resetAll() {
    Object.values(KEYS).forEach(key => localStorage.removeItem(key));
    init();
    addActivity('Reset local demo data', 'system');
  }

  function getCartTotal() {
    const cart = getCart();
    let total = 0;
    cart.forEach(item => {
      const product = STORE_PRODUCTS.find(p => p.id === item.productId);
      if (product) total += product.price * item.qty;
    });
    return total;
  }

  function getCartCount() {
    return getCart().reduce((sum, item) => sum + item.qty, 0);
  }

  function exportSnapshot() {
    const { role, loggedIn, ...sharedUser } = getUser();
    const { adminLoginId, adminPassword, ...sharedSettings } = getSettings();
    return {
      user: sharedUser,
      settings: sharedSettings,
      marks: getMarks(),
      attendance: getAttendance(),
      tasks: getTasks(),
      quizScores: getQuizScores(),
      notifications: getNotifications(),
      portfolio: getPortfolio(),
      activity: getActivity(),
      storeCart: getCart(),
    };
  }

  function importSnapshot(snapshot, options = {}) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    if (snapshot.user) {
      const { role, loggedIn, ...sharedUser } = snapshot.user;
      save(KEYS.USER, { ...getUser(), ...sharedUser, updatedAt: Date.now() });
    }
    if (snapshot.settings) {
      const { adminLoginId, adminPassword, ...sharedSettings } = snapshot.settings;
      save(KEYS.SETTINGS, { ...getSettings(), ...sharedSettings });
    }
    if (snapshot.marks) save(KEYS.MARKS, snapshot.marks);
    if (snapshot.attendance) save(KEYS.ATTENDANCE, normalizeAttendance(snapshot.attendance));
    if (snapshot.tasks) save(KEYS.TASKS, snapshot.tasks);
    if (snapshot.quizScores) save(KEYS.QUIZ_SCORES, snapshot.quizScores);
    if (snapshot.notifications) save(KEYS.NOTIFICATIONS, snapshot.notifications);
    if (snapshot.portfolio) save(KEYS.PORTFOLIO, snapshot.portfolio);
    if (snapshot.activity) save(KEYS.ACTIVITY, snapshot.activity);
    if (snapshot.storeCart) save(KEYS.STORE_CART, snapshot.storeCart);
    if (!options.silent) addActivity('Cloud snapshot merged', 'system');
    return true;
  }

  function normalizeAttendance(attendance) {
    return attendance.map(item => {
      const totalClasses = Math.max(0, Number(item.totalClasses) || 0);
      const attended = clamp(Number(item.attended) || 0, 0, totalClasses);
      return {
        ...item,
        totalClasses,
        attended,
        percentage: totalClasses ? Number(((attended / totalClasses) * 100).toFixed(1)) : 0,
      };
    });
  }

  function applyGrade(item) {
    const internal = clamp(Number(item.internal) || 0, 0, 50);
    const external = clamp(Number(item.external) || 0, 0, 50);
    const total = internal + external;
    const gradeData = gradeFromTotal(total, external);
    Object.assign(item, {
      internal,
      external,
      total,
      grade: gradeData.grade,
      gradePoint: gradeData.point,
    });
    return item;
  }

  function gradeFromTotal(total, external) {
    if (external === 0) return { grade: 'Pending', point: 0 };
    if (total >= 90) return { grade: 'O', point: 10 };
    if (total >= 80) return { grade: 'A+', point: 9 };
    if (total >= 70) return { grade: 'A', point: 8 };
    if (total >= 60) return { grade: 'B+', point: 7 };
    if (total >= 50) return { grade: 'B', point: 6 };
    if (total >= 40) return { grade: 'C', point: 5 };
    return { grade: 'F', point: 0 };
  }

  function calcSGPA(subjects) {
    let totalCredits = 0;
    let totalPoints = 0;
    subjects.forEach(item => {
      if (item.gradePoint > 0) {
        totalCredits += item.credits;
        totalPoints += item.credits * item.gradePoint;
      }
    });
    return totalCredits ? (totalPoints / totalCredits).toFixed(2) : 'Pending';
  }

  function calcCGPA(semesters) {
    let totalCredits = 0;
    let totalPoints = 0;
    semesters.forEach(sem => {
      sem.subjects.forEach(item => {
        if (item.gradePoint > 0) {
          totalCredits += item.credits;
          totalPoints += item.credits * item.gradePoint;
        }
      });
    });
    return totalCredits ? (totalPoints / totalCredits).toFixed(2) : 'Pending';
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  return {
    init,
    resetAll,
    getUser,
    saveUser,
    getSettings,
    saveSettings,
    getMarks,
    saveMarks,
    upsertSubject,
    deleteSubject,
    updateSubjectMark,
    getAttendance,
    saveAttendance,
    updateAttendance,
    markAttendance,
    getTasks,
    saveTasks,
    addTask,
    updateTask,
    deleteTask,
    getQuizScores,
    saveQuizScores,
    addQuizScore,
    getQuizBank,
    getNotifications,
    saveNotifications,
    pushNotification,
    getPortfolio,
    savePortfolio,
    addProject,
    getActivity,
    addActivity,
    exportSnapshot,
    importSnapshot,
    calcSGPA,
    calcCGPA,
    getStoreProducts,
    getCart,
    saveCart,
    addToCart,
    removeFromCart,
    updateCartQty,
    clearCart,
    getCartTotal,
    getCartCount,
  };
})();
