import os
import click
from flask import Flask
from app.models.db import close_db, init_db

def create_app():
    """建立並設定 Flask 應用程式"""
    app = Flask(__name__, instance_relative_config=True)
    
    # 基本設定 (使用環境變數或預設開發密鑰)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'fcu_student_point_dev_secret_key'),
    )
    
    # 確保 instance 資料夾存在
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # 註冊資料庫關閉勾子，確保每個請求結束時自動釋放連線
    app.teardown_appcontext(close_db)

    # 註冊 Blueprints
    from app.routes.main import main_bp
    from app.routes.courses import courses_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(courses_bp, url_prefix='/courses')

    # 注入輔助函式至 Jinja2 模板全域變數，供模板直接呼叫
    @app.context_processor
    def utility_processor():
        return dict(min=min, max=max, int=int)

    # 提供 Flask CLI 命令： flask init-db
    @app.cli.command('init-db')
    def init_db_command():
        """清除現有資料並重建資料表。"""
        init_db()
        click.echo('已初始化資料庫。')

    return app
