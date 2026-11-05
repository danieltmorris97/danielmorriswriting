"""Refresh the "Latest" feed, live article counts and TikTok stats in index.html.

Runs on a schedule via .github/workflows/update-feed.yml, and can be run by hand:
    python scripts/update_feed.py

Only uses the standard library. If a source can't be reached, its previous
headlines and count (kept in data/feed.json) are reused so the page never
loses content; the script only fails if every source fails.
"""
import base64
import hashlib
import html
import json
import math
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
STATE = ROOT / "data" / "feed.json"

USER_AGENT = "Mozilla/5.0 (compatible; danielmorriswriting-feed/1.0; +https://www.danielmorriswriting.co.uk)"
ITEMS_PER_OUTLET = 6

HOTSPAWN_API = "https://www.hotspawn.com/wp-json/wp/v2/posts?author=130&per_page=10&_fields=date,link,title"
HOTSPAWN_AUTHOR = "https://www.hotspawn.com/author/danielmorris"
GAMERANT_AUTHOR = "https://gamerant.com/author/daniel-thomas-morris/"
TIKTOK_PROFILE = "https://www.tiktok.com/@the.gaming.doxie"

# Outlets that no longer change, added to the live counts for the headline total.
ESPORTS_NET_ARTICLES = 629
DESTRUCTOID_AND_CHEATCC_MIN = 78

ARROW = ('<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
         'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 7l-10 10" />'
         '<path d="M8 7l9 0l0 9" /></svg>')
NEW_TAB = '<span class="sr-only"> (opens in a new tab)</span>'
LOGOS = {  # file in assets/img/logos/, intrinsic width and height
    "Hotspawn": ("hotspawn.webp", 640, 121),
    "GameRant": ("gamerant.webp", 640, 88),
}


def fetch(url, attempts=3):
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read().decode("utf-8", "replace"), resp.headers
        except Exception as e:  # network errors, HTTP 4xx/5xx
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


def clean(text):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", "", text)).split())


def get_hotspawn():
    body, headers = fetch(HOTSPAWN_API)
    posts = json.loads(body)
    items = [{"title": clean(p["title"]["rendered"]), "url": p["link"], "date": p["date"][:10]} for p in posts]
    count = int(headers.get("X-WP-Total") or 0)
    if not items or not count:
        raise RuntimeError("Hotspawn returned no posts")
    return items, count


def parse_gamerant_date(label, now):
    label = label.strip().lower()
    if label in ("just now", "now"):
        return now.date()
    if label == "yesterday":
        return (now - timedelta(days=1)).date()
    m = re.match(r"(\d+)\s+(second|minute|hour|day|week)s?\s+ago", label)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        return (now - timedelta(**{unit + "s": n})).date()
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(label.title(), fmt).date()
        except ValueError:
            pass
    return None


def get_gamerant(previous_dates):
    body, _ = fetch(GAMERANT_AUTHOR)
    now = datetime.now(timezone.utc)
    items, seen = [], set()
    for card in re.split(r'<div class="display-card ', body)[1:]:
        if "pinned-article-date" in card:  # featured picks GameRant pins to the profile, not the latest work
            continue
        t = re.search(r'class="[^"]*display-card-title[^"]*"[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>', card, re.S)
        if not t:
            continue
        url = t.group(1)
        if url.startswith("/"):
            url = "https://gamerant.com" + url
        if url in seen:
            continue
        seen.add(url)
        date = previous_dates.get(url)
        if not date:
            d = re.search(r'data-b64-ts="([^"]+)"', card)
            parsed = parse_gamerant_date(base64.b64decode(d.group(1)).decode("utf-8", "replace"), now) if d else None
            date = (parsed or now.date()).isoformat()
        items.append({"title": clean(t.group(2)), "url": url, "date": date})
    m = re.search(r"([\d,]+)\s*articles", re.sub(r"<[^>]+>", " ", body))
    count = int(m.group(1).replace(",", "")) if m else 0
    if not items or not count:
        raise RuntimeError("GameRant page had no articles (layout may have changed)")
    items.sort(key=lambda i: i["date"], reverse=True)  # stable: keeps page order within a day
    return items, count


