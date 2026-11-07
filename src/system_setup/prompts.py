"""Questions, validators and the answered Spec (every value the templates can ask for)."""
from __future__ import annotations

import datetime as _dt
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlsplit

from business import Business, token_values as business_token_values

SDK_CATALOG = ("storage", "otp", "notifications", "payments", "analytics")
SDK_DESCRIPTIONS = {
    "storage": "presigned uploads, CDN / signed URLs (S3 + local adapters)",
    "otp": "one-time codes over WhatsApp / SMS / fake provider",
    "notifications": "FCM push + SMTP email",
    "payments": "gateway port + adapters (Node + KMP)",
    "analytics": "server events + Firebase / BigQuery ports",
}
APP_PREFIX_LENGTH = 3
SYSTEM_PREFIX_LENGTH = 4  # default folder/task prefix of the system: 'Acme Shop' -> ACME, 'Zed' -> ZED
FIXED_PREFIXES = {"server": "SRV", "admin": "ADM"}
MAIN_BRANCH = "main"
API_VERSION_SEGMENT = "v1"
URL_TOKENS = ("__DEV_API_URL__", "__PROD_API_URL__", "__DEV_WEB_URL__", "__PROD_WEB_URL__")

PACKAGE_RE = re.compile(r"^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$")
SLUG_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
PREFIX_RE = re.compile(r"^[A-Z][A-Z0-9]{1,5}$")
NPM_SCOPE_RE = re.compile(r"^@[a-z0-9][a-z0-9._-]*$")
TEAM_ID_RE = re.compile(r"^[A-Z0-9]{10}$")
GITHUB_NAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$")
KOTLIN_KEYWORDS = {
    "as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface", "is", "null",
    "object", "package", "return", "super", "this", "throw", "true", "try", "typealias", "typeof", "val", "var", "when",
    "while", "native", "int", "float", "double", "long", "short", "byte", "char", "boolean", "void",
}

Check = Callable[[str], Optional[str]]
Reader = Callable[[str], str]


def ask(question: str, default: str = "", check: Optional[Check] = None, reader: Reader = input) -> str:
    """Asks until the answer passes `check`. Enter keeps the default. `reader` is the seam used by the tests."""
    while True:
        suffix = f" [{default}]" if default else ""
        answer = reader(f"{question}{suffix}: ").strip() or default
        error = check(answer) if check else None
        if not error:
            return answer
        print(f"  ✗ {error}")


# ---------- validators (return an error message, or None) ----------

def validate_required(value: str) -> Optional[str]:
    return None if value.strip() else "required"


def validate_slug(value: str) -> Optional[str]:
    if not SLUG_RE.match(value):
        return "use lowercase letters, digits and single hyphens, starting with a letter (e.g. acme-shop)"
    return None


def validate_prefix(value: str) -> Optional[str]:
    if not PREFIX_RE.match(value):
        return "use 2 to 6 uppercase letters/digits starting with a letter (e.g. ACME)"
    return None


def validate_package(value: str) -> Optional[str]:
    if not PACKAGE_RE.match(value):
        return "use lowercase segments of letters/digits separated by dots, at least two (e.g. com.acme)"
    if any(part in KOTLIN_KEYWORDS for part in value.split(".")):
        return "a segment is a Kotlin keyword"
    return None


def validate_npm_scope(value: str) -> Optional[str]:
    return None if NPM_SCOPE_RE.match(value) else "use an npm scope like @acme"


def validate_url(value: str) -> Optional[str]:
    parts = urlsplit(value)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return "use a full http(s) URL (e.g. https://api.acme.io)"
    if parts.path or parts.query or parts.fragment:
        return "scheme and host only, no path, query, fragment or trailing slash (the apps derive the bare host from it)"
    return None


def validate_team_id(value: str) -> Optional[str]:
    if not value:
        return None
    return None if TEAM_ID_RE.match(value) else "an Apple Team ID is 10 uppercase letters/digits (or leave empty)"


def validate_github_name(value: str) -> Optional[str]:
    return None if GITHUB_NAME_RE.match(value) else "use letters, digits, '.', '-' or '_' (e.g. acme-inc)"


def validate_sdk_names(value: str) -> Optional[str]:
    unknown = [name for name in split_list(value) if name not in SDK_CATALOG]
    if unknown:
        return f"unknown SDK(s) {', '.join(unknown)}; catalog: {', '.join(SDK_CATALOG)}"
    return None


def validate_app_specs(value: str) -> Optional[str]:
    try:
        apps = parse_apps(value)
    except ValueError as error:
        return str(error)
    slugs = [app.slug for app in apps]
    if len(set(slugs)) != len(slugs):
        return "app slugs must be unique"
    return None


