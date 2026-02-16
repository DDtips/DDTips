# Football Value Bot (New, Separate)

This bot is fully separate from the existing app and does not change current code.

## What it does
- reads matches from Supabase tables `predictions` + `matches`
- picks the better side (`OVER 2.5` or `UNDER 2.5`) per match
- calculates value edge from model probability vs bookmaker odds
- returns only picks above your threshold (for example 10%)
- can send the result to Telegram

## 1) Install

```bash
cd /Users/skoljo/stavna-evidenca/web/bot_v2
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Then set your real keys in `.env`.

## 2) Run

Default run:

```bash
python value_bot.py
```

Custom settings:

```bash
python value_bot.py --days 2 --min-edge 12 --limit 10
```

JSON output:

```bash
python value_bot.py --json
```

Send to Telegram:

```bash
python value_bot.py --send-telegram
```

## CLI options
- `--days` lookahead window in days (default `3`)
- `--min-edge` minimum value edge in percent (default `10`)
- `--limit` max number of picks (default `8`)
- `--json` print JSON output
- `--send-telegram` deliver message to Telegram

## Note
This bot uses existing `predictions` data.  
If you want, next step can be adding a separate scheduler (cron) for automatic daily push.
