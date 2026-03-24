# Service Slack v2 — Messages enrichis Block Kit, boutons interactifs, escalade
import asyncio
import json
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from settings import get_setting

_bot_user_id: str | None = None

# ═══════════════════════════════════════════════════
# CLIENT & AUTH
# ═══════════════════════════════════════════════════

def get_slack_client():
    token = get_setting("slack_bot_token")
    if not token:
        return None
    return WebClient(token=token)

def get_bot_user_id() -> str | None:
    global _bot_user_id
    if _bot_user_id:
        return _bot_user_id
    client = get_slack_client()
    if not client:
        return None
    try:
        res = client.auth_test()
        _bot_user_id = res["user_id"]
    except Exception as e:
        print(f"❌ [SLACK] auth.test échoué : {e}")
    return _bot_user_id

def is_slack_enabled() -> bool:
    return str(get_setting("slack_enabled")).lower() == "true" and bool(get_setting("slack_bot_token"))


# ═══════════════════════════════════════════════════
# CHANNEL MANAGEMENT
# ═══════════════════════════════════════════════════

def create_incident_channel(incident_id: int, component: str) -> tuple[str, str] | None:
    """Crée un canal Slack dédié à l'incident. Retourne (channel_id, channel_name)."""
    if not is_slack_enabled():
        return None
    if str(get_setting("slack_create_channel_per_incident")).lower() != "true":
        return None

    import re
    client = get_slack_client()
    clean_component = re.sub(r'[^a-z0-9-]', '-', component.lower())
    clean_component = re.sub(r'-+', '-', clean_component).strip('-')
    channel_name = f"incident-{incident_id}-{clean_component}"[:80]

    try:
        res = client.conversations_create(name=channel_name, is_private=False)
        channel_id = res["channel"]["id"]
        client.conversations_join(channel=channel_id)
        invite_oncall_members(channel_id)
        print(f"✅ [SLACK] Canal créé : #{channel_name} ({channel_id})")
        return channel_id, f"#{channel_name}"
    except SlackApiError as e:
        if e.response["error"] == "name_taken":
            print(f"⚠️  [SLACK] Canal #{channel_name} existe déjà")
            return None
        print(f"❌ [SLACK] Erreur création canal : {e.response['error']}")
        return None


def invite_oncall_members(channel_id: str):
    """Invite automatiquement le membre on-call dans le canal."""
    if not is_slack_enabled():
        return
    client = get_slack_client()
    from team import get_current_oncall
    oncall = get_current_oncall()
    if not oncall or not oncall.get("slack_username"):
        return
    uid = get_user_id_by_name(client, oncall["slack_username"])
    if not uid:
        return
    try:
        client.conversations_invite(channel=channel_id, users=uid)
        print(f"✅ [SLACK] On-call {oncall['name']} invité dans {channel_id}")
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur invitation : {e.response['error']}")


# ═══════════════════════════════════════════════════
# MESSAGES ENRICHIS (BLOCK KIT)
# ═══════════════════════════════════════════════════

def _get_platform_url() -> str:
    """URL de base de la plateforme Jamono."""
    return get_setting("platform_url") or "http://localhost:5173"

def _severity_emoji(severity: str) -> str:
    return {"low": "🟡", "medium": "🟠", "high": "🔴", "critical": "🚨"}.get(severity, "🟠")

def _status_label(status: str) -> str:
    return {"open": "Ouvert", "in_progress": "En cours", "watching": "Surveillance", "resolved": "Résolu"}.get(status, status)


