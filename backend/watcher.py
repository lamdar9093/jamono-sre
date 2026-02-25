import time
import requests
import json
import re

API_URL = "http://localhost:8000/chat"

def check_cluster_health():
    print("🔍 Scan du cluster en cours...")
    
    payload = {
        "message": "Liste l'état de santé des pods.",
        "thread_id": "auto_monitor"
    }
    
    try:
        response = requests.post(API_URL, json=payload)
        full_text = response.json().get("response", "")
        
        # 1. Extraction du JSON brut dans la réponse (souvent entre crochets)
        # On cherche si la donnée brute contient un pod UNHEALTHY
        has_real_issue = '"health": "UNHEALTHY"' in full_text or '"health_status": "UNHEALTHY"' in full_text

        if has_real_issue:
            print("\n🚨 VRAIE ALERTE DÉTECTÉE !")
            # On demande maintenant à l'agent de proposer une solution
            print("🤖 L'Agent prépare une suggestion...")
            # Ici tu pourrais renvoyer un second message pour demander la suggestion
            print(f"SRE-Copilot dit : {full_text}")
            print("\n💡 En attente de validation (OUI/NON)...")
        else:
            print("✅ Tout est nominal (RAS).")
            
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    while True:
        check_cluster_health()
        time.sleep(10) # On peut scanner plus vite si c'est léger