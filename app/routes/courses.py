from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from app.models.course import Course
import re

courses_bp = Blueprint('courses', __name__)

@courses_bp.route('/input')
def input_page():
    """顯示手動錄入表單與批次匯入頁面"""
    semesters = Course.get_unique_semesters()
    return render_template('courses/input.html', semesters=semesters)

@courses_bp.route('/list')
def list_page():
    """顯示已登錄的課程清單，並支援條件過濾與搜尋"""
    # 取得搜尋與過濾參數
    filters = {
        'semester': request.args.get('semester', ''),
        'category': request.args.get('category', ''),
        'status': request.args.get('status', ''),
        'search_query': request.args.get('search_query', '').strip()
    }
    
    courses = Course.get_all(filters)
    semesters = Course.get_unique_semesters()
    
    return render_template(
        'courses/list.html',
        courses=courses,
        semesters=semesters,
        filters=filters
    )

@courses_bp.route('/add', methods=['POST'])
def add_course():
    """接收手動新增課程表單"""
    try:
        # 讀取表單欄位
        semester = request.form.get('semester', '').strip()
        course_name = request.form.get('course_name', '').strip()
        credits_raw = request.form.get('credits', '').strip()
        grade = request.form.get('grade', '').strip()
        category = request.form.get('category', '').strip()
        subcategory = request.form.get('subcategory', '').strip()
        status = request.form.get('status', '已完成').strip()
        
        # 1. 欄位基礎驗證
        if not semester or not course_name or not credits_raw or not category:
            flash("請填寫所有必填欄位！", "danger")
            return redirect(url_for('courses.input_page'))
            
        # 2. 驗證學期格式 (e.g., 112-1, 112-2)
        if not re.match(r'^\d{3}-[1-2]$', semester):
            flash("學期格式不正確！應如：112-1 或 112-2", "danger")
            return redirect(url_for('courses.input_page'))
            
        # 3. 驗證學分數為正整數
        try:
            credits = int(credits_raw)
            if credits <= 0:
                raise ValueError()
        except ValueError:
            flash("學分數必須為大於 0 的正整數！", "danger")
            return redirect(url_for('courses.input_page'))
            
        # 4. 驗證成績格式 (若已完成則可填寫分數，若為修習中或待修習應保留空白)
        if status == '已完成' and grade:
            # 判斷是否為 0-100 的數字，或等級制 A+ 至 F
            is_valid_grade = False
            try:
                score = float(grade)
                if 0 <= score <= 100:
                    is_valid_grade = True
            except ValueError:
                if grade.upper() in ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F']:
                    is_valid_grade = True
            if not is_valid_grade:
                flash("成績格式錯誤！應為 0-100 分數或等級制 (A+, B, C...)", "danger")
                return redirect(url_for('courses.input_page'))
                
        # 呼叫 Model 寫入資料
        Course.create({
            'semester': semester,
            'course_name': course_name,
            'credits': credits,
            'grade': grade,
            'category': category,
            'subcategory': subcategory,
            'status': status
        })
        
        flash(f"課程「{course_name}」新增成功！", "success")
        return redirect(url_for('courses.list_page'))
        
    except Exception as e:
        flash(f"新增課程時發生未知錯誤：{str(e)}", "danger")
        return redirect(url_for('courses.input_page'))

@courses_bp.route('/api/<int:course_id>', methods=['GET'])
def get_course_api(course_id):
    """API：取得單筆課程之 JSON (編輯 Modal 使用)"""
    course = Course.get_by_id(course_id)
    if course:
        return jsonify({'status': 'success', 'course': course})
    return jsonify({'status': 'error', 'message': '找不到該課程記錄'}), 404

