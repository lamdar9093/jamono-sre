"""
Registre central des intégrations Jamono.

Pour ajouter une nouvelle intégration :
1. Créer le provider dans integrations/
2. L'ajouter ici dans _register_providers()
3. C'est tout — le framework fait le reste.
"""

from integrations.base import IntegrationProvider, IntegrationType


class IntegrationRegistry:
    """Registre singleton de tous les providers disponibles."""

    _providers: dict[str, IntegrationProvider] = {}

    @classmethod
    def register(cls, provider: IntegrationProvider):
        """Enregistre un provider."""
        cls._providers[provider.type.value] = provider
        print(f"✅ [INTEGRATIONS] Provider enregistré : {provider.display_name}")

    @classmethod
    def get(cls, integration_type: str) -> IntegrationProvider | None:
        """Retourne un provider par son type."""
        return cls._providers.get(integration_type)

    @classmethod
    def list_all(cls) -> list[dict]:
        """Liste tous les providers disponibles pour l'UI."""
        return [
            {
                "type": p.type.value,
                "category": p.category.value,
                "display_name": p.display_name,
                "description": p.description,
                "icon": p.icon,
                "config_schema": {
                    "fields": [f for f in p.config_schema.fields]
                },
            }
            for p in cls._providers.values()
        ]

    @classmethod
    def get_by_category(cls, category: str) -> list[dict]:
        """Liste les providers d'une catégorie."""
        return [
            info for info in cls.list_all()
            if info["category"] == category
        ]


def init_registry():
    """Enregistre tous les providers au démarrage."""

    # ── Ticketing ──
    from integrations.jira_provider import JiraProvider
    IntegrationRegistry.register(JiraProvider())

    # ── Communication ──
    from integrations.teams_provider import TeamsProvider
    IntegrationRegistry.register(TeamsProvider())

    # ── Futurs providers (décommenter quand prêts) ──
    # from integrations.servicenow_provider import ServiceNowProvider
    # IntegrationRegistry.register(ServiceNowProvider())
    #
    # from integrations.github_provider import GitHubProvider
    # IntegrationRegistry.register(GitHubProvider())
    #
    # from integrations.opsgenie_provider import OpsGenieProvider
    # IntegrationRegistry.register(OpsGenieProvider())
    #
    # from integrations.pagerduty_provider import PagerDutyProvider
    # IntegrationRegistry.register(PagerDutyProvider())

    print(f"✅ [INTEGRATIONS] {len(IntegrationRegistry._providers)} provider(s) chargé(s)")