"""The document step: the plan and the business document become the documents of a mature project, one small model call each.

In the order the documents depend on each other: `BUSINESS_DOMAIN.md` (every other document cites its section numbers); then per
module (server first) the BRD, PRD and Design Script; then the backlogs, server first (a client row needs the ids of the server rows,
and the server backlog reads the clients' PRDs); then `INTEGRATION.md`, and one starting OpenAPI file per client module.

Every call goes through the `Analyzer` seam with the same flags as the analysis (no tools, no MCP, no settings) and receives only its
slice: the plan slice, the relevant part of the business document and the sections of earlier documents it must agree with. The
business document is data, never instructions. The run is resumable: `.system_setup/documents.json` records each document with
the hash of exactly what was sent; a re-run skips what is done and unchanged and redoes what changed or failed. The model, the
budget of one call and the budget of one run come from `catalog/documents.json`; a call is never started that could not fit in it."""
from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import docrender as dr
from analyzer import Analyzer, AnalyzerError, ClaudeNotFound, Request
from catalog import CATALOG_DIR, Catalog, DocumentSettings
from manifest import tool_root
from plan import PLAN_FILE, Plan
from planspec import title_of

STATE_REL = ".system_setup/documents.json"
DATA_REL = ".system_setup/documents"
REGISTRY_REL = ".claude/projects.json"
BUSINESS_DOC_REL = "docs/BUSINESS.md"
ANALYZED_DOC_REL = ".system_setup/analyzed_document.sha256"   # what the plan was last analyzed from: docs/BUSINESS.md itself may be edited
MODULES_REL = "docs/modules"
DRAFT_REL = "docs/api/draft"
STATE_VERSION = 1
PROMPT_NAMES = ("system", "markdown", "domain", "brd", "prd_client", "prd_server", "design", "integration", "backlog", "contract")
MAX_FAILURES_IN_A_ROW = 3
RANK = {"server": 0, "admin": 1}
SUFFIX = {"brd": "BRD", "prd": "PRD", "design": "Design_Script"}
STRUCTURE_OF = {"domain": "domain", "brd": "brd", "design": "design", "integration": "integration"}


class DocumentsError(Exception):
    """The document step cannot start (missing plan, registry or prompts)."""


class OutOfBudget(Exception):
    pass


