"""
Jamono Knowledge Base — Système de résolution de patterns
3 niveaux :
  1. Pattern matching exact (signature hash) → 0 tokens
  2. Pattern matching fuzzy (error_pattern + component) → 0 tokens  
  3. LLM en dernier recours → tokens, mais sauvegarde le résultat

Usage:
  from knowledge_base import kb_search, kb_save, kb_record_outcome
"""

import hashlib
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from database import SessionLocal
from models import KnowledgeEntry


def _generate_signature(error_pattern: str, component: str = "", image: str = "") -> str:
    """Génère un hash unique pour un pattern d'erreur."""
    raw = f"{error_pattern.lower().strip()}|{component.lower().strip()}|{image.lower().strip()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


def _extract_error_pattern(diagnostic: str) -> str:
    """Extrait le pattern d'erreur principal depuis un diagnostic K8s."""
    if not diagnostic or diagnostic == "None":
        return "unknown"
    
    # Patterns K8s connus
    patterns = [
        "CrashLoopBackOff", "OOMKilled", "ImagePullBackOff", "ErrImagePull",
        "CreateContainerConfigError", "RunContainerError", "FailedScheduling",
        "FailedMount", "NodeNotReady", "Evicted", "DeadlineExceeded",
        "BackoffLimitExceeded", "InvalidImageName", "FailedCreate",
        "InsufficientMemory", "InsufficientCPU", "Terminated",
    ]
    
    for p in patterns:
        if p.lower() in diagnostic.lower():
            return p
    
    # Fallback: premier mot avant ":"
    if ":" in diagnostic:
        return diagnostic.split(":")[0].strip()
    
    return "unknown"


def _extract_component(pod_name: str) -> str:
    """Extrait le nom du déploiement depuis un nom de pod."""
    parts = pod_name.rsplit("-", 2)
    return parts[0] if len(parts) >= 3 else pod_name


# ═══════════════════════════════════════════
# SEARCH — Cherche dans le KB avant d'appeler le LLM
# ═══════════════════════════════════════════

def kb_search(diagnostic: str, pod_name: str = "", image: str = "") -> Optional[Dict[str, Any]]:
    """
    Cherche une solution dans le KB. Retourne la meilleure correspondance ou None.
    
    Ordre de recherche :
    1. Signature exacte (hash) — match parfait
    2. Pattern + component — même type d'erreur, même déploiement
    3. Pattern seul — même type d'erreur, n'importe quel composant
    
    Ne retourne que les solutions avec confidence >= 30.
    """
    error_pattern = _extract_error_pattern(diagnostic)
    component = _extract_component(pod_name) if pod_name else ""
    
    db = SessionLocal()
    try:
        # 1. Signature exacte
        signature = _generate_signature(error_pattern, component, image)
        exact = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.error_signature == signature,
            KnowledgeEntry.confidence >= 30,
        ).first()
        
        if exact:
            return {"match_type": "exact", "entry": exact.to_dict()}
        
        # 2. Pattern + component
        pattern_comp = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.error_pattern == error_pattern,
            KnowledgeEntry.component == component,
            KnowledgeEntry.confidence >= 30,
        ).order_by(KnowledgeEntry.confidence.desc()).first()
        
        if pattern_comp:
            return {"match_type": "pattern_component", "entry": pattern_comp.to_dict()}
        
        # 3. Pattern seul (plus large)
        pattern_only = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.error_pattern == error_pattern,
            KnowledgeEntry.confidence >= 50,  # Seuil plus élevé pour un match large
        ).order_by(KnowledgeEntry.confidence.desc()).first()
        
        if pattern_only:
            return {"match_type": "pattern_only", "entry": pattern_only.to_dict()}
        
        return None
    except Exception as e:
        print(f"⚠️  [KB] Erreur recherche: {e}")
        return None
    finally:
        db.close()


# ═══════════════════════════════════════════
# SAVE — Sauvegarde une solution après diagnostic IA
# ═══════════════════════════════════════════

