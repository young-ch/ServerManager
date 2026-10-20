import sqlite3
import os
from database import DB_PATH, init_db

def clear_all_sample_data():
    """샘플 데이터를 초기화하고 빈 상태의 깨끗한 데이터베이스를 만듭니다."""
    if not os.path.exists(DB_PATH):
        init_db()
        print("[완료] 새로운 빈 데이터베이스가 생성되었습니다.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM alert_logs;")
    cursor.execute("DELETE FROM metrics_history;")
    cursor.execute("DELETE FROM server_ports;")
    cursor.execute("DELETE FROM servers;")
    
    # SQLite autoincrement sequence reset
    cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('servers', 'server_ports', 'metrics_history', 'alert_logs');")
    
    conn.commit()
    conn.close()
    
    print("========================================================")
    print(" [OpsPulse] 초기 샘플 데이터가 모두 삭제되었습니다.")
    print(" 이제 웹 대시보드에서 실제 서버를 자유롭게 등록하세요!")
    print("========================================================")

if __name__ == "__main__":
    clear_all_sample_data()
