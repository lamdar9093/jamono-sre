# Système d'audit log — SQLAlchemy PostgreSQL
import json
from datetime import datetime
from database import SessionLocal
from models import AuditLog


def log_action(pod_name: str, action_type: str, change_before: str, change_after: str, rollback_snapshot: dict = None) -> int:
    db = SessionLocal()
    try:
        entry = AuditLog(
            timestamp=datetime.now(),
            pod_name=pod_name,
            action_type=action_type,
            change_before=change_before,
            change_after=change_after,
            rollback_snapshot=json.dumps(rollback_snapshot) if rollback_snapshot else None,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry.id
    finally:
        db.close()


def update_action_status(action_id: int, status: str):
    db = SessionLocal()
    try:
        db.query(AuditLog).filter(AuditLog.id == action_id).update({"status": status})
        db.commit()
    finally:
        db.close()


def get_audit_log(limit: int = 50) -> list:
    db = SessionLocal()
    try:
        entries = (
            db.query(AuditLog)
            .order_by(AuditLog.timestamp.desc())
            .limit(limit)
            .all()
        )
        return [e.to_dict() for e in entries]
    finally:
        db.close()


def get_rollback_snapshot(action_id: int):
    db = SessionLocal()
    try:
        entry = db.query(AuditLog).filter(AuditLog.id == action_id).first()
        if entry and entry.rollback_snapshot:
            return json.loads(entry.rollback_snapshot)
        return None
    finally:
        db.close()