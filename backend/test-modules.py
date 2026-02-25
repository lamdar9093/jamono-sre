import langchain
import langgraph
import kubernetes
from langchain_openai import ChatOpenAI

def test_setup():
    print(f"✅ LangChain version: {langchain.__version__}")
    
    try:
        # Test de la config Kubernetes locale
        contexts, active_context = kubernetes.config.list_kube_config_contexts()
        print(f"✅ Kubernetes configuré. Contextes trouvés: {len(contexts)}")
    except Exception as e:
        print(f"⚠️ Kubernetes non configuré ou absent: {e}")

    print("\n🚀 Environnement prêt pour le développement agentique !")

if __name__ == "__main__":
    test_setup()