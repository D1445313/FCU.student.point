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
