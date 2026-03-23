"""
Jamono K8s Tools — Outils étendus pour le diagnostic et la remédiation K8s
"""

from langchain_core.tools import tool
from utils.k8s_handler import get_v1_client, get_apps_v1_client


# ═══════════════════════════════════════════
# PODS
# ═══════════════════════════════════════════

@tool
def list_pods_tool(namespace: str = "default"):
    """Récupère l'état de santé de tous les pods d'un namespace. Indispensable pour le diagnostic SRE."""
    try:
        v1 = get_v1_client()
        pods = v1.list_namespaced_pod(namespace)
        health_report = []
        for p in pods.items:
            container = p.status.container_statuses[0] if p.status.container_statuses else None
            is_stable = False
            error_msg = "None"
            if container:
                is_stable = container.ready and (container.restart_count == 0 or p.status.phase == "Running")
                if container.state.waiting:
                    error_msg = f"{container.state.waiting.reason}: {container.state.waiting.message}"
                elif container.state.terminated:
                    error_msg = f"Terminated: {container.state.terminated.reason}"
            health_report.append({
                "pod_name": p.metadata.name,
                "health_status": "HEALTHY" if is_stable else "UNHEALTHY",
                "restarts": container.restart_count if container else 0,
                "diagnostic": error_msg,
                "internal_phase": p.status.phase,
            })
        return health_report
    except Exception as e:
        return f"Erreur API K8s: {str(e)}"


@tool
def get_pod_logs_tool(pod_name: str, namespace: str = "default"):
    """Récupère les 50 dernières lignes de logs d'un pod. Essentiel pour analyser les erreurs."""
    try:
        v1 = get_v1_client()
        return v1.read_namespaced_pod_log(name=pod_name, namespace=namespace, tail_lines=50)
    except Exception as e:
        return f"Impossible de lire les logs : {e}"


@tool
def get_pod_manifest_tool(pod_name: str, namespace: str = "default"):
    """Récupère la spec des containers d'un pod (limites CPU/RAM, commande, image, volumes)."""
    try:
        v1 = get_v1_client()
        pod = v1.read_namespaced_pod(name=pod_name, namespace=namespace)
        return pod.to_dict()['spec']['containers']
    except Exception as e:
        return f"Erreur lors de la lecture du manifeste : {e}"


@tool
def get_pod_events_tool(pod_name: str, namespace: str = "default"):
    """Récupère les événements K8s liés à un pod. Utile quand il n'y a pas de logs."""
    try:
        v1 = get_v1_client()
        field_selector = f"involvedObject.name={pod_name}"
        events = v1.list_namespaced_event(namespace, field_selector=field_selector)
        return [{"type": e.type, "reason": e.reason, "message": e.message, "count": e.count} for e in events.items]
    except Exception as e:
        return f"Erreur lors de la récupération des événements : {e}"


@tool
def delete_pod_tool(pod_name: str, namespace: str = "default"):
    """Supprime (restart) un pod. K8s le recréera automatiquement via le deployment."""
    try:
        v1 = get_v1_client()
        v1.delete_namespaced_pod(name=pod_name, namespace=namespace)
        return f"SUCCÈS : Pod {pod_name} supprimé. Un nouveau pod sera créé par le controller."
    except Exception as e:
        return f"ERREUR suppression pod : {str(e)}"


# ═══════════════════════════════════════════
# DEPLOYMENTS
# ═══════════════════════════════════════════

@tool
def list_deployments_tool(namespace: str = "default"):
    """Liste tous les deployments avec leur état (replicas ready/desired, image, strategy)."""
    try:
        apps = get_apps_v1_client()
        deps = apps.list_namespaced_deployment(namespace)
        report = []
        for d in deps.items:
            containers = d.spec.template.spec.containers
            report.append({
                "name": d.metadata.name,
                "replicas_desired": d.spec.replicas,
                "replicas_ready": d.status.ready_replicas or 0,
                "replicas_available": d.status.available_replicas or 0,
                "image": containers[0].image if containers else "N/A",
                "strategy": d.spec.strategy.type if d.spec.strategy else "N/A",
                "conditions": [
                    {"type": c.type, "status": c.status, "reason": c.reason}
                    for c in (d.status.conditions or [])
                ],
            })
        return report
    except Exception as e:
        return f"Erreur liste deployments : {str(e)}"


@tool
def get_deployment_detail_tool(deployment_name: str, namespace: str = "default"):
    """Récupère les détails d'un deployment (resources, env vars, volumes, strategy)."""
    try:
        apps = get_apps_v1_client()
        d = apps.read_namespaced_deployment(name=deployment_name, namespace=namespace)
        containers = d.spec.template.spec.containers
        return {
            "name": d.metadata.name,
            "replicas": d.spec.replicas,
            "strategy": d.spec.strategy.type if d.spec.strategy else "N/A",
            "containers": [
                {
                    "name": c.name,
                    "image": c.image,
                    "command": c.command,
                    "args": c.args,
                    "resources": c.resources.to_dict() if c.resources else None,
                    "env_count": len(c.env or []),
                    "volume_mounts": [vm.name for vm in (c.volume_mounts or [])],
                }
                for c in containers
            ],
        }
    except Exception as e:
        return f"Erreur détail deployment : {str(e)}"


@tool
def scale_deployment_tool(deployment_name: str, replicas: int, namespace: str = "default"):
    """Scale un deployment à un nombre de replicas donné."""
    try:
        apps = get_apps_v1_client()
        apps.patch_namespaced_deployment_scale(
            name=deployment_name,
            namespace=namespace,
            body={"spec": {"replicas": replicas}},
        )
        return f"SUCCÈS : Deployment {deployment_name} scalé à {replicas} replicas."
    except Exception as e:
        return f"ERREUR scale : {str(e)}"


