/* ==========================================================================
   逢甲大學學業進度與時間管理整合系統 - CSV 與 FCU 貼上解析器
   ========================================================================== */

// 全域暫存解析出的課程資料，方便使用者修改與確認匯入
let parsedCoursesTemp = [];

document.addEventListener('DOMContentLoaded', () => {
    // 初始化拖放區事件
    const dropZone = document.getElementById('dragDropZone');
    const fileInput = document.getElementById('csvFileInput');

    if (dropZone && fileInput) {
        // 點擊拖放區觸發檔案選取
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleCSVFile(file);
        });

        // 拖曳狀態樣式切換
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        ['dragleave', 'dragend'].forEach(type => {
            dropZone.addEventListener(type, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleCSVFile(file);
        });
    }
});

/**
 * 處理並讀取 CSV 檔案
 * @param {File} file 
 */
function handleCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
        showToast('請上傳副檔名為 .csv 的檔案！', 'danger');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSVText(text);
    };
    reader.readAsText(file, 'UTF-8');
}

/**
 * 解析 CSV 文字內容
 * @param {string} text 
 */
function parseCSVText(text) {
    try {
        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
            showToast('CSV 檔案為空或無有效內容', 'warning');
            return;
        }

        // 解析標頭以尋找對應欄位索引
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const colIndices = {
            semester: headers.findIndex(h => h.includes('學期') || h.toLowerCase().includes('semester')),
            course_name: headers.findIndex(h => h.includes('課程') || h.includes('科目') || h.toLowerCase().includes('name')),
            credits: headers.findIndex(h => h.includes('學分') || h.toLowerCase().includes('credit')),
            grade: headers.findIndex(h => h.includes('成績') || h.includes('分數') || h.toLowerCase().includes('grade')),
            category: headers.findIndex(h => h.includes('類別') || h.includes('選別') || h.toLowerCase().includes('category')),
            subcategory: headers.findIndex(h => h.includes('次類別') || h.includes('領域') || h.toLowerCase().includes('sub'))
        };

        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = parseCSVLine(line);
            if (cols.length === 0) continue;

            // 讀取對應欄位，找不到則依預設索引
            const semester = colIndices.semester !== -1 ? cols[colIndices.semester] : (cols[0] || '');
            const course_name = colIndices.course_name !== -1 ? cols[colIndices.course_name] : (cols[1] || '');
            const credits = colIndices.credits !== -1 ? cols[colIndices.credits] : (cols[2] || '');
            const grade = colIndices.grade !== -1 ? cols[colIndices.grade] : (cols[3] || '');
            const category = colIndices.category !== -1 ? cols[colIndices.category] : (cols[4] || '');
            const subcategory = colIndices.subcategory !== -1 ? cols[colIndices.subcategory] : (cols[5] || '');

            if (semester && course_name && credits) {
                result.push({
                    semester: semester.trim(),
                    course_name: course_name.trim(),
                    credits: parseInt(credits) || 2,
                    grade: grade ? grade.trim() : '',
                    category: mapCategory(category),
                    subcategory: subcategory ? subcategory.trim() : '',
                    status: (grade && grade.trim() !== '') ? '已完成' : '修習中'
                });
            }
        }

        if (result.length > 0) {
            parsedCoursesTemp = result;
            renderPreviewTable();
            showToast(`成功解析 CSV，共有 ${result.length} 筆課程，請於下方表格確認。`, 'success');
        } else {
            showToast('未能從 CSV 解析出任何有效課程，請確認欄位格式是否正確', 'danger');
        }
    } catch (err) {
        showToast(`CSV 解析失敗：${err.message}`, 'danger');
    }
}

/**
 * 安全解析含有逗號或引號的 CSV 行
 * @param {string} line 
 * @returns {string[]}
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * 智慧解析 MyFCU 歷年成績貼上文字 (Heuristics-based Regex Parser)
 */
