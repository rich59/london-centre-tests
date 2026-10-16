#!/usr/bin/env python3
"""Build the four tests with the email step + automatic save/email module.
   tests-src/<key>.html  ->  app/tests/<key>.html  (desktop app)  and  web/tests/<File>.html (GitHub Pages / browser)
   Settings: app/config.json (inlined as a fallback; the live copy on GitHub Pages is read at send time)."""
import json, pathlib, shutil
ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = [
    ("phonics", "Phonics_Entry_Test.html", "Phonics Entry Test (ages 3–6)", True),
    ("kids", "Entry_Test_Ages_7-12.html", "Entry Test – Young Learners (ages 7–12)", True),
    ("teen", "Teenager_Placement_Test_CEFR.html", "Teenager Placement Test (CEFR) – Ages 13–19", False),
    ("adult", "Adult_Placement_Test_CEFR.html", "Adult Placement Test (CEFR) – Ages 20+", False),
]
cfg = json.loads((ROOT / "app/config.json").read_text(encoding="utf-8"))
js = (ROOT / "shared/lct-results.js").read_text(encoding="utf-8")
(ROOT / "web/tests").mkdir(parents=True, exist_ok=True)
(ROOT / "app/tests").mkdir(parents=True, exist_ok=True)
for key, fname, name, parent in TESTS:
    html = (ROOT / "tests-src" / f"{key}.html").read_text(encoding="utf-8")
    html = html.replace("Everything else works offline and no results are sent anywhere.",
                        "Everything else works offline; the only thing sent is the results email (to the address typed on the start page and to the school).")
    meta = json.dumps({"key": key, "name": name, "parent": parent}, ensure_ascii=False)
    inj = ("<!-- LCT results: email step, auto-save, auto-email (shared/lct-results.js) -->\n<script>window.LCT_TEST=" + meta +
           ";window.LCT_CONFIG_DEFAULT=" + json.dumps(cfg, ensure_ascii=False) + ";</script>\n<script>\n" + js.replace("</script", "<\\/script") + "\n</script>\n")
    assert html.count("</body>") == 1, key
    out = html.replace("</body>", inj + "</body>")
    (ROOT / "app/tests" / f"{key}.html").write_text(out, encoding="utf-8")
    (ROOT / "web/tests" / fname).write_text(out, encoding="utf-8")
    print(f"{key:8s} {len(out):8d} bytes -> app/tests/{key}.html, web/tests/{fname}")
shutil.copy(ROOT / "app/config.json", ROOT / "web/config.json")  # local preview only (git-ignored; the Pages workflow copies it)