def kb_save(
    diagnostic: str,
    pod_name: str,
    solution: str,
    action_type: str = "MANUAL",
    action_payload: Optional[Dict] = None,
    source: str = "ai",
    image: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Sauvegarde une solution dans le KB.
    Si la signature existe déjà, met à jour la solution et augmente la confiance.
    """
    error_pattern = _extract_error_pattern(diagnostic)
    component = _extract_component(pod_name) if pod_name else ""
    signature = _generate_signature(error_pattern, component, image)
    
    db = SessionLocal()
    try:
        existing = db.query(KnowledgeEntry).filter(
            KnowledgeEntry.error_signature == signature
        ).first()
        
        if existing:
            # Mise à jour — la solution IA est probablement meilleure/plus récente
            existing.diagnostic = diagnostic
            existing.solution = solution
            existing.action_type = action_type
            if action_payload:
                existing.action_payload = json.dumps(action_payload)
            existing.confidence = min(100, existing.confidence + 5)
            existing.updated_at = datetime.utcnow()
            db.commit()
            print(f"✅ [KB] Mis à jour: {error_pattern} → {component} (confidence: {existing.confidence})")
            return existing.to_dict()
        else:
            # Nouvelle entrée
            entry = KnowledgeEntry(
                error_pattern=error_pattern,
                error_signature=signature,
                component=component,
                diagnostic=diagnostic,
                solution=solution,
                action_type=action_type,
                action_payload=json.dumps(action_payload) if action_payload else None,
                confidence=50,  # Confiance initiale
                times_used=0,
                times_succeeded=0,
                times_failed=0,
                source=source,
            )
            db.add(entry)
            db.commit()
            print(f"✅ [KB] Nouvelle entrée: {error_pattern} → {component}")
            return entry.to_dict()
    except Exception as e:
        print(f"⚠️  [KB] Erreur sauvegarde: {e}")
        db.rollback()
        return None
    finally:
        db.close()


# ═══════════════════════════════════════════
# RECORD OUTCOME — Met à jour la confiance après application
# ═══════════════════════════════════════════

def kb_record_outcome(entry_id: int, success: bool) -> None:
    """
    Enregistre si la solution a fonctionné ou non.
    Ajuste la confiance en conséquence.
    """
    db = SessionLocal()
    try:
        entry = db.query(KnowledgeEntry).filter(KnowledgeEntry.id == entry_id).first()
        if not entry:
            return
        
        entry.times_used += 1
        entry.last_used_at = datetime.utcnow()
        
        if success:
            entry.times_succeeded += 1
            entry.confidence = min(100, entry.confidence + 10)
        else:
            entry.times_failed += 1
            entry.confidence = max(0, entry.confidence - 15)
        
        db.commit()
        print(f"📊 [KB] Outcome enregistré: #{entry.id} {'✓' if success else '✗'} (confidence: {entry.confidence})")
    except Exception as e:
        print(f"⚠️  [KB] Erreur outcome: {e}")
    finally:
        db.close()


# ═══════════════════════════════════════════
# LIST — Pour l'API et le frontend
# ═══════════════════════════════════════════

def kb_list(limit: int = 50) -> List[Dict[str, Any]]:
    """Retourne toutes les entrées du KB, triées par confiance."""
    db = SessionLocal()
    try:
        entries = db.query(KnowledgeEntry).order_by(
            KnowledgeEntry.confidence.desc(),
            KnowledgeEntry.times_used.desc(),
        ).limit(limit).all()
        return [e.to_dict() for e in entries]
    except Exception as e:
        print(f"⚠️  [KB] Erreur liste: {e}")
        return []
    finally:
        db.close()


def kb_stats() -> Dict[str, Any]:
    """Statistiques du KB."""
    db = SessionLocal()
    try:
        total = db.query(KnowledgeEntry).count()
        high_confidence = db.query(KnowledgeEntry).filter(KnowledgeEntry.confidence >= 80).count()
        total_uses = sum(e.times_used for e in db.query(KnowledgeEntry).all())
        total_success = sum(e.times_succeeded for e in db.query(KnowledgeEntry).all())
        patterns = db.query(KnowledgeEntry.error_pattern).distinct().count()
        
        return {
            "total_entries": total,
            "high_confidence": high_confidence,
            "total_uses": total_uses,
            "total_successes": total_success,
            "success_rate": round(total_success / total_uses * 100, 1) if total_uses > 0 else 0,
            "unique_patterns": patterns,
        }
    except Exception as e:
        return {"total_entries": 0, "error": str(e)}
    finally:
        db.close()


# ═══════════════════════════════════════════
# RULES ENGINE — Fallback niveau 3 (pas de LLM, pas de KB)
# ═══════════════════════════════════════════

RULES: Dict[str, Dict[str, Any]] = {
    "CrashLoopBackOff": {
        "diagnostic": "Le container redémarre en boucle. Causes fréquentes : erreur au démarrage, mauvaise commande, dépendance manquante.",
        "solution": "1. Vérifier les logs du container (kubectl logs)\n2. Vérifier la commande/entrypoint\n3. Vérifier les variables d'environnement\n4. Augmenter les resources si OOM",
        "action_type": "MANUAL",
        "severity": "high",
    },
    "OOMKilled": {
        "diagnostic": "Le container a dépassé sa limite mémoire et a été tué par le système.",
        "solution": "Augmenter la limite mémoire du container. Vérifier les fuites mémoire dans l'application.",
        "action_type": "PATCH_RESOURCES",
        "severity": "high",
    },
    "ImagePullBackOff": {
        "diagnostic": "Impossible de télécharger l'image du container. Registry inaccessible ou image inexistante.",
        "solution": "1. Vérifier le nom de l'image\n2. Vérifier les credentials du registry\n3. Vérifier la connectivité réseau",
        "action_type": "MANUAL",
        "severity": "medium",
    },
    "ErrImagePull": {
        "diagnostic": "Erreur lors du pull de l'image. Souvent lié aux permissions ou au nom de l'image.",
        "solution": "1. Vérifier le nom complet de l'image (registry/repo:tag)\n2. Vérifier le ImagePullSecret\n3. Tester manuellement: docker pull <image>",
        "action_type": "MANUAL",
        "severity": "medium",
    },
    "CreateContainerConfigError": {
        "diagnostic": "Erreur de configuration du container. ConfigMap ou Secret manquant/incorrect.",
        "solution": "1. Vérifier que les ConfigMaps référencés existent\n2. Vérifier que les Secrets référencés existent\n3. Vérifier les montages de volumes",
        "action_type": "MANUAL",
        "severity": "medium",
    },
    "FailedScheduling": {
        "diagnostic": "Le scheduler ne trouve pas de node pour placer le pod. Resources insuffisantes ou contraintes non satisfaites.",
        "solution": "1. Vérifier les resources disponibles sur les nodes\n2. Vérifier les nodeSelector/affinity\n3. Vérifier les tolerations/taints",
        "action_type": "MANUAL",
        "severity": "high",
    },
    "Evicted": {
        "diagnostic": "Le pod a été expulsé du node. Pression sur les resources du node (mémoire, disque, PID).",
        "solution": "1. Vérifier la pression sur le node (kubectl describe node)\n2. Réduire les resources des pods non critiques\n3. Ajouter des nodes au cluster",
        "action_type": "MANUAL",
        "severity": "high",
    },
    "Terminated": {
        "diagnostic": "Le container s'est terminé. Code de sortie non-zéro indiquant une erreur.",
        "solution": "1. Vérifier les logs du container\n2. Vérifier le code de sortie (exit code)\n3. Vérifier si l'application crash au démarrage",
        "action_type": "MANUAL",
        "severity": "medium",
    },
}


def rules_lookup(diagnostic: str) -> Optional[Dict[str, Any]]:
    """Fallback niveau 3 : règles hardcodées, 0 token."""
    pattern = _extract_error_pattern(diagnostic)
    rule = RULES.get(pattern)
    if rule:
        return {
            "source": "rules",
            "error_pattern": pattern,
            **rule,
        }
    return None