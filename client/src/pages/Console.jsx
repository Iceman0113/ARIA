import { useEffect, useRef, useState } from 'react';
import CosmicStage from '../cosmic/CosmicStage.jsx';
import { agentView } from '../cosmic/agents.js';
import MicBar from '../shell/MicBar.jsx';
import { useApprovals } from '../shell/useApprovals.js';

export default function Console({
  status = 'idle',
  speaking = false,
  workStates = {},
  intel = [],
  actions = [],
  ws = null,
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

  const [activityTab, setActivityTab] = useState('activity');
  const { pending, approve, reject } = useApprovals(ws);

  // Derived agent view from live workStates
  const agents = agentView(workStates);
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
              APPROVALS
              <span className={`tbadge${pending.length === 0 ? ' zero' : ''}`}>
                {pending.length}
              </span>
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
            {/* Actions section */}
            <div className="asec">
              <div className="sh">
                <span>Actions</span>
                <span className="ct">{actions.length}</span>
              </div>
              {actions.map(a => (
                <div className="acard" key={a.id} data-urgency={a.urgency}>
                  <div className="t1">{a.title}</div>
                  <div className="t2">{[a.meta, a.due].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
            </div>
            {/* Intel section */}
            <div className="asec">
              <div className="sh">
                <span>Intel</span>
                <span className="ct">{intel.length}</span>
              </div>
              {intel.map(item => (
                <div className="acard" key={item.id}>
                  <div className="t1">{item.msg}</div>
                  <div className="t2">{[item.agent, item.source, item.time].filter(Boolean).join(' · ')}</div>
                </div>
              ))}
            </div>
            {/* Empty state */}
            {actions.length === 0 && intel.length === 0 && (
              <div className="apv-empty">No activity yet — agents are warming up.</div>
            )}
          </div>
        ) : (
          <div className="approvals">
            {pending.length === 0 ? (
              <div className="apv-empty">All caught up — nothing needs your approval. ✓</div>
            ) : (
              pending.map(task => {
                const m = task.proposed_manifest || {};
                return (
                  <div className="apv" key={task.id}>
                    <div className="ah">
                      <span className="who">{m.name || 'Agent'}</span>
                    </div>
                    <div className="ttl2">{m.name || task.id}</div>
                    <div className="prev">{m.specialty || m.system_prompt?.slice(0, 120) || ''}</div>
                    <div className="acts">
                      <button className="approve" onClick={() => approve(task.id)}>✓ Approve</button>
                      <button className="reject" onClick={() => reject(task.id)}>Reject</button>
                    </div>
                  </div>
                );
              })
            )}
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
