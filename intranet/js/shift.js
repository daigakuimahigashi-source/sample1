// ===== デフォルトスタッフデータ（MF人事より取得 2026/05/29）=====
const DEFAULT_STAFF = [
    // ── S層：役員 ──────────────────────────────────────────
    { id: 'okk10001', name: '又吉 達朗',   layer: 'S', salaryType: 'monthly', salary: 500000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '店舗管理者・フレキシブル配置' },

    // ── A層：日本人正社員 ───────────────────────────────────
    { id: 'okk10003', name: '又吉 健太',   layer: 'A', salaryType: 'monthly', salary: 300000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '正社員' },
    { id: 'okk10004', name: '新城 優樹',   layer: 'A', salaryType: 'monthly', salary: 300000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '正社員' },
    { id: 'okk10005', name: '三澤 北斗',   layer: 'A', salaryType: 'monthly', salary: 300000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '正社員' },

    // ── B層：外国籍正社員 ───────────────────────────────────
    { id: 'okk10006', name: 'チャン フーダット',             layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10008', name: '安里 茜 マーティン',            layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10021', name: 'アルス アーラツチゲーダヌカラクシヤ', layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10022', name: 'アマラシンガ ガンガナートアマラ',    layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10024', name: 'ラナシンガ チャミルシャーニカラッタナ',layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10028', name: 'アングルガハ ガマゲー インディカ',   layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10037', name: 'ウェルガマ ラーララゲ ランドゥニ',   layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10038', name: 'ウェラコーン ムディヤンセラーゲ ラヒル', layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },
    { id: 'okk10048', name: 'アディカーリ ムディアンセラーゲ アヌーシャ', layer: 'B', salaryType: 'monthly', salary: 250000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '在留資格確認要' },

    // ── C層：熟練バイト（入社1年以上）──────────────────────
    { id: 'okk10002', name: '又吉 未愉',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10007', name: '大城 未琴',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10009', name: '平田 明久',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10010', name: '宮城 文弥',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10011', name: '大嶺 華笑',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10012', name: '栄野比 あいみ', layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10013', name: '金城 心渚',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10014', name: '阿波根 啓',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10015', name: '桑江 旭',     layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10016', name: '又吉 茉紀',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10017', name: '岸本 海利',   layer: 'C', salaryType: 'hourly', salary: 1150, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10018', name: '渡口 来夢',   layer: 'C', salaryType: 'hourly', salary: 1100, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10019', name: '仲地 海斗',   layer: 'C', salaryType: 'hourly', salary: 1100, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10020', name: '平川 翔',     layer: 'C', salaryType: 'hourly', salary: 1100, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10023', name: '具志堅 詩苑', layer: 'C', salaryType: 'hourly', salary: 1100, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10026', name: '久場 百花',   layer: 'C', salaryType: 'hourly', salary: 1100, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },

    // ── D層：未熟バイト（入社1年未満）──────────────────────
    { id: 'okk10030', name: '宮城 碧子',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10031', name: '新里 紫緒那', layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10032', name: '村田 悠華',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10033', name: '糸満 苺莉愛', layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10034', name: '知念 あおい', layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10036', name: '當山 健人',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10040', name: '金城 綾華',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10041', name: '下地 美弥',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10042', name: '池原 幸輝',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10043', name: '譜久里 光流', layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10044', name: '知念 稚奈',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10045', name: 'サリバン 莉愛', layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '※外国籍の場合はB層に変更要' },
    { id: 'okk10046', name: '安仁屋 匠冴', layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
    { id: 'okk10047', name: '川満 航希',   layer: 'D', salaryType: 'hourly', salary: 1000, birthdate: '', fixedStore: '', unavailableDays: [], notes: '' },
];

const STORES_MAP = {
    '': 'どこでも',
    'matsuyama': '松山店',
    'kumoji': '久茂地店',
    'miebash': '美栄橋店',
    'misato': '美里店'
};
const STORE_NAMES_SHORT = { matsuyama: '松山', kumoji: '久茂地', miebash: '美栄橋', misato: '美里' };
const ALL_DAYS = ['月','火','水','木','金','土','日'];
const SLOT_HOURS = { early: 9, late: 10 }; // 早番9h、遅番10h

// ===== GAS API設定 =====
// デプロイ後にウェブアプリURLをここに貼り付ける
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycby4N4V10YErqIAwOfrxBqr9uhie06xvHSPszug4mPdzohHPjLxXiJNDPfu_dgJKcOyG/exec';

// ===== State =====
let initialStaff = [];
let allShiftsData = {};       // { "YYYY-MM-DD": { storeId: { slotKey: [staffId,...] } } }
let lockedDates = new Set();  // 確定済み（ロック）日付
let currentViewDate = new Date();
let currentWeekStart = null;
let currentMonthYear = { year: new Date().getFullYear(), month: new Date().getMonth() };
let adminMode = false;
let currentView = 'day';
let lastAIShift = null;
let reqData = null;
let reqActiveStore = 'matsuyama';

const layerStyles = {
    'S': 'bg-purple-100 text-purple-800 border-purple-200',
    'A': 'bg-red-100 text-red-800 border-red-200',
    'B': 'bg-blue-100 text-blue-800 border-blue-200',
    'C': 'bg-green-100 text-green-800 border-green-200',
    'D': 'bg-gray-100 text-gray-700 border-gray-200'
};

// 各レイヤーの配置ルール定義
const LAYER_RULES = {
    'S': { label: '役員',         salaryType: '役員報酬',       nightOK: true,  holiday: '—',       note: 'フレキシブル配置（穴埋め・開閉店補助）・配置制限なし', minHoliday: 0 },
    'A': { label: '日本人正社員', salaryType: '月給固定',       nightOK: true,  holiday: '月6公休', note: '早番・遅番どちらも可',         minHoliday: 6 },
    'B': { label: '外国籍正社員', salaryType: '月給固定',       nightOK: true,  holiday: '月8公休', note: '在留資格確認必須',             minHoliday: 8 },
    'C': { label: '熟練バイト',   salaryType: '時給 ¥1100〜',  nightOK: false, holiday: '—',       note: '学生は22:00まで',              minHoliday: 0 },
    'D': { label: '未熟バイト',   salaryType: '時給 ¥1000〜',  nightOK: false, holiday: '—',       note: '学生は22:00まで',              minHoliday: 0 },
};

// ===== Staff Storage =====
function loadStaff() {
    const saved = localStorage.getItem('okk_staff_data');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_STAFF));
}
function saveStaffData(staffArr) {
    localStorage.setItem('okk_staff_data', JSON.stringify(staffArr));
    gasPost('staff', staffArr); // GASにも非同期保存
}

// ===== Shift Storage =====
function loadShifts() {
    const saved = localStorage.getItem('okk_shifts');
    return saved ? JSON.parse(saved) : {};
}
function saveShiftsData(data) {
    localStorage.setItem('okk_shifts', JSON.stringify(data));
    allShiftsData = data;
    gasPost('shifts', data); // GASにも非同期保存
}

// ===== Locked Dates Storage =====
function loadLockedDatesLocal() {
    const saved = localStorage.getItem('okk_locked_dates');
    lockedDates = saved ? new Set(JSON.parse(saved)) : new Set();
}
function saveLockedDates() {
    const arr = [...lockedDates];
    localStorage.setItem('okk_locked_dates', JSON.stringify(arr));
    gasPost('lockedDates', arr); // GASにも非同期保存
}

// ===== GAS API通信 =====
async function gasGet() {
    if (!GAS_API_URL) return null;
    const res = await fetch(GAS_API_URL, { cache: 'no-store' });
    return res.json();
}

function gasPost(key, value) {
    if (!GAS_API_URL) return;
    // no-cors: レスポンスは読めないがサーバーには届く（CORS回避）
    fetch(GAS_API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ key, value }),
    }).catch(err => console.warn('GAS保存エラー:', err));
}

// ===== ローディング表示 =====
function showLoading(show, detail = '') {
    const el = document.getElementById('loading-overlay');
    const dt = document.getElementById('loading-detail');
    if (!el) return;
    if (show) {
        el.classList.remove('hidden');
        if (dt && detail) dt.textContent = detail;
    } else {
        el.classList.add('hidden');
    }
}

// ===== 確定ロック管理 =====
function loadLockedDates() {
    const saved = localStorage.getItem('okk_locked_dates');
    lockedDates = saved ? new Set(JSON.parse(saved)) : new Set();
}
function saveLockedDates() {
    localStorage.setItem('okk_locked_dates', JSON.stringify([...lockedDates]));
}
function isDateLocked(dateStr) {
    return lockedDates.has(dateStr);
}
function applyDayLock() {
    const locked  = isDateLocked(dateToStr(currentViewDate));
    const boardEl = document.getElementById('day-view-board');
    const notice  = document.getElementById('board-lock-notice');
    const poolEl  = document.getElementById('staff-pool');
    if (locked) {
        boardEl?.classList.add('board-locked');
        notice?.classList.remove('hidden');
        poolEl?.classList.add('pool-locked');
    } else {
        boardEl?.classList.remove('board-locked');
        notice?.classList.add('hidden');
        poolEl?.classList.remove('pool-locked');
    }
    updateHeaderActions();
}
function unlockDayShift() {
    const dateStr = dateToStr(currentViewDate);
    lockedDates.delete(dateStr);
    saveLockedDates();
    applyDayLock();
}

