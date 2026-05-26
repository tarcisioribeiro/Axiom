import json
import os
import re
import socket as _sock
import ssl
import threading
import time
import urllib.error
import urllib.request
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.core.mail import get_connection, send_mail
from django.db import connections
from django.utils.timezone import now
from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from admin_panel.models import SystemConfig
from admin_panel.serializers import SystemConfigSerializer
from app.health import check_storage
from security.models import ActivityLog
from security.serializers import ActivityLogSerializer


class AdminBaseView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]


# ─── .env helpers
# ──────────────────────────────────────────────────────────────

_ENV_FILE_PATH = "/app/axiom.env"
_DOCKER_SOCKET = "/var/run/docker.sock"
_DOCKER_CONTAINER = "axiom-api"


def _update_dotenv(key: str, value: str) -> None:
    """Rewrite only the changed variable in the .env bind-mount."""
    if not os.path.exists(_ENV_FILE_PATH):
        return
    try:
        with open(_ENV_FILE_PATH) as f:
            lines = f.readlines()
        found = False
        new_lines: list[str] = []
        for line in lines:
            if re.match(rf"^{re.escape(key)}\s*=", line):
                new_lines.append(f"{key}={value}\n")
                found = True
            else:
                new_lines.append(line)
        if not found:
            if new_lines and not new_lines[-1].endswith("\n"):
                new_lines.append("\n")
            new_lines.append(f"{key}={value}\n")
        with open(_ENV_FILE_PATH, "w") as f:
            f.writelines(new_lines)
    except Exception:
        pass


def _restart_via_docker_socket(
    container: str = _DOCKER_CONTAINER, delay: int = 3
) -> dict[str, Any]:
    """Schedule a container restart via Docker socket,
    returning immediately."""
    if not os.path.exists(_DOCKER_SOCKET):
        return {
            "success": False,
            "message": "Docker socket não encontrado em /var/run/docker.sock.",
        }

    def do_restart() -> None:
        time.sleep(delay)
        try:
            s = _sock.socket(_sock.AF_UNIX, _sock.SOCK_STREAM)
            s.connect(_DOCKER_SOCKET)
            req = (
                f"POST /containers/{container}/restart HTTP/1.1\r\n"
                "Host: localhost\r\n"
                "Content-Length: 0\r\n"
                "\r\n"
            )
            s.sendall(req.encode())
            s.recv(4096)
            s.close()
        except Exception:
            pass

    t = threading.Thread(target=do_restart, daemon=True)
    t.start()
    return {
        "success": True,
        "message": f"Container {container} será reiniciado em {delay}s.",
        "results": {container: "reinicialização agendada"},
    }


# ─── System Config
# ─────────────────────────────────────────────────────────────


class SystemConfigListView(AdminBaseView):
    """GET /api/v1/admin/config/ — lista todas as configurações."""

    def get(self, request: Request) -> Response:
        configs = SystemConfig.objects.all()  # type: ignore[attr-defined]
        serializer = SystemConfigSerializer(configs, many=True)
        return Response(serializer.data)


