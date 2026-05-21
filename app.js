/* -------------------------------------------------------------
 * 逢甲大學畢業門檻與時間管理整合系統 - 核心邏輯
 * ------------------------------------------------------------- */

// 初始化狀態變數
let state = {
  theme: 'dark',
  totalTargetCredits: 128,
  categories: [],
  courses: [],
  nonCredit: {
    englishPassed: false,
    englishDetail: '',
    service1: false,
    service2: false,
    ethicsPassed: false,
    pe1: false,
    pe2: false
  }
};

// 範本預設資料
const PRESETS = {
  'fcu-standard': {
    totalTargetCredits: 128,
    categories: [
      { id: 'cat-1', name: '通識基礎與核心課程', target: 22, color: '#3b82f6' },
      { id: 'cat-2', name: '學系必修課程', target: 60, color: '#ef4444' },
      { id: 'cat-3', name: '學系專業選修', target: 30, color: '#f59e0b' },
      { id: 'cat-4', name: '自由選修', target: 16, color: '#10b981' }
    ]
  },
  'fcu-iecs': { // 逢甲資工
    totalTargetCredits: 128,
    categories: [
      { id: 'cat-iecs-1', name: '通識課程', target: 22, color: '#3b82f6' },
      { id: 'cat-iecs-2', name: '資電院必修與基礎學科', target: 12, color: '#8b5cf6' },
      { id: 'cat-iecs-3', name: '學系必修課程', target: 52, color: '#ef4444' },
      { id: 'cat-iecs-4', name: '學系專業選修', target: 28, color: '#f59e0b' },
      { id: 'cat-iecs-5', name: '自由選修', target: 14, color: '#10b981' }
    ],
    courses: [
      // 提供一些資工基本修課範例
      { id: 'c-1', name: '計算機概論', categoryId: 'cat-iecs-3', credits: 3, semester: '110-1', status: 'completed' },
      { id: 'c-2', name: '微積分一', categoryId: 'cat-iecs-2', credits: 3, semester: '110-1', status: 'completed' },
      { id: 'c-3', name: '程式設計', categoryId: 'cat-iecs-3', credits: 3, semester: '110-1', status: 'completed' },
      { id: 'c-4', name: '資料結構', categoryId: 'cat-iecs-3', credits: 3, semester: '110-2', status: 'completed' },
      { id: 'c-5', name: '演算法', categoryId: 'cat-iecs-3', credits: 3, semester: '111-1', status: 'completed' }
    ]
  },
  'fcu-co': { // 逢甲商學院
    totalTargetCredits: 128,
    categories: [
      { id: 'cat-co-1', name: '通識課程', target: 22, color: '#3b82f6' },
      { id: 'cat-co-2', name: '商管院必修基礎', target: 20, color: '#8b5cf6' },
      { id: 'cat-co-3', name: '學系必修課程', target: 48, color: '#ef4444' },
      { id: 'cat-co-4', name: '學系專業選修', target: 24, color: '#f59e0b' },
      { id: 'cat-co-5', name: '自由選修', target: 14, color: '#10b981' }
    ]
  },
  'empty': {
    totalTargetCredits: 128,
    categories: []
  }
};

