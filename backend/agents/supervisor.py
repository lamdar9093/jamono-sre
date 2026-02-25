from utils.llm_factory import get_llm
from langchain_core.messages import HumanMessage, SystemMessage
import json

llm = get_llm().bind(response_format={"type": "json_object"})

# On définit les membres de l'équipe
MEMBERS = ["K8S_EXPERT", "NETWORK_EXPERT"]

system_prompt = """Tu es le Superviseur SRE. 
Ton rôle est de déléguer la tâche à l'expert approprié : K8S_EXPERT ou NETWORK_EXPERT.

RÈGLES CRITIQUES :
1. Tu dois transmettre l'identité de l'utilisateur et ses consignes de sécurité dans l'instruction.
2. Si l'utilisateur donne une consigne (ex: "ne pas patcher"), l'instruction pour l'expert DOIT commencer par "CONSIGNE DE SÉCURITÉ : ...".

Réponds UNIQUEMENT en JSON : {"next_agent": "K8S_EXPERT", "instruction": "..."}"""

def supervisor_router(user_input: str):
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_input)
    ]
    
    # On force le format JSON pour le choix
    response = llm.bind(response_format={"type": "json_object"}).invoke(messages)
    decision = json.loads(response.content)
    
    return decision