/* ==========================================================================
   逢甲大學學業進度與時間管理整合系統 - 全站共用 JS 互動腳本
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化 Flash 訊息 (如有)
    const flashMessages = document.querySelectorAll('.flash-message-data');
    flashMessages.forEach(msg => {
        const text = msg.getAttribute('data-message');
        const type = msg.getAttribute('data-category') || 'info';
        // 對齊 Bootstrap 警告類型與我們的 Toast 樣式
        let toastType = 'info';
        if (type.includes('success')) toastType = 'success';
        if (type.includes('danger') || type.includes('error')) toastType = 'danger';
        if (type.includes('warning')) toastType = 'warning';
        
        showToast(text, toastType);
    });

    // 2. 自動監聽關閉 Modal 的點擊事件
    const backdrop = document.getElementById('editModalBackdrop');
    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeEditModal();
            }
        });
    }
});

/**
 * 顯示自訂磨砂玻璃 Toast 提示訊息
 * @param {string} message - 提示文字內容
 * @param {string} type - 提示類型：'success' | 'danger' | 'warning' | 'info'
 */
function showToast(message, type = 'info') {
    // 取得或建立 Toast 容器
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    // 建立 Toast 元素
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // 依據類型選用 SVG 圖示
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    } else if (type === 'danger') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
    } else {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
    }

    toast.innerHTML = `
        ${iconSvg}
        <span style="font-weight: 500;">${message}</span>
    `;

    container.appendChild(toast);

    // 4 秒後自動淡出移除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

/**
 * 開啟課程編輯彈窗，並透過 API 載入資料
 * @param {number} courseId - 課程記錄之 ID
 */
function openEditModal(courseId) {
    const backdrop = document.getElementById('editModalBackdrop');
    if (!backdrop) return;

    // 發送 API 請求取得單筆資料
    fetch(`/courses/api/${courseId}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                const c = data.course;
                
                // 填充表單欄位
                document.getElementById('edit_course_id').value = c.id;
                document.getElementById('edit_semester').value = c.semester;
                document.getElementById('edit_course_name').value = c.course_name;
                document.getElementById('edit_credits').value = c.credits;
                document.getElementById('edit_grade').value = c.grade || '';
                document.getElementById('edit_category').value = c.category;
                document.getElementById('edit_subcategory').value = c.subcategory || '';
                document.getElementById('edit_status').value = c.status;
                
                // 動態修改表單 Action URL
                document.getElementById('editCourseForm').action = `/courses/update/${c.id}`;

                // 顯示 Modal
                backdrop.classList.add('active');
            } else {
                showToast(data.message || '無法讀取課程資料', 'danger');
            }
        })
        .catch(error => {
            console.error('Error fetching course:', error);
            showToast('連線伺服器失敗，請稍後再試', 'danger');
        });
}

/**
 * 關閉課程編輯彈窗
 */
function closeEditModal() {
    const backdrop = document.getElementById('editModalBackdrop');
    if (backdrop) {
        backdrop.classList.remove('active');
    }
}
