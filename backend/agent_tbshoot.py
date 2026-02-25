import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from kubernetes import client, config

# 1. Initialisation
load_dotenv()
try:
    config.load_kube_config()
    v1 = client.CoreV1Api()
except Exception as e:
    print(f"❌ Erreur K8s: {e}")

# 2. Définition des outils (DOIVENT être avant la liste 'tools')
@tool
def list_pods_tool(namespace: str = "default"):
    """Liste tous les pods dans un namespace donné pour vérifier leur statut."""
    try:
        pods = v1.list_namespaced_pod(namespace)
        return [{"name": p.metadata.name, "status": p.status.phase} for p in pods.items]
    except Exception as e:
        return f"Erreur lors du listage des pods : {e}"

@tool
def get_pod_logs_tool(pod_name: str, namespace: str = "default"):
    """Récupère les logs d'un pod spécifique pour analyser les erreurs."""
    try:
        return v1.read_namespaced_pod_log(name=pod_name, namespace=namespace, tail_lines=50)
    except Exception as e:
        return f"Impossible de lire les logs : {e}"

@tool
def get_pod_manifest_tool(pod_name: str, namespace: str = "default"):
    """Récupère la configuration (manifeste) du pod pour voir les limites de ressources (CPU/RAM)."""
    try:
        pod = v1.read_namespaced_pod(name=pod_name, namespace=namespace)
        # On extrait seulement la spec des conteneurs pour économiser des tokens
        return pod.to_dict()['spec']['containers']
    except Exception as e:
        return f"Erreur lors de la lecture du manifeste : {e}"
    
@tool
def get_pod_events_tool(pod_name: str, namespace: str = "default"):
    """Récupère les événements Kubernetes liés à un pod. Utile quand il n'y a pas de logs."""
    try:
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

@tool
def patch_pod_resources_tool(pod_name: str, memory_limit: str, namespace: str = "default"):
    """
    Modifie les limites de ressources d'un pod. 
    Exemple pour memory_limit: '256Mi', '512Mi'.
    À utiliser quand un diagnostic montre que le pod manque de mémoire.
    """
    try:
        # Dans un vrai SaaS, on ciblerait le 'Deployment' parent, 
        # mais pour le test, on définit le patch sur le pod.
        patch_body = {
            "spec": {
                "containers": [
                    {
                        "name": "crash", # Doit correspondre au nom du conteneur dans le pod
                        "resources": {
                            "limits": {"memory": memory_limit},
                            "requests": {"memory": memory_limit}
                        }
                    }
                ]
            }
        }
        
        # LIGNE RÉELLE (Commentée pour sécurité pendant les tests) :
        # v1.patch_namespaced_pod(name=pod_name, namespace=namespace, body=patch_body)
        
        return f"ACTION RÉUSSIE : La limite de mémoire pour {pod_name} a été fixée à {memory_limit}."
    except Exception as e:
        return f"Erreur lors de l'application du correctif : {e}"

# 3. Configuration de l'Agent
tools = [
    list_pods_tool, 
    get_pod_logs_tool, 
    get_pod_manifest_tool, 
    get_pod_events_tool,
    patch_pod_resources_tool
]

llm = ChatOpenAI(model="gpt-4o", temperature=0).bind(response_format={"type": "json_object"})

system_prompt = """Tu es un expert SRE autonome. Ta priorité est de RÉPARER les incidents.
1. Trouve les pods en échec.
2. Diagnostique la cause (logs, manifestes, événements).
3. SI tu détectes un manque de ressources (limits/requests nulles ou trop basses), TU DOIS utiliser patch_pod_resources_tool immédiatement pour fixer la limite à '256Mi'.
4. Réponds TOUJOURS en JSON final après avoir agi.
"""

# Création unique de l'agent avec le message système
agent_executor = create_react_agent(llm, tools, prompt=system_prompt)

# 4. Exécution
if __name__ == "__main__":
    prompt = "Vérifie les pods dans le namespace default. Si l'un d'eux a un problème, analyse ses logs."
    print("🤖 Analyse en cours...\n")
    
    for event in agent_executor.stream({"messages": [HumanMessage(content=prompt)]}):
        for node, value in event.items():
            last_msg = value["messages"][-1]
            
            if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
                print(f"🛠️  Action : {last_msg.tool_calls[0]['name']}")
            elif node == "tools":
                print(f"📥 Résultat : {last_msg.content}")
            elif node == "agent" and last_msg.content:
                print("\n📊 RAPPORT FINAL :")
                print(last_msg.content)