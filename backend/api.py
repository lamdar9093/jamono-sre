from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse as _JSONResponse

class JSONResponse(_JSONResponse):
    def render(self, content) -> bytes:
        import json
        return json.dumps(content, ensure_ascii=False).encode("utf-8")
from pydantic import BaseModel
from typing import Optional
import uuid
import re
import json
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from main import run_sre_system
from database import engine, Base
from models import *  # noqa — register all models
from audit import log_action, update_action_status, get_audit_log, get_rollback_snapshot
from incidents import (
    create_incident, get_incident, list_incidents,
    update_incident_status, add_timeline_entry,
    get_timeline, check_watch_incidents, get_mttr_stats, update_slack_channel
)
from settings import get_all_settings, get_setting, update_settings, seed_defaults
from monitor import start_auto_monitor, run_scan_and_create_incidents
from slack_service import (
    create_incident_channel, post_incident_briefing,
    post_status_update, handle_slack_event, get_slack_client
)
from team import add_member, list_members, delete_member, set_oncall, get_current_oncall
from utils.k8s_handler import is_k8s_available
from integrations import (
    init_registry, list_integrations, get_integration, connect_integration,
    disconnect_integration, delete_integration, test_integration,
    dispatch_incident_created, dispatch_incident_updated,
    create_ticket_manual, get_incident_links, handle_integration_webhook,
)
from integrations.registry import IntegrationRegistry

# ── Notifications helper ──
def create_notification(type: str, title: str, detail: str = None, link: str = None):
    """Crée une notification en DB."""
    from database import SessionLocal
    from models import Notification
    try:
        db = SessionLocal()
        notif = Notification(type=type, title=title, detail=detail, link=link)
        db.add(notif)
        db.commit()
        db.close()
    except Exception as e:
        print(f"⚠️  [NOTIF] Erreur: {e}")

# ── Lifespan ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Créer les tables si elles n'existent pas (dev). En prod → Alembic.
    Base.metadata.create_all(bind=engine)
    seed_defaults()
    init_registry()
    print("✅ [DB] Tables créées / vérifiées")

    asyncio.create_task(start_auto_monitor())
    asyncio.create_task(_watch_incidents_loop())
    yield

async def _watch_incidents_loop():
    """Vérifie les incidents watching expirés."""
    while True:
        try:
            expired = await asyncio.to_thread(check_watch_incidents)
            if expired > 0:
                print(f"⏰ [WATCHER] {expired} incident(s) watching → open")
        except Exception as e:
            print(f"❌ [WATCHER] Erreur: {e}")
        await asyncio.sleep(30)