// ===== Date Utilities =====
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d;
}
function dateToStr(date) {
    return date.toISOString().slice(0, 10);
}
function formatDateJa(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// ===== Age / 18歳チェック =====
function isUnder18(birthdate) {
    if (!birthdate) return false;
    const birth = new Date(birthdate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear() -
        (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    return age < 18;
}
function getAge(birthdate) {
    if (!birthdate) return '?';
    const birth = new Date(birthdate);
    const today = new Date();
    return today.getFullYear() - birth.getFullYear() -
        (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
}

// ===== DOM refs =====
const staffPoolEl = document.getElementById('staff-pool');
const alertContainer = document.getElementById('alert-container');
const dropZones = document.querySelectorAll('.drop-zone');

// ===== Init =====
async function init() {
    showLoading(true, 'サーバーに接続しています...');

    if (GAS_API_URL) {
        try {
            showLoading(true, 'シフトデータを取得中...');
            const data = await gasGet();
            if (data && !data.error) {
                // GASから取得したデータをstateとlocalStorageに反映
                initialStaff  = data.staff       || JSON.parse(JSON.stringify(DEFAULT_STAFF));
                allShiftsData = data.shifts      || {};
                lockedDates   = new Set(data.lockedDates || []);
                localStorage.setItem('okk_staff_data',   JSON.stringify(initialStaff));
                localStorage.setItem('okk_shifts',       JSON.stringify(allShiftsData));
                localStorage.setItem('okk_locked_dates', JSON.stringify([...lockedDates]));
                localStorage.setItem('okk_requirements', data.requirements
                    ? JSON.stringify(data.requirements) : (localStorage.getItem('okk_requirements') || ''));
            } else {
                throw new Error(data?.error || '不明なエラー');
            }
        } catch (err) {
            console.warn('GAS取得失敗 → localStorageから復元:', err);
            showLoading(true, 'オフライン：ローカルデータを使用します');
            await new Promise(r => setTimeout(r, 800));
            initialStaff  = loadStaff();
            allShiftsData = loadShifts();
            loadLockedDatesLocal();
        }
    } else {
        // GAS未設定：localStorageのみ使用
        initialStaff  = loadStaff();
        allShiftsData = loadShifts();
        loadLockedDatesLocal();
    }

    currentWeekStart = getMonday(new Date());
    currentViewDate  = new Date();

    renderStaffPool();
    setupDragAndDrop();
    updateDayViewHeader();
    loadDayIntoBoard(dateToStr(currentViewDate));
    updateHeaderActions();
    updateAdminUI();
    validateShifts();

    showLoading(false);
}

// ===== View Switcher =====
function switchView(view) {
    currentView = view;
    ['day', 'week', 'month', 'settings', 'requirements'].forEach(v => {
        const tab = document.getElementById(`tab-${v}`);
        const el  = document.getElementById(`view-${v}`);
        if (!tab || !el) return;
        if (v === view) {
            tab.classList.replace('border-transparent', 'border-amber-500');
            tab.classList.replace('text-slate-500', 'text-amber-600');
            tab.classList.remove('hover:text-slate-800');
            el.classList.remove('opacity-0', 'pointer-events-none');
            el.classList.add('z-10');
        } else {
            tab.classList.replace('border-amber-500', 'border-transparent');
            tab.classList.replace('text-amber-600', 'text-slate-500');
            tab.classList.add('hover:text-slate-800');
            el.classList.add('opacity-0', 'pointer-events-none');
            el.classList.remove('z-10');
        }
    });
    if (view === 'day')          { loadDayIntoBoard(dateToStr(currentViewDate)); }
    if (view === 'settings')     { renderSettingsTable(); }
    if (view === 'requirements') { renderRequirementsView(); }
    if (view === 'week')         { renderWeekView(); }
    if (view === 'month')        { renderMonthView(); }
    updateHeaderActions();
}

function updateHeaderActions() {
    const headerActions = document.getElementById('header-actions');
    if (!headerActions) return;
    if (currentView === 'day') {
        const locked = isDateLocked(dateToStr(currentViewDate));
        if (locked) {
            headerActions.innerHTML = `
                <span class="text-emerald-300 text-xs font-bold flex items-center gap-1 mr-1">
                    <i class="fa-solid fa-lock"></i> 確定済み
                </span>
                <button onclick="unlockDayShift()"
                    class="bg-amber-500 hover:bg-amber-400 px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                    <i class="fa-solid fa-pen-to-square mr-1"></i> 修正
                </button>
            `;
        } else {
            headerActions.innerHTML = `
                <button onclick="confirmDayShift()" id="confirm-day-btn"
                    class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                    <i class="fa-solid fa-floppy-disk mr-1"></i> この日のシフトを確定
                </button>
                <button onclick="autoAssign()" class="bg-amber-600 hover:bg-amber-500 px-4 py-2 rounded text-sm transition font-bold shadow-sm">
                    <i class="fa-solid fa-wand-magic-sparkles mr-1"></i> 自動配置
                </button>
                <button onclick="resetBoard()" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded text-sm transition font-medium">
                    <i class="fa-solid fa-rotate-right mr-1"></i> リセット
                </button>
            `;
        }
    } else if (currentView === 'week') {
        headerActions.innerHTML = `<button onclick="openAIModal()" class="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded text-sm transition font-bold shadow-sm"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i> AIシフト生成</button>`;
    } else if (currentView === 'month') {
        headerActions.innerHTML = `<button onclick="exportMonthCSV()" class="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded text-sm transition font-bold shadow-sm"><i class="fa-solid fa-file-export mr-1"></i> CSV出力</button>`;
    } else {
        headerActions.innerHTML = '';
    }
}

// ===== Admin Mode =====
function toggleAdminMode() {
    adminMode = !adminMode;
    updateAdminUI();
    if (currentView === 'month')   renderMonthView();
    if (currentView === 'settings') renderSettingsTable();
}
function updateAdminUI() {
    const btn   = document.getElementById('admin-toggle-btn');
    const icon  = document.getElementById('admin-icon');
    const label = document.getElementById('admin-label');
    if (!btn) return;
    if (adminMode) {
        btn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
        btn.classList.add('bg-amber-600', 'hover:bg-amber-500');
        icon.className  = 'fa-solid fa-lock-open text-white';
        label.textContent = '経営者モード ON';
    } else {
        btn.classList.add('bg-slate-700', 'hover:bg-slate-600');
        btn.classList.remove('bg-amber-600', 'hover:bg-amber-500');
        icon.className  = 'fa-solid fa-lock text-gray-400';
        label.textContent = '経営者モード';
    }
}

// ===== Day View =====
function updateDayViewHeader() {
    const el = document.getElementById('day-view-date');
    if (!el) return;
    const WDAYS = ['日','月','火','水','木','金','土'];
    el.textContent = `${currentViewDate.getMonth()+1}/${currentViewDate.getDate()}(${WDAYS[currentViewDate.getDay()]})`;

    const todayStr = dateToStr(new Date());
    const viewStr  = dateToStr(currentViewDate);
    document.getElementById('day-today-badge')?.classList.toggle('hidden', viewStr !== todayStr);
    document.getElementById('day-confirmed-badge')?.classList.toggle('hidden', !isDateLocked(viewStr));
}

function navigateDay(dir) {
    currentViewDate = new Date(currentViewDate);
    currentViewDate.setDate(currentViewDate.getDate() + dir);
    updateDayViewHeader();
    loadDayIntoBoard(dateToStr(currentViewDate));
}

function loadDayIntoBoard(dateStr) {
    // 全スタッフカードをプールに戻す
    document.querySelectorAll('.staff-card').forEach(el => staffPoolEl.appendChild(el));

    const dayData = allShiftsData[dateStr];
    if (!dayData) { validateShifts(); applyDayLock(); return; }

    ['matsuyama','kumoji','miebash','misato'].forEach(store => {
        ['early','late'].forEach(slot => {
            const staffIds = dayData[store]?.[slot] || [];
            const zone = document.querySelector(`.drop-zone[data-store="${store}"][data-shift="${slot}"]`);
            if (!zone) return;
            staffIds.forEach(id => {
                const card = document.querySelector(`[data-id="${id}"]`);
                if (card) zone.appendChild(card);
            });
        });
    });
    validateShifts();
    applyDayLock();
}

function confirmDayShift() {
    const dateStr = dateToStr(currentViewDate);
    const dayData = {};
    ['matsuyama','kumoji','miebash','misato'].forEach(store => {
        const storeData = {};
        ['early','late'].forEach(slot => {
            const zone = document.querySelector(`.drop-zone[data-store="${store}"][data-shift="${slot}"]`);
            if (!zone) return;
            const ids = Array.from(zone.querySelectorAll('.staff-card')).map(el => el.dataset.id);
            if (ids.length > 0) storeData[slot] = ids;
        });
        if (Object.keys(storeData).length > 0) dayData[store] = storeData;
    });

    allShiftsData[dateStr] = dayData;
    saveShiftsData(allShiftsData);

    // 確定済みとしてロック
    lockedDates.add(dateStr);
    saveLockedDates();
    updateDayViewHeader();
    applyDayLock();
}

// ===== Week View =====
function navigateWeek(dir) {
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + dir * 7);
    renderWeekView();
}

function renderWeekView() {
    const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + i);
        return d;
    });

    // タイトル更新
    const titleEl = document.getElementById('week-view-title');
    if (titleEl) {
        titleEl.innerHTML = `<i class="fa-solid fa-calendar-week mr-2 text-amber-500"></i>週間シフト表 (${formatDateJa(weekDates[0])} 〜 ${formatDateJa(weekDates[6])})`;
    }

    // ヘッダー行（日付）の更新
    const todayStr = dateToStr(new Date());
    const DAYNAMES = ['月','火','水','木','金','土','日'];
    document.querySelectorAll('.week-day-header').forEach((th, i) => {
        if (i >= weekDates.length) return;
        const d = weekDates[i];
        const dStr = dateToStr(d);
        const isToday = dStr === todayStr;
        const confirmed = !!allShiftsData[dStr];
        const colorClass = i === 5 ? 'text-blue-600' : i === 6 ? 'text-red-600' : '';
        th.innerHTML = `<div class="${colorClass} ${isToday ? 'font-black' : ''}">
            ${DAYNAMES[i]}<br>
            <span class="text-xs font-normal">${d.getMonth()+1}/${d.getDate()}</span>
            ${isToday ? '<br><span class="text-[9px] bg-amber-500 text-white px-1 rounded">今日</span>' : ''}
            ${confirmed ? '<br><span class="text-[9px] text-emerald-600 font-bold">✓確定</span>' : ''}
        </div>`;
    });

    const staffList = loadStaff();
    const staffMap = {};
    staffList.forEach(s => { staffMap[s.id] = s; });

    // ── スタッフ別ビュー ──
    const weekBody = document.getElementById('week-table-body');
    weekBody.innerHTML = '';
    staffList.forEach(s => {
        const tr = document.createElement('tr');
        let rowHtml = `<td class="text-left pl-4 font-medium">
            <span class="text-xs font-bold w-4 inline-block text-center mr-1
                ${s.layer==='A'?'text-red-500':s.layer==='B'?'text-blue-500':s.layer==='C'?'text-green-600':'text-gray-500'}">${s.layer}</span>
            ${s.name}
        </td>`;

        weekDates.forEach(d => {
            const dStr = dateToStr(d);
            const dayData = allShiftsData[dStr];
            if (dayData === undefined) {
                rowHtml += `<td class="text-gray-200 text-xs">-</td>`;
                return;
            }
            let found = null;
            for (const store of ['matsuyama','kumoji','miebash','misato']) {
                if (!dayData[store]) continue;
                for (const [slot, ids] of Object.entries(dayData[store])) {
                    if (ids.includes(s.id)) {
                        found = { store, slot };
                        break;
                    }
                }
                if (found) break;
            }
            if (found) {
                const label = `${STORE_NAMES_SHORT[found.store]}(${found.slot==='late'?'遅':'早'})`;
                const cls   = found.slot === 'late' ? 'bg-shift-late' : 'bg-shift-early';
                rowHtml += `<td><span class="badge-shift ${cls}">${label}</span></td>`;
            } else {
                rowHtml += `<td><span class="badge-shift bg-shift-off">休</span></td>`;
            }
        });
        tr.innerHTML = rowHtml;
        weekBody.appendChild(tr);
    });

    // ── 店舗別ビュー ──
    const storeBody = document.getElementById('week-store-table-body');
    storeBody.innerHTML = '';
    const storeSlots = [
        { storeId:'matsuyama', storeName:'松山店', slot:'late',  slotName:'遅番', icon:'fa-moon',  color:'text-red-800',  bg:'bg-red-50' },
        { storeId:'matsuyama', storeName:'松山店', slot:'early', slotName:'早番', icon:'fa-sun',   color:'text-slate-700',bg:'bg-slate-50' },
        { storeId:'kumoji',    storeName:'久茂地店',slot:'early', slotName:'早番', icon:'fa-store', color:'text-slate-700',bg:'bg-slate-50' },
        { storeId:'miebash',   storeName:'美栄橋店',slot:'early', slotName:'早番', icon:'fa-store', color:'text-slate-700',bg:'bg-slate-50' },
        { storeId:'misato',    storeName:'美里店',  slot:'early', slotName:'早番', icon:'fa-store', color:'text-slate-700',bg:'bg-slate-50' },
    ];
    storeSlots.forEach(info => {
        const tr = document.createElement('tr');
        let rowHtml = `<td class="text-left pl-4 font-bold ${info.bg} border-b-2 whitespace-nowrap">
            <i class="fa-solid ${info.icon} mr-1 ${info.color}"></i>
            <span class="${info.color}">${info.storeName}</span>
            <br><span class="font-normal text-xs text-gray-500">${info.slotName}</span>
        </td>`;
        weekDates.forEach(d => {
            const dStr = dateToStr(d);
            const dayData = allShiftsData[dStr];
            if (dayData === undefined) {
                rowHtml += `<td class="text-center text-gray-200 text-xs p-1">-</td>`;
                return;
            }
            const ids = dayData[info.storeId]?.[info.slot] || [];
            rowHtml += `<td class="align-top p-1 bg-gray-50/50 min-w-[80px]">${ids.length === 0
                ? '<span class="text-gray-300 text-xs">-</span>'
                : ids.map(id => {
                    const s = staffMap[id];
                    if (!s) return '';
                    return `<div class="text-[11px] mb-1 bg-white border border-gray-200 rounded px-1 py-0.5 shadow-sm flex items-center">
                        <span class="font-bold ${s.layer==='A'?'text-red-600':s.layer==='B'?'text-blue-600':s.layer==='C'?'text-green-600':'text-gray-700'} w-3 text-center mr-1">${s.layer}</span>
                        <span class="truncate text-gray-800">${s.name}</span>
                    </div>`;
                }).join('')
            }</td>`;
        });
        tr.innerHTML = rowHtml;
        storeBody.appendChild(tr);
    });
}

