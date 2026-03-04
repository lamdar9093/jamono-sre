"""
Manager des intégrations — orchestre les providers actifs pour chaque événement incident.

Responsabilités :
- CRUD des configurations d'intégration (DB)
- Dispatch des événements vers les providers actifs
- Lien entre incidents et ressources externes (incident_integrations)
"""

import json
from datetime import datetime
from database import SessionLocal
from models import Integration, IncidentIntegration
from integrations.registry import IntegrationRegistry


# ═══════════════════════════════════════════════════
# CRUD Intégrations
# ═══════════════════════════════════════════════════

def list_integrations() -> list:
    """Retourne toutes les intégrations configurées."""
    db = SessionLocal()
    try:
        rows = db.query(Integration).order_by(Integration.type).all()
        return [r.to_dict() for r in rows]
    finally:
        db.close()


def get_integration(integration_type: str) -> dict | None:
    db = SessionLocal()
    try:
        row = db.query(Integration).filter(Integration.type == integration_type).first()
        return row.to_dict() if row else None
    finally:
        db.close()


def get_integration_config(integration_type: str) -> dict | None:
    """Retourne la config déchiffrée d'une intégration active."""
    db = SessionLocal()
    try:
        row = db.query(Integration).filter(
            Integration.type == integration_type,
            Integration.is_active == True,
        ).first()
        if not row or not row.config_json:
            return None
        return json.loads(row.config_json)
    finally:
        db.close()


def connect_integration(integration_type: str, credentials: dict) -> dict:
    """
    Connecte une intégration :
    1. Valide les credentials via le provider
    2. Sauvegarde en DB
    """
    provider = IntegrationRegistry.get(integration_type)
    if not provider:
        raise ValueError(f"Provider '{integration_type}' non disponible")

    # Valider
    if not provider.validate_credentials(credentials):
        raise ValueError("Credentials invalides — connexion échouée")

    db = SessionLocal()
    try:
        now = datetime.now()
        existing = db.query(Integration).filter(Integration.type == integration_type).first()

        if existing:
            existing.config_json = json.dumps(credentials)
            existing.is_active = True
            existing.connected_at = now
        else:
            integration = Integration(
                type=integration_type,
                display_name=provider.display_name,
                category=provider.category.value,
                config_json=json.dumps(credentials),
                is_active=True,
                connected_at=now,
            )
            db.add(integration)

        db.commit()

        result = db.query(Integration).filter(Integration.type == integration_type).first()
        return result.to_dict()
    finally:
        db.close()


def disconnect_integration(integration_type: str):
    """Désactive une intégration (garde la config pour reconnexion facile)."""
    db = SessionLocal()
    try:
        db.query(Integration).filter(Integration.type == integration_type).update({
            "is_active": False,
        })
        db.commit()
    finally:
        db.close()


def delete_integration(integration_type: str):
    """Supprime complètement une intégration et ses données."""
    db = SessionLocal()
    try:
        db.query(Integration).filter(Integration.type == integration_type).delete()
        db.commit()
    finally:
        db.close()


def test_integration(integration_type: str, credentials: dict) -> dict:
    """Test de connexion sans sauvegarder."""
    provider = IntegrationRegistry.get(integration_type)
    if not provider:
        return {"connected": False, "message": f"Provider '{integration_type}' non disponible"}
    return provider.test_connection(credentials)


# ═══════════════════════════════════════════════════
# Dispatch — appelé par le cycle de vie des incidents
# ═══════════════════════════════════════════════════

def dispatch_incident_created(incident: dict, requested_actions: list[str] = None):
    """
    Dispatch l'événement 'incident créé' vers les intégrations.
    Si requested_actions est fourni, dispatch uniquement vers ces types.
    Ignore les flags auto_create/auto_notify — l'admin a choisi explicitement.
    """
    db = SessionLocal()
    try:
        actives = db.query(Integration).filter(Integration.is_active == True).all()
        for integration in actives:
            # Si actions ciblées, ne dispatch que vers celles demandées
            if requested_actions is not None:
                if integration.type not in requested_actions:
                    continue
            else:
                # Pas d'actions demandées = aucun dispatch
                return

            provider = IntegrationRegistry.get(integration.type)
            if not provider:
                continue

            config = json.loads(integration.config_json) if integration.config_json else {}

            try:
                result = provider.on_incident_created(incident, config)
                if result.success and result.external_id:
                    _save_incident_link(db, incident["id"], integration.type, result)
                    print(f"✅ [DISPATCH] {integration.display_name} → {result.external_id}")
                elif not result.success:
                    print(f"⚠️  [DISPATCH] {integration.display_name} échoué : {result.message}")
            except Exception as e:
                print(f"❌ [DISPATCH] Erreur {integration.display_name}: {e}")

        db.commit()
    finally:
        db.close()


