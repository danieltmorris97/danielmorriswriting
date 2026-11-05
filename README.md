# danielmorriswriting.co.uk

My writing portfolio. It's a plain static site (HTML, CSS and a little JavaScript), so there's nothing to install or build.

## What's where

| File | What it is |
| --- | --- |
| `index.html` | The whole homepage: intro, bylines, latest articles, interviews, the archive, about and contact |
| `scripts/update_feed.py` | Fetches my latest Hotspawn and GameRant headlines and article counts |
| `.github/workflows/update-feed.yml` | Runs that script on GitHub every 3 hours |
| `data/feed.json` | The last headlines and counts the script fetched |
| `assets/css/style.css` | All the styling (colours are at the top, under `:root`) |
| `assets/js/main.js` | Archive filters, mobile menu, scroll animations |
| `assets/img/work/` | Article thumbnails |
| `esports/`, `hotspawn/`, `cheatcc/`, `destructoid/`, `gamerant/` | Redirects so links to the old Squarespace pages still work |

## Adding an article to the archive

1. Save a thumbnail into `assets/img/work/` (a 640px-wide `.webp` or `.jpg` is ideal).
2. In `index.html`, find `<ul class="work-grid"` and paste this at the top of the list:

```html
<li class="work-card" data-type="news" data-outlet="hotspawn">
  <a class="work-link" href="https://ARTICLE-URL" target="_blank" rel="noopener">
    <div class="work-thumb"><img src="assets/img/work/FILENAME.webp" width="640" height="360" alt="" loading="lazy" decoding="async"></div>
    <div class="work-body">
      <div class="work-meta"><span class="tag">Hotspawn</span><span class="work-type">News</span></div>
      <h3 class="work-title">Article headline<span class="sr-only"> (opens in a new tab)</span></h3>
    </div>
  </a>
</li>
```

`data-type` must be one of: `opinion`, `tournament-coverage`, `most-read`, `news`, `guides-lists`.
`data-outlet` must be one of: `hotspawn`, `gamerant`, `esports-net`, `destructoid`, `cheatcc`.

The filter counts are typed into the filter buttons near `data-filter="type"`, so bump those numbers if you want them exact.

## The "Latest bylines" feed updates itself

Every 3 hours GitHub runs `scripts/update_feed.py`. It pulls my six newest Hotspawn and GameRant stories and refreshes the article counts (the Bylines panels, the headline total and the About text). If anything changed, it commits the update and the live site follows a minute or two later. Those commits come from **github-actions[bot]**.

- Don't hand-edit between `<!-- feed:start -->` and `<!-- feed:end -->` in `index.html`; the next run overwrites it.
- The script also stamps the stylesheet and script links with a version tag (`style.css?v=…`) so visitors never get a stale copy after a change. It does this automatically whenever those files change.
- To refresh right now: GitHub → **Actions** → **Update latest articles** → **Run workflow**.
- If a site can't be reached, the feed keeps its last good headlines. If GameRant changes its page layout, the run shows a warning on the Actions tab.
- GitHub pauses scheduled jobs in repositories with no activity for 60 days. The bot's own commits count as activity, so this only matters if I stop publishing for two months; re-enable it from the Actions tab if so.

## Publishing changes

Edit a file on github.com (pencil icon → **Commit changes**) and the live site updates within a minute or two.

If editing a local copy instead, run `git pull` before starting, because the feed bot commits to the repository several times a day.
