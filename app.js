/**
 * 逢甲大學學業進度與預警系統 - 核心控制中心 (app.js)
 * 管理：分頁切換、圖表繪製、模擬排課、時間壓力計、Local資料持久化與 Demo 切換
 */

// 1. 全域應用程式狀態
let activeStudent = null;
let creditChart = null;
let gpaChart = null;
let timeChart = null;

// 2. 初始化載入
document.addEventListener("DOMContentLoaded", () => {
    // 設定動態日期顯示
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateEl = document.getElementById("header-date");
    if (dateEl) {
        dateEl.innerText = new Date().toLocaleDateString('zh-TW', dateOptions);
    }

    // 預設載入學生 A (學霸林逢甲)
    loadStudentData("studentA");

    // 註冊分頁切換事件
    initTabs();

    // 註冊主題切換事件
    initTheme();

    // 註冊 Demo 數據切換事件
    document.getElementById("demo-select").addEventListener("change", (e) => {
        loadStudentData(e.target.value);
    });

    // 註冊互動式模擬排課事件
    initCoursePlanner();

    // 註冊時間與壓力管理事件
    initTimeAndTodo();

    // 註冊畢業非學分門檻切換事件
    initThresholdToggles();
});

// 3. 學生資料載入與狀態克隆 (深度複製以防污染原始資料庫)
function loadStudentData(key) {
    const rawData = window.FCU_DEMO_STUDENTS[key];
    if (!rawData) return;
    
    // 從 LocalStorage 嘗試獲取修改過的資料，否則使用原始預設
    const saved = localStorage.getItem(`fcu_student_data_${key}`);
    if (saved) {
        activeStudent = JSON.parse(saved);
    } else {
        activeStudent = JSON.parse(JSON.stringify(rawData)); // Deep clone
    }

    // 重設 UI 選單的選定值
    document.getElementById("demo-select").value = key;

    // 全域重新渲染
    renderAll();
}

// 將修改後的學生資料存回 LocalStorage
function saveActiveStudent() {
    if (!activeStudent) return;
    const currentKey = document.getElementById("demo-select").value;
    localStorage.setItem(`fcu_student_data_${currentKey}`, JSON.stringify(activeStudent));
    renderAll();
}

// 4. 全域渲染控制
function renderAll() {
    if (!activeStudent) return;

    // 評估預警狀態
    const analysis = window.evaluateStudentWarning(activeStudent);
    activeStudent.warnings = analysis.warnings;
    activeStudent.riskScore = analysis.riskScore;
    activeStudent.statusLabel = analysis.statusLabel;
    activeStudent.statusClass = analysis.statusClass;

    // A. 頁首與個人資料渲染
    document.getElementById("sidebar-student-name").innerText = activeStudent.name;
    document.getElementById("sidebar-student-id").innerText = activeStudent.id;
    const deptRule = window.FCU_DEPARTMENT_TEMPLATES[activeStudent.dept];
    document.getElementById("sidebar-student-dept").innerText = `${deptRule.name} (大${Math.ceil(activeStudent.currentSemester / 2)})`;

    // 頁首綜合警告 Badge
    const statusBadge = document.getElementById("overall-status-badge");
    statusBadge.className = `overall-status ${activeStudent.statusClass}`;
    document.getElementById("overall-status-text").innerText = activeStudent.statusLabel;

    // 側邊欄紅點呼吸燈
    const dangerWarnings = activeStudent.warnings.filter(w => w.type === "danger");
    const warningDot = document.getElementById("nav-warning-dot");
    warningDot.style.display = dangerWarnings.length > 0 ? "block" : "none";

    // B. 儀表板數據快捷卡片
    // 計算總學分
    const completedCredits = activeStudent.creditsCompleted.required + activeStudent.creditsCompleted.elective + activeStudent.creditsCompleted.general;
    document.getElementById("dash-credits").innerHTML = `${completedCredits} <span class="stat-total">/ ${deptRule.total}</span>`;
    const percent = Math.min(100, (completedCredits / deptRule.total) * 100);
    document.getElementById("dash-credit-progress").style.width = `${percent}%`;

    // 計算本學期平均預估成績與 GPA
    const currentCourses = activeStudent.currentCourses || [];
    let currentGpa = 0;
    if (currentCourses.length > 0) {
        const totalScore = currentCourses.reduce((sum, c) => sum + c.score, 0);
        const avgScore = totalScore / currentCourses.length;
        // 分數轉 GPA
        currentGpa = scoreToGpa(avgScore);
    } else {
        currentGpa = 0;
    }
    
    // 計算歷史加權 GPA
    const histories = activeStudent.timeManagement.gpaHistory || [];
    let avgHistoryGpa = 0;
    if (histories.length > 0) {
        const sum = histories.reduce((a, b) => a + b, 0);
        avgHistoryGpa = sum / histories.length;
    }
    
    // 綜合 GPA
    const displayGpa = currentCourses.length > 0 ? ((avgHistoryGpa * 0.7) + (currentGpa * 0.3)).toFixed(2) : avgHistoryGpa.toFixed(2);
    document.getElementById("dash-gpa").innerText = displayGpa;

    // 作業件數與壓力指數
    const pendingTodos = activeStudent.timeManagement.homeworks.filter(t => !t.done);
    document.getElementById("dash-homework-count").innerHTML = `${pendingTodos.length} <span class="stat-unit">件</span>`;
    document.getElementById("dash-homework-sub").innerText = pendingTodos.length === 0 ? "所有課業妥善處理" : `${pendingTodos.length} 個任務尚待處理`;

    // 壓力指數計算與溫度計渲染
    renderPressureThermometer();

    // C. 圖表渲染
    renderCharts(completedCredits, deptRule);

    // D. 儀表板危機中心渲染
    renderDashboardWarnings();

    // E. 學分深度分析渲染
    renderCreditAnalyzer(completedCredits, deptRule);

    // F. 畢業非學分門檻渲染
    renderThresholds();

    // G. 模擬排課表格渲染
    renderCoursePlannerTables();

    // H. 時間與待辦清單渲染
    renderTimeAndTodoUI();

    // I. 快速排課按鈕渲染 (UI/UX 快速登錄指標)
    renderQuickAddCourses();
}

// 5. 分數轉 GPA 輔助邏輯 (4.3 制)
function scoreToGpa(score) {
    if (score >= 90) return 4.3;
    if (score >= 85) return 4.0;
    if (score >= 80) return 3.7;
    if (score >= 77) return 3.3;
    if (score >= 73) return 3.0;
    if (score >= 70) return 2.7;
    if (score >= 67) return 2.3;
    if (score >= 63) return 2.0;
    if (score >= 60) return 1.7;
    return 0.0;
}

