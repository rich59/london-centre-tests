# Measures the offline shim's word accuracy on TTS WAVs (fresh capture starts at the start of the file)
import asyncio, json, os, re, subprocess, sys, time, wave
from playwright.async_api import async_playwright
APP = '/workspace/desktop_app'; ELECTRON = APP + '/node_modules/electron/dist/electron'; PORT = 9335
def words(s): return re.findall(r"[a-z']+", s.lower().replace('’', "'"))
def lcs(a, b):
    m = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a)):
        for j in range(len(b)): m[i+1][j+1] = m[i][j] + 1 if a[i] == b[j] else max(m[i][j+1], m[i+1][j])
    return m[-1][-1]
async def one(wav, ref):
    dur = wave.open(wav).getnframes() / 48000
    proc = subprocess.Popen([ELECTRON, APP, f'--remote-debugging-port={PORT}', '--use-fake-device-for-media-stream', f'--use-file-for-fake-audio-capture={wav}', '--no-sandbox'],
        env=dict(os.environ, LCT_NO_MAXIMIZE='1'), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        async with async_playwright() as p:
            for _ in range(60):
                try: b = await p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}'); break
                except Exception: time.sleep(0.5)
            ctx = b.contexts[0]
            while not ctx.pages: await asyncio.sleep(0.2)
            pg = ctx.pages[0]; await pg.wait_for_load_state()
            await pg.wait_for_function("window.lcSpeech.state==='ready'", timeout=60000)
            t = await pg.evaluate("""(ms) => new Promise(res => { const g = new webkitSpeechRecognition(); g.continuous = true; g.interimResults = true; let f = '';
              g.onresult = e => { for (let k = e.resultIndex; k < e.results.length; k++) if (e.results[k].isFinal) f += e.results[k][0].transcript; };
              g.onend = () => res(f.trim()); g.start(); setTimeout(() => g.stop(), ms); })""", int(dur * 1000) - 300)
            await b.close()
    finally:
        proc.terminate(); proc.wait(5)
    r, h = words(ref), words(t)
    return t, lcs(r, h), len(r)
async def main():
    tot = [0, 0]
    for wav in sys.argv[1:]:
        base = os.path.basename(wav).split('_')[0]
        ref = open(os.path.join(os.path.dirname(wav), base + '.txt')).read()
        t, m, n = await one(wav, ref); tot[0] += m; tot[1] += n
        print(f'{os.path.basename(wav)}: {m}/{n} words = {100*m/n:.0f}%\n   heard: {t}')
    print(f'OVERALL {tot[0]}/{tot[1]} = {100*tot[0]/tot[1]:.0f}%')
asyncio.run(main())
