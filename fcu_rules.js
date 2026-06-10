/**
 * 逢甲大學學業進度與預警規則資料庫 (fcu_rules.js)
 * 包含：各系所畢業標準、學分預警引擎演算法、Demo 學生資料
 */

// 1. 各系所畢業門檻標準
const FCU_DEPARTMENT_TEMPLATES = {
    CSIE: {
        name: "資訊工程學系",
        total: 128,
        categories: {
            required: 72,    // 專業必修 (含院基、系必)
            elective: 28,    // 專業選修
            general: 28      // 通識教育 (核心通識 + 延伸通識 + 國英文)
        },
        prerequisites: [
            { cond: "程式設計(一)不及格", block: "資料結構" },
            { cond: "微積分(一)不及格", block: "工程數學(一)" }
        ]
    },
    BA: {
        name: "企業管理學系",
        total: 128,
        categories: {
            required: 60,
            elective: 40,
            general: 28
        },
        prerequisites: [
            { cond: "初等會計學不及格", block: "中等會計學" },
            { cond: "經濟學(一)不及格", block: "經濟學(二)" }
        ]
    },
    EE: {
        name: "電機工程學系",
        total: 130,
        categories: {
            required: 80,
            elective: 22,
            general: 28
        },
        prerequisites: [
            { cond: "微積分(一)不及格", block: "工程數學" },
            { cond: "電路學(一)不及格", block: "電子學" }
        ]
    }
};

// 2. 學業預警評估引擎
function evaluateStudentWarning(student) {
    const deptRule = FCU_DEPARTMENT_TEMPLATES[student.dept];
    const warnings = [];
    let riskScore = 0; // 0 to 100

    // (A) 學期雙二一退學預警 (FCU學則：累計兩次二一或單次被當學分過高)
    // 檢查當期不及格學分比例
    const currentSemesterCourses = student.currentCourses || [];
    const totalSemCredits = currentSemesterCourses.reduce((sum, c) => sum + c.credits, 0);
    const failedSemCredits = currentSemesterCourses
        .filter(c => c.score < 60)
        .reduce((sum, c) => sum + c.credits, 0);

    const failRatio = totalSemCredits > 0 ? (failedSemCredits / totalSemCredits) : 0;
    
    if (failRatio >= 0.66) {
        warnings.push({
            type: "danger",
            title: "學期三二預警 (危機邊緣)",
            desc: `本學期不及格學分達 ${(failRatio * 100).toFixed(0)}% (超出 2/3)，面臨極高退學風險！`,
            icon: "exclamation-triangle"
        });
        riskScore += 50;
    } else if (failRatio >= 0.5) {
        warnings.push({
            type: "danger",
            title: "學期二一預警 (紅色警戒)",
            desc: `本學期不及格學分達 ${(failRatio * 100).toFixed(0)}% (超出 1/2)，已達二一預警標準！`,
            icon: "exclamation-circle"
        });
        riskScore += 35;
    } else if (failRatio >= 0.3) {
        warnings.push({
            type: "warning",
            title: "學術表現黃色警告",
            desc: `本學期不及格學分達 ${(failRatio * 100).toFixed(0)}%，請注意後續課業輔導。`,
            icon: "info-circle"
        });
        riskScore += 15;
    }

    // (B) 畢業學分缺口與延畢風險
    const completedCredits = student.creditsCompleted.required + student.creditsCompleted.elective + student.creditsCompleted.general;
    const remainingCredits = Math.max(0, deptRule.total - completedCredits);
    
    // 剩餘可修學期的學分平均負荷 (假設大四下是第 8 學期)
    // 1-8 學期。剩餘學期數 = (8 - student.currentSemester + 1)
    const remainingSemesters = Math.max(1, 8 - student.currentSemester + 1);
    const avgCreditsNeeded = remainingCredits / remainingSemesters;

    if (remainingCredits > 0) {
        if (avgCreditsNeeded > 28) {
            warnings.push({
                type: "danger",
                title: "畢業學分超載 (延畢危機)",
                desc: `剩餘學分 ${remainingCredits}，平均每學期需修習 ${avgCreditsNeeded.toFixed(1)} 學分，已超出逢甲每學期修習上限（28 學分），極大機率延畢！`,
                icon: "history"
            });
            riskScore += 30;
        } else if (avgCreditsNeeded > 22) {
            warnings.push({
                type: "warning",
                title: "學分修習負荷偏高",
                desc: `剩餘學分 ${remainingCredits}，平均每學期需修習 ${avgCreditsNeeded.toFixed(1)} 學分。課業負擔極重，建議規劃暑修分流。`,
                icon: "tachometer-alt"
            });
            riskScore += 15;
        }
    }

    // (C) 擋修與必修漏修預警
    student.failedRequiredCourses.forEach(course => {
        const prereq = deptRule.prerequisites.find(p => p.cond.includes(course));
        if (prereq) {
            warnings.push({
                type: "danger",
                title: "關鍵必修被當 (擋修警告)",
                desc: `因「${course}」不及格，後續必修課程「${prereq.block}」已被擋修，將影響修課順序與畢業時程！`,
                icon: "ban"
            });
            riskScore += 20;
        } else {
            warnings.push({
                type: "warning",
                title: "必修課不及格 (須重修)",
                desc: `核心必修「${course}」尚未通過，請盡快規劃重修，以免大四面臨排課衝突。`,
                icon: "redo-alt"
            });
            riskScore += 10;
        }
    });

    // (D) 逢甲畢業門檻未達標警告 (大三、大四特別提示)
    if (student.currentSemester >= 5) {
        if (!student.graduationThresholds.english) {
            warnings.push({
                type: "warning",
                title: "英語畢業門檻未達標",
                desc: `已達大${Math.ceil(student.currentSemester/2)}，尚未通過英語畢業檢定門檻 (如多益 550 分)，請儘速報考或修讀替代課程。`,
                icon: "language"
            });
            riskScore += 8;
        }
        if (!student.graduationThresholds.serviceLearning1 || !student.graduationThresholds.serviceLearning2) {
            warnings.push({
                type: "warning",
                title: "服務學習尚未完成",
                desc: `「服務學習」必修零學分門檻尚未完全通過，請確認修課進度。`,
                icon: "hands-helping"
            });
            riskScore += 5;
        }
    }

    // (E) 每學期學分下限檢驗
    if (totalSemCredits < 9 && student.currentSemester < 8) {
        warnings.push({
            type: "warning",
            title: "修習學分未達下限",
            desc: `本學期僅修習 ${totalSemCredits} 學分，未達每學期最低 9 學分限制（大四除外），請向註冊組或導師確認。`,
            icon: "arrow-down"
        });
        riskScore += 10;
    }

    // 限制最高 100 分
    riskScore = Math.min(100, riskScore);

    // 綜合狀態評估
    let statusLabel = "優秀 / 安全";
    let statusClass = "status-safe";
    if (riskScore >= 60) {
        statusLabel = "學業危機 (高風險)";
        statusClass = "status-danger";
    } else if (riskScore >= 20) {
        statusLabel = "注意 / 黃色警戒";
        statusClass = "status-warning";
    }

    return {
        warnings,
        riskScore,
        statusLabel,
        statusClass
    };
}

