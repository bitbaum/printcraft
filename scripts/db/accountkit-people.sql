-- Everyone who owns a PrintCraft project, as `<gotrue user id>|<OrangeCat actor id>`
-- (the actor id empty when OrangeCat has no user actor for them). Runs in the
-- supabase-db container (loki scripts/hetzner/accountkit-supabase.sh), read
-- only. OrangeCat's OIDC `sub` is the user's actor id. The shared guest
-- (app/src/lib/constants.ts GUEST_USER_ID) is nobody's account.
SELECT p.user_id::text || '|' || coalesce(a.id::text, '')
FROM (
  SELECT DISTINCT user_id FROM printcraft.projects
  WHERE user_id <> 'fee8f90d-30b0-4b38-9495-c65acd17eef6'
) p
LEFT JOIN LATERAL (
  SELECT id FROM public.actors
  WHERE actor_type = 'user' AND user_id = p.user_id
  ORDER BY created_at NULLS LAST, id
  LIMIT 1
) a ON true
ORDER BY 1;