def logo_img(name):
    file, w, h = LOGOS[name]
    return f'<img class="logo-mark logo-{name.lower()}" src="assets/img/logos/{file}" width="{w}" height="{h}" alt="{name}">'


def get_tiktok():
    body, _ = fetch(TIKTOK_PROFILE)
    m = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', body, re.S)
    if not m:
        raise RuntimeError("TikTok page had no profile data")
    stats = json.loads(m.group(1))["__DEFAULT_SCOPE__"]["webapp.user-detail"]["userInfo"]["stats"]
    out = {"followers": int(stats["followerCount"]),
           "likes": int(stats.get("heartCount") or stats.get("heart") or 0),
           "videos": int(stats["videoCount"])}
    if not out["followers"]:
        raise RuntimeError("TikTok returned no follower count")
    return out


def get_tiktok_plays(video_id):
    body, _ = fetch(f"https://www.tiktok.com/@the.gaming.doxie/video/{video_id}")
    m = re.search(r'<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>', body, re.S)
    if not m:
        raise RuntimeError("video page had no data")
    item = json.loads(m.group(1))["__DEFAULT_SCOPE__"]["webapp.video-detail"]["itemInfo"]["itemStruct"]
    return int(item["stats"]["playCount"])


def update_tiktok_views(page, views):
    """Rewrite each featured video's view count and its bar (scaled to the most-viewed one)."""
    known = {k: v for k, v in views.items() if f'data-tt-views="{k}"' in page}
    if not known:
        return page
    peak = max(known.values())
    for vid, plays in known.items():
        page = re.sub(rf'(<span class="tt-views" data-tt-views="{vid}">)[^<]*', rf"\g<1>{compact(plays)}", page)
        page = re.sub(rf'(data-tt-bar="{vid}" style="--w: )\d+(%")', rf"\g<1>{round(plays / peak * 100)}\g<2>", page)
    return page


def compact(n):
    """22000 -> 22K, 2500000 -> 2.5M, the way TikTok itself shows counts."""
    for size, suffix in ((1_000_000, "M"), (1_000, "K")):
        if n >= size:
            v = n / size
            return (f"{v:.1f}".rstrip("0").rstrip(".") if v < 100 else f"{v:.0f}") + suffix
    return str(n)


def render_column(name, role, author_url, data):
    rows = []
    for it in data["items"][:ITEMS_PER_OUTLET]:
        d = datetime.strptime(it["date"], "%Y-%m-%d")
        rows.append(
            f'              <li>\n'
            f'                <a class="feed-row" href="{html.escape(it["url"])}" target="_blank" rel="noopener">\n'
            f'                  <time class="feed-date" datetime="{it["date"]}">{d.strftime("%d %b %Y")}</time>\n'
            f'                  <span class="feed-title">{html.escape(it["title"])}{NEW_TAB}</span>\n'
            f'                  {ARROW}\n'
            f'                </a>\n'
            f'              </li>')
    return (
        f'          <div class="latest-col">\n'
        f'            <div class="latest-head">\n'
        f'              <h3 class="latest-outlet">{logo_img(name)}</h3>\n'
        f'              <span class="latest-role">{role}</span>\n'
        f'            </div>\n'
        f'            <ul class="latest-list">\n' + "\n".join(rows) + '\n'
        f'            </ul>\n'
        f'            <a class="text-link latest-more" href="{author_url}" target="_blank" rel="noopener">'
        f'All {data["count"]:,} {name} articles {ARROW}{NEW_TAB}</a>\n'
        f'          </div>')


def stamp_assets(page):
    """Version the CSS/JS links by content hash so browsers never pair a new page with a cached old stylesheet."""
    for rel in ("assets/css/style.css", "assets/js/main.js"):
        digest = hashlib.sha1((ROOT / rel).read_bytes()).hexdigest()[:8]
        page = re.sub(rf'({re.escape(rel)})(\?v=[0-9a-f]+)?"', rf'\g<1>?v={digest}"', page)
    return page


def replace_live(page, key, text):
    page, n = re.subn(rf'(<span[^>]*\sdata-live="{key}"[^>]*>)[^<]*(</span>)', rf"\g<1>{text}\g<2>", page)
    if not n:
        print(f"::warning::No data-live=\"{key}\" span found in index.html")
    return page


