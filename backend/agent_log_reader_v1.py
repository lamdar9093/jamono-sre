import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
#from langchain.schema import HumanMessage, SystemMessage
from langchain_core.messages import HumanMessage, SystemMessage
from kubernetes import client, config

# 1. Charge le fichier .env automatiquement
load_dotenv()

# Charge le contexte Kube (utilise ~/.kube/config)
try:
    config.load_kube_config()
    v1 = client.CoreV1Api()
except Exception as e:
    print(f"❌ Erreur K8s: {e}")

# Configure LLM (La clé est lue automatiquement depuis l'environnement)
llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0
)

def get_pod_logs(namespace, pod_name, tail_lines=50):
    try:
        return v1.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            tail_lines=tail_lines
        )
    except Exception as e:
        return None # On retourne None pour indiquer un échec technique

def analyze_logs(logs):
    if not logs:
        return "Aucun log à analyser ou erreur de connexion K8s."

    messages = [
        SystemMessage(content="Tu es un expert SRE. Analyse les logs et réponds en JSON avec : error_type, probable_cause, severity."),
        HumanMessage(content=f"Logs à analyser :\n{logs}")
    ]
    
    # Utilisation de .bind pour forcer le format JSON (si supporté par le modèle)
    response = llm.invoke(messages)
    return response.content

if __name__ == "__main__":
    NAMESPACE = "default"
    POD_NAME = "crashpod"
    
    print(f"🔍 Récupération des logs pour {POD_NAME}...")
    pod_logs = get_pod_logs(NAMESPACE, POD_NAME)
    
    if pod_logs:
        print("📊 Analyse par l'IA en cours...")
        analysis = analyze_logs(pod_logs)
        print("\nRésultat :")
        print(analysis)
    else:
        print(f"❌ Impossible de trouver le pod ou les logs pour '{POD_NAME}'")