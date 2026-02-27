# Système d'audit log — enregistre chaque action de remédiation avec son contexte complet
import sqlite3
import json
from datetime import datetime

DB_PATH = "data/audit.db"

def init_audit_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            pod_name TEXT NOT NULL,
            action_type TEXT NOT NULL,
            change_before TEXT,
            change_after TEXT,
            approved_by TEXT DEFAULT 'admin',
            status TEXT DEFAULT 'pending',
            rollback_snapshot TEXT
        )
    """)
    conn.commit()
    conn.close()

def log_action(pod_name: str, action_type: str, change_before: str, change_after: str, rollback_snapshot: dict = None) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        INSERT INTO audit_log (timestamp, pod_name, action_type, change_before, change_after, rollback_snapshot)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        datetime.now().isoformat(),
        pod_name,
        action_type,
        change_before,
        change_after,
        json.dumps(rollback_snapshot) if rollback_snapshot else None
    ))
    action_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return action_id

def update_action_status(action_id: int, status: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE audit_log SET status = ? WHERE id = ?", (status, action_id))
    conn.commit()
    conn.close()

def get_audit_log(limit: int = 50):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        SELECT id, timestamp, pod_name, action_type, change_before, change_after, approved_by, status
        FROM audit_log ORDER BY timestamp DESC LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "timestamp": r[1],
            "pod_name": r[2],
            "action_type": r[3],
            "change_before": r[4],
            "change_after": r[5],
            "approved_by": r[6],
            "status": r[7]
        }
        for r in rows
    ]

def get_rollback_snapshot(action_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT rollback_snapshot FROM audit_log WHERE id = ?", (action_id,))
    row = cursor.fetchone()
    conn.close()
    if row and row[0]:
        return json.loads(row[0])
    return None

# Init au démarrage
init_audit_db()