function parseFCUPasteText() {
    const textarea = document.getElementById('fcuPasteArea');
    if (!textarea || !textarea.value.trim()) {
        showToast('請先貼上 FCU 成績文字！', 'warning');
        return;
    }

    const rawText = textarea.value;
    const lines = rawText.split('\n');
    const result = [];

    // 定義各欄位的規則與權重
    const semesterRegex = /(\d{3})-?([12])/; // 匹配 112-1, 112-2, 1121 等學期
    const categoryKeywords = ['必修', '選修', '通識', '必', '選', '通', '體育', '軍訓', '核心'];

    lines.forEach((line, idx) => {
        const cleanLine = line.trim();
        // 過濾空行、含有標頭的行
        if (!cleanLine || cleanLine.includes('學期') || cleanLine.includes('課程代碼') || cleanLine.includes('科目名稱')) {
            return;
        }

        // 以 Tab 或多個空白切分
        const tokens = cleanLine.split(/\s+/).map(t => t.trim());
        if (tokens.length < 3) return; // 欄位太少，非有效資料

        let semester = '';
        let course_name = '';
        let credits = null;
        let grade = '';
        let category = '選修';
        let subcategory = '';

        // 智慧辨識 Token
        const unusedTokens = [];

        tokens.forEach(token => {
            // 1. 識別學期
            const semMatch = token.match(semesterRegex);
            if (semMatch && !semester) {
                semester = `${semMatch[1]}-${semMatch[2]}`;
                return;
            }

            // 2. 識別學分數 (通常為一個介於 0 與 10 之間的數字，且沒有點，排在中間)
            const num = parseInt(token);
            if (!isNaN(num) && num > 0 && num <= 6 && credits === null) {
                credits = num;
                return;
            }

            // 3. 識別類別/選別
            const foundCat = categoryKeywords.find(k => token.includes(k));
            if (foundCat) {
                category = mapCategory(token);
                if (token.includes('通識')) {
                    subcategory = token; // 保留通識領域名稱 (如 通識-人文)
                }
                return;
            }

            // 4. 識別成績 (0-100 的數字，或等第 A+ 到 F，或者 "抵免")
            const scoreNum = parseFloat(token);
            if (!isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 100) {
                grade = token;
                return;
            }
            if (['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'E', 'F', 'X', 'I', 'S', 'P', '抵免', '免修'].includes(token.toUpperCase())) {
                grade = token.toUpperCase();
                return;
            }

            // 其他未識別字串
            unusedTokens.push(token);
        });

        // Heuristic: 最長且不含數字與選課代號的未識別 Token 視為課程名稱
        let nameToken = '';
        unusedTokens.forEach(token => {
            // 過濾六位數以上的選課代碼 (例如 241562)
            if (/^\d{5,8}$/.test(token)) return;
            if (token.length > nameToken.length) {
                nameToken = token;
            }
        });

        course_name = nameToken || unusedTokens.join(' ');

        if (semester && course_name && credits !== null) {
            result.push({
                semester: semester,
                course_name: course_name,
                credits: credits,
                grade: grade,
                category: category,
                subcategory: subcategory,
                status: (grade && grade !== '修習中') ? '已完成' : '修習中'
            });
        }
    });

    if (result.length > 0) {
        parsedCoursesTemp = result;
        renderPreviewTable();
        showToast(`智慧解析完成！共解析出 ${result.length} 筆課程`, 'success');
    } else {
        showToast('無法解析文字格式，請確認貼上內容是否包含學期、課程、學分與類別', 'danger');
    }
}

/**
 * 標準化類別名稱
 */
function mapCategory(catStr) {
    if (!catStr) return '選修';
    if (catStr.includes('必')) return '必修';
    if (catStr.includes('選')) return '選修';
    if (catStr.includes('通') || catStr.includes('領域') || catStr.includes('核心')) return '通識';
    if (catStr.includes('體')) return '體育';
    return '其他';
}

/**
 * 將解析暫存的課程清單渲染在畫面上，供使用者匯入前確認與手動修改
 */
function renderPreviewTable() {
    const previewSection = document.getElementById('previewSection');
    const tbody = document.getElementById('previewTableBody');
    if (!previewSection || !tbody) return;

    tbody.innerHTML = '';

    parsedCoursesTemp.forEach((c, index) => {
        const tr = document.createElement('tr');
        tr.id = `preview-row-${index}`;
        
        tr.innerHTML = `
            <td>
                <input type="text" class="preview-input" value="${c.semester}" onchange="updateTempItem(${index}, 'semester', this.value)" style="width: 80px; padding: 4px 8px; font-size: 0.85rem;">
            </td>
            <td>
                <input type="text" class="preview-input" value="${c.course_name}" onchange="updateTempItem(${index}, 'course_name', this.value)" style="padding: 4px 8px; font-size: 0.85rem;">
            </td>
            <td>
                <input type="number" class="preview-input" value="${c.credits}" min="1" max="10" onchange="updateTempItem(${index}, 'credits', this.value)" style="width: 60px; padding: 4px 8px; font-size: 0.85rem;">
            </td>
            <td>
                <input type="text" class="preview-input" value="${c.grade}" onchange="updateTempItem(${index}, 'grade', this.value)" placeholder="未完成" style="width: 70px; padding: 4px 8px; font-size: 0.85rem;">
            </td>
            <td>
                <select class="preview-input" onchange="updateTempItem(${index}, 'category', this.value)" style="padding: 4px 8px; font-size: 0.85rem; width: 90px;">
                    <option value="必修" ${c.category === '必修' ? 'selected' : ''}>必修</option>
                    <option value="選修" ${c.category === '選修' ? 'selected' : ''}>選修</option>
                    <option value="通識" ${c.category === '通識' ? 'selected' : ''}>通識</option>
                    <option value="體育" ${c.category === '體育' ? 'selected' : ''}>體育</option>
                    <option value="其他" ${c.category === '其他' ? 'selected' : ''}>其他</option>
                </select>
            </td>
            <td>
                <input type="text" class="preview-input" value="${c.subcategory}" placeholder="無" onchange="updateTempItem(${index}, 'subcategory', this.value)" style="width: 100px; padding: 4px 8px; font-size: 0.85rem;">
            </td>
            <td>
                <select class="preview-input" onchange="updateTempItem(${index}, 'status', this.value)" style="padding: 4px 8px; font-size: 0.85rem; width: 100px;">
                    <option value="已完成" ${c.status === '已完成' ? 'selected' : ''}>已完成</option>
                    <option value="修習中" ${c.status === '修習中' ? 'selected' : ''}>修習中</option>
                    <option value="待修習" ${c.status === '待修習' ? 'selected' : ''}>待修習</option>
                </select>
            </td>
            <td>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeTempItem(${index})" style="padding: 4px 8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // 展開預覽區塊
    previewSection.style.display = 'block';
}

/**
 * 使用者在預覽表格中直接修改欄位值
 */
function updateTempItem(index, key, val) {
    if (parsedCoursesTemp[index]) {
        parsedCoursesTemp[index][key] = val;
        // 如果手動修改了成績，且大於等於 0，自動變更狀態為「已完成」
        if (key === 'grade' && val.trim() !== '') {
            parsedCoursesTemp[index]['status'] = '已完成';
            // 同步更新 UI 下拉選單
            const row = document.getElementById(`preview-row-${index}`);
            if (row) {
                const statusSelect = row.querySelector('select[onchange*="status"]');
                if (statusSelect) statusSelect.value = '已完成';
            }
        }
    }
}

/**
 * 從預覽清單中移除一筆課程
 */
function removeTempItem(index) {
    parsedCoursesTemp.splice(index, 1);
    renderPreviewTable();
    if (parsedCoursesTemp.length === 0) {
        document.getElementById('previewSection').style.display = 'none';
    }
}

/**
 * 發送 AJAX 請求，將預覽確認後的課程批次寫入後端 SQLite 資料庫
 */
function submitBatchImport() {
    if (parsedCoursesTemp.length === 0) {
        showToast('無任何課程資料可匯入！', 'warning');
        return;
    }

    const confirmBtn = document.getElementById('confirmImportBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerText = '正在匯入中...';

    // 發送 POST 請求給 Flask API
    fetch('/courses/api/import', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsedCoursesTemp)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showToast(data.message || '匯入成功！', 'success');
            // 匯入成功後，清除暫存並導向列表頁
            setTimeout(() => {
                window.location.href = '/courses/list';
            }, 1500);
        } else {
            showToast(data.message || '批次匯入失敗！', 'danger');
            confirmBtn.disabled = false;
            confirmBtn.innerText = '確認匯入';
        }
    })
    .catch(error => {
        console.error('Error importing batch:', error);
        showToast('連線伺服器失敗，請稍後再試。', 'danger');
        confirmBtn.disabled = false;
        confirmBtn.innerText = '確認匯入';
    });
}
