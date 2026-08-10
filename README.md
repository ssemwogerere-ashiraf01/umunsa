# Uganda Martyrs University Nkobazambogo Students' Association

A membership website for the Nkobazambogo Students' Association (NSA) at
Uganda Martyrs University, Nkozi: built as a static site (HTML/CSS/vanilla
JS) backed by Supabase (Postgres + Auth + Storage + Edge Functions).

Public pages (landing, About, Contact, Rules, Leadership, News) are open to
everyone. Everything else: Dashboard, Activities, Projects, Discussions,
Elections, Feedback, Profile, and both Admin dashboards - requires sign-in
and an **active** membership status.

## Membership model

  Enforced both client-side (`register.html`) and server-side (a Postgres
  trigger in `sql/004_email_domain_and_roles.sql`).
  the Super Admin dashboard (Add Member tab), bypassing that restriction.
  - **Members** see and manage only their own info: membership status,
    their activity RSVPs, their project assignments, their own votes.
  - **Admins** are assigned by the Super Admin (never by themselves or each
    other) and handle day-to-day approvals and content: members, news,
    activities, projects, discussion moderation, election setup and
    candidate approval, feedback form creation, and contact messages.
  - **Super Admin** has the highest priority access: club-wide settings,
    assigning/revoking admin access, adding members outside the umu.ac.ug
    domain, closing elections and promoting winners to the Leadership page,
    editing/deleting existing feedback forms, and permanently deleting
    accounts.

## What's included

  `news.html` - public pages
  `reset-password.html`, `reset-password-confirm.html` - auth flow
  (a member's own assignments, plus a browsable list for all active members)
  reply; admins moderate)
  vote while an election is active, and view results once closed. Seeded
  with the 29 BANKOSA / Nkobazambogo executive & representative positions.
  `admin-delete-user`, `login-guard`, `password-reset`, `contact-reply`

Removed from the original project per request: Flutterwave payments,
savings groups, real-time chat, job board, regional chapters, and the
newsletter: keeping only what's relevant to this brief.

## Setting up Supabase

1. Create a new Supabase project.
2. In the SQL Editor, run the files in `sql/` **in order**:
   `001_schema.sql` → `002_rls_policies.sql` → `003_storage.sql` →
   `004_email_domain_and_roles.sql`.
3. Register your own account through `register.html` with your
   `@umu.ac.ug` email (once the site is deployed and wired up - step 4).
4. In `sql/004_email_domain_and_roles.sql`, uncomment the bootstrap
   `UPDATE` statement, put in your real email, and run just that statement
   to make yourself the first Super Admin.
5. Deploy the Edge Functions (`supabase functions deploy <name>` for each
   folder in `supabase/functions/`). Set the `RESEND_API_KEY` and
   `RESEND_FROM` secrets if you want email delivery for password resets and
   contact replies (`supabase secrets set RESEND_API_KEY=... RESEND_FROM=...`).
6. In `assets/js/supabase-client.js`, replace `SUPABASE_URL` and
   `SUPABASE_PUBLISHABLE_KEY` with your project's values (Project Settings →
   API). In `assets/js/auth.js`, replace the `LOGIN_GUARD_URL` placeholder
   with your deployed `login-guard` function URL.

## Images & branding

Local files under `assets/img/` (used for hero, culture strip, OG, favicons):


## Images & branding

The hero and About page use openly-licensed photos hotlinked from Wikimedia
Commons (Uganda Martyrs University and Buganda cultural heritage sites),
with plain-text attribution in the image captions. Swap these for your own
hosted photos any time: see `CULTURAL_IMAGES` in `assets/js/site-config.js`
and the `<img>`/CSS background references in `index.html` and `about.html`.
The "NSA" wordmark in the nav/footer is plain text, not a fixed logo file:
drop in your own crest image if you have one.

## Deploying

This is a static site - deploy the folder as-is to Netlify (a `netlify.toml`
and `_headers` file are included), Vercel, GitHub Pages, or any static host.
