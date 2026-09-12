# What changed and why

## 1. sw.js — the actual cause of "needs a hard refresh"
The cache name (`nsa-shell-v1`) never changed between deploys, and static
assets (style.css, images) were served cache-first, forever. Once a browser
installed the service worker once, it kept serving that exact frozen copy of
style.css on every normal reload, no matter how many times the file changed
on disk — a hard refresh was one of the only things that had a chance of
bypassing it. Fixed two ways:
  - Bumped the cache name to `nsa-shell-v2` — this alone invalidates every
    browser's existing stale cache the next time they load the site.
  - Switched static assets from cache-first to stale-while-revalidate: it
    still answers instantly from cache, but always fetches the network copy
    in the background and overwrites the cache with it — so the *next*
    normal reload after any CSS/JS change already has the update, with no
    more hard refreshes needed going forward.

## 2. assets/css/style.css — calendar now has a real grid
Previously `.dash-cal-day` had `border: 1px solid transparent` — invisible
unless a day had an event, so empty cells (most of the month) had no lines
at all, which is why it looked like floating numbers rather than a calendar.
Rebuilt it with the classic CSS-grid-as-table technique: the grid container
gets a solid border-color background and a 1px gap, every cell (day, empty
filler, weekday header) gets an opaque background — so the 1px gaps show
through as real grid lines on every row and column, automatically, with a
rounded frame around the whole thing. Also removed a byte-for-byte duplicate
`.dash-cal-day` rule block further down the file that was pure redundancy.
