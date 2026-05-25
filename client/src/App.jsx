import { useState, useEffect, useRef, useCallback } from 'react';
import { voice } from './Voice.js';
import { wakeWord } from './WakeWord.js';
import Orb from './components/Orb.jsx';
import Chat from './components/Chat.jsx';
import Dashboard from './components/Dashboard.jsx';
import AlertFeed from './components/Alert.jsx';
import Setup from './components/Setup.jsx';
import MemoryPanel from './components/Memory.jsx';
import TextInput from './components/TextInput.jsx';
import ClientsPanel from './components/Clients.jsx';

const CONFIG_KEY   = 'cofounder_config_v1';
const ALWAYSON_KEY = 'aria_alwayson';

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
  const [orbState, setOrbState]         = useState('idle');
  const [audioLevel, setAudioLevel]     = useState(0);
  const [messages, setMessages]         = useState([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeToolCall, setActiveToolCall] = useState(null);
  const [alerts, setAlerts]             = useState([]);
  const [metrics, setMetrics]           = useState(null);
  const [memory, setMemory]             = useState(null);
  const [clients, setClients]           = useState(null);
  const [dashOpen, setDashOpen]         = useState(false);
  const [memoryOpen, setMemoryOpen]     = useState(false);
  const [clientsOpen, setClientsOpen]   = useState(false);
  const [wsStatus, setWsStatus]         = useState('connecting');
  const [interimText, setInterimText]   = useState('');
  const [alwaysOn, setAlwaysOn]         = useState(() => localStorage.getItem(ALWAYSON_KEY) === '1');

  const wsRef          = useRef(null);
  const alertIdRef     = useRef(0);
  const historyRef     = useRef([]);
  const reconnectRef   = useRef(null);
  const alwaysOnRef    = useRef(alwaysOn);

  useEffect(() => { alwaysOnRef.current = alwaysOn; }, [alwaysOn]);

  // ── Helpers ───────────────────────────────────────────────────────

  const enterSleeping = useCallback(() => {
    setOrbState('sleeping');
    wakeWord.start(
      (afterText) => handleWake(afterText),
      () => {
        setAlwaysOn(false);
        localStorage.setItem(ALWAYSON_KEY, '0');
        setOrbState('idle');
      },
    );
  }, []);

  const returnToBase = useCallback(() => {
    if (alwaysOnRef.current) {
      enterSleeping();
    } else {
      setOrbState('idle');
    }
  }, [enterSleeping]);

  // ── WebSocket ─────────────────────────────────────────────────────

  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    try {
      const ws = new WebSocket(config.serverUrl);
      wsRef.current = ws;
      setWsStatus('connecting');
      ws.onopen  = () => setWsStatus('open');
      ws.onmessage = (e) => {
        let msg; try { msg = JSON.parse(e.data); } catch { return; }
        handleServerEvent(msg);
      };
      ws.onerror = () => setWsStatus('error');
      ws.onclose = () => {
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

  // Resume sleeping on mount if alwaysOn was previously enabled
  useEffect(() => {
    if (alwaysOn && wakeWord.supported) enterSleeping();
    return () => wakeWord.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Server events ─────────────────────────────────────────────────

  function handleServerEvent(msg) {
    switch (msg.type) {
      case 'token':
        setStreamingText(prev => prev + (msg.text || ''));
        break;
      case 'tool_call':
        setActiveToolCall({ name: msg.name, detail: msg.detail || null });
        break;
      case 'tool_result':
        setActiveToolCall(null);
        break;
      case 'done': {
        const fullText = msg.text || '';
        setStreamingText('');
        setActiveToolCall(null);
        if (fullText) {
          setMessages(prev => [...prev, { role: 'assistant', text: fullText }]);
          historyRef.current = [...historyRef.current, { role: 'assistant', content: fullText }];
          setOrbState('speaking');
          voice.speak(fullText, { onEnd: () => returnToBase() });
        } else {
          returnToBase();
        }
        break;
      }
      case 'error':
        setStreamingText('');
        setActiveToolCall(null);
        setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${msg.message}` }]);
        returnToBase();
        break;
      case 'metrics':
        setMetrics(msg.data);
        break;
      case 'memory':
        setMemory(msg.data);
        break;
      case 'clients':
        setClients(msg.data);
        break;
      case 'alert': {
        const id = ++alertIdRef.current;
        setAlerts(prev => [{ ...msg, id, timestamp: Date.now() }, ...prev].slice(0, 8));
        voice.speak(`${config.cofounderName || 'ARIA'}: ${msg.body}`);
        break;
      }
    }
  }

  // ── Send to server ────────────────────────────────────────────────

  const sendMessage = useCallback((text) => {
    if (!text.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];
    if (historyRef.current.length > 20) historyRef.current = historyRef.current.slice(-20);
    wsRef.current.send(JSON.stringify({
      type: 'chat',
      text,
      history: historyRef.current.slice(0, -1),
      context: {
        company: config.company,
        cofounderName: config.cofounderName,
        businessDescription: config.businessDescription,
      },
    }));
    setOrbState('thinking');
  }, []);

  // ── Wake word handler ─────────────────────────────────────────────

  const handleWake = useCallback((afterText) => {
    // Orb flashes to idle momentarily (visual "wake" feedback)
    setOrbState('idle');

    if (afterText && afterText.length > 3) {
      // Full command was in the same breath: "Hey ARIA what's our MRR?"
      setTimeout(() => sendMessage(afterText), 150);
    } else {
      // Just the wake phrase — start a fresh listening session
      setTimeout(() => startListening(), 200);
    }
  }, [sendMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listening ─────────────────────────────────────────────────────

  const startListening = useCallback(async () => {
    if (!voice.supported) {
      alert('Speech recognition requires Chrome or Edge.');
      returnToBase();
      return;
    }

    setOrbState('listening');
    setInterimText('');

    const finalText = await voice.startListening({
      onInterim: (t) => setInterimText(t),
      onFinal:   ()  => setInterimText(''),
      onLevel:   setAudioLevel,
      onEnd:     ()  => { setAudioLevel(0); setInterimText(''); },
    });

    if (finalText.trim()) {
      sendMessage(finalText.trim());
    } else {
      returnToBase();
    }
  }, [sendMessage, returnToBase]);

  // ── Orb click ─────────────────────────────────────────────────────

  const handleOrbClick = useCallback(async () => {
    if (orbState === 'speaking') {
      voice.cancelSpeaking();
      returnToBase();
      return;
    }
    if (orbState === 'listening') {
      voice.stopListening();
      returnToBase();
      return;
    }
    if (orbState === 'sleeping') {
      wakeWord.stop();
      startListening();
      return;
    }
    if (orbState !== 'idle') return;
    startListening();
  }, [orbState, returnToBase, startListening]);

  // ── Always-on toggle ──────────────────────────────────────────────

  const toggleAlwaysOn = useCallback(() => {
    const next = !alwaysOnRef.current;
    setAlwaysOn(next);
    localStorage.setItem(ALWAYSON_KEY, next ? '1' : '0');

    if (next) {
      if (!wakeWord.supported) {
        alert('Wake word requires Chrome or Edge with microphone access.');
        setAlwaysOn(false);
        localStorage.setItem(ALWAYSON_KEY, '0');
        return;
      }
      enterSleeping();
    } else {
      wakeWord.stop();
      if (orbState === 'sleeping') setOrbState('idle');
    }
  }, [orbState, enterSleeping]);

  // ── Keyboard shortcut ─────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleOrbClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleOrbClick]);

  // ── Render ────────────────────────────────────────────────────────

  const wsColor = { connecting: '#ffaa00', open: '#00e080', closed: '#ff4466', error: '#ff4466' }[wsStatus];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', maxWidth: 600, margin: '0 auto', position: 'relative' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{config.cofounderName || 'ARIA'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{config.company}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Always-on toggle */}
          <button
            onClick={toggleAlwaysOn}
            title={alwaysOn ? 'Always-on active — click to disable' : 'Enable always-on wake word'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6,
              border: `1px solid ${alwaysOn ? '#6655ff' : 'var(--border)'}`,
              background: alwaysOn ? '#6655ff18' : 'none',
              color: alwaysOn ? '#8877ff' : 'var(--text-dim)',
              fontSize: 11, cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: 0.5,
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: alwaysOn ? '#6655ff' : 'var(--text-faint)',
              animation: alwaysOn ? 'breathe 3s ease-in-out infinite' : 'none',
              transition: 'background 0.2s ease',
            }} />
            {alwaysOn ? 'always-on' : 'tap to speak'}
          </button>

          {/* WS status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: wsColor }} />
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>{wsStatus}</span>
          </div>

          <button
            onClick={onReset}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Alerts */}
      <AlertFeed alerts={alerts} onDismiss={id => setAlerts(prev => prev.filter(a => a.id !== id))} />

      {/* Orb */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px 20px', flexShrink: 0 }}>
        <Orb state={orbState} audioLevel={audioLevel} onClick={handleOrbClick} disabled={wsStatus !== 'open' && wsStatus !== 'closed'} />

        {interimText && (
          <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', maxWidth: 320, minHeight: 20, animation: 'fade-in 0.15s ease' }}>
            "{interimText}"
          </div>
        )}

        {!interimText && orbState === 'idle' && (
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
            space or tap to speak
          </div>
        )}

        {orbState === 'sleeping' && (
          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, animation: 'fade-in 0.3s ease' }}>
            or tap to speak now
          </div>
        )}
      </div>

      {/* Conversation */}
      <Chat messages={messages} streamingText={streamingText} activeToolCall={activeToolCall} />

      {/* Text input */}
      <TextInput
        onSend={sendMessage}
        disabled={wsStatus !== 'open' || orbState === 'thinking' || orbState === 'speaking'}
      />

      {/* Dashboard */}
      <Dashboard metrics={metrics} open={dashOpen} onToggle={() => setDashOpen(o => !o)} />

      {/* Client roster */}
      <ClientsPanel
        data={clients}
        open={clientsOpen}
        onToggle={() => setClientsOpen(o => !o)}
        serverUrl={config.serverUrl}
        onUpdated={() => {}}
      />

      {/* Memory */}
      <MemoryPanel
        memory={memory}
        open={memoryOpen}
        onToggle={() => setMemoryOpen(o => !o)}
        serverUrl={config.serverUrl}
        onUpdated={() => {}}
      />
    </div>
  );
}
