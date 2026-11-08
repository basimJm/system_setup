#!/usr/bin/env python3
"""Privacy guard: nothing private may be committed, now or later.

Walks every tracked text file and every tracked file name and fails on
  * secret shapes (private key blocks, cloud and token formats, credentials inside URLs), except fixtures that are named
    one by one in `SECRET_ALLOWLIST`, each with its reason;
  * words on the hashed deny list `tests/fixtures/private_words.sha256` (SHA-256 of the lowercase word, so the private
    names themselves are never published);
  * absolute user paths, real-looking e-mail addresses, hosted URLs of deployment platforms and public IP addresses.

A failure names the file, the line and the kind, and at most the first 4 characters of a secret; it never prints a
denied word. To deny one more word without publishing it: `python3 tests/test_no_private_data.py --hash WORD` prints the
line to append to the hash file. To scan any folder, for example a generated system:
`python3 tests/test_no_private_data.py --scan DIR`.
"""
from __future__ import annotations

import hashlib
import ipaddress
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

ROOT = Path(__file__).resolve().parents[1]
DENY_FILE = ROOT / "tests" / "fixtures" / "private_words.sha256"
SELF = "tests/test_no_private_data.py"

# --------------------------------------------------------------------------- secret shapes
SECRET_PATTERNS: Dict[str, "re.Pattern[str]"] = {
    "private-key-block": re.compile(r"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----"),
    "aws-access-key-id": re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),
    "github-token": re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}"),
    "github-fine-grained-token": re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}"),
    "slack-token": re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}"),
    "google-api-key": re.compile(r"\bAIza[0-9A-Za-z_-]{35}"),
    "stripe-live-key": re.compile(r"\b[sr]k_live_[A-Za-z0-9]{16,}"),
    "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}"),
    "npm-token": re.compile(r"\bnpm_[A-Za-z0-9]{36}\b"),
    "credentials-in-url": re.compile(r"\b[a-z][a-z0-9+.-]*://[^/\s:@'\"<>]*:[^/\s@'\"<>]+@[^\s/'\"<>]+"),
}
# Fixtures that are clearly fake, one by one: path -> {kind: reason}.
SECRET_ALLOWLIST: Dict[str, Dict[str, str]] = {
    "templates/sdk/kinds/storage/tests/sigv4.test.ts": {
        "aws-access-key-id": "the access key id of the AWS Signature V4 documentation example (ends in EXAMPLE)"},
    "templates/server/tests/config.test.ts": {
        "credentials-in-url": "a throwaway local connection string whose log masking the test checks"},
    "templates/server/tests/redis.test.ts": {
        "credentials-in-url": "a throwaway local connection string whose log masking the test checks"},
}

# --------------------------------------------------------------------------- other shapes
USER_PATH = re.compile(r"(?:/Users/|/home/)([A-Za-z0-9._-]+)/|[A-Za-z]:\\Users\\([A-Za-z0-9._-]+)\\")
SAFE_PATH_OWNERS = {"runner", "user", "you", "name", "me", "dev", "app", "node", "example", "yourname", "username", "<user>"}
EMAIL = re.compile(r"(?<![A-Za-z0-9._%+-])([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})")
KOTLIN_LABELS = {"this", "return", "break", "continue", "super"}
SAFE_EMAIL_DOMAINS = {"example.com", "example.org", "example.net", "b.co", "b.c", "d.co", "github.com",
                      "users.noreply.github.com", "anthropic.com"}
SAFE_EMAIL_SUFFIXES = (".test", ".invalid", ".example", ".localhost", ".local")
HOSTED_URL = re.compile(
    r"\b[a-z0-9][a-z0-9-]{2,}\.(?:cloudfront\.net|onrender\.com|herokuapp\.com|vercel\.app|netlify\.app|web\.app|"
    r"firebaseapp\.com|railway\.app|fly\.dev|pages\.dev|workers\.dev|ngrok(?:-free)?\.(?:io|app|dev)|"
    r"[a-z0-9-]+\.mongodb\.net|supabase\.co|upstash\.io|amazonaws\.com\.cn)\b")
