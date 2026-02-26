# Gestion des paramètres de la plateforme — stockage SQLite clé/valeur avec valeurs par défaut
import sqlite3
import json

DB_PATH = "settings.db"

DEFAULTS = {
    # Général
    "org_name": "Mon Organisation",
    "timezone": "America/Toronto",

    # Cluster
    "scan_mode": "manual",
    "scan_interval_seconds": 60,
    "watched_namespace": "default",

    # Incidents
    "auto_create_incidents": "false",
    "auto_create_min_severity": "high",
    "auto_assign": "false",

    # Slack
    "slack_enabled": "false",
    "slack_bot_token": "",
    "slack_default_channel": "#incidents",
    "slack_create_channel_per_incident": "true",

    # Équipe
    "oncall_members": "[]",
}

def init_settings_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    # Insère les valeurs par défaut si elles n'existent pas
    for key, value in DEFAULTS.items():
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, str(value))
        )
    conn.commit()
    conn.close()

def get_all_settings() -> dict:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT key, value FROM settings")
    rows = cursor.fetchall()
    conn.close()
    result = {}
    for key, value in rows:
        # On parse les JSON automatiquement
        try:
            result[key] = json.loads(value)
        except Exception:
            result[key] = value
    return result

def get_setting(key: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return DEFAULTS.get(key)
    try:
        return json.loads(row[0])
    except Exception:
        return row[0]

def update_settings(updates: dict):
    conn = sqlite3.connect(DB_PATH)
    for key, value in updates.items():
        if isinstance(value, bool):
            value = json.dumps(value)
        elif isinstance(value, (dict, list)):
            value = json.dumps(value)
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, str(value))
        )
    conn.commit()
    conn.close()
    return get_all_settings()

init_settings_db()