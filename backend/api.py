from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import uuid
import re
import json
from main import run_sre_system
from audit import init_audit_db, log_action, update_action_status, get_audit_log, get_rollback_snapshot
from incidents import (
    init_incidents_db, create_incident, get_incident,
    list_incidents, update_incident_status, add_timeline_entry,
    get_timeline, check_watch_incidents, get_mttr_stats
)
init_incidents_db()

from settings import init_settings_db, get_all_settings, update_settings
init_settings_db()

from contextlib import asynccontextmanager
from monitor import start_auto_monitor, run_scan_and_create_incidents
import asyncio
from slack_service import create_incident_channel, post_incident_briefing, post_status_update

from team import init_team_db, add_member, list_members, delete_member, set_oncall, get_current_oncall
init_team_db()

from slack_service import handle_slack_event

# Initialisation de la DB au démarrage
init_audit_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Démarrage du monitor en arrière-plan
    asyncio.create_task(start_auto_monitor())
    yield

app = FastAPI(title="SRE Agent API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    t_id = request.thread_id or f"sess_{uuid.uuid4().hex[:6]}"
    
    try:
        full_response = run_sre_system(request.message, t_id)
        
        remediation_data = None
        json_match = re.search(r"<remediation_json>(.*?)</remediation_json>", full_response, re.DOTALL)
        
        clean_explanation = full_response
        
        if json_match:
            try:
                remediation_data = json.loads(json_match.group(1).strip())
                clean_explanation = re.sub(r"<remediation_json>.*?</remediation_json>", "", full_response, flags=re.DOTALL).strip()
                clean_explanation = clean_explanation.replace("💡 En attente de validation (OUI/NON)...", "").strip()
            except Exception as json_err:
                print(f"Erreur de parsing JSON: {json_err}")

        # Nettoyage du texte : on retire les blocs JSON bruts que l'agent laisse traîner
        # Retire les listes JSON type [{"pod_name": ...}]
        clean_explanation = re.sub(r'\[\{.*?\}\]', '', clean_explanation, flags=re.DOTALL).strip()
        # Retire les objets JSON isolés type {"key": "value"}
        clean_explanation = re.sub(r'\{\".*?\"\}', '', clean_explanation, flags=re.DOTALL).strip()
        # Retire les lignes vides multiples
        clean_explanation = re.sub(r'\n{3,}', '\n\n', clean_explanation).strip()

        return {
            "status": "success",
            "thread_id": t_id,
            "response": clean_explanation,
            "remediation": remediation_data,
            "has_action": remediation_data is not None
        }

    except Exception as e:
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/pods")
async def get_pods():
    try:
        from tools.k8s_core import list_pods_tool
        result = list_pods_tool.invoke({"namespace": "default"})
        return {"status": "success", "pods": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
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
    

# Endpoint de confirmation de remédiation — enregistre dans l'audit avant d'exécuter
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
    
    try:
        # 1. Snapshot de l'état actuel avant le patch
        from tools.k8s_core import get_pod_manifest_tool
        snapshot = get_pod_manifest_tool.invoke({"pod_name": req.pod_name})
        
        # 2. Enregistrement dans l'audit log
        action_id = log_action(
            pod_name=req.pod_name,
            action_type=req.action_type,
            change_before=req.change_before,
            change_after=req.change_after,
            rollback_snapshot={"manifest": str(snapshot)}
        )
        
        # 3. Exécution du patch via l'agent
        full_response = run_sre_system(
            f"OUI, applique le changement pour {req.deployment_name}. Change la mémoire à {req.change_after}.",
            t_id
        )
        
        # 4. Mise à jour du statut
        update_action_status(action_id, "success")
        
        return {
            "status": "success",
            "action_id": action_id,
            "message": f"Patch appliqué sur {req.deployment_name}",
            "response": full_response
        }
    except Exception as e:
        if 'action_id' in locals():
            update_action_status(action_id, "failed")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint rollback
@app.post("/remediation/{action_id}/rollback")
async def rollback_remediation(action_id: int):
    try:
        snapshot = get_rollback_snapshot(action_id)
        if not snapshot:
            raise HTTPException(status_code=404, detail="Snapshot introuvable")
        update_action_status(action_id, "rolled_back")
        return {"status": "success", "message": "Rollback effectué", "snapshot": snapshot}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint audit log
@app.get("/audit")
async def get_audit():
    return {"status": "success", "logs": get_audit_log()}


# Endpoints incidents — gestion complète du cycle de vie
class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    severity: str = "medium"
    source: str = "manual"
    environment: str = "prod"
    linked_pod: Optional[str] = None
    assigned_to: Optional[str] = None
    watch_minutes: Optional[int] = None

class StatusUpdate(BaseModel):
    status: str
    detail: Optional[str] = None
    author: str = "admin"

class TimelineEntry(BaseModel):
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
            watch_minutes=req.watch_minutes
        )

        # Slack — créer canal + briefing
        if incident:
            component = req.linked_pod or req.title[:20]
            channel_id = create_incident_channel(incident["id"], component)
            if channel_id:
                # Sauvegarder le channel_id dans l'incident
                from incidents import update_slack_channel
                update_slack_channel(incident["id"], channel_id)
                incident["slack_channel"] = channel_id
                post_incident_briefing(channel_id, incident)

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
    timeline = get_timeline(incident_id)
    return {"status": "success", "incident": incident, "timeline": timeline}

@app.patch("/incidents/{incident_id}/status")
async def update_status_endpoint(incident_id: int, req: StatusUpdate):
    try:
        incident = update_incident_status(incident_id, req.status, req.author, req.detail)
        # Notifier Slack du changement de statut
        if incident.get("slack_channel"):
            post_status_update(incident["slack_channel"], incident_id, req.status, req.author)
        return {"status": "success", "incident": incident}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/incidents/{incident_id}/timeline")
async def add_timeline_endpoint(incident_id: int, req: TimelineEntry):
    try:
        add_timeline_entry(incident_id, req.action, req.detail, req.author)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/incidents/stats/mttr")
async def get_mttr_endpoint():
    return {"status": "success", "stats": get_mttr_stats()}


# Endpoints paramètres — lecture et mise à jour de la configuration
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
    

# Endpoint scan manuel — déclenche immédiatement une vérification du cluster
@app.post("/monitor/scan")
async def manual_scan():
    try:
        result = await asyncio.to_thread(run_scan_and_create_incidents)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# Endpoints équipe — gestion des membres et on-call
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
        oncall = get_current_oncall()
        return {"status": "success", "oncall": oncall}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.post("/slack/events")
async def slack_events(request: Request):
    body = await request.json()
    
    # Vérification du challenge Slack
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}
    
    # Traitement des events en arrière-plan
    asyncio.create_task(handle_slack_event(body))
    return {"ok": True}