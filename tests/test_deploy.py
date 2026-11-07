"""Phase 6: deployment from the plan. A host per part from the data-driven overlays, only the chosen host's config and guide, parts a host
cannot run are refused, an unknown host falls to custom, a database or cache the server template does not use warns and becomes a PENDING
task, generic documents name no host, and every config is parsed (YAML with a small structural reader, TOML with `tomllib` when there is
one, JSON). No real deploy happens here: there is no account with any host."""
from __future__ import annotations

import copy
import io
import json
import re
import shutil
from contextlib import redirect_stdout
from pathlib import Path
from typing import Any, Dict, List

from _support import TOOL_ROOT, TempDirTest, make_spec, valid_plan_data

from catalog import CatalogError, load_catalog
from cli import main
from deploy import CUSTOM, GUIDE_REL, INDEX_REL, DeployError, overlay_files, plan_deployment, write_deployment
from manifest import templates_root
from plan import Plan, PlanError

try:
    import tomllib
except ImportError:   # Python before 3.11: a structural reader is enough for these small files
    tomllib = None

CATALOG = load_catalog()
OVERLAYS = templates_root() / "deploy"
ENV_KEYS = ["NODE_ENV", "MONGODB_URI", "REDIS_URL", "JWT_ACCESS_SECRET"]
HOST_WORDS = re.compile(r"cloudflare|netlify|vercel|fly\.io|railway|heroku|\baws\b|render\.com|on render|docker on a server", re.I)
CONFIG_NAMES = {"render.yaml", "fly.toml", "railway.json", "wrangler.toml", "vercel.json", "netlify.toml", "ecs-task-definition.json",
                "docker-compose.deploy.yml", "Dockerfile", "nginx.conf.template"}


# ---------- small readers: the standard library only ----------

