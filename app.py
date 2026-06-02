import os
from app import create_app
from app.models.db import init_db

app = create_app()

if __name__ == '__main__':
    # 檢查資料庫是否存在，若不存在則自動初始化
    db_path = os.path.join(app.instance_path, 'database.db')
    if not os.path.exists(db_path):
        print(f"找不到資料庫：{db_path}，正在自動初始化資料庫...")
        with app.app_context():
            init_db()
            
    # 啟動本地開發伺服器，預設為 debug 模式
    app.run(debug=True, host='127.0.0.1', port=5000)
