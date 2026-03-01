from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    severity = Column(String(20), default="medium", index=True)
    status = Column(String(20), default="open", index=True)
    source = Column(String(20), default="manual")
    environment = Column(String(20), default="prod", index=True)
    linked_pod = Column(String(255))
    assigned_to = Column(String(255))
    created_by = Column(String(100), default="admin")
    slack_channel = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    resolved_at = Column(DateTime(timezone=True))
    watch_until = Column(DateTime(timezone=True))
    mttr_seconds = Column(Integer)

    timeline = relationship("TimelineEntry", back_populates="incident", cascade="all, delete-orphan", order_by="TimelineEntry.timestamp")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "status": self.status,
            "source": self.source,
            "environment": self.environment,
            "linked_pod": self.linked_pod,
            "assigned_to": self.assigned_to,
            "created_by": self.created_by,
            "slack_channel": self.slack_channel,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "watch_until": self.watch_until.isoformat() if self.watch_until else None,
            "mttr_seconds": self.mttr_seconds,
        }


class TimelineEntry(Base):
    __tablename__ = "incident_timeline"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    author = Column(String(100), default="admin")
    action = Column(String(100), nullable=False)
    detail = Column(Text)

    incident = relationship("Incident", back_populates="timeline")

    def to_dict(self):
        return {
            "id": self.id,
            "incident_id": self.incident_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "author": self.author,
            "action": self.action,
            "detail": self.detail,
        }


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    pod_name = Column(String(255), nullable=False)
    action_type = Column(String(100), nullable=False)
    change_before = Column(Text)
    change_after = Column(Text)
    approved_by = Column(String(100), default="admin")
    status = Column(String(20), default="pending")
    rollback_snapshot = Column(Text)  # JSON string

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "pod_name": self.pod_name,
            "action_type": self.action_type,
            "change_before": self.change_before,
            "change_after": self.change_after,
            "approved_by": self.approved_by,
            "status": self.status,
        }


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255))
    slack_username = Column(String(100))
    role = Column(String(50), default="engineer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    oncall_schedules = relationship("OncallSchedule", back_populates="member")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "slack_username": self.slack_username,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class OncallSchedule(Base):
    __tablename__ = "oncall_schedule"

    id = Column(Integer, primary_key=True, autoincrement=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    start_date = Column(String(20), nullable=False)
    end_date = Column(String(20), nullable=False)
    is_current = Column(Boolean, default=False)

    member = relationship("Member", back_populates="oncall_schedules")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)


# Index composites pour les queries fréquentes
Index("ix_incidents_status_env", Incident.status, Incident.environment)
Index("ix_incidents_watching", Incident.status, Incident.watch_until)