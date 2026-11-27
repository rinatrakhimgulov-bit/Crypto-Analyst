#!/usr/bin/env python3
"""Summarize live evidence collected by runner.py. No external dependencies."""

from __future__ import annotations

import json
import statistics
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[2]
LOG_DIR = ROOT / "orderflow-cloud-test-output"


def load(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


ticks = load(LOG_DIR / "ticks.jsonl")
samples = load(LOG_DIR / "samples.jsonl")
ws_messages = load(LOG_DIR / "ws_control.jsonl")
seed_rows = load(LOG_DIR / "history_seed.jsonl")
seed_last_ts = next(
    (r.get("last_timestamp_ms") for r in reversed(seed_rows) if r.get("last_timestamp_ms") is not None),
    None,
)

print("ORDERFLOW / BYBIT LIVE PROBE")
print("===========================")
print(f"Tick records: {len(ticks)}")
print(f"REST samples: {len(samples)}")
print(f"WebSocket control messages: {len(ws_messages)}")
if seed_rows:
    print("History seed:", seed_rows[-1])
for message in ws_messages[:5]:
    print("  WS:", message.get("control_message"))

if ticks:
    ids = [t.get("trade_id") for t in ticks if t.get("trade_id")]
    delays = [t["receive_minus_exchange_ms"] for t in ticks if isinstance(t.get("receive_minus_exchange_ms"), (int, float))]
    exchange_times = [t["exchange_time_ms"] for t in ticks if isinstance(t.get("exchange_time_ms"), (int, float))]
    duplicate_ids = len(ids) - len(set(ids))
    backwards = sum(1 for a, b in zip(exchange_times, exchange_times[1:]) if b < a)
    bucket_mismatches = 0
    for tick in ticks:
        candle = tick.get("current_candle")
        exchange_ts = tick.get("exchange_time_ms")
        if candle and exchange_ts is not None:
            expected_bucket = (int(exchange_ts) // 60_000) * 60_000
            if int(candle["timestamp_ms"]) != expected_bucket:
                bucket_mismatches += 1
    print(f"Unique trade IDs: {len(set(ids))} (duplicate records: {duplicate_ids})")
    print(f"Out-of-order exchange timestamps: {backwards}")
    print(f"Ticks applied to a different minute bucket than their exchange timestamp: {bucket_mismatches}")
    if delays:
        print(
            "Local receive time minus exchange event time (ms; includes clock offset): "
            f"min={min(delays):.0f}, median={statistics.median(delays):.0f}, "
            f"p95={sorted(delays)[int((len(delays)-1)*0.95)]:.0f}, max={max(delays):.0f}"
        )
    prices = [float(t["price"]) for t in ticks if t.get("price") is not None]
    if prices:
        print(f"Trade price range: {min(prices):.2f} .. {max(prices):.2f}")
else:
    print("NO LIVE TRADE RECORDS. A successful process start is not a successful feed test.")

ticker_ok = sum(1 for s in samples if s.get("ticker_http_status") == 200 and s.get("ticker_ret_code") == 0)
ticker_fail = len(samples) - ticker_ok
kline_ok = sum(1 for s in samples if s.get("kline_http_status") == 200 and s.get("kline_ret_code") == 0)
print(f"Bybit REST ticker: {ticker_ok} successful / {ticker_fail} failed samples")
print(f"Bybit REST kline: {kline_ok} successful / {len(samples)-kline_ok} failed samples")

price_deltas = []
for sample in samples:
    rest = sample.get("rest_last_price")
    app = sample.get("app_current_price")
    if rest is not None and app is not None:
        try:
            price_deltas.append(float(app) - float(rest))
        except (TypeError, ValueError):
            pass
if price_deltas:
    abs_deltas = [abs(x) for x in price_deltas]
    print(
        "App last trade minus REST ticker lastPrice (USD; sampled, not tick-synchronous): "
        f"median={statistics.median(price_deltas):.4f}, "
        f"median absolute={statistics.median(abs_deltas):.4f}, "
        f"max absolute={max(abs_deltas):.4f}"
    )

# Only compare candles created after the REST history seed. Seeded rows are not evidence
# that the candidate's live CandleBuilder produced a matching candle.
comparisons_by_ts = {}
for sample in samples:
    app_candle = sample.get("app_last_closed_candle")
    rest_rows = sample.get("rest_kline_rows") or []
    if not app_candle:
        continue
    candle_ts = int(app_candle["timestamp_ms"])
    if seed_last_ts is not None and candle_ts <= int(seed_last_ts):
        continue
    match = next((r for r in rest_rows if len(r) >= 6 and int(r[0]) == candle_ts), None)
    if not match:
        continue
    expected = {
        "open": float(match[1]),
        "high": float(match[2]),
        "low": float(match[3]),
        "close": float(match[4]),
        "volume": float(match[5]),
    }
    actual = {k: float(app_candle[k]) for k in expected}
    diffs = {k: actual[k] - expected[k] for k in expected}
    comparisons_by_ts[candle_ts] = diffs

if comparisons_by_ts:
    rows = list(comparisons_by_ts.values())
    exact = sum(1 for diffs in rows if all(abs(v) < 1e-6 for v in diffs.values()))
    print(f"Live-built closed 1m candles matched: {len(rows)} unique candles; within 1e-6 OHLCV: {exact}")
    for field in ("open", "high", "low", "close", "volume"):
        max_abs = max(abs(item[field]) for item in rows)
        print(f"  max |app - Bybit REST| {field}: {max_abs:.8f}")
else:
    print("Live-built closed 1m candles matched: none yet (allow at least two minute boundaries).")

errors = []
for sample in samples:
    for key in ("ticker_error", "kline_error"):
        if sample.get(key):
            errors.append(sample[key])
for seed in seed_rows:
    if seed.get("error"):
        errors.append(seed["error"])
if errors:
    print("Sample network/API errors:")
    for error in errors[:5]:
        print(f"  - {error}")

archive_path = ROOT / "orderflow-cloud-test-evidence.zip"
with ZipFile(archive_path, "w", ZIP_DEFLATED) as archive:
    for path in LOG_DIR.glob("*"):
        if path.is_file():
            archive.write(path, arcname=path.name)

print("\nRaw evidence directory:", LOG_DIR)
print("Evidence archive:", archive_path)
print("This report does not prove browser rendering; inspect the forwarded dashboard separately.")
