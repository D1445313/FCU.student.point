# 這是你為自動化試算引擎（F-03）撰寫的單元測試

def calculate_gpa(score):
    # 這裡模擬隊友的 GPA 轉換與計算邏輯
    if score >= 80: return 4.0
    elif score >= 60: return 3.0
    else: return 0.0

# --- 以下是你的測試案例（Test Cases） ---

# 1. 測試高分狀況（例如 90 分換算是否正確）
def test_high_score():
    assert calculate_gpa(90) == 4.0

# 2. 測試剛好 60 分及格的邊界狀況
def test_pass_score():
    assert calculate_gpa(60) == 3.0

# 3. 測試不及格分數的狀況
def test_failed_score():
    assert calculate_gpa(50) == 0.0

