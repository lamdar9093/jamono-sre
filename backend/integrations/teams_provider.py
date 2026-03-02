"""
Intégration Microsoft Teams — webhook entrant pour commencer.
Phase ultérieure : Bot Framework pour bidirectionnel.
"""

import requests
from integrations.base import (
    IntegrationProvider, IntegrationType, IntegrationCategory,
    IntegrationConfig, IntegrationAction,
)


class TeamsProvider(IntegrationProvider):

    @property
    def type(self) -> IntegrationType:
        return IntegrationType.TEAMS

    @property
    def category(self) -> IntegrationCategory:
        return IntegrationCategory.COMMUNICATION

    @property
    def display_name(self) -> str:
        return "Microsoft Teams"

    @property
    def description(self) -> str:
        return "Envoyer des notifications d'incidents dans un canal Teams"

    @property
    def icon(self) -> str:
        return "teams"

    @property
    def config_schema(self) -> IntegrationConfig:
        return IntegrationConfig(fields=[
            {"key": "webhook_url", "label": "Webhook URL", "type": "password", "required": True, "placeholder": "https://outlook.office.com/webhook/..."},
            {"key": "channel_name", "label": "Nom du canal", "type": "text", "required": False, "placeholder": "#incidents"},
            {"key": "auto_notify", "label": "Notifier automatiquement", "type": "toggle", "required": False},
        ])

    def validate_credentials(self, credentials: dict) -> bool:
        """Vérifie que le webhook URL est valide en envoyant un test."""
        try:
            url = credentials.get("webhook_url", "")
            if not url:
                return False
            # Envoyer un message de test
            payload = {
                "@type": "MessageCard",
                "summary": "Test Jamono",
                "sections": [{
                    "activityTitle": "✅ Connexion Jamono réussie",
                    "text": "L'intégration Microsoft Teams est configurée.",
                }],
            }
            resp = requests.post(url, json=payload, timeout=10)
            return resp.status_code == 200
        except Exception:
            return False

    def on_incident_created(self, incident: dict, config: dict) -> IntegrationAction:
        """Poste une carte d'incident dans Teams."""
        try:
            url = config.get("webhook_url")
            if not url:
                return IntegrationAction(success=False, message="Webhook URL manquant")

            severity = incident.get("severity", "medium")
            severity_color = {
                "critical": "FF0000",
                "high": "FF6B00",
                "medium": "FFB800",
                "low": "34D399",
            }.get(severity, "FFB800")

            payload = {
                "@type": "MessageCard",
                "themeColor": severity_color,
                "summary": f"Incident #{incident['id']} — {incident['title']}",
                "sections": [{
                    "activityTitle": f"🚨 Incident #{incident['id']} — {severity.upper()}",
                    "activitySubtitle": incident["title"],
                    "facts": [
                        {"name": "Sévérité", "value": severity.upper()},
                        {"name": "Environnement", "value": incident.get("environment", "prod")},
                        {"name": "Pod lié", "value": incident.get("linked_pod") or "—"},
                        {"name": "Assigné à", "value": incident.get("assigned_to") or "Non assigné"},
                        {"name": "Source", "value": incident.get("source", "manual")},
                    ],
                    "text": incident.get("description") or "Aucune description",
                }],
            }

            resp = requests.post(url, json=payload, timeout=10)

            if resp.status_code == 200:
                print(f"✅ [TEAMS] Notification envoyée pour incident #{incident['id']}")
                return IntegrationAction(success=True, message="Notification Teams envoyée")
            return IntegrationAction(success=False, message=f"Erreur Teams: {resp.status_code}")

        except Exception as e:
            return IntegrationAction(success=False, message=str(e))

    def on_incident_updated(self, incident: dict, new_status: str, config: dict) -> IntegrationAction:
        """Poste une mise à jour de statut dans Teams."""
        try:
            url = config.get("webhook_url")
            if not url:
                return IntegrationAction(success=False, message="Webhook URL manquant")

            status_emoji = {
                "in_progress": "🔧", "resolved": "✅",
                "watching": "👁", "open": "🔴",
            }.get(new_status, "ℹ️")

            payload = {
                "@type": "MessageCard",
                "summary": f"Incident #{incident['id']} — {new_status}",
                "sections": [{
                    "activityTitle": f"{status_emoji} Incident #{incident['id']} — Statut: {new_status}",
                    "text": f"Le statut a été mis à jour par {incident.get('assigned_to', 'admin')}.",
                }],
            }

            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                return IntegrationAction(success=True, message="Update Teams envoyée")
            return IntegrationAction(success=False, message=f"Erreur: {resp.status_code}")

        except Exception as e:
            return IntegrationAction(success=False, message=str(e))

    def on_incident_resolved(self, incident: dict, config: dict) -> IntegrationAction:
        """Notifie Teams que l'incident est résolu."""
        return self.on_incident_updated(incident, "resolved", config)