// 6. 圖表渲染核心
function renderCharts(completedCredits, deptRule) {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const textColor = isDark ? "#9ca3af" : "#475569";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)";

    // [1] 學分比例環形圖
    const ctxPie = document.getElementById("creditPieChart").getContext("2d");
    if (creditChart) creditChart.destroy();
    
    const remaining = Math.max(0, deptRule.total - completedCredits);

    creditChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['專業必修', '專業選修', '通識教育', '畢業剩餘缺口'],
            datasets: [{
                data: [
                    activeStudent.creditsCompleted.required,
                    activeStudent.creditsCompleted.elective,
                    activeStudent.creditsCompleted.general,
                    remaining
                ],
                backgroundColor: [
                    '#3b82f6', // 藍
                    '#8b5cf6', // 紫
                    '#10b981', // 綠 (FCU)
                    isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' // 剩餘灰色
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, font: { family: 'Noto Sans TC' } }
                }
            },
            cutout: '70%'
        }
    });

    // [2] GPA 趨勢折線圖
    const ctxLine = document.getElementById("gpaLineChart").getContext("2d");
    if (gpaChart) gpaChart.destroy();

    const gpaLabels = activeStudent.timeManagement.gpaHistory.map((_, i) => `大${Math.ceil((i+1)/2)}${i % 2 === 0 ? "上" : "下"}`);
    
    // 若本期有排課，模擬加入當前學期預期 GPA
    const lineData = [...activeStudent.timeManagement.gpaHistory];
    const currentCourses = activeStudent.currentCourses || [];
    if (currentCourses.length > 0) {
        const totalScore = currentCourses.reduce((sum, c) => sum + c.score, 0);
        const avgScore = totalScore / currentCourses.length;
        lineData.push(scoreToGpa(avgScore));
        gpaLabels.push(`大${Math.ceil(activeStudent.currentSemester/2)}${activeStudent.currentSemester % 2 !== 0 ? "上" : "下"} (估)`);
    }

    gpaChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: gpaLabels,
            datasets: [{
                label: '學期加權 GPA',
                data: lineData,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#10b981',
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Noto Sans TC' } }
                },
                y: {
                    min: 0,
                    max: 4.3,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            }
        }
    });

    // [3] 每週時間平衡分析
    const ctxTime = document.getElementById("timeBalanceChart").getContext("2d");
    if (timeChart) timeChart.destroy();

    timeChart = new Chart(ctxTime, {
        type: 'doughnut',
        data: {
            labels: ['修課與自習', '娛樂與休閒'],
            datasets: [{
                data: [
                    activeStudent.timeManagement.weeklyStudyHours,
                    activeStudent.timeManagement.weeklyLeisureHours
                ],
                backgroundColor: [
                    '#10b981', // 逢甲綠
                    '#f59e0b'  // 警示橘
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: textColor, font: { family: 'Noto Sans TC' } }
                }
            },
            cutout: '60%'
        }
    });
}

// 7. 儀表板預警列表渲染
function renderDashboardWarnings() {
    const list = document.getElementById("dashboard-warnings-list");
    const countBadge = document.getElementById("alert-summary-badge");
    list.innerHTML = "";

    const warnings = activeStudent.warnings || [];
    countBadge.innerText = `${warnings.length} 個警訊`;
    
    if (warnings.length === 0) {
        list.innerHTML = `
            <div class="empty-warning-state">
                <i class="fa-solid fa-circle-check text-success"></i>
                <p>太棒了！目前沒有偵測到任何學分、二一或延畢危機。</p>
            </div>
        `;
        countBadge.className = "badge badge-success";
        return;
    }

    countBadge.className = warnings.some(w => w.type === "danger") ? "badge badge-danger badge-pulse" : "badge badge-warning";

    warnings.forEach(warn => {
        const card = document.createElement("div");
        card.className = `warning-alert-card alert-${warn.type}`;
        
        card.innerHTML = `
            <div class="alert-left">
                <div class="alert-left-icon">
                    <i class="fa-solid fa-${warn.icon}"></i>
                </div>
                <div class="alert-info">
                    <h4>${warn.title}</h4>
                    <p>${warn.desc}</p>
                </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="navigateToTab('warning-center')">
                預警詳情
            </button>
        `;
        list.appendChild(card);
    });
}

