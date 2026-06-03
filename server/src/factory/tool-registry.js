/**
 * In-process dynamic tool registry. Holds tools registered at runtime by the
 * RegistryWatcher (one per row in spawned_agents). Combined with the static
 * TOOL_DEFINITIONS at request time.
 */
class FactoryRegistry {
  constructor() {
    this._tools = new Map();   // name → { def, executor }
  }

  register(def, executor) {
    if (!def?.name) throw new Error('tool def must have a name');
    if (typeof executor !== 'function') throw new Error('executor must be a function');
    this._tools.set(def.name, { def, executor });
  }

  unregister(name) {
    this._tools.delete(name);
  }

  has(name) {
    return this._tools.has(name);
  }

  getDynamicDefinitions() {
    return Array.from(this._tools.values()).map(v => v.def);
  }

  async execute(name, input, onEvent) {
    const entry = this._tools.get(name);
    if (!entry) return null;
    return entry.executor(input, onEvent);
  }
}

export const factoryRegistry = new FactoryRegistry();
