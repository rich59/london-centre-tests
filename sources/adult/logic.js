// ---------- setup ----------
const N=Q.length;const OBJ=Q.filter(q=>q.s<=2).length;
const OUT=[10,12,6,27,12];
(function shuffle(){Q.forEach((q,i)=>{if(!q.o||q.err)return;let a=(i+1)*2654435761>>>0;const rnd=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
 const idx=q.o.map((_,k)=>k);for(let k=idx.length-1;k>0;k--){const j=Math.floor(rnd()*(k+1));[idx[k],idx[j]]=[idx[j],idx[k]];}
 if(idx[0]===0&&i%4!==0){idx.push(idx.shift());}q.o=idx.map(k=>q.o[k]);q.ans=idx.indexOf(q.ans);});})();
const LET="ABCD";
let cur=0,answers=new Array(N).fill(null),student={},startTime=null;
const REC={};const PROF={notes:""};CRIT.forEach(c=>PROF[c.k]=null); // REC[i]: recording + transcript for reading-aloud and speaking items
const $=id=>document.getElementById(id);
let tt;function toast(m,ms){const t=$("toast");clearTimeout(tt);t.textContent=m;t.classList.remove("hide");tt=setTimeout(()=>t.classList.add("hide"),ms||2400);}
const f=x=>{x=Math.round(x*10)/10;return String(x);};
const pc=x=>Math.round(x*100);
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function bandIdx(score){let b=0;BANDS.forEach((x,k)=>{if(score>=x[0]-0.0001)b=k;});return b;}
function bandsTable(){return `<table><tr><th>CEFR level</th><th>Overall score /100</th><th>What it means (indicative)</th></tr>`+BANDS.map((b,k)=>`<tr><td><b>${b[2]}</b></td><td>${b[0]}–${b[1]}</td><td>${LV_DESC[k]}</td></tr>`).join("")+`</table>
<p class="note">Overall score = weighted sum of the five section percentages: Vocabulary ${WEIGHT[0]}%, Grammar ${WEIGHT[1]}%, Pronunciation ${WEIGHT[2]}%, Reading aloud ${WEIGHT[3]}%, Speaking ${WEIGHT[4]}%. Reading aloud and speaking are <b>automatic estimates</b> from speech recognition (see the answer key for the thresholds); a teacher can override them. If an item cannot be auto-scored, its section uses the scored items only, and a section with no scored items is left out and the other weights are scaled to 100 – the result is then marked <b>provisional</b>. The same bands are applied to each section percentage to give per-skill indications. Checks: if A1–A2 objective items are under 60% a B1+ result is capped at A2; if B2–C1 objective items are under 40% a C1 result is lowered to B2. Indicative placement only – not an official CEFR certificate.</p>`;}
$("startBands").innerHTML=bandsTable();
// ---------- speech (optional) ----------
let voice=null;function pickVoice(){const v=speechSynthesis.getVoices();voice=v.find(x=>/en[-_]GB/i.test(x.lang))||v.find(x=>/^en/i.test(x.lang))||null;}
const TTS=!!window.speechSynthesis;if(TTS){pickVoice();speechSynthesis.onvoiceschanged=pickVoice;}
function say(t,rate){if(!TTS||!t)return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="en-GB";if(voice)u.voice=voice;u.rate=rate||0.85;speechSynthesis.speak(u);}
// ---------- microphone (feature-detected, graceful) ----------
const hasGUM=!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
const hasMR=typeof window.MediaRecorder!=="undefined";
const canRecord=hasGUM&&hasMR;
function noRecReason(){if(!hasGUM)return window.isSecureContext===false?"this page is not allowed to use the microphone here (the browser needs https or a local file on a PC)":"this browser does not give web pages microphone access";if(!hasMR)return "this browser cannot record audio (on iPad, update to iPadOS 14.3 or newer)";return "";}
let micStream=null,micDenied=false,micErr="",micReq=null;
// Ask for the microphone ONCE per test session and keep the stream until the test ends (re-ask only if the track ended unexpectedly)
async function getMic(){if(micStream&&micStream.getAudioTracks().some(t=>t.readyState==="live"))return micStream;if(micReq)return micReq;if(!canRecord){micErr=noRecReason();return null;}
 micReq=micReqRun();try{return await micReq;}finally{micReq=null;}}
async function micReqRun(){
 try{micStream=await navigator.mediaDevices.getUserMedia({audio:true});micDenied=false;micErr="";}catch(e){micStream=null;micDenied=true;micErr=(e&&e.name==="NotAllowedError")?"permission was refused":(e&&e.name==="NotFoundError")?"no microphone was found":"the microphone could not be started ("+((e&&e.name)||"error")+")";}return micStream;}
function releaseMic(){if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;}}
window.addEventListener("pagehide",()=>{try{releaseMic();}catch(_){}});
// ---------- speech recognition (automatic marking; feature-detected) ----------
// ---------- robust speech recognition (shared module: test items + "Test speech recognition" button) ----------
// Default: plain recognition.start() – Chrome/Edge open their own microphone capture next to the MediaRecorder stream.
// Passing a MediaStreamTrack to start() is a new Chrome feature that can fail silently, so it is only tried once as a fallback.
const SR=window.SpeechRecognition||window.webkitSpeechRecognition||null;
const SR_LANGS=["en-US","en-GB","en"];
let SR_MODE_OK=null; // capture mode that produced words earlier in this session ("plain" or "track"), tried first next time
const SR_FATAL=new Set(["not-allowed","service-not-allowed","audio-capture","network","bad-grammar","start-failed"]);
function srErrMsg(c){return c==="not-allowed"||c==="service-not-allowed"?"Speech recognition was blocked. Click the microphone icon in the address bar, choose Allow, then try again.":
 c==="network"?"Speech recognition needs internet. Check the connection (Chrome/Edge use an online speech service).":
 c==="no-speech"?"No speech heard yet – speak a little louder and closer to the microphone.":
 c==="audio-capture"?"Speech recognition could not use the microphone. Check it is connected, not used by another app, and allowed in Windows Settings › Privacy › Microphone.":
 c==="language-not-supported"?"This browser's speech recognition does not support English here. Try Chrome or Edge.":
 c==="start-failed"?"Speech recognition could not start in this browser.":
 c==="keeps-stopping"?"Speech recognition keeps stopping. Check the internet connection and the microphone permission, then try again.":
 "Speech recognition problem ("+c+").";}
// microphone level meter on the shared stream (no new permission): used to tell "silent" from "recognition not working"
function srLevel(stream){const AC=window.AudioContext||window.webkitAudioContext;if(!AC||!stream)return null;
 try{const ctx=new AC(),src=ctx.createMediaStreamSource(stream),an=ctx.createAnalyser();an.fftSize=1024;src.connect(an);if(ctx.state==="suspended"&&ctx.resume)ctx.resume().catch(()=>{});
  const buf=new Float32Array(an.fftSize),L={level:0,speechMs:0,stop(){clearInterval(L.t);try{src.disconnect();}catch(_){}try{ctx.close();}catch(_){}}};
  L.t=setInterval(()=>{an.getFloatTimeDomainData(buf);let s=0;for(let k=0;k<buf.length;k++)s+=buf[k]*buf[k];const rms=Math.sqrt(s/buf.length);L.level=Math.min(1,rms*6);if(rms>0.02)L.speechMs+=100;},100);return L;}catch(e){return null;}}
// srListen({stream, onText(final,interim), onError(code,msg), onState(msg), onEnd(final,info)}) → controller {stop(), abort(), info}
function srListen(o){const C={final:"",interim:"",conf:[],active:true,stopping:false,done:false,mode:(SR_MODE_OK==="track"&&o.stream)?"track":"plain",retried:false,restarts:0,quick:0,lang:0,results:0,errors:[],err:"",errCode:"",fatal:false,t0:Date.now(),tFirst:null,tLast:null,rec:null,clone:null};
 const lm=srLevel(o.stream);C.lm=lm;
 const info=()=>({mode:C.mode,lang:SR_LANGS[C.lang],restarts:C.restarts,results:C.results,errors:C.errors.slice(0,10),error:C.err,error_code:C.errCode,retried_other_mode:C.retried,conf:C.conf,tFirst:C.tFirst,tLast:C.tLast,speech_ms:lm?lm.speechMs:null});
 const dropClone=()=>{if(C.clone){try{C.clone.stop();}catch(_){}C.clone=null;}};
 const commit=()=>{if(C.interim.trim()){C.final+=(C.final?" ":"")+C.interim.trim();}C.interim="";};
 function finish(){if(C.done)return;C.done=true;C.active=false;clearInterval(C.wd);clearTimeout(C.safety);clearTimeout(C.rt);if(lm)lm.stop();dropClone();commit();o.onEnd&&o.onEnd(C.final.trim(),info());}
 function fail(code){C.fatal=true;C.errCode=code;C.err=srErrMsg(code);C.errors.push(code);o.onError&&o.onError(code,C.err);}
 const canAlt=()=>C.mode==="track"||!!(o.stream&&o.stream.getAudioTracks().some(x=>x.readyState==="live"));
 function switchMode(msg){C.retried=true;C.mode=C.mode==="plain"?"track":"plain";C.modeSwitch=true;o.onState&&o.onState(msg);}
 function begin(){if(!C.active)return;let g;try{g=new SR();}catch(e){fail("start-failed");finish();return;}
  g.lang=SR_LANGS[C.lang];g.continuous=true;g.interimResults=true;g.maxAlternatives=1;C.rec=g;C.runT=Date.now();
  g.onresult=e=>{if(C.rec!==g)return;const now=Date.now();if(C.tFirst==null)C.tFirst=now;C.tLast=now;C.results++;SR_MODE_OK=C.mode;if(C.results===1&&o.onState)o.onState("");let it="";
   for(let k=e.resultIndex;k<e.results.length;k++){const a=e.results[k][0];if(e.results[k].isFinal){const t=String(a.transcript||"").trim();if(t)C.final+=(C.final?" ":"")+t;if(a.confidence>0)C.conf.push(a.confidence);}else it+=a.transcript;}
   C.interim=it;C.quick=0;o.onText&&o.onText(C.final,C.interim);};
  g.onerror=e=>{if(C.rec!==g)return;const c=(e&&e.error)||"error";if(c==="aborted")return;C.errors.push(c);
   if(c==="language-not-supported"&&C.lang<SR_LANGS.length-1){C.lang++;C.langSwitch=true;return;}
   if(c==="no-speech"){o.onState&&o.onState(srErrMsg(c));return;}
   // the other capture mode may work where this one cannot (e.g. own capture blocked but the shared track works, or vice versa)
   if((c==="audio-capture"||c==="not-allowed"||c==="service-not-allowed")&&!C.retried&&canAlt()){switchMode("Speech recognition could not use the microphone this way – trying another way…");return;}
   if(SR_FATAL.has(c)||c==="language-not-supported")fail(c);else{C.errCode=c;o.onState&&o.onState(srErrMsg(c));}};
  g.onend=()=>{if(C.rec!==g)return;C.rec=null;dropClone();commit();o.onText&&o.onText(C.final,"");
   if(C.active&&!C.stopping&&!C.fatal){const ran=Date.now()-C.runT;C.restarts++;C.quick=ran<1500&&!C.langSwitch&&!C.modeSwitch?C.quick+1:0;C.langSwitch=false;C.modeSwitch=false;
    if(C.quick>=2&&!C.results&&!C.retried&&canAlt()){switchMode("Speech recognition stopped at once – trying another way…");C.quick=0;C.modeSwitch=false;}
    if(C.quick>=4||C.restarts>40){fail("keeps-stopping");finish();return;}
    C.rt=setTimeout(begin,C.quick?400*C.quick:150);return;}   // restart after silence/time-out; back off if it keeps ending at once
   finish();};
  try{if(C.mode==="track"&&o.stream){const t=o.stream.getAudioTracks().find(x=>x.readyState==="live");if(!t)throw new Error("no live track");C.clone=t.clone();g.start(C.clone);}else g.start();}
  catch(e){dropClone();if(C.mode==="track"){C.mode="plain";try{g.start();return;}catch(e2){}}C.rec=null;fail("start-failed");finish();}}
 // watchdog: no words after ~8 s while the microphone level shows speech → retry ONCE in the other mode (with / without the shared track)
 C.wd=setInterval(()=>{if(!C.active||C.stopping||C.retried||C.results)return;const el=Date.now()-C.t0;
  if(el>=8000&&lm&&lm.speechMs>=1500){if(!canAlt())return;switchMode("No words recognised yet although the microphone hears sound – retrying speech recognition another way…");C.modeSwitch=false;const g=C.rec;C.rec=null;if(g){try{g.abort();}catch(_){}}dropClone();begin();}
  else if(el>=8000&&!C.hinted){C.hinted=true;o.onState&&o.onState(lm&&lm.speechMs<500?"The microphone hears almost nothing – check the microphone (Windows Settings › Privacy › Microphone) and speak closer.":"No words recognised yet – keep speaking clearly; check the internet connection if nothing appears.");}},500);
 begin();
 return{info,get done(){return C.done;},get final(){return C.final;},get level(){return lm?lm.level:null;},
  stop(){if(C.done||C.stopping)return;C.stopping=true;C.active=false;clearTimeout(C.rt);const g=C.rec;if(g){try{g.stop();}catch(_){C.rec=null;}}if(!C.rec){finish();return;}C.safety=setTimeout(()=>{const h=C.rec;C.rec=null;if(h){try{h.abort();}catch(_){}}finish();},3000);},
  abort(){if(C.done)return;C.stopping=true;C.active=false;const g=C.rec;C.rec=null;if(g){try{g.abort();}catch(_){}}finish();}};}
