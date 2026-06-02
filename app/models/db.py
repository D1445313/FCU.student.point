import os
import sqlite3
from flask import g

# 定義 SQLite 資料庫的絕對路徑，確保不論在哪個目錄執行都能正確指向 instance/database.db
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATABASE_PATH = os.path.join(BASE_DIR, 'instance', 'database.db')

def get_db_connection():
    """取得 SQLite 資料庫連線，並快取在 Flask g 物件中"""
    if 'db' not in g:
        # 確保 instance 目錄存在
        instance_dir = os.path.dirname(DATABASE_PATH)
        if not os.path.exists(instance_dir):
            os.makedirs(instance_dir)
            
        g.db = sqlite3.connect(DATABASE_PATH)
        g.db.row_factory = sqlite3.Row
        # 開啟外鍵約束支援
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db

def close_db(e=None):
    """關閉目前請求的資料庫連線"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """從 schema.sql 初始化資料庫"""
    # 確保 instance 目錄存在
    instance_dir = os.path.dirname(DATABASE_PATH)
    if not os.path.exists(instance_dir):
        os.makedirs(instance_dir)
        
    db = sqlite3.connect(DATABASE_PATH)
    schema_path = os.path.join(os.path.dirname(__file__), 'schema.sql')
    
    with open(schema_path, 'r', encoding='utf-8') as f:
        db.executescript(f.read())
        
    db.commit()
    db.close()
    print("資料庫初始化完成！")
