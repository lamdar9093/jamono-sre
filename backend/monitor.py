# Service de monitoring autonome — surveille le cluster et crée des incidents automatiquement
import asyncio
import json
from datetime import datetime
from settings import get_setting
from incidents import create_incident, list_incidents
from tools.k8s_core import list_pods_tool

# Mémoire des pods déjà en incident pour éviter les doublons
_active_incident_pods: set = set()

def _get_active_incident_pods() -> set:
    """Retourne les pods qui ont déjà un incident ouvert ou en cours."""
    incidents = list_incidents()
    active = set()
    for inc in incidents:
        if inc["status"] in ("open", "in_progress", "watching") and inc["linked_pod"]:
            active.add(inc["linked_pod"])
    return active

def _severity_from_restarts(restarts: int) -> str:
    """Détermine la sévérité en fonction du nombre de restarts."""
    if restarts >= 50:
        return "critical"
    elif restarts >= 20:
        return "high"
    elif restarts >= 5:
        return "medium"
    return "low"

def _severity_rank(severity: str) -> int:
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(severity, 0)

def run_scan_and_create_incidents():
    """Scan le cluster et crée des incidents si nécessaire selon les paramètres."""
    try:
        # 1. Lire les paramètres
        auto_create = get_setting("auto_create_incidents")
        min_severity = get_setting("auto_create_min_severity") or "high"
        namespace = get_setting("watched_namespace") or "default"
        auto_assign = get_setting("auto_assign")
        oncall_members = get_setting("oncall_members") or []

        if not auto_create or str(auto_create).lower() == "false":
            return {"scanned": 0, "created": 0, "message": "Auto-création désactivée"}

        # 2. Scanner les pods
        pods = list_pods_tool.invoke({"namespace": namespace})
        if isinstance(pods, str):
            return {"error": pods}

        # 3. Récupérer les pods déjà en incident
        active_pods = _get_active_incident_pods()

        created = 0
        for pod in pods:
            if pod["health_status"] != "UNHEALTHY":
                continue

            pod_name = pod["pod_name"]

            # Éviter les doublons
            if pod_name in active_pods:
                continue

            # Calculer la sévérité
            severity = _severity_from_restarts(pod["restarts"])

            # Vérifier la sévérité minimale
            if _severity_rank(severity) < _severity_rank(min_severity):
                continue

            # Assignation automatique
            assigned_to = None
            if auto_assign and oncall_members:
                assigned_to = oncall_members[0]

            # Créer l'incident
            create_incident(
                title=f"Pod {pod_name} — {pod['diagnostic'].split(':')[0] if pod['diagnostic'] != 'None' else 'UNHEALTHY'}",
                description=f"Détecté automatiquement. Diagnostic: {pod['diagnostic']}. Restarts: {pod['restarts']}",
                severity=severity,
                source="auto",
                environment="prod",
                linked_pod=pod_name,
                assigned_to=assigned_to,
                created_by="system"
            )
            created += 1

        return {
            "scanned": len(pods),
            "unhealthy": len([p for p in pods if p["health_status"] == "UNHEALTHY"]),
            "created": created,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        return {"error": str(e)}

async def start_auto_monitor():
    """Boucle de monitoring asynchrone — tourne en arrière-plan avec FastAPI."""
    print("🔍 [MONITOR] Service de monitoring démarré")
    while True:
        try:
            scan_mode = get_setting("scan_mode")
            interval = int(get_setting("scan_interval_seconds") or 60)

            if scan_mode == "auto":
                result = run_scan_and_create_incidents()
                if result.get("created", 0) > 0:
                    print(f"🚨 [MONITOR] {result['created']} incident(s) créé(s) automatiquement")
                else:
                    print(f"✅ [MONITOR] Scan OK — {result.get('scanned', 0)} pods vérifiés")
            else:
                print(f"⏸️  [MONITOR] Mode {scan_mode} — pas de scan automatique")

        except Exception as e:
            print(f"❌ [MONITOR] Erreur: {e}")

        await asyncio.sleep(interval)