// ===== Month View =====
function navigateMonth(dir) {
    currentMonthYear.month += dir;
    if (currentMonthYear.month > 11) { currentMonthYear.month = 0; currentMonthYear.year++; }
    if (currentMonthYear.month < 0)  { currentMonthYear.month = 11; currentMonthYear.year--; }
    renderMonthView();
}

function renderMonthView() {
    const { year, month } = currentMonthYear;
    const titleEl = document.getElementById('month-view-title');
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-chart-line mr-2 text-amber-500"></i>月間労務・給与サマリー (${year}年${month+1}月度)`;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const staffList   = loadStaff();
    let totalOvertimeStaff = 0, totalPayroll = 0, confirmedDaysCount = 0;

    // 確定済み日付を数える
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        if (allShiftsData[dStr]) confirmedDaysCount++;
    }

    const rows = staffList.map(s => {
        let workDays = 0, totalHours = 0, offDays = 0;
        let checkedDays = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayData = allShiftsData[dStr];
            if (!dayData) continue;
            checkedDays++;

            let assigned = false;
            for (const store of ['matsuyama','kumoji','miebash','misato']) {
                if (!dayData[store]) continue;
                for (const [slot, ids] of Object.entries(dayData[store])) {
                    if (ids.includes(s.id)) {
                        workDays++;
                        totalHours += SLOT_HOURS[slot] || 8;
                        assigned = true;
                        break;
                    }
                }
                if (assigned) break;
            }
            if (!assigned) offDays++;
        }

        // 残業時間（全スタッフ対象）
        const deemedOTBase = 25; // みなし残業ベース（給与計算用）
        const OT_WARN  = 20;    // 三六協定 注意ライン
        const OT_LIMIT = 30;    // 三六協定 上限
        const actualOT = Math.max(0, totalHours - workDays * 8);
        if (actualOT >= OT_LIMIT) totalOvertimeStaff++;

        // 給与計算
        let salaryCalc = 0, salaryHtml = '';
        if (checkedDays === 0) {
            salaryHtml = '<span class="text-gray-300 text-xs">データなし</span>';
        } else if (s.salaryType === 'monthly') {
            salaryCalc = s.salary;
            const extraPay = Math.max(0, actualOT - deemedOTBase) * Math.round(s.salary / 22 / 8 * 1.25);
            salaryHtml = `¥${(salaryCalc + extraPay).toLocaleString()}`;
            if (extraPay > 0) salaryHtml += `<br><span class="text-[10px] text-red-500">割増 +¥${extraPay.toLocaleString()}</span>`;
            totalPayroll += salaryCalc + extraPay;
        } else {
            salaryCalc = Math.round(totalHours * s.salary);
            salaryHtml = `¥${salaryCalc.toLocaleString()}<br><span class="text-[10px] text-gray-400">@¥${s.salary}/h</span>`;
            totalPayroll += salaryCalc;
        }

        // 経営者モードでない場合、S/A/B の給与は非表示
        const salaryDisplay = (!adminMode && (s.layer === 'S' || s.layer === 'A' || s.layer === 'B'))
            ? '<span class="text-gray-300 text-xs"><i class="fa-solid fa-lock text-gray-300 mr-1"></i>経営者のみ</span>'
            : salaryHtml;

        let statusHtml;
        if (checkedDays === 0) {
            statusHtml = '<span class="text-gray-300 text-xs">未確定</span>';
        } else if (actualOT >= OT_LIMIT) {
            statusHtml = `<span class="text-red-600 font-bold bg-red-100 px-2 py-1 rounded text-xs"><i class="fa-solid fa-triangle-exclamation mr-1"></i>三六超過(${actualOT}h)</span>`;
        } else if (actualOT >= OT_WARN) {
            statusHtml = `<span class="text-amber-600 font-bold bg-amber-100 px-2 py-1 rounded text-xs"><i class="fa-solid fa-clock mr-1"></i>注意(${actualOT}h／上限${OT_LIMIT}h)</span>`;
        } else if ((LAYER_RULES[s.layer]?.minHoliday || 0) > 0 && offDays < LAYER_RULES[s.layer].minHoliday && checkedDays >= 20) {
            const req = LAYER_RULES[s.layer].minHoliday;
            statusHtml = `<span class="text-amber-600 font-bold bg-amber-100 px-2 py-1 rounded text-xs"><i class="fa-solid fa-triangle-exclamation mr-1"></i>公休不足(${offDays}/${req}日)</span>`;
        } else {
            statusHtml = `<span class="text-green-600 font-bold"><i class="fa-solid fa-check mr-1"></i>適正</span>`;
        }

        return { s, workDays, offDays, totalHours, actualOT, salaryDisplay, statusHtml };
    });

    // KPIカード
    document.getElementById('overtime-count').innerHTML =
        `${totalOvertimeStaff}<span class="text-sm font-normal text-amber-600 ml-1">名</span>`;
    document.getElementById('total-payroll').innerText =
        totalPayroll > 0 ? `¥${totalPayroll.toLocaleString()}` : '---';

    // 確定日数カード更新（KPIの1枚目を流用）
    const kpi1 = document.querySelector('#view-month .bg-green-50 .text-2xl');
    if (kpi1) kpi1.innerHTML = `${confirmedDaysCount}<span class="text-sm font-normal text-green-600 ml-1">日 確定済</span>`;

    // テーブル
    const monthBody = document.getElementById('month-table-body');
    monthBody.innerHTML = '';
    rows.forEach(({ s, workDays, offDays, totalHours, actualOT, salaryDisplay, statusHtml }) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-left pl-4 font-medium">${s.name}</td>
            <td><span class="px-2 py-1 rounded text-xs font-bold ${layerStyles[s.layer]}">${s.layer}</span></td>
            <td>${workDays > 0 ? workDays + ' 日' : '<span class="text-gray-300">-</span>'}</td>
            <td class="${offDays > 0 && offDays < 6 ? 'text-amber-600 font-bold' : ''}">${offDays > 0 ? offDays + ' 日' : '<span class="text-gray-300">-</span>'}</td>
            <td>${totalHours > 0 ? totalHours + ' h' : '<span class="text-gray-300">-</span>'}</td>
            <td class="${actualOT >= 30 ? 'text-red-600 font-bold' : actualOT >= 20 ? 'text-amber-600 font-bold' : ''}">${actualOT > 0 ? actualOT + ' h' : '<span class="text-gray-300">-</span>'}</td>
            <td class="font-mono text-right pr-4">${salaryDisplay}</td>
            <td>${statusHtml}</td>
        `;
        monthBody.appendChild(tr);
    });
}

function exportMonthCSV() {
    const { year, month } = currentMonthYear;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const staffList   = loadStaff();
    const headers = ['名前','レイヤー','出勤日数','公休日数','総実働時間h','残業h'];
    if (adminMode) headers.push('想定給与');
    const rows = [headers];

    staffList.forEach(s => {
        let workDays = 0, totalHours = 0, offDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dayData = allShiftsData[dStr];
            if (!dayData) continue;
            let assigned = false;
            for (const store of ['matsuyama','kumoji','miebash','misato']) {
                if (!dayData[store]) continue;
                for (const [slot, ids] of Object.entries(dayData[store])) {
                    if (ids.includes(s.id)) { workDays++; totalHours += SLOT_HOURS[slot] || 8; assigned = true; break; }
                }
                if (assigned) break;
            }
            if (!assigned) offDays++;
        }
        const actualOT = s.salaryType === 'monthly' ? Math.max(0, totalHours - workDays * 8) : 0;
        const row = [s.name, s.layer, workDays, offDays, totalHours, actualOT];
        if (adminMode) {
            const salary = s.salaryType === 'monthly' ? s.salary : Math.round(totalHours * s.salary);
            row.push(salary);
        }
        rows.push(row);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shift_${year}${String(month+1).padStart(2,'0')}.csv`;
    a.click();
}