// DOM 元素快取
const DOM = {
  themeToggle: document.getElementById('theme-toggle'),
  presetTemplates: document.getElementById('preset-templates'),
  earnedCreditsTotal: document.getElementById('earned-credits-total'),
  targetCreditsTotal: document.getElementById('target-credits-total'),
  overallPercentageBadge: document.getElementById('overall-percentage-badge'),
  mainProgressRing: document.getElementById('main-progress-ring'),
  
  statCompletedCredits: document.getElementById('stat-completed-credits'),
  statInprogressCredits: document.getElementById('stat-inprogress-credits'),
  statPlannedCredits: document.getElementById('stat-planned-credits'),
  
  categoriesBody: document.getElementById('categories-body'),
  thresholdSumWarning: document.getElementById('threshold-sum-warning'),
  warningText: document.getElementById('warning-text'),
  
  courseForm: document.getElementById('course-form'),
  courseFormTitle: document.getElementById('course-form-title'),
  courseId: document.getElementById('course-id'),
  courseName: document.getElementById('course-name'),
  courseCategory: document.getElementById('course-category'),
  courseCredits: document.getElementById('course-credits'),
  courseSemester: document.getElementById('course-semester'),
  courseStatus: document.getElementById('course-status'),
  btnSubmitCourse: document.getElementById('btn-submit-course'),
  btnCancelEdit: document.getElementById('btn-cancel-edit'),
  
  filterSemester: document.getElementById('filter-semester'),
  semesterGrid: document.getElementById('semester-grid'),
  
  // 非學分面板
  reqEnglish: document.getElementById('req-english'),
  descEnglish: document.getElementById('desc-english'),
  reqService: document.getElementById('req-service'),
  descService: document.getElementById('desc-service'),
  reqEthics: document.getElementById('req-ethics'),
  descEthics: document.getElementById('desc-ethics'),
  reqPE: document.getElementById('req-pe'),
  descPE: document.getElementById('desc-pe'),
  
  // 彈窗
  modalCategory: document.getElementById('modal-category'),
  categoryModalForm: document.getElementById('category-modal-form'),
  categoryModalTitle: document.getElementById('category-modal-title'),
  editCatId: document.getElementById('edit-cat-id'),
  catName: document.getElementById('cat-name'),
  catTarget: document.getElementById('cat-target'),
  catColor: document.getElementById('cat-color'),
  
  modalNonCredit: document.getElementById('modal-non-credit'),
  nonCreditForm: document.getElementById('non-credit-form'),
  ncEnglishPassed: document.getElementById('nc-english-passed'),
  ncEnglishDetail: document.getElementById('nc-english-detail'),
  ncService1: document.getElementById('nc-service-1'),
  ncService2: document.getElementById('nc-service-2'),
  ncEthicsPassed: document.getElementById('nc-ethics-passed'),
  ncPE1: document.getElementById('nc-pe-1'),
  ncPE2: document.getElementById('nc-pe-2'),
  
  modalTotalCredits: document.getElementById('modal-total-credits'),
  totalCreditsForm: document.getElementById('total-credits-form'),
  inputTotalCredits: document.getElementById('input-total-credits'),
  
  // 系統動作
  btnExport: document.getElementById('btn-export'),
  btnImportTrigger: document.getElementById('btn-import-trigger'),
  fileImport: document.getElementById('file-import'),
  btnReset: document.getElementById('btn-reset'),
  
  // 按鈕與點擊
  btnAddCategory: document.getElementById('btn-add-category'),
  btnEditTotalCredits: document.getElementById('btn-edit-total-credits'),
  btnEditNonCredit: document.getElementById('btn-edit-non-credit'),
  toastContainer: document.getElementById('toast-container'),

  // 彈窗內控制按鈕
  btnCancelTotalModal: document.getElementById('btn-cancel-total-modal'),
  btnCloseTotalModal: document.getElementById('btn-close-total-modal'),
  btnCancelCatModal: document.getElementById('btn-cancel-cat-modal'),
  btnCloseCatModal: document.getElementById('btn-close-cat-modal'),
  btnCancelNcModal: document.getElementById('btn-cancel-nc-modal'),
  btnCloseNonCreditModal: document.getElementById('btn-close-non-credit-modal')
};

// -------------------------------------------------------------
// Toast 訊息元件
// -------------------------------------------------------------
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  DOM.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('toast-closing');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3500);
}

// -------------------------------------------------------------
// 資料狀態存取與初始化
// -------------------------------------------------------------
function loadState() {
  const saved = localStorage.getItem('fcu_grad_planner_state');
  if (saved) {
    try {
      state = JSON.parse(saved);
      // 確保結構完整性
      if (!state.nonCredit) state.nonCredit = { ...PRESETS['fcu-standard'].nonCredit };
      if (!state.courses) state.courses = [];
      if (!state.categories) state.categories = [...PRESETS['fcu-standard'].categories];
      if (!state.totalTargetCredits) state.totalTargetCredits = 128;
      if (!state.theme) state.theme = 'dark';
    } catch (e) {
      console.error('讀取存檔失敗，還原預設範本', e);
      applyPreset('fcu-standard', false);
    }
  } else {
    // 首次開啟，套用通用範本
    applyPreset('fcu-standard', false);
  }
  
  // 套用主題
  document.body.className = state.theme === 'dark' ? 'dark-theme' : 'light-theme';
}

function saveState() {
  localStorage.setItem('fcu_grad_planner_state', JSON.stringify(state));
  renderAll();
}

