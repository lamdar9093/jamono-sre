"""
Jamono SRE System — Pipeline intelligent avec Knowledge Base
Flow: KB check → si trouvé → retourne sans LLM → sinon → LLM → save to KB → retourne
Fallback: KB → LLM → Rules Engine
"""

import os
import json
import re
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage
from agents.supervisor import supervisor_router
from agents.k8s_specialist import k8s_agent_executor as k8s_agent
from agents.network_specialist import network_agent_executor as net_agent
from knowledge_base import kb_search, kb_save, rules_lookup, _extract_error_pattern, _extract_component

load_dotenv()


def run_sre_system(user_prompt: str, thread_id: str = "default_incident"):
    """
    Pipeline SRE intelligent avec 3 niveaux de fallback :
    1. Knowledge Base (0 tokens)
    2. LLM Agent (tokens, sauvegarde dans KB)
    3. Rules Engine (0 tokens, solutions hardcodées)
    """
    
    # ── Détection de contexte pour le KB ──
    # Si le message contient des infos de pod/diagnostic, on cherche dans le KB
    kb_context = _extract_kb_context(user_prompt)
    
    if kb_context:
        # ── NIVEAU 1 : Recherche dans le Knowledge Base ──
        kb_result = kb_search(
            diagnostic=kb_context.get("diagnostic", ""),
            pod_name=kb_context.get("pod_name", ""),
        )
        
        if kb_result:
            entry = kb_result["entry"]
            match_type = kb_result["match_type"]
            confidence = entry["confidence"]
            
            print(f"📚 [KB] Match trouvé ({match_type}, confidence: {confidence}%): {entry['error_pattern']}")
            
            # Si haute confiance → retourne directement sans LLM
            if confidence >= 70:
                response = _format_kb_response(entry, match_type)
                return response
            
            # Si confiance moyenne → on ajoute le contexte KB au prompt LLM
            # Le LLM peut valider ou améliorer la solution
            print(f"📚 [KB] Confiance moyenne ({confidence}%), enrichissement du prompt LLM")
            user_prompt = _enrich_prompt_with_kb(user_prompt, entry)
    
    # ── NIVEAU 2 : LLM Agent ──
    try:
        response = _run_llm_agent(user_prompt, thread_id)
        
# Sauvegarder dans le KB uniquement si la remédiation a été appliquée avec succès par l'agent
        if kb_context and response and "SUCCÈS" in response:
            _save_to_kb_from_response(response, kb_context)
        
        return response
        
    except Exception as e:
        print(f"⚠️  [LLM] Erreur: {e}")
        
        # ── NIVEAU 3 : Rules Engine (fallback) ──
        if kb_context:
            rule = rules_lookup(kb_context.get("diagnostic", ""))
            if rule:
                print(f"📏 [RULES] Fallback rules engine: {rule['error_pattern']}")
                return _format_rules_response(rule)
        
        return f"Erreur de l'agent IA. Aucune solution trouvée dans le Knowledge Base ni dans les règles.\nErreur: {str(e)}"


def _run_llm_agent(user_prompt: str, thread_id: str) -> str:
    """Exécute le pipeline LLM classique (superviseur → agent)."""
    # Triage
    decision = supervisor_router(user_prompt)
    target = decision.get("next_agent")
    instruction = decision.get("instruction")
    
    config = {"configurable": {"thread_id": thread_id}}
    agents_map = {"K8S_EXPERT": k8s_agent, "NETWORK_EXPERT": net_agent}
    selected_agent = agents_map.get(target)
    
    final_report = ""
    
    if selected_agent:
        events = selected_agent.stream(
            {"messages": [HumanMessage(content=instruction)]},
            config=config
        )
        print(f"🚀 [SUPERVISOR] -> {target} (Session: {thread_id})")
        
        for event in events:
            for value in event.values():
                if "messages" in value:
                    last_msg = value["messages"][-1]
                    if hasattr(last_msg, "content") and last_msg.content:
                        final_report += last_msg.content
    
    return final_report.strip() if final_report else "L'agent n'a rien renvoyé."


def _extract_kb_context(prompt: str) -> dict | None:
    """
    Essaie d'extraire des infos utiles au KB depuis le prompt.
    Détecte les patterns K8s, noms de pods, etc.
    """
    patterns_keywords = [
        "crashloopbackoff", "oomkilled", "imagepullbackoff", "errimagepull",
        "terminated", "error", "unhealthy", "restart", "failed", "pending",
        "pod", "deployment", "crash", "erreur", "panne", "down",
    ]
    
    prompt_lower = prompt.lower()
    
    # Vérifier si le prompt contient des mots-clés K8s
    has_k8s_context = any(kw in prompt_lower for kw in patterns_keywords)
    
    if not has_k8s_context:
        return None
    
    # Extraire le nom du pod/deployment si mentionné
    pod_match = re.search(r'([a-z][a-z0-9]*(?:-[a-z0-9]+)+)', prompt_lower)
    pod_name = pod_match.group(1) if pod_match else ""
    
    # Extraire le diagnostic/erreur
    diagnostic = ""
    for pattern in ["CrashLoopBackOff", "OOMKilled", "ImagePullBackOff", "ErrImagePull",
                     "Terminated", "FailedScheduling", "Evicted", "CreateContainerConfigError"]:
        if pattern.lower() in prompt_lower:
            diagnostic = pattern
            break
    
    if not diagnostic:
        # Essayer de trouver un pattern après "erreur" ou "error"
        err_match = re.search(r'(?:erreur|error|problème|issue)[:\s]+(.+?)(?:\.|$)', prompt, re.I)
        if err_match:
            diagnostic = err_match.group(1).strip()
    
    if not diagnostic and not pod_name:
        return None
    
    return {
        "diagnostic": diagnostic,
        "pod_name": pod_name,
        "prompt": prompt,
    }


