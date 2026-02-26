# Système de gestion des incidents — modèle de données, CRUD et cycle de vie complet
import sqlite3
import json
from datetime import datetime

DB_PATH = "incidents.db"

def init_incidents_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            severity TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'open',
            source TEXT DEFAULT 'manual',
            environment TEXT DEFAULT 'prod',
            linked_pod TEXT,
            assigned_to TEXT,
            created_by TEXT DEFAULT 'admin',
            slack_channel TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            resolved_at TEXT,
            watch_until TEXT,
            mttr_seconds INTEGER
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS incident_timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incident_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            author TEXT DEFAULT 'admin',
            action TEXT NOT NULL,
            detail TEXT,
            FOREIGN KEY (incident_id) REFERENCES incidents(id)
        )
    """)
    conn.commit()
    conn.close()

def create_incident(
    title: str,
    description: str = None,
    severity: str = "medium",
    source: str = "manual",
    environment: str = "prod",
    linked_pod: str = None,
    assigned_to: str = None,
    created_by: str = "admin",
    watch_minutes: int = None
) -> dict:
    now = datetime.now().isoformat()
    watch_until = None
    status = "open"

    if source == "watch" and watch_minutes:
        from datetime import timedelta
        watch_until = (datetime.now() + timedelta(minutes=watch_minutes)).isoformat()
        status = "watching"

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        INSERT INTO incidents 
        (title, description, severity, status, source, environment, linked_pod, assigned_to, created_by, created_at, updated_at, watch_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (title, description, severity, status, source, environment, linked_pod, assigned_to, created_by, now, now, watch_until))
    
    incident_id = cursor.lastrowid
    
    # Timeline : entrée initiale
    conn.execute("""
        INSERT INTO incident_timeline (incident_id, timestamp, author, action, detail)
        VALUES (?, ?, ?, ?, ?)
    """, (incident_id, now, created_by, "created", f"Incident créé via {source}"))
    
    conn.commit()
    conn.close()
    
    return get_incident(incident_id)

def get_incident(incident_id: int) -> dict:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return _row_to_dict(row)

def list_incidents(status: str = None, environment: str = None) -> list:
    conn = sqlite3.connect(DB_PATH)
    query = "SELECT * FROM incidents"
    params = []
    conditions = []
    
    if status:
        conditions.append("status = ?")
        params.append(status)
    if environment:
        conditions.append("environment = ?")
        params.append(environment)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY created_at DESC"
    cursor = conn.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [_row_to_dict(r) for r in rows]

def update_incident_status(incident_id: int, new_status: str, author: str = "admin", detail: str = None) -> dict:
    now = datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    
    resolved_at = now if new_status == "resolved" else None
    
    # Calcul MTTR si résolution
    mttr = None
    if new_status == "resolved":
        cursor = conn.execute("SELECT created_at FROM incidents WHERE id = ?", (incident_id,))
        row = cursor.fetchone()
        if row:
            created = datetime.fromisoformat(row[0])
            mttr = int((datetime.now() - created).total_seconds())
    
    conn.execute("""
        UPDATE incidents 
        SET status = ?, updated_at = ?, resolved_at = ?, mttr_seconds = ?
        WHERE id = ?
    """, (new_status, now, resolved_at, mttr, incident_id))
    
    conn.execute("""
        INSERT INTO incident_timeline (incident_id, timestamp, author, action, detail)
        VALUES (?, ?, ?, ?, ?)
    """, (incident_id, now, author, f"status_changed_to_{new_status}", detail or f"Statut changé → {new_status}"))
    
    conn.commit()
    conn.close()
    return get_incident(incident_id)

def add_timeline_entry(incident_id: int, action: str, detail: str, author: str = "admin"):
    now = datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO incident_timeline (incident_id, timestamp, author, action, detail)
        VALUES (?, ?, ?, ?, ?)
    """, (incident_id, now, author, action, detail))
    conn.execute("UPDATE incidents SET updated_at = ? WHERE id = ?", (now, incident_id))
    conn.commit()
    conn.close()

def get_timeline(incident_id: int) -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        SELECT * FROM incident_timeline 
        WHERE incident_id = ? 
        ORDER BY timestamp ASC
    """, (incident_id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "incident_id": r[1],
            "timestamp": r[2],
            "author": r[3],
            "action": r[4],
            "detail": r[5]
        }
        for r in rows
    ]

def check_watch_incidents():
    """Vérifie les incidents en mode watch — les convertit en open si le timer est expiré"""
    now = datetime.now().isoformat()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        SELECT id FROM incidents 
        WHERE status = 'watching' AND watch_until <= ?
    """, (now,))
    expired = cursor.fetchall()
    conn.close()
    
    for (incident_id,) in expired:
        update_incident_status(incident_id, "open", author="system", detail="Timer de surveillance expiré — incident ouvert automatiquement")
    
    return len(expired)

def get_mttr_stats() -> dict:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
            AVG(CASE WHEN mttr_seconds IS NOT NULL THEN mttr_seconds END) as avg_mttr,
            MIN(mttr_seconds) as min_mttr,
            MAX(mttr_seconds) as max_mttr
        FROM incidents
    """)
    row = cursor.fetchone()
    conn.close()
    return {
        "total": row[0],
        "resolved": row[1],
        "avg_mttr_seconds": int(row[2]) if row[2] else 0,
        "min_mttr_seconds": row[3] or 0,
        "max_mttr_seconds": row[4] or 0
    }

def _row_to_dict(row) -> dict:
    return {
        "id": row[0],
        "title": row[1],
        "description": row[2],
        "severity": row[3],
        "status": row[4],
        "source": row[5],
        "environment": row[6],
        "linked_pod": row[7],
        "assigned_to": row[8],
        "created_by": row[9],
        "slack_channel": row[10],
        "created_at": row[11],
        "updated_at": row[12],
        "resolved_at": row[13],
        "watch_until": row[14],
        "mttr_seconds": row[15]
    }

# Init au démarrage
init_incidents_db()

def update_slack_channel(incident_id: int, channel_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE incidents SET slack_channel = ? WHERE id = ?", (channel_id, incident_id))
    conn.commit()
    conn.close()