def dispatch_incident_updated(incident: dict, new_status: str):
    """Dispatch l'événement 'statut changé' vers les intégrations actives."""
    db = SessionLocal()
    try:
        # Récupérer les liens existants pour cet incident
        links = db.query(IncidentIntegration).filter(
            IncidentIntegration.incident_id == incident["id"]
        ).all()

        for link in links:
            provider = IntegrationRegistry.get(link.integration_type)
            integration = db.query(Integration).filter(
                Integration.type == link.integration_type,
                Integration.is_active == True,
            ).first()

            if not provider or not integration:
                continue

            config = json.loads(integration.config_json) if integration.config_json else {}

            # Injecter l'ID externe dans l'incident pour le provider
            incident_with_link = {**incident, "jira_issue_key": link.external_id}

            try:
                if new_status == "resolved":
                    result = provider.on_incident_resolved(incident_with_link, config)
                else:
                    result = provider.on_incident_updated(incident_with_link, new_status, config)

                if result.success:
                    print(f"✅ [DISPATCH] Update {link.integration_type} → {link.external_id}")
            except Exception as e:
                print(f"❌ [DISPATCH] Erreur update {link.integration_type}: {e}")

        # Dispatch aussi vers les intégrations communication (sans lien)
        actives = db.query(Integration).filter(
            Integration.is_active == True,
            Integration.category == "communication",
        ).all()

        for integration in actives:
            provider = IntegrationRegistry.get(integration.type)
            if not provider:
                continue
            config = json.loads(integration.config_json) if integration.config_json else {}
            if not config.get("auto_notify"):
                continue
            try:
                if new_status == "resolved":
                    provider.on_incident_resolved(incident, config)
                else:
                    provider.on_incident_updated(incident, new_status, config)
            except Exception as e:
                print(f"❌ [DISPATCH] Erreur comm {integration.type}: {e}")
    finally:
        db.close()


def create_ticket_manual(incident_id: int, integration_type: str) -> dict:
    """Création manuelle d'un ticket (bouton UI) — ignore le flag auto_create."""
    from incidents import get_incident
    incident = get_incident(incident_id)
    if not incident:
        raise ValueError("Incident introuvable")

    provider = IntegrationRegistry.get(integration_type)
    if not provider:
        raise ValueError(f"Provider '{integration_type}' non disponible")

    config = get_integration_config(integration_type)
    if not config:
        raise ValueError(f"Intégration '{integration_type}' non connectée")

    result = provider.on_incident_created(incident, config)

    if result.success and result.external_id:
        db = SessionLocal()
        try:
            _save_incident_link(db, incident_id, integration_type, result)
            db.commit()
        finally:
            db.close()

    return {
        "success": result.success,
        "external_id": result.external_id,
        "external_url": result.external_url,
        "message": result.message,
    }


def get_incident_links(incident_id: int) -> list:
    """Retourne les liens externes d'un incident (tickets Jira, etc.)."""
    db = SessionLocal()
    try:
        links = db.query(IncidentIntegration).filter(
            IncidentIntegration.incident_id == incident_id
        ).all()
        return [l.to_dict() for l in links]
    finally:
        db.close()


# ═══════════════════════════════════════════════════
# Webhooks entrants
# ═══════════════════════════════════════════════════

def handle_integration_webhook(integration_type: str, payload: dict) -> dict:
    """Traite un webhook entrant et applique l'action sur l'incident Jamono."""
    provider = IntegrationRegistry.get(integration_type)
    if not provider:
        return {"success": False, "message": "Provider inconnu"}

    config = get_integration_config(integration_type)
    if not config:
        return {"success": False, "message": "Intégration non connectée"}

    result = provider.handle_webhook(payload, config)

    # Appliquer l'action si le webhook demande un changement
    if result.success and result.data.get("action"):
        action = result.data["action"]
        external_id = result.data.get("issue_key") or result.external_id

        if external_id:
            # Trouver l'incident lié
            db = SessionLocal()
            try:
                link = db.query(IncidentIntegration).filter(
                    IncidentIntegration.external_id == external_id,
                    IncidentIntegration.integration_type == integration_type,
                ).first()

                if link:
                    from incidents import update_incident_status
                    if action == "resolve":
                        update_incident_status(link.incident_id, "resolved", author=f"{integration_type}:webhook")
                    elif action == "in_progress":
                        update_incident_status(link.incident_id, "in_progress", author=f"{integration_type}:webhook")
                    print(f"✅ [WEBHOOK] {integration_type} → incident #{link.incident_id} → {action}")
            finally:
                db.close()

    return {"success": result.success, "message": result.message}


# ═══════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════

def _save_incident_link(db, incident_id: int, integration_type: str, result):
    """Sauvegarde le lien entre un incident et une ressource externe."""
    link = IncidentIntegration(
        incident_id=incident_id,
        integration_type=integration_type,
        external_id=result.external_id,
        external_url=result.external_url,
        created_at=datetime.now(),
    )
    db.add(link)