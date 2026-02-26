from langchain_core.tools import tool
from utils.k8s_handler import get_v1_client

@tool
def check_service_connectivity_tool(service_name: str, namespace: str = "default"):
    """Vérifie si un service Kubernetes est joignable. Utile pour les erreurs réseau."""
    try:
        v1 = get_v1_client()
        service = v1.read_namespaced_service(name=service_name, namespace=namespace)
        return f"Service {service_name} trouvé — ClusterIP: {service.spec.cluster_ip}, Port: {service.spec.ports[0].port if service.spec.ports else 'N/A'}"
    except Exception as e:
        return f"Service {service_name} inaccessible: {str(e)}"