def post_incident_briefing(channel_id: str, incident: dict):
    """Poste le message de briefing enrichi et le pin dans le canal."""
    if not is_slack_enabled() or not channel_id:
        return

    client = get_slack_client()
    sev = incident.get("severity", "medium")
    sev_emoji = _severity_emoji(sev)
    platform_url = _get_platform_url()
    inc_id = incident["id"]

    # Set le topic du canal
    try:
        client.conversations_setTopic(channel=channel_id, topic=f"INC-{inc_id} · {sev.upper()} · {incident['title'][:60]}")
    except SlackApiError:
        pass

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*{incident['title']}*\n\n{incident.get('description') or '_Aucune description_'}"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Sévérité*\n{sev_emoji} {sev.capitalize()}"},
                {"type": "mrkdwn", "text": f"*Environnement*\n`{incident.get('environment', 'prod')}`"},
                {"type": "mrkdwn", "text": f"*Pod*\n`{incident.get('linked_pod') or '—'}`"},
                {"type": "mrkdwn", "text": f"*Responsable*\n{incident.get('assigned_to') or '_Non assigné_'}"},
            ]
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"🔗 <{platform_url}/incidents/{inc_id}|Voir dans Jamono> · 🕐 {incident.get('created_at', '')[:16].replace('T', ' à ')}"}
            ]
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "🙋 Me l'assigner", "emoji": True},
                    "action_id": f"assign_self_{inc_id}",
                    "value": str(inc_id),
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "🚀 Escalader", "emoji": True},
                    "action_id": f"escalate_{inc_id}",
                    "value": str(inc_id),
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "👀 Aperçu", "emoji": True},
                    "action_id": f"overview_{inc_id}",
                    "value": str(inc_id),
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "💬 Commandes", "emoji": True},
                    "action_id": f"commands_{inc_id}",
                    "value": str(inc_id),
                },
            ]
        },
    ]

    fallback_text = f"{sev_emoji} Incident #{inc_id} — {incident['title']}"

    try:
        result = client.chat_postMessage(channel=channel_id, text=fallback_text, blocks=blocks)
        # Pin le message
        try:
            client.pins_add(channel=channel_id, timestamp=result["ts"])
        except SlackApiError:
            pass
        print(f"✅ [SLACK] Briefing posté et pinné dans {channel_id}")
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur briefing : {e.response['error']}")
        _post_briefing_text(client, channel_id, incident)


def _post_briefing_text(client: WebClient, channel_id: str, incident: dict):
    """Fallback texte simple si Block Kit échoue."""
    sev_emoji = _severity_emoji(incident.get("severity", "medium"))
    text = f"{sev_emoji} *INCIDENT #{incident['id']} — {incident['severity'].upper()}*\n*{incident['title']}*\n> {incident.get('description') or 'Aucune description'}\n\nPod : `{incident.get('linked_pod') or '—'}` · Env : `{incident.get('environment', 'prod')}` · Assigné : {incident.get('assigned_to') or 'Non assigné'}"
    try:
        client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur fallback : {e.response['error']}")


def post_status_update(channel_id: str, incident_id: int, new_status: str, author: str = "admin"):
    """Poste une mise à jour de statut dans le canal."""
    if not is_slack_enabled() or not channel_id:
        return
    client = get_slack_client()
    status_emoji = {"in_progress": "🔧", "resolved": "✅", "watching": "👁", "open": "🔴"}.get(new_status, "ℹ️")
    status_label = _status_label(new_status)
    text = f"{status_emoji} *Incident #{incident_id}* — Statut : *{status_label}* par `{author}`"
    try:
        client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur update statut : {e.response['error']}")


def post_assignment_notification(channel_id: str, incident_id: int, user_id: str, user_name: str):
    """Notifie le canal qu'un membre a pris en charge l'incident."""
    if not is_slack_enabled() or not channel_id:
        return
    client = get_slack_client()
    platform_url = _get_platform_url()

    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"🙋 <@{user_id}> a pris en charge l'*Incident #{incident_id}*"}
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": "En tant que responsable, vous devez :"},
            ]
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "• Coordonner les efforts de résolution\n• S'assurer que chaque membre a ce qu'il faut\n• Communiquer les mises à jour régulières aux parties prenantes"}
        },
    ]

    try:
        client.chat_postMessage(channel=channel_id, text=f"🙋 {user_name} a pris en charge l'incident #{incident_id}", blocks=blocks)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur notification assignation : {e.response['error']}")


