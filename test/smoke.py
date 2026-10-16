import asyncio, json, os, subprocess, sys, time
from playwright.async_api import async_playwright
APP = '/workspace/desktop_app'
ELECTRON = os.environ.get('ELECTRON_BIN', APP + '/node_modules/electron/dist/electron')
WAV = sys.argv[1] if len(sys.argv) > 1 else APP + '/test/wav/hello.wav'
SHOTS = APP + '/test/shots'; os.makedirs(SHOTS, exist_ok=True)
PORT = 9333
def launch():
    args = [ELECTRON] + ([APP] if ELECTRON.endswith('/electron') else []) + [f'--remote-debugging-port={PORT}', '--use-fake-device-for-media-stream', f'--use-file-for-fake-audio-capture={WAV}', '--no-sandbox']
    env = dict(os.environ, LCT_LOG='1', LCT_NO_MAXIMIZE='1')
    return subprocess.Popen(args, env=env, stdout=open(SHOTS + '/electron.log', 'w'), stderr=subprocess.STDOUT)
async def main():
    proc = launch()
    try:
        async with async_playwright() as p:
            for _ in range(60):
                try: b = await p.chromium.connect_over_cdp(f'http://127.0.0.1:{PORT}'); break
                except Exception: time.sleep(0.5)
            ctx = b.contexts[0]
            for _ in range(40):
                if ctx.pages: break
                await asyncio.sleep(0.25)
            pg = ctx.pages[0]
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.set_viewport_size({'width': 1280, 'height': 800})
            await pg.wait_for_load_state()
            await pg.wait_for_function("document.getElementById('st-sr').className!=='wait'", timeout=90000)
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=SHOTS + '/home.png')
            print('HOME', await pg.evaluate("({title:document.title,h1:document.querySelector('h1').innerText,mic:document.getElementById('st-mic').innerText,sr:document.getElementById('st-sr').innerText,buttons:[...document.querySelectorAll('.tbtn .t')].map(x=>x.innerText)})"))
            # direct shim test: continuous + interim, 8 s
            r = await pg.evaluate("""() => new Promise(res => { const R = window.webkitSpeechRecognition; const g = new R(); g.lang='en-US'; g.continuous=true; g.interimResults=true;
              const log=[]; let fin=''; g.onstart=()=>log.push('start'); g.onerror=e=>log.push('error:'+e.error);
              g.onresult=e=>{ for(let k=e.resultIndex;k<e.results.length;k++){ const a=e.results[k][0]; if(e.results[k].isFinal){fin+=a.transcript; log.push('final:'+a.transcript.trim()+' ('+a.confidence.toFixed(2)+')');} else log.push('interim:'+a.transcript);} };
              g.onend=()=>{log.push('end'); res({fin:fin.trim(), interims:log.filter(x=>x.startsWith('interim')).length, log:log.filter(x=>!x.startsWith('interim')), name:R.name});};
              g.start(); setTimeout(()=>g.stop(), 8000); })""")
            print('SHIM continuous', json.dumps(r))
            r2 = await pg.evaluate("""() => new Promise(res => { const g = new webkitSpeechRecognition(); g.continuous=false; g.interimResults=false; const log=[];
              g.onresult=e=>log.push('result:'+e.results[e.resultIndex][0].transcript+' final='+e.results[e.resultIndex].isFinal); g.onerror=e=>log.push('error:'+e.error); g.onend=()=>{log.push('end');res(log)}; g.start(); setTimeout(()=>{try{g.abort()}catch(_){}} ,20000); })""")
            print('SHIM single-shot', json.dumps(r2))
            for key in ['adult', 'kids', 'phonics']:
                await pg.click(f'#b-{key}'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(800)
                info = await pg.evaluate("({url:location.href,title:document.title,bar:!!document.getElementById('lct-bar'),srName:(window.webkitSpeechRecognition||{}).name,secure:isSecureContext})")
                await pg.screenshot(path=f'{SHOTS}/{key}_start.png')
                await pg.click('#testSR'); await pg.wait_for_timeout(9000)
                out = await pg.inner_text('#srTestOut')
                print('TEST', key, json.dumps(info), '\n   selftest:', out.replace('\n', ' | '))
                await pg.screenshot(path=f'{SHOTS}/{key}_srtest.png')
                await pg.click('#lct-bar .home'); await pg.wait_for_load_state('load'); await pg.wait_for_timeout(500)
                print('   home button ->', pg.url)
            print('PAGE ERRORS', errs)
            await b.close()
    finally:
        proc.terminate(); proc.wait(5)
asyncio.run(main())
