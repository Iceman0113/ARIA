import { useState, useEffect, useRef, useCallback } from 'react';
import { voice } from './Voice.js';
import { wakeWord } from './WakeWord.js';
import Setup from './components/Setup.jsx';
import CosmicOrb from './components/CosmicOrb.jsx';

const CONFIG_KEY   = 'cofounder_config_v1';
const ALWAYSON_KEY = 'aria_alwayson';
const CONVO_KEY    = 'aria_convo_mode';
const MAX_TTS_CHARS = 850;

const MRR_TARGET = 11000;

const STATUS_MSGS = [
  'WHAT CAN I FIND FOR YOU, RANDY?',
  'ALL SYSTEMS NOMINAL. AWAITING INPUT.',
  'JACK & JEWELL CONSULTING — STANDING BY.',
  `BRIDGE TARGET: $${MRR_TARGET.toLocaleString()}/MO. YOU GOT THIS.`,
  'ARIA CO-FOUNDER MODE: ENGAGED.',
  'READY TO DEPLOY. SAY THE WORD.',
];

const LISTEN_MSGS = [
  'LISTENING... GO AHEAD, RANDY.',
  'NEURAL PROCESSING ENGAGED.',
  'ANALYZING INPUT...',
  'PARSING COMMAND STREAM.',
  'ARIA STANDING BY...',
];

export default function App() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)); } catch { return null; }
  });

  const handleSetup = (cfg) => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    setConfig(cfg);
  };

  if (!config) return <Setup onComplete={handleSetup} />;
  return <CofounderApp config={config} onReset={() => { localStorage.removeItem(CONFIG_KEY); setConfig(null); }} />;
}

