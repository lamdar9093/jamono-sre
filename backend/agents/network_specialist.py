from utils.llm_factory import get_llm
from langgraph.prebuilt import create_react_agent
from tools import network_tools # Importé via tools/__init__.py

llm = get_llm().bind(response_format={"type": "json_object"})

system_prompt = """Tu es un expert SRE Réseau. 
Ton but est de vérifier la connectivité des services et des ingress.
Réponds toujours en JSON avec : service_name, status, latency_check, recommendation.
"""

# Création de l'agent réseau
network_agent_executor = create_react_agent(llm, network_tools, prompt=system_prompt)