// ===== Staff Pool Rendering =====
function renderStaffPool() {
    staffPoolEl.innerHTML = '';
    initialStaff.forEach(staff => {
        const div = document.createElement('div');
        div.className = `staff-card px-3 py-2 rounded-lg border shadow-sm select-none ${layerStyles[staff.layer]}`;
        div.draggable = true;
        div.dataset.id    = staff.id;
        div.dataset.layer = staff.layer;
        div.dataset.name  = staff.name;

        const under18 = isUnder18(staff.birthdate);
        const fixedStoreName = staff.fixedStore ? STORES_MAP[staff.fixedStore] : '';
        const badges = [];
        if (under18) badges.push(`<span class="text-[9px] bg-orange-100 text-orange-700 border border-orange-300 rounded px-1">🔞22時不可</span>`);
        if (fixedStoreName) badges.push(`<span class="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1"><i class="fa-solid fa-store" style="font-size:8px"></i> ${fixedStoreName}</span>`);
        if (staff.unavailableDays?.length > 0) badges.push(`<span class="text-[9px] bg-red-50 text-red-500 border border-red-200 rounded px-1">休:${staff.unavailableDays.join('・')}</span>`);

        div.innerHTML = `
            <div class="flex items-center w-full">
                <div class="font-bold text-sm w-6 text-center opacity-70 border-r border-current mr-2 pr-2">${staff.layer}</div>
                <div class="flex-1 flex flex-col">
                    <div class="font-medium text-sm">${staff.name}</div>
                    ${badges.length > 0 ? `<div class="flex flex-wrap gap-1 mt-1">${badges.join('')}</div>` : ''}
                    <div class="time-display text-[10px] opacity-80 mt-0.5 font-mono"></div>
                </div>
                <i class="fa-solid fa-grip-vertical opacity-30 text-sm ml-2"></i>
            </div>`;
        div.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', staff.id); setTimeout(() => div.classList.add('opacity-50'), 0); });
        div.addEventListener('dragend', () => div.classList.remove('opacity-50'));
        staffPoolEl.appendChild(div);
    });
}

// ===== Drag & Drop =====
function setupDragAndDrop() {
    staffPoolEl.addEventListener('dragover', e => e.preventDefault());
    staffPoolEl.addEventListener('drop', handleDrop);
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', handleDrop);
    });
}
function handleDrop(e) {
    e.preventDefault();
    const dropZone = e.target.closest('.drop-zone') || e.target.closest('#staff-pool');
    if (!dropZone) return;
    if (dropZone.classList.contains('drop-zone')) dropZone.classList.remove('drag-over');
    const staffId = e.dataTransfer.getData('text/plain');
    const staffEl = document.querySelector(`[data-id="${staffId}"]`);
    if (staffEl) { dropZone.appendChild(staffEl); validateShifts(); }
}

// ===== Board Operations =====
function resetBoard() {
    document.querySelectorAll('.staff-card').forEach(el => staffPoolEl.appendChild(el));
    validateShifts();
}

function autoAssign() {
    resetBoard();
    const shuffle = arr => { for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; };
    const STORES = ['matsuyama','kumoji','miebash','misato'];
    const allCards = Array.from(staffPoolEl.querySelectorAll('.staff-card'));

    // 固定店舗があるスタッフはそこへ
    const fixedCards = {};
    STORES.forEach(s => fixedCards[s] = []);
    const freeCards = [];
    allCards.forEach(card => {
        const staff = initialStaff.find(s => s.id === card.dataset.id);
        const fs = staff?.fixedStore;
        if (fs && fixedCards[fs]) fixedCards[fs].push(card);
        else freeCards.push(card);
    });
    STORES.forEach(store => {
        const zone = document.querySelector(`.drop-zone[data-store="${store}"][data-shift="early"]`);
        fixedCards[store].forEach(c => zone?.appendChild(c));
    });

    // 残り（固定店舗なし）を層別に振り分け
    const aCards = shuffle(freeCards.filter(c => c.dataset.layer === 'A'));
    const bCards = shuffle(freeCards.filter(c => c.dataset.layer === 'B'));
    const others = shuffle(freeCards.filter(c => c.dataset.layer !== 'A' && c.dataset.layer !== 'B'));

    // A層1名を松山遅番へ
    const lateZone = document.querySelector('.drop-zone[data-store="matsuyama"][data-shift="late"]');
    if (aCards.length > 0 && lateZone) lateZone.appendChild(aCards.pop());

    // 各店舗のearly zoneにA/Bリーダーを優先配置
    const earlyZones = STORES.map(s => document.querySelector(`.drop-zone[data-store="${s}"][data-shift="early"]`));
    const leaders = [...aCards, ...bCards];
    earlyZones.forEach(zone => {
        if (!zone) return;
        const hasLeader = Array.from(zone.querySelectorAll('.staff-card')).some(c => ['A','B'].includes(c.dataset.layer));
        if (!hasLeader && leaders.length > 0) zone.appendChild(leaders.pop());
    });

    // 残りスタッフを均等に分散
    shuffle([...leaders, ...others]).forEach((c, i) => earlyZones[i % earlyZones.length]?.appendChild(c));
    validateShifts();
}

function getStaffInZone(store, shift) {
    const zone = document.querySelector(`.drop-zone[data-store="${store}"][data-shift="${shift}"]`);
    return zone ? Array.from(zone.querySelectorAll('.staff-card')).map(el => ({
        id: el.dataset.id, layer: el.dataset.layer, name: el.dataset.name
    })) : [];
}

