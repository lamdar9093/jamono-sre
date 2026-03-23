"""
Jamono Network Tools — Outils de diagnostic réseau K8s
"""

from langchain_core.tools import tool
from utils.k8s_handler import get_v1_client


@tool
def check_service_connectivity_tool(service_name: str, namespace: str = "default"):
    """Vérifie si un service K8s existe et a des endpoints actifs."""
    try:
        v1 = get_v1_client()
        service = v1.read_namespaced_service(name=service_name, namespace=namespace)
        
        # Vérifier les endpoints
        try:
            ep = v1.read_namespaced_endpoints(name=service_name, namespace=namespace)
            addresses = []
            for subset in (ep.subsets or []):
                for addr in (subset.addresses or []):
                    addresses.append(addr.ip)
            ep_count = len(addresses)
        except:
            addresses = []
            ep_count = 0
        
        ports = [f"{p.port}/{p.protocol}" for p in (service.spec.ports or [])]
        
        return {
            "service": service_name,
            "exists": True,
            "type": service.spec.type,
            "cluster_ip": service.spec.cluster_ip,
            "ports": ports,
            "endpoints_count": ep_count,
            "endpoint_ips": addresses[:5],  # Limiter à 5
            "healthy": ep_count > 0,
            "message": f"Service OK — {ep_count} endpoint(s) actif(s)" if ep_count > 0 else "ATTENTION — Service sans endpoints actifs",
        }
    except Exception as e:
        return {
            "service": service_name,
            "exists": False,
            "healthy": False,
            "message": f"Service inaccessible : {str(e)}",
        }


@tool
def check_endpoints_tool(service_name: str, namespace: str = "default"):
    """Vérifie les endpoints d'un service. Détecte les backends manquants."""
    try:
        v1 = get_v1_client()
        ep = v1.read_namespaced_endpoints(name=service_name, namespace=namespace)
        
        result = {
            "service": service_name,
            "subsets": [],
            "total_ready": 0,
            "total_not_ready": 0,
        }
        
        for subset in (ep.subsets or []):
            ready = [{"ip": a.ip, "node": a.node_name} for a in (subset.addresses or [])]
            not_ready = [{"ip": a.ip, "node": a.node_name} for a in (subset.not_ready_addresses or [])]
            ports = [{"port": p.port, "protocol": p.protocol} for p in (subset.ports or [])]
            
            result["subsets"].append({
                "ready_addresses": ready,
                "not_ready_addresses": not_ready,
                "ports": ports,
            })
            result["total_ready"] += len(ready)
            result["total_not_ready"] += len(not_ready)
        
        result["healthy"] = result["total_ready"] > 0
        result["message"] = f"{result['total_ready']} ready, {result['total_not_ready']} not ready"
        
        return result
    except Exception as e:
        return {"service": service_name, "healthy": False, "message": f"Erreur endpoints : {str(e)}"}


@tool
def list_ingresses_tool(namespace: str = "default"):
    """Liste les ingresses avec leurs règles, hosts et backends."""
    try:
        from kubernetes import client
        networking = client.NetworkingV1Api()
        ingresses = networking.list_namespaced_ingress(namespace)
        
        report = []
        for ing in ingresses.items:
            rules = []
            for rule in (ing.spec.rules or []):
                paths = []
                if rule.http:
                    for p in (rule.http.paths or []):
                        paths.append({
                            "path": p.path,
                            "path_type": p.path_type,
                            "backend_service": p.backend.service.name if p.backend and p.backend.service else "N/A",
                            "backend_port": p.backend.service.port.number if p.backend and p.backend.service and p.backend.service.port else "N/A",
                        })
                rules.append({
                    "host": rule.host or "*",
                    "paths": paths,
                })
            
            tls = [{"hosts": t.hosts, "secret": t.secret_name} for t in (ing.spec.tls or [])]
            
            report.append({
                "name": ing.metadata.name,
                "class": ing.spec.ingress_class_name,
                "rules": rules,
                "tls": tls,
                "has_tls": len(tls) > 0,
            })
        return report
    except Exception as e:
        return f"Erreur liste ingresses : {str(e)}"


@tool
def dns_check_tool(hostname: str):
    """Résout un nom DNS pour vérifier la connectivité réseau. Utile pour les services externes."""
    import socket
    try:
        ips = socket.getaddrinfo(hostname, None)
        unique_ips = list(set(addr[4][0] for addr in ips))
        return {
            "hostname": hostname,
            "resolved": True,
            "ips": unique_ips[:5],
            "message": f"DNS OK — {hostname} résolu vers {', '.join(unique_ips[:3])}",
        }
    except socket.gaierror as e:
        return {
            "hostname": hostname,
            "resolved": False,
            "ips": [],
            "message": f"DNS ERREUR — {hostname} non résolu : {str(e)}",
        }