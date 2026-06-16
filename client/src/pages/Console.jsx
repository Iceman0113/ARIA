import { useCallback, useEffect, useRef, useState } from 'react';
import CosmicStage from '../cosmic/CosmicStage.jsx';
import { agentView, AGENTS } from '../cosmic/agents.js';
import MicBar from '../shell/MicBar.jsx';
import { useApprovals } from '../shell/useApprovals.js';

const AGENT_ORDER = Object.keys(AGENTS);

// Smooth per-agent wander position across the open screen area (between the
// panels). Shared by the rAF loop and the initial inline transform so agents
// are spread out even before the first frame (or if the tab is backgrounded).
function roamXY(i, T, W, H, lb, rb) {
  const seed = i * 1.7;
  const ox = 0.18 + 0.64 * ((i % 3) / 2);
  const oy = 0.30 + 0.42 * Math.floor(i / 3);
  const span = Math.max(160, rb - lb - 78);
  let x = lb + ox * span + Math.sin(T + seed) * Math.min(70, span * 0.12);
  let y = oy * H + Math.cos(T * 0.8 + seed) * 46 + Math.sin(T * 1.6 + seed) * 8 - 39;
  x = Math.max(lb, Math.min(rb - 78, x));
  y = Math.max(86, Math.min(H - 176, y));
  return { x, y };
}
function roamBounds(W, editorOpen, activityOpen) {
  return { lb: editorOpen ? 332 : 46, rb: activityOpen ? W - 292 : W - 46 };
}

// ── Agent-task API helpers ─────────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchAgentTasks(slug) {
  const data = await apiFetch(`/agents/${slug}/tasks`);
  return Array.isArray(data) ? data : (data.tasks || []);
}

