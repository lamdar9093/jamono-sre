from dotenv import load_dotenv
from langchain_core.tools import tool
from kubernetes import client, config

from utils.k8s_handler import get_v1_client, get_apps_v1_client
v1 = get_v1_client()

@tool
def patch_deployment_resources_tool(deployment_name: str, memory_limit: str, namespace: str = "default"):
    """
    Augmente les ressources (RAM) d'un Deployment.
    Indispensable pour corriger définitivement un CrashLoopBackOff dû à un OOM.
    Exemple: deployment_name='crash-app', memory_limit='256Mi'
    """
    apps_v1 = get_apps_v1_client() # On utilise le helper qu'on a créé dans utils/k8s_handler
    
    # Le patch cible le template du conteneur dans le déploiement
    patch_body = {
        "spec": {
            "template": {
                "spec": {
                    "containers": [
                        {
                            "name": "crash-container", # Doit correspondre au nom dans le YAML
                            "resources": {
                                "limits": {"memory": memory_limit},
                                "requests": {"memory": memory_limit}
                            }
                        }
                    ]
                }
            }
        }
    }
    
    try:
        apps_v1.patch_namespaced_deployment(
            name=deployment_name, 
            namespace=namespace, 
            body=patch_body
        )
        return f"SUCCÈS : Le déploiement {deployment_name} a été patché avec {memory_limit}. Kubernetes va redémarrer un pod sain."
    except Exception as e:
        return f"ERREUR lors du patch : {str(e)}"
    
@tool
def patch_deployment_command_tool(deployment_name: str, new_command: list[str], namespace: str = "default"):
    """
    Modifie la commande d'exécution (entrypoint) d'un Deployment.
    Utile pour stabiliser un pod dont le processus principal s'arrête ou crash.
    Exemple: new_command=["sh", "-c", "sleep infinity"]
    """
    apps_v1 = get_apps_v1_client() # Utilise le helper qu'on a créé dans utils/k8s_handler
    
    patch_body = {
        "spec": {
            "template": {
                "spec": {
                    "containers": [
                        {
                            "name": "crash-container", # Doit correspondre au nom dans ton YAML
                            "command": new_command
                        }
                    ]
                }
            }
        }
    }
    
    try:
        apps_v1.patch_namespaced_deployment(
            name=deployment_name,
            namespace=namespace,
            body=patch_body
        )
        return f"SUCCÈS : La commande de {deployment_name} a été remplacée par {new_command}."
    except Exception as e:
        return f"ERREUR lors du patch de commande : {str(e)}"