# ── App ──
app = FastAPI(title="Jamono SRE API", version="2.0.0", lifespan=lifespan, default_response_class=JSONResponse)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════
# CHAT — Copilot IA
# ═══════════════════════════════════════════════════

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    t_id = request.thread_id or f"sess_{uuid.uuid4().hex[:6]}"
    try:
        full_response = await asyncio.to_thread(run_sre_system, request.message, t_id)

        remediation_data = None
        json_match = re.search(r"<remediation_json>(.*?)</remediation_json>", full_response, re.DOTALL)
        clean_explanation = full_response

        if json_match:
            try:
                remediation_data = json.loads(json_match.group(1).strip())
                clean_explanation = re.sub(r"<remediation_json>.*?</remediation_json>", "", full_response, flags=re.DOTALL).strip()
                clean_explanation = clean_explanation.replace("💡 En attente de validation (OUI/NON)...", "").strip()
            except Exception as json_err:
                print(f"Erreur parsing remediation JSON: {json_err}")

        clean_explanation = re.sub(r'\[\{.*?\}\]', '', clean_explanation, flags=re.DOTALL).strip()
        clean_explanation = re.sub(r'\{\".*?\"\}', '', clean_explanation, flags=re.DOTALL).strip()
        clean_explanation = re.sub(r'\n{3,}', '\n\n', clean_explanation).strip()

        return {
            "status": "success",
            "thread_id": t_id,
            "response": clean_explanation,
            "remediation": remediation_data,
            "has_action": remediation_data is not None,
        }
    except Exception as e:
        print(f"API Error [/chat]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# PODS — Lecture K8s
# ═══════════════════════════════════════════════════

@app.get("/pods")
async def get_pods(namespace: str = "default"):
    try:
        from tools.k8s_core import list_pods_tool
        result = list_pods_tool.invoke({"namespace": namespace})
        if isinstance(result, str):
            return {"status": "degraded", "pods": [], "message": result}
        return {"status": "success", "pods": result}
    except Exception as e:
        return {"status": "degraded", "pods": [], "message": str(e)}

@app.get("/pods/{pod_name}/logs")
async def get_pod_logs(pod_name: str, namespace: str = "default"):
    try:
        from tools.k8s_core import get_pod_logs_tool
        result = get_pod_logs_tool.invoke({"pod_name": pod_name, "namespace": namespace})
        return {"status": "success", "logs": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pods/{pod_name}/events")
async def get_pod_events(pod_name: str, namespace: str = "default"):
    try:
        from tools.k8s_core import get_pod_events_tool
        result = get_pod_events_tool.invoke({"pod_name": pod_name, "namespace": namespace})
        return {"status": "success", "events": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# REMEDIATION — Analyse + Confirm + Rollback
# ═══════════════════════════════════════════════════

class AnalyzeRequest(BaseModel):
    pod_name: str
    namespace: str = "default"
    thread_id: Optional[str] = None

@app.post("/remediation/analyze")
async def analyze_pod(req: AnalyzeRequest):
    t_id = req.thread_id or f"sess_{uuid.uuid4().hex[:6]}"
    try:
        prompt = f"Analyse complète du pod {req.pod_name} dans le namespace {req.namespace}. Donne un diagnostic et propose une remédiation."
        full_response = await asyncio.to_thread(run_sre_system, prompt, t_id)

        remediation_data = None
        json_match = re.search(r"<remediation_json>(.*?)</remediation_json>", full_response, re.DOTALL)
        clean_analysis = full_response

        if json_match:
            try:
                remediation_data = json.loads(json_match.group(1).strip())
                clean_analysis = re.sub(r"<remediation_json>.*?</remediation_json>", "", full_response, flags=re.DOTALL).strip()
            except Exception:
                pass

        clean_analysis = re.sub(r'\[\{.*?\}\]', '', clean_analysis, flags=re.DOTALL).strip()
        clean_analysis = re.sub(r'\{\".*?\"\}', '', clean_analysis, flags=re.DOTALL).strip()
        clean_analysis = re.sub(r'\n{3,}', '\n\n', clean_analysis).strip()

        actions = []
        if remediation_data and remediation_data.get("incident_detected"):
            actions.append({
                "action_type": remediation_data.get("action_type", "NONE"),
                "suggested_change": remediation_data.get("suggested_change", {}).get("new", ""),
                "justification": remediation_data.get("justification", ""),
                "requires_approval": remediation_data.get("requires_approval", True),
                "change_before": remediation_data.get("suggested_change", {}).get("current", ""),
                "change_after": remediation_data.get("suggested_change", {}).get("new", ""),
            })

        return {
            "status": "success",
            "thread_id": t_id,
            "analysis": clean_analysis,
            "actions": actions,
            "remediation": remediation_data,
        }
    except Exception as e:
        print(f"API Error [/remediation/analyze]: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# REMEDIATION — Apply + KB save
# ═══════════════════════════════════════════════════

class ApplyRemediationRequest(BaseModel):
    pod_name: str
    deployment_name: str
    namespace: str = "default"
    action_type: str  # PATCH_RESOURCES, PATCH_COMMAND
    change_before: Optional[str] = None
    change_after: Optional[str] = None  # "256Mi" ou '["sh","-c","sleep infinity"]'
    diagnostic: str = ""
    analysis: str = ""

@app.post("/remediation/apply")
async def apply_remediation(req: ApplyRemediationRequest):
    """Applique une remédiation approuvée et sauvegarde dans le KB si succès."""
    from tools.k8s_remediation import patch_deployment_resources_tool, patch_deployment_command_tool
    from tools.k8s_core import list_pods_tool
    from knowledge_base import kb_save
    import time

    try:
        result = ""

        if req.action_type == "PATCH_RESOURCES":
            result = await asyncio.to_thread(
                patch_deployment_resources_tool.invoke,
                {"deployment_name": req.deployment_name, "memory_limit": req.change_after, "namespace": req.namespace}
            )
        elif req.action_type == "PATCH_COMMAND":
            new_cmd = json.loads(req.change_after) if isinstance(req.change_after, str) else req.change_after
            result = await asyncio.to_thread(
                patch_deployment_command_tool.invoke,
                {"deployment_name": req.deployment_name, "new_command": new_cmd, "namespace": req.namespace}
            )
        else:
            raise HTTPException(status_code=400, detail=f"Action type '{req.action_type}' non supporté")

        success = "SUCCÈS" in result

        # Log dans l'audit
        action_id = log_action(
            pod_name=req.pod_name,
            action_type=req.action_type,
            change_before=req.change_before or "",
            change_after=req.change_after or "",
        )
        update_action_status(action_id, "success" if success else "failed")

        # Si succès → vérifier que le pod revient healthy (attendre 5s)
        if success:
            await asyncio.sleep(5)
            pods = await asyncio.to_thread(list_pods_tool.invoke, {"namespace": req.namespace})
            pod_healthy = False
            if isinstance(pods, list):
                for p in pods:
                    if req.deployment_name in p.get("pod_name", ""):
                        if p.get("health_status") == "HEALTHY":
                            pod_healthy = True
                            break

            # Sauvegarder dans le KB — la solution a été appliquée
            solution = f"{req.analysis}\n\nAction appliquée: {req.action_type} — {req.change_before} → {req.change_after}"
            kb_entry = kb_save(
                diagnostic=req.diagnostic,
                pod_name=req.pod_name,
                solution=solution,
                action_type=req.action_type,
                action_payload={
                    "deployment_name": req.deployment_name,
                    "change_before": req.change_before,
                    "change_after": req.change_after,
                    "verified_healthy": pod_healthy,
                },
                source="ai",
            )

            # Si le pod est revenu healthy → augmenter la confiance
            if pod_healthy and kb_entry:
                from knowledge_base import kb_record_outcome
                kb_record_outcome(kb_entry["id"], True)

            return {
                "status": "success",
                "result": result,
                "pod_healthy": pod_healthy,
                "kb_saved": kb_entry is not None,
                "kb_entry_id": kb_entry["id"] if kb_entry else None,
            }
        else:
            return {
                "status": "failed",
                "result": result,
                "pod_healthy": False,
                "kb_saved": False,
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ [REMEDIATION] Erreur: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class RemediationRequest(BaseModel):
    pod_name: str
    deployment_name: str
    action_type: str
    change_before: str
    change_after: str
    thread_id: Optional[str] = None

@app.post("/remediation/confirm")
async def confirm_remediation(req: RemediationRequest):
    t_id = req.thread_id or f"sess_{uuid.uuid4().hex[:6]}"
    action_id = None
    try:
        from tools.k8s_core import get_pod_manifest_tool
        snapshot = get_pod_manifest_tool.invoke({"pod_name": req.pod_name})

        action_id = log_action(
            pod_name=req.pod_name,
            action_type=req.action_type,
            change_before=req.change_before,
            change_after=req.change_after,
            rollback_snapshot={"manifest": str(snapshot)},
        )

        full_response = await asyncio.to_thread(
            run_sre_system,
            f"OUI, applique le changement pour {req.deployment_name}. Change la mémoire à {req.change_after}.",
            t_id,
        )

        update_action_status(action_id, "success")

        return {
            "status": "success",
            "remediation_id": action_id,
            "action_id": action_id,
            "message": f"Patch appliqué sur {req.deployment_name}",
            "response": full_response,
        }
    except Exception as e:
        if action_id:
            update_action_status(action_id, "failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/remediation/{action_id}/rollback")
async def rollback_remediation(action_id: int):
    try:
        snapshot = get_rollback_snapshot(action_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Snapshot introuvable")
        update_action_status(action_id, "rolled_back")
        return {"status": "success", "message": "Rollback effectué", "snapshot": snapshot}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# AUDIT
# ═══════════════════════════════════════════════════

@app.get("/audit")
async def get_audit():
    return {"status": "success", "entries": get_audit_log()}


# ═══════════════════════════════════════════════════
# INCIDENTS
# ═══════════════════════════════════════════════════

class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "medium"
    source: str = "manual"
    environment: str = "prod"
    linked_pod: Optional[str] = None
    assigned_to: Optional[str] = None
    watch_minutes: Optional[int] = None
    actions: Optional[list[str]] = None  # ["jira", "slack", "teams"] — None = aucune action

class StatusUpdate(BaseModel):
    status: str
    detail: Optional[str] = None
    author: str = "admin"

class TimelineEntryModel(BaseModel):
    action: str
    detail: str
    author: str = "admin"

@app.post("/incidents")
async def create_incident_endpoint(req: IncidentCreate):
    try:
        incident = create_incident(
            title=req.title,
            description=req.description,
            severity=req.severity,
            source=req.source,
            environment=req.environment,
            linked_pod=req.linked_pod,
            assigned_to=req.assigned_to,
            watch_minutes=req.watch_minutes,
        )

        if incident:
            requested_actions = req.actions or []

            # Slack — créer canal si demandé
            if "slack" in requested_actions:
                component = req.linked_pod or req.title[:20]
                result = create_incident_channel(incident["id"], component)
                if result:
                    channel_id, channel_name = result
                    update_slack_channel(incident["id"], channel_name)
                    incident["slack_channel"] = channel_name
                    post_incident_briefing(channel_id, incident)

            # Dispatch ciblé vers les intégrations demandées (Jira, Teams, etc.)
            if requested_actions:
                try:
                    dispatch_incident_created(incident, requested_actions)
                except Exception as e:
                    print(f"⚠️  [DISPATCH] Erreur dispatch create: {e}")

            # Notification
            create_notification(
                type="incident_created",
                title=f"Incident #{incident['id']} créé",
                detail=incident["title"],
                link=f"/incidents?open={incident['id']}",
            )

        return {"status": "success", "incident": incident}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/incidents")
async def list_incidents_endpoint(status: Optional[str] = None, environment: Optional[str] = None):
    try:
        incidents = list_incidents(status=status, environment=environment)
        stats = get_mttr_stats()
        return {"status": "success", "incidents": incidents, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/incidents/{incident_id}")
async def get_incident_endpoint(incident_id: int):
    incident = get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    # Résoudre le channel_id Slack en nom lisible si besoin (migration lazy)
    ch = incident.get("slack_channel")
    if ch and not ch.startswith("#"):
        client = get_slack_client()
        if client:
            try:
                res = client.conversations_info(channel=ch)
                name = f"#{res['channel']['name']}"
                update_slack_channel(incident_id, name)
                incident["slack_channel"] = name
            except Exception:
                pass
    timeline = get_timeline(incident_id)
    return {"status": "success", "incident": incident, "timeline": timeline}

@app.patch("/incidents/{incident_id}/status")
async def update_status_endpoint(incident_id: int, req: StatusUpdate):
    try:
        incident = update_incident_status(incident_id, req.status, req.author, req.detail)
        if incident and incident.get("slack_channel"):
            post_status_update(incident["slack_channel"], incident_id, req.status, req.author)

        # Dispatch vers intégrations actives
        if incident:
            try:
                dispatch_incident_updated(incident, req.status)
            except Exception as e:
                print(f"⚠️  [DISPATCH] Erreur dispatch update: {e}")
        return {"status": "success", "incident": incident}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/incidents/{incident_id}/timeline")
async def add_timeline_endpoint(incident_id: int, req: TimelineEntryModel):
    try:
        add_timeline_entry(incident_id, req.action, req.detail, req.author)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/incidents/stats/mttr")
async def get_mttr_endpoint():
    return {"status": "success", "stats": get_mttr_stats()}


# ═══════════════════════════════════════════════════
# SETTINGS
# ═══════════════════════════════════════════════════

class SettingsUpdate(BaseModel):
    settings: dict

@app.get("/settings")
async def get_settings_endpoint():
    try:
        return {"status": "success", "settings": get_all_settings()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/settings")
async def update_settings_endpoint(req: SettingsUpdate):
    try:
        updated = update_settings(req.settings)
        return {"status": "success", "settings": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# MONITOR
# ═══════════════════════════════════════════════════

def _extract_deploy(pod_name: str) -> str:
    """Extrait le nom du déploiement depuis un nom de pod."""
    parts = pod_name.rsplit("-", 2)
    return parts[0] if len(parts) >= 3 else pod_name

@app.post("/monitor/scan")
async def manual_scan():
    try:
        result = await asyncio.to_thread(run_scan_and_create_incidents)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/monitor/triage")
async def scan_triage(namespace: str = "default"):
    """Scanne le cluster et retourne un rapport de triage. Sauvegarde en historique."""
    try:
        from tools.k8s_core import list_pods_tool
        from models import ScanHistory
        from database import SessionLocal

        pods = await asyncio.to_thread(list_pods_tool.invoke, {"namespace": namespace})
        if isinstance(pods, str):
            return {"status": "degraded", "pods": [], "message": pods}

        report = []
        for pod in pods:
            severity = "healthy"
            if pod["health_status"] == "UNHEALTHY":
                restarts = pod.get("restarts", 0)
                if restarts > 100 or "CrashLoopBackOff" in (pod.get("diagnostic") or ""):
                    severity = "critical"
                elif restarts > 20:
                    severity = "high"
                elif restarts > 5:
                    severity = "medium"
                else:
                    severity = "low"

            deploy_name = _extract_deploy(pod["pod_name"])
            existing = None
            try:
                all_incidents = list_incidents()
                existing = next(
                    (i for i in all_incidents
                     if i.get("status") != "resolved" and i.get("linked_pod")
                     and _extract_deploy(i["linked_pod"]) == deploy_name),
                    None,
                )
            except Exception:
                pass

            report.append({
                **pod,
                "severity": severity,
                "has_incident": existing is not None,
                "incident_id": existing["id"] if existing else None,
            })

        report.sort(key=lambda p: (
            0 if p["health_status"] == "UNHEALTHY" else 1,
            -p.get("restarts", 0),
        ))

        unhealthy_count = sum(1 for p in report if p["health_status"] == "UNHEALTHY")
        healthy_count = len(report) - unhealthy_count

        # Sauvegarder en historique
        try:
            db = SessionLocal()
            unhealthy_details = [
                {"pod": p["pod_name"], "severity": p["severity"], "restarts": p["restarts"], "diagnostic": p.get("diagnostic")}
                for p in report if p["health_status"] == "UNHEALTHY"
            ]
            scan = ScanHistory(
                namespace=namespace,
                trigger="manual",
                total_pods=len(report),
                healthy=healthy_count,
                unhealthy=unhealthy_count,
                incidents_created=0,
                details_json=json.dumps(unhealthy_details) if unhealthy_details else None,
            )
            db.add(scan)
            db.commit()
            db.close()
            print(f"✅ [SCAN] Historique sauvegardé — {len(report)} pods, {unhealthy_count} unhealthy")
            # Pas de notification scan — l'onglet /scans gère l'historique
        except Exception as e:
            print(f"⚠️  [SCAN] Erreur sauvegarde historique: {e}")

        return {
            "status": "success",
            "namespace": namespace,
            "total": len(report),
            "unhealthy": unhealthy_count,
            "healthy": healthy_count,
            "pods": report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/monitor/scans")
async def list_scans(limit: int = 20):
    """Retourne l'historique des scans."""
    from models import ScanHistory
    from database import SessionLocal
    try:
        db = SessionLocal()
        scans = db.query(ScanHistory).order_by(ScanHistory.scanned_at.desc()).limit(limit).all()
        result = [s.to_dict() for s in scans]
        db.close()
        return {"status": "success", "scans": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/monitor/scans/last")
async def last_scan():
    """Retourne le dernier scan effectué."""
    from models import ScanHistory
    from database import SessionLocal
    try:
        db = SessionLocal()
        scan = db.query(ScanHistory).order_by(ScanHistory.scanned_at.desc()).first()
        db.close()
        if not scan:
            return {"status": "success", "scan": None}
        return {"status": "success", "scan": scan.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════
# TEAM
# ═══════════════════════════════════════════════════

class MemberCreate(BaseModel):
    name: str
    email: Optional[str] = None
    slack_username: Optional[str] = None
    role: str = "engineer"

class OnCallSet(BaseModel):
    member_id: int
    start_date: str
    end_date: str

@app.get("/team")
async def get_team():
    try:
        members = list_members()
        oncall = get_current_oncall()
        return {"status": "success", "members": members, "oncall": oncall}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/team/members")
async def add_member_endpoint(req: MemberCreate):
    try:
        member = add_member(req.name, req.email, req.slack_username, req.role)
        return {"status": "success", "member": member}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/team/members/{member_id}")
async def delete_member_endpoint(member_id: int):
    try:
        delete_member(member_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/team/oncall")
async def set_oncall_endpoint(req: OnCallSet):
    try:
        set_oncall(req.member_id, req.start_date, req.end_date)
        return {"status": "success", "oncall": get_current_oncall()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/team/oncall")
async def get_oncall_endpoint():
    try:
        return {"status": "success", "oncall": get_current_oncall()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# CLUSTERS
# ═══════════════════════════════════════════════════

def _detect_provider() -> dict:
    provider = {"id": "k3s", "name": "K3s", "color": "#FFC61C"}
    try:
        from kubernetes import config as k8s_config
        contexts, active = k8s_config.list_kube_config_contexts()
        ctx_name = active.get("name", "") if active else ""
        server = active.get("context", {}).get("cluster", "") if active else ""

        if "eks" in ctx_name.lower() or "eks" in server.lower():
            provider = {"id": "eks", "name": "Amazon EKS", "color": "#FF9900"}
        elif "aks" in ctx_name.lower() or "azure" in server.lower():
            provider = {"id": "aks", "name": "Azure AKS", "color": "#0078D4"}
        elif "gke" in ctx_name.lower() or "gke" in server.lower():
            provider = {"id": "gke", "name": "Google GKE", "color": "#4285F4"}
        elif "rancher" in ctx_name.lower() or "rke" in ctx_name.lower():
            provider = {"id": "rke", "name": "Rancher RKE", "color": "#0075A8"}
        elif "k3d" in ctx_name.lower() or "k3s" in ctx_name.lower():
            provider = {"id": "k3s", "name": "K3s", "color": "#FFC61C"}
    except Exception:
        pass
    return provider


def _get_cluster_info() -> dict | None:
    if not is_k8s_available():
        return None
    try:
        from utils.k8s_handler import get_v1_client
        from kubernetes import config as k8s_config

        v1 = get_v1_client()
        provider = _detect_provider()

        contexts, active = k8s_config.list_kube_config_contexts()
        ctx_name = active.get("name", "unknown") if active else "unknown"
        cluster_name = active.get("context", {}).get("cluster", ctx_name) if active else ctx_name

        nodes = v1.list_node()
        node_count = len(nodes.items)
        k8s_version = nodes.items[0].status.node_info.kubelet_version if nodes.items else "unknown"

        region = "local"
        if nodes.items:
            labels = nodes.items[0].metadata.labels or {}
            region = labels.get("topology.kubernetes.io/region",
                     labels.get("failure-domain.beta.kubernetes.io/region", "local"))

        ns_list = v1.list_namespace()
        namespaces = [ns.metadata.name for ns in ns_list.items]

        namespace = get_setting("watched_namespace") or "default"
        from tools.k8s_core import list_pods_tool
        pods = list_pods_tool.invoke({"namespace": namespace})

        pods_total = pods_healthy = pods_unhealthy = total_restarts = 0
        if isinstance(pods, list):
            pods_total = len(pods)
            pods_healthy = len([p for p in pods if p["health_status"] == "HEALTHY"])
            pods_unhealthy = pods_total - pods_healthy
            total_restarts = sum(p.get("restarts", 0) for p in pods)

        health = "healthy"
        if pods_unhealthy > 0:
            health = "degraded" if pods_unhealthy < pods_total else "critical"

        return {
            "id": "cluster-1",
            "name": cluster_name,
            "context": ctx_name,
            "provider": provider,
            "region": region,
            "k8s_version": k8s_version,
            "node_count": node_count,
            "namespaces": namespaces,
            "watched_namespace": namespace,
            "health": health,
            "stats": {
                "pods_total": pods_total,
                "pods_healthy": pods_healthy,
                "pods_unhealthy": pods_unhealthy,
                "total_restarts": total_restarts,
            },
            "connected_at": datetime.now().isoformat(),
        }
    except Exception as e:
        print(f"❌ [CLUSTERS] Erreur: {e}")
        return None


@app.get("/clusters")
async def list_clusters():
    try:
        cluster = await asyncio.to_thread(_get_cluster_info)
        clusters = [cluster] if cluster else []
        return {
            "status": "success",
            "clusters": clusters,
            "total": len(clusters),
            "k8s_available": is_k8s_available(),
        }
    except Exception as e:
        return {"status": "degraded", "clusters": [], "total": 0, "k8s_available": False, "message": str(e)}


@app.get("/clusters/{cluster_id}/stats")
async def get_cluster_stats(cluster_id: str):
    try:
        cluster = await asyncio.to_thread(_get_cluster_info)
        if not cluster or cluster["id"] != cluster_id:
            raise HTTPException(status_code=404, detail="Cluster introuvable")
        return {
            "status": "success",
            "cluster_id": cluster_id,
            "stats": cluster["stats"],
            "health": cluster["health"],
            "k8s_version": cluster["k8s_version"],
            "node_count": cluster["node_count"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════
# INTEGRATIONS — Framework connecteurs
# ═══════════════════════════════════════════════════

@app.get("/integrations/available")
async def list_available_integrations():
    """Liste tous les providers disponibles (installés) avec leur schéma de config."""
    return {"status": "success", "providers": IntegrationRegistry.list_all()}

@app.get("/integrations")
async def list_active_integrations():
    """Liste les intégrations configurées/connectées."""
    try:
        integrations = list_integrations()
        return {"status": "success", "integrations": integrations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/integrations/{integration_type}")
async def get_integration_endpoint(integration_type: str):
    integration = get_integration(integration_type)
    if not integration:
        raise HTTPException(status_code=404, detail="Intégration non trouvée")
    return {"status": "success", "integration": integration}

class IntegrationConnect(BaseModel):
    credentials: dict

@app.post("/integrations/{integration_type}/connect")
async def connect_integration_endpoint(integration_type: str, req: IntegrationConnect):
    try:
        integration = connect_integration(integration_type, req.credentials)
        return {"status": "success", "integration": integration}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/integrations/{integration_type}/test")
async def test_integration_endpoint(integration_type: str, req: IntegrationConnect):
    try:
        result = test_integration(integration_type, req.credentials)
        return {"status": "success", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/integrations/{integration_type}/disconnect")
async def disconnect_integration_endpoint(integration_type: str):
    try:
        disconnect_integration(integration_type)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/integrations/{integration_type}")
async def delete_integration_endpoint(integration_type: str):
    try:
        delete_integration(integration_type)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Découverte de ressources (projets Jira, canaux Slack, etc.)
@app.get("/integrations/{integration_type}/discover/{resource_type}")
async def discover_resources_endpoint(integration_type: str, resource_type: str, project_key: Optional[str] = None):
    """Fetch dynamique des ressources d'un service externe."""
    from integrations.manager import get_integration_config
    provider = IntegrationRegistry.get(integration_type)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider non trouvé")
    config = get_integration_config(integration_type)
    if not config:
        raise HTTPException(status_code=400, detail="Intégration non connectée")
    try:
        kwargs = {}
        if project_key:
            kwargs["project_key"] = project_key
        resources = await asyncio.to_thread(provider.discover_resources, resource_type, config, **kwargs)
        return {"status": "success", "resources": resources}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mise à jour de la config d'une intégration (projet, type de ticket, etc.)
class IntegrationConfigUpdate(BaseModel):
    config: dict

@app.put("/integrations/{integration_type}/config")
async def update_integration_config_endpoint(integration_type: str, req: IntegrationConfigUpdate):
    """Met à jour la config d'une intégration sans changer les credentials."""
    from integrations.manager import update_integration_config
    try:
        integration = update_integration_config(integration_type, req.config)
        return {"status": "success", "integration": integration}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Création manuelle de ticket depuis un incident
class ManualTicketRequest(BaseModel):
    integration_type: str

@app.post("/incidents/{incident_id}/ticket")
async def create_ticket_endpoint(incident_id: int, req: ManualTicketRequest):
    try:
        result = create_ticket_manual(incident_id, req.integration_type)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return {"status": "success", **result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Liens externes d'un incident
@app.get("/incidents/{incident_id}/links")
async def get_incident_links_endpoint(incident_id: int):
    try:
        links = get_incident_links(incident_id)
        return {"status": "success", "links": links}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Notifier un incident existant sur un canal
class NotifyRequest(BaseModel):
    channel: str  # "slack", "jira", "teams"

@app.post("/incidents/{incident_id}/notify")
async def notify_incident(incident_id: int, req: NotifyRequest):
    """Envoie une notification sur un canal pour un incident existant."""
    try:
        incident = get_incident(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident introuvable")

        if req.channel == "slack" and incident.get("slack_channel"):
            post_status_update(incident["slack_channel"], incident_id, incident["status"], "scan:notify")
            return {"status": "success", "message": "Notification Slack envoyée"}
        elif req.channel == "slack" and not incident.get("slack_channel"):
            component = incident.get("linked_pod") or incident["title"][:20]
            result = create_incident_channel(incident_id, component)
            if result:
                channel_id, channel_name = result
                update_slack_channel(incident_id, channel_name)
                post_incident_briefing(channel_id, incident)
                return {"status": "success", "message": "Canal Slack créé"}
            raise HTTPException(status_code=400, detail="Échec création canal Slack")
        elif req.channel == "jira":
            result = create_ticket_manual(incident_id, "jira")
            return {"status": "success", **result}
        elif req.channel == "teams":
            dispatch_incident_updated(incident, incident["status"])
            return {"status": "success", "message": "Notification Teams envoyée"}
        else:
            raise HTTPException(status_code=400, detail=f"Canal '{req.channel}' non supporté")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Webhooks entrants des intégrations
@app.post("/webhooks/{integration_type}")
async def integration_webhook(integration_type: str, request: Request):
    try:
        payload = await request.json()
        result = handle_integration_webhook(integration_type, payload)
        return result
    except Exception as e:
        print(f"❌ [WEBHOOK] Erreur {integration_type}: {e}")
        return {"success": False, "message": str(e)}

# ═══════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════

@app.get("/notifications")
async def get_notifications(limit: int = 20, unread_only: bool = False):
    from database import SessionLocal
    from models import Notification
    try:
        db = SessionLocal()
        query = db.query(Notification)
        if unread_only:
            query = query.filter(Notification.is_read == False)
        notifs = query.order_by(Notification.created_at.desc()).limit(limit).all()
        unread_count = db.query(Notification).filter(Notification.is_read == False).count()
        result = [n.to_dict() for n in notifs]
        db.close()
        return {"status": "success", "notifications": result, "unread_count": unread_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notifications/read")
async def mark_notifications_read():
    """Marque toutes les notifications comme lues."""
    from database import SessionLocal
    from models import Notification
    try:
        db = SessionLocal()
        db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
        db.commit()
        db.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: int):
    from database import SessionLocal
    from models import Notification
    try:
        db = SessionLocal()
        db.query(Notification).filter(Notification.id == notif_id).update({"is_read": True})
        db.commit()
        db.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ═══════════════════════════════════════════════════
# HEALTH + SLACK
# ═══════════════════════════════════════════════════

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "2.0.0", "k8s_available": is_k8s_available()}

@app.post("/slack/events")
async def slack_events(request: Request):
    body = await request.json()
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}
    asyncio.create_task(handle_slack_event(body))
    return {"ok": True}

# ═══════════════════════════════════════════════════
# KNOWLEDGE BASE — à ajouter dans api.py
# ═══════════════════════════════════════════════════

# Ajouter dans les imports en haut de api.py :
# from knowledge_base import kb_search, kb_save, kb_list, kb_stats, kb_record_outcome

@app.get("/kb")
async def get_knowledge_base(limit: int = 50):
    """Liste toutes les entrées du Knowledge Base."""
    from knowledge_base import kb_list, kb_stats
    try:
        entries = kb_list(limit)
        stats = kb_stats()
        return {"status": "success", "entries": entries, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/kb/search")
async def search_knowledge_base(diagnostic: str, pod_name: str = "", image: str = ""):
    """Cherche une solution dans le KB."""
    from knowledge_base import kb_search
    try:
        result = kb_search(diagnostic, pod_name, image)
        if result:
            return {"status": "success", "found": True, **result}
        return {"status": "success", "found": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/kb/save")
async def save_to_knowledge_base(request: Request):
    """Sauvegarde manuelle d'une solution dans le KB."""
    from knowledge_base import kb_save
    try:
        data = await request.json()
        entry = kb_save(
            diagnostic=data.get("diagnostic", ""),
            pod_name=data.get("pod_name", ""),
            solution=data.get("solution", ""),
            action_type=data.get("action_type", "MANUAL"),
            action_payload=data.get("action_payload"),
            source="manual",
        )
        if entry:
            return {"status": "success", "entry": entry}
        raise HTTPException(status_code=500, detail="Erreur sauvegarde KB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/kb/{entry_id}/outcome")
async def record_kb_outcome(entry_id: int, request: Request):
    """Enregistre si une solution a fonctionné ou non."""
    from knowledge_base import kb_record_outcome
    try:
        data = await request.json()
        success = data.get("success", False)
        kb_record_outcome(entry_id, success)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/kb/{entry_id}")
async def delete_kb_entry(entry_id: int):
    """Supprime une entrée du KB."""
    from database import SessionLocal
    from models import KnowledgeEntry
    try:
        db = SessionLocal()
        db.query(KnowledgeEntry).filter(KnowledgeEntry.id == entry_id).delete()
        db.commit()
        db.close()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))