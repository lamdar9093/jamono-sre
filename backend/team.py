# Gestion de l'équipe — membres, on-call actuel et rotations
import sqlite3
from datetime import datetime

DB_PATH = "team.db"

def init_team_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT,
            slack_username TEXT,
            role TEXT DEFAULT 'engineer',
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS oncall_schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            is_current INTEGER DEFAULT 0,
            FOREIGN KEY (member_id) REFERENCES members(id)
        )
    """)
    conn.commit()
    conn.close()

def add_member(name: str, email: str = None, slack_username: str = None, role: str = "engineer") -> dict:
    now = datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        INSERT INTO members (name, email, slack_username, role, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (name, email, slack_username, role, now))
    member_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_member(member_id)

def get_member(member_id: int) -> dict:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT * FROM members WHERE id = ?", (member_id,))
    row = cursor.fetchone()
    conn.close()
    return _row_to_dict(row) if row else None

def list_members() -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT * FROM members WHERE is_active = 1 ORDER BY name")
    rows = cursor.fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]

def delete_member(member_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE members SET is_active = 0 WHERE id = ?", (member_id,))
    conn.commit()
    conn.close()

def set_oncall(member_id: int, start_date: str, end_date: str):
    """Définit un membre comme on-call pour une période."""
    conn = sqlite3.connect(DB_PATH)
    # Désactiver l'ancien on-call
    conn.execute("UPDATE oncall_schedule SET is_current = 0")
    conn.execute("""
        INSERT INTO oncall_schedule (member_id, start_date, end_date, is_current)
        VALUES (?, ?, ?, 1)
    """, (member_id, start_date, end_date))
    conn.commit()
    conn.close()

def get_current_oncall() -> dict | None:
    """Retourne le membre actuellement on-call."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        SELECT m.* FROM members m
        JOIN oncall_schedule s ON m.id = s.member_id
        WHERE s.is_current = 1 AND m.is_active = 1
        LIMIT 1
    """)
    row = cursor.fetchone()
    conn.close()
    return _row_to_dict(row) if row else None

def _row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "name": row[1],
        "email": row[2],
        "slack_username": row[3],
        "role": row[4],
        "is_active": bool(row[5]),
        "created_at": row[6]
    }

init_team_db()