function applyPreset(presetKey, shouldNotify = true) {
  const preset = PRESETS[presetKey];
  if (!preset) return;
  
  state.totalTargetCredits = preset.totalTargetCredits;
  state.categories = JSON.parse(JSON.stringify(preset.categories));
  state.courses = preset.courses ? JSON.parse(JSON.stringify(preset.courses)) : [];
  
  if (shouldNotify) {
    showToast(`已成功套用範本！`, 'success');
  }
}

// -------------------------------------------------------------
// 計算統計數據
// -------------------------------------------------------------
function calculateStats() {
  const stats = {
    totalTarget: state.totalTargetCredits,
    earnedTotal: 0,
    completed: 0,
    inprogress: 0,
    planned: 0,
    categoryBreakdown: {}
  };

  // 初始化各類別累計
  state.categories.forEach(cat => {
    stats.categoryBreakdown[cat.id] = {
      completed: 0,
      inprogress: 0,
      planned: 0
    };
  });

  // 累計各課程學分
  state.courses.forEach(course => {
    const cred = parseFloat(course.credits) || 0;
    const catId = course.categoryId;
    
    // 計算全域狀態
    if (course.status === 'completed') {
      stats.completed += cred;
      stats.earnedTotal += cred; // 已通過計入已取得學分
    } else if (course.status === 'inprogress') {
      stats.inprogress += cred;
    } else if (course.status === 'planned') {
      stats.planned += cred;
    }

    // 計算分類學分
    if (stats.categoryBreakdown[catId]) {
      if (course.status === 'completed') {
        stats.categoryBreakdown[catId].completed += cred;
      } else if (course.status === 'inprogress') {
        stats.categoryBreakdown[catId].inprogress += cred;
      } else if (course.status === 'planned') {
        stats.categoryBreakdown[catId].planned += cred;
      }
    }
  });

  return stats;
}

// -------------------------------------------------------------
// UI 渲染方法 (Rendering Functions)
// -------------------------------------------------------------

// 1. 渲染頂部與整體環形進度
function renderOverview(stats) {
  DOM.earnedCreditsTotal.textContent = stats.earnedTotal;
  DOM.targetCreditsTotal.textContent = stats.totalTarget;
  
  const percentage = stats.totalTarget > 0 ? Math.round((stats.earnedTotal / stats.totalTarget) * 100) : 0;
  DOM.overallPercentageBadge.textContent = `${percentage}%`;
  
  // 圓環動畫：半徑為 75，周長為 471.23
  const circ = 471.23;
  // 限制比例最大為 100%，以防爆表畫破圓形
  const fillPercentage = Math.min(percentage, 100);
  const offset = circ - (fillPercentage / 100) * circ;
  DOM.mainProgressRing.style.strokeDashoffset = offset;

  // 細部狀態
  DOM.statCompletedCredits.textContent = stats.completed;
  DOM.statInprogressCredits.textContent = stats.inprogress;
  DOM.statPlannedCredits.textContent = stats.planned;
}

// 2. 渲染非學分門檻指標
function renderNonCredits() {
  const nc = state.nonCredit;

  // 外語門檻
  if (nc.englishPassed) {
    DOM.reqEnglish.className = 'req-item passed';
    DOM.descEnglish.textContent = `已通過門檻 ${nc.englishDetail ? `(${nc.englishDetail})` : ''}`;
  } else {
    DOM.reqEnglish.className = 'req-item failed';
    DOM.descEnglish.textContent = nc.englishDetail ? `未通過 (${nc.englishDetail})` : '未通過 (需上傳多益或修習替代課程)';
  }

  // 服務學習
  if (nc.service1 && nc.service2) {
    DOM.reqService.className = 'req-item passed';
    DOM.descService.textContent = '服務學習（一）及（二）均已通過';
  } else {
    DOM.reqService.className = 'req-item failed';
    const missing = [];
    if (!nc.service1) missing.push('服務學習一');
    if (!nc.service2) missing.push('服務學習二');
    DOM.descService.textContent = `缺：${missing.join('、')}`;
  }

  // 學術倫理
  if (nc.ethicsPassed) {
    DOM.reqEthics.className = 'req-item passed';
    DOM.descEthics.textContent = '已取得修業通過證明';
  } else {
    DOM.reqEthics.className = 'req-item failed';
    DOM.descEthics.textContent = '尚未通過修業 (大一必修學術倫理)';
  }

  // 體育
  if (nc.pe1 && nc.pe2) {
    DOM.reqPE.className = 'req-item passed';
    DOM.descPE.textContent = '大一與大二體育均已通過';
  } else {
    DOM.reqPE.className = 'req-item failed';
    const missingPE = [];
    if (!nc.pe1) missingPE.push('大一體育');
    if (!nc.pe2) missingPE.push('大二體育');
    DOM.descPE.textContent = `缺：${missingPE.join('、')}`;
  }
}

