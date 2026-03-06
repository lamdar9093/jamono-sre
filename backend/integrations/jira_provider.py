"""
Intégration Jira — création de tickets, sync de statut, webhooks.

Mapping incident Jamono → Jira :
- severity critical/high → Priority Highest/High
- severity medium/low → Priority Medium/Low
- environment → Label
- linked_pod → Component (si configuré)
- incident timeline → Commentaires Jira
"""

import requests
from requests.auth import HTTPBasicAuth
from integrations.base import (
    IntegrationProvider, IntegrationType, IntegrationCategory,
    IntegrationConfig, IntegrationAction,
)


SEVERITY_TO_PRIORITY = {
    "critical": "Highest",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
}

STATUS_TO_TRANSITION = {
    "in_progress": "In Progress",
    "resolved": "Done",
    "open": "To Do",
}


class JiraProvider(IntegrationProvider):

    @property
    def type(self) -> IntegrationType:
        return IntegrationType.JIRA

    @property
    def category(self) -> IntegrationCategory:
        return IntegrationCategory.TICKETING

    @property
    def display_name(self) -> str:
        return "Jira"

    @property
    def description(self) -> str:
        return "Créer et synchroniser des tickets Jira depuis les incidents"

    @property
    def icon(self) -> str:
        return "jira"

    @property
    def config_schema(self) -> IntegrationConfig:
        return IntegrationConfig(fields=[
            {"key": "base_url", "label": "URL Jira", "type": "text", "required": True, "placeholder": "https://company.atlassian.net"},
            {"key": "email", "label": "Email", "type": "text", "required": True, "placeholder": "user@company.com"},
            {"key": "api_token", "label": "API Token", "type": "password", "required": True, "placeholder": "Jira API token"},
            {"key": "project_key", "label": "Clé du projet", "type": "text", "required": True, "placeholder": "OPS"},
            {"key": "issue_type", "label": "Type de ticket", "type": "text", "required": False, "placeholder": "Bug"},
            {"key": "auto_create", "label": "Créer automatiquement", "type": "toggle", "required": False},
        ])

    def _get_auth(self, config: dict) -> tuple:
        return HTTPBasicAuth(config["email"], config["api_token"])

    def _get_base(self, config: dict) -> str:
        return config["base_url"].rstrip("/")

    def validate_credentials(self, credentials: dict) -> bool:
        try:
            url = f"{self._get_base(credentials)}/rest/api/3/myself"
            resp = requests.get(url, auth=self._get_auth(credentials), timeout=10)
            return resp.status_code == 200
        except Exception:
            return False

    def test_connection(self, credentials: dict) -> dict:
        try:
            url = f"{self._get_base(credentials)}/rest/api/3/myself"
            resp = requests.get(url, auth=self._get_auth(credentials), timeout=10)
            if resp.status_code == 200:
                user = resp.json()
                return {
                    "connected": True,
                    "message": f"Connecté en tant que {user.get('displayName', 'unknown')}",
                    "details": {"user": user.get("displayName"), "email": user.get("emailAddress")},
                }
            return {"connected": False, "message": f"Erreur HTTP {resp.status_code}", "details": {}}
        except Exception as e:
            return {"connected": False, "message": str(e), "details": {}}

    def on_incident_created(self, incident: dict, config: dict) -> IntegrationAction:
        """Crée un ticket Jira depuis l'incident."""
        try:
            base = self._get_base(config)
            auth = self._get_auth(config)
            project_key = config.get("project_key", "OPS")
            issue_type = config.get("issue_type", "Bug")

            # Construire le payload Jira
            severity = incident.get("severity", "medium")
            env = incident.get("environment", "prod")
            pod = incident.get("linked_pod", "")

            description_lines = [
                f"*Incident Jamono #{incident['id']}*",
                "",
                f"*Sévérité :* {severity.upper()}",
                f"*Environnement :* {env}",
                f"*Source :* {incident.get('source', 'manual')}",
            ]
            if pod:
                description_lines.append(f"*Pod lié :* `{pod}`")
            if incident.get("description"):
                description_lines.extend(["", incident["description"]])
            description_lines.extend([
                "",
                f"_Créé automatiquement par Jamono_",
            ])

            payload = {
                "fields": {
                    "project": {"key": project_key},
                    "summary": f"[INC-{incident['id']}] {incident['title']}",
                    "issuetype": {"name": issue_type},
                    "description": {
                        "version": 1,
                        "type": "doc",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": line}]
                            }
                            for line in description_lines if line
                        ],
                    },
                    "labels": [f"env:{env}", "jamono", f"severity:{severity}"],
                }
            }

            # Priority mapping (optionnel — dépend de la config Jira)
            priority_name = SEVERITY_TO_PRIORITY.get(severity)
            if priority_name:
                payload["fields"]["priority"] = {"name": priority_name}

            resp = requests.post(
                f"{base}/rest/api/3/issue",
                json=payload,
                auth=auth,
                headers={"Content-Type": "application/json"},
                timeout=15,
            )

            if resp.status_code in (200, 201):
                data = resp.json()
                issue_key = data.get("key", "")
                issue_url = f"{base}/browse/{issue_key}"
                print(f"✅ [JIRA] Ticket créé : {issue_key}")
                return IntegrationAction(
                    success=True,
                    external_id=issue_key,
                    external_url=issue_url,
                    message=f"Ticket {issue_key} créé",
                    data={"issue_key": issue_key, "issue_id": data.get("id")},
                )
            else:
                error = resp.text[:300]
                print(f"❌ [JIRA] Erreur création : {resp.status_code} — {error}")
                return IntegrationAction(success=False, message=f"Erreur Jira: {resp.status_code}")

        except Exception as e:
            print(f"❌ [JIRA] Exception : {e}")
            return IntegrationAction(success=False, message=str(e))

    def on_incident_updated(self, incident: dict, new_status: str, config: dict) -> IntegrationAction:
        """Ajoute un commentaire sur le ticket Jira."""
        external_id = incident.get("jira_issue_key")
        if not external_id:
            return IntegrationAction(success=False, message="Aucun ticket Jira lié")

        try:
            base = self._get_base(config)
            auth = self._get_auth(config)

            comment_payload = {
                "body": {
                    "version": 1,
                    "type": "doc",
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": f"Statut incident mis à jour : {new_status}"},
                            ],
                        }
                    ],
                }
            }

            resp = requests.post(
                f"{base}/rest/api/3/issue/{external_id}/comment",
                json=comment_payload,
                auth=auth,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

            if resp.status_code in (200, 201):
                return IntegrationAction(success=True, external_id=external_id, message="Commentaire ajouté")
            return IntegrationAction(success=False, message=f"Erreur commentaire: {resp.status_code}")

        except Exception as e:
            return IntegrationAction(success=False, message=str(e))

    def on_incident_resolved(self, incident: dict, config: dict) -> IntegrationAction:
        """Tente de transitionner le ticket Jira vers "Done"."""
        external_id = incident.get("jira_issue_key")
        if not external_id:
            return IntegrationAction(success=False, message="Aucun ticket Jira lié")

        try:
            base = self._get_base(config)
            auth = self._get_auth(config)

            # 1. Trouver l'ID de la transition "Done"
            resp = requests.get(
                f"{base}/rest/api/3/issue/{external_id}/transitions",
                auth=auth,
                timeout=10,
            )
            if resp.status_code != 200:
                return IntegrationAction(success=False, message="Impossible de lire les transitions")

            transitions = resp.json().get("transitions", [])
            done_transition = next(
                (t for t in transitions if t["name"].lower() in ("done", "terminé", "résolu", "closed")),
                None,
            )

            if not done_transition:
                # Fallback : juste ajouter un commentaire
                return self.on_incident_updated(incident, "resolved", config)

            # 2. Exécuter la transition
            resp = requests.post(
                f"{base}/rest/api/3/issue/{external_id}/transitions",
                json={"transition": {"id": done_transition["id"]}},
                auth=auth,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )

            if resp.status_code == 204:
                print(f"✅ [JIRA] Ticket {external_id} → Done")
                return IntegrationAction(success=True, external_id=external_id, message=f"Ticket {external_id} fermé")
            return IntegrationAction(success=False, message=f"Erreur transition: {resp.status_code}")

        except Exception as e:
            return IntegrationAction(success=False, message=str(e))

    def handle_webhook(self, payload: dict, config: dict) -> IntegrationAction:
        """
        Traite un webhook Jira.
        Si le ticket passe à "Done" → on peut résoudre l'incident Jamono.
        """
        try:
            event = payload.get("webhookEvent", "")
            issue = payload.get("issue", {})
            issue_key = issue.get("key", "")

            if "status" in event or event == "jira:issue_updated":
                changelog = payload.get("changelog", {})
                for item in changelog.get("items", []):
                    if item.get("field") == "status":
                        new_status = item.get("toString", "").lower()
                        if new_status in ("done", "terminé", "résolu", "closed"):
                            return IntegrationAction(
                                success=True,
                                external_id=issue_key,
                                message="resolve_incident",
                                data={"action": "resolve", "issue_key": issue_key},
                            )
                        elif new_status in ("in progress", "en cours"):
                            return IntegrationAction(
                                success=True,
                                external_id=issue_key,
                                message="update_status",
                                data={"action": "in_progress", "issue_key": issue_key},
                            )

            return IntegrationAction(success=True, message="Webhook reçu, aucune action requise")

        except Exception as e:
            return IntegrationAction(success=False, message=str(e))

    def discover_resources(self, resource_type: str, credentials: dict, **kwargs) -> list[dict]:
        """
        Découvre les ressources Jira :
        - "projects" → liste des projets accessibles
        - "issue_types" → types de tickets pour un projet donné (project_key requis)
        - "priorities" → priorités configurées dans l'instance
        """
        try:
            base = self._get_base(credentials)
            auth = self._get_auth(credentials)

            if resource_type == "projects":
                resp = requests.get(f"{base}/rest/api/3/project", auth=auth, timeout=10)
                if resp.status_code == 200:
                    return [
                        {"id": p["id"], "key": p["key"], "name": p["name"],
                         "avatar": p.get("avatarUrls", {}).get("24x24", "")}
                        for p in resp.json()
                    ]

            elif resource_type == "issue_types":
                project_key = kwargs.get("project_key", "")
                if not project_key:
                    return []
                resp = requests.get(
                    f"{base}/rest/api/3/project/{project_key}",
                    auth=auth, timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return [
                        {"id": it["id"], "name": it["name"],
                         "subtask": it.get("subtask", False),
                         "icon": it.get("iconUrl", "")}
                        for it in data.get("issueTypes", [])
                        if not it.get("subtask", False)
                    ]

            elif resource_type == "priorities":
                resp = requests.get(f"{base}/rest/api/3/priority", auth=auth, timeout=10)
                if resp.status_code == 200:
                    return [
                        {"id": p["id"], "name": p["name"],
                         "icon": p.get("iconUrl", "")}
                        for p in resp.json()
                    ]

            return []
        except Exception as e:
            print(f"❌ [JIRA] discover_resources({resource_type}): {e}")
            return []