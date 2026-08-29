#!/usr/bin/env python3
"""
Refreshes data/pl.json (Premier League table, this week's fixtures, and
data-driven "player to watch" facts) from the Premier League's public
football API (footballapi.pulselive.com — the same API premierleague.com
itself uses for its tables page). Safe to re-run any week of any season:
it always looks up the current season and computes "this week" from
today's date, so it needs no yearly maintenance — just run it again.

Usage:
    python3 scripts/update_pl_data.py
"""
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://footballapi.pulselive.com/football"
HEADERS = {"Origin": "https://www.premierleague.com"}
# Wikimedia's API etiquette requires a descriptive User-Agent identifying the
# tool and a contact URL — requests without one can get rate-limited or blocked.
WIKI_HEADERS = {"User-Agent": "deoleg-github-io-pl-page/1.0 (https://deoleg.github.io/pl.html)"}
TZ = ZoneInfo("Europe/Chisinau")

RU_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
RU_MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
]
RU_POSITIONS = {"G": "Вратарь", "D": "Защитник", "M": "Полузащитник", "F": "Нападающий"}


def fetch_json(url: str, headers: dict = HEADERS) -> dict:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def current_season() -> dict:
    data = fetch_json(f"{API}/competitions/1/compseasons?page=0&pageSize=1&sort=asc")
    season = data["content"][0]
    return {"id": int(season["id"]), "label": season["label"]}


def fetch_standings(season_id: int) -> list[dict]:
    data = fetch_json(
        f"{API}/standings?compSeasons={season_id}&altIds=true&detail=2&FOOTBALL_COMPETITION=1"
    )
    entries = data["tables"][0]["entries"]
    table = []
    for e in entries:
        team = e["team"]
        overall = e["overall"]
        table.append({
            "position": e["position"],
            "team": team["name"],
            "shortName": team["shortName"],
            "crest": team.get("altIds", {}).get("opta"),
            "played": overall["played"],
            "won": overall["won"],
            "drawn": overall["drawn"],
            "lost": overall["lost"],
            "gf": overall["goalsFor"],
            "ga": overall["goalsAgainst"],
            "gd": overall["goalsDifference"],
            "points": overall["points"],
            "qualification": (e.get("annotations") or [{}])[0].get("destination"),
        })
    return table


def ru_date_label(dt: datetime) -> str:
    return f"{RU_WEEKDAYS[dt.weekday()]}, {dt.day} {RU_MONTHS[dt.month - 1]}, {dt.strftime('%H:%M')}"


def fetch_week_fixtures(season_id: int, now: datetime) -> tuple[list[dict], set[int]]:
    data = fetch_json(
        f"{API}/fixtures?comps=1&compSeasons={season_id}&page=0&pageSize=100"
        "&sort=asc&statuses=U,L&altIds=true"
    )
    window_end = now + timedelta(days=7)
    fixtures = []
    team_ids: set[int] = set()

    for f in data["content"]:
        millis = f["kickoff"]["millis"]
        kickoff = datetime.fromtimestamp(millis / 1000, tz=timezone.utc).astimezone(TZ)
        if kickoff > window_end:
            continue
        home, away = f["teams"][0]["team"], f["teams"][1]["team"]
        fixtures.append({
            "gameweek": f["gameweek"]["gameweek"],
            "kickoff": kickoff.isoformat(),
            "kickoffLabel": ru_date_label(kickoff),
            "home": home["name"],
            "homeCrest": home.get("altIds", {}).get("opta"),
            "away": away["name"],
            "awayCrest": away.get("altIds", {}).get("opta"),
            "ground": (f.get("ground") or {}).get("name"),
            "status": f["status"],
        })
        team_ids.add(int(home["id"]))
        team_ids.add(int(away["id"]))

    # International breaks etc. can leave the next 7 days empty — widen the
    # window rather than publishing an empty "this week" section.
    if not fixtures and data["content"]:
        return fetch_week_fixtures_widened(data["content"], now)

    fixtures.sort(key=lambda x: x["kickoff"])
    return fixtures, team_ids


def fetch_week_fixtures_widened(content: list[dict], now: datetime) -> tuple[list[dict], set[int]]:
    window_end = now + timedelta(days=14)
    fixtures = []
    team_ids: set[int] = set()
    for f in content:
        millis = f["kickoff"]["millis"]
        kickoff = datetime.fromtimestamp(millis / 1000, tz=timezone.utc).astimezone(TZ)
        if kickoff > window_end:
            continue
        home, away = f["teams"][0]["team"], f["teams"][1]["team"]
        fixtures.append({
            "gameweek": f["gameweek"]["gameweek"],
            "kickoff": kickoff.isoformat(),
            "kickoffLabel": ru_date_label(kickoff),
            "home": home["name"],
            "homeCrest": home.get("altIds", {}).get("opta"),
            "away": away["name"],
            "awayCrest": away.get("altIds", {}).get("opta"),
            "ground": (f.get("ground") or {}).get("name"),
            "status": f["status"],
        })
        team_ids.add(int(home["id"]))
        team_ids.add(int(away["id"]))
    fixtures.sort(key=lambda x: x["kickoff"])
    return fixtures, team_ids


def fetch_ranked_stat(season_id: int, stat: str, team_ids: set[int]) -> dict[int, dict]:
    data = fetch_json(
        f"{API}/stats/ranked/players/{stat}?compSeasons={season_id}&comps=1"
        "&page=0&pageSize=100&altIds=true"
    )
    best: dict[int, dict] = {}
    for entry in data["stats"]["content"]:
        owner = entry["owner"]
        team = owner["currentTeam"]
        team_id = int(team["id"])
        if team_id not in team_ids or team_id in best:
            continue
        best[team_id] = {
            "team": team["name"],
            "player": owner["name"]["display"],
            "position": RU_POSITIONS.get(owner["info"]["position"], owner["info"]["position"]),
            "nationality": owner.get("nationalTeam", {}).get("country"),
            "age": owner["age"].split(" years")[0] if owner.get("age") else None,
            "value": int(entry["value"]),
        }
    return best