@dataclass
class Prompts:
    text: Dict[str, str]
    structure: Dict[str, Any]

    @classmethod
    def load(cls, root: Optional[Path] = None) -> "Prompts":
        root = root or tool_root() / CATALOG_DIR / "prompts"
        try:
            text = {name: (root / f"{name}.md").read_text(encoding="utf-8").strip() for name in PROMPT_NAMES}
            structure = json.loads((root / "structure.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise DocumentsError(f"cannot read the document prompts in {root}: {error}")
        return cls(text, structure)


@dataclass
class Target:
    """One module of the plan and where its documents go."""
    module: Any
    project: str          # key in .claude/projects.json; empty when the engine generates no project for the module yet
    entry: Dict[str, str]
    docs_dir: str
    stem: str

    @property
    def server(self) -> bool:
        return self.module.kind == "server"

    def path(self, kind: str) -> str:
        return f"{self.docs_dir}/{self.stem}_{SUFFIX[kind]}.md"


@dataclass
class Job:
    id: str
    kind: str
    label: str
    target: Optional[Target] = None
    deps: Tuple[str, ...] = ()


@dataclass
class Spec:
    system: str
    message: str
    mode: str
    schema: Any
    accept: Callable[[Any], Tuple[Any, List[str]]]


@dataclass
class Result:
    id: str
    label: str
    status: str            # done, kept, invalid, failed, skipped, pending
    cost_usd: float = 0.0
    problems: List[str] = field(default_factory=list)


@dataclass
class Outcome:
    results: List[Result] = field(default_factory=list)
    spent_usd: float = 0.0
    budget_usd: float = 0.0
    stopped: bool = False
    created: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    resume: str = ""

    @property
    def generated(self) -> bool:
        return any(r.status in ("done", "kept", "invalid") for r in self.results)

    @property
    def unfinished(self) -> List[Result]:
        return [r for r in self.results if r.status in ("invalid", "failed", "skipped", "pending")]

    def status_text(self) -> str:
        done = [r.label for r in self.results if r.status in ("done", "kept")]
        lines = [f"written by the tool: {len(done)} document(s)"]
        for r in self.unfinished:
            lines.append(f"- {r.label}: {r.status}" + (f" ({'; '.join(r.problems[:3])})" if r.problems else ""))
        if self.stopped:
            lines.append(f"- the run stopped at its budget of ${self.budget_usd:.2f}; the rest is not written")
        return "\n".join(lines)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def compact(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def block(tag: str, content: str) -> str:
    return f"<{tag}>\n{content.strip()}\n</{tag}>"


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def read_registry(root: Path) -> Dict[str, Any]:
    try:
        return json.loads((root / REGISTRY_REL).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise DocumentsError(f"cannot read {REGISTRY_REL} in {root} ({error})")


def make_targets(plan: Plan, registry: Dict[str, Any], root: Path) -> List[Target]:
    """Every module with its project (when the engine generated one) and its document folder; server first, then admin, then the rest."""
    projects = registry.get("projects", {})
    used, targets = set(), []
    for module in plan.modules:
        key = ""
        if module.kind == "server" and "server" in projects and "server" not in used:
            key = "server"
        elif module.kind == "admin" and "admin" in projects and "admin" not in used:
            key = "admin"
        elif module.kind in ("app", "web") and module.id in projects and module.id not in used:
            key = module.id
        used.add(key)
        entry = projects.get(key, {}) if key else {}
        docs_dir = f"{entry['dir']}/docs" if entry else f"{MODULES_REL}/{module.id}"
        existing = sorted((root / docs_dir).glob("*_BRD.md")) if entry else []
        stem = existing[0].name[:-len("_BRD.md")] if len(existing) == 1 else title_of(module.id).replace(" ", "_")
        targets.append(Target(module, key, entry, docs_dir, stem))
    return sorted(targets, key=lambda t: RANK.get(t.module.kind, 2))


class Pipeline:
    def __init__(self, root: Path, plan: Plan, document: str, catalog: Catalog, analyzer: Analyzer, settings: DocumentSettings,
                 prompts: Optional[Prompts] = None, say: Callable[[str], None] = print, budget_usd: Optional[float] = None,
                 protect_edited: bool = False):
        self.root, self.plan, self.document = root, plan, document
        self.protect_edited = protect_edited   # `update`: a document the person edited is kept and the new text goes to `<name>.proposed.<ext>`
        self.catalog, self.analyzer, self.settings = catalog, analyzer, settings
        self.prompts = prompts or Prompts.load()
        self.say = say
        self.budget = budget_usd if budget_usd is not None else settings.max_budget_total_usd
        self.registry = read_registry(root)
        self.targets = make_targets(plan, self.registry, root)
        self.state: Dict[str, Any] = self.load_state()
        self.out: Dict[str, Any] = {}
        self.results: Dict[str, Result] = {}
        self.spent = 0.0
        self.stopped = False
        self.failures = 0
        self.created: List[str] = []
        self.notes: List[str] = []
        self.laid_out = False
        self.job_cost = 0.0
        self.state.setdefault("rendered", {})

    # ---------- state ----------
    def load_state(self) -> Dict[str, Any]:
        try:
            state = json.loads((self.root / STATE_REL).read_text(encoding="utf-8"))
            if state.get("version") == STATE_VERSION and isinstance(state.get("documents"), dict):
                return state
        except (OSError, json.JSONDecodeError):
            pass
        return {"version": STATE_VERSION, "spent_total_usd": 0.0, "documents": {}, "rendered": {}}

    def save_state(self) -> None:
        self.state["spent_total_usd"] = round(self.state.get("spent_total_usd", 0.0), 6)
        path = self.root / STATE_REL
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
        os.replace(temporary, path)

    def record(self, job: Job, status: str, input_sha: str = "", output_sha: str = "", path: str = "", cost: float = 0.0,
               problems: Optional[List[str]] = None) -> Result:
        problems = problems or []
        self.state["documents"][job.id] = {"status": status, "input_sha": input_sha, "output_sha": output_sha, "path": path,
                                           "cost_usd": round(cost, 6), "problems": problems}
        self.save_state()
        result = Result(job.id, job.label, status, cost, problems)
        self.results[job.id] = result
        return result

    # ---------- the plan, sliced ----------
    def facts(self) -> Dict[str, Any]:
        p = self.plan
        return {"system": {"name": p.system.name, "name_ar": p.system.name_ar}, "languages": asdict(p.languages), "countries": p.countries,
                "currency": asdict(p.currency), "time_zones": asdict(p.time_zones)}

    def module_slice(self, module: Any) -> Dict[str, Any]:
        return {"id": module.id, "kind": module.kind, "name": module.name, "audience": module.audience, "why": module.why, "platforms": module.platforms}

    def brief(self, module: Any) -> Dict[str, Any]:
        return {"id": module.id, "kind": module.kind, "name": module.name, "audience": module.audience}

    def sdk_slice(self) -> List[Dict[str, str]]:
        return [{"id": s.id, "title": s.title, "why": s.why, "source": s.source, "provider": s.provider} for s in self.plan.sdks]

    def questions(self) -> Dict[str, List[Dict[str, str]]]:
        return {"unanswered": [{"id": q.id, "question": q.question, "why": q.why, "proposed_default": q.proposed_default}
                               for q in self.plan.open_questions_unanswered()],
                "decided": [{"id": q.id, "question": q.question, "answer": q.answer} for q in self.plan.open_questions if q.answer]}

    def excerpt(self, terms: List[str], factor: int = 1) -> str:
        return dr.excerpt(self.document, terms, self.settings.excerpt_chars * factor)

    def terms(self, module: Any) -> List[str]:
        return [module.id.replace("-", " "), module.name, module.audience, module.why]

    def codes(self) -> str:
        return ", ".join(dr.error_codes(self.out.get("domain", "")))

    def system_prompt(self, kind: str, structure_key: Optional[str] = None) -> str:
        p = self.plan
        text = self.prompts.text["system"].replace("{language}", p.languages.documents).replace(
            "{minor_unit}", p.currency.minor_unit).replace("{stored}", p.time_zones.stored).replace("{business}", p.time_zones.business)
        text += "\n\n" + self.prompts.text[kind]
        if structure_key:
            structure = self.prompts.structure[structure_key]
            text += "\n\n" + self.prompts.text["markdown"].replace("{headings}", "\n".join(f"## {h}" for h in structure["headings"])).replace(
                "{words}", str(structure["words"]))
        else:
            text += "\n\nAnswer with the JSON object only."
        return text

    # ---------- the jobs, in dependency order ----------
    def jobs(self) -> List[Job]:
        jobs = [Job("domain", "domain", "BUSINESS_DOMAIN.md")]
        for t in self.targets:
            m = t.module.id
            jobs.append(Job(f"brd:{m}", "brd", f"BRD {m}", t, ("domain",)))
            jobs.append(Job(f"prd:{m}", "prd", f"PRD {m}", t, ("domain", f"brd:{m}")))
            if not t.server:
                jobs.append(Job(f"design:{m}", "design", f"Design Script {m}", t, (f"prd:{m}",)))
        mapped = [t for t in self.targets if t.project]
        for t in mapped:
            deps = ["domain", f"prd:{t.module.id}", f"brd:{t.module.id}"]
            if not t.server:
                deps += [f"backlog:{x.module.id}" for x in mapped if x.server]
            jobs.append(Job(f"backlog:{t.module.id}", "backlog", f"backlog {t.project}", t, tuple(deps)))
        jobs.append(Job("render", "render", "backlogs"))
        jobs.append(Job("integration", "integration", "INTEGRATION.md", None, ("domain",)))
        if self.server_dir() is not None:
            for t in self.targets:
                if not t.server:
                    jobs.append(Job(f"contract:{t.module.id}", "contract", f"API contract {t.module.id}", t, ("domain", f"prd:{t.module.id}")))
        return jobs

    def server_dir(self) -> Optional[str]:
        entry = self.registry.get("projects", {}).get("server")
        return entry["dir"] if entry else None

    def target_of(self, module_id: str) -> Target:
        return next(t for t in self.targets if t.module.id == module_id)

    # ---------- the messages ----------
    def build(self, job: Job) -> Spec:
        return getattr(self, f"build_{job.kind}")(job)

    def markdown_spec(self, system: str, message: str, structure_key: str, title: str) -> Spec:
        structure = self.prompts.structure[structure_key]

        def accept(raw: Any) -> Tuple[Any, List[str]]:
            text = dr.strip_fences(str(raw))
            if not text.lstrip().startswith("# "):
                text = f"# {title}\n\n{text}"
            return text, dr.check_markdown(text, structure["headings"], structure["patterns"])

        return Spec(system, message, "text", None, accept)

    def build_domain(self, job: Job) -> Spec:
        p = self.plan
        plan_slice = dict(self.facts(), business=asdict(p.business), modules=[self.brief(m) for m in p.modules], sdks=self.sdk_slice())
        message = "\n\n".join([f"Write BUSINESS_DOMAIN.md of {p.system.name}.", block("plan", compact(plan_slice)),
                               block("open_questions", compact(self.questions())),
                               block("business_document", self.excerpt([p.business.summary], 2))])
        return self.markdown_spec(self.system_prompt("domain", "domain"), message, "domain", f"{p.system.name} — Business Domain Specification")

    def build_brd(self, job: Job) -> Spec:
        t, p = job.target, self.plan
        plan_slice = dict(self.facts(), business={"summary": p.business.summary, "actors": [asdict(a) for a in p.business.actors], "rules": p.business.rules},
                          module=self.module_slice(t.module), other_modules=[self.brief(m) for m in p.modules if m.id != t.module.id], sdks=self.sdk_slice())
        message = "\n\n".join([f"Write the BRD of module `{t.module.id}` ({t.module.name}).", block("plan", compact(plan_slice)),
                               block("open_questions", compact(self.questions()["unanswered"])),
                               block("business_domain_sections", dr.pick(self.out["domain"], [1, 2, 5, 12])),
                               block("business_document", self.excerpt(self.terms(t.module)))])
        return self.markdown_spec(self.system_prompt("brd", "brd"), message, "brd", f"{t.module.name} — Business Requirements (BRD)")

    def build_prd(self, job: Job) -> Spec:
        t, p = job.target, self.plan
        key = "prd_server" if t.server else "prd_client"
        plan_slice = dict(languages=asdict(p.languages), currency=asdict(p.currency), module=self.module_slice(t.module),
                          actors=[asdict(a) for a in p.business.actors], entities=[asdict(e) for e in p.business.entities])
        numbers = [1, 2, 3, 5, 6, 7, 9] if t.server else [1, 2, 5, 6, 7, 8]
        if t.server:
            plan_slice["client_modules"] = [self.brief(m) for m in p.modules if m.id != t.module.id]
        message = "\n\n".join([f"Write the PRD of module `{t.module.id}` ({t.module.name}).", block("plan", compact(plan_slice)),
                               block("business_domain_sections", dr.pick(self.out["domain"], numbers)),
                               block("error_codes", self.codes()), block("brd_of_this_module", self.out[f"brd:{t.module.id}"]),
                               block("business_document", self.excerpt(self.terms(t.module)))])
        return self.markdown_spec(self.system_prompt(key, key), message, key, f"{t.module.name} — Product Requirements (PRD)")

    def build_design(self, job: Job) -> Spec:
        t, p = job.target, self.plan
        plan_slice = dict(languages=asdict(p.languages), module=self.module_slice(t.module))
        message = "\n\n".join([f"Write the Design Script of module `{t.module.id}` ({t.module.name}).", block("plan", compact(plan_slice)),
                               block("prd_of_this_module", self.out[f"prd:{t.module.id}"]),
                               block("business_domain_sections", dr.pick(self.out["domain"], [2])),
                               block("business_document", self.excerpt(self.terms(t.module), 1)[: self.settings.excerpt_chars // 2])])
        return self.markdown_spec(self.system_prompt("design", "design"), message, "design", f"{t.module.name} — Design Script")

    def build_backlog(self, job: Job) -> Spec:
        t, p = job.target, self.plan
        blocks = [block("project", compact({"key": t.project, "prefix": t.entry["prefix"], "kind": t.entry["kind"], "folder": t.entry["dir"],
                                            "module": self.module_slice(t.module), "languages": asdict(p.languages)})),
                  block("prd_of_this_project", self.out[f"prd:{t.module.id}"]),
                  block("brd_requirements", "\n".join(l for l in self.out[f"brd:{t.module.id}"].splitlines() if re.match(r"^\|\s*B\d{2}\s*\|", l))),
                  block("business_domain_outline", dr.outline(self.out["domain"])),
                  block("open_questions", compact(self.questions()["unanswered"]))]
        foreign: List[str] = []
        if t.server:
            needs = [f"module {x.module.id} ({x.module.name}):\n{dr.digest(self.out[f'prd:{x.module.id}'])}" for x in self.targets
                     if not x.server and f"prd:{x.module.id}" in self.out]
            blocks.append(block("client_modules_prds_digest", "\n\n".join(needs) or "none"))
        else:
            rows = [r for x in self.targets if x.server and x.project for r in self.rows_of(x)]
            foreign = [r[0] for r in rows]
            blocks.append(block("server_tasks", "\n".join(f"{i} {title}" for i, title in rows) or "none"))
        question_ids = [q.id for q in p.open_questions_unanswered()]
        system = self.system_prompt("backlog")
        message = "\n\n".join([f"Write the task list of project `{t.project}` (module `{t.module.id}`).", *blocks])

        def accept(raw: Any) -> Tuple[Any, List[str]]:
            return raw, dr.check_backlog(raw, foreign, question_ids)

        return Spec(system, message, "json", dr.BACKLOG_SCHEMA, accept)

    def build_integration(self, job: Job) -> Spec:
        p = self.plan
        layout = self.layout()
        pending = [f"{ids[q['id']]} {q['question']}" for _, _, ids, claimed in layout.values() for q in claimed]
        drafts = [f"{self.draft_path(t)}" for t in self.targets if not t.server and self.server_dir() is not None]
        projects = [{"key": k, "folder": e["dir"], "prefix": e["prefix"], "master": e["master"], "kind": e["kind"]}
                    for k, e in self.registry.get("projects", {}).items()]
        plan_slice = dict(self.facts(), modules=[self.module_slice(m) for m in p.modules], sdks=self.sdk_slice(),
                          deployment=[asdict(d) for d in p.deployment], projects=projects)
        message = "\n\n".join(["Write the business-specific sections of INTEGRATION.md.", block("plan", compact(plan_slice)),
                               block("business_domain_sections", dr.pick(self.out["domain"], [1, 6, 7, 8, 9, 13])),
                               block("draft_contract_files", "\n".join(drafts) or "none"),
                               block("pending_rows", "\n".join(pending) or "none")])
        return self.markdown_spec(self.system_prompt("integration", "integration"), message, "integration", f"{p.system.name} — Integration Map")

    def build_contract(self, job: Job) -> Spec:
        t, p = job.target, self.plan
        plan_slice = dict(languages=asdict(p.languages), module=self.module_slice(t.module))
        message = "\n\n".join([f"Write the starting API contract of the audience `{t.module.id}` ({t.module.name}).", block("plan", compact(plan_slice)),
                               block("prd_of_this_module", self.out[f"prd:{t.module.id}"]),
                               block("business_domain_sections", dr.pick(self.out["domain"], [1, 2, 3])),
                               block("error_codes", self.codes())])
        name, module = p.system.name, t.module

        def accept(raw: Any) -> Tuple[Any, List[str]]:
            problems = dr.check_contract(raw)
            if problems:
                return raw, problems
            return raw, dr.validate_openapi(dr.render_openapi(name, module.id, module.name, raw))

        return Spec(self.system_prompt("contract"), message, "json", dr.CONTRACT_SCHEMA, accept)

    # ---------- backlogs: ids, claims, rendering ----------
    def backlog_data(self, target: Target) -> Optional[Dict[str, Any]]:
        return self.out.get(f"backlog:{target.module.id}") if target.project else None

    def rows_of(self, target: Target) -> List[Tuple[str, str]]:
        data = self.backlog_data(target)
        return dr.render_backlog(dict(target.entry), target.project, data, [], [])[1] if data else []

    def layout(self) -> Dict[str, Tuple[str, List[Tuple[str, str]], Dict[str, str], List[Dict[str, str]]]]:
        """The rendered backlog of every mapped project: `(text, rows, pending ids, claimed questions)`. Each unanswered open question
        becomes one PENDING row, in the first project (server first) whose backlog says it needs the answer; a question nobody claims
        goes to the first project, so none is lost."""
        asked = {q.id: q for q in self.plan.open_questions_unanswered()}
        mapped = [t for t in self.targets if t.project]
        claimed: Dict[str, List[str]] = {t.project: [] for t in mapped}
        taken = set()
        for t in mapped:
            for qid in dr.claims_of(self.backlog_data(t), asked):
                if qid not in taken:
                    claimed[t.project].append(qid)
                    taken.add(qid)
        if mapped:
            claimed[mapped[0].project] += [qid for qid in asked if qid not in taken]
        out = {}
        server_rows: List[Tuple[str, str]] = []
        for t in mapped:
            questions = [{"id": q, "question": asked[q].question, "why": asked[q].why, "proposed_default": asked[q].proposed_default} for q in claimed[t.project]]
            foreign = [r[0] for r in server_rows] if not t.server else []
            text, rows, ids = dr.render_backlog(dict(t.entry), t.project, self.backlog_data(t), questions, foreign)
            if t.server:
                server_rows = rows
            out[t.project] = (text, rows, ids, questions)
        return out

    def render(self) -> None:
        """Writes the backlogs. A backlog the owner or an agent changed after it was written is left alone."""
        self.laid_out = True
        layout = self.layout()
        for t in [t for t in self.targets if t.project]:
            data = self.backlog_data(t)
            text, rows, ids, claimed = layout[t.project]
            rel = t.entry["backlog"]
            path = self.root / rel
            recorded = self.state["rendered"].get(t.project)
            if data is None and not claimed:
                continue
            if path.is_file() and recorded and sha(path.read_text(encoding="utf-8")) != recorded:
                if self.protect_edited and sha(text) != recorded:
                    self.propose(rel, text)
                else:
                    self.notes.append(f"{rel} was changed after it was written; kept as it is")
                continue
            if path.is_file() and path.read_text(encoding="utf-8") == text:
                self.state["rendered"][t.project] = sha(text)
                continue
            write_text(path, text)
            self.state["rendered"][t.project] = sha(text)
            self.created.append(rel)
            self.say(f"  backlog {t.project}: {len(rows)} task(s), {len(claimed)} PENDING owner row(s) -> {rel}")
        self.save_state()

    # ---------- running ----------
    def input_sha(self, spec: Spec) -> str:
        return sha(json.dumps([spec.mode, spec.system, spec.message, spec.schema], ensure_ascii=False, sort_keys=True))

    def draft_path(self, target: Target) -> str:
        return f"{self.server_dir()}/{DRAFT_REL}/openapi.{target.module.id}.draft.json"

    def output_path(self, job: Job) -> str:
        if job.kind == "domain":
            return "BUSINESS_DOMAIN.md"
        if job.kind == "integration":
            return "INTEGRATION.md"
        if job.kind == "contract":
            return self.draft_path(job.target)
        if job.kind == "backlog":
            return f"{DATA_REL}/{job.id.replace(':', '.')}.json"
        return job.target.path(job.kind)

    def edited(self, job: Job) -> bool:
        """True when the document was written by an earlier run and the file on disk is no longer that text."""
        record = self.state["documents"].get(job.id)
        path = self.root / self.output_path(job)
        return bool(record and record.get("output_sha") and path.is_file() and sha(path.read_text(encoding="utf-8")) != record["output_sha"])

    def propose(self, rel: str, text: str) -> str:
        """Writes `text` next to the edited file `rel` as `<name>.proposed<ext>` and says so; the person's file is not touched."""
        path = Path(rel)
        proposed = path.with_name(f"{path.stem}.proposed{path.suffix}").as_posix()
        write_text(self.root / proposed, text)
        self.created.append(proposed)
        self.notes.append(f"{rel} was edited after it was written: your file is kept and the new text is in {proposed}")
        return proposed

    def cached(self, job: Job, input_sha: str) -> Optional[str]:
        """The output of a finished job whose input has not changed; the edited text when someone changed the file since."""
        record = self.state["documents"].get(job.id)
        if not record or record["status"] != "done" or record["input_sha"] != input_sha:
            return None
        path = self.root / self.output_path(job)
        if not path.is_file():
            return None
        text = path.read_text(encoding="utf-8")
        if sha(text) != record["output_sha"]:
            self.notes.append(f"{self.output_path(job)} was edited after it was written; kept as it is")
        return text

    def load_cached(self, job: Job, text: str) -> None:
        self.out[job.id] = json.loads(text) if job.kind == "backlog" else text
        result = Result(job.id, job.label, "kept", 0.0)
        self.results[job.id] = result
        self.say(f"  {job.label}: unchanged, skipped")

    def call(self, job: Job, spec: Spec, message: str) -> Any:
        remaining = self.budget - self.spent
        if remaining < self.settings.min_call_budget_usd - 1e-9:
            raise OutOfBudget()
        request = Request(document="", catalog=self.catalog, budget_usd=min(self.settings.max_budget_per_call_usd, remaining),
                          mode=spec.mode, label=job.id, system=spec.system, message=message, schema=spec.schema)
        try:
            analysis = self.analyzer.analyze(request)
        except AnalyzerError as error:
            self.spent += error.cost_usd
            self.job_cost += error.cost_usd
            self.state["spent_total_usd"] = self.state.get("spent_total_usd", 0.0) + error.cost_usd
            raise
        self.spent += analysis.cost_usd
        self.job_cost += analysis.cost_usd
        self.state["spent_total_usd"] = self.state.get("spent_total_usd", 0.0) + analysis.cost_usd
        return analysis.data

    def generate(self, job: Job, spec: Spec) -> Tuple[Any, List[str]]:
        """One call, and when the checker finds problems one repair call with the problems listed."""
        value, problems, previous = None, [], None
        for attempt in (1, 2):
            message = spec.message
            if attempt == 2:
                shown = previous if isinstance(previous, str) else json.dumps(previous, ensure_ascii=False)
                message += ("\n\nYour previous answer was rejected by the checker.\n" + block("previous_answer", shown) + "\nProblems:\n"
                            + "\n".join(f"- {problem}" for problem in problems) + "\nAnswer again with the full corrected result. Fix these problems and keep everything else.")
            try:
                raw = self.call(job, spec, message)
            except OutOfBudget:
                if attempt == 1:
                    raise
                self.stopped = True
                return value, problems + ["the repair was not tried: the run budget was used up"]
            value, problems = spec.accept(raw)
            if not problems:
                return value, []
            previous = raw
        return value, problems

    def write_output(self, job: Job, value: Any) -> Tuple[str, str]:
        """Writes the document (or its data) and returns `(path, output sha)`."""
        rel = self.output_path(job)
        if job.kind == "domain":
            base = (self.root / rel).read_text(encoding="utf-8") if (self.root / rel).is_file() else ""
            text = dr.compose_domain(value, base)
        elif job.kind == "integration":
            path = self.root / rel
            base = path.read_text(encoding="utf-8") if path.is_file() else ""
            mine = dr.sections(value)
            text = dr.replace_sections(base, mine) if base else value
            drafts = [self.draft_path(t) for t in self.targets if not t.server and self.server_dir() is not None]
            text = re.sub(r"^- \*\*Starting API drafts.*\n\n", "", text, flags=re.M)  # a run before this one added the same note
            if drafts and "## 3." in text:
                note = ("- **Starting API drafts (written by SYSTEM_SETUP from the plan, domain and PRDs; the server's first contract task turns each into the "
                        "generated contract):** " + ", ".join(f"`{d}`" for d in drafts) + "\n\n")
                text = text.replace("## 3.", note + "## 3.", 1)
        elif job.kind == "backlog":
            text = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
        elif job.kind == "contract":
            text = json.dumps(dr.render_openapi(self.plan.system.name, job.target.module.id, job.target.module.name, value), indent=2, ensure_ascii=False) + "\n"
            write_text(self.root / f"{DATA_REL}/{job.id.replace(':', '.')}.json", json.dumps(value, indent=2, ensure_ascii=False) + "\n")
        else:
            text = value
        if self.protect_edited and job.kind != "backlog" and self.edited(job):
            self.propose(rel, text)
            self.out[job.id] = (self.root / rel).read_text(encoding="utf-8")   # what a later run reads back, so nothing downstream is redone
            return rel, sha(text)
        write_text(self.root / rel, text)
        if job.kind != "backlog":
            self.created.append(rel)
        self.out[job.id] = value if job.kind == "backlog" else text
        return rel, sha(text)

    def step(self, job: Job) -> None:
        missing = [d for d in job.deps if d not in self.out]
        if missing:
            self.record(job, "skipped", problems=[f"needs {', '.join(missing)}, which is not available"])
            self.say(f"  {job.label}: skipped (needs {', '.join(missing)})")
            return
        spec = self.build(job)
        digest = self.input_sha(spec)
        cached = self.cached(job, digest)
        if cached is not None:
            self.load_cached(job, cached)
            return
        self.job_cost = 0.0
        try:
            value, problems = self.generate(job, spec)
        except OutOfBudget:
            self.stopped = True
            self.results[job.id] = Result(job.id, job.label, "pending")
            return
        except AnalyzerError as error:
            self.failures += 1
            self.record(job, "failed", digest, cost=self.job_cost, problems=[str(error)])
            self.say(f"  {job.label}: FAILED (${self.job_cost:.4f}): {str(error)[:200]}")
            if isinstance(error, ClaudeNotFound) or self.failures >= MAX_FAILURES_IN_A_ROW:
                self.stopped = True
                self.notes.append("the run stopped: " + (str(error) if isinstance(error, ClaudeNotFound) else f"{self.failures} calls failed in a row"))
            return
        self.failures = 0
        if value is None or (problems and job.kind in ("backlog", "contract")):
            self.record(job, "invalid", digest, cost=self.job_cost, problems=problems)
            self.say(f"  {job.label}: INVALID after one repair, not written ({self.cost_line(self.job_cost)}): {'; '.join(problems[:3])}")
            return
        rel, output = self.write_output(job, value)
        status = "invalid" if problems else "done"
        self.record(job, status, digest, output, rel, self.job_cost, problems)
        flag = f" CHECK FAILED after one repair, kept and marked: {'; '.join(problems[:3])}" if problems else ""
        self.say(f"  {job.label}: {self.cost_line(self.job_cost)} -> {rel}{flag}")

    def cost_line(self, cost: float) -> str:
        return f"${cost:.4f}, run total ${self.spent:.4f} of ${self.budget:.2f}"

    # ---------- the business facts in the CLAUDE.md files ----------
    def write_facts(self) -> None:
        budgets = (self.registry.get("context_budgets") or {}).get("per_project", {}).get("CLAUDE.md", 3200)
        root_budget = (self.registry.get("context_budgets") or {}).get("root", {}).get("CLAUDE.md", 750)
        root_file = self.root / "CLAUDE.md"
        if root_file.is_file():
            text = root_file.read_text(encoding="utf-8")
            new = dr.put_facts(text, dr.root_facts(self.plan, self.plan.system.name), True)
            if new != text and len(new) // 4 <= root_budget:
                root_file.write_text(new, encoding="utf-8")
                self.created.append("CLAUDE.md")
            elif new != text:
                self.notes.append("CLAUDE.md: the business facts would pass its context budget; not added")
        for key, entry in self.registry.get("projects", {}).items():
            target = next((t for t in self.targets if t.project == key), None)
            sdk = self.plan.sdk(key) if target is None else None
            if target is None and sdk is None:
                continue
            files = []
            if target is not None:
                files = [target.path(k) for k in ("brd", "prd", "design") if (self.root / target.path(k)).is_file()] + [entry["backlog"]]
                if not target.server and self.server_dir() and (self.root / self.draft_path(target)).is_file():
                    files.append(self.draft_path(target))
            path = self.root / entry["dir"] / "CLAUDE.md"
            if not path.is_file():
                continue
            text = path.read_text(encoding="utf-8")
            for compact_block in (False, True):  # the full block, else a one-line block when the file is near its context budget
                new = dr.put_facts(text, dr.project_facts(self.plan, target.module if target else None, sdk, files, compact_block), False)
                if len(new) // 4 <= budgets:
                    break
            if new != text and len(new) // 4 <= budgets:
                path.write_text(new, encoding="utf-8")
                self.created.append(f"{entry['dir']}/CLAUDE.md")
            elif new != text:
                self.notes.append(f"{entry['dir']}/CLAUDE.md: the business facts would pass its context budget; not added")

    # ---------- the run ----------
    def run(self, resume_hint: str = "") -> Outcome:
        jobs = self.jobs()
        count = sum(1 for j in jobs if j.kind != "render")
        self.say(f"\nDocuments: up to {count} model call(s) (plus repairs), model {self.settings.model}, at most ${self.settings.max_budget_per_call_usd:.2f} per call "
                 f"and ${self.budget:.2f} in all. If this stops, continue with: {resume_hint or 'SYSTEM_SETUP documents --target <folder>'}")
        for job in jobs:
            if job.kind == "render":
                self.render()
                continue
            self.step(job)
            if self.stopped:
                break
        if not self.laid_out:
            self.render()
        self.write_facts()
        self.save_state()
        for t in self.targets:
            if not t.project:
                self.notes.append(f"module {t.module.id} ({t.module.kind}): the engine generates no project for it yet, so its documents are in {t.docs_dir}/ and it has no backlog")
        ordered = [self.results[j.id] for j in jobs if j.id in self.results]
        outcome = Outcome(ordered, self.spent, self.budget, self.stopped, sorted(set(self.created)), self.notes, resume_hint)
        self.summarize(outcome, jobs)
        return outcome

    def summarize(self, outcome: Outcome, jobs: List[Job]) -> None:
        for job in jobs:
            if job.kind != "render" and job.id not in self.results:
                outcome.results.append(Result(job.id, job.label, "pending"))
        counts = {s: sum(1 for r in outcome.results if r.status == s) for s in ("done", "kept", "invalid", "failed", "skipped", "pending")}
        self.say(f"\nDocuments: {counts['done']} written, {counts['kept']} unchanged, {counts['invalid']} marked, {counts['failed']} failed, "
                 f"{counts['skipped']} skipped, {counts['pending']} not run. Cost this run ${self.spent:.4f} of ${self.budget:.2f} "
                 f"(all runs ${self.state.get('spent_total_usd', 0.0):.4f}).")
        if outcome.stopped and counts["pending"]:
            self.say(f"Stopped before the budget of ${self.budget:.2f} was exceeded. Resume: {outcome.resume or 'SYSTEM_SETUP documents --target <folder>'}")
        for result in outcome.unfinished:
            if result.status in ("invalid", "failed", "skipped"):
                self.say(f"  {result.label}: {result.status}: {'; '.join(result.problems[:3])}")
        for note in outcome.notes:
            self.say(f"  note: {note}")


def run_documents(root: Path, plan: Plan, document: str, catalog: Catalog, analyzer: Analyzer, settings: DocumentSettings,
                  say: Callable[[str], None] = print, budget_usd: Optional[float] = None, resume_hint: str = "",
                  prompts: Optional[Prompts] = None, protect_edited: bool = False) -> Outcome:
    return Pipeline(root, plan, document, catalog, analyzer, settings, prompts, say, budget_usd, protect_edited).run(resume_hint)