# ---------- derived names ----------

def split_list(value: str) -> List[str]:
    return [item.strip() for item in value.replace(";", ",").split(",") if item.strip()]


def slug_from(name: str) -> str:
    words = re.findall(r"[A-Za-z0-9]+", name)
    slug = "-".join(word.lower() for word in words)
    return slug if slug and slug[0].isalpha() else f"app-{slug}" if slug else ""


def pascal_from(name: str) -> str:
    """'Acme Shop' -> 'AcmeShop' (Gradle root project, iOS product name, Swift prefixes)."""
    words = re.findall(r"[A-Za-z0-9]+", name)
    text = "".join(word[:1].upper() + word[1:] for word in words)
    return text if text and text[0].isalpha() else f"App{text}"


def prefix_from(name: str) -> str:
    letters = re.sub(r"[^A-Za-z0-9]", "", name).upper()
    return (letters[:APP_PREFIX_LENGTH] or "APP").ljust(APP_PREFIX_LENGTH, "X")


def system_prefix_from(name: str) -> str:
    """'Acme Shop' -> 'ACME', 'Beta Store' -> 'BETA', 'Zed' -> 'ZED' (letters of the name, at most 4, at least 2)."""
    letters = re.sub(r"[^A-Za-z0-9]", "", name).upper()
    return letters[:SYSTEM_PREFIX_LENGTH].ljust(2, "X") if letters else "APP"


def sdk_title(sdk: str) -> str:
    """'otp' -> 'OTP', 'payments' -> 'Payments' (backlog file names)."""
    return sdk.upper() if len(sdk) <= APP_PREFIX_LENGTH else sdk.capitalize()


def sdk_prefix_from(sdk: str) -> str:
    """'storage' -> 'STO', 'otp' -> 'OTP' (task ids)."""
    return prefix_from(sdk)


def host_of(url: str) -> str:
    """`https://api-dev.acme.io` -> `api-dev.acme.io` (xcconfig files keep only the host as a literal)."""
    return urlsplit(url).netloc


def package_segment(slug: str) -> str:
    segment = re.sub(r"[^a-z0-9]", "", slug.lower())
    return segment if segment and segment[0].isalpha() and segment not in KOTLIN_KEYWORDS else f"app{segment}"


def unique_prefix(wanted: str, taken: List[str], name: str) -> str:
    """CUS for 'customer'; on a clash tries other letters of the name, then digits."""
    if wanted not in taken:
        return wanted
    letters = re.sub(r"[^A-Za-z0-9]", "", name).upper()
    for third in letters[APP_PREFIX_LENGTH:]:
        candidate = wanted[:APP_PREFIX_LENGTH - 1] + third
        if candidate not in taken:
            return candidate
    for digit in range(2, 10):
        candidate = wanted[:APP_PREFIX_LENGTH - 1] + str(digit)
        if candidate not in taken:
            return candidate
    raise ValueError(f"cannot find a free prefix for {name}")


@dataclass
class AppSpec:
    name: str   # display name, e.g. "Customer"
    slug: str   # kebab, e.g. "customer" (also the master branch name)
    name_ar: str = ""

    @property
    def project(self) -> str:
        return pascal_from(self.name)


def parse_app(spec: str) -> AppSpec:
    """'Customer:customer' or 'Customer' (slug derived). An optional third part is the Arabic name."""
    parts = [p.strip() for p in spec.split(":")]
    if not parts or not parts[0]:
        raise ValueError("an app needs a display name, e.g. 'Customer:customer'")
    name = parts[0]
    slug = parts[1] if len(parts) > 1 and parts[1] else slug_from(name)
    error = validate_slug(slug)
    if error:
        raise ValueError(f"app {name!r}: slug {slug!r}: {error}")
    if slug in FIXED_PREFIXES or slug == MAIN_BRANCH:
        raise ValueError(f"app slug {slug!r} is reserved for a master branch")
    return AppSpec(name=name, slug=slug, name_ar=parts[2] if len(parts) > 2 else "")


def parse_apps(value: str) -> List[AppSpec]:
    return [parse_app(item) for item in split_list(value)]


