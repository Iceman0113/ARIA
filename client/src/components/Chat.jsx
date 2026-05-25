import { useEffect, useRef } from 'react';

export default function Chat({ messages, streamingText, activeToolCall }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (!messages.length && !streamingText && !activeToolCall) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-faint)',
        fontSize: 14,
        fontStyle: 'italic',
        padding: 32,
        textAlign: 'center',
      }}>
        Ask me anything — revenue, engineering, customers, competition.
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '12px 20px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}

      {/* Active tool call indicator */}
      {activeToolCall && (
        <div style={{ animation: 'fade-in 0.2s ease' }}>
          <ToolCallBubble name={activeToolCall.name} detail={activeToolCall.detail} />
        </div>
      )}

      {/* Streaming response */}
      {streamingText && (
        <div style={{ animation: 'fade-in 0.2s ease' }}>
          <Bubble role="assistant" text={streamingText} streaming />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function ChatMessage({ message }) {
  return (
    <div style={{ animation: 'fade-in 0.25s ease' }}>
      <Bubble role={message.role} text={message.text} />
    </div>
  );
}

function Bubble({ role, text, streaming }) {
  const isUser = role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? 'var(--accent)' : 'var(--surface2)',
        border: isUser ? 'none' : '1px solid var(--border)',
        color: isUser ? '#fff' : 'var(--text)',
        fontSize: 15,
        lineHeight: 1.6,
        letterSpacing: 0.2,
      }}>
        {text}
        {streaming && (
          <span style={{
            display: 'inline-block',
            width: 2,
            height: '1em',
            background: 'var(--teal)',
            marginLeft: 2,
            verticalAlign: 'text-bottom',
            animation: 'listen-pulse 0.7s ease-in-out infinite',
          }} />
        )}
      </div>
    </div>
  );
}

const TOOL_LABELS = {
  get_revenue_metrics:    { icon: '💰', label: 'Pulling Stripe data' },
  get_engineering_status: { icon: '⚙️', label: 'Checking GitHub' },
  get_customer_health:    { icon: '👥', label: 'Reading Intercom' },
  check_competitors:      { icon: '🔍', label: 'Scanning competitors' },
  get_business_summary:   { icon: '📊', label: 'Getting full snapshot' },
  get_product_analytics:  { icon: '📈', label: 'Reading PostHog' },
  get_sprint_health:      { icon: '🏃', label: 'Checking Linear' },
  get_client_roster:      { icon: '🤝', label: 'Reading client roster' },
  delegate_to_scout:      { icon: '🔭', label: 'Scout dispatched', color: '#a78bfa' },
  scout_web_search:       { icon: '🔭', label: 'Scout searching', color: '#a78bfa' },
  scout_fetch_page:       { icon: '🔭', label: 'Scout reading', color: '#a78bfa' },
  delegate_to_hunter:     { icon: '🎯', label: 'Hunter on it', color: '#fb923c' },
  hunter_search:          { icon: '🎯', label: 'Hunter searching', color: '#fb923c' },
  hunter_fetch:           { icon: '🎯', label: 'Hunter reading', color: '#fb923c' },
  delegate_to_creative:   { icon: '✦', label: 'Creative writing', color: '#f472b6' },
  creative_search:        { icon: '✦', label: 'Creative researching', color: '#f472b6' },
};

function ToolCallBubble({ name, detail }) {
  const info = TOOL_LABELS[name] || { icon: '🔧', label: `Calling ${name}` };
  const accentColor = info.color || 'var(--accent)';
  const shortDetail = detail ? (detail.length > 48 ? detail.slice(0, 48) + '…' : detail) : null;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: 'var(--surface)',
        border: `1px solid ${info.color ? info.color + '44' : 'var(--border)'}`,
        borderRadius: 12,
        color: 'var(--text-dim)',
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        maxWidth: '85%',
      }}>
        <span>{info.icon}</span>
        <span style={{ color: info.color || 'inherit' }}>{info.label}</span>
        {shortDetail && (
          <span style={{ color: 'var(--text-faint)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            "{shortDetail}"
          </span>
        )}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: accentColor,
              animation: `listen-pulse 1s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