async function addAgentTask(slug, text) {
  return apiFetch(`/agents/${slug}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

async function deleteAgentTask(slug, id) {
  return apiFetch(`/agents/${slug}/tasks/${id}`, { method: 'DELETE' });
}

// ── Per-agent task block ───────────────────────────────────────────────────
function AgentBlock({ agent, ws }) {
  const [tasks, setTasks] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const t = await fetchAgentTasks(agent.slug);
      setTasks(t);
    } catch {
      // keep prior state
    }
  }, [agent.slug]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh on agent_task.updated WS events for this agent
  useEffect(() => {
    if (!ws) return;
    const handler = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'agent_task.updated' && msg.slug === agent.slug) {
        refresh();
      }
    };
    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws, agent.slug, refresh]);

  const handleAdd = useCallback(async () => {
    const text = inputVal.trim();
    if (!text) return;
    try {
      await addAgentTask(agent.slug, text);
      setInputVal('');
      refresh();
    } catch {
      // keep prior state
    }
  }, [agent.slug, inputVal, refresh]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteAgentTask(agent.slug, id);
      refresh();
    } catch {
      // keep prior state
    }
  }, [agent.slug, refresh]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') handleAdd();
  }, [handleAdd]);

  return (
    <div className="ablock" style={{ '--ac': agent.ac }}>
      <div className="ah">
        <div className="chip">
          <img
            src={'/avatars/' + agent.slug + '.png'}
            alt={agent.name}
            className="portrait"
          />
        </div>
        <span className="nm">{agent.name.toUpperCase()}</span>
        <span className={`st${agent.docked ? ' on' : ''}`}>
          {agent.docked ? 'WORKING' : 'ROAMING'}
        </span>
      </div>

      {tasks.map(t => (
        <div className="task" key={t.id}>
          <span className="grip">⠿</span>
          <span className="txt">{t.text}</span>
          {t.state === 'queued' ? (
            <span
              className="x"
              role="button"
              aria-label="Remove task"
              onClick={() => handleDelete(t.id)}
            >
              ✕
            </span>
          ) : (
            <span className="tstate">{t.state}</span>
          )}
        </div>
      ))}

      <div className="addrow">
        <input
          ref={inputRef}
          placeholder={`Add task for ${agent.name}…`}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          data-agent={agent.slug}
        />
        <button onClick={handleAdd}>+</button>
      </div>
    </div>
  );
}

// ── Console ────────────────────────────────────────────────────────────────
export default function Console({
  status = 'idle',
  speaking = false,
  workStates = {},
  intel = [],
  actions = [],
  ws = null,
  ampGetter = null,
  agentTaskRefreshKey = 0,
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
  const [editorOpen, setEditorOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const roamerRefs = useRef({});

  // Idle agents wander around the open screen area (between the panels) via a
  // smooth per-agent sinusoidal path; working agents are filtered out (they
  // render in the dock instead). Ported from the approved prototype's tickRoamers.
  useEffect(() => {
    let raf, T = 0;
    const tick = () => {
      T += 0.006;
      const W = window.innerWidth, H = window.innerHeight;
      const { lb, rb } = roamBounds(W, editorOpen, activityOpen);
      for (const slug of Object.keys(roamerRefs.current)) {
        const el = roamerRefs.current[slug];
        if (!el) continue;
        const { x, y } = roamXY(AGENT_ORDER.indexOf(slug), T, W, H, lb, rb);
        el.style.transform = `translate(${x}px, ${y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [editorOpen, activityOpen]);
  const { pending, approve, reject } = useApprovals(ws, agentTaskRefreshKey);

  // Derived agent view from live workStates
  const agents = agentView(workStates);
  const docked = agents.filter(a => a.docked);
  const roaming = agents.filter(a => !a.docked);

  // Recede panels while ARIA is busy (listening / speaking / processing)
  // Reactive root classes — aria-busy (recede/dim on voice activity) + the two
  // panel-open flags (which drive the dock offsets in cosmic.css). Reactive
  // (not imperative classList) so React re-renders never drop them.
  const rootClass = [
    'cosmic-root',
    status !== 'idle' ? 'aria-busy' : '',
    editorOpen ? 'editor-open' : '',
    activityOpen ? 'activity-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass} ref={rootRef}>
      {/* Background 3-D scene */}
      <CosmicStage status={status} speaking={speaking} ampGetter={ampGetter} />

      {/* LEFT — Agent Tasking */}
      <div className={`editor glass${editorOpen ? '' : ' collapsed'}`}>
        <span
          className="ecol"
          title={editorOpen ? 'Collapse panel' : 'Expand panel'}
          onClick={() => setEditorOpen(o => !o)}
        >
          {editorOpen ? '‹' : '›'}
        </span>
        <h3>AGENT TASKING</h3>
        <div className="sub">Edit, queue &amp; reorder what each agent works on.</div>
        <div className="elist">
          {agents.map(a => (
            <AgentBlock key={a.slug} agent={a} ws={ws} />
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
      <div className={`activity glass${activityOpen ? '' : ' collapsed'}`}>
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
            title={activityOpen ? 'Collapse' : 'Expand'}
            onClick={() => setActivityOpen(o => !o)}
          >
            {activityOpen ? '›' : '‹'}
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
              pending.map(item => {
                const isPublish =
                  item.proposed_action &&
                  item.proposed_action.tool === 'publish_to_linkedin';

                if (isPublish) {
                  const { content, author } = item.proposed_action.input || {};
                  return (
                    <div className="apv" key={item.id}>
                      <div className="ah">
                        <span className="who">{item.source === 'agent' ? 'Agent Task' : 'Factory'}</span>
                      </div>
                      <div className="ttl2">{item.title}</div>
                      <div className="apv-publish">▲ Will publish to LinkedIn</div>
                      <div className="apv-author">
                        {author
                          ? `Posted as: ${author}`
                          : '⚠ author not set — reject & rephrase'}
                      </div>
                      <blockquote className="apv-post">{content}</blockquote>
                      <div className="apv-warn">Publishing is immediate — there is no undo.</div>
                      <div className="acts">
                        <button className="approve" onClick={() => approve(item)}>Approve &amp; publish</button>
                        <button className="reject" onClick={() => reject(item)}>Reject</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="apv" key={item.id}>
                    <div className="ah">
                      <span className="who">{item.source === 'agent' ? 'Agent Task' : 'Factory'}</span>
                    </div>
                    <div className="ttl2">{item.title}</div>
                    <div className="prev">{item.preview}</div>
                    <div className="acts">
                      <button className="approve" onClick={() => approve(item)}>✓ Approve</button>
                      <button className="reject" onClick={() => reject(item)}>Reject</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Roaming agents — positioned each frame by the wander loop below */}
      {roaming.map((a) => (
        <div
          className="roamer"
          key={a.slug}
          ref={el => { if (el) roamerRefs.current[a.slug] = el; else delete roamerRefs.current[a.slug]; }}
          style={{
            '--ac': a.ac,
            transform: (() => {
              const W = window.innerWidth, H = window.innerHeight;
              const { lb, rb } = roamBounds(W, editorOpen, activityOpen);
              const { x, y } = roamXY(AGENT_ORDER.indexOf(a.slug), 0, W, H, lb, rb);
              return `translate(${x}px, ${y}px)`;
            })(),
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