IPV4 = re.compile(r"(?<![0-9.])((?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})(?:\.(?:25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})){3})(?![0-9.])")
DOC_NETS = [ipaddress.ip_network(n) for n in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24")]
ALLOWED_PHRASES = ("basimjm",)  # the public GitHub handle of the project owner

# --------------------------------------------------------------------------- the hashed deny list
RUN = re.compile(r"\+\d+|@[A-Za-z0-9_-]+|com\.[A-Za-z0-9]+|[A-Za-z]+|[\u0600-\u06FF]+")
CAMEL = re.compile(r"[A-Z]+(?![a-z])|[A-Z]?[a-z]+")
ARABIC_MARKS = re.compile(r"[\u064B-\u0652\u0670\u0640]")


def normalize(word: str) -> str:
    word = ARABIC_MARKS.sub("", word.lower())
    return re.sub("[أإآ]", "ا", word)


def word_hash(word: str) -> str:
    return hashlib.sha256(normalize(word).encode("utf-8")).hexdigest()


def load_deny(path: Path = DENY_FILE) -> Set[str]:
    out: Set[str] = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            out.add(line.lower())
    return out


def words_of(text: str) -> Set[str]:
    """Every normalized word of `text`, the camelCase / UPPER parts of it, `+123` phone prefixes (1 to 4 digits),
    `@scope` and `com.name` forms (also without the `@` or `com.`)."""
    text = re.sub("|".join(ALLOWED_PHRASES), " ", text, flags=re.I)
    found: Set[str] = set()
    for run in RUN.findall(text):
        inner = run
        if run[0] == "+":
            found.update("+" + run[1:k + 1] for k in range(1, 5) if len(run) > k)
            continue
        if run[0] == "@":
            inner = run[1:]
        elif run.startswith("com."):
            inner = run[4:]
        found.add(normalize(run))
        found.add(normalize(inner))
        if inner.isascii():
            found.update(normalize(part) for part in CAMEL.findall(inner))
    return found


def denied_in(text: str, deny: Set[str]) -> bool:
    return any(hashlib.sha256(w.encode("utf-8")).hexdigest() in deny for w in words_of(text))


# --------------------------------------------------------------------------- scanning
def candidate_files(root: Path) -> List[Path]:
    """Tracked files plus new untracked files that are not ignored; all files of a folder that is not a git checkout."""
    if (root / ".git").exists():
        names: Set[str] = set()
        for args in (["ls-files", "-z"], ["ls-files", "-z", "--others", "--exclude-standard"]):
            out = subprocess.run(["git", "-C", str(root), *args], capture_output=True, check=True).stdout
            names.update(n for n in out.decode("utf-8").split("\0") if n)
        return sorted(root / n for n in names if (root / n).is_file())
    return sorted(p for p in root.rglob("*") if p.is_file() and ".git" not in p.relative_to(root).parts)


def read_text(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def mask(value: str) -> str:
    return value[:4] + "…"


def allowed_kinds(rel: str, allow: Dict[str, Dict[str, str]]) -> Dict[str, str]:
    """The allowlisted kinds for `rel`: an exact path, or the same file inside a generated part (`<Part>/tests/x.test.ts`)."""
    if rel in allow:
        return allow[rel]
    for key, kinds in allow.items():
        tail = re.sub(r"^templates/(?:sdk/kinds/[^/]+|[^/]+)/", "", key)
        if tail.startswith("tests/") and rel.endswith("/" + tail) and rel.count("/") == tail.count("/") + 1:
            return kinds
    return {}


def scan_text(rel: str, text: str, deny: Set[str],
              allow: Optional[Dict[str, Dict[str, str]]] = None) -> List[str]:
    allow = SECRET_ALLOWLIST if allow is None else allow
    allowed = allowed_kinds(rel, allow)
    findings: List[str] = []
    for number, line in enumerate(text.split("\n"), 1):
        def add(kind: str, detail: str = "") -> None:
            findings.append(f"{rel}:{number}: {kind}{' ' + detail if detail else ''}")

        for kind, rx in SECRET_PATTERNS.items():
            if kind in allowed:
                continue
            for m in rx.finditer(line):
                add(f"secret ({kind})", f"starts with {mask(m.group(0))!r}")
        if "sha512-" not in line and "sha1-" not in line and denied_in(line, deny):
            add("private word", "(on the hashed deny list)")
        for m in USER_PATH.finditer(line):
            owner = (m.group(1) or m.group(2) or "").lower()
            if owner not in SAFE_PATH_OWNERS:
                add("absolute user path", f"owner starts with {owner[:4]!r}")
        for m in EMAIL.finditer(line):
            local, domain = m.group(1).lower(), m.group(2).lower()
            if local in KOTLIN_LABELS or domain in SAFE_EMAIL_DOMAINS or domain.endswith(SAFE_EMAIL_SUFFIXES):
                continue
            if rel.endswith("package-lock.json"):
                continue  # public maintainer metadata of third-party npm packages
            add("e-mail address", f"domain {domain!r}")
        for m in HOSTED_URL.finditer(line):
            add("hosted URL", f"host starts with {m.group(0)[:4]!r}")
        for m in IPV4.finditer(line):
            try:
                ip = ipaddress.ip_address(m.group(1))
            except ValueError:
                continue
            if ip.is_global and not any(ip in net for net in DOC_NETS) and not rel.endswith("package-lock.json") \
                    and not re.search(r"(?:version|v|@|\^|~|>=|<=)\s*" + re.escape(m.group(1)), line):
                add("public IP address", f"starts with {m.group(1)[:4]!r}")
    return findings


def scan_name(rel: str, deny: Set[str]) -> List[str]:
    return [f"{rel}: file name contains a private word (on the hashed deny list)"] if denied_in(rel, deny) else []


def scan_directory(root: Path, deny: Optional[Set[str]] = None) -> List[str]:
    deny = load_deny() if deny is None else deny
    findings: List[str] = []
    for path in candidate_files(root):
        rel = path.relative_to(root).as_posix()
        findings.extend(scan_name(rel, deny))
        if rel == SELF:
            continue
        text = read_text(path)
        if text is not None:
            findings.extend(scan_text(rel, text, deny))
    return findings


# --------------------------------------------------------------------------- tests
class PrivacyOfTheRepositoryTest(unittest.TestCase):
    def test_deny_list_is_a_list_of_sha256_and_is_not_empty(self):
        deny = load_deny()
        self.assertGreaterEqual(len(deny), 20)
        self.assertTrue(all(re.fullmatch(r"[0-9a-f]{64}", h) for h in deny))

    def test_no_tracked_file_or_file_name_holds_private_data(self):
        findings = scan_directory(ROOT)
        self.assertEqual([], findings, "private data found:\n" + "\n".join(findings[:40]))

    def test_allowlist_entries_still_point_at_files_that_need_them(self):
        for rel, kinds in SECRET_ALLOWLIST.items():
            path = ROOT / rel
            self.assertTrue(path.is_file(), f"stale allowlist entry: {rel}")
            text = path.read_text(encoding="utf-8")
            for kind in kinds:
                self.assertTrue(SECRET_PATTERNS[kind].search(text), f"{rel} no longer needs the {kind} exception")


class ScannerCatchesPlantedDataTest(unittest.TestCase):
    """The guard is only worth something if it fails on what it guards against."""

    PLANTED = "plantedword"

    def deny(self) -> Set[str]:
        return {word_hash(self.PLANTED)}

    def test_planted_secrets_are_found_and_masked(self):
        planted = {
            "private-key-block": "-----BEGIN " + "RSA PRIVATE KEY-----",
            "aws-access-key-id": "AKIA" + "ABCDEFGHIJKLMNOP",
            "github-token": "ghp" + "_" + "a1B2c3D4" * 5,
            "google-api-key": "AIza" + "x" * 35,
            "slack-token": "xoxb" + "-1234567890-abcdef",
            "credentials-in-url": "postgres" + "://admin:hunter2@db.internal.example.org/app",
        }
        for kind, value in planted.items():
            findings = scan_text("src/a.txt", f"value = {value}\n", set(), allow={})
            self.assertTrue(any(f"({kind})" in f for f in findings), kind)
            for f in findings:
                self.assertNotIn(value, f)
                self.assertNotIn("hunter2", f)

    def test_allowlist_also_covers_the_same_fixture_inside_a_generated_part(self):
        text = "key = " + "AKIA" + "ABCDEFGHIJKLMNOP"
        allow = {"templates/sdk/kinds/storage/tests/sigv4.test.ts": {"aws-access-key-id": "fake"}}
        self.assertEqual([], scan_text("acme-storage/tests/sigv4.test.ts", text, set(), allow=allow))
        self.assertTrue(scan_text("acme-storage/src/sigv4.test.ts", text, set(), allow=allow))
        self.assertTrue(scan_text("acme-storage/tests/other.test.ts", text, set(), allow=allow))

    def test_allowlist_is_per_file_and_per_kind(self):
        text = "key = " + "AKIA" + "ABCDEFGHIJKLMNOP"
        self.assertTrue(scan_text("a.txt", text, set(), allow={}))
        self.assertEqual([], scan_text("a.txt", text, set(), allow={"a.txt": {"aws-access-key-id": "fake"}}))
        self.assertTrue(scan_text("b.txt", text, set(), allow={"a.txt": {"aws-access-key-id": "fake"}}))

    def test_denied_words_are_found_in_every_spelling_and_never_printed(self):
        deny = self.deny()
        for text in ("plantedword", "PlantedWord", "PLANTEDWORD", "the plantedword.", "const plantedWord = 1",
                     "https://plantedword.example.com", "@plantedword/sdk", "snake_plantedword_case"):
            findings = scan_text("a.txt", text, deny, allow={})
            self.assertTrue(any("private word" in f for f in findings), text)
            self.assertTrue(all("plantedword" not in f.lower() for f in findings), findings)

    def test_a_longer_word_that_only_contains_the_denied_word_is_not_the_word(self):
        for text in ("xplantedwordy", "plantedwords", "PlantedWordServer"):
            self.assertEqual([], scan_text("a.txt", text, self.deny(), allow={}), text)

    def test_words_inside_other_words_and_random_text_are_not_false_positives(self):
        deny = {word_hash("wab"), word_hash("jod")}
        for text in ("throwable drawable", "const x = 'sha512-AbcWabJodXyz'", "stuff.jodel", "wabbit"):
            self.assertEqual([], scan_text("a.txt", text, deny, allow={}), text)

    def test_private_file_names_are_found(self):
        self.assertTrue(scan_name("docs/PlantedWord_Tasks.md", self.deny()))
        self.assertTrue(scan_name("a/plantedword/b.txt", self.deny()))
        self.assertEqual([], scan_name("docs/Tasks.md", self.deny()))

    def test_arabic_words_are_normalized(self):
        planted = "\u0623\u0643\u0644"  # a neutral Arabic word; hamza forms and diacritics must not hide it
        deny = {word_hash(planted)}
        self.assertTrue(scan_text("a.txt", planted + " ", deny, allow={}))
        self.assertTrue(scan_text("a.txt", "\u0627\u0643\u0644", deny, allow={}))
        self.assertTrue(scan_text("a.txt", "\u0623\u064f\u0643\u0652\u0644", deny, allow={}))
        self.assertEqual([], scan_text("a.txt", "\u0623\u0643\u0644\u0629", deny, allow={}))

    def test_phone_prefix_and_scope_forms(self):
        deny = {word_hash("+123"), word_hash("@plantedscope"), word_hash("com.plantedco")}
        self.assertTrue(scan_text("a.txt", "call +123456789", deny, allow={}))
        self.assertEqual([], scan_text("a.txt", "call +456123", deny, allow={}))
        self.assertTrue(scan_text("a.txt", '"@plantedscope/sdk"', deny, allow={}))
        self.assertTrue(scan_text("a.txt", "package com.plantedco.app", deny, allow={}))

    def test_owner_handle_is_the_only_allowed_phrase(self):
        deny = {word_hash("basim")}
        self.assertEqual([], scan_text("CODEOWNERS", "* @basimJm", deny, allow={}))
        self.assertTrue(scan_text("a.txt", "Basim", deny, allow={}))

    def test_user_paths_emails_hosted_urls_and_public_ips(self):
        cases = {
            "absolute user path": "path = '/Users/jane/work/app'",
            "e-mail address": "contact = jane@corp-mail.org",
            "hosted URL": "url = https://abcdef123.cloudfront.net/x",
            "public IP address": "host = 8.8.4.4",
        }
        for kind, text in cases.items():
            self.assertTrue(any(kind in f for f in scan_text("a.txt", text, set(), allow={})), kind)
        for text in ("p = '/home/runner/work'", "mail = a@example.com", "u = https://cdn.example.com/x", "h = 127.0.0.1",
                     "h = 10.0.2.2", "h = 192.0.2.7", "version 1.2.3.4", "label = this@launch.value", "n = user@users.noreply.github.com"):
            self.assertEqual([], scan_text("a.txt", text, set(), allow={}), text)

    def test_scan_directory_walks_files_and_names_outside_git(self):
        deny = self.deny()
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            (base / "ok.md").write_text("nothing here\n", encoding="utf-8")
            (base / "sub").mkdir()
            (base / "sub" / "plantedword.txt").write_text("hello\n", encoding="utf-8")
            (base / "sub" / "b.txt").write_text("line one\nmy plantedword\n", encoding="utf-8")
            (base / "sub" / "bin.dat").write_bytes(b"\xff\xfe\x00plantedword")
            findings = scan_directory(base, deny)
            self.assertEqual(2, len(findings), findings)
            self.assertTrue(any("sub/plantedword.txt: file name" in f for f in findings))
            self.assertTrue(any("sub/b.txt:2: private word" in f for f in findings))


class GeneratedSystemFromTheRealTemplatesTest(unittest.TestCase):
    """What the tool writes must be as clean as what is committed, and the code defaults must come from tokens."""

    def generate(self, target: Path, *extra: str) -> None:
        cmd = [sys.executable, str(ROOT / "src" / "system_setup" / "cli.py"), "--yes", "--name", "Beta Store", "--prefix", "BETA",
               "--package-root", "io.beta", "--npm-scope", "@beta", "--target", str(target), "--app", "Customer:customer",
               "--sdk", "storage", "--no-git", *extra]
        done = subprocess.run(cmd, capture_output=True, text=True)
        self.assertEqual(0, done.returncode, done.stdout[-600:] + done.stderr[-600:])

    def test_generated_output_is_clean_and_defaults_are_neutral_until_answered(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "neutral"
            self.generate(target)
            self.assertEqual([], scan_directory(target))
            kernel = (target / "BETA-Admin-Dashboard" / "src" / "constants" / "kernel.ts").read_text(encoding="utf-8")
            self.assertIn("BUSINESS_TIME_ZONE = 'UTC'", kernel)
            core = (target / "BETA-Admin-Dashboard" / "src" / "locales" / "en" / "core.json").read_text(encoding="utf-8")
            self.assertIn('"currency": "XXX"', core)

    def test_business_answers_reach_the_code_defaults(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "answered"
            self.generate(target, "--business-time-zone", "Europe/Paris", "--currency", "Euro (EUR)")
            self.assertEqual([], scan_directory(target))
            kernel = (target / "BETA-Admin-Dashboard" / "src" / "constants" / "kernel.ts").read_text(encoding="utf-8")
            self.assertIn("BUSINESS_TIME_ZONE = 'Europe/Paris'", kernel)
            core = (target / "BETA-Admin-Dashboard" / "src" / "locales" / "ar" / "core.json").read_text(encoding="utf-8")
            self.assertIn('"currency": "EUR"', core)
            time_format = next(target.glob("BETA-Mobile-Customer/core/common/src/commonMain/kotlin/**/TimeFormat.kt"))
            self.assertIn('const val ZONE_ID = "Europe/Paris"', time_format.read_text(encoding="utf-8"))


def main(argv: List[str]) -> int:
    if len(argv) == 3 and argv[1] == "--hash":
        print(word_hash(argv[2]))
        return 0
    if len(argv) == 3 and argv[1] == "--scan":
        findings = scan_directory(Path(argv[2]).resolve())
        print("\n".join(findings) if findings else "clean")
        return 1 if findings else 0
    unittest.main(argv=argv)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
