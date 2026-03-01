# Gestion des paramètres — SQLAlchemy PostgreSQL (clé/valeur)
import json
from database import SessionLocal
from models import Setting

DEFAULTS = {
    "org_name": "Mon Organisation",
    "timezone": "America/Toronto",
    "scan_mode": "manual",
    "scan_interval_seconds": "60",
    "watched_namespace": "default",
    "auto_create_incidents": "false",
    "auto_create_min_severity": "high",
    "auto_assign": "false",
    "slack_enabled": "false",
    "slack_bot_token": "",
    "slack_default_channel": "#incidents",
    "slack_create_channel_per_incident": "true",
    "oncall_members": "[]",
}


def seed_defaults():
    """Insère les valeurs par défaut si elles n'existent pas."""
    db = SessionLocal()
    try:
        for key, value in DEFAULTS.items():
            exists = db.query(Setting).filter(Setting.key == key).first()
            if not exists:
                db.add(Setting(key=key, value=str(value)))
        db.commit()
    finally:
        db.close()


def get_all_settings() -> dict:
    db = SessionLocal()
    try:
        rows = db.query(Setting).all()
        result = {}
        for row in rows:
            try:
                result[row.key] = json.loads(row.value)
            except (json.JSONDecodeError, TypeError):
                result[row.key] = row.value
        return result
    finally:
        db.close()


def get_setting(key: str):
    db = SessionLocal()
    try:
        row = db.query(Setting).filter(Setting.key == key).first()
        if not row:
            return DEFAULTS.get(key)
        try:
            return json.loads(row.value)
        except (json.JSONDecodeError, TypeError):
            return row.value
    finally:
        db.close()


def update_settings(updates: dict) -> dict:
    db = SessionLocal()
    try:
        for key, value in updates.items():
            if isinstance(value, (bool, dict, list)):
                value = json.dumps(value)
            existing = db.query(Setting).filter(Setting.key == key).first()
            if existing:
                existing.value = str(value)
            else:
                db.add(Setting(key=key, value=str(value)))
        db.commit()
    finally:
        db.close()
    return get_all_settings()