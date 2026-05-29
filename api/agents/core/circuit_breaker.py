"""
Circuit breaker para o Ollama local.

Após THRESHOLD falhas consecutivas, o circuito abre e requisições ao Ollama
são rejeitadas imediatamente (fast-fail), forçando o fallback para providers
cloud (Groq, Anthropic). O circuito tenta fechar após
RECOVERY_TIMEOUT segundos.
"""

import logging
import threading
import time

logger = logging.getLogger(__name__)


class OllamaCircuitBreaker:
    THRESHOLD = 3
    RECOVERY_TIMEOUT = 30.0  # segundos

    def __init__(self) -> None:
        self._failures = 0
        self._opened_at: float = 0.0
        self._lock = threading.Lock()

    @property
    def is_open(self) -> bool:
        """True quando o circuito está aberto (Ollama deve ser ignorado)."""
        with self._lock:
            if self._opened_at and (
                time.monotonic() - self._opened_at > self.RECOVERY_TIMEOUT
            ):
                # Tenta fechar (half-open): permite uma requisição de teste
                logger.info("Ollama circuit breaker: entrando em half-open")
                self._failures = 0
                self._opened_at = 0.0
            return self._opened_at != 0.0

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            if self._failures >= self.THRESHOLD and not self._opened_at:
                self._opened_at = time.monotonic()
                logger.warning(
                    "Ollama circuit breaker ABERTO"
                    " após %d falhas consecutivas",
                    self._failures,
                )

    def record_success(self) -> None:
        with self._lock:
            if self._opened_at:
                logger.info(
                    "Ollama circuit breaker FECHADO — conexão restaurada"
                )
            self._failures = 0
            self._opened_at = 0.0

    def reset(self) -> None:
        with self._lock:
            self._failures = 0
            self._opened_at = 0.0


# Singleton de processo — compartilhado entre todos os workers do mesmo
# processo
ollama_circuit = OllamaCircuitBreaker()
