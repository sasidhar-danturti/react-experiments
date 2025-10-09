"""FastAPI web service that mimics calling a LangGraph agent.

The implementation adapts the Databricks-specific Sales Intelligence agent
into a generic service that can run against any SQL warehouse reachable via an
SQLAlchemy connection string. The only placeholder left for the user is the
LLM instantiation – replace :func:`make_llm` with your preferred provider.
"""

from __future__ import annotations

import json
import os
import textwrap
from typing import Any, Dict, List, Optional, Sequence

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from typing_extensions import Annotated, TypedDict

from langchain_core.messages import SystemMessage
from langchain_core.runnables import RunnableLambda
from langchain_core.tools import BaseTool, StructuredTool
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import RunnableConfig


# ============================================================================
# SQL warehouse client (SQLAlchemy-based)
# ============================================================================
class SQLWarehouseClient:
    """Lightweight helper for running SQL queries.

    If ``SQL_WAREHOUSE_URL`` is not provided the client falls back to an
    in-memory SQLite database so the service can be started without any
    external dependencies. Supply a connection string when you are ready to
    point the service at a real warehouse (e.g. PostgreSQL, Databricks, etc.).
    """

    def __init__(self, *, url: Optional[str] = None):
        self._url = url or os.getenv("SQL_WAREHOUSE_URL") or "sqlite+pysqlite:///:memory:"

        engine_kwargs: Dict[str, Any] = {}
        if self._url.startswith("sqlite") and ":memory:" in self._url:
            # Use a static pool so the in-memory database persists across
            # connections that SQLAlchemy opens under the hood.
            engine_kwargs.update(
                {
                    "connect_args": {"check_same_thread": False},
                    "poolclass": StaticPool,
                }
            )
        else:
            engine_kwargs["pool_pre_ping"] = True

        self._engine: Engine = create_engine(self._url, **engine_kwargs)
        self.default_catalog: Optional[str] = os.getenv("SQL_DEFAULT_CATALOG")
        self.default_schema: Optional[str] = os.getenv("SQL_DEFAULT_SCHEMA")

        if self._engine.dialect.name == "sqlite":
            # SQLite does not expose catalogs/schemas the same way other
            # engines do, so keep them unset.
            self.default_catalog = None
            self.default_schema = None
        else:
            self.default_catalog = self.default_catalog or "public"
            self.default_schema = self.default_schema or "public"

    # ------------------------------------------------------------------
    def query(self, statement: str, *, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Execute a SQL statement and return rows as dictionaries."""

        with self._engine.connect() as conn:
            result = conn.execute(text(statement), params or {})
            columns = list(result.keys())
            return [dict(zip(columns, row)) for row in result.fetchall()]

    # ------------------------------------------------------------------
    def query_markdown(
        self,
        statement: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        max_rows: int = 50,
    ) -> str:
        rows = self.query(statement, params=params)
        if not rows:
            return "Query executed successfully with no result set."

        columns = list(rows[0].keys())
        header = " | ".join(columns)
        separator = " | ".join(["---"] * len(columns))
        body_rows = []
        for row in rows[:max_rows]:
            body_rows.append(
                " | ".join(
                    "" if row[col] is None else str(row[col])
                    for col in columns
                )
            )
        body = "\n".join(body_rows)
        return f"{header}\n{separator}\n{body}" if body else header

    @property
    def engine(self) -> Engine:
        return self._engine

    @property
    def url(self) -> str:
        return self._url


_SQL_CLIENT: Optional[SQLWarehouseClient] = None


def get_sql_client() -> SQLWarehouseClient:
    global _SQL_CLIENT
    if _SQL_CLIENT is None:
        _SQL_CLIENT = SQLWarehouseClient()
    return _SQL_CLIENT


def split_table_identifier(raw: str) -> tuple[Optional[str], Optional[str], str]:
    """Split a potentially qualified table name into catalog, schema, table."""

    parts = [p.strip() for p in raw.split(".") if p.strip()]
    client = get_sql_client()
    catalog = client.default_catalog
    schema = client.default_schema

    if len(parts) >= 3:
        return parts[0], parts[1], parts[2]
    if len(parts) == 2:
        return catalog, parts[0], parts[1]
    return catalog, schema, parts[0]


# ============================================================================
# Helper functions for describing tables
# ============================================================================
def qualify_table_name(raw: str) -> str:
    """Ensure the table name is fully qualified when the engine supports it."""

    catalog, schema, table = split_table_identifier(raw)
    components = [comp for comp in (catalog, schema, table) if comp]
    return ".".join(components)


def quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace("\"", "\"\"")}"'


def describe_table(table: str) -> List[Dict[str, Any]]:
    """Pull table metadata using SQLAlchemy's inspection utilities."""

    client = get_sql_client()
    _, schema, name = split_table_identifier(table)
    inspector = inspect(client.engine)

    try:
        columns = inspector.get_columns(name, schema=schema)
    except Exception:
        return []

    serialised: List[Dict[str, Any]] = []
    for column in columns:
        serialised.append(
            {
                "column_name": column.get("name"),
                "data_type": str(column.get("type")),
                "is_nullable": "YES" if column.get("nullable") else "NO",
                "column_default": column.get("default"),
            }
        )
    return serialised


def sample_column_values(table: str, column: str, *, limit: int = 5) -> List[str]:
    sql = textwrap.dedent(
        f"""
        SELECT DISTINCT {quote_identifier(column)} AS value
        FROM {table}
        WHERE {quote_identifier(column)} IS NOT NULL
        LIMIT {limit}
        """
    )
    try:
        rows = get_sql_client().query(sql)
    except Exception:
        return []
    return [str(r.get("value")) for r in rows if r.get("value") not in (None, "")]


def build_table_summary(table: str, label: str) -> str:
    qualified = qualify_table_name(table)
    rows = describe_table(qualified)
    if not rows:
        return f"- {label} {qualified} (no columns visible)"

    lines = [f"- {label} {qualified}"]
    for row in rows:
        column = row.get("column_name")
        datatype = row.get("data_type")
        nullable = row.get("is_nullable")
        default = row.get("column_default")
        line = f"    • {column} {datatype}"
        if nullable:
            line += f" (nullable={nullable})"
        if default:
            line += f" default={default}"
        samples = sample_column_values(qualified, column)
        if samples:
            line += f" (examples: {', '.join(samples)})"
        lines.append(line)
    return "\n".join(lines)


# ============================================================================
# Tool implementations
# ============================================================================
class RunSQLInput(BaseModel):
    statement: str
    max_rows: int = 50


def run_sql_tool(statement: str, max_rows: int = 50) -> str:
    return get_sql_client().query_markdown(statement, max_rows=max_rows)


class DescribeTableInput(BaseModel):
    table: str = Field(..., description="Fully qualified table name")


def describe_table_tool(table: str) -> str:
    summary = build_table_summary(table, "Table")
    return summary


class ProfileTableInput(BaseModel):
    table: str
    sample_rows: int = 5


def profile_table_tool(table: str, sample_rows: int = 5) -> str:
    qualified = qualify_table_name(table)
    rowcount_sql = f"SELECT COUNT(*) AS row_count FROM {qualified}"
    row_count_raw = get_sql_client().query(rowcount_sql)[0]["row_count"]
    try:
        row_count = int(row_count_raw)
    except Exception:
        row_count = row_count_raw
    schema_md = describe_table_tool(qualified)

    sample_sql = f"SELECT * FROM {qualified} LIMIT {sample_rows}"
    sample_md = get_sql_client().query_markdown(sample_sql, max_rows=sample_rows)

    return textwrap.dedent(
        f"""
        **Profile: {qualified}**

        - **Row count:** {row_count}
        - **Schema:**
        {schema_md}

        - **Sample rows:**
        {sample_md}
        """
    ).strip()


class HTMLBlock(BaseModel):
    kind: str = Field(..., description="Either 'md' or 'html'")
    content: str


class ComposeHTMLReportInput(BaseModel):
    title: str
    blocks: List[HTMLBlock]
    css: Optional[str] = None


def compose_html_report_tool(title: str, blocks: List[Any], css: Optional[str] = None) -> str:
    head_css = css or """
    body{font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem;}
    h1,h2,h3{font-weight:600} .section{margin:1.5rem 0} table{border-collapse:collapse;width:100%}
    td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
    """

    import html

    safe_blocks: List[Dict[str, str]] = []
    for block in blocks or []:
        if isinstance(block, HTMLBlock):
            kind = (block.kind or "").lower()
            content = block.content or ""
        elif isinstance(block, dict):
            kind = (block.get("kind") or "").lower()
            content = block.get("content") or ""
        else:
            continue
        if kind in {"md", "html"}:
            safe_blocks.append({"kind": kind, "content": content})

    return f"""<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>{html.escape(title or 'Report')}</title>
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <style>{head_css}</style>
  <script src=\"https://cdn.jsdelivr.net/npm/marked/marked.min.js\"></script>
</head>
<body>
  <h1>{html.escape(title or 'Report')}</h1>
  <div id=\"report\"></div>
  <script>
    const blocks = {json.dumps(safe_blocks)};
    const mount = document.getElementById('report');
    for (const block of blocks) {{
      const section = document.createElement('section');
      section.className = 'section';
      if (block.kind === 'md') {{
        const container = document.createElement('div');
        container.innerHTML = marked.parse(block.content || '');
        section.appendChild(container);
      }} else {{
        const container = document.createElement('div');
        container.innerHTML = block.content || '';
        section.appendChild(container);
      }}
      mount.appendChild(section);
    }}
  </script>
</body>
</html>"""


TOOLS: List[BaseTool] = [
    StructuredTool.from_function(
        run_sql_tool,
        name="run_sql",
        description="Execute SQL and return a Markdown table.",
        args_schema=RunSQLInput,
    ),
    StructuredTool.from_function(
        describe_table_tool,
        name="describe_table",
        description="Describe a table using information_schema.",
        args_schema=DescribeTableInput,
    ),
    StructuredTool.from_function(
        profile_table_tool,
        name="profile_table",
        description="Profile a table (row count, schema, sample rows).",
        args_schema=ProfileTableInput,
    ),
    StructuredTool.from_function(
        compose_html_report_tool,
        name="compose_html_report",
        description="Render a simple HTML document from Markdown/HTML blocks.",
        args_schema=ComposeHTMLReportInput,
    ),
]


# ============================================================================
# LangGraph wiring
# ============================================================================
class AgentState(TypedDict):
    messages: Annotated[List[Any], add_messages]


def create_tool_calling_agent(model: Any, tools: Sequence[BaseTool], system_prompt: Optional[str] = None):
    model = model.bind_tools(tools)

    def should_continue(state: AgentState) -> str:
        last = state["messages"][-1]
        tool_calls = getattr(last, "additional_kwargs", {}).get("tool_calls") or getattr(last, "tool_calls", None)
        return "continue" if tool_calls else "end"

    def prepend_system(state: AgentState):
        if not system_prompt:
            return state["messages"]
        return [SystemMessage(content=system_prompt)] + state["messages"]

    model_runnable = RunnableLambda(prepend_system) | model

    def call_model(state: AgentState, config: RunnableConfig):
        response = model_runnable.invoke(state, config)
        return {"messages": [response]}

    graph = StateGraph(AgentState)
    graph.add_node("agent", RunnableLambda(call_model))
    graph.add_node("tools", ToolNode(tools))
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"continue": "tools", "end": END})
    graph.add_edge("tools", "agent")
    return graph.compile()


