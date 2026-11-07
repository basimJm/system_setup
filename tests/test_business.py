"""Business-domain answers: .md/.json/interactive parsing, defaults, token rendering, BUSINESS_INPUT round trip, the
agent prompt (PROMPT.md Part B filled, every known placeholder replaced)."""
from __future__ import annotations

import io
import json
import re
import unittest
from contextlib import redirect_stdout

from _support import TOOL_ROOT, TempDirTest

from business import (FIELDS, PROMPT_END, PROMPT_START, TBD, Business, agent_prompt_section, ask_business, business_from,
                      load_business_file, open_decisions, parse_business_markdown, prompt_placeholders, render_agent_prompt,
                      render_business_input, split_items, token_values, unfilled_placeholders, write_agent_prompt,
                      write_business_input)
from prompts import ask

SAMPLE_MD = """# Beta Store business

## Business summary
Customers order from shops.
Shops fulfil; the platform collects and pays shops monthly (phase 1).

## Default language
en

## RTL
no

## Currency
USD

## Currency minor unit
cent, 2 decimals

## Business time zone
Europe/Paris

## Actors
- Customer: browse, order, cancel
- Shop owner: fulfil; refund

## Core business rules
1. One order per slot
2. Refund in full when the shop cancels

## Entities and states
Order: PENDING -> PAID -> DONE | CANCELLED

## Scheduled jobs
Reminder 1 h before pickup; auto-cancel unpaid after 15 min

## Integrations
payments: decide later
push: FCM

## Open decisions
Payment gateway
"""


class ParsingTest(TempDirTest):
    def test_defaults_are_tbd_placeholders_except_language_rtl_and_stored_zone(self):
        business = Business()
        self.assertEqual(("ar", "on", "UTC", TBD, TBD, TBD, TBD), (business.default_language, business.rtl, business.stored_time_zone,
                                                                   business.summary, business.currency, business.currency_minor_unit,
                                                                   business.business_time_zone))
        self.assertEqual([], business.actors)
        self.assertEqual(["summary", "currency", "currency_minor_unit", "business_time_zone", "actors", "rules", "entities", "jobs",
                          "integrations"], business.tbd_keys())

    def test_markdown_file_by_headings(self):
        path = self.write("business.md", SAMPLE_MD)
        business = load_business_file(path)
        self.assertEqual("Customers order from shops.\nShops fulfil; the platform collects and pays shops monthly (phase 1).", business.summary)
        self.assertEqual(("en", "off", "USD", "cent, 2 decimals", "UTC", "Europe/Paris"),
                         (business.default_language, business.rtl, business.currency, business.currency_minor_unit,
                          business.stored_time_zone, business.business_time_zone))
        self.assertEqual(["Customer: browse, order, cancel", "Shop owner: fulfil", "refund"], business.actors)  # `;` splits, `- ` dropped
        self.assertEqual(["One order per slot", "Refund in full when the shop cancels"], business.rules)  # `1. ` dropped
        self.assertEqual(["Order: PENDING -> PAID -> DONE | CANCELLED"], business.entities)
        self.assertEqual(["Reminder 1 h before pickup", "auto-cancel unpaid after 15 min"], business.jobs)
        self.assertEqual(["payments: decide later", "push: FCM"], business.integrations)
        self.assertEqual(["Payment gateway"], business.open_decisions)
        self.assertEqual([], business.tbd_keys())
        self.assertEqual({"Default language": "en"}, {k: v for k, v in parse_business_markdown("intro\n## Default language\nen\n").items()})

    def test_json_file_same_keys_lists_or_strings(self):
        path = self.write("b.json", json.dumps({"summary": "S", "rtl": True, "rules": ["a", "b; c"], "jobs": "x; y", "currency": "EUR"}))
        business = load_business_file(path)
        self.assertEqual(("S", "on", "EUR", ["a", "b", "c"], ["x", "y"]), (business.summary, business.rtl, business.currency, business.rules, business.jobs))
        self.assertEqual("ar", business.default_language)

    def test_bad_files_and_unknown_keys_are_refused(self):
        with self.assertRaises(ValueError):
            load_business_file(self.write("no-headings.md", "just text"))
        with self.assertRaises(ValueError):
            load_business_file(self.write("b.txt", "x"))
        with self.assertRaises(ValueError):
            load_business_file(self.write("list.json", "[1]"))
        with self.assertRaises(ValueError) as caught:
            business_from({"currencyy": "USD"})
        self.assertIn("unknown business field", str(caught.exception))
        with self.assertRaises(ValueError):
            business_from({"rtl": "maybe"})

    def test_overlay_keeps_base_values_for_empty_answers(self):
        base = business_from({"currency": "USD", "rules": ["r1"]})
        merged = business_from({"currency": "", "rules": None, "jobs": "j1"}, base)
        self.assertEqual(("USD", ["r1"], ["j1"]), (merged.currency, merged.rules, merged.jobs))
        self.assertEqual(["r1"], base.rules)  # base untouched

    def test_split_items(self):
        self.assertEqual(["a", "b", "c"], split_items("- a\n2) b; c\n\nTBD"))

    def test_interactive_multiline_and_lists(self):
        answers = iter(["line one", "line two", "",      # summary (multi-line, empty line ends)
                        "", "off", "USD", "", "", "",     # language default, rtl, currency, minor unit default, zones default
                        "A: x; B: y", "",                 # actors, one line with `;`
                        "r1", "r2", "",                   # rules, two lines
                        "", "", "", ""])                  # entities, jobs, integrations, open decisions kept default
        with redirect_stdout(io.StringIO()) as out:
            business = ask_business(lambda prompt: next(answers), ask)
        self.assertEqual(("line one\nline two", "ar", "off", "USD", TBD), (business.summary, business.default_language, business.rtl,
                                                                          business.currency, business.currency_minor_unit))
        self.assertEqual((["A: x", "B: y"], ["r1", "r2"], [], []), (business.actors, business.rules, business.entities, business.open_decisions))
        self.assertIn("empty line ends", out.getvalue())


