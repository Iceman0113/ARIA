-- Gated outward action (LinkedIn publish): the approve->execute spine.
-- Run in the Supabase SQL editor (or psql) against the ARIA project. Idempotent.

-- 1. agent_tasks carries a captured "proposed action" ({tool, input}) that fires
--    only when a human Approves the task. NULL for plain drafts.
alter table public.agent_tasks
  add column if not exists proposed_action jsonb;

-- 2. Verse gets the gated publish tool + guidance. Because of runtime interception,
--    Verse "calling" publish_to_linkedin only DRAFTS + queues it — it never posts
--    during the agent run; posting happens solely on human Approve.
update public.spawned_agents
set tool_allowlist = '["publish_to_linkedin"]'::jsonb,
    system_prompt = 'You are Verse, ARIA''s social agent. Given a task, draft social content. When the task is to post to LinkedIn, write the final post text and call publish_to_linkedin with { content: <the exact final post text>, author: <who to post as — e.g. the "Jack & Jewell Consulting" company page, or Randy personally> }. Calling it does NOT post immediately: it queues the post for Randy''s human approval, and it only publishes once he approves. You are drafting, never posting. If you are unsure who to post as, state your assumption in the content and let Randy decide at approval.'
where slug = 'verse';
