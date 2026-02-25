from .k8s_core import (
    list_pods_tool, 
    get_pod_logs_tool, 
    get_pod_events_tool, 
    get_pod_manifest_tool
)

from .k8s_remediation import patch_deployment_resources_tool

# On crée la liste centralisée pour l'agent
k8s_tools = [
    list_pods_tool, 
    get_pod_logs_tool, 
    get_pod_events_tool, 
    get_pod_manifest_tool, 
    patch_deployment_resources_tool
]

from .network_core import check_service_connectivity_tool

network_tools = [
    check_service_connectivity_tool
]