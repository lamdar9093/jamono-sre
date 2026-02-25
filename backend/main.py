import os
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from agents.supervisor import supervisor_router
from agents.k8s_specialist import k8s_agent_executor as k8s_agent
from agents.network_specialist import network_agent_executor as net_agent

load_dotenv()

def run_sre_system(user_prompt: str, thread_id: str = "default_incident"):
    # 1. Triage
    decision = supervisor_router(user_prompt)
    target = decision.get("next_agent")
    instruction = decision.get("instruction")
    
    # Configuration de la mémoire pour cette session
    config = {"configurable": {"thread_id": thread_id}}
    
    agents_map = {"K8S_EXPERT": k8s_agent, "NETWORK_EXPERT": net_agent}
    selected_agent = agents_map.get(target)
    
    final_report = "" # pour stocker la réponse finale de l'agent

    if selected_agent:
# On capture les événements du stream
        events = selected_agent.stream(
            {"messages": [HumanMessage(content=instruction)]}, 
            config=config
        )
        print(f"🚀 [SUPERVISOR] -> {target} (Session: {thread_id})")
        # On passe la config ici pour activer la mémoire SQLite
        for event in events:
                    # Un event ressemble à : {'agent': {'messages': [...]}}
                    # On itère sur les valeurs pour ne pas dépendre du nom 'agent'
                    for value in event.values():
                        if "messages" in value:
                            last_msg = value["messages"][-1]
                            # On ne prend que les messages de type AI (pas les appels d'outils)
                            if hasattr(last_msg, "content") and last_msg.content:
                                final_report += last_msg.content
        # Debug console pour être sûr
        print(f"DEBUG FINAL : {final_report}") 
            
        return final_report.strip() if final_report else "L'agent n'a rien renvoyé."

if __name__ == "__main__":
    # Premier appel : On définit le contexte
    print("\n--- 1. ENREGISTREMENT ---")
    run_sre_system("Je m'appelle Jamono. Ne patche jamais rien sans me demander.", "incident_456")
    
    # Deuxième appel : On vérifie si l'expert K8S a hérité du contexte via le Superviseur
    print("\n--- 2. VÉRIFICATION ---")
    run_sre_system("Quel est mon nom et quelle est ta consigne de sécurité ?", "incident_456")