# Service Slack — création de canaux, envoi de messages et notifications d'incidents
import asyncio
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from settings import get_setting

_bot_user_id: str | None = None

def get_slack_client():
    token = get_setting("slack_bot_token")
    if not token:
        return None
    return WebClient(token=token)

def get_bot_user_id() -> str | None:
    """Retourne le User ID du bot (U...) via auth.test, mis en cache."""
    global _bot_user_id
    if _bot_user_id:
        return _bot_user_id
    client = get_slack_client()
    if not client:
        return None
    try:
        res = client.auth_test()
        _bot_user_id = res["user_id"]
        print(f"[SLACK] Bot user_id mis en cache : {_bot_user_id}")
    except Exception as e:
        print(f"❌ [SLACK] auth.test échoué : {e}")
    return _bot_user_id

def is_slack_enabled() -> bool:
    return str(get_setting("slack_enabled")).lower() == "true" and bool(get_setting("slack_bot_token"))

def create_incident_channel(incident_id: int, component: str) -> tuple[str, str] | None:
    """Crée un canal Slack dédié à l'incident. Retourne (channel_id, channel_name)."""
    if not is_slack_enabled():
        return None
    if str(get_setting("slack_create_channel_per_incident")).lower() != "true":
        return None

    import re
    client = get_slack_client()
    # Nom du canal : incident-42-crash-app2 (uniquement lettres, chiffres, tirets)
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

async def handle_slack_event(body: dict):
    """Traite les événements Slack — mentions du bot et messages dans les canaux d'incident."""
    event = body.get("event", {})
    event_type = event.get("type")
    bot_uid = get_bot_user_id()
    print(f"[SLACK DEBUG] type={event_type} bot_id={event.get('bot_id')} subtype={event.get('subtype')} user={event.get('user')} bot_uid={bot_uid} text={event.get('text','')[:80]}")

    # Ignorer les messages du bot lui-même et les messages système (join/leave/etc.)
    if event.get("bot_id"):
        return
    if event.get("subtype"):
        return
    if bot_uid and event.get("user") == bot_uid:
        return

    if event_type == "app_mention" and event.get("text") and "<@" in event.get("text", ""):
        try:
            await handle_mention(event)
        except Exception as e:
            print(f"❌ [SLACK] Erreur handle_mention : {e}")
            client = get_slack_client()
            channel_id = event.get("channel")
            if client and channel_id:
                try:
                    client.chat_postMessage(channel=channel_id, text=f"❌ Erreur interne : `{e}`")
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

    # Extraire la commande après @Jamono
    import re
    command_match = re.sub(r'<@[^>]+>', '', text).strip()

    if "status" in command_match:
        await cmd_status(client, channel_id)
    elif "resolve" in command_match:
        await cmd_resolve(client, channel_id, user)
    elif "assign" in command_match:
        await cmd_assign(client, channel_id, text, user)
    elif "analyse" in command_match or "analyze" in command_match:
        await cmd_analyse(client, channel_id)
    else:
        client.chat_postMessage(
            channel=channel_id,
            text="🤖 Commandes disponibles :\n• `@Jamono status` — état du pod\n• `@Jamono analyse` — diagnostic IA\n• `@Jamono resolve` — fermer l'incident\n• `@Jamono assign @username` — réassigner"
        )

def _resolve_channel_name(client: WebClient, channel_id: str) -> str:
    """Retourne #channel_name depuis un channel_id, ou channel_id si erreur."""
    try:
        res = client.conversations_info(channel=channel_id)
        return f"#{res['channel']['name']}"
    except Exception:
        return channel_id