def post_escalation(channel_id: str, incident_id: int, from_user: str, target_user_id: str, message: str, priority: str = "haute"):
    """Envoie une escalade dans le canal + DM à la personne ciblée."""
    if not is_slack_enabled() or not channel_id:
        return
    client = get_slack_client()
    priority_emoji = {"urgente": "🚨", "haute": "🔴", "normale": "🟠", "basse": "🟡"}.get(priority, "🟠")

    # Message dans le canal
    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"{priority_emoji} *Escalade — Incident #{incident_id}*\n<@{from_user}> demande l'aide de <@{target_user_id}>"}
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"💬 _{message}_"}
        },
        {
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"Priorité : {priority_emoji} {priority.capitalize()}"}]
        },
    ]

    try:
        client.chat_postMessage(channel=channel_id, text=f"🚨 Escalade incident #{incident_id}", blocks=blocks)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur escalade canal : {e.response['error']}")

    # DM à la personne ciblée
    try:
        dm_text = f"{priority_emoji} *Vous avez été sollicité pour l'Incident #{incident_id}*\n\n<@{from_user}> a besoin de votre aide :\n> {message}\n\nRejoignez le canal <#{channel_id}> pour participer."
        client.chat_postMessage(channel=target_user_id, text=dm_text, mrkdwn=True)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur DM escalade : {e.response['error']}")


def post_remediation_applied(channel_id: str, incident_id: int, component: str, change_before: str, change_after: str):
    """Notifie le canal qu'une remédiation a été appliquée."""
    if not is_slack_enabled() or not channel_id:
        return
    client = get_slack_client()
    blocks = [
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"🔧 *Remédiation appliquée — Incident #{incident_id}*"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Composant :*\n`{component}`"},
                {"type": "mrkdwn", "text": f"*Changement :*\n`{change_before}` → `{change_after}`"},
            ]
        },
    ]
    try:
        client.chat_postMessage(channel=channel_id, text=f"🔧 Remédiation appliquée sur incident #{incident_id}", blocks=blocks)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur remédiation notif : {e.response['error']}")


def notify_default_channel(message: str):
    """Envoie un message au canal par défaut."""
    if not is_slack_enabled():
        return
    client = get_slack_client()
    channel = get_setting("slack_default_channel") or "#incidents"
    try:
        client.chat_postMessage(channel=channel, text=message, mrkdwn=True)
    except SlackApiError as e:
        print(f"❌ [SLACK] Erreur canal défaut : {e.response['error']}")


# ═══════════════════════════════════════════════════
# INTERACTIVE ACTIONS (boutons cliqués dans Slack)
# ═══════════════════════════════════════════════════

def handle_slack_interaction(payload: dict) -> dict:
    """
    Traite les interactions Slack (boutons cliqués dans les messages).
    Appelé par POST /slack/interactions dans api.py.
    """
    action = payload.get("actions", [{}])[0]
    action_id = action.get("action_id", "")
    user = payload.get("user", {})
    user_id = user.get("id", "")
    user_name = user.get("username", "inconnu")
    channel = payload.get("channel", {})
    channel_id = channel.get("id", "")
    incident_id_str = action.get("value", "0")

    try:
        incident_id = int(incident_id_str)
    except ValueError:
        return {"text": "Erreur : ID incident invalide"}

    if action_id.startswith("assign_self_"):
        return _handle_assign_self(incident_id, user_id, user_name, channel_id)
    elif action_id.startswith("overview_"):
        return _handle_overview(incident_id, channel_id)
    elif action_id.startswith("escalate_"):
        return _handle_escalate_prompt(incident_id, channel_id)
    elif action_id.startswith("commands_"):
        return _handle_commands(incident_id, channel_id)

    return {"text": "Action non reconnue"}