function srShow(el,fin,it){if(!el)return;const e=s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));el.innerHTML=(fin||it)?e(fin)+(it?` <span class="srInterim" style="color:#7a86a6">${e(it)}</span>`:""):"…";}
// "Test speech recognition" button (start screen): listens 5 s on the shared microphone and shows what it heard or the error
async function srSelfTest(btn,out,getStream){if(!SR){out.innerHTML="❌ <b>This browser has no speech recognition.</b> Use Chrome or Edge on a PC (with internet). The test still records voices, but reading/speaking will not be auto-scored.";return;}
 btn.disabled=true;let stream=null;try{stream=getStream?await getStream():null;}catch(_){}
 out.innerHTML="🎙 <b>Listening for 5 seconds…</b> say: <i>“Hello, my name is … and I am testing the microphone.”</i><div class='srLvl' style='height:10px;max-width:300px;background:#e6eaf4;border-radius:6px;overflow:hidden;margin:6px 0'><div style='height:100%;width:0;background:#137a2e'></div></div><div class='srHeard' style='font-style:italic'>…</div><div class='srState' style='color:#c62828'></div>";
 const heard=out.querySelector(".srHeard"),state=out.querySelector(".srState"),bar=out.querySelector(".srLvl div");let errMsg="";
 const c=srListen({stream,onText:(f,i)=>srShow(heard,f,i),onError:(code,m)=>{errMsg=m;state.textContent="❌ "+m;},onState:m=>{state.textContent=m;},
  onEnd:(fin,inf)=>{clearInterval(lt);btn.disabled=false;
   out.innerHTML=fin?`✅ <b>Speech recognition works.</b> It heard: <i>“${String(fin).replace(/[&<>]/g,"")}”</i>`:`❌ <b>Nothing was recognised.</b> ${errMsg||(inf.speech_ms!=null&&inf.speech_ms<500?"The microphone heard almost no sound – check the microphone and Windows microphone privacy settings.":"Check the internet connection and the microphone icon in the address bar (Allow), then try again.")}`;
   out.innerHTML+=`<div class="note" style="font-size:13px">Details: language ${inf.lang}, mode ${inf.mode}, restarts ${inf.restarts}, results ${inf.results}${inf.errors.length?", errors "+inf.errors.join("/"):""}${inf.speech_ms!=null?", sound detected "+(inf.speech_ms/1000).toFixed(1)+" s":""}.</div>`;}});
 const lt=setInterval(()=>{if(bar&&c.level!=null)bar.style.width=Math.round(c.level*100)+"%";},100);
 setTimeout(()=>c.stop(),5000);}
// Automatic-marking settings (also printed in the report and the answer key)
const AUTO={read:{acc:[90,75,50],wcpm:[100,75,45],pron:[85,70,50],confMix:.5,maxSecs:120},
 speak:{1:{secs:45,words:10,link:0,sub:0,ttr:.45},2:{secs:60,words:25,link:1,sub:0,ttr:.45},3:{secs:75,words:40,link:2,sub:1,ttr:.5},4:{secs:90,words:55,link:3,sub:2,adv:1,ttr:.55},5:{secs:90,words:70,link:4,sub:2,adv:2,ttr:.58}},
 minWords:3,offTopicShort:8,capShort:.25,extraSecs:30};
// Recognition listens to a copy of the SAME microphone track (Chrome/Edge 135+ need no second permission); older browsers ignore the track argument

function micLive(){return !!(micStream&&micStream.getAudioTracks().some(t=>t.readyState==="live"));}
function micStatus(){const a=!canRecord?`🎤 <b>Recording not available</b> – ${noRecReason()}.`:micStream?"🎤 <b>Microphone ready</b> – reading aloud and speaking answers are recorded for playback.":micDenied?`🎤 <b>Microphone not available</b> – ${micErr}. Reading aloud and speaking cannot be recorded or auto-scored (a teacher can use “Teacher override”).`:"🎤 Microphone recording is supported. The browser will ask once when the test starts – tap <b>Allow</b>. The microphone then stays on until the results are shown.";
 const b=SR?"🤖 <b>Automatic marking available</b> – speech recognition (English, en-US). In Chrome/Edge this needs an internet connection. Press <b>Test speech recognition</b> to check it on this PC.":"🤖 <b>Speech recognition is not available in this browser</b> – answers are still recorded for playback, but reading aloud and speaking are <b>not auto-scored</b> and the result will be provisional (use Copy for AI or a teacher check). Chrome or Edge on a PC is recommended.";
 $("micInfo").innerHTML=a+"<br>"+b;}
micStatus();
$("testSR").onclick=()=>srSelfTest($("testSR"),$("srTestOut"),async()=>canRecord?await getMic():null);
$("testMic").onclick=async()=>{if(!canRecord){toast("Recording is not available on this browser",3500);micStatus();return;}await getMic();micStatus();toast(micStream?"Microphone OK ✅":"Microphone not available",3500);};
let starting=false;
$("startBtn").onclick=async()=>{const n=$("sname").value.trim();if(!n){toast("Please type the student's name");$("sname").focus();return;}if(starting)return;starting=true;$("startBtn").disabled=true;
 if(canRecord){await getMic();}micStatus();
 student={name:n,info:$("sinfo").value.trim(),teacher:$("steacher").value.trim()};startTime=new Date();$("start").classList.add("hide");$("quiz").classList.remove("hide");show(0);};
// ---------- question display ----------
function answered(i){if(i>=N)return true;const q=Q[i];if(q.read||q.speak)return true;const a=answers[i];return a!==null&&a!=="";}
function setNext(){$("nextBtn").disabled=!answered(cur);}
function show(i){stopRec();if(TTS)speechSynthesis.cancel();cur=i;window.scrollTo(0,0);
 const box=$("qopts");box.innerHTML="";box.className="";$("playBtn").classList.add("hide");$("qshow").innerHTML="";
 $("bar").style.width=(i/N*100)+"%";$("backBtn").style.visibility=i?"visible":"hidden";
 if(i===N){buildSummary(box);$("nextBtn").textContent="Finish ✔";setNext();return;}
 const q=Q[i];$("qnum").textContent=`Question ${i+1} of ${N}`;$("qsec").textContent=SECTIONS[q.s];$("qlv").textContent=q.read&&q.lvl===5?"B2/C1":LV[q.lvl];
 $("qprompt").textContent=q.speak?`Read the question (or press 🔊 to hear it), then press 🎤 Record and answer in English. Speak for up to ${AUTO.speak[q.lvl].secs} seconds.`:q.prompt;
 if(q.show)$("qshow").innerHTML=`<div class="show sentence">${q.show}</div>`;
 if(q.err)$("qshow").innerHTML=`<div class="show sentence">${q.parts.map((p,k)=>`<u>${p}</u><sup style="color:#C8102E;font-weight:bold"> ${LET[k]}</sup>`).join(" ")}</div>`;
 if(q.pron&&TTS){$("playBtn").classList.remove("hide");$("playBtn").textContent="🔊 Hear the words (optional)";}
 if(q.speak&&TTS){$("playBtn").classList.remove("hide");$("playBtn").textContent="🔊 Play question (optional)";}
 if(q.typed)buildTyped(box,i);else if(q.read||q.speak)buildRecItem(box,q,i);else buildMCQ(box,q,i);
 $("nextBtn").textContent="Next ▶";setNext();}
function buildMCQ(box,q,i){box.className="opts";const opts=q.err?q.parts:q.o;
 opts.forEach((o,k)=>{const b=document.createElement("button");b.className="opt"+(answers[i]===k?" sel":"");b.innerHTML=`<span class="let">${LET[k]}</span> ${o}`;b.dataset.k=k;
  b.onclick=()=>{answers[i]=k;[...box.children].forEach(c=>c.classList.remove("sel"));b.classList.add("sel");setNext();};box.appendChild(b);});
 const d=document.createElement("button");d.className="opt dk"+(answers[i]===-1?" sel":"");d.textContent="? I don't know";d.dataset.k=-1;
 d.onclick=()=>{answers[i]=-1;[...box.children].forEach(c=>c.classList.remove("sel"));d.classList.add("sel");setNext();};box.appendChild(d);}
function buildTyped(box,i){const inp=document.createElement("input");inp.type="text";inp.id="tin";inp.className="tin";inp.autocomplete="off";inp.setAttribute("autocapitalize","off");inp.setAttribute("autocorrect","off");inp.spellcheck=false;inp.setAttribute("aria-label","Your answer");inp.placeholder="type here";
 inp.value=answers[i]&&answers[i]!=="?"?answers[i]:"";inp.oninput=()=>{answers[i]=inp.value.trim();setNext();};inp.onkeydown=e=>{if(e.key==="Enter"&&answered(cur))$("nextBtn").click();};box.appendChild(inp);
 const d=document.createElement("button");d.className="chip";d.style.cssText="display:block;margin:6px auto";d.textContent="? I don't know";d.dataset.k=-1;d.onclick=()=>{answers[i]="?";inp.value="";setNext();toast("Marked as “I don't know”");};box.appendChild(d);
 const h=document.createElement("p");h.className="note";h.style.textAlign="center";h.textContent="Use the device keyboard. One word only. Spelling counts (small spelling mistakes get ½ mark).";box.appendChild(h);}
function chipRow(vals,curv,onpick,labels){const w=document.createElement("span");vals.forEach((v,k)=>{const c=document.createElement("button");c.className="chip"+(curv===v?" sel":"");c.textContent=labels?labels[k]:v;c.dataset.v=v;
 c.onclick=()=>{[...w.children].forEach(x=>x.classList.remove("sel"));c.classList.add("sel");onpick(v);};w.appendChild(c);});return w;}