async def cmd_status(client: WebClient, channel_id: str):
    from incidents import list_incidents
    channel_name = _resolve_channel_name(client, channel_id)
    incidents = list_incidents()
    incident = next((i for i in incidents if i.get("slack_channel") in (channel_id, channel_name)), None)
    
    if not incident or not incident.get("linked_pod"):
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun pod lié à cet incident.")
        return

    pod_name = incident["linked_pod"]
    
    try:
        from tools.k8s_core import list_pods_tool
        from utils.k8s_handler import is_k8s_available
        
        if not is_k8s_available():
            client.chat_postMessage(
                channel=channel_id, 
                text=f"⚠️ Cluster Kubernetes non connecté à Jamono. Connecte ton cluster pour obtenir le statut de `{pod_name}`."
            )
            return
            
        pods = list_pods_tool.invoke({"namespace": "default"})
        if isinstance(pods, str):
            client.chat_postMessage(channel=channel_id, text=f"❌ Erreur K8s : {pods}")
            return
            
        pod = next((p for p in pods if p["pod_name"] == pod_name), None)
        
        if pod:
            emoji = "✅" if pod["health_status"] == "HEALTHY" else "🔴"
            text = f"{emoji} *{pod_name}*\n• Statut : `{pod['health_status']}`\n• Restarts : `{pod['restarts']}`\n• Phase : `{pod['internal_phase']}`\n• Diagnostic : `{pod['diagnostic']}`"
        else:
            text = f"⚠️ Pod `{pod_name}` introuvable."
    except Exception as e:
        text = f"❌ Impossible de récupérer le statut : {str(e)}"

    client.chat_postMessage(channel=channel_id, text=text, mrkdwn=True)


async def cmd_resolve(client: WebClient, channel_id: str, user: str):
    """Ferme l'incident lié au canal."""
    from incidents import list_incidents, update_incident_status
    channel_name = _resolve_channel_name(client, channel_id)
    incidents = list_incidents()
    incident = next((i for i in incidents if i.get("slack_channel") in (channel_id, channel_name)), None)
    
    if not incident:
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun incident lié à ce canal.")
        return

    if incident["status"] == "resolved":
        client.chat_postMessage(channel=channel_id, text="✅ Cet incident est déjà résolu.")
        return

    update_incident_status(incident["id"], "resolved", author=f"slack:{user}", detail="Résolu via commande Slack")
    client.chat_postMessage(
        channel=channel_id,
        text=f"✅ *Incident #{incident['id']} résolu* par <@{user}>\n_Canal archivé dans 24h._"
    )

async def cmd_assign(client: WebClient, channel_id: str, text: str, user: str):
    """Réassigne l'incident à un membre."""
    from incidents import list_incidents
    import re
    channel_name = _resolve_channel_name(client, channel_id)
    incidents = list_incidents()
    incident = next((i for i in incidents if i.get("slack_channel") in (channel_id, channel_name)), None)
    
    if not incident:
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun incident lié à ce canal.")
        return

    # Extraire le username cible
    mention = re.findall(r'<@([^>]+)>', text)
    mentions = [m for m in mention if m != user]
    
    if not mentions:
        client.chat_postMessage(channel=channel_id, text="⚠️ Usage : `@Jamono assign @username`")
        return

    target_user = mentions[0]
    client.chat_postMessage(
        channel=channel_id,
        text=f"👤 Incident #{incident['id']} réassigné à <@{target_user}> par <@{user}>"
    )

async def cmd_analyse(client: WebClient, channel_id: str):
    """Lance un diagnostic IA complet sur le pod lié."""
    from incidents import list_incidents
    channel_name = _resolve_channel_name(client, channel_id)
    incidents = list_incidents()
    incident = next((i for i in incidents if i.get("slack_channel") in (channel_id, channel_name)), None)
    
    if not incident or not incident.get("linked_pod"):
        client.chat_postMessage(channel=channel_id, text="⚠️ Aucun pod lié à cet incident.")
        return

    client.chat_postMessage(channel=channel_id, text=f"🔍 Analyse en cours pour `{incident['linked_pod']}`...")
    
    try:
        from main import run_sre_system
        result = await asyncio.to_thread(
            run_sre_system,
            f"Analyse complète du pod {incident['linked_pod']} et propose une remédiation"
        )
        response_text = result.get("response", "Aucune réponse")
        # Limiter à 3000 caractères pour Slack
        if len(response_text) > 3000:
            response_text = response_text[:3000] + "...\n_[Voir Jamono pour l'analyse complète]_"
        client.chat_postMessage(channel=channel_id, text=f"🤖 *Analyse IA :*\n{response_text}", mrkdwn=True)
    except Exception as e:
        client.chat_postMessage(channel=channel_id, text=f"❌ Erreur analyse : {str(e)}")