@dataclass
class Spec:
    system_name: str
    system_name_ar: str
    prefix: str
    package_root: str
    npm_scope: str
    target: Path
    with_server: bool = True
    with_admin: bool = True
    apps: List[AppSpec] = field(default_factory=list)
    sdks: List[str] = field(default_factory=list)
    dev_api_url: str = "https://api-dev.example.com"
    prod_api_url: str = "https://api.example.com"
    dev_web_url: str = "https://dev.example.com"
    prod_web_url: str = "https://example.com"
    apple_team_id: str = ""
    owner_github: str = "owner"
    repo_name: str = ""
    today: _dt.date = field(default_factory=_dt.date.today)
    # Per-SDK metadata from templates/sdk/TEMPLATE.json `kinds` (name -> {prefix, title, dir = overlay folder,
    # description}); derived names when absent.
    sdk_overrides: Dict[str, Dict[str, str]] = field(default_factory=dict)
    # The business domain the tool asked about (business.py); TBD placeholders when the owner skipped a question.
    business: Business = field(default_factory=Business)
    # Phase 5: the plan's SDKs (sdks.SdkPlan by id) with their providers, and the published ones (package + version, no folder).
    sdk_plans: Dict[str, Any] = field(default_factory=dict)
    published_sdks: List[Any] = field(default_factory=list)
    skeleton_missing: List[str] = field(default_factory=list)   # what a generated adapter skeleton still lacks (catalog/providers.json)

    # --- derived names (one place, used by every template kind) ---
    @property
    def slug(self) -> str:
        return slug_from(self.system_name)

    @property
    def server_dir(self) -> str:
        return f"{self.prefix}-Server"

    @property
    def admin_dir(self) -> str:
        return f"{self.prefix}-Admin-Dashboard"

    def app_dir(self, app: AppSpec) -> str:
        return f"{self.prefix}-Mobile-{app.project}"

    def app_package(self, app: AppSpec) -> str:
        return f"{self.package_root}.{package_segment(app.slug)}"

    def app_api_prefix(self, app: AppSpec) -> str:
        """`/customer/v1`: the REST namespace of the app (one per client, own token scope)."""
        return f"/{app.slug}/{API_VERSION_SEGMENT}"

    def app_realtime_namespace(self, app: AppSpec) -> str:
        return f"/{app.slug}"

    def _sdk_override(self, sdk: str, key: str, default: str) -> str:
        return self.sdk_overrides.get(sdk, {}).get(key) or default

    def sdk_dir(self, sdk: str) -> str:
        """`<slug>-<kind>`: `acme-storage` for the slug `acme` (the sdk template's `__SDK_DIR_<kind>__`)."""
        return f"{self.slug}-{sdk}"

    def sdk_layer(self, sdk: str) -> str:
        """Overlay folder inside the sdk template: `kinds.<kind>.dir` when declared, else `kinds/<kind>`."""
        return self._sdk_override(sdk, "dir", f"kinds/{sdk}")

    def sdk_description(self, sdk: str) -> str:
        return self._sdk_override(sdk, "description", SDK_DESCRIPTIONS.get(sdk, sdk))

    def sdk_prefix(self, sdk: str) -> str:
        """`STO`, `OTP`, `PAY`, `NOT`, `ANA` (3 letters, upper), unless the sdk template names it."""
        return self._sdk_override(sdk, "prefix", sdk_prefix_from(sdk))

    def sdk_title_of(self, sdk: str) -> str:
        return self._sdk_override(sdk, "title", sdk_title(sdk))

    def sdk_package(self, sdk: str) -> str:
        return f"{self.npm_scope}/{sdk}"

    def app_prefixes(self) -> Dict[str, str]:
        taken = list(FIXED_PREFIXES.values()) + [self.sdk_prefix(sdk) for sdk in self.sdks]
        result: Dict[str, str] = {}
        for app in self.apps:
            prefix = unique_prefix(prefix_from(app.slug), taken, app.slug)
            taken.append(prefix)
            result[app.slug] = prefix
        return result

    def all_prefixes(self) -> Dict[str, str]:
        """Project key -> task prefix for every chosen part (unique by construction)."""
        prefixes: Dict[str, str] = {}
        if self.with_server:
            prefixes["server"] = FIXED_PREFIXES["server"]
        if self.with_admin:
            prefixes["admin"] = FIXED_PREFIXES["admin"]
        prefixes.update(self.app_prefixes())
        for sdk in self.sdks:
            prefixes[sdk] = self.sdk_prefix(sdk)
        return prefixes

    def masters(self) -> List[str]:
        """One master branch per project: server (also every SDK), admin, one per app. `main` belongs to the owner."""
        masters: List[str] = []
        if self.with_server or self.sdks:
            masters.append("server")
        if self.with_admin:
            masters.append("admin")
        masters.extend(app.slug for app in self.apps)
        return masters

    # --- token values ---
    def token_values(self) -> Dict[str, str]:
        values = {
            "__SYSTEM_NAME__": self.system_name,
            "__SYSTEM_NAME_AR__": self.system_name_ar or self.system_name,
            "__SYSTEM_SLUG__": self.slug,
            "__SYSTEM_PREFIX__": self.prefix,
            "__PACKAGE_ROOT__": self.package_root,
            "__NPM_SCOPE__": self.npm_scope,
            "__SERVER_DIR__": self.server_dir,
            "__ADMIN_DIR__": self.admin_dir,
            "__DEV_API_URL__": self.dev_api_url,
            "__PROD_API_URL__": self.prod_api_url,
            "__DEV_WEB_URL__": self.dev_web_url,
            "__PROD_WEB_URL__": self.prod_web_url,
            "__APPLE_TEAM_ID__": self.apple_team_id,
            "__OWNER_GITHUB__": self.owner_github,
            "__REPO_NAME__": self.repo_name or self.slug,
            "__YEAR__": str(self.today.year),
            "__DATE__": self.today.isoformat(),
            "__APPS_LIST__": ", ".join(app.slug for app in self.apps),
            "__SDKS_LIST__": ", ".join(self.sdks),
            "__MASTERS_LIST__": ", ".join(f"`{m}`" for m in self.masters()),
        }
        for token in URL_TOKENS:
            values[token.replace("_URL__", "_HOST__")] = host_of(values[token])
        values.update(business_token_values(self.business))
        prefixes = self.app_prefixes()
        for index, app in enumerate(self.apps, start=1):
            values.update({
                f"__APP_DIR_{index}__": self.app_dir(app),
                f"__APP_NAME_{index}__": app.name,
                f"__APP_NAME_AR_{index}__": app.name_ar or app.name,
                f"__APP_SLUG_{index}__": app.slug,
                f"__APP_PACKAGE_{index}__": self.app_package(app),
                f"__APP_PROJECT_{index}__": app.project,
                f"__APP_PREFIX_{index}__": prefixes[app.slug],
            })
        for sdk in sorted(set(SDK_CATALOG) | set(self.sdks)):  # a package may name a sibling even when it is not chosen
            upper = sdk.upper()
            values[f"__SDK_DIR_{upper}__"] = self.sdk_dir(sdk)
            values[f"__SDK_DIR_{sdk}__"] = self.sdk_dir(sdk)
            values[f"__SDK_PACKAGE_{upper}__"] = self.sdk_package(sdk)
            values[f"__SDK_PREFIX_{upper}__"] = self.sdk_prefix(sdk)
        return values

    def app_values(self, app: AppSpec) -> Dict[str, str]:
        """Contextual tokens while the kmp template is instantiated for one app."""
        return {
            "__APP_NAME__": app.name,
            "__APP_NAME_AR__": app.name_ar or app.name,
            "__APP_SLUG__": app.slug,
            "__APP_DIR__": self.app_dir(app),
            "__APP_PACKAGE__": self.app_package(app),
            "__APP_PACKAGE_PATH__": self.app_package(app).replace(".", "/"),
            "__APP_PACKAGE_DASHED__": self.app_package(app).replace(".", "-"),
            "__APP_PROJECT__": app.project,
            "__APP_PREFIX__": self.app_prefixes()[app.slug],
            "__APP_MASTER__": app.slug,
            "__API_PREFIX__": self.app_api_prefix(app),
            "__REALTIME_NAMESPACE__": self.app_realtime_namespace(app),
        }

    def sdk_values(self, sdk: str) -> Dict[str, str]:
        """Contextual tokens while the sdk template is instantiated for one SDK."""
        return {
            "__SDK_NAME__": sdk,
            "__SDK_KIND__": sdk,
            "__SDK_TITLE__": self.sdk_title_of(sdk),
            "__SDK_KIND_TITLE__": self.sdk_title_of(sdk),
            "__SDK_DIR__": self.sdk_dir(sdk),
            "__SDK_PACKAGE__": self.sdk_package(sdk),
            "__SDK_PREFIX__": self.sdk_prefix(sdk),
            "__SDK_PREFIX_LOWER__": self.sdk_prefix(sdk).lower(),
            "__SDK_DESCRIPTION__": self.sdk_description(sdk),
            "__SDK_LAYER__": self.sdk_layer(sdk),
        }

    def part_values(self) -> Dict[str, List[Dict[str, str]]]:
        """Per-app and per-SDK value sets for repeated blocks (`__EACH_APP__` / `__EACH_SDK__`)."""
        return {"APP": [self.app_values(app) for app in self.apps], "SDK": [self.sdk_values(sdk) for sdk in self.sdks]}
