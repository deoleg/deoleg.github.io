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
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

API = "https://footballapi.pulselive.com/football"
HEADERS = {"Origin": "https://www.premierleague.com"}
TZ = ZoneInfo("Europe/Chisinau")

RU_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
RU_MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
]
RU_POSITIONS = {"G": "Вратарь", "D": "Защитник", "M": "Полузащитник", "F": "Нападающий"}


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=HEADERS)
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


def build_facts(season_id: int, team_ids: set[int]) -> list[dict]:
    goals = fetch_ranked_stat(season_id, "goals", team_ids)
    assists = fetch_ranked_stat(season_id, "goal_assist", team_ids)

    facts = []
    for team_id in team_ids:
        if team_id in goals:
            info, n = goals[team_id], goals[team_id]["value"]
            note = (f"лучший бомбардир «{info['team']}» в этом сезоне — "
                    f"{n} {ru_count(n, 'гол', 'гола', 'голов')}")
        elif team_id in assists:
            info, n = assists[team_id], assists[team_id]["value"]
            note = (f"лучший ассистент «{info['team']}» в этом сезоне — "
                    f"{n} {ru_count(n, 'результативная передача', 'результативные передачи', 'результативных передач')}")
        else:
            continue
        facts.append({
            "team": info["team"],
            "player": info["player"],
            "position": info["position"],
            "nationality": info["nationality"],
            "age": info["age"],
            "note": note,
        })

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
