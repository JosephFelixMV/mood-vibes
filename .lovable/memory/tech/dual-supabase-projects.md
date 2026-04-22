---
name: dual-supabase-projects
description: Project uses two Supabase projects — live catalog is fqccttthuzvltbyzmvid (hardcoded in src/lib/supabase.ts), Lovable Cloud is ztztujccujrigexfhdjj. Migration tools target the wrong DB.
type: constraint
---
**Live production data lives on Supabase project `fqccttthuzvltbyzmvid`** (hardcoded in `src/lib/supabase.ts` and used by all app queries).

The Lovable Cloud project is `ztztujccujrigexfhdjj` (referenced in `.env`, `src/integrations/supabase/client.ts`, and what `supabase--migration` / `supabase--read_query` / `psql` operate on).

**Implication:** Any schema/function/RLS change made via the Supabase migration tool, the read_query tool, or psql goes to `ztztujccujrigexfhdjj` and has **no effect on the live site**.

**How to apply:**
- For any DB schema change (CREATE/ALTER/DROP, functions, RLS, triggers): give the user the raw SQL to paste manually into project `fqccttthuzvltbyzmvid`'s SQL Editor. Do NOT rely on the migration tool succeeding.
- You may still use the migration tool to keep the Lovable Cloud project's schema/types in sync (so `src/integrations/supabase/types.ts` stays accurate), but always tell the user they ALSO need to run the SQL on `fqccttthuzvltbyzmvid`.
- When debugging "why is the data empty / function missing" — first check whether the change was applied to `fqccttthuzvltbyzmvid` (the real project), not just Lovable Cloud.

**Why:** The two projects must be kept manually in sync until the user consolidates onto a single Supabase project.
