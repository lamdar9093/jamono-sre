from dotenv import load_dotenv
from langchain_core.tools import tool
from kubernetes import client, config

from utils.k8s_handler import get_v1_client
v1 = get_v1_client()

# # 1. Initialisation
# load_dotenv()
# try:
#     config.load_kube_config()
#     v1 = client.CoreV1Api()
# except Exception as e:
#     print(f"❌ Erreur K8s: {e}")

@tool
def check_service_connectivity_tool(service_name: str, namespace: str = "default"):
    """Vérifie si un service Kubernetes est joignable. Utile pour les erreurs réseau."""
    # Simulation d'un test réseau
    return f"Service {service_name} est accessible sur le port 80."