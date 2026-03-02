"""
Base abstraite pour tous les connecteurs d'intégration Jamono.

Chaque intégration (Jira, Teams, ServiceNow, GitHub, etc.) hérite de IntegrationProvider
et implémente les méthodes requises. Le framework s'occupe du reste :
- Stockage des credentials (chiffrés)
- Activation/désactivation
- Dispatch des actions depuis les incidents
- Webhooks entrants

Pour ajouter une nouvelle intégration :
1. Créer un fichier `mon_provider.py`
2. Hériter de IntegrationProvider
3. Implémenter les méthodes abstraites
4. Enregistrer dans registry.py
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from enum import Enum


class IntegrationType(str, Enum):
    """Types d'intégrations supportés — extensible."""
    JIRA = "jira"
    SLACK = "slack"
    TEAMS = "teams"
    SERVICENOW = "servicenow"
    GITHUB = "github"
    OPSGENIE = "opsgenie"
    PAGERDUTY = "pagerduty"
    WEBHOOK = "webhook"


class IntegrationCategory(str, Enum):
    """Catégories pour l'UI et le filtrage."""
    TICKETING = "ticketing"        # Jira, ServiceNow, GitHub Issues
    COMMUNICATION = "communication" # Slack, Teams
    ALERTING = "alerting"          # OpsGenie, PagerDuty
    CUSTOM = "custom"              # Webhooks génériques


@dataclass
class IntegrationConfig:
    """Configuration requise pour connecter une intégration."""
    fields: list[dict] = field(default_factory=list)
    # Chaque field : {"key": "api_token", "label": "API Token", "type": "password", "required": True}


@dataclass
class IntegrationAction:
    """Résultat d'une action exécutée par un provider."""
    success: bool
    external_id: str | None = None   # ID dans le système externe (ex: JIRA-123)
    external_url: str | None = None  # URL vers la ressource externe
    message: str = ""
    data: dict = field(default_factory=dict)


class IntegrationProvider(ABC):
    """
    Classe abstraite que chaque intégration doit implémenter.
    
    Cycle de vie :
    1. validate_credentials() — vérifie que la connexion fonctionne
    2. on_incident_created() — appelé quand un incident est créé
    3. on_incident_updated() — appelé quand un statut change
    4. on_incident_resolved() — appelé quand un incident est résolu
    5. handle_webhook() — traite les webhooks entrants du système externe
    """

    @property
    @abstractmethod
    def type(self) -> IntegrationType:
        """Type unique de l'intégration."""
        ...

    @property
    @abstractmethod
    def category(self) -> IntegrationCategory:
        """Catégorie de l'intégration."""
        ...

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Nom affiché dans l'UI."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Description courte."""
        ...

    @property
    @abstractmethod
    def icon(self) -> str:
        """Identifiant d'icône pour le frontend."""
        ...

    @property
    @abstractmethod
    def config_schema(self) -> IntegrationConfig:
        """Schéma des champs requis pour la configuration."""
        ...

    @abstractmethod
    def validate_credentials(self, credentials: dict) -> bool:
        """
        Vérifie que les credentials sont valides.
        Appelé lors du connect — doit faire un appel réel au service externe.
        Retourne True si la connexion fonctionne.
        """
        ...

    @abstractmethod
    def on_incident_created(self, incident: dict, config: dict) -> IntegrationAction:
        """
        Appelé quand un incident est créé.
        Ex: créer un ticket Jira, poster dans Teams, etc.
        """
        ...

    @abstractmethod
    def on_incident_updated(self, incident: dict, new_status: str, config: dict) -> IntegrationAction:
        """
        Appelé quand le statut d'un incident change.
        Ex: mettre à jour le ticket Jira, poster une update Slack.
        """
        ...

    @abstractmethod
    def on_incident_resolved(self, incident: dict, config: dict) -> IntegrationAction:
        """
        Appelé quand un incident est résolu.
        Ex: fermer le ticket Jira, archiver le canal Slack.
        """
        ...

    def handle_webhook(self, payload: dict, config: dict) -> IntegrationAction:
        """
        Traite un webhook entrant du système externe.
        Optionnel — pas toutes les intégrations en ont besoin.
        Ex: Jira notifie que le ticket est passé "Done".
        """
        return IntegrationAction(success=False, message="Webhooks non supportés pour cette intégration")

    def test_connection(self, credentials: dict) -> dict:
        """
        Test de connexion avec détails — utilisé par l'UI.
        Retourne {"connected": bool, "message": str, "details": dict}
        """
        try:
            valid = self.validate_credentials(credentials)
            return {
                "connected": valid,
                "message": "Connexion réussie" if valid else "Échec de la connexion",
                "details": {},
            }
        except Exception as e:
            return {
                "connected": False,
                "message": f"Erreur: {str(e)}",
                "details": {},
            }