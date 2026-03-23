"""
Jamono Supervisor v2 — Routeur intelligent
Niveau 1 : Routing par règles (0 tokens)
Niveau 2 : LLM routing (fallback)
"""

import re
import json
from utils.llm_factory import get_llm
from langchain_core.messages import HumanMessage, SystemMessage

MEMBERS = ["K8S_EXPERT", "NETWORK_EXPERT"]

# ═══════════════════════════════════════════
# RÈGLES DE ROUTING — 0 tokens
# ═══════════════════════════════════════════

K8S_KEYWORDS = [
    "pod", "pods", "deployment", "deployments", "container", "namespace",
    "crashloopbackoff", "oomkilled", "imagepull", "restart", "restarts",
    "node", "nodes", "kubelet", "kubectl", "k8s", "kubernetes",
    "replica", "replicaset", "statefulset", "daemonset", "cronjob", "job",
    "pvc", "volume", "configmap", "secret", "hpa", "autoscal",
    "cpu", "memory", "ram", "mémoire", "ressource", "resource",
    "cluster", "unhealthy", "healthy", "failed", "pending", "evicted",
    "crash", "erreur", "error", "panne", "down", "log", "logs",
    "manifest", "yaml", "scale", "patch", "rollout", "rollback",
    "remédiation", "remediation", "diagnostic", "analyse", "scanner", "scan",
    "incident", "alerte", "alert",
]

NETWORK_KEYWORDS = [
    "service", "services", "ingress", "endpoint", "endpoints",
    "dns", "réseau", "network", "connexion", "connection",
    "latence", "latency", "timeout", "port", "ports",
    "loadbalancer", "clusterip", "nodeport",
    "http", "https", "tcp", "udp", "grpc",
    "connectivité", "connectivity", "joignable", "reachable",
    "502", "503", "504", "gateway",
]


def _rules_route(user_input: str) -> dict | None:
    """Routing par règles — 0 tokens, ultra-rapide."""
    input_lower = user_input.lower()

    k8s_score = sum(1 for kw in K8S_KEYWORDS if kw in input_lower)
    net_score = sum(1 for kw in NETWORK_KEYWORDS if kw in input_lower)

    # Seuil minimum pour être sûr
    if k8s_score == 0 and net_score == 0:
        return None  # Pas assez d'info → fallback LLM

    if k8s_score > net_score:
        return {
            "next_agent": "K8S_EXPERT",
            "instruction": user_input,
            "routing": "rules",
        }
    elif net_score > k8s_score:
        return {
            "next_agent": "NETWORK_EXPERT",
            "instruction": user_input,
            "routing": "rules",
        }
    else:
        # Égalité → K8S par défaut (plus fréquent en SRE)
        return {
            "next_agent": "K8S_EXPERT",
            "instruction": user_input,
            "routing": "rules_default",
        }


# ═══════════════════════════════════════════
# LLM ROUTING — fallback
# ═══════════════════════════════════════════

LLM_SYSTEM_PROMPT = """Tu es le Superviseur SRE. 
Ton rôle est de déléguer la tâche à l'expert approprié : K8S_EXPERT ou NETWORK_EXPERT.

K8S_EXPERT : problèmes de pods, deployments, containers, resources, crashes, logs, manifests, scaling.
NETWORK_EXPERT : problèmes de services, ingress, DNS, connectivité, latence, ports, endpoints.

Réponds UNIQUEMENT en JSON : {"next_agent": "K8S_EXPERT", "instruction": "..."}"""


def _llm_route(user_input: str) -> dict:
    """Routing par LLM — fallback quand les règles ne suffisent pas."""
    try:
        llm = get_llm().bind(response_format={"type": "json_object"})
        messages = [
            SystemMessage(content=LLM_SYSTEM_PROMPT),
            HumanMessage(content=user_input),
        ]
        response = llm.invoke(messages)
        decision = json.loads(response.content)
        decision["routing"] = "llm"
        return decision
    except Exception as e:
        print(f"⚠️  [SUPERVISOR] LLM routing failed: {e}")
        # Fallback absolu → K8S
        return {
            "next_agent": "K8S_EXPERT",
            "instruction": user_input,
            "routing": "fallback",
        }


# ═══════════════════════════════════════════
# ROUTER PRINCIPAL
# ═══════════════════════════════════════════

def supervisor_router(user_input: str) -> dict:
    """
    Route la requête vers le bon agent.
    1. Règles-based (0 tokens)
    2. LLM (fallback)
    """
    # Niveau 1 : règles
    result = _rules_route(user_input)
    if result:
        print(f"🧭 [SUPERVISOR] Rules routing → {result['next_agent']} (score-based)")
        return result

    # Niveau 2 : LLM
    print(f"🧭 [SUPERVISOR] LLM routing (no rules match)")
    return _llm_route(user_input)