class SystemConfigDetailView(AdminBaseView):
    """PATCH /api/v1/admin/config/<key>/ — atualiza uma configuração."""

    def patch(self, request: Request, key: str) -> Response:
        try:
            config = SystemConfig.objects.get(key=key)  # type: ignore[attr-defined]  # noqa: E501
        except SystemConfig.DoesNotExist:
            return Response(
                {"error": "Configuração não encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not config.is_editable:
            return Response(
                {"error": "Esta configuração não pode ser editada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        value = request.data.get("value")
        if value is None:
            return Response(
                {"error": "Campo 'value' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plain_value = str(value) if value != "" else None
        config.set_value(plain_value)
        config.updated_by = request.user
        config.save()

        if plain_value is not None:
            _update_dotenv(key, plain_value)

        return Response(SystemConfigSerializer(config).data)


# ─── Health
# ────────────────────────────────────────────────────────────────────


def _check_database() -> dict[str, Any]:
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
        return {
            "status": "healthy",
            "message": "Conexão bem-sucedida",
            "message_key": "connection_successful",
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "message": str(e),
            "message_key": "connection_failed",
        }


def _check_cache() -> dict[str, Any]:
    try:
        cache.set("admin_health_check", "ok", 10)
        if cache.get("admin_health_check") == "ok":
            return {
                "status": "healthy",
                "message": "Redis operacional",
                "message_key": "cache_operational",
            }
        return {
            "status": "unhealthy",
            "message": "Leitura do cache falhou",
            "message_key": "cache_read_failed",
        }
    except Exception as e:
        return {"status": "unhealthy", "message": str(e)}


def _check_ollama() -> dict[str, Any]:
    base_url = (
        _get_config_value("OLLAMA_BASE_URL")
        or getattr(settings, "OLLAMA_BASE_URL", "")
        or os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
    )
    try:
        req = urllib.request.Request(
            f"{base_url}/api/tags",
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:  # nosec B310
            import json

            data = json.loads(resp.read())
            models = [m["name"] for m in data.get("models", [])]
            return {
                "status": "healthy",
                "message": f"{len(models)} modelo(s) disponível(is)",
                "message_key": "models_available",
                "model_count": len(models),
                "models": models,
            }
    except urllib.error.URLError as e:
        return {"status": "unhealthy", "message": f"Inacessível: {e.reason}"}
    except Exception as e:
        return {"status": "unhealthy", "message": str(e)}


def _check_disk() -> dict[str, Any]:
    try:
        import shutil

        total, used, free = shutil.disk_usage("/")
        pct = (free / total) * 100
        threshold = getattr(settings, "DISK_SPACE_WARN_THRESHOLD", 10)
        st = "warning" if pct < threshold else "healthy"
        return {
            "status": st,
            "message": f"{pct:.1f}% livre",
            "message_key": "disk_free",
            "free_percent": round(pct, 1),
        }
    except Exception as e:
        return {"status": "unknown", "message": str(e)}


def _check_email() -> dict[str, Any]:
    # DB values take precedence over env/settings (reflect what admin
    # configured)
    backend: str = (
        _get_config_value("EMAIL_BACKEND")
        or getattr(settings, "EMAIL_BACKEND", "")
        or os.getenv("EMAIL_BACKEND", "")
    ) or ""
    host = (
        _get_config_value("EMAIL_HOST")
        or getattr(settings, "EMAIL_HOST", "")
        or os.getenv("EMAIL_HOST", "")
    )
    _raw_port = _get_config_value("EMAIL_PORT") or getattr(
        settings, "EMAIL_PORT", "587"
    )
    port = int(_raw_port)  # type: ignore[arg-type]
    if "console" in backend:
        return {
            "status": "not_configured",
            "message": "Backend de console ativo (desenvolvimento)",
            "message_key": "console_backend",
        }
    if not host or host in ("localhost", "smtp.example.com"):
        return {
            "status": "not_configured",
            "message": "EMAIL_HOST não configurado",
            "message_key": "email_host_not_configured",
        }
    try:
        import socket

        socket.setdefaulttimeout(5)
        s = socket.create_connection((host, port), timeout=5)
        s.close()
        return {
            "status": "healthy",
            "message": f"SMTP {host}:{port} acessível",
            "message_key": "smtp_accessible",
            "smtp_host": host,
            "smtp_port": port,
        }
    except Exception as e:
        return {"status": "unhealthy", "message": str(e)}


class AdminHealthView(AdminBaseView):
    """GET /api/v1/admin/health/ — saúde detalhada de todos os serviços."""

    def get(self, request: Request) -> Response:
        storage = check_storage()
        ollama = _check_ollama()
        db = _check_database()
        redis = _check_cache()
        disk = _check_disk()
        email = _check_email()

        checks = {
            "database": db,
            "cache": redis,
            "storage": storage,
            "ollama": ollama,
            "email": email,
            "disk": disk,
        }

        overall = "healthy"
        for v in checks.values():
            if v.get("status") == "unhealthy":
                overall = "unhealthy"
                break
            if v.get("status") == "warning" and overall == "healthy":
                overall = "warning"

        return Response(
            {
                "status": overall,
                "timestamp": now().isoformat(),
                "checks": checks,
            }
        )


# ─── Integrations status
# ───────────────────────────────────────────────────────


class AdminIntegrationsView(AdminBaseView):
    """GET /api/v1/admin/integrations/ — status em tempo real
    das integrações."""

    def get(self, request: Request) -> Response:
        provider = _get_config_value("LLM_PROVIDER") or getattr(
            settings, "LLM_PROVIDER", os.getenv("LLM_PROVIDER", "ollama")
        )
        ollama_info = _check_ollama()

        anthropic_status: dict[str, Any] = {
            "status": "not_configured",
            "message": "Não configurado",
        }
        if provider == "anthropic":
            api_key = _get_config_value("ANTHROPIC_API_KEY") or os.getenv(
                "ANTHROPIC_API_KEY"
            )
            if api_key:
                anthropic_status = _check_anthropic(api_key)
            else:
                anthropic_status = {
                    "status": "not_configured",
                    "message": "ANTHROPIC_API_KEY não configurada",
                }

        return Response(
            {
                "database": _check_database(),
                "cache": _check_cache(),
                "storage": check_storage(),
                "ollama": ollama_info,
                "anthropic": anthropic_status,
                "email": _check_email(),
                "llm_provider": provider,
                "ollama_model": _get_config_value("OLLAMA_MODEL")
                or getattr(
                    settings, "OLLAMA_MODEL", os.getenv("OLLAMA_MODEL", "")
                ),
                "anthropic_model": _get_config_value("ANTHROPIC_MODEL")
                or os.getenv("ANTHROPIC_MODEL", ""),
            }
        )


def _get_config_value(key: str) -> str | None:
    try:
        cfg = SystemConfig.objects.get(key=key)  # type: ignore[attr-defined]
        return cfg.get_value()  # type: ignore[no-any-return]
    except SystemConfig.DoesNotExist:
        return None


def _check_anthropic(api_key: str) -> dict[str, Any]:
    try:
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
        )
        with urllib.request.urlopen(req, timeout=8) as resp:  # nosec B310
            if resp.status == 200:
                return {
                    "status": "healthy",
                    "message": "API Anthropic acessível",
                }
        return {"status": "unhealthy", "message": f"Status HTTP {resp.status}"}
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return {
                "status": "unhealthy",
                "message": "Chave de API inválida (401)",
            }
        return {"status": "unhealthy", "message": f"Erro HTTP {e.code}"}
    except Exception as e:
        return {"status": "unhealthy", "message": str(e)}


# ─── Logs
# ──────────────────────────────────────────────────────────────────────


class AdminLogsView(AdminBaseView):
    """GET /api/v1/admin/logs/ — todos os activity logs paginados."""

    def get(self, request: Request) -> Response:
        qs = ActivityLog.objects.select_related("user").order_by("-created_at")

        # Filtros opcionais
        username = request.query_params.get("username")
        action = request.query_params.get("action")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if username:
            qs = qs.filter(user__username__icontains=username)
        if action:
            qs = qs.filter(action=action)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        # Paginação manual simples
        page_size = int(request.query_params.get("page_size", 50))
        page = int(request.query_params.get("page", 1))
        offset = (page - 1) * page_size
        total = qs.count()
        logs = qs[offset : offset + page_size]

        serializer = ActivityLogSerializer(logs, many=True)
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": serializer.data,
            }
        )


# ─── Email Test
# ────────────────────────────────────────────────────────────────


class AdminEmailTestView(AdminBaseView):
    """POST /api/v1/admin/email/test/ — envia email de teste."""

    def post(self, request: Request) -> Response:
        to_email = request.data.get("to_email")
        if not to_email:
            return Response(
                {"error": "Campo 'to_email' é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Usa as configs do banco (fallback para env)
        host = _get_config_value("EMAIL_HOST") or getattr(
            settings, "EMAIL_HOST", ""
        )
        _raw_port = _get_config_value("EMAIL_PORT") or getattr(
            settings, "EMAIL_PORT", "587"
        )
        port = int(_raw_port)  # type: ignore[arg-type]
        use_tls = (_get_config_value("EMAIL_USE_TLS") or "True") == "True"
        user = _get_config_value("EMAIL_HOST_USER") or getattr(
            settings, "EMAIL_HOST_USER", ""
        )
        password = _get_config_value("EMAIL_HOST_PASSWORD") or getattr(
            settings, "EMAIL_HOST_PASSWORD", ""
        )
        from_email = _get_config_value("DEFAULT_FROM_EMAIL") or getattr(
            settings, "DEFAULT_FROM_EMAIL", "noreply@axiom.app"
        )

        if not host:
            return Response(
                {"error": "Servidor SMTP não configurado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            connection = get_connection(
                backend="django.core.mail.backends.smtp.EmailBackend",
                host=host,
                port=port,
                username=user,
                password=password,
                use_tls=use_tls,
                fail_silently=False,
            )
            send_mail(
                subject="Axiom — Email de teste",
                message=(
                    "Este é um email de teste enviado pelo "
                    "painel de administração do Axiom.\n\n"
                    f"Enviado em: {now().strftime('%d/%m/%Y %H:%M:%S')}"
                ),
                from_email=from_email,
                recipient_list=[to_email],
                connection=connection,
            )
            return Response(
                {"message": f"Email enviado para {to_email} com sucesso."}
            )
        except Exception as e:
            return Response(
                {"error": f"Falha ao enviar email: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


# ─── Restart All Deployments
# ───────────────────────────────────────────────────

# Deployments de aplicação reiniciados pelo painel. 404s são ignorados
# automaticamente, então a mesma lista funciona em produção (api-blue/green)
# e em staging (api).
_APP_DEPLOYMENTS = ["api", "api-blue", "api-green", "frontend", "ollama"]


def _restart_deployments() -> dict[str, Any]:
    sa_dir = "/var/run/secrets/kubernetes.io/serviceaccount"
    token_path = f"{sa_dir}/token"
    ca_path = f"{sa_dir}/ca.crt"
    ns_path = f"{sa_dir}/namespace"

    if not os.path.exists(token_path):
        return {
            "success": False,
            "message": (
                "Fora do ambiente Kubernetes" " — reinício não disponível."
            ),
            "results": {},
        }

    try:
        with open(token_path) as f:
            token = f.read().strip()
        with open(ns_path) as f:
            namespace = f.read().strip()

        kube_host = os.environ.get(
            "KUBERNETES_SERVICE_HOST", "kubernetes.default.svc"
        )
        kube_port = os.environ.get("KUBERNETES_SERVICE_PORT", "443")
        base_url = (
            f"https://{kube_host}:{kube_port}"
            f"/apis/apps/v1/namespaces/{namespace}/deployments"
        )

        patch = json.dumps(
            {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": (
                                    now().isoformat()
                                )
                            }
                        }
                    }
                }
            }
        ).encode()

        ctx = ssl.create_default_context(cafile=ca_path)
        results: dict[str, str] = {}
        errors: list[str] = []

        for name in _APP_DEPLOYMENTS:
            req = urllib.request.Request(
                f"{base_url}/{name}",
                data=patch,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/strategic-merge-patch+json",
                },
                method="PATCH",
            )
            try:
                with urllib.request.urlopen(
                    req, context=ctx, timeout=10
                ) as resp:  # nosec B310
                    results[name] = (
                        "reiniciado"
                        if resp.status in (200, 201)
                        else f"HTTP {resp.status}"
                    )
                    if resp.status not in (200, 201):
                        errors.append(name)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    results[name] = "ignorado (não existe neste ambiente)"
                elif e.code == 403:
                    results[name] = "sem permissão (403)"
                    errors.append(name)
                else:
                    results[name] = f"erro HTTP {e.code}"
                    errors.append(name)
            except Exception as e:
                results[name] = str(e)
                errors.append(name)

        restarted = [k for k, v in results.items() if v == "reiniciado"]
        if errors:
            return {
                "success": False,
                "message": f"Erros ao reiniciar: {', '.join(errors)}",
                "results": results,
            }
        return {
            "success": True,
            "message": (
                f"{len(restarted)} deployment(s) reiniciado(s):"
                f" {', '.join(restarted)}."
            ),
            "results": results,
        }
    except Exception as e:
        return {"success": False, "message": str(e), "results": {}}


class AdminRestartAllView(AdminBaseView):
    """POST /api/v1/admin/restart/ — reinicia via Docker socket ou Kubernetes.

    Body: { "mode": "docker" | "kubernetes" }
    """

    def post(self, request: Request) -> Response:
        mode = (request.data.get("mode") or "auto").lower()

        if mode == "docker":
            result = _restart_via_docker_socket()
        elif mode == "kubernetes":
            result = _restart_deployments()
        else:
            # auto: usa Kubernetes se o token existir, senão Docker socket
            sa_token = "/var/run/secrets/kubernetes.io/serviceaccount/token"
            if os.path.exists(sa_token):
                result = _restart_deployments()
            else:
                result = _restart_via_docker_socket()

        return Response(
            {
                "success": result["success"],
                "message": result["message"],
                "results": result.get("results", {}),
            }
        )


# ─── Agents Status
# ─────────────────────────────────────────────────────────────


class AdminAgentsStatusView(AdminBaseView):
    """GET /api/v1/admin/agents/status/ — status do sistema de agentes LLM."""

    def get(self, request: Request) -> Response:
        provider = _get_config_value("LLM_PROVIDER") or getattr(
            settings, "LLM_PROVIDER", os.getenv("LLM_PROVIDER", "ollama")
        )
        ollama_url = _get_config_value("OLLAMA_BASE_URL") or getattr(
            settings, "OLLAMA_BASE_URL", os.getenv("OLLAMA_BASE_URL", "")
        )
        ollama_model = _get_config_value("OLLAMA_MODEL") or getattr(
            settings, "OLLAMA_MODEL", os.getenv("OLLAMA_MODEL", "")
        )
        embed_model = _get_config_value("OLLAMA_EMBED_MODEL") or getattr(
            settings, "OLLAMA_EMBED_MODEL", os.getenv("OLLAMA_EMBED_MODEL", "")
        )
        anthropic_model = _get_config_value("ANTHROPIC_MODEL") or os.getenv(
            "ANTHROPIC_MODEL", ""
        )

        ollama_check = (
            _check_ollama()
            if provider == "ollama"
            else {"status": "not_active"}
        )

        total_conversations = 0
        try:
            from agents.models import AgentConversation

            total_conversations = AgentConversation.objects.count()
        except Exception:
            pass

        return Response(
            {
                "provider": provider,
                "ollama": {
                    "base_url": ollama_url,
                    "model": ollama_model,
                    "embed_model": embed_model,
                    "connectivity": ollama_check,
                },
                "anthropic": {
                    "model": anthropic_model,
                    "api_key_configured": bool(
                        _get_config_value("ANTHROPIC_API_KEY")
                        or os.getenv("ANTHROPIC_API_KEY")
                    ),
                },
                "total_conversations": total_conversations,
                "timeout_chat": int(
                    _get_config_value("LLM_TIMEOUT_CHAT")
                    or getattr(settings, "LLM_TIMEOUT_CHAT", "120")
                    or "120"
                ),
                "timeout_embed": int(
                    _get_config_value("LLM_TIMEOUT_EMBED")
                    or getattr(settings, "LLM_TIMEOUT_EMBED", "30")
                    or "30"
                ),
            }
        )