# ============================================================================
# System prompt
# ============================================================================
def system_prompt() -> str:
    return "You are an analytics assistant. Answer succinctly and use the available tools when necessary."


# ============================================================================
# LLM placeholder
# ============================================================================
def make_llm() -> Any:
    """Instantiate the chat model used by LangGraph.

    Replace this implementation with your preferred provider (e.g. OpenAI,
    Azure OpenAI, Anthropic). The returned object must implement the
    LangChain ``BaseChatModel`` interface so it can be bound to tools.
    """

    raise NotImplementedError("Configure your LLM provider here (e.g. ChatOpenAI).")


# ============================================================================
# FastAPI wiring
# ============================================================================
app = FastAPI(title="LangGraph Agent Service")


class ChatMessage(BaseModel):
    role: str
    content: str
    tool_calls: Optional[List[Dict[str, Any]]] = None

    def to_payload(self) -> Dict[str, Any]:
        payload = self.model_dump()
        return {k: v for k, v in payload.items() if v is not None}


class ChatRequest(BaseModel):
    messages: List[ChatMessage]


class ChatResponse(BaseModel):
    messages: List[ChatMessage]


_AGENT = None


def get_agent():
    global _AGENT
    if _AGENT is None:
        llm = make_llm()
        _AGENT = create_tool_calling_agent(llm, TOOLS, system_prompt=system_prompt())
    return _AGENT


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    try:
        agent = get_agent()
    except NotImplementedError as exc:  # pragma: no cover - configuration gate
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    conversation = [message.to_payload() for message in request.messages]

    try:
        state = agent.invoke({"messages": conversation})
    except Exception as exc:  # pragma: no cover - runtime guard
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    out_messages = state.get("messages", [])
    serialised: List[ChatMessage] = []
    for msg in out_messages:
        role = getattr(msg, "role", None) or getattr(msg, "type", "assistant")
        content = getattr(msg, "content", "")
        tool_calls = getattr(msg, "additional_kwargs", {}).get("tool_calls")
        serialised.append(ChatMessage(role=role, content=content, tool_calls=tool_calls))

    return ChatResponse(messages=serialised)


@app.get("/health")
async def healthcheck() -> Dict[str, str]:
    return {"status": "ok"}


__all__ = [
    "app",
    "SQLWarehouseClient",
    "run_sql_tool",
    "describe_table_tool",
    "profile_table_tool",
    "compose_html_report_tool",
]