class RenderingTest(TempDirTest):
    def test_tokens_render_lists_as_markdown_and_flag_open_items(self):
        values = token_values(load_business_file(self.write("business.md", SAMPLE_MD)))
        self.assertEqual(set(f.token for f in FIELDS), set(values) - {"__BUSINESS_TIME_ZONE_CODE__", "__CURRENCY_CODE__"})
        self.assertEqual("- Customer: browse, order, cancel\n- Shop owner: fulfil\n- refund", values["__BUSINESS_ACTORS__"])
        self.assertEqual("1. One order per slot\n2. Refund in full when the shop cancels", values["__BUSINESS_RULES__"])
        self.assertEqual(("off", "USD", "- Payment gateway"), (values["__RTL__"], values["__CURRENCY__"], values["__OPEN_DECISIONS__"]))
        defaults = token_values(Business())
        self.assertEqual("1. TBD (open — ask the owner)", defaults["__BUSINESS_RULES__"])
        self.assertIn("- Currency: TBD (open — ask the owner)", defaults["__OPEN_DECISIONS__"])
        self.assertIn("- Business summary: TBD (open — ask the owner)", defaults["__OPEN_DECISIONS__"])
        self.assertEqual(9, len(open_decisions(Business())))

    def test_code_facing_defaults_fall_back_to_neutral_values_until_the_owner_answers(self):
        defaults = token_values(Business())
        self.assertEqual(("UTC", "XXX"), (defaults["__BUSINESS_TIME_ZONE_CODE__"], defaults["__CURRENCY_CODE__"]))
        answered = token_values(Business(business_time_zone="Europe/Paris", currency="Euro (EUR)"))
        self.assertEqual(("Europe/Paris", "EUR"), (answered["__BUSINESS_TIME_ZONE_CODE__"], answered["__CURRENCY_CODE__"]))
        for zone in ("UTC", "Etc/GMT+5", "America/Argentina/Buenos_Aires"):
            self.assertEqual(zone, token_values(Business(business_time_zone=zone))["__BUSINESS_TIME_ZONE_CODE__"])
        for bad in ("soon", "paris time", "Mars/Base/X/Y", ""):
            self.assertEqual("UTC", token_values(Business(business_time_zone=bad))["__BUSINESS_TIME_ZONE_CODE__"], bad)
        self.assertEqual("XXX", token_values(Business(currency="dollars"))["__CURRENCY_CODE__"])

    def test_business_input_round_trips_through_the_markdown_loader(self):
        business = load_business_file(self.write("business.md", SAMPLE_MD))
        rel = write_business_input(self.root, business, "Beta Store", "2026-10-29")
        self.assertEqual("docs/BUSINESS_INPUT.md", rel)
        text = (self.root / rel).read_text(encoding="utf-8")
        self.assertTrue(text.startswith("# Beta Store — Business input (answers given to SYSTEM_SETUP on 2026-10-29)"))
        for spec in FIELDS:
            self.assertIn(f"\n## {spec.heading}\n", text)
        self.assertEqual(business, load_business_file(self.root / rel))
        self.assertIn("## Currency\nTBD\n", render_business_input(Business(), "X", "d"))

    def test_prompt_md_part_b_is_filled_without_known_placeholders_left(self):
        prompt = (TOOL_ROOT / "PROMPT.md").read_text(encoding="utf-8")
        self.assertIn(PROMPT_START, prompt)
        self.assertIn(PROMPT_END, prompt)
        section = agent_prompt_section(prompt)
        self.assertTrue(section.startswith("# <system name> — Prompt for the AI agent"))
        business = load_business_file(self.write("business.md", SAMPLE_MD))
        placeholders = prompt_placeholders("Beta Store", business, "| `server` | `BETA-Server/` |", "`server`, `admin`",
                                           "github.com/beta/beta-store", "2026-10-29")
        # every <field> placeholder of Part B that names an answer is known to the filler (literal <Dir>/<ID>/... are not)
        business_markers = {m for m in re.findall(r"<[a-z][a-z ]*>", section)}
        unknown = business_markers - set(placeholders) - {"<project>", "<branch>", "<master>"}
        self.assertEqual(set(), unknown)
        filled = render_agent_prompt(prompt, placeholders)
        self.assertEqual([], unfilled_placeholders(filled, placeholders))
        self.assertIn("# Beta Store — Prompt for the AI agent", filled)
        self.assertIn("Customers order from shops.\nShops fulfil;", filled)
        self.assertIn("| Currency / minor unit | `USD` / `cent, 2 decimals` |", filled)
        self.assertIn("1. One order per slot\n2. Refund in full", filled)
        self.assertIn("| `server` | `BETA-Server/` |", filled)
        self.assertIn("masters: `server`, `admin`)", filled)
        self.assertIn("`| ID | Title | Branch | Needs | Status | Notes |`", filled)
        self.assertIn("python3 scripts/tasks.py next <project>", filled)
        self.assertNotIn(PROMPT_START, filled)

    def test_write_agent_prompt_links_readme_once_and_skips_when_prompt_missing(self):
        self.write("README.md", "# Repo\n")
        placeholders = prompt_placeholders("X", Business(), "", "`server`", "r", "d")
        self.assertIsNone(write_agent_prompt(self.root, self.root / "missing.md", placeholders))
        rel = write_agent_prompt(self.root, TOOL_ROOT / "PROMPT.md", placeholders)
        self.assertEqual("docs/AGENT_PROMPT.md", rel)
        write_agent_prompt(self.root, TOOL_ROOT / "PROMPT.md", placeholders)
        readme = (self.root / "README.md").read_text(encoding="utf-8")
        self.assertEqual(1, readme.count("## Give this to your AI agent"))
        self.assertIn("Give this to your AI agent", readme)
        self.assertIn("- Currency: TBD (open — ask the owner)", (self.root / rel).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
