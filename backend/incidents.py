# Système de gestion des incidents — SQLAlchemy PostgreSQL
from datetime import datetime, timedelta
from sqlalchemy import func, and_
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Incident, TimelineEntry


def create_incident(
    title: str,
    description: str = None,
    severity: str = "medium",
    source: str = "manual",
    environment: str = "prod",
    linked_pod: str = None,
    assigned_to: str = None,
    created_by: str = "admin",
    watch_minutes: int = None,
) -> dict:
    db = SessionLocal()
    try:
        now = datetime.now()
        status = "open"
        watch_until = None

        if source == "watch" and watch_minutes:
            watch_until = now + timedelta(minutes=watch_minutes)
            status = "watching"

        incident = Incident(
            title=title,
            description=description,
            severity=severity,
            status=status,
            source=source,
            environment=environment,
            linked_pod=linked_pod,
            assigned_to=assigned_to,
            created_by=created_by,
            created_at=now,
            updated_at=now,
            watch_until=watch_until,
        )
        db.add(incident)
        db.flush()

        entry = TimelineEntry(
            incident_id=incident.id,
            timestamp=now,
            author=created_by,
            action="created",
            detail=f"Incident créé via {source}",
        )
        db.add(entry)
        db.commit()
        db.refresh(incident)
        return incident.to_dict()
    finally:
        db.close()


def get_incident(incident_id: int) -> dict | None:
    db = SessionLocal()
    try:
        inc = db.query(Incident).filter(Incident.id == incident_id).first()
        return inc.to_dict() if inc else None
    finally:
        db.close()


def list_incidents(status: str = None, environment: str = None) -> list:
    db = SessionLocal()
    try:
        q = db.query(Incident)
        if status:
            q = q.filter(Incident.status == status)
        if environment:
            q = q.filter(Incident.environment == environment)
        q = q.order_by(Incident.created_at.desc())
        return [i.to_dict() for i in q.all()]
    finally:
        db.close()


def update_incident_status(incident_id: int, new_status: str, author: str = "admin", detail: str = None) -> dict:
    db = SessionLocal()
    try:
        inc = db.query(Incident).filter(Incident.id == incident_id).first()
        if not inc:
            return None

        now = datetime.now()
        inc.status = new_status
        inc.updated_at = now

        if new_status == "resolved":
            inc.resolved_at = now
            if inc.created_at:
                inc.mttr_seconds = int((now - inc.created_at).total_seconds())

        entry = TimelineEntry(
            incident_id=incident_id,
            timestamp=now,
            author=author,
            action=f"status_changed_to_{new_status}",
            detail=detail or f"Statut changé → {new_status}",
        )
        db.add(entry)
        db.commit()
        db.refresh(inc)
        return inc.to_dict()
    finally:
        db.close()


def update_incident_assignment(incident_id: int, assigned_to: str, author: str = "admin"):
    """Met à jour l'assignation d'un incident et ajoute un événement timeline."""
    db = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            raise ValueError("Incident introuvable")
        
        old_assignee = incident.assigned_to
        incident.assigned_to = assigned_to
        incident.updated_at = datetime.now()
        
        # Si l'incident était "open", le passer "in_progress"
        if incident.status == "open":
            incident.status = "in_progress"
        
        # Timeline
        timeline_entry = IncidentTimeline(
            incident_id=incident_id,
            action="assigned",
            author=author,
            detail=f"{assigned_to} a pris en charge l'incident" + (f" (était: {old_assignee})" if old_assignee else ""),
            timestamp=datetime.now(),
        )
        db.add(timeline_entry)
        db.commit()
        
        return incident.to_dict() if hasattr(incident, 'to_dict') else {"id": incident.id, "assigned_to": assigned_to}
    finally:
        db.close()


def add_timeline_entry(incident_id: int, action: str, detail: str, author: str = "admin"):
    db = SessionLocal()
    try:
        now = datetime.now()
        entry = TimelineEntry(
            incident_id=incident_id,
            timestamp=now,
            author=author,
            action=action,
            detail=detail,
        )
        db.add(entry)
        db.query(Incident).filter(Incident.id == incident_id).update({"updated_at": now})
        db.commit()
    finally:
        db.close()


def get_timeline(incident_id: int) -> list:
    db = SessionLocal()
    try:
        entries = (
            db.query(TimelineEntry)
            .filter(TimelineEntry.incident_id == incident_id)
            .order_by(TimelineEntry.timestamp.asc())
            .all()
        )
        return [e.to_dict() for e in entries]
    finally:
        db.close()


def check_watch_incidents() -> int:
    """Convertit les incidents watching expirés en open."""
    db = SessionLocal()
    try:
        now = datetime.now()
        expired = (
            db.query(Incident)
            .filter(and_(Incident.status == "watching", Incident.watch_until <= now))
            .all()
        )
        for inc in expired:
            inc.status = "open"
            inc.updated_at = now
            entry = TimelineEntry(
                incident_id=inc.id,
                timestamp=now,
                author="system",
                action="status_changed_to_open",
                detail="Timer de surveillance expiré — incident ouvert automatiquement",
            )
            db.add(entry)
        db.commit()
        return len(expired)
    finally:
        db.close()


def get_mttr_stats() -> dict:
    db = SessionLocal()
    try:
        total = db.query(func.count(Incident.id)).scalar() or 0
        resolved = db.query(func.count(Incident.id)).filter(Incident.status == "resolved").scalar() or 0
        avg_mttr = db.query(func.avg(Incident.mttr_seconds)).filter(Incident.mttr_seconds.isnot(None)).scalar()
        min_mttr = db.query(func.min(Incident.mttr_seconds)).filter(Incident.mttr_seconds.isnot(None)).scalar()
        max_mttr = db.query(func.max(Incident.mttr_seconds)).filter(Incident.mttr_seconds.isnot(None)).scalar()
        return {
            "total": total,
            "resolved": resolved,
            "avg_mttr_seconds": int(avg_mttr) if avg_mttr else 0,
            "min_mttr_seconds": min_mttr or 0,
            "max_mttr_seconds": max_mttr or 0,
        }
    finally:
        db.close()


def update_slack_channel(incident_id: int, channel_id: str):
    db = SessionLocal()
    try:
        db.query(Incident).filter(Incident.id == incident_id).update({"slack_channel": channel_id})
        db.commit()
    finally:
        db.close()
