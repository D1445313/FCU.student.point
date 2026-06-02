from app.models.db import get_db_connection
import sqlite3

class Course:
    @staticmethod
    def create(data):
        """
        新增單筆課程資料
        :param data: dict，包含 semester, course_name, credits, grade, category, subcategory, status
        :return: 新增紀錄的 ID
        """
        db = get_db_connection()
        cursor = db.cursor()
        
        # 欄位格式處理與預設值
        semester = data.get('semester')
        course_name = data.get('course_name')
        credits = int(data.get('credits'))
        grade = data.get('grade')
        if grade == '' or grade is None:
            grade = None
        category = data.get('category')
        subcategory = data.get('subcategory', '') or ''
        status = data.get('status', '已完成')
        
        cursor.execute(
            '''
            INSERT INTO courses (semester, course_name, credits, grade, category, subcategory, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (semester, course_name, credits, grade, category, subcategory, status)
        )
        db.commit()
        return cursor.lastrowid

    @staticmethod
    def get_all(filters=None):
        """
        取得課程清單，支援依學期、類別、修課狀態、搜尋關鍵字進行篩選
        :param filters: dict，可包含 semester, category, status, search_query
        :return: list of dict
        """
        db = get_db_connection()
        query = 'SELECT * FROM courses WHERE 1=1'
        params = []
        
        if filters:
            if filters.get('semester'):
                query += ' AND semester = ?'
                params.append(filters['semester'])
            if filters.get('category'):
                query += ' AND category = ?'
                params.append(filters['category'])
            if filters.get('status'):
                query += ' AND status = ?'
                params.append(filters['status'])
            if filters.get('search_query'):
                query += ' AND (course_name LIKE ? OR subcategory LIKE ?)'
                params.append(f"%{filters['search_query']}%")
                params.append(f"%{filters['search_query']}%")
                
        # 依學期降序排列，同學期依類別、名稱升序排列
        query += ' ORDER BY semester DESC, category ASC, course_name ASC'
        
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def get_by_id(course_id):
        """
        根據課程 ID 取得單筆資料
        :param course_id: int
        :return: dict 或 None
        """
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute('SELECT * FROM courses WHERE id = ?', (course_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    @staticmethod
    def update(course_id, data):
        """
        更新單筆課程資料
        :param course_id: int
        :param data: dict，包含 semester, course_name, credits, grade, category, subcategory, status
        :return: bool 是否更新成功
        """
        db = get_db_connection()
        cursor = db.cursor()
        
        # 欄位格式處理與預設值
        semester = data.get('semester')
        course_name = data.get('course_name')
        credits = int(data.get('credits'))
        grade = data.get('grade')
        if grade == '' or grade is None:
            grade = None
        category = data.get('category')
        subcategory = data.get('subcategory', '') or ''
        status = data.get('status', '已完成')
        
        cursor.execute(
            '''
            UPDATE courses
            SET semester = ?, course_name = ?, credits = ?, grade = ?, category = ?, subcategory = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            ''',
            (semester, course_name, credits, grade, category, subcategory, status, course_id)
        )
        db.commit()
        return cursor.rowcount > 0

    @staticmethod
    def delete(course_id):
        """
        刪除單筆課程資料
        :param course_id: int
        :return: bool 是否刪除成功
        """
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute('DELETE FROM courses WHERE id = ?', (course_id,))
        db.commit()
        return cursor.rowcount > 0

    @staticmethod
    def import_batch(courses_list):
        """
        批次匯入多筆課程，使用 Transaction 交易保護機制
        :param courses_list: list of dict
        :return: int 成功匯入的筆數
        """
        db = get_db_connection()
        cursor = db.cursor()
        imported_count = 0
        
        try:
            # 開啟交易
            db.execute("BEGIN TRANSACTION;")
            for data in courses_list:
                semester = data.get('semester')
                course_name = data.get('course_name')
                credits = int(data.get('credits'))
                grade = data.get('grade')
                if grade == '' or grade is None:
                    grade = None
                category = data.get('category')
                subcategory = data.get('subcategory', '') or ''
                status = data.get('status', '已完成')
                
                cursor.execute(
                    '''
                    INSERT INTO courses (semester, course_name, credits, grade, category, subcategory, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (semester, course_name, credits, grade, category, subcategory, status)
                )
                imported_count += 1
            # 提交交易
            db.commit()
        except Exception as e:
            # 發生錯誤時回滾
            db.rollback()
            raise e
            
        return imported_count

    @staticmethod
    def get_unique_semesters():
        """
        取得目前所有已登錄課程的唯一學期清單
        :return: list of str (e.g. ['112-2', '112-1'])
        """
        db = get_db_connection()
        cursor = db.cursor()
        cursor.execute('SELECT DISTINCT semester FROM courses ORDER BY semester DESC')
        rows = cursor.fetchall()
        return [row['semester'] for row in rows]
