import { useEffect, useRef, useState } from 'react';
import CosmicStage from '../cosmic/CosmicStage.jsx';
import { agentView } from '../cosmic/agents.js';
import MicBar from '../shell/MicBar.jsx';

export default function Console({
  status = 'idle',
  speaking = false,
  // MicBar props passed through from App
  orbState,
  latency,
  drawerOpen,
  textValue,
  onTextChange,
  onMicClick,
  onSubmit,
  onToggleDrawer,
  interim,
  sttError,
  heard,
  wakeWord,
  onToggleWakeWord,
}) {
  const rootRef = useRef(null);

  // P1 simulated agent states — P2 wires live workStates
  const [states] = useState({
    beacon: { state: 'working', task: 'Monitoring inbox' },
    hunter: { state: 'working', task: 'Qualifying lead' },
  });

  const [activityTab, setActivityTab] = useState('activity');

  // Derived agent view
  const agents = agentView(states);
  const docked = agents.filter(a => a.docked);
  const roaming = agents.filter(a => !a.docked);

  // Recede panels while ARIA is busy (listening / speaking / processing)
  useEffect(() => {
    rootRef.current?.classList.toggle('aria-busy', status !== 'idle');
  }, [status]);

  // Panels start open — toggle via class so cosmic.css handles dock offsets
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.classList.add('editor-open', 'activity-open');
  }, []);

  return (
    <div className="cosmic-root" ref={rootRef}>
      {/* Background 3-D scene */}
      <CosmicStage status={status} speaking={speaking} />

      {/* LEFT — Agent Tasking */}
      <div className="editor glass">
        <span
          className="ecol"
          title="Collapse panel"
          onClick={() => rootRef.current?.classList.toggle('editor-open')}
        >
          ‹
        </span>
        <h3>AGENT TASKING</h3>
        <div className="sub">Edit, queue &amp; reorder what each agent works on.</div>
        <div className="elist">
          {agents.map(a => (
            <div className="ablock" key={a.slug} style={{ '--ac': a.ac }}>
              <div className="ah">
                <div className="chip">
                  <img
                    src={'/avatars/' + a.slug + '.png'}
                    alt={a.name}
                    className="portrait"
                  />
                </div>
                <span className="nm">{a.name.toUpperCase()}</span>
                <span className={`st${a.docked ? ' on' : ''}`}>
                  {a.docked ? 'WORKING' : 'ROAMING'}
                </span>
              </div>
              {a.task && (
                <div className="task">
                  <span className="grip">⠿</span>
                  <span className="txt">{a.task}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* TOP-CENTER — Dock (docked / working agents) */}
      <div className={`dock${docked.length ? ' has' : ''}`}>
        <div className="dlabel">
          <span className="p" />
          ACTIVE
        </div>
        {docked.map(a => (
          <div className="dcard" key={a.slug} style={{ '--ac': a.ac }}>
            <div className="m">
              <img
                src={'/avatars/' + a.slug + '.png'}
                alt={a.name}
                className="portrait"
              />
            </div>
            <div className="info">
              <div className="nn">{a.name}</div>
              <div className="tk">{a.task}</div>
              <div className="pp"><i /></div>
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT — Activity / Approvals */}
      <div className="activity glass">
        <div className="atop">
          <div className="ptabs">
            <button
              className={`ptab${activityTab === 'activity' ? ' active' : ''}`}
              onClick={() => setActivityTab('activity')}
            >
              ACTIVITY
            </button>
            <button
              className={`ptab${activityTab === 'approvals' ? ' active' : ''}`}
              onClick={() => setActivityTab('approvals')}
            >
              APPROVALS<span className="tbadge zero">0</span>
            </button>
          </div>
          <span
            className="col"
            title="Collapse"
            onClick={() => rootRef.current?.classList.toggle('activity-open')}
          >
            ›
          </span>
        </div>
        {activityTab === 'activity' ? (
          <div className="asections">
            <div className="asec">
              <div className="sh">
                <span>Recent</span>
                <span className="ct">0</span>
              </div>
              <div className="apv-empty">Activity will appear here (P2)</div>
            </div>
          </div>
        ) : (
          <div className="approvals">
            <div className="apv-empty">No pending approvals</div>
          </div>
        )}
      </div>

      {/* Roaming agents */}
      {roaming.map((a, i) => (
        <div
          className="roamer"
          key={a.slug}
          style={{
            '--ac': a.ac,
            left: `${18 + i * 12}%`,
            top: `${45 + (i % 2) * 12}%`,
          }}
        >
          <div className="av">
            <div className="wash" />
            <img
              src={'/avatars/' + a.slug + '.png'}
              alt={a.name}
              className="portrait"
            />
          </div>
          <div className="nm">{a.name.toUpperCase()}</div>
        </div>
      ))}

      {/* BOTTOM — Mic bar */}
      <MicBar
        state={orbState}
        latency={latency}
        drawerOpen={drawerOpen}
        textValue={textValue}
        onTextChange={onTextChange}
        onMicClick={onMicClick}
        onSubmit={onSubmit}
        onToggleDrawer={onToggleDrawer}
        interim={interim}
        sttError={sttError}
        heard={heard}
        wakeWord={wakeWord}
        onToggleWakeWord={onToggleWakeWord}
      />
    </div>
  );
}