// 3. 三大 Demo 模擬數據
const FCU_DEMO_STUDENTS = {
    studentA: {
        id: "D1101234",
        name: "林逢甲 (資工系學霸)",
        dept: "CSIE",
        currentSemester: 6, // 大三下
        creditsCompleted: {
            required: 64,
            elective: 22,
            general: 26
        },
        failedRequiredCourses: [],
        graduationThresholds: {
            english: true, // 多益 780 通過
            serviceLearning1: true,
            serviceLearning2: true
        },
        currentCourses: [
            { code: "CO-301", name: "演算法", credits: 3, type: "required", score: 88, status: "safe", day: 3, periods: [2, 3, 4] },
            { code: "CO-302", name: "編譯器設計", credits: 3, type: "required", score: 82, status: "safe", day: 2, periods: [6, 7, 8] },
            { code: "CO-351", name: "人工智慧導論", credits: 3, type: "elective", score: 95, status: "safe", day: 1, periods: [6, 7, 8] },
            { code: "CO-352", name: "雲端運算架構", credits: 3, type: "elective", score: 90, status: "safe", day: 4, periods: [2, 3, 4] },
            { code: "GE-401", name: "前瞻科技與社會", credits: 2, type: "general", score: 92, status: "safe", day: 5, periods: [3, 4] }
        ],
        timeManagement: {
            weeklyStudyHours: 35,
            weeklyLeisureHours: 15,
            homeworks: [
                { id: 1, title: "編譯器作業三: Parser 實作", deadline: "3天後", done: true },
                { id: 2, title: "演算法作業二: Dynamic Programming", deadline: "5天後", done: true },
                { id: 3, title: "雲端運算分組專題大綱", deadline: "7天後", done: true }
            ],
            gpaHistory: [3.85, 3.90, 3.88, 3.92, 3.95]
        }
    },
    
    studentB: {
        id: "D1124567",
        name: "陳大里 (企管系二一危機生)",
        dept: "BA",
        currentSemester: 4, // 大二下
        creditsCompleted: {
            required: 18,
            elective: 10,
            general: 14
        },
        failedRequiredCourses: ["初等會計學", "經濟學(一)"],
        graduationThresholds: {
            english: false, // 多益 420 未達標
            serviceLearning1: true,
            serviceLearning2: false
        },
        currentCourses: [
            { code: "BA-201", name: "中等會計學", credits: 3, type: "required", score: 45, status: "danger", day: 1, periods: [2, 3, 4] }, // 會計被擋但偷偷選上或異常，或是本學期必修不及格
            { code: "BA-202", name: "行銷管理", credits: 3, type: "required", score: 72, status: "safe", day: 2, periods: [2, 3, 4] },
            { code: "BA-203", name: "組織行為學", credits: 3, type: "required", score: 42, status: "danger", day: 3, periods: [6, 7, 8] },
            { code: "BA-251", name: "財務管理", credits: 3, type: "elective", score: 50, status: "danger", day: 4, periods: [6, 7, 8] },
            { code: "BA-252", name: "商業談判", credits: 3, type: "elective", score: 62, status: "safe", day: 5, periods: [6, 7, 8] },
            { code: "GE-201", name: "歷史與文化", credits: 2, type: "general", score: 80, status: "safe", day: 5, periods: [1, 2] }
        ],
        timeManagement: {
            weeklyStudyHours: 6,
            weeklyLeisureHours: 42,
            homeworks: [
                { id: 1, title: "中會作業五: 折舊方法計算", deadline: "1天後", done: false },
                { id: 2, title: "行銷專案報告 PPT", deadline: "3天後", done: true },
                { id: 3, title: "組織行為學課堂心得", deadline: "4天後", done: false },
                { id: 4, title: "財管期末模擬考題", deadline: "5天後", done: false },
                { id: 5, title: "通識微課程心得(1500字)", deadline: "8天後", done: false }
            ],
            gpaHistory: [2.3, 1.9, 1.7]
        }
    },
 
    studentC: {
        id: "D1097890",
        name: "張西屯 (電機系延畢邊緣人)",
        dept: "EE",
        currentSemester: 7, // 大四上
        creditsCompleted: {
            required: 48,
            elective: 15,
            general: 22
        },
        failedRequiredCourses: ["微積分(一)", "電路學(一)"],
        graduationThresholds: {
            english: false, // 未考
            serviceLearning1: true,
            serviceLearning2: false
        },
        currentCourses: [
            { code: "EE-401", name: "專題實作(二)", credits: 2, type: "required", score: 85, status: "safe", day: 1, periods: [8, 9] },
            { code: "EE-302", name: "電子學(二)", credits: 3, type: "required", score: 61, status: "warning", day: 2, periods: [2, 3, 4] },
            { code: "EE-201", name: "工程數學(一)", credits: 3, type: "required", score: 65, status: "safe", day: 3, periods: [2, 3, 4] },
            { code: "GE-303", name: "生命倫理", credits: 2, type: "general", score: 70, status: "safe", day: 4, periods: [7, 8] }
        ],
        timeManagement: {
            weeklyStudyHours: 12,
            weeklyLeisureHours: 25,
            homeworks: [
                { id: 1, title: "電子學實作報告(二)", deadline: "2天後", done: false },
                { id: 2, title: "專題展示海報設計", deadline: "5天後", done: true },
                { id: 3, title: "生命教育讀書心得", deadline: "6天後", done: false }
            ],
            gpaHistory: [1.8, 2.1, 2.2, 1.9, 2.3, 2.0]
        }
    }
};

// 匯出到 window 物件，便於瀏覽器環境直接引用
window.FCU_DEPARTMENT_TEMPLATES = FCU_DEPARTMENT_TEMPLATES;
window.evaluateStudentWarning = evaluateStudentWarning;
window.FCU_DEMO_STUDENTS = FCU_DEMO_STUDENTS;
