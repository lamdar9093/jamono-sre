from dotenv import load_dotenv
from langchain_core.tools import tool
from kubernetes import client, config

from utils.k8s_handler import get_v1_client

@tool
def list_pods_tool(namespace: str = "default"):
    """Récupère l'état de santé réel des pods. Indispensable pour le diagnostic SRE."""
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
                "internal_phase": p.status.phase
            })
        return health_report
    except Exception as e:
        return f"Erreur API K8s: {str(e)}"

@tool
def get_pod_logs_tool(pod_name: str, namespace: str = "default"):
    """Récupère les logs d'un pod spécifique pour analyser les erreurs."""
    try:
        v1 = get_v1_client()
        return v1.read_namespaced_pod_log(name=pod_name, namespace=namespace, tail_lines=50)
    except Exception as e:
        return f"Impossible de lire les logs : {e}"

@tool
def get_pod_manifest_tool(pod_name: str, namespace: str = "default"):
    """Récupère la configuration (manifeste) du pod pour voir les limites de ressources (CPU/RAM)."""
    try:
        v1 = get_v1_client()
        pod = v1.read_namespaced_pod(name=pod_name, namespace=namespace)
        # On extrait seulement la spec des conteneurs pour économiser des tokens
        return pod.to_dict()['spec']['containers']
    except Exception as e:
        return f"Erreur lors de la lecture du manifeste : {e}"
    
@tool
def get_pod_events_tool(pod_name: str, namespace: str = "default"):
    """Récupère les événements Kubernetes liés à un pod. Utile quand il n'y a pas de logs."""
    try:
        v1 = get_v1_client()
        # On filtre les événements pour ne garder que ceux liés à ce pod
        field_selector = f"involvedObject.name={pod_name}"
        events = v1.list_namespaced_event(namespace, field_selector=field_selector)
        
        return [
            {
                "type": e.type,
                "reason": e.reason,
                "message": e.message,
                "count": e.count
            } 
            for e in events.items
        ]
    except Exception as e:
        return f"Erreur lors de la récupération des événements : {e}"