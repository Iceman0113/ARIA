import { createTask } from './repo.js';
import { SpawnPipeline } from './pipeline.js';

export async function delegateToFactory(input, broadcast) {
  if (!input?.name_hint || !input?.role_description) {
    return { error: 'name_hint and role_description are required' };
  }
  try {
    const task = await createTask({
      requestedBy: 'Randy',
      nameHint: input.name_hint,
      roleDescription: input.role_description,
      specialRequirements: input.special_requirements || null,
    });
    const pipeline = new SpawnPipeline({ broadcast });
    pipeline.kickoff(task.id);
    return { taskId: task.id, status: 'queued', message: `Factory is researching "${input.name_hint}". I'll surface a card when the draft is ready.` };
  } catch (err) {
    return { error: err.message };
  }
}