def _handle_assign_self(incident_id: int, user_id: str, user_name: str, channel_id: str) -> dict:
    """L'utilisateur se l'assigne à lui-même."""
    from incidents import update_incident_assignment
    try:
        update_incident_assignment(incident_id, user_name, author=f"slack:{user_name}")
        post_assignment_notification(channel_id, incident_id, user_id, user_name)
        return {"text": f"✅ Vous êtes maintenant responsable de l'incident #{incident_id}"}
    except Exception as e:
        return {"text": f"❌ Erreur : {e}"}


def _handle_overview(incident_id: int, channel_id: str) -> dict:
    """Affiche un résumé de l'incident dans un message éphémère."""
    from incidents import get_incident
    incident = get_incident(incident_id)
    if not incident:
        return {"text": "Incident introuvable"}

    platform_url = _get_platform_url()
    sev_emoji = _severity_emoji(incident.get("severity", "medium"))
    status = _status_label(incident.get("status", "open"))

    text = f"""*INC-{incident_id} — Aperçu*

*{incident['title']}*
{incident.get('description') or '_Aucune description_'}

{sev_emoji} *Sévérité :* {incident.get('severity', '—').capitalize()}
📊 *Statut :* {status}
👤 *Responsable :* {incident.get('assigned_to') or '_Non assigné_'}
🌐 *Environnement :* {incident.get('environment', '—')}

🔗 <{platform_url}/incidents/{incident_id}|Ouvrir dans Jamono>"""

    client = get_slack_client()
    if client:
        try:
            client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)
        except SlackApiError:
            pass
    return {"text": text}


def _handle_escalate_prompt(incident_id: int, channel_id: str) -> dict:
    """Affiche les instructions d'escalade."""
    client = get_slack_client()
    if client:
        text = f"""🚀 *Escalader l'Incident #{incident_id}*

Pour escalader, utilisez la commande :
`@Jamono escalade @personne [message]`

Exemple :
`@Jamono escalade @lamine Le pod payment-service ne répond plus, besoin de ton aide urgente`

La personne recevra un message direct avec votre demande."""
        try:
            client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)
        except SlackApiError:
            pass
    return {"text": "Instructions d'escalade envoyées"}


def _handle_commands(incident_id: int, channel_id: str) -> dict:
    """Affiche la liste des commandes disponibles."""
    client = get_slack_client()
    if client:
        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"💬 Commandes — Incident #{incident_id}", "emoji": True}
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": "*Diagnostic :*\n• `@Jamono status` — État actuel du pod\n• `@Jamono analyse` — Diagnostic IA complet\n\n*Actions :*\n• `@Jamono resolve` — Résoudre l'incident\n• `@Jamono assign @user` — Réassigner\n• `@Jamono escalade @user [message]` — Escalader\n\n*Infos :*\n• `@Jamono aperçu` — Résumé de l'incident\n• `@Jamono aide` — Afficher ce message"}
            },
        ]
        try:
            client.chat_postMessage(channel=channel_id, text="Commandes Jamono", blocks=blocks)
        except SlackApiError:
            pass
    return {"text": "Commandes affichées"}


# ═══════════════════════════════════════════════════
# EVENT HANDLER (mentions @Jamono)
# ═══════════════════════════════════════════════════

async def handle_slack_event(body: dict):
    """Traite les événements Slack — mentions du bot."""
    event = body.get("event", {})
    event_type = event.get("type")
    bot_uid = get_bot_user_id()

    if event.get("bot_id") or event.get("subtype"):
        return
    if bot_uid and event.get("user") == bot_uid:
        return

    if event_type == "app_mention" and event.get("text") and "<@" in event.get("text", ""):
        try:
            await handle_mention(event)
        except Exception as e:
            print(f"❌ [SLACK] Erreur handle_mention : {e}")
            client = get_slack_client()
            if client and event.get("channel"):
                try:
                    client.chat_postMessage(channel=event["channel"], text=f"❌ Erreur : `{e}`")
                except Exception:
                    pass


