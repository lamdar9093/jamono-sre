from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Any
import uuid
import re
import json
from main import run_sre_system

app = FastAPI(title="SRE Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    t_id = request.thread_id or f"sess_{uuid.uuid4().hex[:6]}"
    
    try:
        # 1. On récupère la réponse brute de l'agent
        full_response = run_sre_system(request.message, t_id)
        
        # 2. Logique d'extraction du JSON de remédiation
        remediation_data = None
        # On cherche ce qui est entre les balises <remediation_json>
        json_match = re.search(r"<remediation_json>(.*?)</remediation_json>", full_response, re.DOTALL)
        
        clean_explanation = full_response
        
        if json_match:
            try:
                # On parse le JSON pour qu'il soit un objet Python propre
                remediation_data = json.loads(json_match.group(1).strip())
                # On retire le bloc JSON du texte pour ne pas l'afficher à l'utilisateur
                clean_explanation = re.sub(r"<remediation_json>.*?</remediation_json>", "", full_response, flags=re.DOTALL).strip()
                # On retire aussi le petit message "💡 En attente de validation" s'il est présent, 
                # car le frontend affichera ses propres boutons.
                clean_explanation = clean_explanation.replace("💡 En attente de validation (OUI/NON)...", "").strip()
            except Exception as json_err:
                print(f"Erreur de parsing JSON: {json_err}")

        # 3. On renvoie une réponse structurée
        return {
            "status": "success",
            "thread_id": t_id,
            "response": clean_explanation, # Le texte pour le chat
            "remediation": remediation_data, # L'objet pour créer les boutons/diffs
            "has_action": remediation_data is not None
        }

    except Exception as e:
        print(f"API Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)