// 3. 渲染學分門檻表格
function renderCategoriesTable(stats) {
  DOM.categoriesBody.innerHTML = '';
  
  let totalCategoryTargets = 0;

  state.categories.forEach(cat => {
    totalCategoryTargets += parseFloat(cat.target) || 0;
    
    const catStats = stats.categoryBreakdown[cat.id] || { completed: 0, inprogress: 0, planned: 0 };
    const progressPercent = cat.target > 0 ? Math.round((catStats.completed / cat.target) * 100) : 0;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <span class="color-badge-preview" style="background-color: ${cat.color};"></span>
        <strong>${escapeHTML(cat.name)}</strong>
      </td>
      <td>
        <span class="color-hex-label">${cat.color}</span>
      </td>
      <td class="text-right">
        <span class="edit-cat-trigger" data-id="${cat.id}" title="點擊編輯目標學分" style="cursor: pointer; text-decoration: underline dashed;">
          ${cat.target}
        </span> 學分
      </td>
      <td class="text-right text-success"><strong>${catStats.completed}</strong></td>
      <td class="text-right text-warning">${catStats.inprogress}</td>
      <td>
        <div class="table-progress-container">
          <div class="table-progress-bar-bg">
            <div class="table-progress-bar-fill" style="width: ${Math.min(progressPercent, 100)}%; background-color: ${cat.color};"></div>
          </div>
          <span class="table-progress-percentage" style="color: ${cat.color};">${progressPercent}%</span>
        </div>
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-link edit-cat-btn" data-id="${cat.id}">編輯</button>
        <button class="btn btn-sm btn-link text-danger delete-cat-btn" data-id="${cat.id}">刪除</button>
      </td>
    `;
    DOM.categoriesBody.appendChild(row);
  });

  // 檢查目標學分總和是否與畢業總學分一致
  if (totalCategoryTargets !== state.totalTargetCredits) {
    DOM.warningText.innerHTML = `自訂分類的目標學分總和為 <strong>${totalCategoryTargets}</strong> 學分，與設定的畢業總目標學分 <strong>${state.totalTargetCredits}</strong> 學分不符！請調整分類以達標。`;
    DOM.thresholdSumWarning.style.display = 'flex';
  } else {
    DOM.thresholdSumWarning.style.display = 'none';
  }

  // 註冊表格內點擊事件
  document.querySelectorAll('.edit-cat-trigger, .edit-cat-btn').forEach(elem => {
    elem.addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryModal(e.target.dataset.id);
    });
  });

  document.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteCategory(btn.dataset.id);
    });
  });
}

// 4. 渲染表單與篩選器的分類下拉選單
function renderCategoryDropdowns() {
  // 快取目前選中的值
  const currentSelectVal = DOM.courseCategory.value;
  
  DOM.courseCategory.innerHTML = '<option value="" disabled selected>請選擇學分分類...</option>';
  
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.name} (目標: ${cat.target} 學分)`;
    DOM.courseCategory.appendChild(opt);
  });

  // 嘗試恢復先前的選取值
  if (currentSelectVal && state.categories.find(c => c.id === currentSelectVal)) {
    DOM.courseCategory.value = currentSelectVal;
  }
}

