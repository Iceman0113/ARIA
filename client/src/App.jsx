import { useState, useEffect, useRef, useCallback } from 'react';
import { voice } from './Voice.js';
import { wakeWord } from './WakeWord.js';
import Setup from './components/Setup.jsx';
import TopBar from './shell/TopBar.jsx';
import MicBar from './shell/MicBar.jsx';
import NavChips from './shell/NavChips.jsx';
import Console from './pages/Console.jsx';

const CONFIG_KEY   = 'cofounder_config_v1';
const ALWAYSON_KEY = 'aria_alwayson';
const CONVO_KEY    = 'aria_convo_mode';
const MAX_TTS_CHARS = 850;
const CONVO_TIMEOUT_MS = 30000; // wake mode stays in conversation this long after the last activity, then returns to standby
const MRR_TARGET = 16500;

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

function CofounderApp({ config }) {
  // ── State ───────────────────────────────────────────────────────
  const [orbState, setOrbState]           = useState('idle');
  const [messages, setMessages]           = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeToolCall, setActiveToolCall] = useState(null);
  const [alerts, setAlerts]               = useState([]);
  const [metrics, setMetrics]             = useState(null);
  const [clients, setClients]             = useState(null);
  const [wsStatus, setWsStatus]           = useState('connecting');
  const [textInput, setTextInput]         = useState('');
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [activeRoute, setActiveRoute]     = useState('console');
  const [tokens, setTokens]               = useState(12800);
  const [spend, setSpend]                 = useState(0.42);
  const [latency, setLatency]             = useState(0.74);
  const [interim, setInterim]             = useState('');
  const [sttError, setSttError]           = useState('');
  const [heard, setHeard]                 = useState('');
  const [convoMode, setConvoMode]         = useState(() => localStorage.getItem(CONVO_KEY) !== '0');
  const [alwaysOn, setAlwaysOn]           = useState(() => localStorage.getItem(ALWAYSON_KEY) === '1');
  const [workStates, setWorkStates]       = useState({});
  const [mapRefreshKey, setMapRefreshKey] = useState(0);

  // ── Refs ────────────────────────────────────────────────────────
  const wsRef        = useRef(null);
  const alertIdRef   = useRef(0);
  const historyRef   = useRef([]);
  const reconnectRef = useRef(null);
  const convoDeadlineRef = useRef(0); // wake-mode conversation expiry timestamp
  const alwaysOnRef  = useRef(alwaysOn);
  const convoModeRef = useRef(convoMode);
  const startListeningRef = useRef(null);
  const ttsStreamRef = useRef(null);
  const ttsBufferRef = useRef({ text: '', cursor: 0 });
  const replyStartRef = useRef(0);

  useEffect(() => { alwaysOnRef.current  = alwaysOn;  }, [alwaysOn]);
  useEffect(() => { convoModeRef.current = convoMode; }, [convoMode]);

  // ── Live token/spend simulation (until real metrics wire) ───────
  useEffect(() => {
    const id = setInterval(() => {
      setTokens(t => t + Math.floor(Math.random() * 280));
      setSpend(s => s + Math.random() * 0.004);
    }, 2400);
    return () => clearInterval(id);
  }, []);

  // ── WebSocket ───────────────────────────────────────────────────
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

  // ── TTS streaming helpers (unchanged from old App.jsx) ──────────
  const SENTENCE_END_RE = /[.!?]+\s/g;
  const ensureTtsStream = () => {
    if (ttsStreamRef.current && !ttsStreamRef.current.aborted) return ttsStreamRef.current;
    setOrbState('speaking');
    ttsStreamRef.current = voice.startStream(config.serverUrl, {
      onEnd: () => returnToBase(),
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
    let m, lastBoundary = buf.cursor;
    while ((m = SENTENCE_END_RE.exec(buf.text)) !== null) {
      const sentenceEnd = m.index + m[0].length;
      const sentence = buf.text.slice(lastBoundary, sentenceEnd).trim();
      if (sentence) stream.push(sentence);
      lastBoundary = sentenceEnd;
    }
    buf.cursor = lastBoundary;
  };
  const finishStreamingTokens = (fullText) => {
    if (ttsStreamRef.current) {
      const buf = ttsBufferRef.current;
      const total = fullText && fullText.length > buf.text.length ? fullText : buf.text;
      const tail = total.slice(buf.cursor).trim();
      if (tail) ttsStreamRef.current.push(tail);
      ttsStreamRef.current.end();
      ttsStreamRef.current = null;
      ttsBufferRef.current = { text: '', cursor: 0 };
    }
  };
  const speakText = useCallback((text, { onEnd } = {}) => {
    if (!text?.trim()) { onEnd?.(); return; }
    let spoken = text;
    if (text.length > MAX_TTS_CHARS) {
      const breakAt = text.lastIndexOf('. ', MAX_TTS_CHARS);
      spoken = (breakAt > 150 ? text.slice(0, breakAt+1) : text.slice(0, MAX_TTS_CHARS)) + ' Full response is in the chat.';
    }
    voice.speakWithServer(spoken, config.serverUrl, { onEnd });
  }, [config.serverUrl]);

  // ── Server events ───────────────────────────────────────────────
  function handleServerEvent(msg) {
    switch (msg.type) {
      case 'token': {
        const chunk = msg.text || '';
        setStreamingText(prev => prev + chunk);
        pushStreamingTokens(chunk);
        break;
      }
      case 'tool_call':   setActiveToolCall({ name: msg.name, detail: msg.detail || null }); break;
      case 'tool_result': setActiveToolCall(null); break;
      case 'done': {
        const full = msg.text || '';
        setStreamingText(''); setActiveToolCall(null);
        if (replyStartRef.current) {
          const elapsed = (Date.now() - replyStartRef.current) / 1000;
          setLatency(elapsed);
          replyStartRef.current = 0;
        }
        if (full) {
          setMessages(prev => [...prev, { role:'assistant', text: full }]);
          historyRef.current = [...historyRef.current, { role: 'assistant', content: full }];
          if (ttsStreamRef.current) finishStreamingTokens(full);
          else { setOrbState('speaking'); speakText(full, { onEnd: () => returnToBase() }); }
        } else { returnToBase(); }
        break;
      }
      case 'error':
        setStreamingText(''); setActiveToolCall(null);
        returnToBase();
        break;
      case 'metrics': setMetrics(msg.data); break;
      case 'clients': setClients(msg.data); break;
      case 'alert': {
        const id = ++alertIdRef.current;
        setAlerts(prev => [{ ...msg, id, timestamp: Date.now() }, ...prev].slice(0, 8));
        speakText(msg.body);
        break;
      }
      case 'agent_state':
        setWorkStates(prev => ({ ...prev, [msg.slug]: { state: msg.state, updatedAt: Date.now() } }));
        break;
      case 'freshness_update':
        window.dispatchEvent(new CustomEvent('aria:freshness', { detail: msg }));
        break;
      case 'node_added':
        window.dispatchEvent(new CustomEvent('aria:node_added', { detail: msg.node }));
        break;
      case 'node_removed':
        window.dispatchEvent(new CustomEvent('aria:node_removed', { detail: { id: msg.id } }));
        break;
      case 'map_refresh':
        setMapRefreshKey(k => k + 1);
        break;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────
  const enterSleeping = useCallback(() => {
    setOrbState('sleeping');
    wakeWord.start(
      (afterText) => handleWake(afterText),
      () => { setAlwaysOn(false); localStorage.setItem(ALWAYSON_KEY, '0'); setOrbState('idle'); },
    );
  }, []); // eslint-disable-line

  // Enable wake-word ("hey ARIA") mode: persist it, drop convo auto-listen in
  // favour of standby, and start listening for the phrase if idle.
  const enableWakeWord = useCallback(() => {
    setAlwaysOn(true);  localStorage.setItem(ALWAYSON_KEY, '1');  alwaysOnRef.current  = true;
    setConvoMode(false); localStorage.setItem(CONVO_KEY, '0');    convoModeRef.current = false;
  }, []);

  const toggleWakeWord = useCallback(() => {
    if (alwaysOnRef.current) {
      setAlwaysOn(false); localStorage.setItem(ALWAYSON_KEY, '0'); alwaysOnRef.current = false;
      wakeWord.stop();
      setOrbState(s => (s === 'sleeping' ? 'idle' : s));
    } else {
      enableWakeWord();
      setOrbState(s => (s === 'idle' ? 'sleeping' : s));
      if (orbState === 'idle') enterSleeping();
    }
  }, [orbState, enableWakeWord, enterSleeping]);

  const returnToBase = useCallback(() => {
    if (alwaysOnRef.current) {
      // Wake mode: stay in conversation — reopen the mic after each reply and keep
      // the window alive for CONVO_TIMEOUT_MS. The no-speech path drops to standby.
      convoDeadlineRef.current = Date.now() + CONVO_TIMEOUT_MS;
      setOrbState('idle');
      setTimeout(() => startListeningRef.current?.(), 500);
    } else if (convoModeRef.current) {
      setOrbState('idle'); setTimeout(() => startListeningRef.current?.(), 900);
    } else {
      setOrbState('idle');
    }
  }, []);

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];
    if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);
    replyStartRef.current = Date.now();
    wsRef.current.send(JSON.stringify({
      type: 'chat', text,
      history: historyRef.current.slice(0, -1),
      context: { company: config.company, cofounderName: config.cofounderName, businessDescription: config.businessDescription },
    }));
    setOrbState('thinking');
  }, [config]);

  const handleWake = useCallback((afterText) => {
    convoDeadlineRef.current = Date.now() + CONVO_TIMEOUT_MS; // open the conversation window
    setOrbState('idle');
    if (afterText && afterText.length > 3) { setTimeout(() => sendMessage(afterText), 150); }
    else { setTimeout(() => startListening(), 200); }
  }, [sendMessage]); // eslint-disable-line

  const startListening = useCallback(async () => {
    if (!voice.supported) { setSttError('Voice input needs Chrome or Edge.'); return; }
    setSttError('');
    setInterim('');
    setHeard('');
    setOrbState('listening');
    const finalText = await voice.startListening({
      onInterim: (t) => setInterim(t),
      onFinal:   (t) => setInterim(t),
      onLevel:   () => {},
      onEnd:     () => setInterim(''),
      onError:   (code) => {
        // In wake/conversation mode, silence between turns is expected — don't nag.
        if (code === 'no-speech' && alwaysOnRef.current) return;
        setSttError(sttErrorMessage(code));
      },
    });
    setInterim('');
    if (finalText.trim()) {
      setHeard(finalText.trim());
      if (!alwaysOnRef.current) enableWakeWord();   // auto-arm wake word after first voice use
      convoDeadlineRef.current = Date.now() + CONVO_TIMEOUT_MS; // Randy spoke → extend the window
      sendMessage(finalText.trim());
    }
    else if (alwaysOnRef.current) {
      // No speech this window. Keep listening for a follow-up until the conversation
      // window expires, then drop back to "hey ARIA" standby.
      if (Date.now() < convoDeadlineRef.current) {
        setTimeout(() => startListeningRef.current?.(), 300);
      } else {
        enterSleeping();
      }
    }
    else returnToBase();
  }, [sendMessage, returnToBase, enableWakeWord, enterSleeping]);

  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

  // If wake-word mode was enabled in a previous session, resume standby on load.
  useEffect(() => {
    if (alwaysOn) enterSleeping();
  }, []); // eslint-disable-line

  const handleMicClick = useCallback(() => {
    if (orbState === 'speaking')  { voice.cancelSpeaking(); returnToBase(); return; }
    if (orbState === 'listening') { voice.stopListening(); returnToBase(); return; }
    if (orbState === 'sleeping')  { wakeWord.stop(); startListening(); return; }
    if (orbState !== 'idle') return;
    startListening();
  }, [orbState, returnToBase, startListening]);

  const handleTextSubmit = useCallback((text) => {
    sendMessage(text);
    setTextInput('');
  }, [sendMessage]);

  // ── Derived ─────────────────────────────────────────────────────
  const currentMrr = metrics?.mrr?.grossMrr ?? metrics?.revenue?.mrr ?? metrics?.currentMrr ?? metrics?.current_mrr ?? 1950;

  const actions = (metrics?.actions || []).slice(0, 5).map((a, i) => ({
    id: a.id || `a-${i}`,
    title: a.title || a.label || 'Untitled action',
    meta: a.meta || a.detail || '',
    due: a.due || a.dueLabel || '',
    urgency: a.urgency || (a.overdue ? 'hot' : a.dueWithinDays <= 1 ? 'soon' : a.dueWithinDays <= 3 ? 'today' : 'future'),
  }));
  const intel = alerts.slice(0, 4).map((a, i) => ({
    id: a.id || `i-${i}`,
    agent: a.agent || a.from || 'scout',
    source: a.source || a.kind || 'signal',
    msg: a.body || a.message || '',
    time: a.timestamp ? relativeTime(a.timestamp) : 'now',
  }));

  // ── Render ──────────────────────────────────────────────────────
  return (
    <>
      <TopBar
        tokens={tokens}
        spend={spend}
        mrr={currentMrr}
        mrrTarget={MRR_TARGET}
        latency={latency}
        presence={orbState}
      />
      <NavChips active={activeRoute} onNav={setActiveRoute} />

      {activeRoute === 'console' && (
        <Console
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          workStates={workStates}
          refreshKey={mapRefreshKey}
          mrr={currentMrr}
          mrrTarget={MRR_TARGET}
          spendToday={spend}
          tokensToday={tokens}
          avgLatency={latency}
          actions={actions}
          intel={intel}
        />
      )}

      <MicBar
        state={orbState}
        latency={latency}
        drawerOpen={drawerOpen}
        textValue={textInput}
        onTextChange={setTextInput}
        onMicClick={handleMicClick}
        onSubmit={handleTextSubmit}
        onToggleDrawer={() => setDrawerOpen(o => !o)}
        interim={interim}
        sttError={sttError}
        heard={heard}
        wakeWord={alwaysOn}
        onToggleWakeWord={toggleWakeWord}
      />
    </>
  );
}

function sttErrorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Mic blocked — allow the microphone for localhost in Chrome (address-bar icon) and macOS Settings → Privacy → Microphone.';
    case 'no-speech':
      return "Didn't catch that — try speaking again.";
    case 'audio-capture':
      return 'No microphone found — check your input device.';
    case 'network':
      return 'Speech recognition network error — Chrome STT needs an internet connection.';
    case 'aborted':
      return '';
    default:
      return `Voice input error: ${code}`;
  }
}

function relativeTime(ts) {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60)    return `${sec}s`;
  if (sec < 3600)  return `${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
