from kubernetes import client, config

_k8s_available = False

def _init_k8s():
    global _k8s_available
    try:
        config.load_kube_config()
        _k8s_available = True
        return True
    except Exception:
        pass
    try:
        config.load_incluster_config()
        _k8s_available = True
        return True
    except Exception:
        pass
    print("⚠️  [K8S] Aucune config Kubernetes trouvée — mode dégradé")
    _k8s_available = False
    return False

# Init au démarrage — ne crash pas si pas de K8s
_init_k8s()

def get_v1_client():
    if not _k8s_available:
        raise Exception("Kubernetes non disponible sur ce serveur")
    return client.CoreV1Api()

def get_apps_v1_client():
    if not _k8s_available:
        raise Exception("Kubernetes non disponible sur ce serveur")
    return client.AppsV1Api()

def is_k8s_available() -> bool:
    return _k8s_available