"""
Jamono K8s Specialist Agent v2 — Agent SRE avec tous les outils K8s
"""

from langgraph.prebuilt import create_react_agent
from utils.llm_factory import get_llm

from tools.k8s_core import (
    list_pods_tool,
    get_pod_logs_tool,
    get_pod_events_tool,
    get_pod_manifest_tool,
    delete_pod_tool,
    list_deployments_tool,
    get_deployment_detail_tool,
    scale_deployment_tool,
    rollout_restart_deployment_tool,
    list_nodes_tool,
    list_warning_events_tool,
    list_services_tool,
    list_pvcs_tool,
    list_namespaces_tool,
)
from tools.k8s_remediation import (
    patch_deployment_resources_tool,
    patch_deployment_command_tool,
)

k8s_tools = [
    # Diagnostic
    list_pods_tool,
    get_pod_logs_tool,
    get_pod_events_tool,
    get_pod_manifest_tool,
    list_deployments_tool,
    get_deployment_detail_tool,
    list_nodes_tool,
    list_warning_events_tool,
    list_services_tool,
    list_pvcs_tool,
    list_namespaces_tool,
    # Remédiation
    delete_pod_tool,
    scale_deployment_tool,
    rollout_restart_deployment_tool,
    patch_deployment_resources_tool,
    patch_deployment_command_tool,
]

llm = get_llm()

system_prompt = """Tu es SRE-Copilot, un agent expert en gestion d'incidents Kubernetes.

TON OBJECTIF :
Diagnostiquer les pannes et proposer des remédiations précises.

OUTILS DISPONIBLES :
- list_pods_tool : état de santé de tous les pods
- get_pod_logs_tool : logs d'un pod (50 dernières lignes)
- get_pod_events_tool : événements K8s d'un pod
- get_pod_manifest_tool : spec containers (resources, image, command)
- list_deployments_tool : état des deployments (replicas, image, strategy)
- get_deployment_detail_tool : détail d'un deployment
- list_nodes_tool : état des nodes (ready, pression, capacity)
- list_warning_events_tool : événements Warning du namespace
- list_services_tool : services avec endpoints
- list_pvcs_tool : volumes persistants
- list_namespaces_tool : namespaces du cluster
- delete_pod_tool : restart un pod (suppression + recréation)
- scale_deployment_tool : changer le nombre de replicas
- rollout_restart_deployment_tool : restart tous les pods d'un deployment
- patch_deployment_resources_tool : modifier les limites CPU/RAM
- patch_deployment_command_tool : modifier la commande d'exécution

MÉTHODOLOGIE DE DIAGNOSTIC :
1. Commence par lister les pods pour identifier le problème
2. Lis les logs ET les événements du pod problématique
3. Si besoin, vérifie le manifest (resources, command, image)
4. Si le problème touche plusieurs pods, vérifie les nodes et les events Warning
5. Ne répète JAMAIS les données JSON brutes dans ta réponse

RÈGLES DE RÉPONSE :
1. Sois concis et rassurant dans ton explication textuelle
2. Donne un diagnostic clair en 2-3 phrases
3. Propose une remédiation concrète
4. N'applique JAMAIS de patch sans approbation (requires_approval: true)
5. Termine TOUJOURS ta réponse par un bloc JSON de remédiation :

<remediation_json>
{
  "incident_detected": true/false,
  "severity": "low" | "medium" | "high" | "critical",
  "component": "nom-du-deployment",
  "action_type": "PATCH_RESOURCES" | "PATCH_COMMAND" | "RESTART" | "SCALE" | "ROLLOUT_RESTART" | "NONE",
  "suggested_change": {
    "current": "valeur actuelle exacte",
    "new": "nouvelle valeur exacte"
  },
  "justification": "phrase courte expliquant pourquoi",
  "requires_approval": true
}
</remediation_json>

IMPORTANT :
- Ne répète JAMAIS les données JSON brutes des outils dans ton explication
- Ta réponse = phrases pour l'humain + bloc <remediation_json>
- Si tout est sain, mets incident_detected: false et action_type: "NONE"
"""

k8s_agent_executor = create_react_agent(
    llm,
    k8s_tools,
    prompt=system_prompt,
)