// 5. 渲染學期課程規劃藍圖
function renderSemesterGrid() {
  DOM.semesterGrid.innerHTML = '';
  
  // 取得篩選學期
  const filterSem = DOM.filterSemester.value;

  // 找出所有存在課程的學期 + 預載標準大一到大四的常用學期
  const standardSemesters = ['110-1', '110-2', '111-1', '111-2', '112-1', '112-2', '113-1', '113-2', '114-1', '114-2'];
  const activeSemesters = [...new Set([...standardSemesters, ...state.courses.map(c => c.semester)])];
  
  // 排序學期 (例如 110-1 < 110-2 < 111-1)
  activeSemesters.sort((a, b) => {
    const [yA, sA] = a.split('-').map(Number);
    const [yB, sB] = b.split('-').map(Number);
    if (yA !== yB) return yA - yB;
    return sA - sB;
  });

  // 如果篩選不是 "all"，僅留下對應學期
  const semestersToRender = filterSem === 'all' ? activeSemesters : [filterSem];

  semestersToRender.forEach(sem => {
    const coursesInSem = state.courses.filter(c => c.semester === sem);
    
    // 計算該學期統計
    let semCompletedCredits = 0;
    let semTotalCredits = 0;
    
    coursesInSem.forEach(c => {
      const cr = parseFloat(c.credits) || 0;
      semTotalCredits += cr;
      if (c.status === 'completed') {
        semCompletedCredits += cr;
      }
    });

    // 建立學期規劃卡片
    const semCard = document.createElement('div');
    semCard.className = 'semester-card';
    
    // 逢甲學分規範檢核 (超修與低限警告)：
    // 一般學生單學期最高限制 25 學分；
    // 大一至大三每學期不得少於 12 或 16 學分（此處通用低於 12 提出警示，大四低於 9 學分）。
    let loadClass = '';
    let loadWarning = '';
    if (semTotalCredits > 25) {
      loadClass = 'overloaded';
      loadWarning = '<span class="text-danger" style="font-weight: 700; font-size: 0.75rem;">⚠️ 學分超修</span>';
    } else if (semTotalCredits > 0 && semTotalCredits < 12) {
      loadClass = 'underloaded';
      loadWarning = '<span class="text-warning" style="font-weight: 700; font-size: 0.75rem;">⚠️ 低限警示</span>';
    }

    if (loadClass) {
      semCard.classList.add(loadClass);
    }

    const semLabel = formatSemesterLabel(sem);
    semCard.innerHTML = `
      <div class="semester-header">
        <div class="flex-between">
          <span class="semester-title">${semLabel}</span>
          ${loadWarning}
        </div>
        <div class="semester-stats">
          <span>總規劃: <strong>${semTotalCredits}</strong> 學分</span>
          <span>已通過: <strong class="text-success">${semCompletedCredits}</strong> 學分</span>
        </div>
      </div>
      <div class="semester-courses-list" id="list-${sem}"></div>
    `;

    DOM.semesterGrid.appendChild(semCard);
    const listContainer = document.getElementById(`list-${sem}`);

    if (coursesInSem.length === 0) {
      listContainer.innerHTML = '<div class="semester-empty">此學期尚無規劃課程</div>';
    } else {
      coursesInSem.forEach(course => {
        const cat = state.categories.find(c => c.id === course.categoryId);
        const catColor = cat ? cat.color : '#cccccc';
        const catName = cat ? cat.name : '未分類';
        
        const pill = document.createElement('div');
        pill.className = 'course-item-pill';
        pill.style.borderLeftColor = catColor;
        pill.innerHTML = `
          <div class="course-item-info">
            <div class="course-item-name" title="${escapeHTML(course.name)}">${escapeHTML(course.name)}</div>
            <div class="course-item-meta">
              <span class="course-status-dot ${course.status}"></span>
              <span>${course.credits} 學分</span>
              <span>•</span>
              <span style="color: ${catColor}; font-weight: 500;">${escapeHTML(catName)}</span>
            </div>
          </div>
          <div class="course-item-actions">
            <button class="course-action-btn edit-course-btn" data-id="${course.id}" title="編輯課程">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="course-action-btn delete delete-course-btn" data-id="${course.id}" title="刪除課程">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        `;
        listContainer.appendChild(pill);
      });
    }
  });

  // 註冊課程的編輯/刪除按鈕事件
  document.querySelectorAll('.edit-course-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleEditCourse(btn.dataset.id);
    });
  });

  document.querySelectorAll('.delete-course-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteCourse(btn.dataset.id);
    });
  });
}