// ---------- reading aloud + speaking: record on the mic, recognise speech, mark automatically ----------
const fmtT=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");};
function limitOf(q){return q.speak?AUTO.speak[q.lvl].secs:AUTO.read.maxSecs;}
function buildRecItem(box,q,i){const r=REC[i]||(REC[i]={ov:{acc:null,flu:null,pro:null,mark:null},notes:""});const sp=!!q.speak;
 box.innerHTML=(sp?`<div class="target q">🗣️ “${q.target}”</div><p class="note" style="margin:8px 0 0;font-size:16px"><b>You could also talk about:</b></p><ul class="follow">${q.follow.map(x=>`<li>${x}</li>`).join("")}</ul>
  <p class="help">⏱ Suggested time: <b>up to ${limitOf(q)} seconds</b>. There is no single right answer – give a full answer with reasons and examples. If the question is too difficult, press Next.</p>`:`<div class="target" id="tgt">${q.target}</div>`)+`
 <div class="mic"><button class="btn" id="recBtn">🎤 ${sp?"Record my answer":"Record"}</button><button class="btn red hide" id="stopBtn">⏹ Stop</button><span id="recTime" class="timer"></span></div>
 <div class="tbar hide" id="tbar"><div id="tfill"></div></div>
 <div id="recStatus" class="note" style="text-align:center;font-size:16px"></div>
 <div class="lvl hide" id="lvl" title="microphone level"><div id="lvlFill"></div></div>
 <div id="srMsg" class="srmsg"></div>
 <div class="heard"><b>What the computer heard</b> <span class="note">(automatic speech recognition – approximate)</span><div class="trans" id="trans">–</div></div>
 <div id="player" style="text-align:center;margin:8px 0"></div>
 <details class="ovr" id="ovr"><summary>👩‍🏫 Teacher override (optional – not needed normally)</summary><div id="autoBox" class="note" style="font-size:15px;margin:4px 0 8px"></div><div id="ovMarks"></div>
 <label style="font-size:16px"><b>Teacher notes</b> (optional)<textarea class="notes" id="snotes" placeholder="${sp?"e.g. good range; past tense errors (go → went)":"e.g. drops final /t/; good phrasing"}"></textarea></label>
 ${sp?`<details><summary>Speaking rubric and example answer</summary><p>${SPEAK_RUB.map((d,k)=>`<b>${k}</b> = ${d}`).join("<br>")}</p><p class="note"><b>Example ${LV[q.lvl]} answer:</b> ${q.model}</p></details>`:`<p class="note">Listen for: ${q.focus}.</p>`}</details>`;
 const m=$("ovMarks");
 (sp?["mark"]:["acc","flu","pro"]).forEach(k=>{const row=document.createElement("div");row.className="mk";row.dataset.crit=k;row.innerHTML=`<span class="lab">${sp?"Mark (0–3)":READ_RUB[k].en}</span>`;
  const desc=document.createElement("span");desc.className="desc";const d=sp?SPEAK_RUB:READ_RUB[k].d;const sd=v=>desc.textContent=v==null?"auto = use the automatic estimate · 0 = "+d[0]+" · 3 = "+d[3]:"Override: "+v+" = "+d[v];
  row.appendChild(chipRow([null,0,1,2,3],r.ov[k],v=>{r.ov[k]=v;sd(v);},["auto",0,1,2,3]));sd(r.ov[k]);row.appendChild(desc);m.appendChild(row);});
 const n=$("snotes");n.value=r.notes||"";n.oninput=()=>{r.notes=n.value;};
 $("recBtn").onclick=()=>startRec(i);$("stopBtn").onclick=()=>stopRec();
 renderRec(i);}
function audioName(i,r){return `PlacementTest_${safe(student.name)}_Q${i+1}.${/mp4|aac|m4a/.test(r.mime||"")?"m4a":/ogg/.test(r.mime||"")?"ogg":"webm"}`;}
function renderRec(i){const r=REC[i],q=Q[i];if(cur!==i||!$("recStatus")||!r)return;const live=session&&session.i===i&&!session.stopping;
 $("trans").textContent=r.transcript||(live?"…":SR?"–":"– (speech recognition is not available in this browser)");
 $("player").innerHTML=r.url?`<audio controls playsinline preload="metadata" src="${r.url}"></audio> <a class="chip" style="display:inline-block;text-decoration:none" download="${audioName(i,r)}" href="${r.url}">⬇ Save</a><div class="note">Recording ${r.secs?Math.round(r.secs)+" s":""} – press ▶ to play it back.</div>`:"";
 const a=autoScore(i);$("autoBox").innerHTML=`<b>Automatic estimate:</b> ${autoLine(q,a)}<br>${esc(a.reason)}`;
 if(live)return;const st=$("recStatus");if($("srMsg"))$("srMsg").textContent=r.err?"⚠️ "+r.err:"";
 if(!canRecord&&!SR){$("recBtn").disabled=true;st.textContent=`Recording is not available here (${noRecReason()}). This item cannot be recorded or auto-scored – a teacher can listen live and use “Teacher override”, or press Next.`;return;}
 if(!r.attempted){st.innerHTML=(micDenied&&!micStream?`Microphone not available (${esc(micErr)}). Tap Record to try again. `:"")+(SR?"":"⚠️ Speech recognition is not available in this browser: your answer will be recorded but <b>not auto-scored</b>. ")+(q.speak?"Press 🎤 Record, answer the question, then press ⏹ Stop.":"Press 🎤 Record, read the text aloud, then press ⏹ Stop.");return;}
 if(!r.done){st.textContent="Saving…";return;}
 $("recBtn").textContent=q.speak?"🎤 Record again":"🎤 Record again";
 const rs=r.secs?` (${Math.round(r.secs)} s)`:"";
 st.innerHTML=a.status==="auto"?(r.transcript?`✅ Recorded${rs} and marked automatically. You can play it back, record again, or press Next.`:`⚠️ The computer did not hear any words${rs}. Check the microphone, speak clearly near the device, and press Record again.`):
  `✅ ${r.url?"Recorded"+rs:"Done"} – <b>not auto-scored</b> (${esc(a.reason)}). A teacher can check the recording, or use Copy for AI at the end.`;}
function autoLine(q,a){if(a.status==="na")return "not auto-scored";if(q.read)return `Accuracy ${a.marks.acc}/3 · Fluency ${a.marks.flu}/3 · Pronunciation ${a.marks.pro}/3 = ${a.marks.acc+a.marks.flu+a.marks.pro}/9`;return `${a.mark}/3`;}
let session=null;
async function startRec(i){stopRec();if(TTS)speechSynthesis.cancel();const r=REC[i],q=Q[i];
 const ms=canRecord?await getMic():null;
 if(!ms&&!SR){$("recStatus").textContent=`Microphone not available (${micErr||noRecReason()}). This item cannot be recorded or auto-scored.`;toast("No microphone",3500);return;}
 if(r.url)URL.revokeObjectURL(r.url);
 Object.assign(r,{attempted:true,done:false,transcript:"",conf:[],tFirst:null,tLast:null,secs:null,blob:null,url:null,mime:"",err:"",errCode:"",speechMs:null,srInfo:null,srUsed:!!SR,restarts:0});
 const S=session={i,t0:Date.now(),finalT:"",interimT:"",recog:null,recorder:null,stopping:false,finished:false,fatal:false,recDone:true,srDone:true,timer:null,safety:null};
 if(ms){const mt=["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/aac","audio/ogg"].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));let rec=null;
  try{rec=new MediaRecorder(ms,mt?{mimeType:mt}:undefined);}catch(e){try{rec=new MediaRecorder(ms);}catch(e2){rec=null;}}
  if(rec){const chunks=[];S.recorder=rec;S.recDone=false;rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
   rec.onstop=()=>{const b=new Blob(chunks,{type:rec.mimeType||mt||"audio/webm"});r.blob=b;r.mime=b.type;r.url=URL.createObjectURL(b);S.recDone=true;finishRec(S);};
   try{rec.start();}catch(e){S.recorder=null;S.recDone=true;}}}
 if(SR){S.srDone=false;startRecog(S);}
 if(!S.recorder&&S.srDone){session=null;r.done=true;r.err=r.err||"could not start recording";renderRec(i);return;}
 $("recBtn").classList.add("hide");$("stopBtn").classList.remove("hide");$("stopBtn").classList.add("rec");
 $("recStatus").textContent=q.speak?"🔴 Recording… answer the question now, then press Stop.":"🔴 Recording… read the text now, then press Stop.";$("trans").textContent="…";$("player").innerHTML="";$("srMsg").textContent="";$("lvl").classList.remove("hide");
 const lim=limitOf(q);if(q.speak)$("tbar").classList.remove("hide");
 const tick=()=>{const s=(Date.now()-S.t0)/1000;if(cur===i&&$("recTime")){$("recTime").textContent=q.speak?`${fmtT(s)} / ${fmtT(lim)}`:fmtT(s);$("recTime").classList.toggle("over",q.speak&&s>lim);
   if($("tfill"))$("tfill").style.width=Math.min(100,s/lim*100)+"%";if(q.speak&&s>lim)$("recStatus").textContent="⏱ Suggested time reached – finish your sentence and press Stop.";}
  if(s>=lim+(q.speak?AUTO.extraSecs:0))stopRec();};S.timer=setInterval(tick,250);tick();}
function startRecog(S){const r=REC[S.i];
 S.ctl=srListen({stream:micLive()?micStream:null,
  onText:(fin,it)=>{r.transcript=(fin+" "+it).trim();if(cur===S.i&&$("trans"))srShow($("trans"),fin,it);},
  onError:(c,m)=>{r.err=m;r.errCode=c;if(cur===S.i&&$("srMsg"))$("srMsg").textContent="⚠️ "+m;},
  onState:m=>{if(cur===S.i&&$("srMsg")&&!r.err)$("srMsg").textContent=m?"ℹ️ "+m:"";},
  onEnd:(fin,inf)=>{r.transcript=fin;r.conf=inf.conf;r.tFirst=inf.tFirst;r.tLast=inf.tLast;r.restarts=inf.restarts;r.speechMs=inf.speech_ms;r.srInfo={mode:inf.mode,lang:inf.lang,restarts:inf.restarts,results:inf.results,errors:inf.errors,retried_other_mode:inf.retried_other_mode};S.ctl=null;S.srDone=true;finishRec(S);}});
 S.lvT=setInterval(()=>{const b=$("lvlFill");if(b&&S.ctl&&S.ctl.level!=null)b.style.width=Math.round(S.ctl.level*100)+"%";},100);}
function stopRec(){const S=session;if(!S||S.stopping)return;S.stopping=true;clearInterval(S.timer);const r=REC[S.i];r.secs=(Date.now()-S.t0)/1000;
 if(S.recorder&&S.recorder.state!=="inactive"){try{S.recorder.stop();}catch(e){S.recDone=true;}}else S.recDone=true;
 clearInterval(S.lvT);if(S.ctl)S.ctl.stop();
 S.safety=setTimeout(()=>{if(S.finished)return;if(S.ctl){try{S.ctl.abort();}catch(_){}}S.srDone=true;S.recDone=true;finishRec(S);},4500);
 if(cur===S.i&&$("recBtn")){$("lvl").classList.add("hide");$("recBtn").classList.remove("hide");$("stopBtn").classList.add("hide");$("recTime").textContent="";$("tbar")&&$("tbar").classList.add("hide");}
 finishRec(S);}
function finishRec(S){if(S.finished||!S.stopping||!S.recDone||!S.srDone)return;S.finished=true;clearInterval(S.lvT);clearTimeout(S.safety);if(session===S)session=null;
 const r=REC[S.i];r.transcript=r.transcript||"";r.done=true;renderRec(S.i);}
