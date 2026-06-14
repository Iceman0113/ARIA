export const AGENTS = {
  scout:    { name: 'Scout',    ac: '#6BD08F' },
  hunter:   { name: 'Hunter',  ac: '#E08B5C' },
  creative: { name: 'Creative', ac: '#B97FE5' },
  hermes:   { name: 'Hermes',  ac: '#E3CC68' },
  beacon:   { name: 'Beacon',  ac: '#6FA8DC' },
  verse:    { name: 'Verse',   ac: '#C078E5' },
};

// Map a work-state record -> render view. Working docks (shows task); everything
// else roams. INVERTS the retired neural-map/workStates.js (which floated on working).
export function agentView(states = {}) {
  return Object.keys(AGENTS).map(slug => {
    const s = states[slug] || {};
    const docked = s.state === 'working';
    return {
      slug,
      name: AGENTS[slug].name,
      ac: AGENTS[slug].ac,
      docked,
      task: docked ? (s.task || 'Working…') : null,
    };
  });
}
