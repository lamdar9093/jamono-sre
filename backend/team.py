# Gestion de l'équipe — SQLAlchemy PostgreSQL
from datetime import datetime
from database import SessionLocal
from models import Member, OncallSchedule


def add_member(name: str, email: str = None, slack_username: str = None, role: str = "engineer") -> dict:
    db = SessionLocal()
    try:
        member = Member(
            name=name,
            email=email,
            slack_username=slack_username,
            role=role,
            created_at=datetime.now(),
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        return member.to_dict()
    finally:
        db.close()


def get_member(member_id: int) -> dict | None:
    db = SessionLocal()
    try:
        m = db.query(Member).filter(Member.id == member_id).first()
        return m.to_dict() if m else None
    finally:
        db.close()


def list_members() -> list:
    db = SessionLocal()
    try:
        members = (
            db.query(Member)
            .filter(Member.is_active == True)
            .order_by(Member.name)
            .all()
        )
        return [m.to_dict() for m in members]
    finally:
        db.close()


def delete_member(member_id: int):
    db = SessionLocal()
    try:
        db.query(Member).filter(Member.id == member_id).update({"is_active": False})
        db.commit()
    finally:
        db.close()


def set_oncall(member_id: int, start_date: str, end_date: str):
    db = SessionLocal()
    try:
        # Désactiver l'ancien on-call
        db.query(OncallSchedule).update({"is_current": False})
        schedule = OncallSchedule(
            member_id=member_id,
            start_date=start_date,
            end_date=end_date,
            is_current=True,
        )
        db.add(schedule)
        db.commit()
    finally:
        db.close()


def get_current_oncall() -> dict | None:
    db = SessionLocal()
    try:
        schedule = (
            db.query(OncallSchedule)
            .filter(OncallSchedule.is_current == True)
            .first()
        )
        if not schedule:
            return None
        member = (
            db.query(Member)
            .filter(Member.id == schedule.member_id, Member.is_active == True)
            .first()
        )
        return member.to_dict() if member else None
    finally:
        db.close()