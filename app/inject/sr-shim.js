/* London Centre Tests – offline SpeechRecognition replacement.
 * Electron's built-in webkitSpeechRecognition needs Google's online service (API key) and fails,
 * so this replaces window.SpeechRecognition / webkitSpeechRecognition with an object that has the same API
 * (lang, continuous, interimResults, maxAlternatives, start([track]), stop(), abort(),
 *  onstart/onaudiostart/onspeechstart/onresult/onerror/onend + addEventListener)
 * and transcribes on this PC with Vosk (Kaldi, WebAssembly) and a small English model. Nothing goes online. */
(function () {
  'use strict';
  var BASE = 'app://tests/vosk/';
  var MODEL_URL = BASE + 'vosk-model-small-en-us-0.15.tar.gz';
  var RATE = 16000;
  var engineP = null, engineState = 'idle', engineError = '';
  var dbg = function () { try { if (window.__lctDebug) console.log.apply(console, ['[sr-shim]'].concat([].slice.call(arguments))); } catch (_) {} };

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (window.Vosk) return res();
      var s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = function () { res(); }; s.onerror = function () { rej(new Error('cannot load ' + src)); };
      (document.head || document.documentElement).appendChild(s);
    });
  }
  function engine() {
    if (!engineP) {
      engineState = 'loading'; var t0 = Date.now();
      engineP = loadScript(BASE + 'vosk.js').then(function () { return window.Vosk.createModel(MODEL_URL, -1); })
        .then(function (m) { engineState = 'ready'; dbg('model ready in', Date.now() - t0, 'ms'); window.dispatchEvent(new CustomEvent('lct-speech-ready')); return m; },
              function (e) { engineState = 'error'; engineError = String(e && e.message || e); engineP = null; dbg('model failed', engineError); throw e; });
    }
    return engineP;
  }

  function mkAlt(transcript, confidence) { return { transcript: transcript, confidence: confidence }; }
  function mkResult(transcript, confidence, isFinal) { var r = [mkAlt(transcript, confidence)]; r.isFinal = isFinal; r.item = function (i) { return r[i] || null; }; return r; }
  function mkList(arr) { var l = arr.slice(); l.item = function (i) { return l[i] || null; }; return l; }

  var nextId = 1;
  function LCSpeechRecognition() {
    var t = new EventTarget();
    Object.setPrototypeOf(t, LCSpeechRecognition.prototype);
    t.lang = 'en-US'; t.continuous = false; t.interimResults = false; t.maxAlternatives = 1; t.grammars = null;
    t.onstart = t.onend = t.onerror = t.onresult = t.onnomatch = t.onaudiostart = t.onaudioend = t.onsoundstart = t.onsoundend = t.onspeechstart = t.onspeechend = null;
    t._s = 'idle'; t._id = nextId++;
    return t;
  }
  LCSpeechRecognition.prototype = Object.create(EventTarget.prototype);
  LCSpeechRecognition.prototype.constructor = LCSpeechRecognition;
  var P = LCSpeechRecognition.prototype;

  P._fire = function (type, props) {
    var ev = new Event(type);
    if (props) for (var k in props) Object.defineProperty(ev, k, { value: props[k], enumerable: true });
    try { this.dispatchEvent(ev); } catch (e) { setTimeout(function () { throw e; }); }
    var h = this['on' + type];
    if (typeof h === 'function') { try { h.call(this, ev); } catch (e) { setTimeout(function () { throw e; }); } }
  };

  P.start = function (track) {
    if (this._s !== 'idle') { var err = new Error("Failed to execute 'start' on 'SpeechRecognition': recognition has already started."); err.name = 'InvalidStateError'; throw err; }
    var self = this; this._s = 'starting';
    this._finals = []; this._interim = ''; this._buf = []; this._rec = null; this._gotSpeech = false; this._ownStream = false;
    dbg('#' + this._id, 'start', track ? '(track)' : '(own mic)', 'continuous=' + this.continuous, 'interim=' + this.interimResults);
    var streamP = (track && typeof track === 'object' && track.kind === 'audio')
      ? Promise.resolve(new MediaStream([track]))
      : navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
          .then(function (s) { self._ownStream = true; return s; });
    streamP.then(function (stream) {
      if (self._s !== 'starting') { if (self._ownStream) stream.getTracks().forEach(function (x) { x.stop(); }); return; }
      self._stream = stream;
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx; try { ctx = new AC({ sampleRate: RATE }); } catch (_) { ctx = new AC(); }
      self._ctx = ctx; if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      var src = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(); mute.gain.value = 0;
      src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      self._src = src; self._proc = proc; self._mute = mute;
      proc.onaudioprocess = function (e) {
        if (self._s !== 'running' && self._s !== 'starting') return;
        var d = new Float32Array(e.inputBuffer.getChannelData(0));
        if (self._rec) self._rec.acceptWaveformFloat(d, ctx.sampleRate); else if (self._buf.length < 400) self._buf.push(d);   // buffer ~100 s while the model loads
      };
      self._s = 'running';
      self._fire('start'); self._fire('audiostart');
      if (!self.continuous) self._nsT = setTimeout(function () { if (self._s === 'running' && !self._gotSpeech) { self._fire('error', { error: 'no-speech', message: 'No speech was detected.' }); self._end(); } }, 8000);
      return engine().then(function (model) {
        if (self._s !== 'running' && self._s !== 'stopping') return;
        var rec = new model.KaldiRecognizer(ctx.sampleRate); self._rec = rec;
        try { rec.setWords(true); } catch (_) {}
        rec.on('partialresult', function (m) { self._onPartial(m && m.result && m.result.partial || ''); });
        rec.on('result', function (m) { self._onFinal(m && m.result || {}); });
        rec.on('error', function (m) { dbg('recognizer error', m && m.error); });
        var b = self._buf; self._buf = [];
        for (var i = 0; i < b.length; i++) rec.acceptWaveformFloat(b[i], ctx.sampleRate);
        dbg('#' + self._id, 'recognizer ready, flushed', b.length, 'buffered chunks');
        if (self._s === 'stopping') self._finalize();
      });
    }).catch(function (e) {
      var name = e && e.name, code = name === 'NotAllowedError' || name === 'SecurityError' ? 'not-allowed' : (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError' || name === 'AbortError') ? 'audio-capture' : 'service-not-allowed';
      dbg('#' + self._id, 'start failed', name, e && e.message, '->', code);
      if (self._s === 'idle') return;
      self._fire('error', { error: code, message: String(e && e.message || e) });
      self._end();
    });
  };

  P._onPartial = function (text) {
    if (this._s !== 'running' && this._s !== 'stopping') return;
    this._lastMsg = Date.now();
    text = String(text || '').trim();
    if (text && !this._gotSpeech) { this._gotSpeech = true; clearTimeout(this._nsT); this._fire('soundstart'); this._fire('speechstart'); }
    if (!this.interimResults || text === this._interim) { this._interim = text; return; }
    this._interim = text;
    var list = this._finals.slice(); if (text) list.push(mkResult(text, 0, false));
    this._fire('result', { resultIndex: this._finals.length, results: mkList(list), interpretation: null, emma: null });
  };
  P._onFinal = function (res) {
    if (this._s !== 'running' && this._s !== 'stopping') return;
    this._lastMsg = Date.now();
    var text = String(res.text || '').trim(); this._interim = '';
    if (this._s === 'stopping' && this._finTimer) { clearTimeout(this._finTimer); this._finTimer = setTimeout(this._end.bind(this), 350); }
    if (!text) return;
    if (!this._gotSpeech) { this._gotSpeech = true; clearTimeout(this._nsT); this._fire('soundstart'); this._fire('speechstart'); }
    var words = Array.isArray(res.result) ? res.result : [], conf = 0;
    if (words.length) { for (var i = 0; i < words.length; i++) conf += +words[i].conf || 0; conf = conf / words.length; } else conf = 0.8;
    this._finals.push(mkResult((this._finals.length ? ' ' : '') + text, conf, true));
    this._fire('result', { resultIndex: this._finals.length - 1, results: mkList(this._finals), interpretation: null, emma: null });
    if (!this.continuous && this._s === 'running') this.stop();
  };

  P.stop = function () {
    if (this._s === 'idle' || this._s === 'stopping') return;
    dbg('#' + this._id, 'stop');
    if (this._s === 'starting') { this._s = 'stopping'; this._end(); return; }
    this._s = 'stopping';
    if (this._rec) this._finalize();               // otherwise _finalize runs once the model is ready
    else if (engineState !== 'loading') this._end();
    else this._safety = setTimeout(this._end.bind(this), 15000);
  };
  P._finalize = function () {
    var self = this;
    // flush the last ~0.3 s of audio, then ask Vosk for the final words of the utterance
    setTimeout(function () {
      if (self._s !== 'stopping') return;
      if (self._proc) self._proc.onaudioprocess = null;
      try { self._rec.retrieveFinalResult(); } catch (_) { self._end(); return; }
      self._finTimer = setTimeout(self._end.bind(self), 2500);
    }, 300);
  };
  P.abort = function () {
    if (this._s === 'idle') return;
    dbg('#' + this._id, 'abort');
    this._s = 'aborting';
    this._fire('error', { error: 'aborted', message: 'Speech recognition was aborted.' });
    this._end();
  };
  P._end = function () {
    if (this._s === 'idle') return;
    var wasRunning = this._s !== 'starting';
    this._s = 'idle';
    clearTimeout(this._nsT); clearTimeout(this._finTimer); clearTimeout(this._safety);
    if (this._interim && this.interimResults === false) { /* Chrome drops unfinished words when not asked for interim results */ }
    try { if (this._proc) { this._proc.onaudioprocess = null; this._proc.disconnect(); } } catch (_) {}
    try { if (this._src) this._src.disconnect(); } catch (_) {}
    try { if (this._ctx) this._ctx.close(); } catch (_) {}
    try { if (this._ownStream && this._stream) this._stream.getTracks().forEach(function (x) { x.stop(); }); } catch (_) {}
    try { if (this._rec) this._rec.remove(); } catch (_) {}
    this._rec = this._proc = this._src = this._ctx = this._stream = null; this._buf = [];
    dbg('#' + this._id, 'end, finals=', (this._finals || []).length);
    if (this._gotSpeech) { this._fire('speechend'); this._fire('soundend'); }
    if (wasRunning) this._fire('audioend');
    this._fire('end');
  };

  function GrammarList() { var l = []; l.addFromString = function () {}; l.addFromURI = function () {}; l.item = function (i) { return l[i]; }; return l; }
  var def = function (name, v) { try { Object.defineProperty(window, name, { value: v, writable: true, configurable: true }); } catch (_) { window[name] = v; } };
  var haveModel = !(window.lcApp && window.lcApp.speechModel === false);
  if (!haveModel) {
    // No offline model installed: hide speech recognition completely, so the tests use their normal
    // "recording only – the teacher marks reading/speaking" path (Electron's own recogniser cannot work offline).
    engineState = 'missing'; engineError = 'speech model not installed';
    def('SpeechRecognition', undefined); def('webkitSpeechRecognition', undefined);
    window.lcSpeech = { engine: 'none', state: 'missing', error: engineError, preload: function () { return Promise.reject(new Error(engineError)); } };
    return;
  }
  def('SpeechRecognition', LCSpeechRecognition);
  def('webkitSpeechRecognition', LCSpeechRecognition);
  def('SpeechGrammarList', GrammarList); def('webkitSpeechGrammarList', GrammarList);
  window.lcSpeech = { engine: 'vosk-small-en-us-0.15 (offline)', get state() { return engineState; }, get error() { return engineError; }, preload: function () { return engine().then(function () { return true; }); } };
  // load the model in the background as soon as the page is ready, so it is warm before the first speaking item
  var warm = function () { setTimeout(function () { engine().catch(function () {}); }, 300); };
  if (document.readyState === 'complete') warm(); else window.addEventListener('load', warm);
})();
