"""The pure half of the document step: no model, no files. Markdown helpers and checks, the backlog (JSON Schema, validation,
deterministic rendering in the format `scripts/tasks.py` reads), the OpenAPI draft (operations in, OpenAPI 3.1 out, validation) and
the business facts written into the `CLAUDE.md` files. `documents.py` calls the model and writes the files."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

# ---------- text ----------

LEFTOVER_RE = re.compile(r"\bTBD\b|\bTODO\b|__[A-Z][A-Z0-9_]{2,}__|<(?:Project|Screen name|Flow name|PREFIX|prefix|master|project|Name|name)>|\bXXX-")
FENCE_RE = re.compile(r"^\s*```[a-zA-Z]*\s*\n(.*?)\n```\s*$", re.S)
H2_RE = re.compile(r"^## (\d+)\.", re.M)
MIN_DOCUMENT_CHARS = 500


def strip_fences(text: str) -> str:
    """The answer without a code fence around the whole document (a model sometimes adds one)."""
    text = text.strip()
    match = FENCE_RE.match(text)
    return (match.group(1) if match else text).strip() + "\n"


def sections(markdown: str) -> Dict[str, str]:
    """`## N. Title` blocks by number, each with its sub-sections, in a dict keyed by the number as text."""
    marks = list(H2_RE.finditer(markdown))
    out: Dict[str, str] = {}
    for index, mark in enumerate(marks):
        end = marks[index + 1].start() if index + 1 < len(marks) else len(markdown)
        out.setdefault(mark.group(1), markdown[mark.start():end].rstrip() + "\n")
    return out


def pick(markdown: str, numbers: Iterable[int]) -> str:
    """The sections with these numbers, in order; the empty string when none exists."""
    found = sections(markdown)
    return "\n".join(found[str(n)] for n in numbers if str(n) in found)


def outline(markdown: str) -> str:
    return "\n".join(line for line in markdown.splitlines() if line.startswith(("# ", "## ", "### ")))


def check_markdown(text: str, headings: List[str], patterns: List[List[str]]) -> List[str]:
    """Problems of a generated Markdown document; empty when it is acceptable."""
    problems = []
    if len(text.strip()) < MIN_DOCUMENT_CHARS:
        problems.append(f"the document is too short ({len(text.strip())} characters)")
    lines = text.splitlines()
    for heading in headings:
        number = heading.split(".", 1)[0]
        if not any(re.match(rf"^##\s+{re.escape(number)}\.\s*\S", line) for line in lines):
            problems.append(f"missing the heading `## {heading}`")
    for pattern, meaning in patterns:
        if not re.search(pattern, text, re.M):
            problems.append(f"missing {meaning}")
    for number, line in enumerate(lines, start=1):
        found = LEFTOVER_RE.search(line)
        if found:
            problems.append(f"line {number} still holds `{found.group(0)}` (write `OPEN: ...` for an open point)")
            if len(problems) > 12:
                break
    return problems


def error_codes(domain: str) -> List[str]:
    """The codes inside the first fenced block of `## 11. Error Codes` (the list the admin and app tests compare)."""
    section = sections(domain).get("11", "")
    parts = section.split("```")
    return re.findall(r"^([A-Z][A-Z_]{3,})\b", parts[1], re.M) if len(parts) > 2 else []


def compose_domain(model_text: str, base: str) -> str:
    """The generated domain document: the template's title and `## 11. Error Codes` block kept as shipped (the admin and the
    apps compare their error catalogs with it), the model's own codes added after the block as a proposal."""
    theirs = sections(base)
    if "11" not in theirs:
        return model_text
    mine = sections(model_text)
    title = base[:base.index("## 1.")] if "## 1." in base else ""
    own11 = re.sub(r"^## 11\..*\n", "", mine.get("11", ""), count=1).strip() or "none"
    parts = [title]
    for number in map(str, range(1, 14)):
        if number == "11":
            parts.append(theirs["11"].split("\n### 11.1")[0].rstrip() + "\n\n### 11.1 Domain-specific codes (proposed; add each to the code and both locales when built)\n" + own11)
        elif number in mine:
            parts.append(mine[number])
    return "\n\n".join(part.strip("\n") for part in parts if part.strip()) + "\n"