@tool
def rollout_restart_deployment_tool(deployment_name: str, namespace: str = "default"):
    """Effectue un rollout restart d'un deployment (recrée tous les pods)."""
    import datetime
    try:
        apps = get_apps_v1_client()
        patch = {
            "spec": {
                "template": {
                    "metadata": {
                        "annotations": {
                            "kubectl.kubernetes.io/restartedAt": datetime.datetime.utcnow().isoformat()
                        }
                    }
                }
            }
        }
        apps.patch_namespaced_deployment(name=deployment_name, namespace=namespace, body=patch)
        return f"SUCCÈS : Rollout restart de {deployment_name} lancé. Les pods vont être recréés."
    except Exception as e:
        return f"ERREUR rollout restart : {str(e)}"


# ═══════════════════════════════════════════
# NODES
# ═══════════════════════════════════════════

@tool
def list_nodes_tool():
    """Liste les nodes du cluster avec leur état, rôle, version, et pression (CPU/mémoire/disque)."""
    try:
        v1 = get_v1_client()
        nodes = v1.list_node()
        report = []
        for n in nodes.items:
            conditions = {c.type: c.status for c in (n.status.conditions or [])}
            labels = n.metadata.labels or {}
            role = "master" if "node-role.kubernetes.io/master" in labels or "node-role.kubernetes.io/control-plane" in labels else "worker"
            report.append({
                "name": n.metadata.name,
                "role": role,
                "ready": conditions.get("Ready", "Unknown"),
                "memory_pressure": conditions.get("MemoryPressure", "False"),
                "disk_pressure": conditions.get("DiskPressure", "False"),
                "pid_pressure": conditions.get("PIDPressure", "False"),
                "kubelet_version": n.status.node_info.kubelet_version if n.status.node_info else "N/A",
                "os": n.status.node_info.os_image if n.status.node_info else "N/A",
                "capacity": {
                    "cpu": n.status.capacity.get("cpu", "N/A") if n.status.capacity else "N/A",
                    "memory": n.status.capacity.get("memory", "N/A") if n.status.capacity else "N/A",
                    "pods": n.status.capacity.get("pods", "N/A") if n.status.capacity else "N/A",
                },
            })
        return report
    except Exception as e:
        return f"Erreur liste nodes : {str(e)}"


# ═══════════════════════════════════════════
# EVENTS GLOBAUX
# ═══════════════════════════════════════════

@tool
def list_warning_events_tool(namespace: str = "default", limit: int = 20):
    """Récupère les événements Warning du namespace. Détecte les problèmes que les logs ne montrent pas."""
    try:
        v1 = get_v1_client()
        events = v1.list_namespaced_event(namespace, field_selector="type=Warning")
        sorted_events = sorted(events.items, key=lambda e: e.last_timestamp or e.event_time or "", reverse=True)[:limit]
        return [
            {
                "reason": e.reason,
                "message": e.message,
                "object": f"{e.involved_object.kind}/{e.involved_object.name}",
                "count": e.count,
                "last_seen": str(e.last_timestamp or e.event_time or ""),
            }
            for e in sorted_events
        ]
    except Exception as e:
        return f"Erreur liste events : {str(e)}"


# ═══════════════════════════════════════════
# SERVICES
# ═══════════════════════════════════════════

@tool
def list_services_tool(namespace: str = "default"):
    """Liste les services K8s avec type, ClusterIP, ports et endpoints."""
    try:
        v1 = get_v1_client()
        services = v1.list_namespaced_service(namespace)
        report = []
        for s in services.items:
            # Vérifier les endpoints
            try:
                ep = v1.read_namespaced_endpoints(name=s.metadata.name, namespace=namespace)
                ep_count = sum(len(subset.addresses or []) for subset in (ep.subsets or []))
            except:
                ep_count = 0
            
            report.append({
                "name": s.metadata.name,
                "type": s.spec.type,
                "cluster_ip": s.spec.cluster_ip,
                "ports": [{"port": p.port, "target_port": str(p.target_port), "protocol": p.protocol} for p in (s.spec.ports or [])],
                "endpoints_count": ep_count,
                "has_endpoints": ep_count > 0,
            })
        return report
    except Exception as e:
        return f"Erreur liste services : {str(e)}"


# ═══════════════════════════════════════════
# PVC
# ═══════════════════════════════════════════

@tool
def list_pvcs_tool(namespace: str = "default"):
    """Liste les PersistentVolumeClaims avec leur état, taille et storageClass."""
    try:
        v1 = get_v1_client()
        pvcs = v1.list_namespaced_persistent_volume_claim(namespace)
        return [
            {
                "name": pvc.metadata.name,
                "status": pvc.status.phase,
                "capacity": pvc.status.capacity.get("storage", "N/A") if pvc.status.capacity else "N/A",
                "access_modes": pvc.spec.access_modes,
                "storage_class": pvc.spec.storage_class_name,
            }
            for pvc in pvcs.items
        ]
    except Exception as e:
        return f"Erreur liste PVCs : {str(e)}"


# ═══════════════════════════════════════════
# NAMESPACES
# ═══════════════════════════════════════════

@tool
def list_namespaces_tool():
    """Liste tous les namespaces du cluster."""
    try:
        v1 = get_v1_client()
        ns = v1.list_namespace()
        return [{"name": n.metadata.name, "status": n.status.phase} for n in ns.items]
    except Exception as e:
        return f"Erreur liste namespaces : {str(e)}"