def _format_kb_response(entry: dict, match_type: str) -> str:
    """Formate une réponse depuis le KB (sans appel LLM)."""
    confidence_label = "haute" if entry["confidence"] >= 80 else "bonne"
    match_label = {
        "exact": "correspondance exacte",
        "pattern_component": "même pattern et composant",
        "pattern_only": "pattern similaire",
    }.get(match_type, match_type)
    
    response = f"""📚 **Solution trouvée dans le Knowledge Base** (confiance {confidence_label} : {entry['confidence']}%)
*Match : {match_label}*

**Pattern détecté :** {entry['error_pattern']}
**Composant :** {entry.get('component', 'N/A')}

**Diagnostic :**
{entry['diagnostic']}

**Solution :**
{entry['solution']}

**Action recommandée :** {entry.get('action_type', 'MANUAL')}

---
*Cette solution a été appliquée {entry['times_used']} fois (succès : {entry['times_succeeded']}). Source : {entry['source']}.*
*💡 Pour forcer un diagnostic IA complet, ajoutez "avec IA" à votre question.*"""

    # Si la solution a un payload d'action, l'inclure
    if entry.get("action_payload"):
        try:
            payload = json.loads(entry["action_payload"])
            response += f"\n\n<remediation_json>\n{json.dumps(payload, indent=2)}\n</remediation_json>"
        except:
            pass
    
    return response


def _format_rules_response(rule: dict) -> str:
    """Formate une réponse depuis le rules engine (fallback)."""
    return f"""📏 **Diagnostic basé sur les règles** (IA non disponible)

**Pattern détecté :** {rule['error_pattern']}
**Sévérité :** {rule.get('severity', 'medium')}

**Diagnostic :**
{rule['diagnostic']}

**Solution recommandée :**
{rule['solution']}

**Type d'action :** {rule.get('action_type', 'MANUAL')}

---
*Ce diagnostic provient du moteur de règles intégré. Pour un diagnostic plus précis, réessayez quand l'IA sera disponible.*"""


def _enrich_prompt_with_kb(original_prompt: str, kb_entry: dict) -> str:
    """Enrichit le prompt avec le contexte du KB pour le LLM."""
    return f"""{original_prompt}

[CONTEXTE KB] Une solution existante a été trouvée pour ce type de problème :
- Pattern: {kb_entry['error_pattern']}
- Diagnostic précédent: {kb_entry['diagnostic']}
- Solution précédente: {kb_entry['solution']}
- Confiance: {kb_entry['confidence']}%
Vérifie si cette solution est toujours pertinente et propose une meilleure si nécessaire."""


def _save_to_kb_from_response(response: str, context: dict) -> None:
    """Sauvegarde dans le KB uniquement si le LLM a trouvé un vrai diagnostic avec solution."""
    try:
        json_match = re.search(r"<remediation_json>(.*?)</remediation_json>", response, re.DOTALL)
        if not json_match:
            return  # Pas de remédiation → pas de sauvegarde
        
        try:
            payload = json.loads(json_match.group(1).strip())
        except:
            return
        
        # Ne sauvegarder que si un vrai incident a été détecté
        if not payload.get("incident_detected", False):
            return
        
        if payload.get("action_type", "NONE") == "NONE":
            return
        
        # Extraire la partie textuelle comme solution (sans les logs bruts)
        clean_response = re.sub(r"<remediation_json>.*?</remediation_json>", "", response, flags=re.DOTALL).strip()

# Retirer les JSON bruts (events, logs, manifests retournés par les tools)
        clean_response = re.sub(r'\[\{.*?\}\]', '', clean_response, flags=re.DOTALL).strip()
        clean_response = re.sub(r'\{\".*?\"\}', '', clean_response, flags=re.DOTALL).strip()
        clean_response = re.sub(r'\n{3,}', '\n\n', clean_response).strip()        

        # Filtrer les réponses qui sont juste des erreurs
        error_indicators = ["404", "not found", "impossible de lire", "n'existe pas", "erreur api"]
        if any(ind in clean_response.lower() for ind in error_indicators):
            return
        
        if len(clean_response) < 50:
            return  # Pas assez de contenu utile
        
        kb_save(
            diagnostic=context.get("diagnostic", ""),
            pod_name=context.get("pod_name", ""),
            solution=clean_response[:2000],
            action_type=payload.get("action_type", "MANUAL"),
            action_payload=payload,
            source="ai",
        )
    except Exception as e:
        print(f"⚠️  [KB] Erreur sauvegarde auto: {e}")


# ── CLI pour tests ──
if __name__ == "__main__":
    print("\n--- Test KB Search ---")
    result = kb_search("CrashLoopBackOff: back-off 5m0s", "crash-app2-85d9b6977-cqj5n")
    print(f"KB Result: {result}")
    
    print("\n--- Test Rules Fallback ---")
    rule = rules_lookup("OOMKilled")
    print(f"Rule: {rule}")
    
    print("\n--- Test Full Pipeline ---")
    response = run_sre_system("Analyse le pod crash-app2 qui a un CrashLoopBackOff", "test_session")
    print(response)