// ===== Validation =====
function validateShifts() {
    updateStaffTimeDisplays();
    const alerts = [];
    const matsuyamaLate = getStaffInZone('matsuyama', 'late');
    const _dow     = currentViewDate.getDay(); // 0=日,1=月,...,5=金,6=土
    const _isFriSat = _dow === 5 || _dow === 6;
    const _isSun    = _dow === 0;
    const _minLate  = _isFriSat ? 4 : 3;

    if (matsuyamaLate.length === 0) {
        alerts.push({ type:'error', msg:'松山店の「遅番」にスタッフが配置されていません。' });
    } else {
        if (!matsuyamaLate.some(s => ['S','A','B'].includes(s.layer)))
            alerts.push({ type:'error', msg:`松山店「遅番」にはS / A / Bいずれかを最低1名配置してください。` });
        if (matsuyamaLate.length < _minLate)
            alerts.push({ type: matsuyamaLate.length < 2 ? 'error' : 'warn',
                msg:`松山店「遅番」は${_isFriSat ? '金・土曜' : '平日・日曜'}最低${_minLate}名必要です（現在${matsuyamaLate.length}名）。` });
        if (_isSun)
            alerts.push({ type:'info', msg:'【日曜】松山店は25:00クローズです。遅番スタッフの退勤を25:00に設定してください。' });
    }

    ['matsuyama','kumoji','miebash','misato'].forEach(store => {
        const early = getStaffInZone(store, 'early');
        if (early.length > 0 && !early.some(s => ['S','A','B'].includes(s.layer)))
            alerts.push({ type:'error', msg:`早番に【責任者(S / A / B)】がいない店舗があります。` });
    });

    // ===== 三六協定チェック（月間残業） =====
    const viewYear    = currentViewDate.getFullYear();
    const viewMonth   = currentViewDate.getMonth();
    const viewDateStr = dateToStr(currentViewDate);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // ボード上に配置されているスタッフをスロット付きで収集
    const placedStaff = new Map(); // staffId → slot
    ['matsuyama','kumoji','miebash','misato'].forEach(store => {
        ['early','late'].forEach(slot => {
            getStaffInZone(store, slot).forEach(s => {
                if (!placedStaff.has(s.id)) placedStaff.set(s.id, slot);
            });
        });
    });

    // ===== 学生 22時制限チェック =====
    placedStaff.forEach((slot, staffId) => {
        const staff = initialStaff.find(s => s.id === staffId);
        if (!staff || !(staff.notes || '').includes('学生')) return;
        if (slot === 'late') {
            alerts.push({ type:'error', msg:`【22時制限】${staff.name}（学生）は遅番に配置不可です。学生の勤務は22:00まで。` });
        } else {
            alerts.push({ type:'warn', msg:`【22時制限】${staff.name}（学生）は22:00退勤となります。フルシフト分の人員補充を確認してください。` });
        }
    });

    // ===== 三六協定チェック（月間残業） =====
    placedStaff.forEach((slot, staffId) => {
        const staff = initialStaff.find(s => s.id === staffId);
        if (!staff) return;
        let totalHours = 0, workDays = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            if (dStr === viewDateStr) continue; // 今日はボードから計算
            const dayData = allShiftsData[dStr];
            if (!dayData) continue;
            for (const store of ['matsuyama','kumoji','miebash','misato']) {
                if (!dayData[store]) continue;
                for (const [s, ids] of Object.entries(dayData[store])) {
                    if (ids.includes(staffId)) { workDays++; totalHours += SLOT_HOURS[s] || 8; break; }
                }
            }
        }
        workDays++;
        totalHours += SLOT_HOURS[slot] || 8;
        const ot = Math.max(0, totalHours - workDays * 8);
        if (ot >= 30) {
            alerts.push({ type:'error', msg:`【三六協定】${staff.name}：月間残業が ${ot}h となり上限30hを超過します。` });
        } else if (ot >= 20) {
            alerts.push({ type:'warn', msg:`【三六協定】${staff.name}：月間残業 ${ot}h（上限30hまで残り${30 - ot}h）。` });
        }
    });

    alertContainer.innerHTML = '';
    if (alerts.length === 0) {
        alertContainer.innerHTML = `<div class="bg-emerald-500 text-white px-4 py-3 rounded shadow-lg pointer-events-auto flex items-center w-full max-w-2xl mx-auto">
            <i class="fa-solid fa-circle-check mr-3 text-xl"></i><span class="font-bold">すべてのコンプライアンス要件をクリア！</span></div>`;
    } else {
        alerts.forEach(a => {
            const bg   = a.type === 'error' ? 'bg-red-500' : a.type === 'info' ? 'bg-blue-500' : 'bg-amber-500';
            const icon = a.type === 'info' ? 'fa-circle-info' : 'fa-triangle-exclamation';
            alertContainer.innerHTML += `<div class="${bg} text-white px-4 py-3 rounded shadow-lg pointer-events-auto flex items-center w-full max-w-2xl mx-auto mb-2">
                <i class="fa-solid ${icon} mr-3 text-xl"></i><span class="font-medium">${a.msg}</span></div>`;
        });
    }
    renderTimeline();
}

function updateStaffTimeDisplays() {
    document.querySelectorAll('.staff-card').forEach(card => {
        const zone = card.closest('.drop-zone');
        const addedWork = zone ? 8 : 0;
        const addedOT   = zone?.dataset.shift === 'late' ? 1 : 0;
        card.querySelector('.time-display').innerHTML = addedWork > 0 ? `実働:${addedWork}h (+残業${addedOT}h)` : '';
    });
}

// ===== Day Sub-tabs =====
function switchDayView(viewType) {
    const boardView = document.getElementById('day-view-board');
    const ganttView = document.getElementById('day-view-gantt');
    document.getElementById('subtab-day-board').className = viewType === 'board'
        ? 'bg-amber-100 text-amber-700 font-bold px-4 py-2 rounded-t-lg border-b-2 border-amber-500 transition-colors'
        : 'bg-gray-100 text-gray-500 font-bold px-4 py-2 rounded-t-lg border-b-2 border-transparent hover:bg-gray-200 transition-colors';
    document.getElementById('subtab-day-gantt').className = viewType === 'gantt'
        ? 'bg-amber-100 text-amber-700 font-bold px-4 py-2 rounded-t-lg border-b-2 border-amber-500 transition-colors'
        : 'bg-gray-100 text-gray-500 font-bold px-4 py-2 rounded-t-lg border-b-2 border-transparent hover:bg-gray-200 transition-colors';
    if (viewType === 'board') { boardView.classList.remove('hidden'); ganttView.classList.add('hidden'); }
    else { ganttView.classList.remove('hidden'); boardView.classList.add('hidden'); renderTimeline(); }
}

