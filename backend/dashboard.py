import streamlit as st
import requests
import json

st.set_page_config(page_title="SRE Agentic Copilot", layout="wide")

st.title("🚀 SRE Agentic Copilot")
st.subheader("Surveillance en temps réel du cluster Kubernetes")

# Sidebar pour le statut du Watcher
st.sidebar.header("Paramètres")
api_url = st.sidebar.text_input("API URL", "http://localhost:8000/chat")

if "messages" not in st.session_state:
    st.session_state.messages = []

# --- Colonne de gauche : Chat & Analyse ---
col1, col2 = st.columns([2, 1])

with col1:
    st.write("### 🤖 Analyse de l'Agent")
    
    if st.button("Lancer un scan manuel", key="scan"):
        with st.spinner("L'agent analyse le cluster..."):
            try:
                r = requests.post(api_url, json={"message": "Analyse les pods. Donne un résumé lisible et garde les logs techniques pour plus tard.", "thread_id": "dashboard_sess"})
                data = r.json()
                st.session_state.last_response = data
            except Exception as e:
                st.error(f"Erreur : {e}")

    if "last_response" in st.session_state:
        response_text = st.session_state.last_response["response"]
        
        # On utilise une regex pour nettoyer si l'IA a laissé traîner des listes JSON [ ... ]
        import re
        clean_text = re.sub(r'\[{".*?}\]', '', response_text, flags=re.DOTALL)
        
        st.info("💡 **Résumé du diagnostic**")
        st.markdown(clean_text.strip()) 

        with st.expander("🔍 Voir le diagnostic technique complet"):
            st.markdown(
                f"""
                <div style="background-color: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px; white-space: pre-wrap; word-wrap: break-word; font-family: monospace;">
                    {response_text}
                </div>
                """, 
                unsafe_allow_html=True
            )

# --- Colonne de droite : Actions & Remédiation ---
with col2:
    st.write("### ⚡ Actions Requises")
    
    if "last_response" in st.session_state and st.session_state.last_response.get("remediation"):
        rem = st.session_state.last_response["remediation"]
        
        # Carte d'alerte haute ergonomie
        with st.expander(f"🚨 ALERTE : {rem['component']}", expanded=True):
            st.warning(f"**Gravité** : {rem['severity'].upper()}")
            st.write(f"**Cause** : {rem['justification']}")
            
            # Affichage du Diff
            st.info(f"**Action** : {rem['action_type']}\n\n**Projeté** : {rem['suggested_change']['new']}")
            
            if st.button("✅ Approuver et Appliquer", type="primary"):
                with st.spinner("Application du patch..."):
                    confirm_msg = f"OUI, applique le changement pour {rem['component']}"
                    requests.post(api_url, json={"message": confirm_msg, "thread_id": "dashboard_sess"})
                    st.success("Patch appliqué avec succès !")
    else:
        st.success("Aucun incident nécessitant une action.")