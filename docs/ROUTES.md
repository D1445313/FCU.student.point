# 逢甲大學學業進度與時間管理整合系統 - 路由與頁面設計文件 (ROUTES)

本文件詳細列出系統中所有路由路徑、對應的 HTTP 方法、接受的參數、渲染的模板及業務處理邏輯。

## 1. 路由總覽表格

| 功能名稱 | HTTP 方法 | URL 路徑 | 對應 HTML 模板 | 說明 |
| :--- | :--- | :--- | :--- | :--- |
| **儀表板首頁** | GET | `/` | `index.html` | 系統入口首頁，展示已錄入學分進度統計 |
| **學分錄入頁面** | GET | `/courses/input` | `courses/input.html` | 顯示手動錄入表單與批次上傳/文字貼上解析區 |
| **手動新增課程** | POST | `/courses/add` | — | 接收並驗證表單資料，寫入資料庫後重導向 |
| **課程列表頁面** | GET | `/courses/list` | `courses/list.html` | 顯示所有已錄入課程，支援搜尋與分類篩選 |
| **取得單筆課程 (API)**| GET | `/api/courses/<id>` | — | 回傳該課程的 JSON 資料（供前端編輯 Modal 填寫用）|
| **更新課程** | POST | `/courses/<id>/update` | — | 接收並驗證修改後的表單資料，更新 DB 後重導向 |
| **刪除課程** | POST | `/courses/<id>/delete` | — | 從資料庫刪除指定課程後重導向 |
| **批次匯入課程 (API)**| POST | `/api/courses/import` | — | 接收前端解析完的 JSON Array，批次寫入資料庫 |
| **匯出備份 (API)** | GET | `/api/courses/export` | — | 回傳全站課程的 JSON 資料，供本地備份下載 |

---

## 2. 路由詳細說明

### 2.1 GET `/` (首頁儀表板)
* **輸入**：無。
* **處理邏輯**：
  - 呼叫 `Course.get_all()` 獲取所有已修課程。
  - 計算：總學分、必修總學分、選修總學分、通識總學分、平均分數（GPA）。
  - 將統計資料傳遞給 `index.html` 進行渲染。
* **輸出**：渲染 `index.html`。

### 2.2 GET `/courses/input` (錄入表單頁)
* **輸入**：無。
* **處理邏輯**：直接傳遞預設學期值（如 `112-1` 等）供表單渲染。
* **輸出**：渲染 `courses/input.html`。

### 2.3 POST `/courses/add` (手動新增課程)
* **輸入**：表單欄位 `semester` (字串)、`course_name` (字串)、`credits` (整數)、`grade` (字串，可為空)、`category` (必修/選修/通識/體育/其他)、`subcategory` (字串，可為空)、`status` (已完成/修習中/待修習)。
* **處理邏輯**：
  - 後端驗證：`course_name` 不得為空，`credits` 必須大於 0 的整數，`grade` 若非空需在 0-100 之間（或為有效等級制如 A+, A 等）。
  - 呼叫 `Course.create(data)`。
  - 成功：在 Flask Session 中寫入成功 message (`flash("新增成功！")`)，重導向至 `/courses/list`。
  - 失敗：`flash("欄位驗證失敗！")`，重導向至 `/courses/input`。
* **輸出**：重導向。

### 2.4 GET `/courses/list` (課程列表頁)
* **輸入**：查詢參數（可選）`semester`、`category`、`status`、`search_query`。
* **處理邏輯**：
  - 根據查詢參數組合過濾條件。
  - 呼叫 `Course.get_all(filters)`。
* **輸出**：將過濾後的課程清單與目前篩選條件傳入 `courses/list.html` 渲染。

### 2.5 POST `/courses/<id>/update` (修改課程)
* **輸入**：URL 參數 `id`，表單欄位同新增。
* **處理邏輯**：
  - 後端驗證資料合法性。
  - 呼叫 `Course.update(id, data)`。
  - 成功：`flash("課程更新成功！")`，重導向至 `/courses/list`。
* **輸出**：重導向。

### 2.6 POST `/courses/<id>/delete` (刪除課程)
* **輸入**：URL 參數 `id`。
* **處理邏輯**：
  - 呼叫 `Course.delete(id)`。
  - 成功：`flash("課程已刪除")`。
* **輸出**：重導向至 `/courses/list`。

### 2.7 POST `/api/courses/import` (AJAX 批次匯入)
* **輸入**：JSON 請求 Body，為 Course 物件陣列。
* **處理邏輯**：
  - 檢查 Content-Type 是否為 `application/json`。
  - 驗證陣列中每筆資料欄位。
  - 呼叫 `Course.import_batch(courses_list)`。
* **輸出**：JSON `{ "status": "success", "imported": N }`，錯誤時回傳 `{ "status": "error", "message": "錯誤原因" }` 配合 HTTP 400。

---

## 3. Jinja2 模板清單

* `base.html`：包含 HTML5 宣告、`<head>`（加載 Google 字型、自訂 CSS）、側邊導覽列（首頁、學分錄入、課程列表）、閃現訊息區塊、`{% block content %}`。
* `index.html`：繼承 `base.html`，以大卡片（Card）與進度條（Progress Bar）顯示學分完成度與 GPA，為學分預警提供精美 mock 視覺（如總學分 128 分之已修比例）。
* `courses/input.html`：繼承 `base.html`，左側為手動新增課程表單，右側為批次匯入卡片（支援拖曳 CSV 上傳、大區塊文字貼上解析），底部為解析預覽表格（帶有確認匯入按鈕）。
* `courses/list.html`：繼承 `base.html`，頂部為篩選區（學期下拉選單、類別下拉選單、狀態下拉選單、關鍵字搜尋框），主體為課程卡片與表格清單，內嵌編輯對話框 (Modal)。