// ===== Gantt Timeline =====
function renderTimeline() {
    // ── 時間軸の定義 ──────────────────────────────────────
    const T_START = 17;              // 開始 17:00
    const T_END   = 30;              // 終了 30:00（翌6:00）
    const T_SPAN  = T_END - T_START; // 13 時間
    const SLOTS   = T_SPAN * 2;      // 26 スロット（30分刻み）

    // "HH:MM" → 時刻軸上の left%（T_STARTを0%とする）
    function toPct(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return ((h + m / 60 - T_START) / T_SPAN * 100).toFixed(3);
    }
    // 開始〜終了の幅%
    function durPct(startStr, endStr) {
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        return (((eh + em / 60) - (sh + sm / 60)) / T_SPAN * 100).toFixed(3);
    }
    // "HH:MM" → 小数時間
    function parseH(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h + m / 60;
    }

    // table-layout:fixed で全行の列幅を厳密に統一し、
    // 時刻ラベルとバーの % 位置が必ず一致するようにする
    let html = `<table style="width:100%;table-layout:fixed;border-collapse:collapse;">
        <colgroup><col style="width:80px;"><col></colgroup>
        <tbody>`;

    // ── 時刻ヘッダー行 ────────────────────────────────────
    html += `<tr>
        <td class="border-b-2 border-gray-300 pb-1" style="width:80px;"></td>
        <td class="border-b-2 border-gray-300 pb-1" style="position:relative;height:22px;">`;
    for (let i = T_START; i <= T_END; i++) {
        const left = ((i - T_START) / T_SPAN * 100).toFixed(3);
        html += `<div style="position:absolute;left:${left}%;top:2px;transform:none;"
            class="text-[10px] font-bold text-gray-500 border-l border-gray-300 pl-0.5 whitespace-nowrap leading-none">${i}:00</div>`;
    }
    html += `</td></tr>`;

    // ── 店舗別バー行 ──────────────────────────────────────
    const requirements = loadRequirements();
    const stores = [
        { id: 'matsuyama', name: '松山店' },
        { id: 'kumoji',    name: '久茂地店' },
        { id: 'miebash',   name: '美栄橋店' },
        { id: 'misato',    name: '美里店' },
    ];
    const matsuyamaCounts = new Array(SLOTS).fill(0);
    let hasAny = false;

    stores.forEach(store => {
        const earlyStaff = getStaffInZone(store.id, 'early');
        const lateStaff  = getStaffInZone(store.id, 'late');
        if (earlyStaff.length === 0 && lateStaff.length === 0) return;
        hasAny = true;

        const storeSlots  = requirements[store.id]?.slots || [];
        const _ganttDow   = currentViewDate.getDay();
        const _ganttDay   = ['日','月','火','水','木','金','土'][_ganttDow];
        const earlySlot   = storeSlots.find(s => s.name.includes('早')) || storeSlots[0];
        // 曜日が一致する遅番スロットを優先的に選択（金土→遅番(金・土)、他→遅番(月〜木・日)）
        const lateSlot    = storeSlots.filter(s => s.name.includes('遅')).find(s => (s.days||[]).includes(_ganttDay))
                         || storeSlots.find(s => s.name.includes('遅'))
                         || storeSlots[1];

        // バー一覧を構築（早番 → 遅番の順）
        const allBars = [];
        if (earlyStaff.length > 0 && earlySlot) {
            earlyStaff.forEach(staff => allBars.push({ staff, slot: earlySlot }));
            if (store.id === 'matsuyama') {
                const s = Math.max(0, Math.round((parseH(earlySlot.start) - T_START) * 2));
                const e = Math.min(SLOTS, Math.round((parseH(earlySlot.end) - T_START) * 2));
                earlyStaff.forEach(() => { for (let i = s; i < e; i++) matsuyamaCounts[i]++; });
            }
        }
        if (lateStaff.length > 0 && lateSlot) {
            lateStaff.forEach(staff => allBars.push({ staff, slot: lateSlot }));
            if (store.id === 'matsuyama') {
                const s = Math.max(0, Math.round((parseH(lateSlot.start) - T_START) * 2));
                const e = Math.min(SLOTS, Math.round((parseH(lateSlot.end) - T_START) * 2));
                lateStaff.forEach(() => { for (let i = s; i < e; i++) matsuyamaCounts[i]++; });
            }
        }

        const rowH = allBars.length * 22 + 6;
        html += `<tr class="border-b border-gray-200">
            <td class="text-[11px] font-bold text-slate-700 pr-2 align-top" style="width:80px;padding-top:4px;">${store.name}</td>
            <td style="position:relative;height:${rowH}px;">`;

        allBars.forEach(({ staff, slot }, idx) => {
            const c    = layerStyles[staff.layer];
            const left = toPct(slot.start);
            const w    = durPct(slot.start, slot.end);
            const top  = idx * 22;
            html += `<div class="${c} text-[10px] leading-tight rounded px-1 shadow-sm border"
                style="position:absolute;left:${left}%;width:${w}%;top:${top}px;height:20px;
                       box-sizing:border-box;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
                <span class="font-bold opacity-70">${staff.layer}</span> ${staff.name}</div>`;
        });

        html += `</td></tr>`;
    });

    // ── 松山店 総稼働バーチャート ─────────────────────────
    html += `<tr class="border-t-2 border-gray-300">
        <td class="text-[10px] font-bold text-slate-600 align-bottom leading-tight" style="width:80px;padding-bottom:4px;">松山店<br>総稼働</td>
        <td style="position:relative;height:52px;">`;

    for (let i = 0; i < SLOTS; i++) {
        const cnt  = matsuyamaCounts[i];
        const left = (i / SLOTS * 100).toFixed(3);
        const w    = (1 / SLOTS * 100).toFixed(3);
        const hPct = cnt === 0 ? 0 : Math.min(cnt * 20, 100);
        const bg   = cnt >= 4 ? 'bg-emerald-400' : cnt >= 2 ? 'bg-amber-400' : cnt === 1 ? 'bg-red-400' : 'bg-gray-100';
        html += `<div style="position:absolute;left:${left}%;width:calc(${w}% - 1px);height:100%;
                            display:flex;flex-direction:column;justify-content:flex-end;">
            <div class="text-center text-[9px] font-bold text-gray-500 leading-none ${cnt===0?'opacity-0':''}" style="margin-bottom:2px;">${cnt}</div>
            <div class="w-full rounded-t ${bg}" style="height:${hPct}%;"></div>
        </div>`;
    }

    html += `</td></tr></tbody></table>`;

    if (!hasAny) {
        html = `<div class="text-center text-gray-400 py-10 text-sm"><i class="fa-solid fa-box-open mb-2 text-2xl"></i><br>スタッフを配置するとタイムラインが表示されます</div>`;
    }
    document.getElementById('day-timeline-container').innerHTML = html;
}

// ===== Week Sub-tabs =====
function switchWeekView(viewType) {
    document.getElementById('subtab-week-staff').className = viewType === 'staff'
        ? 'bg-amber-100 text-amber-700 font-bold px-4 py-2 rounded-t-lg border-b-2 border-amber-500 transition-colors'
        : 'bg-gray-100 text-gray-500 font-bold px-4 py-2 rounded-t-lg border-b-2 border-transparent hover:bg-gray-200 transition-colors';
    document.getElementById('subtab-week-store').className = viewType === 'store'
        ? 'bg-amber-100 text-amber-700 font-bold px-4 py-2 rounded-t-lg border-b-2 border-amber-500 transition-colors'
        : 'bg-gray-100 text-gray-500 font-bold px-4 py-2 rounded-t-lg border-b-2 border-transparent hover:bg-gray-200 transition-colors';
    if (viewType === 'staff') { document.getElementById('week-view-staff').classList.remove('hidden'); document.getElementById('week-view-store').classList.add('hidden'); }
    else { document.getElementById('week-view-store').classList.remove('hidden'); document.getElementById('week-view-staff').classList.add('hidden'); }
}

