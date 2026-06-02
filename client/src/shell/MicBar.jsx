const STATE_LABEL = {
  idle: 'Idle',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  sleeping: 'Sleeping',
};

export default function MicBar({
  state,
  latency,
  drawerOpen,
  onMicClick,
  onSubmit,
  onToggleDrawer,
  textValue,
  onTextChange,
  interim = '',
  sttError = '',
  heard = '',
  wakeWord = false,
  onToggleWakeWord = () => {},
}) {
  const isListening = state === 'listening';
  const stateLabel  = STATE_LABEL[state] || 'Idle';
  const showInterim = isListening && !sttError && interim.trim().length > 0;
  const showHeard   = state === 'thinking' && !sttError && heard.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (textValue && textValue.trim()) onSubmit(textValue.trim());
  };

  return (
    <form className="mic-bar" onSubmit={handleSubmit}>
      <button
        type="button"
        className={`mic-button ${isListening ? 'listening' : ''}`}
        onClick={onMicClick}
        aria-label="Toggle voice"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
        </svg>
      </button>

      <button
        type="button"
        className={`wake-toggle ${wakeWord ? 'on' : ''}`}
        onClick={onToggleWakeWord}
        aria-label="Wake word"
        title={wakeWord ? 'Wake word ON — say "hey ARIA" hands-free' : 'Wake word OFF — click to enable hands-free'}
      >
        wake
      </button>

      <input
        className="input"
        placeholder='Type a message or say "hey ARIA"...'
        value={textValue}
        onChange={(e) => onTextChange(e.target.value)}
      />

      {sttError ? (
        <div className="mic-error" role="alert">{sttError}</div>
      ) : showInterim ? (
        <div className="mic-transcript">{interim}</div>
      ) : showHeard ? (
        <div className="mic-transcript heard">{heard}</div>
      ) : null}

      <div className="lat-mini">last <span className="v mono">{latency.toFixed(2)}s</span></div>

      <div className={`state-pill ${isListening ? 'listening' : ''}`}>{stateLabel}</div>

      <button
        type="button"
        className={`dash-toggle ${drawerOpen ? 'on' : ''}`}
        onClick={onToggleDrawer}
        aria-label="Toggle dashboard"
      >
        <span>Dashboard</span>
        <span className="arrow">▴</span>
      </button>
    </form>
  );
}
