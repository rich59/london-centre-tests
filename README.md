# London Centre Tests

Placement tests for **London Centre of English Language School**:

| Test | Ages |
|---|---|
| Phonics Entry Test | 3–6 |
| Entry Test – Young Learners | 7–12 |
| Teenager Placement Test (CEFR) | 13–19 |
| Adult Placement Test (CEFR) | 20+ |

- **Online (browser):** <https://rich59.github.io/london-centre-tests/>. Use Chrome or Edge and allow the microphone.
- **Windows app (works offline, offline speech recognition):** see [Releases](https://github.com/rich59/london-centre-tests/releases/latest).
  Download the Setup (or Portable) exe **and** `London-Centre-Tests-Speech-Model.tar.gz` into the same folder, then run the Setup.

On the first page of each test the teacher types the student's name and email (a parent's email for Phonics and Young Learners).
When the test is finished, the results are **saved automatically**. They are then **emailed** to the student/parent and to
london-english@live.com. To switch the emails on, see **[EMAIL-SETUP.md](EMAIL-SETUP.md)**. The only settings file is `app/config.json`.

## Project layout
- `tests-src/*.html` – the four tests as written (`sources/adult`, `sources/teen` = the parts they are built from)
- `shared/lct-results.js` – the email step, automatic saving and EmailJS sending (added to every test)
- `scripts/build-tests.py` – builds `app/tests/*.html` (desktop app) and `web/tests/*.html` (website) from `tests-src` + `shared` + `app/config.json`
- `web/` – the GitHub Pages site (`index.html` + tests); deployed by `.github/workflows/pages.yml`
- `app/` – Electron app:
  - `main.js` – secure `app://tests` origin, microphone allowed automatically, Print / Save as PDF, saving of results
  - `preload.js`
  - `inject/sr-shim.js` – offline Vosk speech recognition
  - `home.html`
- `build/` – icon, NSIS include (installs the speech model from next to the installer), afterPack
- `test/` – automated tests (Playwright + xvfb): `email_browser.py`, `email_app_e2e.py`, `smoke.py`, `e2e.py`, …

## Build
```
npm install
python3 scripts/build-tests.py   # after editing tests-src/, shared/ or app/config.json
npm run dist:win                 # Windows Setup + Portable exe (needs wine on Linux)
npm run dist:linux               # Linux test build
```
The speech model (vosk-model-small-en-us-0.15, 41 MB) is not in git. It is attached to each release.