async def handle_mention(event: dict):
    """Traite une mention @Jamono dans un canal."""
    channel_id = event.get("channel")
    text = event.get("text", "").lower()
    user = event.get("user")

    client = get_slack_client()
    if not client:
        return

    import re
    command_match = re.sub(r'<@[^>]+>', '', text).strip()

    if "status" in command_match:
        await cmd_status(client, channel_id)
    elif "resolve" in command_match or "résoudre" in command_match:
        await cmd_resolve(client, channel_id, user)
    elif "escalade" in command_match or "escalate" in command_match:
        await cmd_escalade(client, channel_id, text, user, event)
    elif "assign" in command_match or "assigner" in command_match:
        await cmd_assign(client, channel_id, text, user)
    elif "analyse" in command_match or "analyze" in command_match:
        await cmd_analyse(client, channel_id)
    elif "aperçu" in command_match or "overview" in command_match:
        await cmd_overview(client, channel_id)
    elif "aide" in command_match or "help" in command_match:
        _handle_commands(0, channel_id)
    else:
        # Commande non reconnue → afficher l'aide
        _handle_commands(0, channel_id)


# ═══════════════════════════════════════════════════
# COMMANDES MENTION
# ═══════════════════════════════════════════════════

def _resolve_channel_name(client: WebClient, channel_id: str) -> str:
    try:
        res = client.conversations_info(channel=channel_id)
        return f"#{res['channel']['name']}"
    except Exception:
        return channel_id

def _find_incident_by_channel(channel_id: str) -> dict | None:
    from incidents import list_incidents
    client = get_slack_client()
    channel_name = _resolve_channel_name(client, channel_id) if client else channel_id
    incidents = list_incidents()
    return next((i for i in incidents if i.get("slack_channel") in (channel_id, channel_name)), None)


async def cmd_status(client: WebClient, channel_id: str):
    incident = _find_incident_by_channel(channel_id)
    if not incident or not incident.get("linked_pod"):
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun pod lié à cet incident.")
        return

    pod_name = incident["linked_pod"]
    try:
        from tools.k8s_core import list_pods_tool
        from utils.k8s_handler import is_k8s_available
        if not is_k8s_available():
            client.chat_postMessage(channel=channel_id, text=f"⚠️ Cluster K8s non connecté. Impossible de vérifier `{pod_name}`.")
            return
        pods = list_pods_tool.invoke({"namespace": "default"})
        if isinstance(pods, str):
            client.chat_postMessage(channel=channel_id, text=f"❌ Erreur K8s : {pods}")
            return
        pod = next((p for p in pods if p["pod_name"] == pod_name), None)
        if pod:
            emoji = "✅" if pod["health_status"] == "HEALTHY" else "🔴"
            blocks = [
                {"type": "section", "text": {"type": "mrkdwn", "text": f"{emoji} *{pod_name}*"}},
                {"type": "section", "fields": [
                    {"type": "mrkdwn", "text": f"*Statut :*\n`{pod['health_status']}`"},
                    {"type": "mrkdwn", "text": f"*Restarts :*\n`{pod['restarts']}`"},
                    {"type": "mrkdwn", "text": f"*Phase :*\n`{pod['internal_phase']}`"},
                    {"type": "mrkdwn", "text": f"*Diagnostic :*\n`{pod['diagnostic']}`"},
                ]},
            ]
            client.chat_postMessage(channel=channel_id, text=f"{emoji} {pod_name}", blocks=blocks)
        else:
            client.chat_postMessage(channel=channel_id, text=f"⚠️ Pod `{pod_name}` introuvable dans le cluster.")
    except Exception as e:
        client.chat_postMessage(channel=channel_id, text=f"❌ Erreur : {str(e)}")


