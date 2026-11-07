"""The review: the proposal is the default, every choice can change, secrets are refused, open questions stay open."""
from __future__ import annotations

import io
from contextlib import redirect_stdout

from _support import TempDirTest, valid_plan_data

from catalog import load_catalog
from plan import Plan
from review import describe, looks_like_secret, review

CATALOG = load_catalog()
# secret shapes are assembled here so no file of the repository holds one (the privacy test scans every file)
STRIPE_SHAPE = "sk_" + "live_" + "abcdefghij0123456789"
AWS_SHAPE = "AKIA" + "ABCDEFGHIJKLMNOP"
PEM_SHAPE = "-----BEGIN RSA " + "PRIVATE KEY-----"
URL_SHAPE = "postgres" + "://user:pa55word" + "@db.example.com/app"


class Scripted:
    """A reader that returns the scripted answers in order ('' once they run out) and remembers the questions."""

    def __init__(self, answers=()):
        self.answers = list(answers)
        self.prompts = []

    def __call__(self, prompt):
        self.prompts.append(prompt)
        return self.answers.pop(0) if self.answers else ""


def run_review(plan, answers=(), yes=False):
    reader, said, out = Scripted(answers), [], io.StringIO()
    with redirect_stdout(out):
        result = review(plan, CATALOG, reader, said.append, yes=yes)
    return result, reader, "\n".join(said) + out.getvalue()