// 6. 渲染學期篩選下拉選單中的動態選項
function renderFilterSemesterDropdown() {
  const activeSems = [...new Set(state.courses.map(c => c.semester))];
  const standardSemesters = ['110-1', '110-2', '111-1', '111-2', '112-1', '112-2', '113-1', '113-2', '114-1', '114-2'];
  const allSems = [...new Set([...standardSemesters, ...activeSems])];
  
  allSems.sort((a, b) => {
    const [yA, sA] = a.split('-').map(Number);
    const [yB, sB] = b.split('-').map(Number);
    if (yA !== yB) return yA - yB;
    return sA - sB;
  });

  const prevVal = DOM.filterSemester.value;
  DOM.filterSemester.innerHTML = '<option value="all">所有學期 (學年總覽)</option>';
  
  allSems.forEach(sem => {
    const opt = document.createElement('option');
    opt.value = sem;
    opt.textContent = formatSemesterLabel(sem);
    DOM.filterSemester.appendChild(opt);
  });

  if (prevVal) DOM.filterSemester.value = prevVal;
}

// 7. 一鍵渲染全系統
function renderAll() {
  const stats = calculateStats();
  renderOverview(stats);
  renderNonCredits();
  renderCategoriesTable(stats);
  renderCategoryDropdowns();
  renderFilterSemesterDropdown();
  renderSemesterGrid();
}

// -------------------------------------------------------------
// 事件處理邏輯 (Event Handlers)
// -------------------------------------------------------------

// 處理預設範本載入
function handlePresetChange() {
  const val = DOM.presetTemplates.value;
  if (!val) return;
  
  if (confirm('套用範本將會覆蓋您目前的畢業目標設定與所有課程，確定要繼續嗎？')) {
    applyPreset(val, true);
    saveState();
  }
  DOM.presetTemplates.value = ''; // 重設下拉值
}

// 總畢業學分目標彈窗
function openTotalCreditsModal() {
  DOM.inputTotalCredits.value = state.totalTargetCredits;
  DOM.modalTotalCredits.showModal();
}

function handleTotalCreditsSubmit(e) {
  e.preventDefault();
  const val = parseInt(DOM.inputTotalCredits.value);
  if (isNaN(val) || val <= 0) {
    showToast('請輸入有效的畢業總學分數！', 'danger');
    return;
  }
  state.totalTargetCredits = val;
  saveState();
  DOM.modalTotalCredits.close();
  showToast('已更新總畢業學分目標門檻！', 'success');
}

// 分類彈窗
function openCategoryModal(catId = null) {
  if (catId) {
    // 編輯模式
    const cat = state.categories.find(c => c.id === catId);
    if (!cat) return;
    DOM.categoryModalTitle.textContent = '編輯學分分類門檻';
    DOM.editCatId.value = cat.id;
    DOM.catName.value = cat.name;
    DOM.catTarget.value = cat.target;
    DOM.catColor.value = cat.color;
    DOM.categoryModalForm.querySelector('.color-hex-label').textContent = cat.color;
  } else {
    // 新增模式
    DOM.categoryModalTitle.textContent = '新增自訂學分分類';
    DOM.editCatId.value = '';
    DOM.catName.value = '';
    DOM.catTarget.value = '';
    DOM.catColor.value = '#6366f1';
    DOM.categoryModalForm.querySelector('.color-hex-label').textContent = '#6366f1';
  }
  DOM.modalCategory.showModal();
}

function handleCategorySubmit(e) {
  e.preventDefault();
  const id = DOM.editCatId.value;
  const name = DOM.catName.value.trim();
  const target = parseFloat(DOM.catTarget.value);
  const color = DOM.catColor.value;

  if (!name || isNaN(target) || target < 0) {
    showToast('請完整填寫分類名稱與目標學分！', 'danger');
    return;
  }

  if (id) {
    // 編輯現有
    const cat = state.categories.find(c => c.id === id);
    if (cat) {
      cat.name = name;
      cat.target = target;
      cat.color = color;
      showToast(`已成功修改分類「${name}」！`, 'success');
    }
  } else {
    // 新增
    const newId = 'cat-' + Date.now();
    state.categories.push({
      id: newId,
      name,
      target,
      color
    });
    showToast(`已成功新增分類「${name}」！`, 'success');
  }

  saveState();
  DOM.modalCategory.close();
}

function handleDeleteCategory(catId) {
  const cat = state.categories.find(c => c.id === catId);
  if (!cat) return;

  // 檢查是否有課程屬於此分類
  const linkedCourses = state.courses.filter(c => c.categoryId === catId);
  if (linkedCourses.length > 0) {
    if (confirm(`刪除分類「${cat.name}」會將所屬的 ${linkedCourses.length} 門課程一併刪除。確定要繼續嗎？`)) {
      state.courses = state.courses.filter(c => c.categoryId !== catId);
    } else {
      return;
    }
  } else {
    if (!confirm(`確定要刪除分類「${cat.name}」嗎？`)) return;
  }

  state.categories = state.categories.filter(c => c.id !== catId);
  saveState();
  showToast(`已刪除學分分類「${cat.name}」`, 'warning');
}