async def cmd_resolve(client: WebClient, channel_id: str, user: str):
    incident = _find_incident_by_channel(channel_id)
    if not incident:
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun incident lié à ce canal.")
        return
    if incident["status"] == "resolved":
        client.chat_postMessage(channel=channel_id, text="✅ Cet incident est déjà résolu.")
        return
    from incidents import update_incident_status
    update_incident_status(incident["id"], "resolved", author=f"slack:{user}", detail="Résolu via Slack")
    client.chat_postMessage(channel=channel_id, text=f"✅ *Incident #{incident['id']} résolu* par <@{user}>")


async def cmd_assign(client: WebClient, channel_id: str, text: str, user: str):
    incident = _find_incident_by_channel(channel_id)
    if not incident:
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun incident lié à ce canal.")
        return
    import re
    mentions = [m for m in re.findall(r'<@([^>]+)>', text) if m != get_bot_user_id()]
    if not mentions:
        # Self-assign
        from incidents import update_incident_assignment
        try:
            user_info = client.users_info(user=user)
            user_name = user_info["user"]["profile"].get("display_name") or user_info["user"]["name"]
        except:
            user_name = user
        update_incident_assignment(incident["id"], user_name, author=f"slack:{user_name}")
        post_assignment_notification(channel_id, incident["id"], user, user_name)
        return
    target = mentions[0]
    try:
        target_info = client.users_info(user=target)
        target_name = target_info["user"]["profile"].get("display_name") or target_info["user"]["name"]
    except:
        target_name = target
    from incidents import update_incident_assignment
    update_incident_assignment(incident["id"], target_name, author=f"slack:{user}")
    client.chat_postMessage(channel=channel_id, text=f"👤 <@{target}> est maintenant responsable de l'*Incident #{incident['id']}*\n_Assigné par <@{user}>_")


async def cmd_escalade(client: WebClient, channel_id: str, text: str, user: str, event: dict):
    """Escalade vers un utilisateur avec un message."""
    incident = _find_incident_by_channel(channel_id)
    if not incident:
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun incident lié à ce canal.")
        return
    import re
    # Extraire la cible et le message
    mentions = [m for m in re.findall(r'<@([^>]+)>', text) if m != get_bot_user_id()]
    if not mentions:
        client.chat_postMessage(channel=channel_id, text="⚠️ Usage : `@Jamono escalade @personne [votre message]`")
        return
    target = mentions[0]
    # Extraire le message après les mentions
    message = re.sub(r'<@[^>]+>', '', text).replace("escalade", "").replace("escalate", "").strip()
    if not message:
        message = f"Votre aide est requise sur l'incident #{incident['id']}"
    post_escalation(channel_id, incident["id"], user, target, message)


async def cmd_overview(client: WebClient, channel_id: str):
    incident = _find_incident_by_channel(channel_id)
    if not incident:
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun incident lié à ce canal.")
        return
    _handle_overview(incident["id"], channel_id)


async def cmd_analyse(client: WebClient, channel_id: str):
    incident = _find_incident_by_channel(channel_id)
    if not incident or not incident.get("linked_pod"):
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun pod lié à cet incident.")
        return
    client.chat_postMessage(channel=channel_id, text=f"🔍 Analyse en cours pour `{incident['linked_pod']}`...")
    try:
        from main import run_sre_system
        result = await asyncio.to_thread(run_sre_system, f"Analyse complète du pod {incident['linked_pod']} et propose une remédiation")
        if isinstance(result, str):
            response_text = result
        else:
            response_text = result.get("response", str(result)) if isinstance(result, dict) else str(result)
        if len(response_text) > 3000:
            response_text = response_text[:3000] + "...\n_[Voir Jamono pour l'analyse complète]_"
        client.chat_postMessage(channel=channel_id, text=f"🤖 *Analyse IA :*\n{response_text}", mrkdwn=True)
    except Exception as e:
        client.chat_postMessage(channel=channel_id, text=f"❌ Erreur analyse : {str(e)}")


# ═══════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════

def get_user_id_by_name(client: WebClient, username: str) -> str | None:
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