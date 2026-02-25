import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_anthropic import ChatAnthropic

load_dotenv()

def get_llm():
    """
    Récupère le LLM configuré via les variables d'environnement.
    Défaut : openai / gpt-4o
    """
    model_provider = os.getenv("LLM_PROVIDER", "openai").lower()
    
    if model_provider == "openai":
        return ChatOpenAI(model="gpt-4o", temperature=0)
    
    elif model_provider == "gemini":
        # vérifier l'installation de langchain-google-genai
        return ChatGoogleGenerativeAI(model="gemini-1.5-pro", temperature=0)
    
    elif model_provider == "anthropic":
        # vérifier l'installation de langchain-anthropic
        return ChatAnthropic(model="claude-3-5-sonnet-20240620", temperature=0)
    
    else:
        raise ValueError(f"Provider LLM '{model_provider}' non supporté.")