// 課程表單處理 (新增/編輯)
function handleCourseSubmit(e) {
  e.preventDefault();
  
  const id = DOM.courseId.value;
  const name = DOM.courseName.value.trim();
  const catId = DOM.courseCategory.value;
  const credits = parseFloat(DOM.courseCredits.value);
  const semester = DOM.courseSemester.value;
  const status = DOM.courseStatus.value;

  if (!name) {
    showToast('請輸入課程名稱！', 'danger');
    return;
  }
  if (!catId) {
    showToast('請選擇學分分類！', 'danger');
    return;
  }
  if (isNaN(credits) || credits < 0) {
    showToast('請輸入正確的學分數！', 'danger');
    return;
  }

  if (id) {
    // 編輯課程
    const course = state.courses.find(c => c.id === id);
    if (course) {
      course.name = name;
      course.categoryId = catId;
      course.credits = credits;
      course.semester = semester;
      course.status = status;
      showToast(`已更新課程「${name}」資訊！`, 'success');
    }
  } else {
    // 新增課程
    const newCourse = {
      id: 'course-' + Date.now(),
      name,
      categoryId: catId,
      credits,
      semester,
      status
    };
    state.courses.push(newCourse);
    showToast(`已成功新增課程「${name}」！`, 'success');
  }

  resetCourseForm();
  saveState();
}

