import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const setup = readFileSync(new URL("../supabase/setup.sql", import.meta.url), "utf8");
const roles = readFileSync(new URL("../supabase/sub-admin-role-migration.sql", import.meta.url), "utf8");
const providers = readFileSync(new URL("../supabase/provider-connections.sql", import.meta.url), "utf8");

test("only the primary admin role can pass the admin SQL helper", () => {
  const fn = setup.match(/create or replace function public\.vh_is_admin\(\)[\s\S]*?\$vh\$;/i)?.[0] || "";
  assert.match(fn, /role\s*=\s*'admin'/i);
  assert.doesNotMatch(fn, /sub_admin|content_editor|request_moderator/i);
});

test("login activity SELECT policy is primary-admin-only", () => {
  const policy = setup.match(/create policy "main admins read login activity"[\s\S]*?;/i)?.[0] || "";
  assert.match(policy, /for select to authenticated/i);
  assert.match(policy, /using\s*\(public\.vh_is_admin\(\)\)/i);
  assert.match(setup, /with check \(user_id=auth\.uid\(\)\)/i);
});

test("content editor is limited to Movie rows in the database helper", () => {
  const fn = setup.match(/create or replace function public\.vh_can_manage_content_item\(p_content_type text\)[\s\S]*?\$vh\$;/i)?.[0] || "";
  assert.match(fn, /p\.role='content_editor' and p_content_type='Movie'/i);
  assert.match(roles, /content_editor' and p_content_type='Movie'/i);
});

test("private media bucket is private and provider OAuth credentials are server-only", () => {
  assert.match(setup, /values \('vh-private-media','vh-private-media',false/i);
  assert.match(providers, /enable row level security/i);
  assert.match(providers, /revoke all on public\.vh_provider_connections from anon, authenticated/i);
  assert.match(providers, /grant all on public\.vh_provider_connections to service_role/i);
});