def replace_sections(base: str, replacements: Dict[str, str], keep_heading: bool = True) -> str:
    """`base` with the body of the sections in `replacements` (number → the model's section text) swapped in; the base's heading is kept."""
    found = sections(base)
    for number, text in replacements.items():
        if number not in found:
            continue
        body = re.sub(r"^## .*\n", "", text, count=1) if keep_heading else text
        heading = found[number].splitlines()[0]
        base = base.replace(found[number], heading + "\n" + body.strip() + "\n\n", 1)
    return base


def excerpt(document: str, terms: Iterable[str], limit: int) -> str:
    """The paragraphs of the business document most about `terms`, in their order, within `limit` characters. A document that fits is
    given whole. The first paragraph (the title and intro) always comes along."""
    text = document.strip()
    if len(text) <= limit:
        return text
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    wanted = {word for term in terms for word in re.findall(r"\w{3,}", term.lower())}

    def score(paragraph: str) -> int:
        return len(wanted & set(re.findall(r"\w{3,}", paragraph.lower())))

    chosen, used = {0}, len(paragraphs[0])
    for index in sorted(range(1, len(paragraphs)), key=lambda i: (-score(paragraphs[i]), i)):
        if used + len(paragraphs[index]) + 2 <= limit:
            chosen.add(index)
            used += len(paragraphs[index]) + 2
    return "\n\n".join(paragraphs[i] for i in sorted(chosen))[:limit]


def digest(prd: str, limit: int = 3500) -> str:
    """What another project needs from a PRD: its headings and the lines that name operations."""
    keep = [line for line in prd.splitlines() if line.startswith("###") or re.search(r"\*\*Actions?\*\*|\*\*Operations?\*\*", line)]
    return "\n".join(keep)[:limit]


# ---------- backlog ----------

BACKLOG_HEADER = "| ID | Title | Branch | Needs | Status | Notes |\n|---|---|---|---|---|---|\n"
KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,19}$")
MAX_TASKS = 80
OWNER_INPUT = "**owner input**"


def _s(**extra: Any) -> Dict[str, Any]:
    return dict({"type": "string"}, **extra)


def _list(items: Dict[str, Any], **extra: Any) -> Dict[str, Any]:
    return dict({"type": "array", "items": items}, **extra)


def _obj(properties: Dict[str, Any]) -> Dict[str, Any]:
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


BACKLOG_SCHEMA = _obj({
    "tasks": _list(_obj({"key": _s(), "title": _s(), "stage": _s(), "slug": _s(), "needs": _list(_s()), "reads": _s(), "waits_for": _s()}), minItems=1),
    "owner_questions": _list(_s()),
})


def check_backlog(data: Any, foreign_ids: Iterable[str], question_ids: Iterable[str]) -> List[str]:
    """Problems of a backlog answer; a backlog with none renders into a file `tasks.py check` accepts."""
    if not isinstance(data, dict) or not isinstance(data.get("tasks"), list) or not data["tasks"]:
        return ["`tasks` must be a non-empty list"]
    foreign, questions = set(foreign_ids), set(question_ids)
    problems, seen = [], set()
    if len(data["tasks"]) > MAX_TASKS:
        problems.append(f"{len(data['tasks'])} tasks; the limit is {MAX_TASKS}")
    for index, task in enumerate(data["tasks"][:MAX_TASKS]):
        where = f"tasks[{index}]"
        if not isinstance(task, dict):
            problems.append(f"{where}: must be an object")
            continue
        key = str(task.get("key", ""))
        if not KEY_RE.match(key):
            problems.append(f"{where}.key {key!r}: use lower-case letters, digits, '-' or '_' (at most 20)")
        elif key in seen:
            problems.append(f"{where}.key {key!r} is used twice")
        if not str(task.get("title", "")).strip():
            problems.append(f"{where}.title is empty")
        for need in task.get("needs") or []:
            if need in seen:
                continue
            if need in foreign:
                continue
            problems.append(f"{where}.needs {need!r}: not an earlier task of this project and not one of the listed ids of the other project")
        waits = task.get("waits_for") or ""
        if waits and waits not in questions:
            problems.append(f"{where}.waits_for {waits!r}: not one of the open question ids")
        seen.add(key)
    for qid in data.get("owner_questions") or []:
        if qid not in questions:
            problems.append(f"owner_questions: {qid!r} is not one of the open question ids")
    return problems