def main():
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    ok = 0

    try:
        items, count = get_hotspawn()
        state["hotspawn"] = {"count": count, "items": items}
        ok += 1
        print(f"Hotspawn: {count} articles, latest '{items[0]['title']}'")
    except Exception as e:
        print(f"::warning::Hotspawn fetch failed, keeping previous data: {e}")

    try:
        previous = {i["url"]: i["date"] for i in state.get("gamerant", {}).get("items", [])}
        items, count = get_gamerant(previous)
        state["gamerant"] = {"count": count, "items": items[:ITEMS_PER_OUTLET * 2]}
        ok += 1
        print(f"GameRant: {count} articles, latest '{items[0]['title']}'")
    except Exception as e:
        print(f"::warning::GameRant fetch failed, keeping previous data: {e}")

    try:
        state["tiktok"] = get_tiktok()
        t = state["tiktok"]
        print(f"TikTok: {t['followers']} followers, {t['likes']} likes, {t['videos']} videos")
    except Exception as e:
        print(f"::warning::TikTok fetch failed, keeping previous numbers: {e}")

    # Featured TikTok videos are whatever index.html lists (data-tt-views="<id>")
    featured = re.findall(r'data-tt-views="(\d+)"', INDEX.read_text(encoding="utf-8"))
    views = state.get("tiktok_videos", {})
    for vid in featured:
        try:
            views[vid] = get_tiktok_plays(vid)
        except Exception as e:
            print(f"::warning::TikTok video {vid} fetch failed, keeping previous views: {e}")
    state["tiktok_videos"] = {k: views[k] for k in featured if k in views}
    if featured:
        print(f"TikTok videos: views refreshed for {len(state['tiktok_videos'])} of {len(featured)}")

    if not ok:
        print("::error::Every source failed; nothing updated")
        return 1
    if "hotspawn" not in state or "gamerant" not in state:
        print("::error::No saved data for a failed source yet; not touching the page")
        return 1

    page = INDEX.read_text(encoding="utf-8")
    block = "\n".join([
        "<!-- feed:start (generated by scripts/update_feed.py; edits here are overwritten) -->",
        '        <div class="latest-grid">',
        render_column("Hotspawn", "Counter-Strike Content Lead", HOTSPAWN_AUTHOR, state["hotspawn"]),
        render_column("GameRant", "News writer", GAMERANT_AUTHOR, state["gamerant"]),
        "        </div>",
        "        <!-- feed:end -->",
    ])
    page, n = re.subn(r"<!-- feed:start.*?<!-- feed:end -->", lambda _: block, page, flags=re.S)
    if not n:
        print("::error::feed markers missing from index.html")
        return 1

    hs, gr = state["hotspawn"]["count"], state["gamerant"]["count"]
    total = math.floor((hs + gr + ESPORTS_NET_ARTICLES + DESTRUCTOID_AND_CHEATCC_MIN) / 100) * 100
    page = replace_live(page, "hotspawn-count", f"{hs:,}")
    page = replace_live(page, "gamerant-count", f"{gr:,}")
    page = replace_live(page, "gamerant-floor", f"{gr // 100 * 100:,}")
    page = replace_live(page, "total", f"{total:,}")
    page = re.sub(r'(<span data-count=")\d+(" data-live="total">)', rf"\g<1>{total}\g<2>", page)
    page = re.sub(r"with [\d,]+\+ articles across", f"with {total:,}+ articles across", page)
    if "tiktok" in state:
        t = state["tiktok"]
        page = replace_live(page, "tiktok-followers", compact(t["followers"]))
        page = replace_live(page, "tiktok-likes", compact(t["likes"]))
        page = replace_live(page, "tiktok-videos", f"{t['videos']:,}")
    page = update_tiktok_views(page, state.get("tiktok_videos", {}))

    STATE.parent.mkdir(exist_ok=True)
    STATE.write_text(json.dumps(state, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    INDEX.write_text(stamp_assets(page), encoding="utf-8", newline="\n")
    not_found = ROOT / "404.html"
    not_found.write_text(stamp_assets(not_found.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
    print(f"Total shown: {total:,}+")
    return 0


if __name__ == "__main__":
    sys.exit(main())
