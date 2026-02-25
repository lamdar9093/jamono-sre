from langgraph.prebuilt import create_react_agent
from utils.llm_factory import get_llm
from langchain_core.tools import tool

# ON IMPORTE LES OUTILS EXISTANTS DEPUIS LE DOSSIER TOOLS
from tools.k8s_core import list_pods_tool, get_pod_logs_tool, get_pod_events_tool
from tools.k8s_remediation import patch_deployment_resources_tool
from tools.k8s_remediation import patch_deployment_command_tool

k8s_tools = [
    list_pods_tool,
    get_pod_logs_tool,
    get_pod_events_tool,
    patch_deployment_resources_tool,
    patch_deployment_command_tool
]

llm = get_llm()

system_prompt = """Tu es SRE-Copilot, un agent expert en gestion d'incidents Kubernetes.

TON OBJECTIF :
Diagnostiquer les pannes et proposer des remédiations précises.

RÈGLES DE RÉPONSE :
1. Analyse toujours les logs et les événements avant de conclure.
2. Sois concis et rassurant dans ton explication textuelle.
3. Termine TOUJOURS ta réponse par un bloc JSON formaté comme suit, entouré par des balises <remediation_json> :

<remediation_json>
{
  "incident_detected": true/false,
  "severity": "low" | "medium" | "high",
  "component": "nom-du-deployment",
  "action_type": "PATCH_RESOURCES" | "PATCH_COMMAND" | "RESTART" | "NONE",
  "suggested_change": {
    "current": "valeur actuelle",
    "new": "valeur proposée"
  },
  "justification": "phrase courte expliquant pourquoi",
  "requires_approval": true
}
</remediation_json>

"Ne répète JAMAIS les données JSON brutes ou les logs complets dans ton explication. Utilise-les uniquement pour forger ton diagnostic. 
Ta réponse doit être uniquement composée de phrases pour l'humain et du bloc <remediation_json>."
"""

k8s_agent_executor = create_react_agent(
    llm, 
    k8s_tools,
    prompt=system_prompt
)