@courses_bp.route('/update/<int:course_id>', methods=['POST'])
def update_course(course_id):
    """處理編輯修改課程請求"""
    try:
        semester = request.form.get('semester', '').strip()
        course_name = request.form.get('course_name', '').strip()
        credits_raw = request.form.get('credits', '').strip()
        grade = request.form.get('grade', '').strip()
        category = request.form.get('category', '').strip()
        subcategory = request.form.get('subcategory', '').strip()
        status = request.form.get('status', '已完成').strip()
        
        if not semester or not course_name or not credits_raw or not category:
            flash("請填寫所有必填欄位！", "danger")
            return redirect(url_for('courses.list_page'))
            
        try:
            credits = int(credits_raw)
            if credits <= 0:
                raise ValueError()
        except ValueError:
            flash("學分數必須為大於 0 的正整數！", "danger")
            return redirect(url_for('courses.list_page'))
            
        # 更新資料庫
        success = Course.update(course_id, {
            'semester': semester,
            'course_name': course_name,
            'credits': credits,
            'grade': grade,
            'category': category,
            'subcategory': subcategory,
            'status': status
        })
        
        if success:
            flash(f"課程「{course_name}」更新成功！", "success")
        else:
            flash("課程更新失敗，找不到該筆記錄", "warning")
            
        return redirect(url_for('courses.list_page'))
    except Exception as e:
        flash(f"更新課程時發生錯誤：{str(e)}", "danger")
        return redirect(url_for('courses.list_page'))

@courses_bp.route('/delete/<int:course_id>', methods=['POST'])
def delete_course(course_id):
    """處理刪除課程請求"""
    try:
        course = Course.get_by_id(course_id)
        course_name = course['course_name'] if course else ''
        success = Course.delete(course_id)
        if success:
            flash(f"課程「{course_name}」已成功刪除！", "success")
        else:
            flash("刪除失敗，找不到該課程", "warning")
    except Exception as e:
        flash(f"刪除課程時發生錯誤：{str(e)}", "danger")
        
    return redirect(url_for('courses.list_page'))

@courses_bp.route('/api/import', methods=['POST'])
def api_import_courses():
    """API：接收前端解析後的 JSON Array 進行批次匯入"""
    if not request.is_json:
        return jsonify({'status': 'error', 'message': '請發送 JSON 格式資料'}), 400
        
    courses_list = request.get_json()
    if not isinstance(courses_list, list):
        return jsonify({'status': 'error', 'message': 'JSON 必須為課程陣列'}), 400
        
    # 進行基本的格式校驗
    validated_list = []
    for index, raw_item in enumerate(courses_list):
        semester = str(raw_item.get('semester', '')).strip()
        course_name = str(raw_item.get('course_name', '')).strip()
        credits_raw = raw_item.get('credits')
        grade = str(raw_item.get('grade', '')).strip() if raw_item.get('grade') is not None else ''
        category = str(raw_item.get('category', '')).strip()
        subcategory = str(raw_item.get('subcategory', '')).strip()
        status = str(raw_item.get('status', '已完成')).strip()
        
        # 必填驗證
        if not semester or not course_name or credits_raw is None or not category:
            return jsonify({
                'status': 'error',
                'message': f'第 {index+1} 筆課程資料缺失必填欄位 (學期、課程、學分、類別)。'
            }), 400
            
        # 學分驗證
        try:
            credits = int(credits_raw)
            if credits <= 0: raise ValueError()
        except (ValueError, TypeError):
            return jsonify({
                'status': 'error',
                'message': f'第 {index+1} 筆課程「{course_name}」的學分數必須大於 0。'
            }), 400
            
        # 類別對齊，如果是 FCU 系統導出的類別名稱，對齊到主要分類
        # 必選修、通識領域對齊
        if '必' in category:
            category = '必修'
        elif '選' in category:
            category = '選修'
        elif '通' in category or '核心' in category or '領域' in category:
            category = '通識'
        elif '體' in category:
            category = '體育'
        else:
            category = '其他'
            
        validated_list.append({
            'semester': semester,
            'course_name': course_name,
            'credits': credits,
            'grade': grade,
            'category': category,
            'subcategory': subcategory,
            'status': status
        })
        
    if not validated_list:
        return jsonify({'status': 'error', 'message': '無可匯入的有效課程資料'}), 400
        
    try:
        imported_count = Course.import_batch(validated_list)
        return jsonify({
            'status': 'success',
            'message': f'成功批次匯入 {imported_count} 筆課程！',
            'imported': imported_count
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'寫入資料庫時發生錯誤：{str(e)}'
        }), 500

@courses_bp.route('/api/export', methods=['GET'])
def api_export_courses():
    """API：導出所有課程為 JSON，供前端 LocalStorage 備份與還原"""
    try:
        courses = Course.get_all()
        return jsonify({'status': 'success', 'courses': courses})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500