// ===== Staff Settings =====
function renderSettingsTable() {
    const tbody = document.getElementById('settings-table-body');
    tbody.innerHTML = '';
    initialStaff.forEach((staff, idx) => {
        const age     = getAge(staff.birthdate);
        const under18 = isUnder18(staff.birthdate);
        const isManagerLayer = staff.layer === 'S' || staff.layer === 'A' || staff.layer === 'B';

        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 hover:bg-gray-50';

        // 給与欄：経営者モードでないかつA/B層は非表示
        const salaryCell = isManagerLayer && !adminMode
            ? `<td class="px-2 py-2 text-center text-gray-300 text-xs"><i class="fa-solid fa-lock"></i></td>`
            : `<td class="px-2 py-2">
                <div class="flex items-center gap-1">
                    <span class="text-xs text-gray-400">${staff.salaryType==='hourly'?'¥/h':'¥/月'}</span>
                    <input type="number" value="${staff.salary}" onchange="updateStaff(${idx},'salary',+this.value)"
                        class="w-28 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-400">
                </div>
              </td>`;

        tr.innerHTML = `
            <td class="px-2 py-2 text-center">
                <span class="inline-block w-3 h-3 rounded-full ${staff.layer==='A'?'bg-red-400':staff.layer==='B'?'bg-blue-400':staff.layer==='C'?'bg-green-400':'bg-gray-400'}"></span>
            </td>
            <td class="px-2 py-2">
                <input type="text" value="${staff.name}" onchange="updateStaff(${idx},'name',this.value)"
                    class="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-400">
            </td>
            <td class="px-2 py-2">
                <select onchange="updateStaff(${idx},'layer',this.value)" class="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-400">
                    ${['S','A','B','C','D'].map(l => `<option value="${l}" ${staff.layer===l?'selected':''}>${l}${l==='S'?' (役員)':l==='A'?' (正社員)':l==='B'?' (外国籍社員)':l==='C'?' (熟練バイト)':' (未熟バイト)'}</option>`).join('')}
                </select>
            </td>
            <td class="px-2 py-2">
                <select onchange="updateStaff(${idx},'salaryType',this.value)" class="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-400">
                    <option value="monthly" ${staff.salaryType==='monthly'?'selected':''}>月給</option>
                    <option value="hourly"  ${staff.salaryType==='hourly'?'selected':''}>時給</option>
                </select>
            </td>
            ${salaryCell}
            <td class="px-2 py-2">
                <div class="flex items-center gap-1">
                    <input type="date" value="${staff.birthdate||''}" onchange="updateStaff(${idx},'birthdate',this.value)"
                        class="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-400">
                    ${under18
                        ? `<span class="text-[10px] bg-orange-100 text-orange-700 px-1 rounded font-bold">🔞${age}歳</span>`
                        : `<span class="text-[10px] text-gray-400">${age}歳</span>`}
                </div>
            </td>
            <td class="px-2 py-2">
                <select onchange="updateStaff(${idx},'fixedStore',this.value)" class="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-amber-400">
                    ${Object.entries(STORES_MAP).map(([k,v]) => `<option value="${k}" ${staff.fixedStore===k?'selected':''}>${v}</option>`).join('')}
                </select>
            </td>
            <td class="px-2 py-2">
                <div class="flex flex-wrap gap-1">
                    ${ALL_DAYS.map(d => `
                        <label class="flex items-center gap-0.5 cursor-pointer">
                            <input type="checkbox" ${(staff.unavailableDays||[]).includes(d)?'checked':''} onchange="toggleDay(${idx},'${d}',this.checked)" class="w-3 h-3 accent-red-500">
                            <span class="text-[10px] ${d==='土'?'text-blue-600':d==='日'?'text-red-600':'text-gray-600'}">${d}</span>
                        </label>`).join('')}
                </div>
            </td>
            <td class="px-2 py-2">
                <input type="text" value="${staff.notes||''}" placeholder="メモ" onchange="updateStaff(${idx},'notes',this.value)"
                    class="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-400">
            </td>
            <td class="px-2 py-2 text-center">
                <button onclick="removeStaff(${idx})" class="text-red-400 hover:text-red-600 transition" title="削除">
                    <i class="fa-solid fa-trash text-sm"></i>
                </button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function updateStaff(idx, field, value) { initialStaff[idx][field] = value; }
function toggleDay(idx, day, checked) {
    if (!initialStaff[idx].unavailableDays) initialStaff[idx].unavailableDays = [];
    if (checked) { if (!initialStaff[idx].unavailableDays.includes(day)) initialStaff[idx].unavailableDays.push(day); }
    else { initialStaff[idx].unavailableDays = initialStaff[idx].unavailableDays.filter(d => d !== day); }
}
function addStaff() {
    initialStaff.push({ id:'staff_'+Date.now(), name:'新スタッフ', layer:'D', salaryType:'hourly', salary:1000, birthdate:'', fixedStore:'', unavailableDays:[], notes:'' });
    renderSettingsTable();
}
function removeStaff(idx) {
    if (confirm(`「${initialStaff[idx].name}」を削除しますか？`)) { initialStaff.splice(idx, 1); renderSettingsTable(); }
}
function saveSettings() {
    saveStaffData(initialStaff);
    renderStaffPool();
    const status = document.getElementById('save-status');
    status.classList.remove('hidden');
    setTimeout(() => status.classList.add('hidden'), 2000);
}
function resetSettings() {
    if (confirm('デフォルトのスタッフデータに戻しますか？')) {
        initialStaff = JSON.parse(JSON.stringify(DEFAULT_STAFF));
        saveStaffData(initialStaff);
        renderSettingsTable();
        renderStaffPool();
    }
}

// ===== 必須人員マスタ =====
const STORES_LIST = [
    { id:'matsuyama', name:'松山店' },
    { id:'kumoji',    name:'久茂地店' },
    { id:'miebash',   name:'美栄橋店' },
    { id:'misato',    name:'美里店' },
];
const DEFAULT_REQUIREMENTS = {
    matsuyama: { slots: [
        { id:'s1', name:'早番', start:'17:30', end:'26:30', days:['月','火','水','木','金','土','日'], rules:[{ label:'責任者', layers:['A','B'], min:1 },{ label:'スタッフ', layers:['C','D'], min:2 }] },
        { id:'s2', name:'遅番（月〜木・日）', start:'20:00', end:'25:00', days:['月','火','水','木','日'], rules:[{ label:'管理職(S/A/B)', layers:['S','A','B'], min:1 },{ label:'総員', layers:['S','A','B','C','D'], min:3 }] },
        { id:'s3', name:'遅番（金・土）',     start:'20:00', end:'30:00', days:['金','土'],               rules:[{ label:'管理職(S/A/B)', layers:['S','A','B'], min:1 },{ label:'総員', layers:['S','A','B','C','D'], min:4 }] },
    ]},
    kumoji:  { slots: [{ id:'s1', name:'早番', start:'17:30', end:'26:30', days:['月','火','水','木','金','土','日'], rules:[{ label:'責任者', layers:['A','B'], min:1 },{ label:'スタッフ', layers:['C','D'], min:2 }] }] },
    miebash: { slots: [{ id:'s1', name:'早番', start:'17:30', end:'26:30', days:['月','火','水','木','金','土','日'], rules:[{ label:'責任者', layers:['A','B'], min:1 },{ label:'スタッフ', layers:['C','D'], min:2 }] }] },
    misato:  { slots: [{ id:'s1', name:'早番', start:'17:30', end:'26:30', days:['月','火','水','木','金','土','日'], rules:[{ label:'責任者', layers:['A','B'], min:1 },{ label:'スタッフ', layers:['C','D'], min:2 }] }] },
};

function loadRequirements() {
    const saved = localStorage.getItem('okk_requirements');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_REQUIREMENTS));
}
function saveRequirements() {
    localStorage.setItem('okk_requirements', JSON.stringify(reqData));
    gasPost('requirements', reqData);
    const st = document.getElementById('req-save-status');
    st.classList.remove('hidden');
    setTimeout(() => st.classList.add('hidden'), 2000);
}
function renderRequirementsView() {
    if (!reqData) reqData = loadRequirements();
    renderReqStoreTabs();
    renderReqStoreContent();
}
function renderReqStoreTabs() {
    document.getElementById('req-store-tabs').innerHTML = STORES_LIST.map(s => `
        <button onclick="switchReqStore('${s.id}')" id="req-tab-${s.id}"
            class="px-4 py-2 rounded-t-lg font-bold text-sm transition border-b-2
            ${s.id === reqActiveStore ? 'bg-white border-amber-500 text-amber-700 shadow-sm' : 'bg-gray-200 border-transparent text-gray-500 hover:bg-gray-300'}">
            <i class="fa-solid fa-store mr-1"></i>${s.name}
        </button>`).join('');
}
function switchReqStore(storeId) { reqActiveStore = storeId; renderReqStoreTabs(); renderReqStoreContent(); }
function renderReqStoreContent() {
    const store = STORES_LIST.find(s => s.id === reqActiveStore);
    const slots = reqData[reqActiveStore]?.slots || [];
    document.getElementById('req-store-content').innerHTML = `
        <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <div class="flex justify-between items-center mb-4">
                <h3 class="font-bold text-slate-700 text-base"><i class="fa-solid fa-store mr-2 text-amber-500"></i>${store.name} の時間帯設定</h3>
                <button onclick="addSlot()" class="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-sm font-bold transition">
                    <i class="fa-solid fa-plus mr-1"></i>時間帯を追加
                </button>
            </div>
            <div class="space-y-4">${slots.map((slot, si) => renderSlotCard(slot, si)).join('')}</div>
            ${slots.length === 0 ? '<p class="text-center text-gray-400 py-8 text-sm">時間帯がありません。</p>' : ''}
        </div>`;
}
function renderSlotCard(slot, si) {
    const dayBtns = ALL_DAYS.map(d => `
        <label class="cursor-pointer">
            <input type="checkbox" class="hidden peer" ${slot.days.includes(d)?'checked':''} onchange="toggleSlotDay(${si},'${d}',this.checked)">
            <span class="inline-block w-8 h-8 rounded-full border-2 text-xs font-bold flex items-center justify-center transition
                peer-checked:bg-amber-500 peer-checked:border-amber-500 peer-checked:text-white border-gray-300 text-gray-400 hover:border-amber-300
                ${d==='土'?'text-blue-500':d==='日'?'text-red-500':''}">${d}</span>
        </label>`).join('');
    return `
        <div class="border border-gray-200 rounded-xl p-4 bg-gray-50">
            <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3 flex-wrap">
                    <input type="text" value="${slot.name}" placeholder="時間帯名" onchange="updateSlot(${si},'name',this.value)"
                        class="font-bold text-slate-800 border border-gray-300 rounded px-2 py-1 text-sm w-28 focus:outline-none focus:border-amber-400">
                    <div class="flex items-center gap-1 text-sm text-gray-600">
                        <i class="fa-solid fa-clock text-gray-400"></i>
                        <input type="text" value="${slot.start}" onchange="updateSlot(${si},'start',this.value)"
                            class="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-center focus:outline-none focus:border-amber-400">
                        <span>〜</span>
                        <input type="text" value="${slot.end}" onchange="updateSlot(${si},'end',this.value)"
                            class="border border-gray-300 rounded px-2 py-1 text-sm w-20 text-center focus:outline-none focus:border-amber-400">
                    </div>
                    <div class="flex gap-1 items-center">${dayBtns}</div>
                </div>
                <button onclick="removeSlot(${si})" class="text-red-400 hover:text-red-600 ml-2"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="mt-3">
                <p class="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">必須人員ルール</p>
                <div class="space-y-2">${slot.rules.map((rule, ri) => renderRuleRow(rule, si, ri)).join('')}</div>
                <button onclick="addRule(${si})" class="mt-2 text-xs text-amber-600 hover:text-amber-800 font-bold flex items-center gap-1">
                    <i class="fa-solid fa-plus-circle"></i> ルールを追加
                </button>
            </div>
        </div>`;
}
function renderRuleRow(rule, si, ri) {
    const layerCbs = ['A','B','C','D'].map(l => `
        <label class="cursor-pointer flex items-center gap-1">
            <input type="checkbox" ${rule.layers.includes(l)?'checked':''} onchange="toggleRuleLayer(${si},${ri},'${l}',this.checked)" class="w-3.5 h-3.5 accent-amber-500">
            <span class="text-xs font-bold ${l==='A'?'text-red-600':l==='B'?'text-blue-600':l==='C'?'text-green-600':'text-gray-600'}">${l}</span>
        </label>`).join('');
    return `
        <div class="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <input type="text" value="${rule.label}" onchange="updateRule(${si},${ri},'label',this.value)"
                class="border border-gray-200 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:border-amber-400">
            <span class="text-xs text-gray-500 flex-shrink-0">対象層：</span>
            <div class="flex gap-3">${layerCbs}</div>
            <span class="text-xs text-gray-500 flex-shrink-0 ml-2">最低</span>
            <input type="number" value="${rule.min}" min="1" max="10" onchange="updateRule(${si},${ri},'min',+this.value)"
                class="border border-gray-200 rounded px-2 py-1 text-xs w-14 text-center focus:outline-none focus:border-amber-400">
            <span class="text-xs text-gray-500">名</span>
            <button onclick="removeRule(${si},${ri})" class="text-red-400 hover:text-red-600 ml-auto"><i class="fa-solid fa-times text-xs"></i></button>
        </div>`;
}
function addSlot() {
    if (!reqData[reqActiveStore]) reqData[reqActiveStore] = { slots: [] };
    reqData[reqActiveStore].slots.push({ id:'slot_'+Date.now(), name:'新時間帯', start:'17:00', end:'25:00', days:[...ALL_DAYS], rules:[{ label:'責任者', layers:['A','B'], min:1 }] });
    renderReqStoreContent();
}
function removeSlot(si) { if (confirm('この時間帯を削除しますか？')) { reqData[reqActiveStore].slots.splice(si,1); renderReqStoreContent(); } }
function updateSlot(si, field, value) { reqData[reqActiveStore].slots[si][field] = value; }
function toggleSlotDay(si, day, checked) {
    const days = reqData[reqActiveStore].slots[si].days;
    if (checked && !days.includes(day)) days.push(day);
    if (!checked) reqData[reqActiveStore].slots[si].days = days.filter(d => d !== day);
}
function addRule(si) { reqData[reqActiveStore].slots[si].rules.push({ label:'スタッフ', layers:['C','D'], min:1 }); renderReqStoreContent(); }
function removeRule(si, ri) { reqData[reqActiveStore].slots[si].rules.splice(ri,1); renderReqStoreContent(); }
function updateRule(si, ri, field, value) { reqData[reqActiveStore].slots[si].rules[ri][field] = value; }
function toggleRuleLayer(si, ri, layer, checked) {
    const layers = reqData[reqActiveStore].slots[si].rules[ri].layers;
    if (checked && !layers.includes(layer)) layers.push(layer);
    if (!checked) reqData[reqActiveStore].slots[si].rules[ri].layers = layers.filter(l => l !== layer);
}

// ===== CSV Import / Export =====
function importStaffCSV(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const lines = e.target.result.split('\n').filter(l => l.trim());
            const headers = lines[0].split(',').map(h => h.trim());
            const imported = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length < 2) continue;
                const get = name => (cols[headers.indexOf(name)] || '').trim();
                imported.push({
                    id: 'csv_' + Date.now() + '_' + i,
                    name: get('名前'), layer: get('レイヤー') || 'D',
                    salaryType: get('給与タイプ') || 'hourly',
                    salary: parseFloat(get('給与額')) || 1000,
                    birthdate: get('生年月日') || '',
                    fixedStore: get('固定店舗') || '',
                    unavailableDays: get('出勤不可曜日') ? get('出勤不可曜日').split('|').filter(Boolean) : [],
                    notes: get('メモ') || '',
                });
            }
            if (imported.length === 0) { alert('読み込めるデータがありませんでした。'); return; }
            if (confirm(`${imported.length}名のスタッフを読み込みます。既存データを上書きしますか？`)) {
                initialStaff = imported;
                saveStaffData(initialStaff);
                renderSettingsTable();
                renderStaffPool();
                alert(`✅ ${imported.length}名を読み込みました！`);
            }
        } catch (err) { alert('CSVの読み込みに失敗しました: ' + err.message); }
        input.value = '';
    };
    reader.readAsText(file, 'UTF-8');
}
function exportStaffCSV() {
    const headers = ['名前','レイヤー','給与タイプ','給与額','生年月日','固定店舗','出勤不可曜日','メモ'];
    const rows = initialStaff.map(s => [s.name, s.layer, s.salaryType, s.salary, s.birthdate||'', s.fixedStore||'', (s.unavailableDays||[]).join('|'), s.notes||'']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'staff_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click();
}

// ===== AI Shift Generation =====
const LABOR_API_URL = 'https://script.google.com/macros/s/AKfycbyshjsL_IXWMia1n3pg0SbQVhJgzoBpA65ywfNVM2tzVKRSp1sVc6fn02NbhZQq0TOI/exec';

function openAIModal() {
    const today = new Date();
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay()+6)%7));
    document.getElementById('ai-week-start').value = mon.toISOString().slice(0,10);

    const staff = loadStaff();
    const reqs  = loadRequirements();
    document.getElementById('ai-info-staff').textContent    = staff.length;
    document.getElementById('ai-info-rules').textContent    = Object.keys(reqs).length;
    document.getElementById('ai-info-under18').textContent  = staff.filter(s => isUnder18(s.birthdate)).length;

    document.getElementById('ai-result-area').classList.add('hidden');
    document.getElementById('ai-apply-btn').classList.add('hidden');
    document.getElementById('ai-error').classList.add('hidden');
    document.getElementById('ai-modal').classList.remove('hidden');
}
function closeAIModal() { document.getElementById('ai-modal').classList.add('hidden'); }

function getWeekDates(mondayStr) {
    const days = ['月','火','水','木','金','土','日'];
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mondayStr);
        d.setDate(d.getDate() + i);
        return { date: d.toISOString().slice(0,10), dayOfWeek: days[i] };
    });
}

async function runAIShift() {
    const weekStart = document.getElementById('ai-week-start').value;
    if (!weekStart) { alert('対象週の開始日を選んでください'); return; }
    const btn = document.getElementById('ai-run-btn');
    const loading = document.getElementById('ai-loading');
    const errorEl = document.getElementById('ai-error');
    btn.disabled = true;
    loading.classList.remove('hidden');
    errorEl.classList.add('hidden');
    document.getElementById('ai-result-area').classList.add('hidden');
    document.getElementById('ai-apply-btn').classList.add('hidden');
    try {
        const payload = {
            staffData: loadStaff(), requirements: loadRequirements(),
            weekDates: getWeekDates(weekStart),
            userPrompt: document.getElementById('ai-prompt').value,
        };
        const res = await fetch(LABOR_API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), redirect:'follow' });
        const json = await res.json();
        if (json.status !== 'ok') throw new Error(json.message || 'エラーが発生しました');
        lastAIShift = json.shift;
        renderAIResult(json.shift);
        document.getElementById('ai-result-area').classList.remove('hidden');
        document.getElementById('ai-apply-btn').classList.remove('hidden');
    } catch (err) {
        errorEl.textContent = 'エラー: ' + err.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        loading.classList.add('hidden');
    }
}

function renderAIResult(shift) {
    const warnEl = document.getElementById('ai-warnings');
    if (shift.warnings?.length > 0) {
        warnEl.innerHTML = shift.warnings.map(w =>
            `<div class="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm text-amber-800 mb-1"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${w}</div>`
        ).join('');
        warnEl.classList.remove('hidden');
    } else { warnEl.classList.add('hidden'); }

    document.getElementById('ai-summary').textContent = shift.summary || '';

    const dates = [...new Set(shift.shifts.map(s => s.date))].sort();
    const slotKeys = [...new Map(shift.shifts.map(s => [`${s.storeId}_${s.slotName}`, { storeId:s.storeId, storeName:s.storeName, slotName:s.slotName }])).values()];

    let html = `<table class="w-full text-xs border-collapse">
        <thead><tr>
            <th class="bg-gray-100 border border-gray-300 px-2 py-1.5 text-left">店舗・枠</th>
            ${dates.map(d => {
                const dow = shift.shifts.find(s => s.date === d)?.dayOfWeek || '';
                return `<th class="bg-gray-100 border border-gray-300 px-2 py-1.5 text-center ${dow==='土'?'text-blue-600':dow==='日'?'text-red-600':''}">${d.slice(5).replace('-','/')}<br>${dow}</th>`;
            }).join('')}
        </tr></thead><tbody>`;

    slotKeys.forEach(key => {
        html += `<tr><td class="border border-gray-300 px-2 py-1 font-bold bg-slate-50 whitespace-nowrap">${key.storeName}<br><span class="text-gray-500 font-normal">${key.slotName}</span></td>`;
        dates.forEach(date => {
            const entry = shift.shifts.find(s => s.date===date && s.storeId===key.storeId && s.slotName===key.slotName);
            if (entry?.staff?.length > 0) {
                html += `<td class="border border-gray-300 px-1 py-1 align-top">${entry.staff.map(st =>
                    `<div class="flex items-center gap-0.5 mb-0.5">
                        <span class="font-bold ${st.layer==='A'?'text-red-600':st.layer==='B'?'text-blue-600':st.layer==='C'?'text-green-600':'text-gray-500'}">${st.layer}</span>
                        <span>${st.name}</span>
                    </div>`).join('')}</td>`;
            } else {
                html += `<td class="border border-gray-300 px-1 py-1 text-gray-300 text-center">-</td>`;
            }
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('ai-shift-preview').innerHTML = html;
}

function applyAIShift() {
    if (!lastAIShift) return;
    const currentStaff = loadStaff();

    // AIシフト結果を allShiftsData に保存
    lastAIShift.shifts.forEach(entry => {
        const { date, storeId, slotName, staff: shiftStaff } = entry;
        if (!allShiftsData[date]) allShiftsData[date] = {};
        if (!allShiftsData[date][storeId]) allShiftsData[date][storeId] = {};
        const slot = slotName.includes('遅') ? 'late' : 'early';
        const ids = shiftStaff.map(ai => {
            const found = currentStaff.find(s => s.name === ai.name || s.id === ai.id);
            return found ? found.id : null;
        }).filter(Boolean);
        if (ids.length > 0) allShiftsData[date][storeId][slot] = ids;
    });

    saveShiftsData(allShiftsData);

    // 週の開始を合わせる
    const firstDate = lastAIShift.shifts[0]?.date;
    if (firstDate) currentWeekStart = getMonday(new Date(firstDate));

    closeAIModal();
    switchView('week');
    alert('✅ AIシフト案を保存しました。週間シフト表で確認・調整してください。');
}

window.addEventListener('DOMContentLoaded', init);