function handleEditCourse(courseId) {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return;

  DOM.courseFormTitle.textContent = '編輯修課紀錄';
  DOM.courseId.value = course.id;
  DOM.courseName.value = course.name;
  DOM.courseCategory.value = course.categoryId;
  DOM.courseCredits.value = course.credits;
  DOM.courseSemester.value = course.semester;
  DOM.courseStatus.value = course.status;
  
  DOM.btnSubmitCourse.textContent = '更新課程';
  DOM.btnCancelEdit.style.display = 'block';

  // 捲動至表單位置方便填寫
  DOM.courseForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function handleDeleteCourse(courseId) {
  const course = state.courses.find(c => c.id === courseId);
  if (!course) return;

  if (confirm(`確定要刪除課程「${course.name}」的修課紀錄嗎？`)) {
    state.courses = state.courses.filter(c => c.id !== courseId);
    saveState();
    showToast(`已刪除課程「${course.name}」`, 'warning');
    
    // 如果剛好在編輯這門課，重設表單
    if (DOM.courseId.value === courseId) {
      resetCourseForm();
    }
  }
}

function resetCourseForm() {
  DOM.courseFormTitle.textContent = '新增修課紀錄';
  DOM.courseId.value = '';
  DOM.courseForm.reset();
  DOM.btnSubmitCourse.textContent = '儲存課程';
  DOM.btnCancelEdit.style.display = 'none';
}

// 非學分門檻編輯
function openNonCreditModal() {
  const nc = state.nonCredit;
  DOM.ncEnglishPassed.checked = nc.englishPassed;
  DOM.ncEnglishDetail.value = nc.englishDetail || '';
  DOM.ncService1.checked = nc.service1;
  DOM.ncService2.checked = nc.service2;
  DOM.ncEthicsPassed.checked = nc.ethicsPassed;
  DOM.ncPE1.checked = nc.pe1;
  DOM.ncPE2.checked = nc.pe2;

  DOM.modalNonCredit.showModal();
}

function handleNonCreditSubmit(e) {
  e.preventDefault();
  state.nonCredit = {
    englishPassed: DOM.ncEnglishPassed.checked,
    englishDetail: DOM.ncEnglishDetail.value.trim(),
    service1: DOM.ncService1.checked,
    service2: DOM.ncService2.checked,
    ethicsPassed: DOM.ncEthicsPassed.checked,
    pe1: DOM.ncPE1.checked,
    pe2: DOM.ncPE2.checked
  };

  saveState();
  DOM.modalNonCredit.close();
  showToast('非學分指標畢業門檻已更新！', 'success');
}

// -------------------------------------------------------------
// 資料備份匯入與匯出 (Backup / JSON System)
// -------------------------------------------------------------
function handleExport() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `FCU_Graduation_Planner_Backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('備份設定檔匯出成功！', 'success');
}

function handleImportTrigger() {
  DOM.fileImport.click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const importedData = JSON.parse(evt.target.result);
      
      // 資料結構檢驗
      if (typeof importedData.totalTargetCredits === 'number' && Array.isArray(importedData.categories)) {
        state = {
          theme: importedData.theme || 'dark',
          totalTargetCredits: importedData.totalTargetCredits,
          categories: importedData.categories,
          courses: importedData.courses || [],
          nonCredit: importedData.nonCredit || {
            englishPassed: false,
            englishDetail: '',
            service1: false,
            service2: false,
            ethicsPassed: false,
            pe1: false,
            pe2: false
          }
        };
        saveState();
        showToast('備份資料匯入成功，已為您重新渲染！', 'success');
      } else {
        showToast('資料格式不符，請上傳有效的備份 JSON 檔。', 'danger');
      }
    } catch (err) {
      showToast('解析備份檔案時發生錯誤！', 'danger');
    }
    DOM.fileImport.value = ''; // 清除檔案選取
  };
  reader.readAsText(file);
}

function handleReset() {
  if (confirm('警告！此操作將完全清除您目前的所有門檻設定與修課紀錄，且無法復原。確定要重設嗎？')) {
    localStorage.removeItem('fcu_grad_planner_state');
    showToast('已清除所有資料，正在重新整理頁面...', 'warning');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }
}

// -------------------------------------------------------------
// 輔助函式 (Helper Functions)
// -------------------------------------------------------------
function formatSemesterLabel(sem) {
  const [year, term] = sem.split('-');
  return `${year} 學年度 第 ${term} 學期`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// -------------------------------------------------------------
// 初始化綁定事件
// -------------------------------------------------------------
function initApp() {
  // 1. 讀取狀態
  loadState();

  // 2. 初始渲染
  renderAll();

  // 3. 綁定事件監聽
  DOM.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.body.className = state.theme === 'dark' ? 'dark-theme' : 'light-theme';
    saveState();
  });

  DOM.presetTemplates.addEventListener('change', handlePresetChange);

  // 畢業目標總學分
  DOM.btnEditTotalCredits.addEventListener('click', openTotalCreditsModal);
  DOM.btnCancelTotalModal.addEventListener('click', () => DOM.modalTotalCredits.close());
  DOM.btnCloseTotalModal.addEventListener('click', () => DOM.modalTotalCredits.close());
  DOM.totalCreditsForm.addEventListener('submit', handleTotalCreditsSubmit);

  // 學分分類
  DOM.btnAddCategory.addEventListener('click', () => openCategoryModal());
  DOM.btnCancelCatModal.addEventListener('click', () => DOM.modalCategory.close());
  DOM.btnCloseCatModal.addEventListener('click', () => DOM.modalCategory.close());
  DOM.categoryModalForm.addEventListener('submit', handleCategorySubmit);
  
  DOM.catColor.addEventListener('input', (e) => {
    DOM.categoryModalForm.querySelector('.color-hex-label').textContent = e.target.value;
  });

  // 課程表單
  DOM.courseForm.addEventListener('submit', handleCourseSubmit);
  DOM.btnCancelEdit.addEventListener('click', resetCourseForm);
  DOM.filterSemester.addEventListener('change', renderSemesterGrid);

  // 非學分門檻
  DOM.btnEditNonCredit.addEventListener('click', openNonCreditModal);
  DOM.btnCancelNcModal.addEventListener('click', () => DOM.modalNonCredit.close());
  DOM.btnCloseNonCreditModal.addEventListener('click', () => DOM.modalNonCredit.close());
  DOM.nonCreditForm.addEventListener('submit', handleNonCreditSubmit);

  // 系統操作
  DOM.btnExport.addEventListener('click', handleExport);
  DOM.btnImportTrigger.addEventListener('click', handleImportTrigger);
  DOM.fileImport.addEventListener('change', handleImportFile);
  DOM.btnReset.addEventListener('click', handleReset);
  
  // 防止 Modal 外點擊未關閉 (可選，這裡使用內建 HTML 關閉動作或按鈕)
}

// 啟動 App
document.addEventListener('DOMContentLoaded', initApp);
