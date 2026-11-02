-- PrintCraft's people from OrangeCat's GoTrue into AccountKit, in the accounts
-- database. Runs inside one transaction (loki accountkit-supabase.sh: rolled
-- back for a rehearsal, committed for the import) with oc_people(user_id uuid,
-- actor_id text) filled from scripts/db/accountkit-people.sql.
--
-- Each person who owns projects and has an OrangeCat actor gets:
--   - an AccountKit user under their OLD id, so projects.user_id needs no
--     rewrite, with the placeholder address AccountKit gives every OrangeCat
--     sign-in (placeholderEmail("orangecat", actorId):
--     `<first 32 hex of sha256("orangecat:<actor>")>@orangecat.invalid`);
--   - an `orangecat` account keyed by the actor id, which is the OIDC `sub`,
--     so their first "Continue with OrangeCat" lands on that user.
-- No GoTrue password or address is carried over: OrangeCat's password sign-up
-- does not verify an address, so an address is never an identity here.
-- Idempotent: a person already imported, or an actor already linked, is left
-- as it is and counted. Nothing is updated or deleted.
WITH eligible AS (
  SELECT user_id::text AS uid, actor_id FROM oc_people WHERE actor_id IS NOT NULL
), ins_users AS (
  INSERT INTO users (id, name, email, email_verified)
  SELECT e.uid, '',
         substr(encode(sha256(convert_to('orangecat:' || e.actor_id, 'UTF8')), 'hex'), 1, 32) || '@orangecat.invalid',
         false
  FROM eligible e
  WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.provider_id = 'orangecat' AND a.account_id = e.actor_id)
  ON CONFLICT DO NOTHING
  RETURNING id
), ins_accounts AS (
  INSERT INTO accounts (id, account_id, provider_id, user_id)
  SELECT gen_random_uuid()::text, e.actor_id, 'orangecat', e.uid
  FROM eligible e JOIN ins_users i ON i.id = e.uid
  RETURNING id
)
SELECT
  'imported_users=' || (SELECT count(*) FROM ins_users),
  'imported_orangecat_links=' || (SELECT count(*) FROM ins_accounts),
  'already_linked=' || (SELECT count(*) FROM eligible e WHERE EXISTS (
     SELECT 1 FROM accounts a WHERE a.provider_id = 'orangecat' AND a.account_id = e.actor_id AND a.user_id = e.uid)),
  'actor_linked_to_another_account=' || (SELECT count(*) FROM eligible e WHERE EXISTS (
     SELECT 1 FROM accounts a WHERE a.provider_id = 'orangecat' AND a.account_id = e.actor_id AND a.user_id <> e.uid)),
  'without_actor=' || (SELECT count(*) FROM oc_people WHERE actor_id IS NULL);
