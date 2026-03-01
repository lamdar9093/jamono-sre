from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
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
    post_status_update, handle_slack_event
)
from team import add_member, list_members, delete_member, set_oncall, get_current_oncall
from utils.k8s_handler import is_k8s_available


# ── Lifespan ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Créer les tables si elles n'existent pas (dev). En prod → Alembic.
    Base.metadata.create_all(bind=engine)
    seed_defaults()
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
app = FastAPI(title="Jamono SRE API", version="2.0.0", lifespan=lifespan)

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
            component = req.linked_pod or req.title[:20]
            channel_id = create_incident_channel(incident["id"], component)
            if channel_id:
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
        if incident and incident.get("slack_channel"):
            post_status_update(incident["slack_channel"], incident_id, req.status, req.author)
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

@app.post("/monitor/scan")
async def manual_scan():
    try:
        result = await asyncio.to_thread(run_scan_and_create_incidents)
        return {"status": "success", "result": result}
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