#!/usr/bin/env python3
"""
Refreshes the "Newsletter Archive" block in about.html from the Mailchimp API.

Pulls sent *regular* campaigns for one audience over the last 12 months, keeps
the newest MAX_ITEMS, and rewrites the HTML between the
<!-- newsletters:start --> / <!-- newsletters:end --> markers in about.html.
Nothing else on the page is touched.

Needs the environment variable MAILCHIMP_API_KEY (format "<hex>-<dc>", e.g.
"abc123...-us7" — the datacenter is the bit after the dash). In CI it comes from
the repo secret of the same name; locally, export it yourself:

    MAILCHIMP_API_KEY=xxxxxxxx-us7 python3 scripts/update_newsletters.py

Exit code is non-zero on any API error or if Mailchimp returns no campaigns, so
a failed run leaves the last known-good list on the page instead of wiping it.
"""
import base64
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

LIST_ID = "6d88944e7d"          # "Audience ID" in Mailchimp → Audience → Settings
MAX_ITEMS = 12                  # newest N letters shown on the page
DAYS_BACK = 365                 # only letters sent within the last year
PAGE = Path(__file__).resolve().parent.parent / "about.html"
START_MARKER = "<!-- newsletters:start -->"
END_MARKER = "<!-- newsletters:end -->"

EN_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Subject lines for test / preview sends we don't want on the public page:
# "Test", "[TEST] ...", "Re: test ...", etc.
SKIP_SUBJECT_RE = re.compile(r"^\s*(re:\s*)?\[?\s*test\b", re.I)

# Internal segment/tag prefix that Mailchimp keeps in some subject lines
# ("UPDATES::News from Moldova") — strip it for the public list.
PREFIX_RE = re.compile(r"^[A-Za-z]+::\s*")


def api_get(path: str, params: dict, api_key: str) -> dict:
    dc = api_key.rsplit("-", 1)[-1] if "-" in api_key else ""
    if not re.fullmatch(r"[a-z]{2}\d+", dc):
        sys.exit("MAILCHIMP_API_KEY has no datacenter suffix (expected '<key>-us7')")
    url = f"https://{dc}.api.mailchimp.com/3.0/{path}?" + urllib.parse.urlencode(params)
    token = base64.b64encode(f"anystring:{api_key}".encode()).decode()
    req = urllib.request.Request(url, headers={"Authorization": f"Basic {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        sys.exit(f"Mailchimp API {e.code} on /{path}: {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"Mailchimp API unreachable: {e.reason}")


def fetch_campaigns(api_key: str) -> list:
    since = (datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)).strftime(
        "%Y-%m-%dT%H:%M:%S+00:00"
    )
    params = {
        "list_id": LIST_ID,
        "status": "sent",
        "type": "regular",
        "sort_field": "send_time",
        "sort_dir": "DESC",
        "since_send_time": since,
        "count": 200,
        "fields": ",".join([
            "campaigns.send_time",
            "campaigns.archive_url",
            "campaigns.settings.subject_line",
            "campaigns.settings.title",
        ]),
    }
    data = api_get("campaigns", params, api_key)
    campaigns = data.get("campaigns")
    if not campaigns:
        sys.exit("Mailchimp returned no sent campaigns for the last year — "
                 "leaving about.html unchanged")
    return campaigns


def build_rows(campaigns: list) -> list:
    rows = []
    for c in campaigns:
        send_time = (c.get("send_time") or "").strip()
        url = (c.get("archive_url") or "").strip()
        settings = c.get("settings") or {}
        subject = (settings.get("subject_line") or settings.get("title") or "").strip()
        subject = PREFIX_RE.sub("", subject).strip()
        if not (send_time and url and subject):
            continue
        if SKIP_SUBJECT_RE.match(subject):
            continue
        try:
            dt = datetime.fromisoformat(send_time)
        except ValueError:
            continue
        rows.append((dt, subject, url))
    # Mailchimp's sort_field=send_time is not always honoured, so sort here and
    # then keep the newest MAX_ITEMS.
    rows.sort(key=lambda r: r[0], reverse=True)
    return rows[:MAX_ITEMS]


def render_block(rows: list) -> str:
    if rows:
        items = "\n".join(
            f'        <li><span class="nl-date">{EN_MONTHS[dt.month - 1]} {dt.year}</span>'
            f'<a href="{html.escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">'
            f"{html.escape(subject)}</a></li>"
            for dt, subject, url in rows
        )
        body = f'      <ul class="nl-list">\n{items}\n      </ul>'
    else:
        body = '      <p class="nl-empty">No newsletters in the last year.</p>'
    return (
        f"{START_MARKER}\n"
        f'    <section class="newsletter-archive" aria-label="Newsletter archive">\n'
        f"      <h2>Newsletter Archive</h2>\n"
        f"{body}\n"
        f'      <p class="nl-updated">Updated automatically from our Mailchimp newsletter.</p>\n'
        f"    </section>\n"
        f"    {END_MARKER}"
    )


def main() -> None:
    api_key = os.environ.get("MAILCHIMP_API_KEY", "").strip()
    if not api_key:
        sys.exit("MAILCHIMP_API_KEY is not set")

    text = PAGE.read_text(encoding="utf-8")
    if START_MARKER not in text or END_MARKER not in text:
        sys.exit(f"{PAGE.name} is missing the {START_MARKER} / {END_MARKER} markers")

    rows = build_rows(fetch_campaigns(api_key))
    block = render_block(rows)
    new_text = re.sub(
        re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER),
        lambda _m: block,
        text,
        count=1,
        flags=re.S,
    )

    if new_text == text:
        print(f"Newsletter archive already up to date ({len(rows)} item(s))")
        return
    PAGE.write_text(new_text, encoding="utf-8")
    print(f"Newsletter archive updated ({len(rows)} item(s))")


if __name__ == "__main__":
    main()