def cell(text: Any, limit: int = 200) -> str:
    """Text safe inside a backlog cell: no pipe, no backtick (an odd one would swallow the rest of the row), no line break."""
    return " ".join(re.sub(r"[|`]+", " ", str(text or "")).split())[:limit]


def slug_of(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")[:40].strip("-") or "task"


def pending_note(question: Dict[str, str]) -> str:
    note = f"{OWNER_INPUT}: {cell(question.get('question'), 300)}"
    if question.get("why"):
        note += f" Why: {cell(question['why'], 200)}."
    if question.get("proposed_default"):
        note += f" Proposed: {cell(question['proposed_default'], 200)}."
    return f"{note} [open question {cell(question.get('id'), 40)}]"


def claims_of(data: Optional[Dict[str, Any]], asked: Iterable[str]) -> List[str]:
    """The open questions a backlog says it cannot finish without (its list plus every task's `waits_for`), in order."""
    if not data:
        return []
    wanted = list(data.get("owner_questions") or []) + [t.get("waits_for") for t in data.get("tasks") or [] if t.get("waits_for")]
    asked = set(asked)
    out: List[str] = []
    for qid in wanted:
        if qid in asked and qid not in out:
            out.append(qid)
    return out


def render_backlog(project: Dict[str, str], key: str, data: Optional[Dict[str, Any]], claimed: List[Dict[str, str]],
                   foreign_ids: Iterable[str] = ()) -> Tuple[str, List[Tuple[str, str]], Dict[str, str]]:
    """The backlog file in the exact table format of `tasks.py` (`| ID | Title | Branch | Needs | Status | Notes |`), the
    `(id, title)` of its feature rows, and the id of the PENDING row of each claimed question. Ids, branches and statuses are
    assigned here, so the file cannot be malformed: foundation rows `TODO`; a row needing another project, or waiting on an owner
    answer, `BLOCKED`; one `PENDING` row per claimed question; an end-of-backlog row that needs every leaf task."""
    prefix, lower, master = project["prefix"], project["prefix"].lower(), project["master"]
    foreign = set(foreign_ids)
    tasks = list((data or {}).get("tasks") or [])[:MAX_TASKS]
    count = 2 + len(tasks)
    pending_ids = {q["id"]: f"{prefix}-{count + 1 + i:03d}" for i, q in enumerate(claimed)}
    ids = {t["key"]: f"{prefix}-{3 + i:03d}" for i, t in enumerate(tasks)}
    foundation = f"{prefix}-002"
    rows: List[Tuple[str, str]] = []
    out = [f"# {project['dir']} — Task Backlog\n",
           f"> One task = one branch = one PR into `{master}`. Next task: `python3 scripts/tasks.py next {key}`. Never read this file whole. "
           "Written by SYSTEM_SETUP from the PRD and BRD: review it with the owner. `PENDING` rows wait for an owner answer "
           f"({OWNER_INPUT}); `BLOCKED` rows wait for tasks of another project.\n",
           "## Stage A — Foundation", BACKLOG_HEADER.rstrip(),
           f"| {prefix}-001 | Project scaffold: install, gate green, first commit | `feat/{lower}-001-scaffold` | — | TODO | project `CLAUDE.md` §1; no ops |",
           f"| {foundation} | Config loader and env schema (`.env.example` enforced by a test) | `feat/{lower}-002-config` | {prefix}-001 | TODO | no ops |"]
    needed_by = set()
    stage, letter = None, "A"
    for index, task in enumerate(tasks):
        task_id = ids[task["key"]]
        needs = []
        for need in task.get("needs") or []:
            resolved = ids.get(need) if need in ids and ids[need] < task_id else (need if need in foreign else None)
            if resolved and resolved not in needs:
                needs.append(resolved)
        local_needs = [n for n in needs if n not in foreign]
        needed_by.update(local_needs)
        if not local_needs:
            needs.insert(0, foundation)
        waits = task.get("waits_for") or ""
        if waits in pending_ids:
            needs.append(pending_ids[waits])
        blocked = any(n in foreign for n in needs) or waits in pending_ids
        name = cell(task.get("stage"), 70) or "Tasks"
        if name != stage:
            letter = chr(ord(letter) + 1) if stage is not None else "B"
            letter = letter if letter < "Z" else "Y"
            out += ["", f"## Stage {letter} — {name}", BACKLOG_HEADER.rstrip()]
            stage = name
        title = cell(task.get("title"), 160)
        out.append(f"| {task_id} | {title} | `feat/{lower}-{task_id[-3:]}-{slug_of(task.get('slug') or title)}` | {', '.join(needs)} | "
                   f"{'BLOCKED' if blocked else 'TODO'} | {cell(task.get('reads'), 240) or 'no ops'} |")
        rows.append((task_id, title))
    if claimed:
        out += ["", "## Owner input (PENDING)", BACKLOG_HEADER.rstrip()]
        for question in claimed:
            title = "Owner decision: " + cell(question.get("question"), 110)
            out.append(f"| {pending_ids[question['id']]} | {title} | `feat/{lower}-{pending_ids[question['id']][-3:]}-owner-input` | — | PENDING | {pending_note(question)} |")
    final = f"{prefix}-{count + len(claimed) + 1:03d}"
    leaves = [ids[t["key"]] for t in tasks if ids[t["key"]] not in needed_by] or [foundation]
    out += ["", "## Stage Z — End-of-backlog checks", BACKLOG_HEADER.rstrip(),
            f"| {final} | Full gate and end-to-end journey of every PRD flow; fix findings | `feat/{lower}-{final[-3:]}-e2e` | {', '.join(leaves[:12])} | TODO | rules §3.13 |"]
    return "\n".join(out) + "\n", rows, pending_ids


# ---------- OpenAPI draft ----------

FIELD_TYPES = ["string", "integer", "number", "boolean", "string[]", "integer[]", "object", "object[]"]
METHODS = ["get", "post", "put", "patch", "delete"]
DRAFT_NOTE = ("STARTING DRAFT written by SYSTEM_SETUP from the plan, the domain and the PRD. Not generated from server code and not "
              "compared by the server's contract guard. The server's first contract task turns it into the real contract "
              "(`docs/api/openapi.<namespace>.json`, generated by `npm run docs`).")

_FIELD = _obj({"name": _s(), "type": _s(enum=FIELD_TYPES), "required": {"type": "boolean"}, "description": _s()})
CONTRACT_SCHEMA = _obj({"operations": _list(_obj({
    "id": _s(), "method": _s(enum=METHODS), "path": _s(), "summary": _s(), "tag": _s(), "auth": {"type": "boolean"},
    "request_fields": _list(_FIELD), "response_fields": _list(_FIELD), "errors": _list(_s())}), minItems=1)})
PATH_PARAM_RE = re.compile(r"\{([A-Za-z][A-Za-z0-9_]*)\}")


def check_contract(data: Any) -> List[str]:
    if not isinstance(data, dict) or not isinstance(data.get("operations"), list) or not data["operations"]:
        return ["`operations` must be a non-empty list"]
    problems, seen, routes = [], set(), set()
    for index, op in enumerate(data["operations"]):
        where = f"operations[{index}]"
        if not isinstance(op, dict):
            problems.append(f"{where}: must be an object")
            continue
        op_id, method, path = str(op.get("id", "")), str(op.get("method", "")), str(op.get("path", ""))
        if not re.match(r"^[a-z][A-Za-z0-9]{2,60}$", op_id):
            problems.append(f"{where}.id {op_id!r}: use lowerCamelCase letters and digits")
        elif op_id in seen:
            problems.append(f"{where}.id {op_id!r} is used twice")
        seen.add(op_id)
        if method not in METHODS:
            problems.append(f"{where}.method {method!r}: use one of {', '.join(METHODS)}")
        if not path.startswith("/") or " " in path:
            problems.append(f"{where}.path {path!r}: must start with / and hold no space")
        if (method, path) in routes:
            problems.append(f"{where}: {method.upper()} {path} is listed twice")
        routes.add((method, path))
    return problems


def _schema(kind: str) -> Dict[str, Any]:
    if kind.endswith("[]"):
        return {"type": "array", "items": _schema(kind[:-2])}
    return {"type": kind}


def _properties(fields: List[Dict[str, Any]]) -> Dict[str, Any]:
    props = {}
    for field in fields:
        entry = _schema(field["type"])
        if field.get("description"):
            entry["description"] = field["description"]
        props[field["name"]] = entry
    return props


def render_openapi(system: str, module_id: str, module_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """OpenAPI 3.1 for one audience from its operations: the success/error envelope of INTEGRATION.md §2, bearer auth, path and
    query parameters, request bodies. Deterministic: the same operations give the same document."""
    paths: Dict[str, Dict[str, Any]] = {}
    for op in data["operations"]:
        required_params = PATH_PARAM_RE.findall(op["path"])
        params = [{"name": name, "in": "path", "required": True, "schema": {"type": "string"}} for name in required_params]
        entry: Dict[str, Any] = {"operationId": op["id"], "summary": op.get("summary", ""), "tags": [op.get("tag") or "general"]}
        fields = [f for f in op.get("request_fields") or [] if f["name"] not in required_params]
        if op["method"] in ("get", "delete"):
            params += [{"name": f["name"], "in": "query", "required": bool(f.get("required")), "schema": _schema(f["type"])} for f in fields]
        elif fields:
            body = {"type": "object", "properties": _properties(fields), "required": [f["name"] for f in fields if f.get("required")]}
            entry["requestBody"] = {"required": True, "content": {"application/json": {"schema": body}}}
        if params:
            entry["parameters"] = params
        if op.get("auth"):
            entry["security"] = [{"bearerAuth": []}]
        data_schema = {"type": "object", "properties": _properties(op.get("response_fields") or [])}
        entry["responses"] = {
            "200": {"description": "Success", "content": {"application/json": {"schema": {
                "type": "object", "properties": {"success": {"type": "boolean", "const": True}, "message": {"type": "string"}, "data": data_schema},
                "required": ["success", "data"]}}}},
            "default": {"description": "Failure; branch on error.code" + (": " + ", ".join(op["errors"]) if op.get("errors") else ""),
                        "content": {"application/json": {"schema": {"$ref": "#/components/schemas/ErrorEnvelope"}}}}}
        if op.get("errors"):
            entry["x-error-codes"] = list(op["errors"])
        paths.setdefault(op["path"], {})[op["method"]] = entry
    return {
        "openapi": "3.1.0",
        "info": {"title": f"{system} — {module_name} API (starting draft)", "version": "0.1.0-draft", "description": DRAFT_NOTE,
                 "x-draft": True, "x-audience": module_id},
        "paths": paths,
        "components": {
            "securitySchemes": {"bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}},
            "schemas": {"ErrorEnvelope": {"type": "object", "required": ["success", "message", "error"], "properties": {
                "success": {"type": "boolean", "const": False}, "message": {"type": "string"},
                "error": {"type": "object", "required": ["code", "traceId"], "properties": {
                    "code": {"type": "string"}, "details": {"type": "array", "items": {"type": "object"}}, "traceId": {"type": "string"}}}}}}},
    }


def validate_openapi(document: Any) -> List[str]:
    """Problems of an OpenAPI draft: well-formed JSON, the required top-level fields, unique operation ids, resolvable `$ref`s."""
    if not isinstance(document, dict):
        return ["the document must be a JSON object"]
    problems = []
    if not str(document.get("openapi", "")).startswith("3.1"):
        problems.append("`openapi` must be a 3.1 version")
    info = document.get("info")
    if not isinstance(info, dict) or not info.get("title") or not info.get("version"):
        problems.append("`info` needs a title and a version")
    paths = document.get("paths")
    if not isinstance(paths, dict) or not paths:
        problems.append("`paths` must be a non-empty object")
        return problems
    if "components" in document and not isinstance(document["components"], dict):
        problems.append("`components` must be an object")
    seen = set()
    for path, item in paths.items():
        if not str(path).startswith("/") or not isinstance(item, dict):
            problems.append(f"path {path!r}: must start with / and hold operations")
            continue
        for method, op in item.items():
            if method not in METHODS or not isinstance(op, dict):
                problems.append(f"{path} {method}: not an operation")
                continue
            if not op.get("operationId"):
                problems.append(f"{method.upper()} {path}: no operationId")
            elif op["operationId"] in seen:
                problems.append(f"operationId {op['operationId']!r} is used twice")
            seen.add(op.get("operationId"))
            if not op.get("responses"):
                problems.append(f"{method.upper()} {path}: no responses")
    schemas = (document.get("components") or {}).get("schemas") or {}
    for ref in re.findall(r'"\$ref":\s*"#/components/schemas/([^"]+)"', json.dumps(document)):
        if ref not in schemas:
            problems.append(f"$ref to a missing schema: {ref}")
    return problems


# ---------- business facts for the CLAUDE.md files ----------

FACTS_START, FACTS_END = "<!-- business-facts:start -->", "<!-- business-facts:end -->"
ROOT_LINE_RE = re.compile(r"^\*\*[^*\n]+:\*\* the business, its rules and the open decisions are in `docs/knowledge/system-overview\.md`\..*$", re.M)


def short(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit]
    stop = max(cut.rfind(". "), cut.rfind("؟ "), cut.rfind("。"))
    return (cut[:stop + 1] if stop > limit // 2 else cut.rstrip() + "…")


def root_facts(plan: Any, name: str) -> str:
    languages, currency, zones = plan.languages, plan.currency, plan.time_zones
    actors = ", ".join(a.name for a in plan.business.actors)
    return (f"{FACTS_START}**{name}:** {short(plan.business.summary, 330)} Languages: default `{languages.default}` "
            f"({'right-to-left' if languages.direction == 'rtl' else 'left-to-right'}), supported {', '.join(languages.supported)}. "
            f"Money: `{currency.code}` in integer {currency.minor_unit}; times stored in `{zones.stored}`, shown in `{zones.business}`. "
            f"Actors: {short(actors, 160)}. Rules and data: `BUSINESS_DOMAIN.md`; open decisions: `python3 scripts/tasks.py blocked`.{FACTS_END}")


def project_facts(plan: Any, module: Any, sdk: Any, files: List[str], compact: bool = False) -> str:
    """The business-facts block of a project `CLAUDE.md`; `compact` keeps one subject line and the document list."""
    languages, currency, zones = plan.languages, plan.currency, plan.time_zones
    size = 90 if compact else 160
    if module is not None:
        subject = (f"- This project is the {module.kind} module `{module.id}` ({short(module.name, 60)}), platforms {', '.join(module.platforms)}. "
                   f"Audience: {short(module.audience, size)} Why: {short(module.why, size)}")
    else:
        subject = (f"- This project is the SDK `{sdk.id}` ({short(sdk.title, 60)}), source {sdk.source}, provider {sdk.provider or 'not chosen'}. "
                   f"Why: {short(sdk.why, size)}")
    lines = [FACTS_START, "## Business facts (written by SYSTEM_SETUP from the plan)", subject]
    if not compact:
        lines.append(f"- Language `{languages.default}` ({languages.direction}); money `{currency.code}` in integer {currency.minor_unit}; stored `{zones.stored}`, "
                     "business `" + zones.business + "`. Rules, enums, error codes: root `BUSINESS_DOMAIN.md`; open decisions are `PENDING` backlog rows.")
    if files:
        lines.append("- Documents: " + ", ".join(f"`{path}`" for path in files))
    lines.append(FACTS_END)
    return "\n".join(lines) + "\n"


def put_facts(text: str, block: str, root: bool) -> str:
    """The file with the business-facts block set: an earlier block is replaced; else the root's template placeholder line is
    replaced, or the block is appended."""
    if FACTS_START in text and FACTS_END in text:
        head = text.split(FACTS_START, 1)[0]
        tail = text.split(FACTS_START, 1)[1].split(FACTS_END, 1)[1]
        return head + block.rstrip("\n") + tail
    if root and ROOT_LINE_RE.search(text):
        return ROOT_LINE_RE.sub(lambda _: block, text, count=1)
    return text.rstrip("\n") + "\n\n" + block
