from kubernetes import client, config

def get_v1_client():
    """Initialise et retourne le client CoreV1Api."""
    try:
        # Tente de charger la config locale (kubeconfig)
        config.load_kube_config()
    except Exception:
        # Sinon tente la config interne (si tourne dans le cluster)
        config.load_incluster_config()
    return client.CoreV1Api()

def get_apps_v1_client():
    """Initialise et retourne le client AppsV1Api (pour les Deployments)."""
    try:
        config.load_kube_config()
    except Exception:
        config.load_incluster_config()
    return client.AppsV1Api()