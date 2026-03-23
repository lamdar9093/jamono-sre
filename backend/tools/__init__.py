from .k8s_core import (
    list_pods_tool,
    get_pod_logs_tool,
    get_pod_events_tool,
    get_pod_manifest_tool,
    delete_pod_tool,
    list_deployments_tool,
    get_deployment_detail_tool,
    scale_deployment_tool,
    rollout_restart_deployment_tool,
    list_nodes_tool,
    list_warning_events_tool,
    list_services_tool,
    list_pvcs_tool,
    list_namespaces_tool,
)

from .k8s_remediation import (
    patch_deployment_resources_tool,
    patch_deployment_command_tool,
)

from .network_core import (
    check_service_connectivity_tool,
    check_endpoints_tool,
    list_ingresses_tool,
    dns_check_tool,
)

k8s_tools = [
    list_pods_tool,
    get_pod_logs_tool,
    get_pod_events_tool,
    get_pod_manifest_tool,
    delete_pod_tool,
    list_deployments_tool,
    get_deployment_detail_tool,
    scale_deployment_tool,
    rollout_restart_deployment_tool,
    list_nodes_tool,
    list_warning_events_tool,
    list_services_tool,
    list_pvcs_tool,
    list_namespaces_tool,
    patch_deployment_resources_tool,
    patch_deployment_command_tool,
]

network_tools = [
    check_service_connectivity_tool,
    check_endpoints_tool,
    list_ingresses_tool,
    dns_check_tool,
]