// 8. 學分深度分析渲染
function renderCreditAnalyzer(completedCredits, deptRule) {
    // 進度條與數值
    const reqCompleted = activeStudent.creditsCompleted.required;
    const eleCompleted = activeStudent.creditsCompleted.elective;
    const genCompleted = activeStudent.creditsCompleted.general;

    document.getElementById("analyzer-req-text").innerText = `${reqCompleted} / ${deptRule.categories.required} 學分`;
    document.getElementById("analyzer-req-fill").style.width = `${Math.min(100, (reqCompleted / deptRule.categories.required) * 100)}%`;

    document.getElementById("analyzer-ele-text").innerText = `${eleCompleted} / ${deptRule.categories.elective} 學分`;
    document.getElementById("analyzer-ele-fill").style.width = `${Math.min(100, (eleCompleted / deptRule.categories.elective) * 100)}%`;

    document.getElementById("analyzer-gen-text").innerText = `${genCompleted} / ${deptRule.categories.general} 學分`;
    document.getElementById("analyzer-gen-fill").style.width = `${Math.min(100, (genCompleted / deptRule.categories.general) * 100)}%`;

    // 通識四大領域清單渲染
    const checklist = document.getElementById("gen-ed-checklist");
    checklist.innerHTML = "";

    // 模擬判斷通識是否過半，根據已完成通識學分來渲染
    const genRatio = genCompleted / deptRule.categories.general;
    const items = [
        { name: "基礎國文 (必修 4 學分)", has: genRatio > 0.15 },
        { name: "大一、大二英文 (必修 8 學分)", has: genRatio > 0.4 },
        { name: "人文學科領域 (選修)", has: genRatio > 0.6 },
        { name: "社會科學領域 (選修)", has: genRatio > 0.75 },
        { name: "自然科學領域 (選修)", has: genRatio > 0.9 },
        { name: "生命教育與倫理 (選修)", has: genCompleted >= deptRule.categories.general }
    ];

    items.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `
            <div class="check-left">
                <i class="fa-solid ${item.has ? "fa-circle-check text-success" : "fa-solid fa-circle-xmark text-warning"}"></i>
                <span>${item.name}</span>
            </div>
            <span class="badge ${item.has ? "badge-success" : "badge-warning"}">
                ${item.has ? "通過" : "修習中/缺學分"}
            </span>
        `;
        checklist.appendChild(li);
    });

    // 當前學期修課表格
    const tbody = document.querySelector("#current-courses-table tbody");
    tbody.innerHTML = "";
    
    const courses = activeStudent.currentCourses || [];
    if (courses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">本學期無修課紀錄，請到「模擬排課計畫」新增。</td></tr>`;
        return;
    }

    courses.forEach(c => {
        const tr = document.createElement("tr");
        const typeZh = c.type === "required" ? "專業必修" : c.type === "elective" ? "專業選修" : "通識課程";
        
        let scoreClass = "badge-score-good";
        let statusText = "及格";
        if (c.score < 60) {
            scoreClass = "badge-score-fail";
            statusText = "不及格被當";
        } else if (c.score < 70) {
            scoreClass = "badge-score-warn";
            statusText = "預警邊緣";
        }

        tr.innerHTML = `
            <td style="font-family: 'Outfit', sans-serif;">${c.code}</td>
            <td><strong>${c.name}</strong></td>
            <td style="font-family: 'Outfit', sans-serif;">${c.credits}</td>
            <td><span class="badge ${c.type === "required" ? "badge-success" : c.type === "elective" ? "badge-primary" : "badge-warning"}">${typeZh}</span></td>
            <td style="font-family: 'Outfit', sans-serif;"><span class="badge ${scoreClass}">${c.score}分</span></td>
            <td><span class="badge ${c.score >= 60 ? "badge-success" : "badge-danger"}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// 9. 畢業非學分門檻與危機診斷渲染
function renderThresholds() {
    // 英文
    const engCard = document.getElementById("threshold-card-english");
    const engStatus = document.getElementById("threshold-status-english");
    if (activeStudent.graduationThresholds.english) {
        engStatus.innerHTML = `<span class="badge badge-success">已達標 (多益 780分)</span>`;
    } else {
        engStatus.innerHTML = `<span class="badge badge-danger">未達標 (尚未提交成績)</span>`;
    }

    // 服務學習一
    const sl1Status = document.getElementById("threshold-status-sl1");
    if (activeStudent.graduationThresholds.serviceLearning1) {
        sl1Status.innerHTML = `<span class="badge badge-success">已通過</span>`;
    } else {
        sl1Status.innerHTML = `<span class="badge badge-danger">未通過</span>`;
    }

    // 服務學習二
    const sl2Status = document.getElementById("threshold-status-sl2");
    if (activeStudent.graduationThresholds.serviceLearning2) {
        sl2Status.innerHTML = `<span class="badge badge-success">已通過</span>`;
    } else {
        sl2Status.innerHTML = `<span class="badge badge-danger">未通過</span>`;
    }

    // 診斷報告右側
    const scoreBadge = document.getElementById("risk-score-badge");
    scoreBadge.innerText = `危機指數: ${activeStudent.riskScore}/100`;
    
    // 設定危機指數溫度條
    const riskBar = document.getElementById("warning-risk-bar");
    riskBar.style.width = `${activeStudent.riskScore}%`;
    if (activeStudent.riskScore >= 60) {
        riskBar.style.background = "var(--color-danger)";
        scoreBadge.style.background = "rgba(239, 68, 68, 0.1)";
        scoreBadge.style.color = "var(--color-danger)";
    } else if (activeStudent.riskScore >= 20) {
        riskBar.style.background = "var(--color-warning)";
        scoreBadge.style.background = "rgba(245, 158, 11, 0.1)";
        scoreBadge.style.color = "var(--color-warning)";
    } else {
        riskBar.style.background = "var(--color-fcu)";
        scoreBadge.style.background = "rgba(16, 185, 129, 0.1)";
        scoreBadge.style.color = "var(--color-fcu)";
    }

    // 渲染詳細預警列表
    const reportList = document.getElementById("warning-center-list");
    reportList.innerHTML = "";
    const warnings = activeStudent.warnings || [];

    if (warnings.length === 0) {
        reportList.innerHTML = `
            <div class="empty-warning-state">
                <i class="fa-solid fa-shield-cat text-success" style="font-size: 32px;"></i>
                <p>經預警引擎多維度掃描，您目前所有畢業條件及學術表現均在安全評估區內！</p>
            </div>
        `;
        return;
    }

    warnings.forEach(warn => {
        const div = document.createElement("div");
        div.className = `warning-alert-card alert-${warn.type}`;
        
        let actionBtnHtml = "";
        if (warn.title.includes("二一")) {
            actionBtnHtml = `<a class="btn btn-danger btn-sm" href="https://scs.fcu.edu.tw" target="_blank"><i class="fa-solid fa-user-doctor"></i> 預約導師輔導</a>`;
        } else if (warn.title.includes("學分")) {
            actionBtnHtml = `<button class="btn btn-primary btn-sm" onclick="navigateToTab('course-planner')"><i class="fa-solid fa-calendar-plus"></i> 前往規劃排課</button>`;
        } else if (warn.title.includes("英語")) {
            actionBtnHtml = `<button class="btn btn-secondary btn-sm" onclick="mockPassEnglish()"><i class="fa-solid fa-check"></i> 模擬通過英檢</button>`;
        } else {
            actionBtnHtml = `<button class="btn btn-secondary btn-sm" onclick="alert('建議諮詢所屬學系辦公室以獲取最精準的課程抵免與重修方案。')"><i class="fa-solid fa-circle-info"></i> 諮詢系辦</button>`;
        }

        div.innerHTML = `
            <div class="alert-left">
                <div class="alert-left-icon">
                    <i class="fa-solid fa-${warn.icon}"></i>
                </div>
                <div class="alert-info">
                    <h4>${warn.title}</h4>
                    <p>${warn.desc}</p>
                </div>
            </div>
            <div class="alert-right-actions">
                ${actionBtnHtml}
            </div>
        `;
        reportList.appendChild(div);
    });
}

function mockPassEnglish() {
    activeStudent.graduationThresholds.english = true;
    saveActiveStudent();
}

// 10. 畢業非學分門檻切換按鈕綁定
function initThresholdToggles() {
    document.querySelectorAll(".toggle-threshold-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const threshold = e.currentTarget.getAttribute("data-threshold");
            if (threshold === "english") {
                activeStudent.graduationThresholds.english = !activeStudent.graduationThresholds.english;
            } else if (threshold === "sl1") {
                activeStudent.graduationThresholds.serviceLearning1 = !activeStudent.graduationThresholds.serviceLearning1;
            } else if (threshold === "sl2") {
                activeStudent.graduationThresholds.serviceLearning2 = !activeStudent.graduationThresholds.serviceLearning2;
            }
            saveActiveStudent();
        });
    });
}

// 11. 壓力溫度計計算與渲染
function renderPressureThermometer() {
    // 壓力公式：(本學期學分 * 3.2) + (未完工課 * 7.5) + (不及格科目 * 18)
    const currentCourses = activeStudent.currentCourses || [];
    const totalSemCredits = currentCourses.reduce((sum, c) => sum + c.credits, 0);
    const failedCoursesCount = currentCourses.filter(c => c.score < 60).length;
    const pendingTodos = activeStudent.timeManagement.homeworks.filter(t => !t.done).length;

    let pressure = Math.round((totalSemCredits * 3.2) + (pendingTodos * 7.5) + (failedCoursesCount * 18));
    
    // 平滑化
    pressure = Math.max(5, Math.min(100, pressure));
    
    // 渲染
    const fill = document.getElementById("pressure-thermometer-fill");
    const text = document.getElementById("pressure-thermometer-text");
    const title = document.getElementById("pressure-status-title");
    const desc = document.getElementById("pressure-status-desc");
    const dashPressureIndex = document.getElementById("dash-pressure-index");
    const dashPressureProgress = document.getElementById("dash-pressure-progress");

    fill.style.height = `${pressure}%`;
    text.innerText = `${pressure}%`;
    dashPressureIndex.innerText = `${pressure}%`;
    dashPressureProgress.style.width = `${pressure}%`;

    // 壓力狀態與顏色切換
    if (pressure >= 75) {
        fill.style.background = "linear-gradient(0deg, #f59e0b 0%, #ef4444 100%)";
        title.innerText = "壓力狀態：快要爆表 (爆肝警戒)";
        title.className = "text-color-danger";
        desc.innerText = "目前不及格科目過多且尚有大量作業未交！強烈建議退選部分無把握的課程，並優先打勾交出作業以釋放危機負荷。";
    } else if (pressure >= 40) {
        fill.style.background = "linear-gradient(0deg, #3b82f6 0%, #f59e0b 100%)";
        title.innerText = "壓力狀態：負荷緊繃 (充實疲憊)";
        title.className = "text-color-warning";
        desc.innerText = "學業進度正常但作業有些堆積。請開始依據優先權規劃每週自主學習時間，逐一消滅待辦任務。";
    } else {
        fill.style.background = "linear-gradient(0deg, #10b981 0%, #60a5fa 100%)";
        title.innerText = "壓力狀態：游刃有餘 (學業安全)";
        title.className = "text-success";
        desc.innerText = "課業負擔輕微，每週休閒時間分配優良。建議可加入「模擬排課計畫」額外超前選修有興趣的學門。";
    }
}

// 12. 互動式模擬排課控制邏輯
function initCoursePlanner() {
    const form = document.getElementById("course-form");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            
            const code = document.getElementById("course-code").value.trim();
            const name = document.getElementById("course-name").value.trim();
            const creditsStr = document.getElementById("course-credits").value;
            const type = document.getElementById("course-type").value;
            const scoreStr = document.getElementById("course-score").value;

            // 錯誤防錯與輸入驗證 (符合使用者所提錯誤容錯規範)
            if (!code) {
                showToast("輸入錯誤", "課程代碼不可為空！", "error");
                return;
            }
            if (!name) {
                showToast("輸入錯誤", "課程名稱不可為空！", "error");
                return;
            }

            const credits = parseInt(creditsStr);
            if (isNaN(credits) || credits < 1 || credits > 6) {
                showToast("學分格式錯誤", "學分必須是介於 1 到 6 之間的整數！", "error");
                return;
            }

            const score = parseInt(scoreStr);
            if (isNaN(score) || score < 0 || score > 100) {
                showToast("成績格式錯誤", "成績分數必須介於 0 到 100 之間！", "error");
                return;
            }

            const currentCourses = activeStudent.currentCourses || [];
            
            // 判斷是否為修改已存在課程，如果是則覆蓋，否則新增
            const existIndex = currentCourses.findIndex(c => c.code.toLowerCase() === code.toLowerCase());
            
            if (existIndex >= 0) {
                currentCourses[existIndex] = { code, name, credits, type, score };
                showToast("更新成功", `課程「${name}」成績及學分已更新！`, "success");
            } else {
                currentCourses.push({ code, name, credits, type, score });
                showToast("新增成功", `已成功將「${name}」排入課表！`, "success");
            }

            activeStudent.currentCourses = currentCourses;
            
            // 欄位重置
            form.reset();
            document.getElementById("course-credits").value = 3;
            document.getElementById("course-score").value = 80;

            saveActiveStudent();
        });
    }
}

function renderCoursePlannerTables() {
    const tbody = document.querySelector("#planner-courses-table tbody");
    tbody.innerHTML = "";

    const courses = activeStudent.currentCourses || [];
    if (courses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">本學期目前無課程。請利用左側新增擬修課程。</td></tr>`;
        
        document.getElementById("planner-total-credits").innerText = "0";
        document.getElementById("planner-failed-credits").innerText = "0";
        document.getElementById("planner-avg-gpa").innerText = "0.0";
        return;
    }

    let totalCredits = 0;
    let failedCredits = 0;
    let totalScore = 0;

    courses.forEach((c, idx) => {
        totalCredits += c.credits;
        if (c.score < 60) {
            failedCredits += c.credits;
        }
        totalScore += c.score;

        const tr = document.createElement("tr");
        const typeZh = c.type === "required" ? "專業必修" : c.type === "elective" ? "專業選修" : "通識課程";
        
        let scoreClass = "badge-score-good";
        if (c.score < 60) scoreClass = "badge-score-fail";
        else if (c.score < 70) scoreClass = "badge-score-warn";

        tr.innerHTML = `
            <td style="font-family: 'Outfit', sans-serif;">${c.code}</td>
            <td><strong>${c.name}</strong></td>
            <td style="font-family: 'Outfit', sans-serif;">${c.credits}</td>
            <td><span class="badge ${c.type === "required" ? "badge-success" : c.type === "elective" ? "badge-primary" : "badge-warning"}">${typeZh}</span></td>
            <td>
                <span class="badge ${scoreClass} score-interactive-badge" onclick="editCourseScore('${c.code}')" style="cursor: pointer;">
                    ${c.score}分 <i class="fa-solid fa-pen" style="font-size: 8px; margin-left: 2px;"></i>
                </span>
            </td>
            <td><span class="badge ${c.score >= 60 ? "badge-success" : "badge-danger"}">${c.score >= 60 ? "通過" : "被當預警"}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm text-color-danger" onclick="deleteCourse('${c.code}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const avgScore = totalScore / courses.length;
    const avgGpa = scoreToGpa(avgScore);

    document.getElementById("planner-total-credits").innerText = totalCredits;
    
    const failEl = document.getElementById("planner-failed-credits");
    failEl.innerText = failedCredits;
    if (failedCredits > 0) {
        failEl.className = "text-color-danger";
    } else {
        failEl.className = "text-success";
    }

    document.getElementById("planner-avg-gpa").innerText = avgGpa.toFixed(2);
}

// 刪除修課
window.deleteCourse = function(code) {
    activeStudent.currentCourses = activeStudent.currentCourses.filter(c => c.code !== code);
    saveActiveStudent();
};

// 快捷修改分數
window.editCourseScore = function(code) {
    const course = activeStudent.currentCourses.find(c => c.code === code);
    if (!course) return;

    const newScoreStr = prompt(`請輸入「${course.name}」的最新估計分數 (0-100)：`, course.score);
    if (newScoreStr === null) return;

    const newScore = parseInt(newScoreStr);
    if (isNaN(newScore) || newScore < 0 || newScore > 100) {
        alert("請輸入有效的 0 到 100 之間的整數分數。");
        return;
    }

    course.score = newScore;
    saveActiveStudent();
};

// 13. 時間管理與 TODO 任務列表邏輯
function initTimeAndTodo() {
    // 監聽時數輸入變化
    document.getElementById("study-hours-input").addEventListener("input", (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        activeStudent.timeManagement.weeklyStudyHours = val;
        saveActiveStudent();
    });

    document.getElementById("leisure-hours-input").addEventListener("input", (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        activeStudent.timeManagement.weeklyLeisureHours = val;
        saveActiveStudent();
    });

    // 新增任務按鈕
    document.getElementById("add-todo-btn").addEventListener("click", () => {
        const input = document.getElementById("todo-input");
        const title = input.value.trim();
        if (!title) return;

        const homeworks = activeStudent.timeManagement.homeworks || [];
        const nextId = homeworks.length > 0 ? Math.max(...homeworks.map(h => h.id)) + 1 : 1;
        
        homeworks.push({
            id: nextId,
            title: title,
            deadline: "自訂任務",
            done: false
        });

        activeStudent.timeManagement.homeworks = homeworks;
        input.value = "";
        saveActiveStudent();
    });

    // 綁定輸入框 Enter 鍵
    document.getElementById("todo-input").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            document.getElementById("add-todo-btn").click();
        }
    });
}

function renderTimeAndTodoUI() {
    // 同步輸入框時數數值
    document.getElementById("study-hours-input").value = activeStudent.timeManagement.weeklyStudyHours;
    document.getElementById("leisure-hours-input").value = activeStudent.timeManagement.weeklyLeisureHours;

    // 渲染 Todo 清單
    const todoList = document.getElementById("todo-items-list");
    todoList.innerHTML = "";

    const homeworks = activeStudent.timeManagement.homeworks || [];
    if (homeworks.length === 0) {
        todoList.innerHTML = `<li style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">無待辦課業任務。可於上方新增。</li>`;
        return;
    }

    homeworks.forEach(todo => {
        const li = document.createElement("li");
        li.className = `todo-item ${todo.done ? "completed" : ""}`;
        
        li.innerHTML = `
            <div class="todo-item-left">
                <input type="checkbox" ${todo.done ? "checked" : ""} onchange="toggleTodo(${todo.id})">
                <span class="todo-text">${todo.title}</span>
            </div>
            <div class="todo-item-right" style="display: flex; align-items: center; gap: 12px;">
                <span class="todo-deadline">${todo.deadline}</span>
                <button class="btn btn-secondary btn-sm text-color-danger" onclick="deleteTodo(${todo.id})" style="padding: 4px 8px;">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
        todoList.appendChild(li);
    });
}

window.toggleTodo = function(id) {
    const todo = activeStudent.timeManagement.homeworks.find(h => h.id === id);
    if (!todo) return;
    todo.done = !todo.done;
    saveActiveStudent();
};

window.deleteTodo = function(id) {
    activeStudent.timeManagement.homeworks = activeStudent.timeManagement.homeworks.filter(h => h.id !== id);
    saveActiveStudent();
};

// 14. 導覽列分頁切換控制邏輯
function initTabs() {
    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const tabId = item.getAttribute("data-tab");
            navigateToTab(tabId);
        });
    });
}

window.navigateToTab = function(tabId) {
    // 移除非作用中 nav-item 的 active 狀態，並為選定的 active
    document.querySelectorAll(".nav-item").forEach(nav => {
        if (nav.getAttribute("data-tab") === tabId) {
            nav.classList.add("active");
        } else {
            nav.classList.remove("active");
        }
    });

    // 切換分頁卡片顯示
    document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.classList.remove("active");
    });
    
    const targetPanel = document.getElementById(`tab-${tabId}`);
    if (targetPanel) {
        targetPanel.classList.add("active");
    }

    // 更新 Header 的頁面標題
    const titleMap = {
        "dashboard": "儀表板首頁",
        "credit-analyzer": "學分深度分析",
        "warning-center": "預警與畢業門檻",
        "time-manager": "時間與壓力管理",
        "course-planner": "模擬排課與試算"
    };
    document.getElementById("page-title").innerText = titleMap[tabId] || "系統";
};

// 15. 亮暗主題切換
function initTheme() {
    const toggle = document.getElementById("theme-toggle");
    
    // 預設深色
    document.documentElement.setAttribute("data-theme", "dark");
    
    toggle.addEventListener("change", () => {
        if (toggle.checked) {
            document.documentElement.setAttribute("data-theme", "dark");
        } else {
            document.documentElement.setAttribute("data-theme", "light");
        }
        
        // 重新繪製 Chart 確保網格線與文字對比顏色切換
        if (activeStudent) {
            const completedCredits = activeStudent.creditsCompleted.required + activeStudent.creditsCompleted.elective + activeStudent.creditsCompleted.general;
            const deptRule = window.FCU_DEPARTMENT_TEMPLATES[activeStudent.dept];
            renderCharts(completedCredits, deptRule);
        }
    });
}

// 16. 逢甲熱門科系核心課程「一鍵快速登錄」模組 (滿足 3 分鐘錄入 RWD 極致 UX 規範)
function renderQuickAddCourses() {
    const container = document.getElementById("quick-add-course-container");
    if (!container || !activeStudent) return;
    container.innerHTML = "";

    const recommendations = {
        CSIE: [
            { code: "CO-201", name: "資料結構", credits: 3, type: "required" },
            { code: "CO-202", name: "演算法設計", credits: 3, type: "required" },
            { code: "CO-203", name: "作業系統", credits: 3, type: "required" },
            { code: "CO-204", name: "資料庫系統", credits: 3, type: "elective" },
            { code: "GE-105", name: "生命教育與宗教", credits: 2, type: "general" }
        ],
        BA: [
            { code: "BA-301", name: "行銷管理", credits: 3, type: "required" },
            { code: "BA-302", name: "人力資源管理", credits: 3, type: "required" },
            { code: "BA-303", name: "商業談判", credits: 3, type: "elective" },
            { code: "BA-304", name: "企業倫理", credits: 2, type: "required" },
            { code: "GE-105", name: "生命教育與宗教", credits: 2, type: "general" }
        ],
        EE: [
            { code: "EE-205", name: "電子學(一)", credits: 3, type: "required" },
            { code: "EE-206", name: "電磁學(一)", credits: 3, type: "required" },
            { code: "EE-207", name: "工程數學(二)", credits: 3, type: "required" },
            { code: "EE-208", name: "信號與系統", credits: 3, type: "elective" },
            { code: "GE-105", name: "生命教育與宗教", credits: 2, type: "general" }
        ]
    };

    const list = recommendations[activeStudent.dept] || [];
    list.forEach(c => {
        const btn = document.createElement("button");
        btn.className = "quick-add-btn";
        btn.innerHTML = `<i class="fa-solid fa-plus-circle"></i> ${c.name}`;
        btn.addEventListener("click", () => {
            // 一鍵填入表單並自動提交 (3秒登錄一門課)
            document.getElementById("course-code").value = c.code;
            document.getElementById("course-name").value = c.name;
            document.getElementById("course-credits").value = c.credits;
            document.getElementById("course-type").value = c.type;
            document.getElementById("course-score").value = 85; // 預設 85 分
            
            // 觸發表單提交
            const form = document.getElementById("course-form");
            form.dispatchEvent(new Event("submit"));
        });
        container.appendChild(btn);
    });
}

// 17. Toast 玻璃滑動錯誤/成功通知組件 (容錯防崩潰)
function showToast(title, desc, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let icon = "info-circle";
    if (type === "success") icon = "circle-check";
    if (type === "error") icon = "triangle-exclamation";
    if (type === "warning") icon = "exclamation-circle";

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid fa-${icon}"></i></div>
        <div class="toast-content">
            <h5>${title}</h5>
            <p>${desc}</p>
        </div>
    `;

    container.appendChild(toast);

    // 3秒後滑動消退並自動移除
    setTimeout(() => {
        toast.remove();
    }, 3300);
}
/* -------------------------------------------------------------
 * 逢甲大學畢業門檻與時間管理整合系統 - 核心邏輯
 * ------------------------------------------------------------- */

// 初始化狀態變數
let state = {
  theme: 'dark',
  totalTargetCredits: 128,
  gpaScale: '4.3', // 預設 4.3 制 GPA
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

// -------------------------------------------------------------
// 自動化試算引擎 - GPA 百分制與等級制對照表
// -------------------------------------------------------------
const GRADE_SCALE = [
  { letter: 'A+', min: 90, max: 100, gpa43: 4.3, gpa40: 4.0, midpoint: 95, pass: true },
  { letter: 'A',  min: 85, max: 89,  gpa43: 4.0, gpa40: 4.0, midpoint: 87, pass: true },
  { letter: 'A-', min: 80, max: 84,  gpa43: 3.7, gpa40: 3.7, midpoint: 82, pass: true },
  { letter: 'B+', min: 77, max: 79,  gpa43: 3.3, gpa40: 3.3, midpoint: 78, pass: true },
  { letter: 'B',  min: 73, max: 76,  gpa43: 3.0, gpa40: 3.0, midpoint: 75, pass: true },
  { letter: 'B-', min: 70, max: 72,  gpa43: 2.7, gpa40: 2.7, midpoint: 71, pass: true },
  { letter: 'C+', min: 67, max: 69,  gpa43: 2.3, gpa40: 2.3, midpoint: 68, pass: true },
  { letter: 'C',  min: 63, max: 66,  gpa43: 2.0, gpa40: 2.0, midpoint: 65, pass: true },
  { letter: 'C-', min: 60, max: 62,  gpa43: 1.7, gpa40: 1.7, midpoint: 61, pass: true },
  { letter: 'D',  min: 50, max: 59,  gpa43: 1.0, gpa40: 1.0, midpoint: 55, pass: false },
  { letter: 'F',  min: 0,  max: 49,  gpa43: 0.0, gpa40: 0.0, midpoint: 25, pass: false }
];

function getGradeScaleByPercentage(score) {
  const rounded = Math.round(parseFloat(score));
  if (isNaN(rounded)) return null;
  return GRADE_SCALE.find(item => rounded >= item.min && rounded <= item.max) || null;
}

function getGradeScaleByLetter(letter) {
  if (!letter) return null;
  return GRADE_SCALE.find(item => item.letter.toUpperCase() === letter.trim().toUpperCase()) || null;
}

function getGPAByGrade(type, value, scaleSystem = '4.3') {
  if (type === 'none' || type === undefined) return null;
  let scaleInfo = null;
  if (type === 'percentage') {
    scaleInfo = getGradeScaleByPercentage(value);
  } else if (type === 'letter') {
    scaleInfo = getGradeScaleByLetter(value);
  }
  if (!scaleInfo) return 0.0;
  return scaleSystem === '4.3' ? scaleInfo.gpa43 : scaleInfo.gpa40;
}

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
  btnCloseNonCreditModal: document.getElementById('btn-close-non-credit-modal'),
  
  // GPA 試算與分析引擎 DOM 快取
  gpaCumulativeVal: document.getElementById('gpa-cumulative-val'),
  gpaCompletedCredits: document.getElementById('gpa-completed-credits'),
  gpaInprogressCredits: document.getElementById('gpa-inprogress-credits'),
  gpaPlannedCredits: document.getElementById('gpa-planned-credits'),
  btnScale43: document.getElementById('btn-scale-43'),
  btnScale40: document.getElementById('btn-scale-40'),
  semesterGpaBody: document.getElementById('semester-gpa-body'),
  courseGradeType: document.getElementById('course-grade-type'),
  gradeInputArea: document.getElementById('grade-input-area'),
  gradeValPercentageGroup: document.getElementById('grade-val-percentage-group'),
  courseGradePercentage: document.getElementById('course-grade-percentage'),
  gradeValLetterGroup: document.getElementById('grade-val-letter-group'),
  courseGradeLetter: document.getElementById('course-grade-letter'),
  gradeLivePreview: document.getElementById('grade-live-preview'),
  calcPercentInput: document.getElementById('calc-percent-input'),
  calcPercentResult: document.getElementById('calc-percent-result'),
  calcLetterSelect: document.getElementById('calc-letter-select'),
  calcLetterResult: document.getElementById('calc-letter-result')
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
      if (!state.gpaScale) state.gpaScale = '4.3';
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
  const scale = state.gpaScale || '4.3';
  const stats = {
    totalTarget: state.totalTargetCredits,
    earnedTotal: 0,
    completed: 0,
    inprogress: 0,
    planned: 0,
    categoryBreakdown: {},
    
    // GPA 新增統計項
    gpaCumulative: 0.00,
    totalGpaCredits: 0,
    weightedGpaPoints: 0,
    semesterStats: {}
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
    const sem = course.semester;
    
    // 初始化學期統計
    if (!stats.semesterStats[sem]) {
      stats.semesterStats[sem] = {
        totalCredits: 0,
        gradedCredits: 0,
        passedCredits: 0,
        weightedPoints: 0,
        weightedPercentage: 0
      };
    }
    
    // 不管修課狀態，只要規劃在該學期，就計入該期規劃總學分
    stats.semesterStats[sem].totalCredits += cred;
    
    // 計算全域狀態與及格判定
    let isPass = true;
    if (course.status === 'completed') {
      // 學分及格判定：
      // 如果有輸入成績，百分制需 >= 60 或等級制非 D/F
      if (course.gradeType === 'percentage' && course.gradeValue !== undefined && course.gradeValue !== '') {
        const val = parseFloat(course.gradeValue);
        isPass = val >= 60;
      } else if (course.gradeType === 'letter' && course.gradeValue) {
        const scaleInfo = getGradeScaleByLetter(course.gradeValue);
        isPass = scaleInfo ? scaleInfo.pass : true;
      }
      
      if (isPass) {
        stats.completed += cred;
        stats.earnedTotal += cred; // 已通過及格計入畢業學分
        stats.semesterStats[sem].passedCredits += cred;
      } else {
        // 不及格的已修完課程，學分為0，但計入學期規劃中與 GPA 因子
      }
    } else if (course.status === 'inprogress') {
      stats.inprogress += cred;
    } else if (course.status === 'planned') {
      stats.planned += cred;
    }

    // 計算分類學分 (僅加總及格的 completed)
    if (stats.categoryBreakdown[catId]) {
      if (course.status === 'completed' && isPass) {
        stats.categoryBreakdown[catId].completed += cred;
      } else if (course.status === 'inprogress') {
        stats.categoryBreakdown[catId].inprogress += cred;
      } else if (course.status === 'planned') {
        stats.categoryBreakdown[catId].planned += cred;
      }
    }

    // GPA 計算累計 (僅針對已完成 completed 且計分的課程)
    if (course.status === 'completed' && course.gradeType !== 'none' && course.gradeType !== undefined) {
      const gpaPoints = getGPAByGrade(course.gradeType, course.gradeValue, scale);
      let percentageScore = 0;
      if (course.gradeType === 'percentage') {
        percentageScore = parseFloat(course.gradeValue) || 0;
      } else if (course.gradeType === 'letter') {
        const scaleInfo = getGradeScaleByLetter(course.gradeValue);
        percentageScore = scaleInfo ? scaleInfo.midpoint : 0;
      }
      
      if (course.gradeValue !== undefined && course.gradeValue !== '') {
        // 全域 GPA 加權
        stats.totalGpaCredits += cred;
        stats.weightedGpaPoints += (cred * gpaPoints);
        
        // 單學期 GPA 加權
        stats.semesterStats[sem].gradedCredits += cred;
        stats.semesterStats[sem].weightedPoints += (cred * gpaPoints);
        stats.semesterStats[sem].weightedPercentage += (cred * percentageScore);
      }
    }
  });

  // 計算累積 GPA
  if (stats.totalGpaCredits > 0) {
    stats.gpaCumulative = stats.weightedGpaPoints / stats.totalGpaCredits;
  } else {
    stats.gpaCumulative = 0.00;
  }

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
  
  // 同步渲染 GPA 儀表板
  renderGPADashboard(stats);
}

// 新增 1.1. 渲染 GPA 深度分析儀表板
function renderGPADashboard(stats) {
  // 累積 GPA 顯示
  DOM.gpaCumulativeVal.textContent = stats.gpaCumulative.toFixed(2);
  
  // 累積學分加總細項
  DOM.gpaCompletedCredits.textContent = `${stats.completed} 學分`;
  DOM.gpaInprogressCredits.textContent = `${stats.inprogress} 學分`;
  DOM.gpaPlannedCredits.textContent = `${stats.planned} 學分`;
  
  // 雙軌制按鈕 active 樣式切換
  if (state.gpaScale === '4.3') {
    DOM.btnScale43.classList.add('active');
    DOM.btnScale40.classList.remove('active');
  } else {
    DOM.btnScale43.classList.remove('active');
    DOM.btnScale40.classList.add('active');
  }
  
  // 渲染學期 GPA 列表
  DOM.semesterGpaBody.innerHTML = '';
  
  // 取得排序後的學期
  const semKeys = Object.keys(stats.semesterStats);
  semKeys.sort((a, b) => {
    const [yA, sA] = a.split('-').map(Number);
    const [yB, sB] = b.split('-').map(Number);
    if (yA !== yB) return yA - yB;
    return sA - sB;
  });
  
  if (semKeys.length === 0) {
    DOM.semesterGpaBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">尚未規劃任何學期課程</td></tr>';
  } else {
    semKeys.forEach(sem => {
      const semStat = stats.semesterStats[sem];
      const semGpa = semStat.gradedCredits > 0 ? (semStat.weightedPoints / semStat.gradedCredits) : 0;
      const semAvgScore = semStat.gradedCredits > 0 ? Math.round(semStat.weightedPercentage / semStat.gradedCredits) : 0;
      
      const semLabel = formatSemesterLabel(sem);
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${semLabel}</strong></td>
        <td>${semStat.totalCredits} 學分</td>
        <td>${semStat.gradedCredits} 學分</td>
        <td class="text-success">${semStat.passedCredits} 學分</td>
        <td>${semStat.gradedCredits > 0 ? `${semAvgScore} 分` : '<span class="text-muted">-</span>'}</td>
        <td><strong class="text-primary">${semStat.gradedCredits > 0 ? semGpa.toFixed(2) : '<span class="text-muted">-</span>'}</strong></td>
      `;
      DOM.semesterGpaBody.appendChild(row);
    });
  }
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

  // 重新進行統計計算，獲取最新的學期 GPA
  const stats = calculateStats();

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
        // 及格判斷
        let isPass = true;
        if (c.gradeType === 'percentage' && c.gradeValue !== undefined && c.gradeValue !== '') {
          isPass = parseFloat(c.gradeValue) >= 60;
        } else if (c.gradeType === 'letter' && c.gradeValue) {
          const scaleInfo = getGradeScaleByLetter(c.gradeValue);
          isPass = scaleInfo ? scaleInfo.pass : true;
        }
        if (isPass) {
          semCompletedCredits += cr;
        }
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

    // 計算該單期 GPA
    const semStat = stats.semesterStats[sem] || { gradedCredits: 0, weightedPoints: 0 };
    const semGpa = semStat.gradedCredits > 0 ? (semStat.weightedPoints / semStat.gradedCredits) : 0;
    const gpaBadgeHtml = semStat.gradedCredits > 0 ? `<span class="semester-gpa-badge" title="單期學業平均表現">GPA: ${semGpa.toFixed(2)}</span>` : '';

    const semLabel = formatSemesterLabel(sem);
    semCard.innerHTML = `
      <div class="semester-header">
        <div class="flex-between">
          <span class="semester-title">${semLabel}</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${gpaBadgeHtml}
            ${loadWarning}
          </div>
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
        
        // 課程成績徽章
        let gradeBadge = '';
        if (course.status === 'completed' && course.gradeType !== 'none' && course.gradeType !== undefined && course.gradeValue !== undefined && course.gradeValue !== '') {
          let isPass = true;
          let displayVal = '';
          if (course.gradeType === 'percentage') {
            isPass = parseFloat(course.gradeValue) >= 60;
            displayVal = `${course.gradeValue}分`;
          } else if (course.gradeType === 'letter') {
            const scaleInfo = getGradeScaleByLetter(course.gradeValue);
            isPass = scaleInfo ? scaleInfo.pass : true;
            displayVal = course.gradeValue;
          }
          const badgeClass = isPass ? 'passed' : 'failed';
          gradeBadge = `<span class="course-grade-badge ${badgeClass}">${displayVal}</span>`;
        }

        const pill = document.createElement('div');
        pill.className = 'course-item-pill';
        pill.style.borderLeftColor = catColor;
        pill.innerHTML = `
          <div class="course-item-info">
            <div class="course-item-name" title="${escapeHTML(course.name)}">${escapeHTML(course.name)}</div>
            <div class="course-item-meta">
              <span class="course-status-dot ${course.status}"></span>
              <span>${course.credits} 學分</span>
              ${gradeBadge}
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

  // 讀取成績登錄欄位
  const gradeType = DOM.courseGradeType.value;
  let gradeValue = undefined;
  if (status === 'completed') {
    if (gradeType === 'percentage') {
      const gVal = parseFloat(DOM.courseGradePercentage.value);
      if (isNaN(gVal) || gVal < 0 || gVal > 100) {
        showToast('請輸入學科百分制成績 (0-100)！', 'danger');
        return;
      }
      gradeValue = gVal;
    } else if (gradeType === 'letter') {
      const gVal = DOM.courseGradeLetter.value;
      if (!gVal) {
        showToast('請選擇等級制等第！', 'danger');
        return;
      }
      gradeValue = gVal;
    }
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
      course.gradeType = gradeType;
      course.gradeValue = gradeValue;
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
      status,
      gradeType,
      gradeValue
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
  
  // 成績還原填寫
  DOM.courseGradeType.value = course.gradeType || 'none';
  if (course.gradeType === 'percentage') {
    DOM.courseGradePercentage.value = course.gradeValue !== undefined ? course.gradeValue : '';
    DOM.courseGradeLetter.value = '';
  } else if (course.gradeType === 'letter') {
    DOM.courseGradePercentage.value = '';
    DOM.courseGradeLetter.value = course.gradeValue || '';
  } else {
    DOM.courseGradePercentage.value = '';
    DOM.courseGradeLetter.value = '';
  }
  
  toggleGradeInputArea();
  toggleGradeValueFields();
  
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
  DOM.courseGradeType.value = 'none';
  DOM.courseGradePercentage.value = '';
  DOM.courseGradeLetter.value = '';
  toggleGradeInputArea();
  toggleGradeValueFields();
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
  
  // 課程表單成績顯示動態綁定
  DOM.courseStatus.addEventListener('change', toggleGradeInputArea);
  DOM.courseGradeType.addEventListener('change', toggleGradeValueFields);
  DOM.courseGradePercentage.addEventListener('input', updateLiveGradePreview);
  DOM.courseGradeLetter.addEventListener('change', updateLiveGradePreview);

  // GPA 雙制式切換
  DOM.btnScale43.addEventListener('click', () => {
    state.gpaScale = '4.3';
    saveState();
  });
  DOM.btnScale40.addEventListener('click', () => {
    state.gpaScale = '4.0';
    saveState();
  });

  // 初始化成績快捷換算對照器
  initGPAConverterUtility();
}

// -------------------------------------------------------------
// GPA 動態表單與對照工具事件處理輔助函式
// -------------------------------------------------------------
function toggleGradeInputArea() {
  if (DOM.courseStatus.value === 'completed') {
    DOM.gradeInputArea.style.display = 'block';
  } else {
    DOM.gradeInputArea.style.display = 'none';
  }
}

function toggleGradeValueFields() {
  const type = DOM.courseGradeType.value;
  if (type === 'none') {
    DOM.gradeValPercentageGroup.style.display = 'none';
    DOM.gradeValLetterGroup.style.display = 'none';
    DOM.gradeLivePreview.style.display = 'none';
  } else if (type === 'percentage') {
    DOM.gradeValPercentageGroup.style.display = 'block';
    DOM.gradeValLetterGroup.style.display = 'none';
    DOM.gradeLivePreview.style.display = 'block';
    updateLiveGradePreview();
  } else if (type === 'letter') {
    DOM.gradeValPercentageGroup.style.display = 'none';
    DOM.gradeValLetterGroup.style.display = 'block';
    DOM.gradeLivePreview.style.display = 'block';
    updateLiveGradePreview();
  }
}

function updateLiveGradePreview() {
  const type = DOM.courseGradeType.value;
  let text = '即時換算預覽：<span class="grade-preview-highlight">請輸入分數</span>';
  
  if (type === 'percentage') {
    const val = parseFloat(DOM.courseGradePercentage.value);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      const scaleInfo = getGradeScaleByPercentage(val);
      if (scaleInfo) {
        text = `即時換算等第：<span class="grade-preview-highlight">${scaleInfo.letter}</span> | GPA：<span class="grade-preview-highlight">${scaleInfo.gpa43.toFixed(1)}</span> (4.3制) / <span class="grade-preview-highlight">${scaleInfo.gpa40.toFixed(1)}</span> (4.0制) | ${scaleInfo.pass ? '<span class="text-success" style="font-weight:700;">及格</span>' : '<span class="text-danger" style="font-weight:700;">不及格</span>'}`;
      }
    }
  } else if (type === 'letter') {
    const val = DOM.courseGradeLetter.value;
    if (val) {
      const scaleInfo = getGradeScaleByLetter(val);
      if (scaleInfo) {
        text = `對照分數區間：<span class="grade-preview-highlight">${scaleInfo.min}-${scaleInfo.max}分</span> (基準分: ${scaleInfo.midpoint}分) | GPA：<span class="grade-preview-highlight">${scaleInfo.gpa43.toFixed(1)}</span> (4.3制) / <span class="grade-preview-highlight">${scaleInfo.gpa40.toFixed(1)}</span> (4.0制) | ${scaleInfo.pass ? '<span class="text-success" style="font-weight:700;">及格</span>' : '<span class="text-danger" style="font-weight:700;">不及格</span>'}`;
      }
    }
  }
  DOM.gradeLivePreview.innerHTML = text;
}

function initGPAConverterUtility() {
  DOM.calcPercentInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      const scaleInfo = getGradeScaleByPercentage(val);
      if (scaleInfo) {
        DOM.calcPercentResult.innerHTML = `等第: <strong class="text-primary">${scaleInfo.letter}</strong> | GPA: <strong>${scaleInfo.gpa43.toFixed(1)}</strong> (4.3) / <strong>${scaleInfo.gpa40.toFixed(1)}</strong> (4.0)`;
      } else {
        DOM.calcPercentResult.textContent = '等第: - | GPA: -';
      }
    } else {
      DOM.calcPercentResult.textContent = '等第: - | GPA: -';
    }
  });

  DOM.calcLetterSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val) {
      const scaleInfo = getGradeScaleByLetter(val);
      if (scaleInfo) {
        DOM.calcLetterResult.innerHTML = `基準分: <strong>${scaleInfo.midpoint}分</strong> | GPA: <strong>${scaleInfo.gpa43.toFixed(1)}</strong> (4.3) / <strong>${scaleInfo.gpa40.toFixed(1)}</strong> (4.0)`;
      } else {
        DOM.calcLetterResult.textContent = '基準分: - | GPA: -';
      }
    } else {
      DOM.calcLetterResult.textContent = '基準分: - | GPA: -';
    }
  });
}

// 啟動 App
document.addEventListener('DOMContentLoaded', initApp);
