# HN Uncensored

Monitor Hacker News for suspicious rank drops that might indicate flagging or moderation.

## How It Works

Stories on HN sometimes vanish from the front page without explanation. This app polls the top 90 stories every 5 minutes and uses **z-score anomaly detection** to flag unusual rank drops.

### Z-Score Detection

Instead of a simple threshold ("dropped 15+ positions"), we ask: *"Is this drop statistically unusual for this story?"*

Each story maintains a rolling window of rank changes. When a new drop occurs, we compute how many standard deviations it is from that story's normal behavior. A z-score > 3.0 means the drop is in the 99.7th percentile of unusualness.

Key parameters:
- `lag: 24` - rolling window size (24 polls at 5‑min intervals)
- `minDataPoints: 6` - warm‑up before alerts (≈30 minutes at 5‑min polls)
- `threshold: 3.0` - 3 standard deviations = statistically significant
- `influence: 0.2` - anomalies only contribute 20% to the filtered baseline (prevents corruption)
- `minDrop: 5` - ignore tiny rank wiggles

### Severity Scoring

Alerts are scored based on:
- **Z-score** - How anomalous the drop was (z * 15 points)
- **Score rising** - +25 if upvotes are increasing (very suspicious)
- **Off list** - +20 if story fell off top 90 entirely

## Running

```bash
cd examples/hn-uncensored
bun install
bun dev
```

Open http://localhost:3014

## Data

Persistence is saved to `./data/hn-uncensored.json` - this includes all tracked stories, history snapshots, detector state, and alerts.