def parse_yaml(text: str) -> Any:
    """Block YAML as the generated files use it: nested mappings, lists of mappings and of scalars, comments, quoted scalars."""
    assert "\t" not in text, "tab in YAML"
    lines = [[len(line) - len(line.lstrip(" ")), line.strip()] for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    for indent, _ in lines:
        assert indent % 2 == 0, "odd indentation"
    position = 0
    key_line = re.compile(r"^([A-Za-z_$][\w.$-]*):(?:\s+(.*))?$")

    def scalar(raw: str) -> Any:
        raw = raw.strip()
        if raw[:1] in "'\"":
            assert raw[-1] == raw[0], f"unclosed quote in {raw}"
            return raw[1:-1]
        return {"true": True, "false": False}.get(raw, raw)

    def block(indent: int) -> Any:
        return sequence(indent) if lines[position][1].startswith("- ") else mapping(indent)

    def sequence(indent: int) -> List[Any]:
        nonlocal position
        items = []
        while position < len(lines) and lines[position][0] == indent and lines[position][1].startswith("- "):
            body = lines[position][1][2:]
            if key_line.match(body):
                lines[position] = [indent + 2, body]   # `- key: value` opens a mapping two columns further in
                items.append(mapping(indent + 2))
            else:
                items.append(scalar(body))
                position += 1
        return items

    def mapping(indent: int) -> Dict[str, Any]:
        nonlocal position
        out: Dict[str, Any] = {}
        while position < len(lines) and lines[position][0] == indent and not lines[position][1].startswith("- "):
            found = key_line.match(lines[position][1])
            assert found, f"not a mapping line: {lines[position][1]!r}"
            key, rest = found.group(1), found.group(2)
            position += 1
            if rest:
                out[key] = scalar(rest)
            elif position < len(lines) and lines[position][0] > indent:
                out[key] = block(lines[position][0])
            elif position < len(lines) and lines[position][0] == indent and lines[position][1].startswith("- "):
                out[key] = sequence(indent)
            else:
                out[key] = None
        return out

    return block(lines[0][0])


def parse_toml(text: str) -> Dict[str, Any]:
    if tomllib is not None:
        return tomllib.loads(text)
    data: Dict[str, Any] = {}
    current = data
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        table = re.match(r"^(\[\[?)([\w.-]+)\]\]?$", line)
        if table:
            current = data
            parts = table.group(2).split(".")
            for index, part in enumerate(parts):
                last = index == len(parts) - 1
                if last and table.group(1) == "[[":
                    current = current.setdefault(part, []) if isinstance(current.get(part, []), list) else current[part]
                    current.append({})
                    current = current[-1]
                else:
                    child = current.setdefault(part, {})
                    current = child[-1] if isinstance(child, list) else child
            continue
        pair = re.match(r'^([\w.-]+)\s*=\s*(.+)$', line)
        assert pair, f"not TOML: {line!r}"
        value = pair.group(2).strip()
        if value.startswith('"'):
            assert value.endswith('"') and len(value) > 1, f"unclosed string: {value}"
            current[pair.group(1)] = value[1:-1]
        elif re.fullmatch(r"-?\d+", value):
            current[pair.group(1)] = int(value)
        elif value in ("true", "false"):
            current[pair.group(1)] = value == "true"
        else:
            assert value.startswith("["), f"unknown TOML value {value!r}"
            current[pair.group(1)] = value
    return data


def read_config(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".json":
        return json.loads(text)
    if path.suffix in (".yaml", ".yml"):
        return parse_yaml(text)
    if path.suffix == ".toml":
        return parse_toml(text)
    return text


# ---------- a small system on disk: the parts, their env file and backlogs ----------

BACKLOG = "| ID | Task | Branch | Needs | Status | Notes |\n|---|---|---|---|---|---|\n| {p}-001 | Starter | `feat/{l}-001-starter` | - | PENDING | x |\n"


def plan_data(server_host="render", admin_host="vercel", database="mongodb", cache="redis", web_host="") -> dict:
    data = valid_plan_data()
    data["modules"] = [m for m in data["modules"] if m["kind"] != "app"]
    data["sdks"] = []
    data["deployment"] = [{"part": "server", "host": server_host, "database": database, "cache": cache},
                          {"part": "admin", "host": admin_host}]
    if web_host:
        data["modules"].append({"id": "portal", "kind": "web", "name": "Portal", "audience": "parents", "why": "pay", "platforms": ["web"]})
        data["deployment"].append({"part": "portal", "host": web_host})
    return data


class SystemTest(TempDirTest):
    def system(self, data: dict, web: bool = False):
        """(spec, registry) for `data`, with the parts, the server env file and the backlogs written under self.root."""
        plan = Plan.from_dict(data, CATALOG)
        from planspec import plan_to_spec
        spec = plan_to_spec(plan, self.root / "system", CATALOG).spec
        if web:   # the web template's wiring gives the Spec a `web_dir`; the deployment is planned again with it
            spec.web_dir = lambda module_id: f"{module_id}-web"
            spec.deployment = plan_deployment(plan, CATALOG, spec)
        for rel in (spec.server_dir, spec.admin_dir, "portal-web"):
            (spec.target / rel).mkdir(parents=True, exist_ok=True)
        env = spec.target / spec.server_dir / "docker" / "env.prod.example"
        env.parent.mkdir(parents=True, exist_ok=True)
        env.write_text("# comment\n" + "".join(f"{key}=\n" for key in ENV_KEYS), encoding="utf-8")
        registry = {"projects": {}}
        for key, folder, prefix in (("server", spec.server_dir, "SRV"), ("admin", spec.admin_dir, "ADM"), ("portal", "portal-web", "POR")):
            backlog = f"{folder}/docs/Tasks.md"
            (spec.target / backlog).parent.mkdir(parents=True, exist_ok=True)
            (spec.target / backlog).write_text(BACKLOG.format(p=prefix, l=prefix.lower()), encoding="utf-8")
            registry["projects"][key] = {"backlog": backlog, "prefix": prefix}
        return spec, registry

    def deploy(self, data: dict, web: bool = False):
        spec, registry = self.system(data, web)
        return spec, registry, write_deployment(spec, templates_root(), registry)


def files_of(folder: Path):
    return sorted(str(p.relative_to(folder)) for p in folder.rglob("*") if p.is_file())


class CatalogTest(TempDirTest):
    def test_every_host_names_an_overlay_that_has_files_for_each_part_it_hosts(self):
        for host in CATALOG.hosts:
            self.assertTrue(host.deploy, host.id)
            for kind in host.parts:
                self.assertTrue(overlay_files(OVERLAYS, host.deploy, kind), f"{host.id}/{kind}")

    def test_the_hosts_are_the_roadmap_ones_and_static_hosts_do_not_take_a_server(self):
        self.assertEqual({"render", "docker-server", "aws", "fly", "railway", "cloudflare", "vercel", "netlify", "custom"}, {h.id for h in CATALOG.hosts})
        self.assertEqual({"admin", "web"}, set(CATALOG.find_host("vercel").parts) & {"admin", "web", "server"})
        self.assertNotIn("server", CATALOG.find_host("cloudflare").parts)

    def test_the_catalog_says_which_databases_and_caches_the_template_supports(self):
        supported = lambda choices: {c.id for c in choices if c.supported}   # noqa: E731
        self.assertEqual({"mongodb", "none"}, supported(CATALOG.databases))
        self.assertEqual({"redis", "none"}, supported(CATALOG.caches))
        self.assertEqual("mongodb", CATALOG.databases[0].id)   # the default the review proposes is one the template runs on

    def test_adding_a_host_is_a_folder_and_a_catalog_line_with_no_code(self):
        catalog_copy = self.root / "catalog"
        shutil.copytree(TOOL_ROOT / "catalog", catalog_copy)
        path = catalog_copy / "deploy.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["hosts"].append({"id": "my-host", "title": "My Host", "parts": ["server"], "deploy": "my-host"})
        path.write_text(json.dumps(data), encoding="utf-8")
        catalog = load_catalog(catalog_copy)
        templates = self.root / "templates"
        shutil.copytree(OVERLAYS, templates / "deploy")
        (templates / "deploy" / "my-host" / "server").mkdir(parents=True)
        (templates / "deploy" / "my-host" / "server" / "my-host.json").write_text('{"service": "__SERVICE_NAME__", "keys": "__ENV_KEYS__"}', encoding="utf-8")
        plan = Plan.from_dict(plan_data("my-host"), catalog)
        from planspec import plan_to_spec
        spec = plan_to_spec(plan, self.root / "system", catalog).spec
        (spec.target / spec.server_dir).mkdir(parents=True)
        (spec.target / spec.admin_dir).mkdir(parents=True)
        (spec.target / "docs").mkdir(exist_ok=True)
        written = write_deployment(spec, templates, {"projects": {}})
        self.assertIn(f"{spec.server_dir}/my-host.json", written.files)
        self.assertEqual("acme-shop-server", json.loads((spec.target / spec.server_dir / "my-host.json").read_text(encoding="utf-8"))["service"])

    def test_a_bad_parts_entry_is_refused(self):
        catalog_copy = self.root / "catalog"
        shutil.copytree(TOOL_ROOT / "catalog", catalog_copy)
        path = catalog_copy / "deploy.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        data["parts"] = ["server"]
        path.write_text(json.dumps(data), encoding="utf-8")
        with self.assertRaisesRegex(CatalogError, "parts"):
            load_catalog(catalog_copy)


class HostPerPartTest(SystemTest):
    def test_every_host_writes_its_config_and_guide_for_every_part_it_hosts_and_the_config_parses(self):
        for host in CATALOG.hosts:
            for kind in host.parts:
                part = {"server": "server", "admin": "admin", "web": "portal"}[kind]
                with self.subTest(host=host.id, part=kind):
                    data = plan_data(host.id if kind == "server" else "docker-server", host.id if kind == "admin" else "docker-server",
                                     web_host=host.id if kind == "web" else "")
                    shutil.rmtree(self.root / "system", ignore_errors=True)
                    spec, registry, written = self.deploy(data, web=True)
                    folder = spec.target / {"server": spec.server_dir, "admin": spec.admin_dir, "web": "portal-web"}[kind]
                    wanted = overlay_files(OVERLAYS, host.deploy, kind)
                    self.assertTrue(set(map(str, wanted)) <= set(files_of(folder)), (host.id, kind, files_of(folder)))
                    self.assertIn(GUIDE_REL, files_of(folder))
                    for rel in files_of(folder):
                        if rel.endswith((".json", ".toml", ".yaml", ".yml")) and rel != "docker/env.prod.example":
                            read_config(folder / rel)   # parses
                    self.assertIn(part, (spec.target / INDEX_REL).read_text(encoding="utf-8"))

    def test_only_the_chosen_hosts_files_are_written(self):
        owners = {name: {h.id for h in CATALOG.hosts for kind in h.parts if name in map(lambda p: p.name, overlay_files(OVERLAYS, h.deploy, kind))}
                  for name in CONFIG_NAMES}
        for host in ("render", "fly", "aws", "railway", "docker-server"):
            with self.subTest(host=host):
                shutil.rmtree(self.root / "system", ignore_errors=True)
                spec, _, _ = self.deploy(plan_data(host, "vercel"))
                names = {Path(f).name for d in (spec.server_dir, spec.admin_dir) for f in files_of(spec.target / d)}
                for name in CONFIG_NAMES & names:
                    self.assertTrue(owners[name] & {host, "vercel"}, f"{name} is written for {host} but belongs to {owners[name]}")
                for foreign in {"fly.toml", "render.yaml", "railway.json", "wrangler.toml", "netlify.toml", "ecs-task-definition.json"} - {
                        n for n in CONFIG_NAMES if owners[n] & {host, "vercel"}}:
                    self.assertNotIn(foreign, names)
                self.assertIn("vercel.json", names)

    def test_the_configs_have_the_fields_their_host_needs_and_only_key_names(self):
        spec, _, _ = self.deploy(plan_data("render", "render"))
        server = read_config(spec.target / spec.server_dir / "render.yaml")["services"][0]
        self.assertEqual(("web", "node", spec.server_dir, "/health", "node dist/server.js"),
                         (server["type"], server["runtime"], server["rootDir"], server["healthCheckPath"], server["startCommand"]))
        self.assertEqual("acme-shop-server", server["name"])
        self.assertEqual(ENV_KEYS, [e["key"] for e in server["envVars"]])
        self.assertTrue(all(e == {"key": e["key"], "sync": False} for e in server["envVars"]))   # a key, never a value
        site = read_config(spec.target / spec.admin_dir / "render.yaml")["services"][0]
        self.assertEqual(("static", "dist/prod-release", "rewrite", "/index.html"),
                         (site["runtime"], site["staticPublishPath"], site["routes"][0]["type"], site["routes"][0]["destination"]))

    def test_aws_fly_railway_cloudflare_vercel_netlify_and_docker_configs(self):
        for server, admin in (("aws", "cloudflare"), ("fly", "vercel"), ("railway", "netlify"), ("docker-server", "fly")):
            shutil.rmtree(self.root / "system", ignore_errors=True)
            spec, _, _ = self.deploy(plan_data(server, admin))
            s, a = spec.target / spec.server_dir, spec.target / spec.admin_dir
            if server == "aws":
                task = read_config(s / "ecs-task-definition.json")
                container = task["containerDefinitions"][0]
                self.assertEqual((["FARGATE"], "awsvpc", 3000), (task["requiresCompatibilities"], task["networkMode"], container["portMappings"][0]["containerPort"]))
                self.assertEqual(ENV_KEYS, [secret["name"] for secret in container["secrets"]])
                self.assertTrue(all(set(secret) == {"name", "valueFrom"} for secret in container["secrets"]))   # a reference, never a value
                self.assertIn("/health", container["healthCheck"]["command"][1])
                self.assertEqual(["awslogs"], [container["logConfiguration"]["logDriver"]])
                self.assertIn("App Runner", (s / GUIDE_REL).read_text(encoding="utf-8"))
                site = read_config(a / "wrangler.toml")
                self.assertEqual(("acme-shop-admin", "dist/prod-release"), (site["name"], site["pages_build_output_dir"]))
            if server == "fly":
                fly = read_config(s / "fly.toml")
                self.assertEqual(("acme-shop-server", 3000, True, "/health"),
                                 (fly["app"], fly["http_service"]["internal_port"], fly["http_service"]["force_https"], fly["http_service"]["checks"][0]["path"]))
                vercel = read_config(a / "vercel.json")
                self.assertEqual(("dist/prod-release", "npm ci"), (vercel["outputDirectory"], vercel["installCommand"]))
                self.assertIn("/index.html", vercel["rewrites"][0]["destination"])
                self.assertIn("npm run build:prod-release", vercel["buildCommand"])
            if server == "railway":
                railway = read_config(s / "railway.json")
                self.assertEqual(("DOCKERFILE", "/health"), (railway["build"]["builder"], railway["deploy"]["healthcheckPath"]))
                netlify = read_config(a / "netlify.toml")
                self.assertEqual(("dist/prod-release", "dist/dev-release"), (netlify["build"]["publish"], netlify["context"]["deploy-preview"]["publish"]))
            if server == "docker-server":
                self.assertFalse(any(f.endswith((".toml", ".yaml", ".json")) and f != "docker/env.prod.example" for f in files_of(s)))   # the template's own files are used
                self.assertIn("docker-compose.deploy.yml", (s / GUIDE_REL).read_text(encoding="utf-8"))
                fly = read_config(a / "fly.toml")
                self.assertEqual(8080, fly["http_service"]["internal_port"])
                self.assertIn("nginx", (a / "Dockerfile").read_text(encoding="utf-8"))
                self.assertIn("ARG VITE_API_BASE_URL", (a / "Dockerfile").read_text(encoding="utf-8"))

    def test_the_docker_host_writes_a_compose_file_for_a_static_part(self):
        spec, _, _ = self.deploy(plan_data("docker-server", "docker-server"))
        compose = read_config(spec.target / spec.admin_dir / "docker-compose.deploy.yml")
        site = compose["services"]["site"]
        self.assertEqual(("acme-shop-admin", "."), (compose["name"], site["build"]["context"]))
        self.assertEqual(["VITE_API_BASE_URL", "VITE_SOCKET_URL", "CSP_CONNECT_EXTRA"], site["build"]["args"])
        self.assertTrue(site["ports"][0].endswith(":8080:8080'") or site["ports"][0].endswith(":8080"))
        self.assertTrue((spec.target / spec.admin_dir / ".dockerignore").is_file())

    def test_a_web_module_is_deployed_into_its_own_folder_and_waits_when_it_is_not_generated(self):
        spec, registry, written = self.deploy(plan_data("render", "vercel", web_host="cloudflare"), web=True)
        self.assertEqual("acme-shop-portal", read_config(spec.target / "portal-web" / "wrangler.toml")["name"])
        self.assertEqual("dist", read_config(spec.target / "portal-web" / "wrangler.toml")["pages_build_output_dir"])
        shutil.rmtree(self.root / "system")
        spec, registry = self.system(plan_data("render", "vercel", web_host="cloudflare"), web=False)
        self.assertTrue(any("deployment of 'portal'" in line and "when that web part is generated" in line for line in spec.deployment.deferred))
        written = write_deployment(spec, templates_root(), registry)
        self.assertNotIn("portal-web/wrangler.toml", written.files)
        self.assertIn("not generated yet", (spec.target / INDEX_REL).read_text(encoding="utf-8"))

    def test_the_flat_command_has_no_deployment_and_writes_nothing(self):
        spec, registry = self.system(plan_data())
        spec.deployment = None
        self.assertEqual([], write_deployment(spec, templates_root(), registry).files)
        self.assertFalse((spec.target / INDEX_REL).exists())

    def test_templates_without_overlays_write_nothing_and_say_so(self):
        spec, registry = self.system(plan_data())
        written = write_deployment(spec, self.root / "empty-templates", registry)
        self.assertEqual([], written.files)
        self.assertTrue(any("no 'deploy' folder" in w for w in written.warnings))

    def test_no_part_deployment_when_the_plan_has_none(self):
        data = plan_data()
        data["deployment"] = []
        spec, registry, written = self.deploy(data)
        self.assertEqual([], written.files)
        self.assertFalse((spec.target / INDEX_REL).exists())


class RefusalTest(SystemTest):
    def test_a_host_that_cannot_run_a_part_is_refused_with_the_hosts_that_can(self):
        for host, part in (("cloudflare", "server"), ("vercel", "server"), ("netlify", "server")):
            data = plan_data()
            data["deployment"][0]["host"] = host
            with self.assertRaises(PlanError) as caught:
                Plan.from_dict(data, CATALOG)
            message = str(caught.exception)
            self.assertIn(f"does not host a {part} part", message)
            self.assertIn("render", message)
            self.assertNotIn("cloudflare, ", message.split("choose one of:")[1])

    def test_the_deploy_step_refuses_too_when_a_plan_was_built_around_the_check(self):
        spec, _ = self.system(plan_data())
        plan = Plan.from_dict(plan_data(), CATALOG)
        plan.deployment[0].host = "cloudflare"
        with self.assertRaisesRegex(DeployError, "does not host that"):
            plan_deployment(plan, CATALOG, spec)

    def test_the_command_ends_with_the_message_and_a_non_zero_code(self):
        path = self.write("plan.json", json.dumps(dict(plan_data(), deployment=[{"part": "server", "host": "vercel"}])))
        out = io.StringIO()
        with redirect_stdout(out):
            code = main(["new", "--plan", str(path), "--no-documents", "--yes", "--target", str(self.root / "x"), "--no-git"])
        self.assertEqual(2, code)
        self.assertIn("does not host a server part", out.getvalue())
        self.assertFalse((self.root / "x").exists())


class FallbackTest(SystemTest):
    def test_an_unknown_host_is_deployed_as_custom_with_a_warning_and_a_pending_row(self):
        spec, registry, written = self.deploy(plan_data("render", "my-own-box"))
        admin = spec.target / spec.admin_dir
        self.assertTrue({"Dockerfile", "nginx.conf.template", GUIDE_REL} <= set(files_of(admin)))
        self.assertTrue(any("'my-own-box'" in w and "not in the catalog" in w for w in written.warnings))
        backlog = (spec.target / registry["projects"]["admin"]["backlog"]).read_text(encoding="utf-8")
        self.assertRegex(backlog, r"\| ADM-002 \| Choose and set up the host for admin \|.*\| PENDING \|")
        self.assertIn("my-own-box (not in the catalog: custom)", (spec.target / INDEX_REL).read_text(encoding="utf-8"))
        self.assertEqual(["ADM-002"], written.rows)

    def test_the_custom_host_is_docker_plus_a_guide_and_a_pending_row(self):
        spec, registry, written = self.deploy(plan_data("custom", "custom"))
        self.assertIn(GUIDE_REL, files_of(spec.target / spec.server_dir))
        self.assertEqual({"docs/HOSTING.md", "docker/env.prod.example"}, set(files_of(spec.target / spec.server_dir)) - {"docs/Tasks.md"})
        self.assertEqual(["SRV-002", "ADM-002"], written.rows)
        self.assertIn("not chosen yet (custom)", (spec.target / spec.server_dir / GUIDE_REL).read_text(encoding="utf-8"))

    def test_a_catalog_host_whose_overlay_folder_is_missing_falls_to_custom_and_says_so(self):
        templates = self.root / "templates"
        shutil.copytree(OVERLAYS, templates / "deploy")
        shutil.rmtree(templates / "deploy" / "fly")
        spec, registry = self.system(plan_data("fly", "vercel"))
        written = write_deployment(spec, templates, registry)
        self.assertTrue(any("'fly' not found" in w or "overlay 'fly' not found" in w for w in written.warnings), written.warnings)
        self.assertIn(GUIDE_REL, files_of(spec.target / spec.server_dir))
        self.assertNotIn("fly.toml", files_of(spec.target / spec.server_dir))
        self.assertIn("SRV-002", written.rows)


class OverlayTest(TempDirTest):
    def make(self, files: Dict[str, str]) -> Path:
        for rel, text in files.items():
            path = self.root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        return self.root

    def test_extends_aliases_and_the_own_folder_wins(self):
        root = self.make({"base/overlay.json": '{"kinds": {"web": "admin"}}', "base/admin/a.txt": "base", "base/admin/b.txt": "base",
                          "top/overlay.json": '{"extends": ["base"], "kinds": {"web": "admin"}}', "top/admin/b.txt": "top"})
        files = overlay_files(root, "top", "web")
        self.assertEqual({"a.txt", "b.txt"}, {str(k) for k in files})
        self.assertEqual("top", files[next(k for k in files if str(k) == "b.txt")].read_text(encoding="utf-8"))
        self.assertEqual({}, overlay_files(root, "top", "server"))

    def test_a_circle_and_a_missing_overlay_are_errors(self):
        root = self.make({"a/overlay.json": '{"extends": ["b"]}', "b/overlay.json": '{"extends": ["a"]}'})
        with self.assertRaisesRegex(DeployError, "circle"):
            overlay_files(root, "a", "server")
        with self.assertRaisesRegex(DeployError, "not found"):
            overlay_files(root, "nothing", "server")

    def test_an_overlay_cannot_overwrite_a_file_and_cannot_leave_a_token_unfilled(self):
        sys_test = SystemTest()
        sys_test.setUp()
        try:
            for name, text, message in (("clash", "x", "would overwrite"), ("open", "__NOT_A_TOKEN_ANYONE_FILLS__", "still has")):
                templates = self.root / name
                (templates / "deploy" / "render" / "server").mkdir(parents=True)
                (templates / "deploy" / "render" / "server" / ("package.json" if name == "clash" else "x.txt")).write_text(text, encoding="utf-8")
                shutil.copytree(OVERLAYS / "custom", templates / "deploy" / "custom")
                shutil.rmtree(sys_test.root / "system", ignore_errors=True)
                spec, registry = sys_test.system(plan_data("render", "custom"))
                (spec.target / spec.server_dir / "package.json").write_text("{}", encoding="utf-8")
                with self.assertRaisesRegex(DeployError, message):
                    write_deployment(spec, templates, registry)
        finally:
            sys_test.tearDown()


class WarningTest(SystemTest):
    def test_another_database_or_cache_warns_and_adds_a_pending_row_per_choice(self):
        spec, registry, written = self.deploy(plan_data("render", "vercel", database="postgres", cache="memcached"))
        text = "\n".join(written.warnings)
        self.assertIn("database 'postgres' of 'server'", text)
        self.assertIn("cache 'memcached' of 'server'", text)
        self.assertIn("MongoDB", text)
        self.assertIn("Nothing switches automatically", text)
        backlog = (spec.target / registry["projects"]["server"]["backlog"]).read_text(encoding="utf-8")
        self.assertRegex(backlog, r"\| SRV-002 \| Server data layer: replace MongoDB with postgres \|.*\| PENDING \|")
        self.assertRegex(backlog, r"\| SRV-003 \| Server data layer: replace Redis with memcached \|.*\| PENDING \|")
        self.assertEqual(["SRV-002", "SRV-003"], written.rows)
        index = (spec.target / INDEX_REL).read_text(encoding="utf-8")
        self.assertIn("## Open points", index)
        self.assertIn("postgres", index)

    def test_the_supported_choices_and_nothing_chosen_do_not_warn(self):
        for database, cache in (("mongodb", "redis"), ("MongoDB", "Redis"), ("none", "none")):
            shutil.rmtree(self.root / "system", ignore_errors=True)
            spec, registry, written = self.deploy(plan_data(database=database, cache=cache))
            self.assertEqual([], written.warnings, (database, cache))
            self.assertEqual([], written.rows)

    def test_an_unknown_database_is_not_a_supported_one(self):
        _, _, written = self.deploy(plan_data(database="cockroach"))
        self.assertTrue(any("database 'cockroach'" in w for w in written.warnings))


# ---------- the whole command, with the real templates ----------

class EndToEnd(TempDirTest):
    def generate(self, name: str, data: dict, *extra: str):
        plan = self.write(f"{name}.json", json.dumps(data))
        target = self.root / name
        out = io.StringIO()
        with redirect_stdout(out):
            code = main(["new", "--plan", str(plan), "--no-documents", "--yes", "--target", str(target), "--no-git", *extra])
        return code, out.getvalue(), target

    def test_aws_and_vercel_generate_with_tasks_check_ok_and_no_later_phase_line(self):
        code, output, target = self.generate("aws", plan_data("aws", "vercel"))
        self.assertEqual(0, code, output[-1500:])
        self.assertIn("tasks.py check: OK", output)
        self.assertNotIn("Warnings (", output)
        self.assertNotIn("deployment of '", output)   # no longer in the "recorded, generated in a later phase" list
        self.assertIn("deployment: 5 file(s) for the chosen host(s)", output)
        self.assertEqual("acme-shop-server", json.loads((target / "ACME-Server" / "ecs-task-definition.json").read_text(encoding="utf-8"))["family"])
        self.assertTrue((target / "ACME-Admin-Dashboard" / "vercel.json").is_file())
        self.assertFalse((target / "ACME-Admin-Dashboard" / "netlify.toml").exists())   # moved out of the generic admin template
        env = (target / "ACME-Server" / "docker" / "env.prod.example").read_text(encoding="utf-8")
        for key in re.findall(r"^([A-Z][A-Z0-9_]*)=", env, re.M):
            self.assertIn(f'"{key}"', (target / "ACME-Server" / "ecs-task-definition.json").read_text(encoding="utf-8"))

    def test_another_database_and_an_unknown_host_warn_add_pending_rows_and_still_pass_the_check(self):
        code, output, target = self.generate("odd", plan_data("render", "my-own-box", database="postgres", cache="redis"))
        self.assertEqual(0, code, output[-1500:])
        self.assertIn("Warnings (2):", output)
        self.assertIn("database 'postgres' of 'server'", output)
        self.assertIn("host 'my-own-box' of 'admin' is not in the catalog", output)
        self.assertIn("tasks.py check: OK", output)
        server = (target / "ACME-Server" / "docs" / "ACME_Server_Tasks.md").read_text(encoding="utf-8")
        self.assertRegex(server, r"Server data layer: replace MongoDB with postgres.*PENDING")
        admin = (target / "ACME-Admin-Dashboard" / "docs" / "ACME_Admin_Tasks.md").read_text(encoding="utf-8")
        self.assertRegex(admin, r"Choose and set up the host for admin.*PENDING")
        self.assertTrue((target / "ACME-Admin-Dashboard" / "Dockerfile").is_file())
        self.assertTrue((target / "ACME-Server" / "render.yaml").is_file())

    def test_generic_documents_name_no_host_and_the_index_names_only_the_chosen_ones(self):
        for generic in (templates_root() / "server" / "docs" / "DEPLOYMENT.md", templates_root() / "admin" / "docs" / "DEPLOY.md"):
            self.assertFalse(HOST_WORDS.search(generic.read_text(encoding="utf-8")), generic)
        self.assertFalse((templates_root() / "admin" / "netlify.toml").exists())
        code, output, target = self.generate("generic", plan_data("fly", "cloudflare"))
        self.assertEqual(0, code, output[-1500:])
        guides = {"ACME-Server/docs/HOSTING.md", "ACME-Admin-Dashboard/docs/HOSTING.md", "docs/DEPLOYMENT.md"}
        for path in sorted(target.rglob("*.md")):
            rel = path.relative_to(target).as_posix()
            if "node_modules" in rel or rel in guides or rel.startswith(".claude/skills") or rel.startswith(".git"):
                continue
            self.assertFalse(HOST_WORDS.search(path.read_text(encoding="utf-8")), rel)
        index = (target / "docs" / "DEPLOYMENT.md").read_text(encoding="utf-8")
        self.assertIn("Fly.io", index)
        self.assertIn("Cloudflare Pages", index)
        for other in ("Vercel", "Netlify", "AWS", "Railway", "Render"):
            self.assertNotIn(other, index)
        self.assertIn("Fly.io", (target / "ACME-Server" / "docs" / "HOSTING.md").read_text(encoding="utf-8"))


class PlanSpecTest(SystemTest):
    def test_deployment_leaves_the_later_phase_list_but_a_part_that_is_not_generated_stays_in_it(self):
        from planspec import plan_to_spec
        data = plan_data("render", "vercel", web_host="cloudflare")
        conversion = plan_to_spec(Plan.from_dict(data, CATALOG), self.root / "x", CATALOG)
        text = "\n".join(conversion.deferred)
        self.assertNotIn("deployment of 'server'", text)
        self.assertNotIn("deployment of 'admin'", text)
        self.assertIn("deployment of 'portal': host cloudflare", text)
        self.assertEqual(["server", "admin", "portal"], [p.id for p in conversion.spec.deployment.parts])
        self.assertEqual(["render", "vercel", "cloudflare"], [p.overlay for p in conversion.spec.deployment.parts])
