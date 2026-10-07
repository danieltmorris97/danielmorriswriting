# danielmorriswriting.co.uk

My writing portfolio. It's a plain static site (HTML, CSS and a little JavaScript), so there's nothing to install or build.

## What's where

| File | What it is |
| --- | --- |
| `index.html` | The whole homepage: intro, bylines, columns, interviews, the archive, about and contact |
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

## Updating the "Latest from Hotspawn" list and columns

Search `index.html` for `Latest from Hotspawn` or a column name (e.g. `VRS Shift`) and edit the headline, date and link in place.

## Publishing changes

Once the site is on GitHub, edit a file on github.com (pencil icon → **Commit changes**) and the live site updates within a minute or two.