class ReviewTest(TempDirTest):
    def plan(self, **change):
        data = valid_plan_data()
        data.update(change)
        return Plan.from_dict(data, CATALOG)

    def test_enter_everywhere_keeps_the_proposal(self):
        plan = self.plan()
        result, reader, _ = run_review(plan)
        self.assertEqual(plan.to_dict(), result.to_dict())
        self.assertGreater(len(reader.prompts), 12)
        self.assertEqual([], reader.answers)

    def test_yes_accepts_the_proposal_without_asking(self):
        plan = self.plan()
        result, reader, text = run_review(plan, yes=True)
        self.assertEqual([], reader.prompts)
        self.assertEqual(plan.to_dict(), result.to_dict())
        self.assertIn("accepted as it is", text)
        self.assertEqual(1, len(result.open_questions_unanswered()))

    def test_every_kind_of_change(self):
        plan = self.plan()
        original = plan.to_dict()
        answers = [
            "yes", "Acme Market", "", "acme-market", "AMKT", "com.acmemarket", "@acmemarket",   # names
            "", "remove", "", "android, web",              # server keep, admin removed, customer kept with platforms
            "yes", "web", "Parent Portal", "parents", "", "no",   # add a web part
            "", "published", "@acme/otp", "1.4.0", "",     # otp kept, published, provider kept
            "remove",                                      # payments removed
            "maps", "", "none", "other", "LocalMaps", "",  # maps added with no code and an unknown provider, then done
            "fly", "", "",                                 # server host, database and cache kept
            "cloudflare",                                  # parent portal host
            "=",                                           # question: take the proposed answer
            "ar"]                                          # document language
        result, reader, _ = run_review(plan, answers)
        self.assertEqual([], reader.answers)
        self.assertEqual(original, plan.to_dict())        # the argument is not changed
        self.assertEqual(("Acme Market", "AMKT", "com.acmemarket", "@acmemarket"),
                         (result.system.name, result.system.prefix, result.system.package_root, result.system.npm_scope))
        self.assertEqual(["server", "customer", "parent-portal"], [m.id for m in result.modules])
        self.assertEqual(["android", "web"], result.modules[1].platforms)
        self.assertEqual(("web", ["web"]), (result.modules[2].kind, result.modules[2].platforms))
        otp = result.sdk("otp")
        self.assertEqual(("published", "@acme/otp", "1.4.0", "twilio"), (otp.source, otp.package, otp.version, otp.provider))
        self.assertIsNone(result.sdk("payments"))
        maps = result.sdk("maps")
        self.assertEqual(("none", "LocalMaps", True, False), (maps.source, maps.provider, maps.known, maps.provider_known))
        self.assertEqual([("server", "fly", "postgres", "redis"), ("parent-portal", "cloudflare", "none", "none")],
                         [(d.part, d.host, d.database, d.cache) for d in result.deployment])
        self.assertEqual("ID check at the door", result.open_questions[0].answer)
        self.assertEqual("ar", result.languages.documents)

    def test_unanswered_questions_stay_open_and_answers_are_kept(self):
        data = valid_plan_data()
        data["open_questions"].append({"id": "loyalty", "question": "Loyalty points?", "why": "scope", "proposed_default": ""})
        plan = Plan.from_dict(data, CATALOG)
        # Enter for everything up to the questions, then answer only the first question and the document language
        roles = len([m for m in plan.modules if m.kind in ("app", "web")])   # the role question of each client module comes last
        answers = [""] * (len(run_review(plan)[1].prompts) - 3 - roles) + ["Yes, ID at the door", "", "en"] + [""] * roles
        result, _, text = run_review(plan, answers)
        self.assertEqual("Yes, ID at the door", result.open_questions[0].answer)
        self.assertIsNone(result.open_questions[1].answer)
        self.assertEqual(["loyalty"], [q.id for q in result.open_questions_unanswered()])
        self.assertIn("(nothing proposed)", text)
        again, reader, _ = run_review(result)   # reviewing a reviewed plan keeps the answer on Enter
        self.assertEqual("Yes, ID at the door", again.open_questions[0].answer)

    def test_equals_sign_with_no_proposal_leaves_the_question_open(self):
        data = valid_plan_data()
        data["open_questions"] = [{"id": "loyalty", "question": "Loyalty points?", "why": "scope", "proposed_default": ""}]
        plan = Plan.from_dict(data, CATALOG)
        total = len(run_review(plan)[1].prompts)
        result, _, _ = run_review(plan, [""] * (total - 2) + ["=", ""])
        self.assertIsNone(result.open_questions[0].answer)

    def test_a_secret_is_refused_and_asked_again(self):
        plan = self.plan()
        # names no; three parts kept + customer platforms + no extra part; otp kept, source kept; provider: a secret, then vonage
        result, reader, text = run_review(plan, ["no"] + [""] * 7 + [STRIPE_SHAPE, "vonage"])
        self.assertIn("looks like a secret", text)
        self.assertEqual("vonage", result.sdk("otp").provider)
        self.assertNotIn(STRIPE_SHAPE, "".join(reader.prompts))

    def test_a_wrong_answer_is_asked_again_with_the_reason(self):
        result, reader, text = run_review(self.plan(), ["no"] + [""] * 6 + ["download", "published", "not a package", "@acme/otp", "1.0"])
        self.assertIn("answer internal or published or none", text)
        self.assertIn("not a valid package name", text)
        self.assertEqual(("@acme/otp", "1.0"), (result.sdk("otp").package, result.sdk("otp").version))

    def test_the_only_module_cannot_be_removed_and_is_not_asked_about(self):
        data = valid_plan_data()
        data["modules"], data["deployment"], data["sdks"], data["open_questions"] = data["modules"][:1], data["deployment"][:1], [], []
        _, reader, _ = run_review(Plan.from_dict(data, CATALOG))
        self.assertFalse([p for p in reader.prompts if "keep or remove" in p])

    def test_looks_like_secret(self):
        for text in (STRIPE_SHAPE, AWS_SHAPE, "password=hunter2abc", "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", PEM_SHAPE, URL_SHAPE,
                     "gh" + "p_" + "a1" * 15):
            self.assertTrue(looks_like_secret(text), text)
        for text in ("twilio", "@acme/otp", "1.4.0", "PAYMENT_API_KEY", "Europe/Dublin", "docker-server", "ID check at the door",
                     "the key is kept in the .env file"):
            self.assertFalse(looks_like_secret(text), text)

    def test_describe_is_plain_language(self):
        data = valid_plan_data()
        data["sdks"].append({"id": "loyalty", "title": "Loyalty", "why": "points", "source": "published", "package": "@acme/loyalty",
                             "version": "2.0.0", "provider": "my-own-engine"})
        text = describe(Plan.from_dict(data, CATALOG), CATALOG)
        for part in ("Proposal for Acme Shop", "Customer - Mobile app for customers [android, ios]", "Loyalty (loyalty): already published (@acme/loyalty 2.0.0)",
                     "new: not in the catalog", "provider not in the catalog", "server: render (database postgres, cache redis)",
                     "Open questions: 1 of 1 unanswered", "EUR (cent, 2 decimals)"):
            self.assertIn(part, text)