const waitIdle=()=>new Promise(res=>{const t0=Date.now();const w=()=>(!session||Date.now()-t0>5000)?res():setTimeout(w,100);w();});
// ---------- automatic marking ----------
const th3=(v,t)=>v>=t[0]?3:v>=t[1]?2:v>=t[2]?1:0;
const NUMW="zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
const SPELL={center:"centre",centers:"centres",color:"colour",colors:"colours",traveling:"travelling",traveled:"travelled",program:"programme",programs:"programmes"};
function canon(w){if(/^0+$/.test(w)&&w.length>1)return "";if(/^\d+$/.test(w)&&+w<=20)return NUMW[+w];w=SPELL[w]||w;return w.replace(/iz(e|es|ed|ing|ation|ations)$/,"is$1");}
function rTok(s){return String(s||"").toLowerCase().replace(/[’‘`']/g,"").replace(/[-–—\/]/g," ").replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter(Boolean).map(canon).filter(Boolean);}
function mergeCompounds(h,tset){const o=[];for(let k=0;k<h.length;k++){if(k+1<h.length&&!tset.has(h[k])&&tset.has(h[k]+h[k+1])){o.push(h[k]+h[k+1]);k++;}else o.push(h[k]);}return o;}
// word-level Levenshtein alignment (target passage vs transcript) with back-trace
function align(t,h){const n=t.length,m=h.length,D=[...Array(n+1)].map(()=>new Array(m+1).fill(0));
 for(let a=0;a<=n;a++)D[a][0]=a;for(let b=0;b<=m;b++)D[0][b]=b;
 for(let a=1;a<=n;a++)for(let b=1;b<=m;b++)D[a][b]=Math.min(D[a-1][b-1]+(t[a-1]===h[b-1]?0:1),D[a-1][b]+1,D[a][b-1]+1);
 const ops=[];let a=n,b=m;
 while(a>0||b>0){if(a>0&&b>0&&D[a][b]===D[a-1][b-1]+(t[a-1]===h[b-1]?0:1)){ops.push({op:t[a-1]===h[b-1]?"ok":"sub",t:t[a-1],h:h[b-1],ti:a-1});a--;b--;}
  else if(a>0&&D[a][b]===D[a-1][b]+1){ops.push({op:"del",t:t[a-1],ti:a-1});a--;}else{ops.push({op:"ins",h:h[b-1]});b--;}}
 return{dist:D[n][m],ops:ops.reverse()};}
function readScore(target,transcript,secs,conf){const t=rTok(target),h=mergeCompounds(rTok(transcript),new Set(t)),N=t.length;
 const {ops}=align(t,h);let ok=0,near=0,sub=0,del=0,ins=0;const hit=new Array(N).fill(0),errors=[];
 ops.forEach(o=>{if(o.op==="ok"){ok++;hit[o.ti]=1;}else if(o.op==="sub"){if(o.t.length>=4&&lev(o.t,o.h)<=1){near++;hit[o.ti]=.5;errors.push(`${o.t}→${o.h} (½)`);}else{sub++;errors.push(`${o.t}→${o.h}`);}}
  else if(o.op==="del"){del++;errors.push(`${o.t}→(missed)`);}else{ins++;errors.push(`(+${o.h})`);}});
 const correct=ok+.5*near,acc=N?correct/N*100:0,mins=(secs||0)/60,wcpm=mins>0?correct/mins:0,wpm=mins>0?h.length/mins:0;
 const pron=conf!=null?(1-AUTO.read.confMix)*acc+AUTO.read.confMix*conf*100:acc;
 let marks={acc:0,flu:0,pro:0},reason="no words were recognised → 0/9";
 if(h.length){marks={acc:th3(acc,AUTO.read.acc),flu:th3(wcpm,AUTO.read.wcpm),pro:th3(pron,AUTO.read.pron)};let cap="";
  if(marks.flu>marks.acc+1){marks.flu=marks.acc+1;cap=" (capped at accuracy + 1)";}
  reason=`word accuracy ${f(acc)}% of ${N} words (${ok} exact${near?", "+near+" near-miss ½":""}; ${sub} wrong, ${del} missed, ${ins} extra) → accuracy ${marks.acc}; ${Math.round(wcpm)} correct words/min over ${f(secs)} s → fluency ${marks.flu}${cap}; pronunciation proxy ${Math.round(pron)}% (${conf!=null?"½ word accuracy + ½ recognition confidence "+pc(conf)+"%":"word accuracy only – no confidence value"}) → pronunciation ${marks.pro}`;}
 return{marks,acc:Math.round(acc*10)/10,N,ok,near,sub,del,ins,heard:h.length,secs,wcpm:Math.round(wcpm),wpm:Math.round(wpm),conf,pron:Math.round(pron),hit,errors:errors.slice(0,40),reason};}
const FILL=new Set(["um","uh","er","erm","hmm","mm","ah","eh"]);
function sTok(s){return String(s||"").toLowerCase().replace(/[’‘`]/g,"'").replace(/[^a-z0-9' ]+/g," ").split(/\s+/).map(x=>x.replace(/^'+|'+$/g,"")).filter(x=>x&&!FILL.has(x));}
const LINKERS=["and","but","or","so","because","then","also","after","before","when","while","if","although","though","however","whereas","which","who","that","since","unless","until","therefore","moreover","furthermore","besides","instead","otherwise","nevertheless","meanwhile","firstly","finally","actually","especially","even though","for example","for instance","on the other hand","in addition","as a result","in my opinion","i think","i believe","rather than","as well as","not only","so that","in fact","overall","on the whole","to be honest","whether"];
const ADVLINK=["although","though","however","whereas","therefore","moreover","furthermore","nevertheless","on the other hand","even though","as a result","in addition","rather than","unless","whether","not only","in fact","otherwise","instead","overall","on the whole"];
const SUBORD=["because","when","while","if","although","though","whereas","which","who","whose","since","unless","until","so that","even though","whether","where","that","as soon as","in case"];
const IRR=new Set("went was were had did saw ate took got made came gave found felt thought bought brought told said left met paid flew drove swam began broke lost spent kept slept sat stood ran wrote knew became chose forgot understood heard sent taught caught built won fell grew rode woke".split(" "));
const PPART=new Set("been done gone seen taken made had got given known written become eaten broken chosen forgotten spoken found thought bought brought told said left met paid flown driven begun lost spent kept understood heard sent taught caught built won fallen grown".split(" "));
const NOTED=new Set("need feed speed seed bed red shed indeed exceed proceed succeed hundred bred breed weed".split(" "));
const NOTING=new Set("morning evening thing something anything nothing everything building ceiling king ring sing bring spring string during".split(" "));
const BE=new Set(["am","is","are","was","were","be","been","being","i'm","you're","we're","they're","he's","she's","it's","there's","that's"]);
const HAVE=new Set(["have","has","had","i've","we've","you've","they've","haven't","hasn't","hadn't"]);
const MODAL=new Set(["can","could","should","might","must","may","would","can't","cannot","couldn't","shouldn't","wouldn't","mustn't"]);
const PRES=new Set(["am","is","are","i'm","you're","we're","they're","it's","he's","she's","there's","that's","do","does","don't","doesn't","isn't","aren't","like","live","work","think","want","need","usually","always","often"]);
const isPast=x=>IRR.has(x)||(/^[a-z]{3,}ed$/.test(x)&&!NOTED.has(x));
const isPP=x=>PPART.has(x)||(/^[a-z]{3,}ed$/.test(x)&&!NOTED.has(x));
function verbForms(w){const F=new Set();w.forEach((x,k)=>{const p=w[k-1]||"",nx=w[k+1]||"",nx2=w[k+2]||"";
 if(PRES.has(x)||(["i","you","we","they"].includes(p)&&/^[a-z]+$/.test(x)&&!isPast(x)&&!MODAL.has(x)&&!["will","would","had","did"].includes(x)))F.add("present");
 if(isPast(x)&&!HAVE.has(p)&&!BE.has(p)&&!(["just","already","never","ever"].includes(p)&&HAVE.has(w[k-2]||"")))F.add("past");
 if(x==="was"||x==="were"||x==="didn't"||x==="wasn't"||x==="weren't")F.add("past");
 if(x==="will"||x==="won't"||/'ll$/.test(x)||x==="gonna"||(x==="going"&&nx==="to"&&BE.has(p)))F.add("future");
 if(HAVE.has(x)&&(isPP(nx)||(["just","already","never","ever","not","recently","always"].includes(nx)&&isPP(nx2))))F.add("perfect");
 if(/'ve$/.test(x)&&isPP(nx))F.add("perfect");
 if(BE.has(x)&&/^[a-z]{3,}ing$/.test(nx)&&!NOTING.has(nx))F.add("continuous");
 if(BE.has(x)&&isPP(nx)&&x!=="had")F.add("passive");
 if(MODAL.has(x)||/'d$/.test(x))F.add("modal");
 if(x==="if")F.add("conditional");});
 return ["present","past","future","perfect","continuous","passive","modal","conditional"].filter(x=>F.has(x));}
function speakScore(q,text){const L=AUTO.speak[q.lvl],c=q.auto,w=sTok(text),n=w.length;
 const base={mark:0,pts:0,words:n,target_words:L.words,topic_words:[],ttr:null,linkers:[],subordinate:[],verb_forms:[]};
 if(n<AUTO.minWords)return{...base,reason:n?`only ${n} word${n>1?"s":""} recognised (minimum ${AUTO.minWords}) → 0/3`:"no words recognised → 0/3"};
 const J=" "+w.join(" ")+" ",plain=w.map(x=>x.replace(/'/g,""));
 const hits=c.kw.filter(k=>k.includes(" ")?J.includes(" "+k+" "):plain.some(x=>x===k||(k.length>=4&&x.startsWith(k)&&x.length-k.length<=3)));
 const lenP=n>=L.words?2:n>=L.words/2?1:0,relP=hits.length>=c.kn?1:0;
 const smp=w.slice(0,50),ttr=new Set(smp).size/smp.length,varP=ttr>=L.ttr?1:0;
 const links=LINKERS.filter(p=>J.includes(" "+p+" ")),subs=SUBORD.filter(p=>J.includes(" "+p+" ")),adv=ADVLINK.filter(p=>J.includes(" "+p+" ")),cxP=links.length>=L.link&&subs.length>=L.sub&&adv.length>=(L.adv||0)?1:0;
 const F=verbForms(w),tnP=F.length>=c.tn&&c.need.every(x=>F.includes(x))?1:0;
 const pts=lenP+relP+varP+cxP+tnP;let mark=pts>=5?3:pts>=3?2:1;const caps=[];
 if(mark===3&&lenP<2){mark=2;caps.push(`3 needs at least ${L.words} words → 2`);}
 if(!hits.length){if(n<AUTO.offTopicShort){mark=0;caps.push("short and no topic words → 0");}else if(mark>1){mark=1;caps.push("no topic words, may be off-topic → max 1");}}
 if(n<L.words*AUTO.capShort&&mark>1){mark=1;caps.push(`under ${Math.ceil(L.words*AUTO.capShort)} words → max 1`);}
 const reason=`${n} words (target ${L.words}+ → ${lenP}/2); topic words ${hits.length} (need ${c.kn}${hits.length?": "+hits.slice(0,6).join(", "):""}) → ${relP}; variety ${ttr.toFixed(2)} type/token (need ${L.ttr}) → ${varP}; linkers ${links.length}${links.length?" ("+links.slice(0,6).join(", ")+")":""}, subordinate ${subs.length}${L.adv?`, advanced ${adv.length}`:""} (need ${L.link}/${L.sub}${L.adv?"/"+L.adv:""}) → ${cxP}; verb forms ${F.join(", ")||"none"} (need ${c.tn}${c.need.length?" incl. "+c.need.join("+"):""}) → ${tnP}; points ${pts}/6 → ${mark}/3${caps.length?" ["+caps.join("; ")+"]":""}`;
 return{mark,pts,words:n,target_words:L.words,topic_words:hits,ttr:Math.round(ttr*100)/100,linkers:links,subordinate:subs,advanced_linkers:adv,verb_forms:F,points:{length:lenP,relevance:relP,variety:varP,complexity:cxP,verb_forms:tnP},reason};}
function speechSecs(r){const rec=r.secs||0;if(r.tFirst&&r.tLast&&r.tLast>r.tFirst){const s=(r.tLast-r.tFirst)/1000+1;return Math.round(Math.min(rec||s,Math.max(1,s))*10)/10;}return Math.round(rec*10)/10;}
function meanConf(r){const c=(r.conf||[]).filter(x=>x>0);return c.length?c.reduce((a,b)=>a+b,0)/c.length:null;}
function autoScore(i){const q=Q[i],r=REC[i]||{};
 if(!r.attempted)return (canRecord||SR)?{status:"none",marks:{acc:0,flu:0,pro:0},mark:0,reason:"no answer recorded – counts 0"}:{status:"na",reason:"recording and speech recognition are not available on this device"};
 if(!r.done)return{status:"na",reason:"recording in progress"};
 if(!r.srUsed)return{status:"na",reason:"speech recognition not available in this browser – recorded only"};
 if(!r.transcript&&r.err)return{status:"na",reason:r.err};
 if(!r.transcript&&r.speechMs!=null&&r.speechMs>=1500)return{status:"na",reason:"the microphone picked up speech but speech recognition returned no words – check internet and permissions (use “Test speech recognition” on the start screen)"};
 const a=q.read?readScore(q.target,r.transcript,speechSecs(r),meanConf(r)):speakScore(q,r.transcript);a.status="auto";if(r.err)a.reason+=` (warning: ${r.err})`;return a;}
// ---------- end screen (optional teacher descriptors, collapsed) ----------
function missingRec(){return Q.map((q,i)=>(q.read||q.speak)&&!(REC[i]&&REC[i].attempted)?"Q"+(i+1):null).filter(Boolean);}
function buildSummary(box){$("qnum").textContent="End of the test";$("qsec").textContent="Finished";$("qlv").textContent="✔";
 $("qprompt").textContent="Well done – you have finished the test! Press Finish ✔ to see the report.";const m=missingRec();
 box.innerHTML=`${m.length?`<p class="help">Not recorded (count 0 unless a teacher overrides): ${m.join(", ")}. Press ◀ Back if you want to record them.</p>`:""}
 <details class="ovr"><summary>👩‍🏫 Teacher override: CEFR speaking descriptors and notes (optional)</summary>
 <p class="note">Only if a teacher has listened to the student. These holistic ratings (paraphrased CEFR-style descriptors) are weighed into the speaking and pronunciation indications in the report. Leave “–” if not sure.</p><div id="crit"></div>
 <label style="font-size:16px"><b>General teacher notes</b> (included in the report)<textarea class="notes" id="gnotes" placeholder="e.g. confident, good vocabulary for work; needs past tenses and final consonants"></textarea></label></details>`;
 const cbox=$("crit");CRIT.forEach(c=>{const row=document.createElement("div");row.className="mk";row.dataset.crit=c.k;row.innerHTML=`<span class="lab">${c.en}</span>`;const desc=document.createElement("span");desc.className="desc";
  const sd=v=>desc.textContent=v==null?"Not rated.":LV[v]+": "+c.d[v];
  row.appendChild(chipRow([null,0,1,2,3,4,5],PROF[c.k],v=>{PROF[c.k]=v;sd(v);},["–",...LV]));sd(PROF[c.k]);row.appendChild(desc);cbox.appendChild(row);});
 const g=$("gnotes");g.value=PROF.notes;g.oninput=()=>{PROF.notes=g.value;};}
$("playBtn").onclick=()=>{const q=Q[cur];if(!q)return;if(q.speak)say(q.target,0.9);else if(q.say)say(q.say,0.8);};
$("backBtn").onclick=()=>{if(cur>0)show(cur-1);};
$("nextBtn").onclick=async()=>{if(!answered(cur))return;if(cur<N)show(cur+1);else{stopRec();await waitIdle();const m=missingRec();
 if(confirm(m.length?`Finish the test? Not recorded (counted as 0): ${m.join(", ")}.`:"Finish the test and show the report?"))finish();}};
function notScored(){return R?R.details.filter(d=>d.scored===false).map(d=>`Q${d.q}`):[];}
// ---------- marking ----------
const norm=v=>(v||"").toLowerCase().replace(/[’‘`]/g,"'").replace(/[^a-z' -]/g,"").replace(/\s+/g," ").trim();
function lev(a,b){const m=[...Array(a.length+1)].map((_,i)=>[i]);for(let j=1;j<=b.length;j++)m[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return m[a.length][b.length];}
function markTyped(q,raw){const a=norm(raw);if(!a||a==="?")return{credit:0,note:raw==="?"?"I don't know":"no answer"};
 if(a===q.ans||(q.accept||[]).includes(a))return{credit:1,note:"correct"};
 if(q.alt&&q.alt[a]!==undefined)return{credit:q.alt[a][0],note:q.alt[a][1]};
 if(a.replace(/[ -]/g,"")===q.ans.replace(/[ -]/g,""))return{credit:1,note:"correct (spacing ignored)"};
 if(q.ans.length>=5&&lev(a,q.ans)===1)return{credit:.5,note:"one letter wrong (near miss)"};
 return{credit:0,note:"incorrect"};}
function median(a){const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor((s.length-1)/2)]:null;}
const SRC_TH={"automatic estimate":"ประเมินอัตโนมัติ","teacher override":"ครูปรับคะแนน","no answer – 0":"ไม่ได้บันทึกคำตอบ – 0","not auto-scored":"ตรวจอัตโนมัติไม่ได้"};
function recInfo(i){const r=REC[i]||{};return{recording:!!r.url,recording_seconds:r.secs?Math.round(r.secs):null,recording_type:r.mime||null,recording_file:r.url?audioName(i,r):null,speech_recognition:r.attempted?(r.srUsed?(r.err?"used – "+r.err:"used"):"not available"):null,recognition_restarts:r.restarts||0,recognition_details:r.srInfo||null};}
function compute(){const det=[];
 Q.forEach((q,i)=>{const base={q:i+1,section:SECTIONS[q.s],level:LV[q.lvl],lvl:q.lvl,skill:q.skill,th:q.th};let d;
  if(q.typed){const m=markTyped(q,answers[i]);d={...base,type:"gap-fill (typed)",question:q.show,answer:answers[i]==="?"?"(I don't know)":answers[i]||"",correct_answer:q.ans+(q.accept?" (also: "+q.accept.join(", ")+")":""),credit:m.credit,out_of:1,note:m.note};}
  else if(q.read){const r=REC[i]||{},ov=r.ov||{},a=autoScore(i),am=a.marks||{};const K=["acc","flu","pro"];
   const m={};K.forEach(k=>m[k]=ov[k]!=null?ov[k]:a.status!=="na"?am[k]:null);const scored=K.every(k=>m[k]!=null),ovU=K.some(k=>ov[k]!=null);
   const src=ovU?"teacher override":a.status==="auto"?"automatic estimate":a.status==="none"?"no answer – 0":"not auto-scored";
   d={...base,type:"read aloud",question:q.target,transcript:r.transcript||"",marks:{accuracy:m.acc,fluency:m.flu,pronunciation:m.pro},
    auto:a.status==="na"?{status:"not auto-scored",reason:a.reason}:{status:a.status==="auto"?"automatic estimate":"no answer",marks:{accuracy:am.acc,fluency:am.flu,pronunciation:am.pro},word_accuracy_pct:a.acc??null,words_in_passage:a.N??null,words_heard:a.heard??0,exact:a.ok,near_misses:a.near,wrong:a.sub,missed:a.del,extra:a.ins,speech_seconds:a.secs??null,correct_words_per_min:a.wcpm??null,words_per_min:a.wpm??null,recognition_confidence:a.conf==null?null:Math.round(a.conf*100)/100,pronunciation_proxy_pct:a.pron??null,word_errors:a.errors||[],reason:a.reason},
    override:ovU,...recInfo(i),credit:scored?m.acc+m.flu+m.pro:0,out_of:9,scored,complete:scored,source:src,notes:r.notes||"",note:src};}
  else if(q.speak){const r=REC[i]||{},ov=r.ov||{},a=autoScore(i);const mk=ov.mark!=null?ov.mark:a.status!=="na"?a.mark:null;const scored=mk!=null,ovU=ov.mark!=null;
   const src=ovU?"teacher override":a.status==="auto"?"automatic estimate":a.status==="none"?"no answer – 0":"not auto-scored";
   d={...base,type:"speaking (recorded)",question:q.target,answer:r.transcript||"",transcript:r.transcript||"",mark:mk,auto_mark:a.status==="na"?null:a.mark,
    auto:a.status==="na"?{status:"not auto-scored",reason:a.reason}:{status:a.status==="auto"?"automatic estimate":"no answer",mark:a.mark,words:a.words??0,target_words:a.target_words??AUTO.speak[q.lvl].words,topic_words:a.topic_words||[],type_token_ratio:a.ttr??null,linkers:a.linkers||[],subordinate:a.subordinate||[],verb_forms:a.verb_forms||[],points:a.points||null,reason:a.reason},
    suggested_seconds:AUTO.speak[q.lvl].secs,override:ovU,...recInfo(i),notes:r.notes||"",credit:mk||0,out_of:3,scored,complete:scored,source:src,note:src};}
  else{const opts=q.err?q.parts:q.o;const a=answers[i];d={...base,type:q.err?"error spotting":q.trans?"transformation (MCQ)":q.pron?"pronunciation (MCQ)":"multiple choice",question:q.err?q.parts.map((p,k)=>p+" ("+LET[k]+")").join(" "):(q.show||q.prompt).replace(/<[^>]+>/g," "),
   answer:a===-1?"(I don't know)":a==null?"":LET[a]+") "+opts[a],correct_answer:LET[q.ans]+") "+opts[q.ans],credit:a===q.ans?1:0,out_of:1,note:a===q.ans?"correct":a===-1?"I don't know":"incorrect"};}
  d.correct=d.credit===d.out_of;det.push(d);});
 const secs=SECTIONS.map((n,s)=>{const d=det.filter(x=>Q[x.q-1].s===s),sd=d.filter(x=>x.scored!==false);const score=sd.reduce((a,x)=>a+x.credit,0),out=sd.reduce((a,x)=>a+x.out_of,0),full=d.reduce((a,x)=>a+x.out_of,0);
  const am=s>=3,ns=d.length-sd.length,ovN=d.filter(x=>x.override).length;
  return{section:n,questions:SECQ[s],count:d.length,score,out_of:out,full_out_of:full,pct:out?score/out:0,weight:WEIGHT[s],points:out?score/out*WEIGHT[s]:0,
   marked_by:am?(out>0?"automatic estimate"+(ovN?` + teacher override (${ovN})`:""):"not auto-scored (recorded only)"):"automatic",not_scored:ns,incomplete:ns,any_marked:out>0,included:out>0};});
 const incW=secs.filter(s=>s.included).reduce((a,s)=>a+s.weight,0);
 let total=secs.reduce((a,s)=>a+s.points,0)*100/incW;
 const ns=det.filter(x=>x.scored===false).map(x=>"Q"+x.q),excl=secs.filter(s=>!s.included);const provisional=ns.length>0;
 const basis=!provisional?"all five sections; reading aloud and speaking are automatic estimates":excl.length?`provisional – ${excl.map(s=>s.section.toLowerCase()).join(" and ")} could not be auto-scored, so the other sections are re-weighted to 100`:`provisional – ${ns.join(", ")} could not be auto-scored, so those sections use the scored items only`;
 const basisTH=!provisional?"คิดจากทั้ง 5 ส่วน โดยการอ่านออกเสียงและการพูดเป็นคะแนนประเมินอัตโนมัติ":excl.length?`เป็นผลเบื้องต้น – ส่วน${excl.map(s=>SEC_TH[SECTIONS.indexOf(s.section)]).join(" และ ")}ตรวจอัตโนมัติไม่ได้ จึงคิดจากส่วนอื่นแล้วปรับน้ำหนักเป็น 100`:`เป็นผลเบื้องต้น – ข้อ ${ns.join(", ")} ตรวจอัตโนมัติไม่ได้ จึงคิดคะแนนส่วนนั้นจากข้อที่ตรวจได้เท่านั้น`;
 total=Math.round(total*10)/10;
 const prof=(lo,hi)=>{const d=det.filter(x=>Q[x.q-1].s<=2&&x.lvl>=lo&&x.lvl<=hi);const sc=d.reduce((a,x)=>a+x.credit,0);return{score:sc,out_of:d.length,pct:d.length?sc/d.length:0};};
 const P={A1_A2:prof(1,2),B1:prof(3,3),B2_C1:prof(4,5)};
 const byScore=bandIdx(total);let bi=byScore;const adj=[];
 if(bi>=3&&P.A1_A2.pct<.6){bi=2;adj.push({en:"A1–A2 objective items under 60%, so the result is capped at A2",th:"ทำข้อระดับ A1–A2 ได้ต่ำกว่า 60% จึงจำกัดผลไว้ที่ระดับ A2"});}
 if(bi===5&&P.B2_C1.pct<.4){bi=4;adj.push({en:"B2–C1 objective items under 40%, so a C1 result is lowered to B2",th:"ทำข้อระดับ B2–C1 ได้ต่ำกว่า 40% จึงปรับผลจาก C1 เป็น B2"});}
 // per-skill indications
 const ra=det.filter(x=>x.type==="read aloud"&&x.scored);const readPro=ra.reduce((a,x)=>a+(x.marks.pronunciation||0),0);
 const pronPct=(secs[2].score+readPro)/(6+3*ra.length);
 const rated=CRIT.filter(c=>PROF[c.k]!=null);const descMed=rated.length?median(rated.filter(c=>c.k!=="pronunciation").map(c=>PROF[c.k])):null;
 const skills=[];
 skills.push({skill:"Vocabulary (range)",th:"คำศัพท์",level:bandIdx(secs[0].pct*100),basis:`Q1–10: ${pc(secs[0].pct)}%`});
 skills.push({skill:"Grammar (accuracy)",th:"ไวยากรณ์",level:bandIdx(secs[1].pct*100),basis:`Q11–22: ${pc(secs[1].pct)}%`});
 let pl=bandIdx(pronPct*100);let pb=`Q23–28 + automatic read-aloud pronunciation estimates: ${pc(pronPct)}%`;
 if(!ra.length){pl=bandIdx(secs[2].pct*100);pb=`Q23–28 only: ${pc(secs[2].pct)}% (reading aloud not scored)`;}
 if(PROF.pronunciation!=null){pl=Math.round((pl+PROF.pronunciation)/2);pb+=`; teacher descriptor ${LV[PROF.pronunciation]}`;}
 skills.push({skill:"Pronunciation",th:"การออกเสียง",level:pl,basis:pb});
 skills.push({skill:"Reading aloud (accuracy, fluency, pronunciation)",th:"การอ่านออกเสียง",level:secs[3].included?bandIdx(secs[3].pct*100):null,basis:secs[3].included?`Q29–31 (automatic estimate): ${f(secs[3].score)}/${secs[3].out_of} = ${pc(secs[3].pct)}%`:"not auto-scored"});
 let sl=secs[4].included?bandIdx(secs[4].pct*100):null,sb=secs[4].included?`Q32–35 (automatic estimate): ${f(secs[4].score)}/${secs[4].out_of} = ${pc(secs[4].pct)}%`:"not auto-scored";
 if(descMed!=null){sl=sl==null?descMed:Math.round((sl+descMed)/2);sb+=`; teacher descriptors (median) ${LV[descMed]}`;}
 skills.push({skill:"Speaking (range, accuracy, fluency, coherence)",th:"การพูด",level:sl,basis:sb});
 if(descMed!=null&&Math.abs(descMed-bi)>=2)adj.push({en:`note: the teacher's holistic speaking judgement (${LV[descMed]}) differs from the overall result by two or more levels – please review`,th:`หมายเหตุ: การประเมินการพูดโดยรวมของครู (${LV[descMed]}) ต่างจากผลรวมตั้งแต่ 2 ระดับขึ้นไป ควรพิจารณาอีกครั้ง`});
 return{test:"English Placement Test – Adults (CEFR A1–C1), 35 questions",school:"London Centre of English Language School",student,date:startTime.toISOString(),finished:new Date().toISOString(),
  total,out_of:100,basis,basis_th:basisTH,provisional,not_scored:ns,score_band:LV[byScore],cefr:LV[bi],cefr_index:bi,adjustments:adj,objective_score:secs.slice(0,3).reduce((a,s)=>a+s.score,0),objective_out_of:OBJ,
  level_profile:P,sections:secs,skills,descriptors:Object.fromEntries(CRIT.map(c=>[c.k,PROF[c.k]==null?null:LV[PROF[c.k]]])),teacher_notes:PROF.notes,unmarked:ns,
  speech_recognition:SR?"available (English, en-US)":"not available in this browser",recording:canRecord?"available":"not available",
  auto_marking:{reading_aloud:{accuracy_pct_for_3_2_1:AUTO.read.acc,correct_words_per_min_for_3_2_1:AUTO.read.wcpm,pronunciation_proxy_pct_for_3_2_1:AUTO.read.pron,pronunciation_proxy:"50% word accuracy + 50% recognition confidence (word accuracy only if no confidence)",fluency_cap:"fluency at most accuracy + 1"},speaking:{level_targets:AUTO.speak,points:"length 0–2, relevance 0–1, variety 0–1, complexity 0–1, verb forms 0–1 → 5–6 = 3 (only if the target length is reached, otherwise 2), 3–4 = 2, 0–2 = 1; under 3 words = 0; short with no topic words = 0; no topic words → max 1; under 25% of target words → max 1"}},
  bands:BANDS.map(b=>({level:b[2],from:b[0],to:b[1]})),weights:Object.fromEntries(SECTIONS.map((s,k)=>[s,WEIGHT[k]])),details:det,
  disclaimer:"Indicative placement only – not an official CEFR certificate. Reading-aloud and speaking marks are automatic estimates from speech recognition."};}
// ---------- reports ----------
function list(a){return a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1];}
function listTH(a){return a.length<2?a.join(""):a.slice(0,-1).join(", ")+" และ "+a[a.length-1];}
const RA_TIP={acc:["reading accuracy with longer words (decoding multi-syllable words)","ความถูกต้องในการอ่านคำยาว ๆ (การแยกพยางค์)"],flu:["reading fluency – reading in chunks and pausing at punctuation","ความคล่องในการอ่าน – อ่านเป็นกลุ่มคำและหยุดตามเครื่องหมายวรรคตอน"],pro:["pronunciation – final consonants, consonant clusters, -ed endings and word stress (common for Thai speakers)","การออกเสียง – เสียงพยัญชนะท้ายคำ เสียงควบกล้ำ เสียงท้าย -ed และการเน้นเสียงในคำ (ปัญหาที่พบบ่อยของผู้เรียนชาวไทย)"]};
function dateStr(d){return new Date(d).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});}
function dateTH(d){try{return new Date(d).toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"});}catch(e){return dateStr(d);}}
function analyse(R){const s=R.sections,bi=R.cefr_index;
 const strong=s.filter(x=>x.any_marked&&x.pct>=.7);const weak=s.filter(x=>x.any_marked&&x.pct<.5);
 const missed=R.details.filter(d=>Q[d.q-1].s<=2&&!d.correct&&d.lvl<=Math.max(bi,1)).slice(0,8);
 const ra=R.details.filter(d=>d.type==="read aloud");const raW=[];["acc","flu","pro"].forEach((k,j)=>{const key=["accuracy","fluency","pronunciation"][j];const v=ra.map(d=>d.marks[key]).filter(x=>x!=null);if(v.length&&v.reduce((a,b)=>a+b,0)/v.length<2)raW.push(k);});
 const cS=CRIT.filter(c=>PROF[c.k]!=null&&PROF[c.k]>=bi&&bi>0),cW=CRIT.filter(c=>PROF[c.k]!=null&&PROF[c.k]<bi);
 return{strong,weak,missed,raW,cS,cW};}
function autoNoteEN(R){const ns=R.not_scored;return `Reading aloud (Q29–31) and speaking (Q32–35) were done by the student alone on the microphone and marked automatically from speech recognition (${R.speech_recognition}): reading aloud by word-by-word comparison with the passage, correct words per minute and recognition confidence; speaking by length, topic words, vocabulary variety, linking words and verb forms against a target for each level. These marks are automatic estimates – speech recognition can mishear Thai-accented English and cannot judge pronunciation fully.`+(ns.length?` Not auto-scored: ${ns.join(", ")} – the result is provisional; use “Copy for AI” or ask a teacher to listen to the recordings (Teacher override).`:" For a fuller assessment, use “Copy for AI” or a teacher check of the recordings.");}
function autoNoteTH(R){const ns=R.not_scored;return `การอ่านออกเสียง (ข้อ 29–31) และการพูด (ข้อ 32–35) ผู้เรียนทำเองโดยบันทึกเสียงผ่านไมโครโฟน และระบบให้คะแนนอัตโนมัติจากการรู้จำเสียงพูด (speech recognition): การอ่านออกเสียงเทียบคำที่อ่านกับข้อความทีละคำ คิดจำนวนคำที่อ่านถูกต่อนาที และค่าความมั่นใจของระบบ ส่วนการพูดดูจากความยาว คำที่ตรงหัวข้อ ความหลากหลายของคำศัพท์ คำเชื่อม และรูปกริยา เทียบกับเป้าหมายของแต่ละระดับ คะแนนเหล่านี้เป็นการประเมินโดยอัตโนมัติ (โดยประมาณ) ระบบอาจฟังสำเนียงไทยผิดได้ และไม่สามารถประเมินการออกเสียงได้ครบถ้วน`+(ns.length?` ข้อที่ตรวจอัตโนมัติไม่ได้: ${ns.join(", ")} – ผลนี้จึงเป็นผลเบื้องต้น ควรใช้ปุ่ม “Copy for AI” หรือให้ครูฟังไฟล์เสียง (Teacher override)`:" หากต้องการประเมินอย่างละเอียด ใช้ปุ่ม “Copy for AI” หรือให้ครูฟังไฟล์เสียงอีกครั้ง");}
function report(R){const n=R.student.name,s=R.sections,bi=R.cefr_index,A=analyse(R);const P=[];
 P.push(["Student",`${n}${R.student.info?" – "+R.student.info:""} · Date: ${dateStr(R.date)}${R.student.teacher?" · Teacher: "+R.student.teacher:""}`]);
 P.push(["Result",`${n} scored ${f(R.total)}/100 overall (${R.basis}), which indicates CEFR level ${LV_NAME[bi]}. At this level a learner ${LV_DESC[bi]}`+(R.adjustments.length?` Adjustments/notes: ${R.adjustments.map(a=>a.en).join("; ")}.`:"")]);
 P.push(["Section scores",s.map(x=>`${x.section} ${x.included?`${f(x.score)}/${x.out_of} (${pc(x.pct)}%)`:"not auto-scored"}${x.included&&x.out_of<x.full_out_of?` [${x.not_scored} item(s) not scored]`:""}`).join("; ")+`. Objective items by level: A1–A2 ${f(R.level_profile.A1_A2.score)}/${R.level_profile.A1_A2.out_of}, B1 ${f(R.level_profile.B1.score)}/${R.level_profile.B1.out_of}, B2–C1 ${f(R.level_profile.B2_C1.score)}/${R.level_profile.B2_C1.out_of}.`]);
 P.push(["Per-skill CEFR indications",R.skills.map(k=>`${k.skill.split(" (")[0]}: ${k.level==null?"not auto-scored":LV[k.level]}`).join("; ")+"."]);
 P.push(["Automatic marking",autoNoteEN(R)]);
 P.push(["How the CEFR level is decided",`The overall score is a weighted total of the five sections (speaking ${WEIGHT[4]}%, grammar ${WEIGHT[1]}%, vocabulary ${WEIGHT[0]}%, reading aloud ${WEIGHT[3]}%, pronunciation ${WEIGHT[2]}%), so the automatic speaking and read-aloud estimates count for ${WEIGHT[3]+WEIGHT[4]}% of the result. Bands: `+BANDS.map(b=>`${b[2]} ${b[0]}–${b[1]}`).join(", ")+`. Questions are graded from A1 to C1, so a learner's score rises with their level.`]);
 let st=A.strong.map(x=>x.section.toLowerCase());if(A.cS.length)st.push("speaking "+list(A.cS.map(c=>c.en.toLowerCase()))+" at or above "+LV[bi]+" level");
 P.push(["Strengths",st.length?list(st)+".":(()=>{const b=[...s].filter(x=>x.any_marked).sort((a,b)=>b.pct-a.pct)[0];return `No section reached 70% yet; the strongest area was ${b.section.toLowerCase()} (${pc(b.pct)}%).`;})()]);
 const ar=[];if(A.weak.length)ar.push(list(A.weak.map(x=>x.section.toLowerCase()))+" (under 50%)");if(A.missed.length)ar.push("gaps at or below this level: "+A.missed.map(d=>d.skill).join("; "));
 A.raW.forEach(k=>ar.push(RA_TIP[k][0]));if(A.cW.length)ar.push("speaking "+list(A.cW.map(c=>c.en.toLowerCase()))+" (below "+LV[bi]+")");
 if(bi<5)ar.push(`next step: the ${LV[bi+1]} language in the test (`+[...new Set(Q.filter(q=>q.lvl===bi+1&&q.s<=2).map(q=>q.skill.split(":")[0]))].slice(0,4).join(", ")+")");
 P.push(["Areas to work on",ar.length?ar.join("; ")+".":"No clear weaknesses in this test; continue with C1 skills such as nuance, register and extended discussion."]);
 const notes=R.details.filter(d=>d.notes).map(d=>`Q${d.q}: ${d.notes}`);
 if(R.teacher_notes||notes.length)P.push(["Teacher's notes",(R.teacher_notes?R.teacher_notes+(notes.length?" | ":""):"")+notes.join(" | ")]);
 P.push(["Course recommendation",COURSE[bi]]);
 if(R.not_scored.length)P.push(["Provisional",R.not_scored.join(", ")+" could not be auto-scored. Use “Copy for AI” for an AI assessment of the transcripts, or a teacher can listen to the recordings and enter marks with “Teacher override”."]);
 P.push(["Note","This is an indicative in-school placement based on the CEFR, not an official CEFR certificate or exam result. Reading-aloud and speaking marks are automatic estimates."]);return P;}
function reportTH(R){const n=R.student.name,s=R.sections,bi=R.cefr_index,A=analyse(R);const P=[];
 P.push(["ผู้เรียน",`${n}${R.student.info?" – "+R.student.info:""} · วันที่ทดสอบ: ${dateTH(R.date)}${R.student.teacher?" · ครูผู้ดูแล: "+R.student.teacher:""}`]);
 P.push(["ผลการทดสอบ",`คุณ ${n} ได้คะแนนรวม ${f(R.total)} จาก 100 คะแนน (${R.basis_th}) ซึ่งเทียบได้กับระดับ CEFR ${LV_TH[bi]} ผู้เรียนในระดับนี้${LV_DESC_TH[bi]}`+(R.adjustments.length?` การปรับผล/หมายเหตุ: ${R.adjustments.map(a=>a.th).join("; ")}`:"")]);
 P.push(["คะแนนรายส่วน",s.map((x,k)=>`${SEC_TH[k]} ${x.included?`${f(x.score)}/${x.out_of} (${pc(x.pct)}%)`:"ตรวจอัตโนมัติไม่ได้"}`).join(", ")+` · ข้อที่ตรวจอัตโนมัติแยกตามระดับ: A1–A2 ได้ ${f(R.level_profile.A1_A2.score)}/${R.level_profile.A1_A2.out_of}, B1 ได้ ${f(R.level_profile.B1.score)}/${R.level_profile.B1.out_of}, B2–C1 ได้ ${f(R.level_profile.B2_C1.score)}/${R.level_profile.B2_C1.out_of}`]);
 P.push(["ระดับ CEFR รายทักษะ",R.skills.map(k=>`${k.th}: ${k.level==null?"ตรวจอัตโนมัติไม่ได้":LV[k.level]}`).join(", ")]);
 P.push(["การให้คะแนนอัตโนมัติ",autoNoteTH(R)]);
 P.push(["เกณฑ์การตัดสินระดับ",`คะแนนรวมคำนวณจากน้ำหนักของ 5 ส่วน (การพูด ${WEIGHT[4]}% ไวยากรณ์ ${WEIGHT[1]}% คำศัพท์ ${WEIGHT[0]}% การอ่านออกเสียง ${WEIGHT[3]}% และการออกเสียง ${WEIGHT[2]}%) ดังนั้นคะแนนประเมินอัตโนมัติของการพูดและการอ่านออกเสียงคิดเป็น ${WEIGHT[3]+WEIGHT[4]}% ของผลรวม เกณฑ์: `+BANDS.map(b=>`${b[2]} = ${b[0]}–${b[1]}`).join(", ")+` ข้อสอบเรียงความยากจาก A1 ถึง C1`]);
 let st=A.strong.map(x=>SEC_TH[SECTIONS.indexOf(x.section)]);if(A.cS.length)st.push("การพูดด้าน"+listTH(A.cS.map(c=>c.th))+" อยู่ในระดับ "+LV[bi]+" หรือสูงกว่า");
 P.push(["จุดเด่น",st.length?listTH(st):(()=>{const b=[...s].map((x,k)=>({...x,k})).filter(x=>x.any_marked).sort((a,b)=>b.pct-a.pct)[0];return `ยังไม่มีส่วนใดได้ถึง 70% ส่วนที่ทำได้ดีที่สุดคือ ${SEC_TH[b.k]} (${pc(b.pct)}%)`;})()]);
 const ar=[];if(A.weak.length)ar.push(listTH(A.weak.map(x=>SEC_TH[SECTIONS.indexOf(x.section)]))+" (ต่ำกว่า 50%)");if(A.missed.length)ar.push("หัวข้อที่ยังทำไม่ได้ในระดับนี้หรือต่ำกว่า: "+A.missed.map(d=>`ข้อ ${d.q} ${d.th}`).join(", "));
 A.raW.forEach(k=>ar.push(RA_TIP[k][1]));if(A.cW.length)ar.push("การพูดด้าน"+listTH(A.cW.map(c=>c.th))+" (ต่ำกว่าระดับ "+LV[bi]+")");
 if(bi<5)ar.push(`ขั้นต่อไป: ภาษาระดับ ${LV[bi+1]} เช่น `+[...new Set(Q.filter(q=>q.lvl===bi+1&&q.s<=2).map(q=>q.th))].slice(0,4).join(", "));
 P.push(["สิ่งที่ควรพัฒนา",ar.length?ar.join("; "):"ไม่พบจุดอ่อนที่ชัดเจนในแบบทดสอบนี้ ควรพัฒนาทักษะระดับ C1 ต่อ เช่น ความหมายที่ละเอียดอ่อน ระดับภาษา และการอภิปรายยาว ๆ"]);
 const notes=R.details.filter(d=>d.notes).map(d=>`ข้อ ${d.q}: ${d.notes}`);
 if(R.teacher_notes||notes.length)P.push(["บันทึกของครู",(R.teacher_notes?R.teacher_notes+(notes.length?" | ":""):"")+notes.join(" | ")]);
 P.push(["คอร์สที่แนะนำ",COURSE_TH[bi]]);
 if(R.not_scored.length)P.push(["ผลเบื้องต้น",`ข้อ ${R.not_scored.join(", ")} ตรวจอัตโนมัติไม่ได้ ใช้ปุ่ม “Copy for AI” เพื่อให้ AI ประเมินจากข้อมูลทั้งหมด หรือให้ครูฟังไฟล์เสียงแล้วใส่คะแนนด้วยปุ่ม “Teacher override”`]);
 P.push(["หมายเหตุ","ผลนี้เป็นการประเมินเพื่อจัดระดับชั้นเรียนภายในโรงเรียนโดยอ้างอิงกรอบ CEFR ไม่ใช่ใบรับรองหรือผลสอบ CEFR อย่างเป็นทางการ คะแนนการอ่านออกเสียงและการพูดเป็นการประเมินโดยอัตโนมัติ"]);return P;}
const asHTML=P=>P.map(([h,t])=>`<p style="margin:0 0 8px"><b>${esc(h)}:</b> ${esc(t)}</p>`).join("");
const asTXT=P=>P.map(([h,t])=>`${h}: ${t}`).join("\n");
let R=null,REP=[],REPTH=[];
function colourPassage(i){const q=Q[i],a=autoScore(i);if(a.status!=="auto"||!a.hit)return esc(q.target);let p=0;
 return q.target.split(/\s+/).map(w=>{const n=rTok(w).length;const h=a.hit.slice(p,p+n);p+=n;const c=!n?"":h.every(x=>x===1)?"w-ok":h.some(x=>x===0)?"w-miss":"w-near";return `<span class="${c}">${esc(w)}</span>`;}).join(" ");}
async function finish(){stopRec();await waitIdle();releaseMic();$("bar").style.width="100%";R=compute();REP=report(R);REPTH=reportTH(R);R.teacher_report=asTXT(REP);R.teacher_report_th=asTXT(REPTH);
 $("quiz").classList.add("hide");$("results").classList.remove("hide");$("rname").textContent=R.student.name;
 $("rmeta").textContent=`${dateStr(R.date)}${R.student.info?" · "+R.student.info:""}${R.student.teacher?" · Teacher: "+R.student.teacher:""}`;
 const s3=R.sections[3],s4=R.sections[4];
 $("rscore").innerHTML=`${f(R.total)} / 100${R.provisional?' <span style="font-size:22px">(provisional)</span>':""}<div style="font-size:17px;color:#012169;font-weight:normal">auto-marked: ${f(R.objective_score)} / ${OBJ} · automatic estimates: reading aloud ${s3.included?f(s3.score)+"/"+s3.out_of:"not scored"}, speaking ${s4.included?f(s4.score)+"/"+s4.out_of:"not scored"}</div>`;
 $("rlevel").innerHTML=`CEFR level (indicative): <b>${LV_NAME[R.cefr_index]}</b>`+(R.cefr!==R.score_band?`<div style="font-size:16px">score band ${R.score_band}; ${R.adjustments[0].en}</div>`:"");
 $("rwarn").innerHTML=R.provisional?`⚠️ Provisional result – not auto-scored: ${R.not_scored.join(", ")}${!SR?" (speech recognition is not available in this browser)":""}. Use <b>Copy for AI</b> or a teacher check of the recordings (<b>Teacher override</b>).`:"";
 $("rwarn").classList.toggle("hide",!R.provisional);
 $("rsec").innerHTML="<tr><th>Section</th><th>Questions</th><th>Score</th><th>%</th><th>Weight</th><th>Points /100</th><th>CEFR indication</th><th>Marked by</th></tr>"+R.sections.map(s=>`<tr><td>${s.section}</td><td>${s.questions} (${s.count})</td><td>${s.included?`<b>${f(s.score)}</b> / ${s.out_of}`:"–"}</td><td>${s.included?pc(s.pct)+"%":"–"}</td><td>${s.weight}%</td><td>${s.included?f(s.points):"–"}</td><td>${s.included?LV[bandIdx(s.pct*100)]:"–"}</td><td>${s.marked_by}${s.not_scored&&s.included?` <span class="no">(${s.not_scored} not auto-scored)</span>`:""}</td></tr>`).join("")+`<tr><th>Total</th><th>${N}</th><th></th><th></th><th>100%</th><th>${f(R.total)}</th><th>${R.cefr}</th><th>${R.provisional?"provisional":""}</th></tr>`;
 $("rbands").innerHTML=bandsTable();
 $("rskill").innerHTML="<tr><th>Skill</th><th>CEFR indication</th><th>Based on</th></tr>"+R.skills.map(k=>`<tr><td>${k.skill}</td><td><b>${k.level==null?"–":LV[k.level]}</b></td><td>${k.basis}</td></tr>`).join("");
 $("rdesc").innerHTML=CRIT.some(c=>PROF[c.k]!=null)?"<h4 style='margin-bottom:4px'>Teacher's CEFR descriptor ratings (speaking, optional override)</h4><table><tr><th>Criterion</th><th>Level</th><th>Descriptor (paraphrased)</th></tr>"+CRIT.map(c=>`<tr><td>${c.en}</td><td>${PROF[c.k]==null?"–":LV[PROF[c.k]]}</td><td>${PROF[c.k]==null?"not rated":c.d[PROF[c.k]]}</td></tr>`).join("")+"</table>":"";
 $("rreport").innerHTML=asHTML(REP);$("rreportTH").innerHTML=asHTML(REPTH);
 const tag=d=>`<span class="tag ${d.source==="automatic estimate"?"auto":d.source==="teacher override"?"ovr":"na"}">${d.source==="automatic estimate"?"automatic estimate":d.source}</span>`;
 $("rread").innerHTML=`<p class="note">Marks are <b>automatic estimates</b> from speech recognition. In the passage: <span class="w-ok">green</span> = heard correctly, <span class="w-near">orange</span> = near miss (½), <span class="w-miss">red</span> = missed or misread.</p>`+R.details.filter(d=>d.type==="read aloud").map(d=>{const r=REC[d.q-1]||{},a=d.auto;
  return `<div class="ritem"><b>Q${d.q} (${Q[d.q-1].lvl===5?"B2/C1":d.level})</b> ${tag(d)}<div class="passage">${colourPassage(d.q-1)}</div>
  <div><b>Heard:</b> <i>${esc(d.transcript)||"–"}</i></div>
  ${a.word_accuracy_pct!=null&&a.status==="automatic estimate"?`<div class="note">Word accuracy <b>${a.word_accuracy_pct}%</b> · ${a.correct_words_per_min} correct words/min (${a.words_per_min} words/min) over ${a.speech_seconds} s · confidence ${a.recognition_confidence==null?"n/a":pc(a.recognition_confidence)+"%"} · pronunciation proxy ${a.pronunciation_proxy_pct}%</div>`:""}
  <div>Accuracy <b>${d.marks.accuracy??"–"}</b>/3 · Fluency <b>${d.marks.fluency??"–"}</b>/3 · Pronunciation <b>${d.marks.pronunciation??"–"}</b>/3 → <b>${d.scored?d.credit+"/9":"not scored"}</b></div>
  <div class="note">Reason: ${esc(a.reason)}${d.override?" · teacher override applied":""}</div>
  ${r.url?`<audio controls playsinline src="${r.url}"></audio>`:"<span class='note'>no recording</span>"}</div>`;}).join("");
 $("rspeak").innerHTML=`<p class="note">Each answer was recorded by the student and given an <b>automatic estimate</b> 0–3 from the transcript (length, topic words, variety, linkers and verb forms against the level target).</p><div class='tw'><table><tr><th>Q</th><th>Level</th><th>Question</th><th>What the computer heard</th><th>Mark</th><th>Reason</th></tr>`+R.details.filter(d=>d.type.startsWith("speaking")).map(d=>{const r=REC[d.q-1]||{};
  return `<tr><td>${d.q}</td><td>${d.level}</td><td>${esc(d.question)}</td><td><i>${esc(d.transcript)||"–"}</i>${r.url?`<br><audio controls playsinline src="${r.url}"></audio>`:""}${r.secs?`<div class="note">${Math.round(r.secs)} s recorded</div>`:""}</td><td><b>${d.mark??"–"}</b>/3<br>${tag(d)}</td><td class="note">${esc(d.auto.reason)}${d.override?` · auto ${d.auto_mark??"–"}, teacher override ${d.mark}`:""}${d.notes?"<br>Notes: "+esc(d.notes):""}</td></tr>`;}).join("")+"</table></div>";
 $("ranswers").innerHTML="<tr><th>Q</th><th>Level</th><th>Section / skill</th><th>Answer</th><th>Correct</th><th>Mark</th></tr>"+R.details.filter(d=>Q[d.q-1].s<=2).map(d=>`<tr><td>${d.q}</td><td>${d.level}</td><td>${d.section}: ${esc(d.skill)}</td><td><b>${esc(d.answer)||"–"}</b></td><td>${esc(d.correct_answer)}</td><td class="${d.correct?"ok":d.credit?"":"no"}">${d.correct?"✔":d.credit?f(d.credit):"✘"}</td></tr>`).join("");
 $("aiText").value=aiText();window.scrollTo(0,0);}
function recTxt(d){return d.recording?`yes (${d.recording_seconds} s, ${d.recording_type}, file ${d.recording_file})`:"no";}
function txtReport(){return `ENGLISH PLACEMENT TEST – ADULTS (CEFR A1–C1) – REPORT\n${R.school}\nStudent: ${R.student.name}${R.student.info?" ("+R.student.info+")":""}\nDate: ${dateStr(R.date)}   Teacher: ${R.student.teacher||"-"}\n`+
 `OVERALL: ${f(R.total)}/100 → CEFR ${R.cefr} (indicative${R.provisional?", PROVISIONAL":""})${R.adjustments.length?"  ["+R.adjustments.map(a=>a.en).join("; ")+"]":""}\nBasis: ${R.basis}\nSpeech recognition: ${R.speech_recognition}; recording: ${R.recording}\n\nSECTIONS:\n`+R.sections.map(s=>`  ${s.section} (${s.questions}, ${s.count} q): ${s.included?`${f(s.score)}/${s.out_of} = ${pc(s.pct)}% × ${s.weight} = ${f(s.points)} pts → ${LV[bandIdx(s.pct*100)]}`:"not auto-scored"} [${s.marked_by}]${s.not_scored?" ("+s.not_scored+" not auto-scored)":""}`).join("\n")+
 `\n\nPER-SKILL CEFR INDICATIONS:\n`+R.skills.map(k=>`  ${k.skill}: ${k.level==null?"-":LV[k.level]} (${k.basis})`).join("\n")+
 (CRIT.some(c=>PROF[c.k]!=null)?`\n\nTEACHER DESCRIPTOR RATINGS (speaking, optional): `+CRIT.map(c=>`${c.en} ${PROF[c.k]==null?"-":LV[PROF[c.k]]}`).join(", "):"")+
 `\n\nCEFR BANDS (/100): `+BANDS.map(b=>`${b[2]} ${b[0]}-${b[1]}`).join(", ")+
 `\n\nTEACHER REPORT (English):\n${asTXT(REP)}\n\nรายงานสำหรับครู (ภาษาไทย):\n${asTXT(REPTH)}\n\nREADING ALOUD (student recorded; AUTOMATIC ESTIMATES 0-3 from speech recognition):\n`+R.details.filter(d=>d.type==="read aloud").map(d=>`Q${d.q} [${Q[d.q-1].lvl===5?"B2/C1":d.level}] Passage: "${d.question}"\n   Heard (speech recognition): "${d.transcript||"-"}"\n   Marks: accuracy ${d.marks.accuracy??"-"}, fluency ${d.marks.fluency??"-"}, pronunciation ${d.marks.pronunciation??"-"} = ${d.scored?d.credit+"/9":"not scored"} [${d.source}]\n   Reason: ${d.auto.reason}${d.auto.word_errors&&d.auto.word_errors.length?"\n   Word differences: "+d.auto.word_errors.join(", "):""}\n   Recording: ${recTxt(d)}${d.notes?"\n   Teacher notes: "+d.notes:""}`).join("\n")+
 `\n\nSPEAKING (student alone, question on screen; AUTOMATIC ESTIMATES 0-3 from the transcript):\n`+R.details.filter(d=>d.type.startsWith("speaking")).map(d=>`Q${d.q} [${d.level}, suggested up to ${d.suggested_seconds} s] "${d.question}"\n   Transcript: "${d.transcript||"-"}"\n   Mark: ${d.mark??"not scored"}/3 [${d.source}${d.override?", automatic was "+(d.auto_mark??"-"):""}]\n   Reason: ${d.auto.reason}\n   Recording: ${recTxt(d)}${d.notes?"\n   Teacher notes: "+d.notes:""}`).join("\n")+
 `\n\nALL OBJECTIVE ANSWERS:\n`+R.details.filter(d=>Q[d.q-1].s<=2).map(d=>`Q${d.q} [${d.section}, ${d.level}, ${d.type}] ${d.skill}\n   Q: ${d.question}\n   Answer: ${d.answer||"-"} | Correct: ${d.correct_answer} | ${d.correct?"✔":d.credit?f(d.credit):"✘"} (${d.note})`).join("\n")+`\n\n${R.disclaimer}`;}
function aiText(){return `You are an experienced EFL teacher and CEFR placement examiner at a UK-style language school in Thailand (London Centre of English Language School). A Thai adult learner has just taken a 35-question CEFR placement test (A1–C1) ON THEIR OWN, with no teacher present: vocabulary Q1–10, grammar Q11–22 and pronunciation Q23–28 (auto-marked, objective), reading aloud Q29–31 (the student recorded each passage) and speaking Q32–35 (the question was shown on screen, optionally played by text-to-speech, and the student recorded an answer). Reading aloud and speaking were given AUTOMATIC ESTIMATES from browser speech recognition (English, en-US): reading aloud by word-level alignment with the passage (word accuracy %), correct words per minute and recognition confidence; speaking by length against the level target, topic words, type/token ratio, linkers/subordinate clauses and verb-form variety. Transcripts are approximate: recognition can mishear Thai-accented English, drops hesitations and false starts, and may "tidy" grammar, so treat them with care; pronunciation can only be judged indirectly. Items marked "not auto-scored" have no reliable automatic mark.
The overall score /100 weights the sections ${SECTIONS.map((s,k)=>s+" "+WEIGHT[k]+"%").join(", ")}; bands ${BANDS.map(b=>b[2]+" "+b[0]+"–"+b[1]).join(", ")}; if A1–A2 objective items are under 60% a B1+ result is capped at A2, and if B2–C1 objective items are under 40% a C1 result is lowered to B2.
RUBRICS – reading aloud (0–3 each): Accuracy: ${READ_RUB.acc.d.map((x,k)=>k+" = "+x).join("; ")}. Fluency: ${READ_RUB.flu.d.map((x,k)=>k+" = "+x).join("; ")}. Pronunciation: ${READ_RUB.pro.d.map((x,k)=>k+" = "+x).join("; ")}. Speaking (0–3 per question, judged against the CEFR level of the question): ${SPEAK_RUB.map((x,k)=>k+" = "+x).join("; ")}.
Please:
1) READING ALOUD Q29–31: compare each transcript with its passage and give accuracy, fluency and pronunciation marks 0–3 with a one-line reason; say whether you agree with the automatic estimate and note likely pronunciation issues suggested by the misrecognised words.
2) SPEAKING Q32–35: for each answer give a mark 0–3, the CEFR level the answer shows (Pre-A1–C1) and a one-line reason (task achievement, range, grammatical accuracy, coherence); quote one or two errors or good features. If an answer is empty or not auto-scored, say so.
3) OVERALL: recalculate the score /100 using the objective section scores as given and your reading-aloud and speaking marks, apply the bands and checks, and give the overall CEFR level with a confidence rating (high/medium/low) and 3–4 sentences of justification.
4) Give a CEFR-style profile (range, accuracy, fluency, coherence, pronunciation) in one line each.
5) List 3 strengths, 3 priorities and 3 practical activities for the first month, with typical Thai-speaker issues in mind (final consonants, clusters, -ed endings, word stress, tenses, articles).
6) Recommend a course and approximate hours to the next level.
7) Write a short, friendly summary for the student in English, followed by a Thai translation (polite, gender-neutral).
This is an indicative placement, not an official certificate. Audio recordings are not included in this text (file names are listed so the teacher can share them if your tool accepts audio).

`+txtReport()+`\n\nRaw data (JSON, no audio):\n`+JSON.stringify({student:R.student,total:R.total,provisional:R.provisional,cefr:R.cefr,score_band:R.score_band,adjustments:R.adjustments.map(a=>a.en),speech_recognition:R.speech_recognition,auto_marking:R.auto_marking,sections:R.sections,skills:R.skills.map(k=>({...k,level:k.level==null?null:LV[k.level]})),descriptors:R.descriptors,level_profile:R.level_profile,details:R.details});}
function safe(s){return String(s||"student").replace(/[^\w\u0E00-\u0E7F-]+/g,"_");}
function dl(name,data,type){const b=data instanceof Blob?data:new Blob([data],{type});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
function fn(ext){return `PlacementTest_Adults_${safe(R.student.name)}_${R.date.slice(0,10)}.${ext}`;}
async function copy(t){$("aiText").value=t;try{await navigator.clipboard.writeText(t);toast("Copied! ✅ Paste it into your AI chat.");}catch(e){const ta=$("aiText");ta.focus();ta.select();ta.setSelectionRange(0,t.length);try{document.execCommand("copy")?toast("Copied! ✅"):toast("Select the text box below and copy",4000);}catch(_){toast("Select the text box below and copy",4000);}}}
$("dlJson").onclick=()=>{dl(fn("json"),JSON.stringify(R,null,2),"application/json");};
$("dlTxt").onclick=()=>dl(fn("txt"),txtReport(),"text/plain");
$("dlAudio").onclick=()=>{const ks=Object.keys(REC).filter(k=>REC[k].blob);if(!ks.length){toast("No recordings to download");return;}ks.forEach((k,j)=>setTimeout(()=>dl(audioName(+k,REC[k]),REC[k].blob),j*600));};
$("printBtn").onclick=()=>window.print();
$("copyRep").onclick=()=>copy(txtReport());
$("copyAI").onclick=()=>copy(aiText());
$("editBtn").onclick=()=>{$("results").classList.add("hide");$("quiz").classList.remove("hide");show(Q.findIndex(q=>q.read));setTimeout(()=>{const o=$("ovr");if(o)o.open=true;},50);toast("Open “Teacher override” on each item to change marks, then go to the end and press Finish",4500);};
$("again").onclick=()=>{if(confirm("Start a new student? (Download the results and recordings first!)")){releaseMic();location.reload();}};
