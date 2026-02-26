# Service Slack — création de canaux, envoi de messages et notifications d'incidents
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from settings import get_setting

def get_slack_client():
    token = get_setting("slack_bot_token")
    if not token:
        return None
    return WebClient(token=token)

def is_slack_enabled() -> bool:
    return str(get_setting("slack_enabled")).lower() == "true" and bool(get_setting("slack_bot_token"))

def create_incident_channel(incident_id: int, component: str) -> str | None:
    """Crée un canal Slack dédié à l'incident. Retourne le channel_id."""
    if not is_slack_enabled():
        return None
    if str(get_setting("slack_create_channel_per_incident")).lower() != "true":
        return None

    client = get_slack_client()
    # Nom du canal : incident-42-crash-app2 (sans caractères spéciaux)
    clean_component = component.replace("_", "-").replace(".", "-").lower()
    channel_name = f"incident-{incident_id}-{clean_component}"[:80]

    try:
        res = client.conversations_create(name=channel_name, is_private=False)
        channel_id = res["channel"]["id"]
        client.conversations_join(channel=channel_id)
        invite_oncall_members(channel_id)
        print(f"✅ [SLACK] Canal créé : #{channel_name} ({channel_id})")
        return channel_id
    except SlackApiError as e:
        # Canal déjà existant
        if e.response["error"] == "name_taken":
            print(f"⚠️  [SLACK] Canal #{channel_name} existe déjà")
            return None
        print(f"❌ [SLACK] Erreur création canal : {e.response['error']}")
        return None

def post_incident_briefing(channel_id: str, incident: dict):
    """Poste le message de briefing structuré dans le canal de l'incident."""
    if not is_slack_enabled() or not channel_id:
        return

    client = get_slack_client()

    severity_emoji = {
        "low": "🟡", "medium": "🟠", "high": "🔴", "critical": "🚨"
    }.get(incident.get("severity", "medium"), "🔴")

    source_label = {
        "auto": "🤖 Détection automatique",
        "manual": "👤 Créé manuellement",
        "watch": "👁 Surveillance"
    }.get(incident.get("source", "manual"), "manuel")

    text = f"""
{severity_emoji} *INCIDENT #{incident['id']} — {incident['severity'].upper()}*

*{incident['title']}*

> {incident.get('description') or 'Aucune description'}

*Détails :*
- Pod concerné : `{incident.get('linked_pod') or '—'}`
- Environnement : `{incident.get('environment', 'prod')}`
- Source : {source_label}
- Assigné à : {incident.get('assigned_to') or 'Non assigné'}

*Commandes disponibles :*
- `@Jamono status` — état actuel du pod
- `@Jamono analyse` — diagnostic IA complet  
- `@Jamono resolve` — fermer l'incident
- `@Jamono assign @username` — réassigner

_Incident ouvert le {incident.get('created_at', '')[:19].replace('T', ' à ')}_
""".strip()

    try:
        client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)
        print(f"✅ [SLACK] Briefing posté dans {channel_id}")
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur envoi message : {e.response['error']}")

def post_status_update(channel_id: str, incident_id: int, new_status: str, author: str = "admin"):
    """Poste une mise à jour de statut dans le canal."""
    if not is_slack_enabled() or not channel_id:
        return

    client = get_slack_client()

    status_emoji = {
        "in_progress": "🔧",
        "resolved": "✅",
        "watching": "👁",
        "open": "🔴"
    }.get(new_status, "ℹ️")

    status_label = {
        "in_progress": "En cours de résolution",
        "resolved": "Résolu",
        "watching": "En surveillance",
        "open": "Ouvert"
    }.get(new_status, new_status)

    text = f"{status_emoji} *Incident #{incident_id}* — Statut mis à jour : *{status_label}* par `{author}`"

    try:
        client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)
        print(f"✅ [SLACK] Update statut posté")
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur update statut : {e.response['error']}")

def post_remediation_applied(channel_id: str, incident_id: int, component: str, change_before: str, change_after: str):
    """Notifie le canal qu'une remédiation a été appliquée."""
    if not is_slack_enabled() or not channel_id:
        return

    client = get_slack_client()
    text = f"🔧 *Remédiation appliquée sur l'incident #{incident_id}*\n• Composant : `{component}`\n• Changement : `{change_before}` → `{change_after}`"

    try:
        client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur remédiation notif : {e.response['error']}")

def notify_default_channel(message: str):
    """Envoie un message au canal par défaut configuré dans les paramètres."""
    if not is_slack_enabled():
        return

    client = get_slack_client()
    channel = get_setting("slack_default_channel") or "#incidents"

    try:
        client.chat_postMessage(channel=channel, text=message, mrkdwn=True)
        print(f"✅ [SLACK] Message envoyé dans {channel}")
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur canal défaut : {e.response['error']}")

def get_user_id_by_name(client: WebClient, username: str) -> str | None:
    """Trouve le Slack User ID à partir d'un username ou display name."""
    try:
        clean = username.lstrip("@").lower()
        res = client.users_list()
        for member in res["members"]:
            if (member.get("name", "").lower() == clean or
                member.get("profile", {}).get("display_name", "").lower() == clean or
                member.get("profile", {}).get("real_name", "").lower() == clean):
                return member["id"]
        return None
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur users_list : {e.response['error']}")
        return None

def invite_oncall_members(channel_id: str):
    """Invite automatiquement le membre on-call dans le canal de l'incident."""
    if not is_slack_enabled():
        return

    client = get_slack_client()

    from team import get_current_oncall
    oncall = get_current_oncall()

    if not oncall or not oncall.get("slack_username"):
        print("⚠️  [SLACK] Aucun membre on-call configuré")
        return

    uid = get_user_id_by_name(client, oncall["slack_username"])
    if not uid:
        print(f"⚠️  [SLACK] Membre on-call introuvable dans Slack : {oncall['slack_username']}")
        return

    try:
        client.conversations_invite(channel=channel_id, users=uid)
        print(f"✅ [SLACK] On-call {oncall['name']} invité dans {channel_id}")
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur invitation : {e.response['error']}")