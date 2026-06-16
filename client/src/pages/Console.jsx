import { useCallback, useEffect, useRef, useState } from 'react';
import CosmicStage from '../cosmic/CosmicStage.jsx';
import { agentView } from '../cosmic/agents.js';
import MicBar from '../shell/MicBar.jsx';
import { useApprovals } from '../shell/useApprovals.js';

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

      {/* Roaming agents */}
      {roaming.map((a, i) => (
        <div
          className="roamer"
          key={a.slug}
          style={{
            '--ac': a.ac,
            left: `${18 + i * 12}%`,
            top: `${45 + (i % 2) * 12}%`,
            '--rdur': `${9 + i * 1.7}s`,
            '--rdelay': `${i * 0.8}s`,
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