def ru_count(n: int, one: str, few: str, many: str) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
        return few
    return many


# ---------------- Wikipedia enrichment ----------------
# Runs server-side (this script), not in the browser, so CORS never applies here —
# unlike the live-in-page fetches elsewhere on the site, this can call any public API.

def wiki_search_title(query: str) -> str | None:
    url = ("https://en.wikipedia.org/w/api.php?action=query&list=search"
           f"&srsearch={urllib.parse.quote(query)}&format=json&srlimit=3")
    try:
        data = fetch_json(url, headers=WIKI_HEADERS)
    except Exception:
        return None
    hits = data.get("query", {}).get("search", [])
    return hits[0]["title"] if hits else None


def wiki_intro_paragraphs(title: str) -> list[str]:
    url = ("https://en.wikipedia.org/w/api.php?action=query&prop=extracts"
           f"&exintro=1&explaintext=1&titles={urllib.parse.quote(title)}&format=json")
    data = fetch_json(url, headers=WIKI_HEADERS)
    pages = data.get("query", {}).get("pages", {})
    extract = next(iter(pages.values()), {}).get("extract", "")
    return [p.strip() for p in extract.split("\n") if p.strip()]


def first_sentences(text: str, max_len: int = 240) -> str:
    parts = re.split(r'(?<=[.!?])\s+', text)
    out = ""
    for part in parts:
        if out and len(out) + len(part) > max_len:
            break
        out = (out + " " + part).strip()
        if len(out) >= max_len * 0.6:
            break
    return out


def fetch_wiki_fact(player_name: str) -> dict | None:
    """Best-effort one-sentence trivia about a player, sourced from Wikipedia.
    Returns None on any failure or ambiguous match — never blocks the pipeline."""
    title = wiki_search_title(player_name + " footballer")
    if not title:
        return None
    try:
        paragraphs = wiki_intro_paragraphs(title)
    except Exception:
        return None
    if not paragraphs:
        return None
    # Guard against namesake mismatches (search can return a non-footballer page).
    if "footballer" not in paragraphs[0].lower() and "football player" not in paragraphs[0].lower():
        return None
    # The 2nd paragraph usually covers career highlights/honours — more
    # "interesting fact"-shaped than the 1st, which just restates position/club.
    body = paragraphs[1] if len(paragraphs) > 1 else paragraphs[0]
    sentence = first_sentences(body)
    if not sentence:
        return None
    return {
        "text": sentence,
        "url": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
    }


def build_facts(season_id: int, team_ids: set[int]) -> list[dict]:
    # Priority order: goals, then assists, then clean sheets (mainly keepers/
    # defenders), then minutes played — the last is near-universal, so almost
    # every team playing this week ends up with a fact instead of just the
    # early-season goalscorers.
    stat_sources = [
        ("goals", fetch_ranked_stat(season_id, "goals", team_ids)),
        ("assists", fetch_ranked_stat(season_id, "goal_assist", team_ids)),
        ("clean_sheets", fetch_ranked_stat(season_id, "clean_sheet", team_ids)),
        ("mins_played", fetch_ranked_stat(season_id, "mins_played", team_ids)),
    ]

    facts = []
    for team_id in team_ids:
        chosen = None
        for stat_key, ranked in stat_sources:
            if team_id in ranked:
                chosen = (stat_key, ranked[team_id])
                break
        if not chosen:
            continue

        stat_key, info = chosen
        n = info["value"]
        if stat_key == "goals":
            note = (f"лучший бомбардир «{info['team']}» в этом сезоне — "
                    f"{n} {ru_count(n, 'гол', 'гола', 'голов')}")
        elif stat_key == "assists":
            note = (f"лучший ассистент «{info['team']}» в этом сезоне — "
                    f"{n} {ru_count(n, 'результативная передача', 'результативные передачи', 'результативных передач')}")
        elif stat_key == "clean_sheets":
            note = (f"{n} {ru_count(n, 'сухой матч', 'сухих матча', 'сухих матчей')} "
                    f"за «{info['team']}» в этом сезоне")
        else:  # mins_played
            note = f"провёл на поле {n} минут за «{info['team']}» в этом сезоне"

        fact = {
            "team": info["team"],
            "player": info["player"],
            "position": info["position"],
            "nationality": info["nationality"],
            "age": info["age"],
            "note": note,
        }

        wiki = fetch_wiki_fact(info["player"])
        if wiki:
            fact["wikiFact"] = wiki["text"]
            fact["wikiUrl"] = wiki["url"]

        facts.append(fact)

    facts.sort(key=lambda f: f["team"])
    return facts


def main():
    now = datetime.now(tz=TZ)
    season = current_season()
    standings = fetch_standings(season["id"])
    fixtures, team_ids = fetch_week_fixtures(season["id"], now)
    facts = build_facts(season["id"], team_ids)

    out = {
        "updatedAt": now.isoformat(),
        "season": season["label"],
        "standings": standings,
        "fixtures": fixtures,
        "facts": facts,
    }

    out_path = Path(__file__).resolve().parent.parent / "data" / "pl.json"
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} — season {season['label']}, "
          f"{len(standings)} teams, {len(fixtures)} fixtures this week, {len(facts)} facts.")


if __name__ == "__main__":
    main()
