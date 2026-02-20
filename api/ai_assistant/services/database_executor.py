"""
Executor de queries SQL seguro para o AI Assistant.

Usa psycopg2 com parameterized queries para evitar SQL injection.
"""

import logging
import os
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Dict, List

import psycopg2
from psycopg2.extras import RealDictCursor

from app.encryption import FieldEncryption

from .query_interpreter import QueryResult

logger = logging.getLogger(__name__)


class DatabaseExecutor:
    """
    Executa queries SQL de forma segura usando psycopg2.

    Usa conexão direta ao PostgreSQL com parâmetros do .env.
    """

    @staticmethod
    def get_connection():
        """
        Cria conexão com o banco de dados.

        Usa variáveis de ambiente configuradas no .env.
        """
        return psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            port=os.getenv("DB_PORT", "5432"),
            dbname=os.getenv("DB_NAME", "mindledger_db"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", ""),
        )

    @classmethod
    def execute(cls, query_result: QueryResult) -> Dict[str, Any]:
        """
        Executa a query e retorna os resultados.

        Args:
            query_result: Resultado do QueryInterpreter

        Returns:
            Dicionário com os dados, contagem e metadados
        """
        if not query_result.sql:
            return {
                "data": [],
                "count": 0,
                "module": query_result.module,
                "display_type": query_result.display_type,
                "description": query_result.description,
            }

        conn = None
        try:
            conn = cls.get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query_result.sql, query_result.params)
                rows = cursor.fetchall()

                # Converte para lista de dicts serializáveis
                data = cls._serialize_rows(rows)

                # Decripta campos se necessário
                if query_result.requires_decryption:
                    data = cls._decrypt_fields(
                        data, query_result.decryption_fields or []
                    )

                return {
                    "data": data,
                    "count": len(data),
                    "module": query_result.module,
                    "display_type": query_result.display_type,
                    "description": query_result.description,
                }

        except psycopg2.Error as e:
            logger.error(f"Database error: {e}")
            raise DatabaseError(f"Erro ao consultar banco de dados: {str(e)}")
        finally:
            if conn:
                conn.close()

    @staticmethod
    def _serialize_rows(rows: List[Dict]) -> List[Dict[str, Any]]:
        """
        Serializa as linhas para tipos JSON-compatíveis.

        Converte Decimal, date, datetime, time para tipos primitivos.
        """
        result = []
        for row in rows:
            serialized: Dict[str, Any] = {}
            for key, value in row.items():
                if isinstance(value, Decimal):
                    serialized[key] = float(value)
                elif isinstance(value, (date, datetime)):
                    serialized[key] = value.isoformat()
                elif isinstance(value, time):
                    serialized[key] = value.strftime("%H:%M")
                elif value is None:
                    serialized[key] = None
                else:
                    serialized[key] = value
            result.append(serialized)
        return result

    @staticmethod
    def _decrypt_fields(
        data: List[Dict[str, Any]], fields: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Decripta campos sensíveis usando FieldEncryption.

        Args:
            data: Lista de registros
            fields: Campos a serem decriptados

        Returns:
            Dados com campos decriptados
        """
        for row in data:
            for field in fields:
                if field in row and row[field]:
                    try:
                        decrypted = FieldEncryption.decrypt_data(row[field])
                        # Substitui o campo criptografado pelo decriptado
                        row[field.replace("_criptografada", "")] = decrypted
                        # Remove o campo criptografado original
                        del row[field]
                    except Exception as e:
                        logger.warning(f"Failed to decrypt field {field}: {e}")
                        row[field.replace("_criptografada", "")] = "***"
                        if field in row:
                            del row[field]
        return data


class DatabaseError(Exception):
    """Exceção para erros de banco de dados."""

    pass
