from flask import Blueprint, render_template
from app.models.course import Course

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """儀表板首頁路由，計算學分加總與 GPA，並傳送至前端渲染"""
    courses = Course.get_all()
    
    # 統計變數
    completed_credits = 0
    taking_credits = 0
    planned_credits = 0
    
    cat_credits = {
        '必修': 0,
        '選修': 0,
        '通識': 0,
        '體育': 0,
        '其他': 0
    }
    
    # GPA 計算相關
    total_gpa_points = 0.0
    gpa_applicable_credits = 0
    total_score_points = 0.0
    score_applicable_credits = 0
    
    for c in courses:
        creds = c['credits']
        status = c['status']
        cat = c['category']
        grade = c['grade']
        
        # 1. 學分狀態統計
        if status == '已完成':
            completed_credits += creds
            if cat in cat_credits:
                cat_credits[cat] += creds
        elif status == '修習中':
            taking_credits += creds
        elif status == '待修習':
            planned_credits += creds
            
        # 2. GPA 與分數計算 (僅計算「已完成」且「有成績」的課程)
        if status == '已完成' and grade:
            # 嘗試轉換為百分制分數
            score = None
            try:
                score = float(grade)
            except ValueError:
                # 若為字母等第 (A+, A 等)
                pass
                
            gpa_point = None
            if score is not None:
                # 百分制轉 GPA (4.3 點數制)
                if 90 <= score <= 100: gpa_point = 4.3
                elif 85 <= score < 90: gpa_point = 4.0
                elif 80 <= score < 85: gpa_point = 3.7
                elif 77 <= score < 80: gpa_point = 3.3
                elif 73 <= score < 77: gpa_point = 3.0
                elif 70 <= score < 73: gpa_point = 2.7
                elif 67 <= score < 70: gpa_point = 2.3
                elif 63 <= score < 67: gpa_point = 2.0
                elif 60 <= score < 63: gpa_point = 1.7
                elif 50 <= score < 60: gpa_point = 1.0
                else: gpa_point = 0.0
                
                # 計算加權平均分數
                total_score_points += score * creds
                score_applicable_credits += creds
            else:
                # 等級制轉 GPA
                grade_upper = str(grade).strip().upper()
                grade_map = {
                    'A+': 4.3, 'A': 4.0, 'A-': 3.7,
                    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
                    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
                    'D': 1.0, 'F': 0.0
                }
                if grade_upper in grade_map:
                    gpa_point = grade_map[grade_upper]
            
            # 若取得有效 GPA 權重，則計算加權 GPA
            if gpa_point is not None:
                total_gpa_points += gpa_point * creds
                gpa_applicable_credits += creds

    # 平均分數與 GPA
    avg_score = round(total_score_points / score_applicable_credits, 2) if score_applicable_credits > 0 else 0.0
    avg_gpa = round(total_gpa_points / gpa_applicable_credits, 2) if gpa_applicable_credits > 0 else 0.0

    # 模擬畢業門檻 (配合 F-02 的預設值)
    requirements = {
        '總學分': {'required': 128, 'current': completed_credits},
        '必修': {'required': 60, 'current': cat_credits['必修']},
        '選修': {'required': 40, 'current': cat_credits['選修']},
        '通識': {'required': 20, 'current': cat_credits['通識']},
        '體育': {'required': 4, 'current': cat_credits['體育']},
        '其他': {'required': 4, 'current': cat_credits['其他']}
    }

    # 計算畢業達成百分比
    completion_rate = min(int((completed_credits / 128) * 100), 100) if completed_credits > 0 else 0

    return render_template(
        'index.html',
        courses=courses,
        completed_credits=completed_credits,
        taking_credits=taking_credits,
        planned_credits=planned_credits,
        cat_credits=cat_credits,
        avg_score=avg_score,
        avg_gpa=avg_gpa,
        requirements=requirements,
        completion_rate=completion_rate
    )