function CofounderApp({ config, onReset }) {
  // ── Core state ─────────────────────────────────────────────────────
  const [orbState, setOrbState]           = useState('idle');
  const [audioLevel, setAudioLevel]       = useState(0);
  const [messages, setMessages]           = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeToolCall, setActiveToolCall] = useState(null);
  const [alerts, setAlerts]               = useState([]);
  const [metrics, setMetrics]             = useState(null);
  const [clients, setClients]             = useState(null);
  const [wsStatus, setWsStatus]           = useState('connecting');
  const [interimText, setInterimText]     = useState('');
  const [alwaysOn, setAlwaysOn]           = useState(() => localStorage.getItem(ALWAYSON_KEY) === '1');
  const [convoMode, setConvoMode]         = useState(() => localStorage.getItem(CONVO_KEY) !== '0');

  // ── HUD-specific state ─────────────────────────────────────────────
  const [clockStr, setClockStr]   = useState('');
  const [dateStr, setDateStr]     = useState('');
  const [botDate, setBotDate]     = useState('');
  const [sysMetrics, setSysMetrics] = useState({ cpu: 31, ram: 63, swap: 61, up: 0.0, down: 0.0 });
  const [statusMsg, setStatusMsg] = useState(STATUS_MSGS[0]);
  const [textInput, setTextInput] = useState('');

  // ── Refs ───────────────────────────────────────────────────────────
  const wsRef             = useRef(null);
  const alertIdRef        = useRef(0);
  const historyRef        = useRef([]);
  const reconnectRef      = useRef(null);
  const alwaysOnRef       = useRef(alwaysOn);
  const convoModeRef      = useRef(convoMode);
  const startListeningRef = useRef(null);
  const msgIdxRef         = useRef(0);
  const voiceActiveRef    = useRef(false);
  const voiceIntensityRef = useRef(0);
  const voiceStripRef     = useRef(null);
  const waveCanvasRef     = useRef(null);
  // Streaming TTS — controller is created on first token of a reply,
  // sentences are pushed as they complete, end() is called on `done`.
  const ttsStreamRef      = useRef(null);
  const ttsBufferRef      = useRef({ text: '', cursor: 0 });

  useEffect(() => { alwaysOnRef.current  = alwaysOn;  }, [alwaysOn]);
  useEffect(() => { convoModeRef.current = convoMode; }, [convoMode]);

  // Keep voiceActiveRef in sync with orbState
  useEffect(() => {
    voiceActiveRef.current = orbState === 'listening' || orbState === 'speaking';
  }, [orbState]);

  // ── Clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2,'0');
      const m = String(now.getMinutes()).padStart(2,'0');
      const s = String(now.getSeconds()).padStart(2,'0');
      const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
      const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      setClockStr(`${h}:${m}:${s}`);
      setDateStr(`${days[now.getDay()]} ◈ ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);
      setBotDate(`${h}:${m} ◈ ${now.getDate()}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Simulated system metrics ───────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setSysMetrics({
        cpu:  22 + Math.floor(Math.random() * 26),
        ram:  58 + Math.floor(Math.random() * 15),
        swap: 55 + Math.floor(Math.random() * 14),
        up:   parseFloat((Math.random() * 2.5).toFixed(1)),
        down: parseFloat((Math.random() * 8.5).toFixed(1)),
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Status message cycling ─────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (!voiceActiveRef.current) {
        msgIdxRef.current = (msgIdxRef.current + 1) % STATUS_MSGS.length;
        setStatusMsg(STATUS_MSGS[msgIdxRef.current]);
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // ── Voice intensity smoother ───────────────────────────────────────
  // Smooths a 0-1 value that other animations read (voice strip + CosmicOrb).
  useEffect(() => {
    let animId;
    const tick = () => {
      animId = requestAnimationFrame(tick);
      const target = voiceActiveRef.current ? 1.0 : 0.0;
      voiceIntensityRef.current += (target - voiceIntensityRef.current) * 0.04;
    };
    tick();
    return () => cancelAnimationFrame(animId);
  }, []);


  // ── Voice strip canvas ─────────────────────────────────────────────
  useEffect(() => {
    const vs = voiceStripRef.current;
    if (!vs) return;
    let t = 0, animId;
    const draw = () => {
      animId = requestAnimationFrame(draw);
      vs.width = vs.offsetWidth || 300;
      vs.height = vs.offsetHeight || 28;
      const ctx = vs.getContext('2d');
      ctx.clearRect(0,0,vs.width,vs.height);
      const vi = voiceIntensityRef.current;
      if (vi < 0.02) return;
      const W=vs.width, H=vs.height, bars=48, bw=W/bars;
      for (let i=0; i<bars; i++) {
        const freq=0.18+i*0.04;
        const amp=(Math.sin(t*freq+i*0.4)*0.5+0.5)*(Math.sin(t*0.3+i)*0.3+0.7);
        const bh=(4+amp*(H-6))*vi, by=(H-bh)/2;
        ctx.fillStyle=`rgba(0,229,204,${(0.4+amp*0.6)*vi})`;
        ctx.fillRect(i*bw+1, by, Math.max(bw-2,1), bh);
      }
      t += 0.08;
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── Bottom wave canvas ─────────────────────────────────────────────
  useEffect(() => {
    const wc = waveCanvasRef.current;
    if (!wc) return;
    const ctx = wc.getContext('2d');
    let t = 0, animId;
    const draw = () => {
      animId = requestAnimationFrame(draw);
      ctx.clearRect(0,0,wc.width,wc.height);
      ctx.strokeStyle='rgba(0,229,204,0.6)'; ctx.lineWidth=1.5;
      ctx.shadowColor='rgba(0,229,204,0.4)'; ctx.shadowBlur=4;
      ctx.beginPath();
      for (let x=0; x<wc.width; x++) {
        const y=20+Math.sin((x/25)+t)*8+Math.sin((x/10)+t*1.7)*3;
        x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.strokeStyle='rgba(0,229,204,0.2)'; ctx.lineWidth=1; ctx.shadowBlur=0;
      ctx.beginPath();
      for (let x=0; x<wc.width; x++) {
        const y=20+Math.sin((x/15)+t*0.6)*5+Math.cos((x/30)+t)*4;
        x===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
      }
      ctx.stroke();
      t += 0.04;
    };
    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── WebSocket ──────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(config.serverUrl);
      wsRef.current = ws;
      setWsStatus('connecting');
      ws.onopen    = () => setWsStatus('open');
      ws.onerror   = () => setWsStatus('error');
      ws.onmessage = (e) => { let m; try { m=JSON.parse(e.data); } catch { return; } handleServerEvent(m); };
      ws.onclose   = () => {
        setWsStatus('closed');
        clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(connectWS, 3000);
      };
    } catch { setWsStatus('error'); }
  }, [config.serverUrl]);

  useEffect(() => {
    connectWS();
    return () => { clearTimeout(reconnectRef.current); wsRef.current?.close(); };
  }, [connectWS]);

  useEffect(() => {
    if (alwaysOn && wakeWord.supported) enterSleeping();
    return () => wakeWord.stop();
  }, []); // eslint-disable-line

  // ── TTS ────────────────────────────────────────────────────────────
  const speakText = useCallback((text, { onEnd } = {}) => {
    if (!text?.trim()) { onEnd?.(); return; }
    let spoken = text;
    if (text.length > MAX_TTS_CHARS) {
      const breakAt = text.lastIndexOf('. ', MAX_TTS_CHARS);
      spoken = (breakAt > 150 ? text.slice(0, breakAt+1) : text.slice(0, MAX_TTS_CHARS)) + ' Full response is in the chat.';
    }
    voice.speakWithServer(spoken, config.serverUrl, {
      onEnd,
      onError: () => setStatusMsg('VOICE ERROR — CHECK ELEVENLABS KEY OR BROWSER AUDIO'),
    });
  }, [config.serverUrl]);

  // ── Streaming TTS helpers ──────────────────────────────────────────
  // Detects completed sentences in the streaming buffer and pushes them to
  // the TTS controller as soon as each one closes. A sentence is "complete"
  // when we see one or more terminators followed by whitespace.
  const SENTENCE_END_RE = /[.!?]+\s/g;

  const ensureTtsStream = () => {
    if (ttsStreamRef.current && !ttsStreamRef.current.aborted) return ttsStreamRef.current;
    setOrbState('speaking');
    ttsStreamRef.current = voice.startStream(config.serverUrl, {
      onEnd: () => returnToBase(),
      onError: () => setStatusMsg('VOICE ERROR — CHECK SERVER OR BROWSER AUDIO'),
    });
    ttsBufferRef.current = { text: '', cursor: 0 };
    return ttsStreamRef.current;
  };

  const pushStreamingTokens = (chunk) => {
    if (!chunk) return;
    const stream = ensureTtsStream();
    const buf = ttsBufferRef.current;
    buf.text += chunk;
    SENTENCE_END_RE.lastIndex = buf.cursor;
    let m;
    let lastBoundary = buf.cursor;
    while ((m = SENTENCE_END_RE.exec(buf.text)) !== null) {
      const sentenceEnd = m.index + m[0].length;
      const sentence = buf.text.slice(lastBoundary, sentenceEnd).trim();
      if (sentence) stream.push(sentence);
      lastBoundary = sentenceEnd;
    }
    buf.cursor = lastBoundary;
  };

  const finishStreamingTokens = (fullText) => {
    // Flush any final non-terminated text, then signal end-of-stream.
    if (ttsStreamRef.current) {
      const buf = ttsBufferRef.current;
      // Prefer the full text from `done` if it's longer than what we accumulated
      // (handles any token we may have missed mid-stream).
      const total = fullText && fullText.length > buf.text.length ? fullText : buf.text;
      const tail = total.slice(buf.cursor).trim();
      if (tail) ttsStreamRef.current.push(tail);
      ttsStreamRef.current.end();
      ttsStreamRef.current = null;
      ttsBufferRef.current = { text: '', cursor: 0 };
    }
  };

  // ── Server events ──────────────────────────────────────────────────
  function handleServerEvent(msg) {
    switch (msg.type) {
      case 'token': {
        const chunk = msg.text || '';
        setStreamingText(prev => prev + chunk);
        pushStreamingTokens(chunk);
        break;
      }
      case 'tool_call':  setActiveToolCall({ name: msg.name, detail: msg.detail||null }); break;
      case 'tool_result': setActiveToolCall(null); break;
      case 'done': {
        const full = msg.text||'';
        setStreamingText(''); setActiveToolCall(null);
        if (full) {
          setMessages(prev => [...prev, { role:'assistant', text:full }]);
          historyRef.current = [...historyRef.current, { role:'assistant', content:full }];
          if (ttsStreamRef.current) {
            // Streaming already in progress — just flush the tail and close.
            finishStreamingTokens(full);
          } else {
            // No tokens were streamed (e.g., a tool-only turn) — speak whole text.
            setOrbState('speaking');
            speakText(full, { onEnd: () => returnToBase() });
          }
        } else { returnToBase(); }
        break;
      }
      case 'error':
        setStreamingText(''); setActiveToolCall(null);
        setMessages(prev => [...prev, { role:'assistant', text:`Error: ${msg.message}` }]);
        returnToBase();
        break;
      case 'metrics': setMetrics(msg.data); break;
      case 'clients': setClients(msg.data); break;
      case 'alert': {
        const id = ++alertIdRef.current;
        setAlerts(prev => [{ ...msg, id, timestamp: Date.now() }, ...prev].slice(0,8));
        speakText(msg.body);
        break;
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────
  const enterSleeping = useCallback(() => {
    setOrbState('sleeping');
    wakeWord.start(
      (afterText) => handleWake(afterText),
      () => { setAlwaysOn(false); localStorage.setItem(ALWAYSON_KEY,'0'); setOrbState('idle'); },
    );
  }, []);

  const returnToBase = useCallback(() => {
    if (convoModeRef.current) { setOrbState('idle'); setTimeout(() => startListeningRef.current?.(), 900); }
    else if (alwaysOnRef.current) { enterSleeping(); }
    else { setOrbState('idle'); }
  }, [enterSleeping]);

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setStatusMsg(`WS NOT CONNECTED — STATE: ${wsRef.current?.readyState ?? 'NULL'}`);
      setTimeout(() => returnToBase(), 3000);
      return;
    }
    setMessages(prev => [...prev, { role:'user', text }]);
    historyRef.current = [...historyRef.current, { role:'user', content:text }];
    if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);
    wsRef.current.send(JSON.stringify({
      type:'chat', text,
      history: historyRef.current.slice(0,-1),
      context: { company:config.company, cofounderName:config.cofounderName, businessDescription:config.businessDescription },
    }));
    setOrbState('thinking');
  }, [returnToBase]);

  const handleWake = useCallback((afterText) => {
    setOrbState('idle');
    if (afterText && afterText.length > 3) { setTimeout(() => sendMessage(afterText), 150); }
    else { setTimeout(() => startListening(), 200); }
  }, [sendMessage]); // eslint-disable-line

  const startListening = useCallback(async () => {
    if (!voice.supported) {
      setStatusMsg('MIC ERROR: CHROME OR EDGE REQUIRED');
      setTimeout(() => returnToBase(), 3000);
      return;
    }
    setOrbState('listening');
    setInterimText('');
    setStatusMsg(LISTEN_MSGS[Math.floor(Math.random()*LISTEN_MSGS.length)]);
    const finalText = await voice.startListening({
      onInterim: (t) => setInterimText(t),
      onFinal:   ()  => setInterimText(''),
      onLevel:   setAudioLevel,
      onEnd:     ()  => { setAudioLevel(0); setInterimText(''); },
      onError:   (err) => {
        const msg = err === 'not-allowed'  ? 'MIC BLOCKED — CHECK CHROME PERMISSIONS' :
                    err === 'no-speech'    ? 'NO SPEECH DETECTED' :
                    err === 'network'      ? 'NETWORK ERROR — CHECK CONNECTION' :
                    `MIC ERROR: ${err.toUpperCase()}`;
        setStatusMsg(msg);
      },
    });
    if (finalText.trim()) {
      setStatusMsg(`HEARD: "${finalText.trim().slice(0, 40)}"`);
      sendMessage(finalText.trim());
    } else {
      setStatusMsg('NO SPEECH CAPTURED — TRY AGAIN');
      setTimeout(() => returnToBase(), 2000);
    }
  }, [sendMessage, returnToBase]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  const handleOrbClick = useCallback(async () => {
    if (orbState==='speaking')  { voice.cancelSpeaking(); returnToBase(); return; }
    if (orbState==='listening') { voice.stopListening(); returnToBase(); return; }
    if (orbState==='sleeping')  { wakeWord.stop(); startListening(); return; }
    if (orbState!=='idle') return;
    startListening();
  }, [orbState, returnToBase, startListening]);

  const toggleAlwaysOn = useCallback(() => {
    const next = !alwaysOnRef.current;
    setAlwaysOn(next); localStorage.setItem(ALWAYSON_KEY, next?'1':'0');
    if (next) {
      if (!wakeWord.supported) { alert('Wake word requires Chrome or Edge with microphone access.'); setAlwaysOn(false); localStorage.setItem(ALWAYSON_KEY,'0'); return; }
      enterSleeping();
    } else { wakeWord.stop(); if (orbState==='sleeping') setOrbState('idle'); }
  }, [orbState, enterSleeping]);

  const toggleConvoMode = useCallback(() => {
    const next = !convoModeRef.current;
    setConvoMode(next); localStorage.setItem(CONVO_KEY, next?'1':'0');
    if (next && alwaysOnRef.current) { setAlwaysOn(false); localStorage.setItem(ALWAYSON_KEY,'0'); wakeWord.stop(); }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code==='Space' && e.target.tagName!=='INPUT' && e.target.tagName!=='TEXTAREA') {
        e.preventDefault(); handleOrbClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleOrbClick]);

  // ── Derived display values ─────────────────────────────────────────
  const currentMrr = metrics?.mrr?.grossMrr ?? metrics?.revenue?.mrr ?? metrics?.currentMrr ?? metrics?.current_mrr ?? 1950;
  const bridgePct  = Math.min(Math.round((currentMrr / MRR_TARGET) * 100), 100);
  const gap        = Math.max(MRR_TARGET - currentMrr, 0);

  const wsColor = { connecting:'amber', open:'', closed:'red', error:'red' }[wsStatus] || '';

  // Merge alerts + recent messages for Intel Feed
  const intelItems = [
    ...alerts.map(a => ({ id:`a-${a.id}`, icon: a.level==='warn'?'amber':'', text: a.body||a.message||'', time: 'ALERT' })),
    ...[...messages].reverse().slice(0,4).map((m,i) => ({
      id:`m-${i}`, icon: m.role==='user'?'user':'',
      text: m.text.length > 80 ? m.text.slice(0,80)+'...' : m.text,
      time: m.role==='user' ? 'YOU' : 'ARIA',
    })),
  ].slice(0,6);

  const centerStatusText = interimText
    ? `"${interimText}"`
    : streamingText
      ? streamingText.slice(-60)
      : activeToolCall
        ? `⚡ ${activeToolCall.name.replace(/_/g,' ').toUpperCase()}`
        : statusMsg;

  const isListening = orbState === 'listening';
  const orbStateClass = `state-${orbState}`;

  // Map 5-state orb to cosmic uState: idle/sleeping → 0, listening/thinking → 0.5, speaking → 1
  const orbUState = orbState === 'speaking'
    ? 1.0
    : (orbState === 'listening' || orbState === 'thinking')
      ? 0.5
      : 0.0;
  const cosmicDim = orbState === 'sleeping';

  // Client data (fall back to placeholder)
  const clientList = clients && clients.length > 0 ? clients : [
    { name:'BREAK-FIX CLIENT A', status:'ACTIVE', type:'active' },
    { name:'BREAK-FIX CLIENT B', status:'ACTIVE', type:'active' },
    { name:'PROSPECT — SMB',     status:'PIPELINE', type:'pipeline' },
    { name:'PROSPECT — MSP',     status:'PIPELINE', type:'pipeline' },
  ];

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <>
    <CosmicOrb uStateTarget={orbUState} voiceIntensityRef={voiceIntensityRef} dim={cosmicDim} />
    <div className={`hud-root ${orbStateClass}`}>

      {/* ── TOP BAR ── */}
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="brand">A.R.I.A.</span>
          <div className="status-pill"><div className={`dot ${wsColor}`} /> {wsStatus.toUpperCase()}</div>
          <div className="status-pill"><div className="dot" /> J&amp;J CONSULTING ACTIVE</div>
          {convoMode && <div className="status-pill"><div className="dot" /> CONVO MODE</div>}
          {alwaysOn  && <div className="status-pill"><div className="dot" /> ALWAYS-ON</div>}
        </div>

        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', textAlign:'center' }}>
          <div className="top-clock">{clockStr}</div>
          <div className="top-date">{dateStr}</div>
        </div>

        <div className="top-bar-right">
          <div className="status-pill">GREENWOOD, IN</div>
          <div className="status-pill"><div className="dot" /> MRR TRACKING</div>
          <button onClick={toggleConvoMode} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', fontSize:9, letterSpacing:2, fontFamily:'Share Tech Mono' }}>
            {convoMode ? '[ CONVO ON ]' : '[ CONVO OFF ]'}
          </button>
          <button onClick={toggleAlwaysOn} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-dim)', fontSize:9, letterSpacing:2, fontFamily:'Share Tech Mono' }}>
            {alwaysOn ? '[ WAKE ON ]' : '[ WAKE OFF ]'}
          </button>
          <button onClick={onReset} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:9, letterSpacing:2, fontFamily:'Share Tech Mono' }}>
            [ RESET ]
          </button>
          <div className="brand" style={{ fontSize:9, letterSpacing:2, opacity:0.5 }}>JACK &amp; JEWELL LLC</div>
        </div>
      </div>

      {/* ── LEFT COLUMN ── */}
      <div className="col-left">

        {/* Client Status */}
        <div className="panel" style={{ flex:'0 0 auto' }}>
          <div className="scan-line" /><div className="scan-line" />
          <div className="panel-header">
            <span className="panel-title">CLIENT STATUS</span>
            <span className="panel-tag">ACTIVE ◈ {clientList.filter(c=>(c.type||c.status||'').toLowerCase().includes('active')).length}</span>
          </div>
          <div className="panel-body">
            {clientList.map((c, i) => {
              const isPipeline = (c.type||c.status||'').toLowerCase().includes('pipeline') || (c.type||'').toLowerCase().includes('prospect');
              return (
                <div key={c.id||i} className="client-item">
                  <div className={`client-dot ${isPipeline?'amber':''}`} />
                  <span className="client-name">{(c.name||c.company_name||'CLIENT').toUpperCase()}</span>
                  <span className="client-status">{(c.status||'ACTIVE').toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue Bridge */}
        <div className="panel" style={{ flex:'0 0 auto' }}>
          <div className="panel-header">
            <span className="panel-title">REVENUE BRIDGE</span>
            <span className="panel-tag">TARGET: ${(MRR_TARGET/1000).toFixed(0)}K/MO</span>
          </div>
          <div className="panel-body">
            <div style={{ fontSize:8, letterSpacing:2, color:'var(--text-muted)' }}>CURRENT MRR</div>
            <div className="rev-big">${currentMrr.toLocaleString()}</div>
            <div className="rev-target">TARGET: ${MRR_TARGET.toLocaleString()} / MONTH</div>
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:8, letterSpacing:1, color:'var(--text-muted)' }}>BRIDGE PROGRESS</span>
                <span style={{ fontSize:8, color:'var(--teal)' }}>{bridgePct}%</span>
              </div>
              <div className="rev-track">
                <div className="rev-fill" style={{ width:`${bridgePct}%` }} />
              </div>
            </div>
            <div style={{ marginTop:10 }}>
              <div className="metric-row">
                <span className="metric-label">NORTH STAR ARR</span>
                <span className="metric-val" style={{ fontSize:9 }}>$1M</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">GAP TO FULL-TIME</span>
                <span className="metric-val amber" style={{ fontSize:9 }}>${gap.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* System Diagnostics */}
        <div className="panel" style={{ flex:1 }}>
          <div className="panel-header">
            <span className="panel-title">SYSTEM DIAG</span>
            <span className="panel-tag" id="uptime">ARIA SERVER</span>
          </div>
          <div className="panel-body">
            <div className="bar-meter">
              {[
                { label:'CPU',    pct:sysMetrics.cpu,  amber: sysMetrics.cpu>75 },
                { label:'RAM',    pct:sysMetrics.ram,  amber: sysMetrics.ram>70 },
                { label:'SWAP',   pct:sysMetrics.swap, amber: false },
              ].map(({ label, pct, amber }) => (
                <div key={label} className="bar-row">
                  <span className="bar-label">{label}</span>
                  <div className="bar-track">
                    <div className={`bar-fill ${amber?'amber':''}`} style={{ width:`${pct}%` }} />
                  </div>
                  <span className="bar-pct">{pct}%</span>
                </div>
              ))}
            </div>
            <div className="net-grid" style={{ marginTop:8 }}>
              <div className="net-cell">
                <div className="net-cell-label">↑ UPLOAD</div>
                <div className="net-cell-val">{sysMetrics.up.toFixed(1)}</div>
              </div>
              <div className="net-cell">
                <div className="net-cell-label">↓ DOWNLOAD</div>
                <div className="net-cell-val">{sysMetrics.down.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── CENTER ── */}
      <div className={`col-center ${orbStateClass}`}>
        {/* CosmicOrb is rendered at fixed full-viewport behind the HUD root */}

        <div className="corner corner-tl" />
        <div className="corner corner-tr" />
        <div className="corner corner-bl" />
        <div className="corner corner-br" />

        {/* Streaming / tool overlay */}
        {streamingText && (
          <div className="streaming-panel">{streamingText}</div>
        )}
        {activeToolCall && !streamingText && (
          <div className="tool-badge">⚡ {activeToolCall.name.replace(/_/g,' ').toUpperCase()}</div>
        )}

        {/* Top label */}
        <div style={{ position:'absolute', top:20, left:'50%', transform:'translateX(-50%)', textAlign:'center', zIndex:10 }}>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, letterSpacing:6, color:'var(--teal)', textShadow:'0 0 20px var(--teal-glow-strong)' }}>A.R.I.A.</div>
          <div style={{ fontSize:8, letterSpacing:4, color:'var(--text-dim)', marginTop:3 }}>ADAPTIVE REASONING &amp; INTELLIGENT AUTOMATION</div>
        </div>

        {/* Invisible click target over the cosmic orb so the user can tap it like before. */}
        <button
          className="cosmic-orb-hit"
          onClick={handleOrbClick}
          aria-label="Toggle voice"
        >
          <div className="aria-label">ARIA</div>
          <div className="aria-sub">{{ idle:'READY', listening:'LISTENING', thinking:'THINKING', speaking:'SPEAKING', sleeping:'SLEEPING' }[orbState] || orbState.toUpperCase()}</div>
        </button>

        {/* Voice waveform strip */}
        <canvas
          ref={voiceStripRef}
          id="voiceStrip"
          className={isListening || orbState==='speaking' ? 'visible' : ''}
        />

        {/* Status text */}
        <div style={{ position:'absolute', bottom:106, left:'50%', transform:'translateX(-50%)', textAlign:'center', zIndex:20, whiteSpace:'nowrap' }}>
          <div className="aria-status-text">{centerStatusText}</div>
        </div>

        {/* Mic button + Convo Mode toggle */}
        <div style={{ position:'absolute', bottom:54, left:'50%', transform:'translateX(-50%)', zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
          <button className={`mic-btn ${isListening?'active':''}`} style={{ position:'relative', transform:'none', left:'auto', bottom:'auto' }} onClick={handleOrbClick}>
            <div className="mic-ring">
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div className="mic-body" />
                <div className="mic-stand" />
                <div className="mic-base" />
              </div>
            </div>
            <div className="mic-label">{isListening ? 'LISTENING...' : 'PRESS TO SPEAK'}</div>
          </button>
          <button
            onClick={toggleConvoMode}
            style={{
              background: convoMode ? 'rgba(0,229,204,0.12)' : 'rgba(0,229,204,0.03)',
              border: `1px solid ${convoMode ? 'var(--teal)' : 'rgba(0,229,204,0.2)'}`,
              borderRadius: 2,
              color: convoMode ? 'var(--teal)' : 'var(--text-muted)',
              fontSize: 8, letterSpacing: 2,
              fontFamily: "'Share Tech Mono', monospace",
              padding: '3px 10px', cursor: 'pointer',
              boxShadow: convoMode ? '0 0 10px rgba(0,229,204,0.2)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {convoMode ? '⬤ CONVO MODE ON' : '○ CONVO MODE OFF'}
          </button>
        </div>

        {/* Power bar */}
        <div className="power-bar-wrap">
          <div className="power-label">
            <span>SYSTEM POWER</span>
            <span>100% NOMINAL</span>
          </div>
          <div className="power-track"><div className="power-fill" /></div>
        </div>

        {/* Side labels */}
        <div style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:16, zIndex:10 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:7, letterSpacing:2, color:'var(--text-muted)' }}>VOICE</div>
            <div style={{ fontSize:10, color:'var(--teal)', fontFamily:"'Orbitron',sans-serif" }}>{orbState==='listening'?'ACTIVE':'READY'}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
            <div style={{ fontSize:7, letterSpacing:2, color:'var(--text-muted)' }}>MODE</div>
            <div style={{ fontSize:10, color:'var(--amber)', fontFamily:"'Orbitron',sans-serif" }}>CO-FNDR</div>
          </div>
        </div>

        <div style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', display:'flex', flexDirection:'column', gap:16, textAlign:'right', zIndex:10 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'flex-end' }}>
            <div style={{ fontSize:7, letterSpacing:2, color:'var(--text-muted)' }}>PERSONA</div>
            <div style={{ fontSize:10, color:'var(--teal)', fontFamily:"'Orbitron',sans-serif" }}>ACTIVE</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'flex-end' }}>
            <div style={{ fontSize:7, letterSpacing:2, color:'var(--text-muted)' }}>WS</div>
            <div style={{ fontSize:10, color: wsStatus==='open'?'var(--teal)':'var(--amber)', fontFamily:"'Orbitron',sans-serif" }}>{wsStatus.toUpperCase()}</div>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="col-right">

        {/* Priority Tasks */}
        <div className="panel" style={{ flex:'0 0 auto' }}>
          <div className="scan-line" /><div className="scan-line" />
          <div className="panel-header">
            <span className="panel-title">PRIORITY TASKS</span>
            <span className="panel-tag">J&amp;J OPS</span>
          </div>
          <div className="panel-body">
            {[
              { done:true,  label:'Set up recurring billing system',  pri:'low'  },
              { done:false, label:'Convert break-fix → MSP contract', pri:'high' },
              { done:false, label:'Close SMB pipeline prospect',      pri:'high' },
              { done:false, label:'ARIA persona voice training',      pri:'med'  },
              { done:false, label:'Build service tier packages',      pri:'med'  },
            ].map((t,i) => (
              <div key={i} className="task-item">
                <div className={`task-check ${t.done?'done':''}`} />
                <span className={`task-label ${t.done?'done':''}`}>{t.label}</span>
                <span className={`task-pri ${t.pri}`}>{t.pri.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ARIA Intel Feed */}
        <div className="panel" style={{ flex:'0 0 auto' }}>
          <div className="panel-header">
            <span className="panel-title">ARIA INTEL FEED</span>
            <span className="panel-tag">{intelItems.length} ENTRIES</span>
          </div>
          <div className="panel-body">
            {intelItems.length === 0 ? (
              <div className="alert-item">
                <div className="alert-icon" />
                <div>
                  <div className="alert-text">MRR gap to bridge target: ${gap.toLocaleString()}. Awaiting your commands.</div>
                  <div className="alert-time">SYSTEM</div>
                </div>
              </div>
            ) : intelItems.map(item => (
              <div key={item.id} className="alert-item">
                <div className={`alert-icon ${item.icon}`} />
                <div>
                  <div className="alert-text">{item.text}</div>
                  <div className="alert-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operations */}
        <div className="panel" style={{ flex:1 }}>
          <div className="panel-header">
            <span className="panel-title">OPERATIONS</span>
            <span className="panel-tag">LIVE</span>
          </div>
          <div className="panel-body">
            <div className="quick-grid">
              <div className="quick-cell">
                <div className="quick-cell-label">CLIENTS</div>
                <div className="quick-cell-val">{String(clientList.filter(c=>!(c.type||c.status||'').toLowerCase().includes('pipeline')&&!(c.type||'').toLowerCase().includes('prospect')).length).padStart(2,'0')}</div>
              </div>
              <div className="quick-cell">
                <div className="quick-cell-label">PIPELINE</div>
                <div className="quick-cell-val">{String(clientList.filter(c=>(c.type||c.status||'').toLowerCase().includes('pipeline')||(c.type||'').toLowerCase().includes('prospect')).length).padStart(2,'0')}</div>
              </div>
              <div className="quick-cell">
                <div className="quick-cell-label">MRR</div>
                <div className="quick-cell-val" style={{ fontSize:9 }}>${(currentMrr/1000).toFixed(1)}K</div>
              </div>
              <div className="quick-cell">
                <div className="quick-cell-label">BRIDGE</div>
                <div className="quick-cell-val" style={{ fontSize:9 }}>{bridgePct}%</div>
              </div>
            </div>
            <div style={{ marginTop:10 }}>
              <div className="metric-row">
                <span className="metric-label">FIRM AGE</span>
                <span className="metric-val" style={{ fontSize:9 }}>~2 YRS</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">STATUS</span>
                <span className="metric-val amber" style={{ fontSize:9 }}>SIDE-PRJ</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">ARIA BUILD</span>
                <span className="metric-val" style={{ fontSize:9 }}>IN PROG</span>
              </div>
              <div className="metric-row">
                <span className="metric-label">NEXT GOAL</span>
                <span className="metric-val" style={{ fontSize:9 }}>FULL-TIME</span>
              </div>
            </div>
            <div style={{ marginTop:10, border:'1px solid rgba(0,229,204,0.1)', borderRadius:2, overflow:'hidden' }}>
              <canvas ref={waveCanvasRef} id="waveCanvas" width={230} height={40} />
            </div>
          </div>
        </div>

      </div>

      {/* ── BOTTOM BAR ── */}
      <div className="bottom-bar">
        <div style={{ padding:'0 14px', fontSize:9, letterSpacing:3, color:'var(--text-dim)', whiteSpace:'nowrap', borderRight:'1px solid var(--border)' }}>
          ARIA FEED
        </div>
        <div className="ticker-track">
          <div className="ticker-content">
            JACK &amp; JEWELL CONSULTING LLC &nbsp;◈&nbsp; GREENWOOD, IN &nbsp;◈&nbsp; MRR TARGET: ${MRR_TARGET.toLocaleString()}/MO &nbsp;◈&nbsp; CURRENT MRR: ${currentMrr.toLocaleString()} &nbsp;◈&nbsp; BRIDGE: {bridgePct}% &nbsp;◈&nbsp; ARIA BUILD: IN PROGRESS &nbsp;◈&nbsp; NORTH STAR: $1M ARR &nbsp;◈&nbsp; CONVERT BREAK-FIX → RETAINER MODEL &nbsp;◈&nbsp; ARIA PERSONA: SNARKY CASUAL / SHARP PROFESSIONAL &nbsp;◈&nbsp; SYSTEM POWER: 100% NOMINAL &nbsp;◈&nbsp;
          </div>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (textInput.trim()) { sendMessage(textInput); setTextInput(''); } }} style={{ display:'flex' }}>
          <input
            className="hud-text-input"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="TYPE COMMAND..."
            disabled={wsStatus !== 'open' || orbState === 'thinking' || orbState === 'speaking'}
          />
        </form>
        <div style={{ padding:'0 14px', fontSize:9, letterSpacing:2, color:'var(--text-dim)', whiteSpace:'nowrap', borderLeft:'1px solid var(--border)' }}>
          {botDate}
        </div>
      </div>

    </div>
    </>
  );
}
