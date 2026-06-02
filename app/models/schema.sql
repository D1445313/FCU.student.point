-- 建立 courses 資料表
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    semester TEXT NOT NULL,
    course_name TEXT NOT NULL,
    credits INTEGER NOT NULL CHECK (credits > 0),
    grade TEXT,
    category TEXT NOT NULL CHECK (category IN ('必修', '選修', '通識', '體育', '其他')),
    subcategory TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '已完成' CHECK (status IN ('已完成', '修習中', '待修習')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引以加速搜尋與篩選
CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
