#!/usr/bin/env python3
"""Summarize live evidence collected by runner.py. No external dependencies."""

from __future__ import annotations

import json
import statistics
from pathlib import Path

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
print("ORDERFLOW / BYBIT LIVE PROBE")
print("===========================")
print(f"Tick records: {len(ticks)}")
print(f"REST samples: {len(samples)}")
print(f"WebSocket control messages: {len(ws_messages)}")
for message in ws_messages[:5]:
    print("  WS:", message.get("control_message"))

if ticks:
    ids = [t.get("trade_id") for t in ticks if t.get("trade_id")]
    delays = [t["receive_minus_exchange_ms"] for t in ticks if isinstance(t.get("receive_minus_exchange_ms"), (int, float))]
    exchange_times = [t["exchange_time_ms"] for t in ticks if isinstance(t.get("exchange_time_ms"), (int, float))]
    duplicate_ids = len(ids) - len(set(ids))
    backwards = sum(1 for a, b in zip(exchange_times, exchange_times[1:]) if b < a)
    print(f"Unique trade IDs: {len(set(ids))} (duplicate records: {duplicate_ids})")
    print(f"Out-of-order exchange timestamps: {backwards}")
    if delays:
        print(
            "Receive minus exchange time (ms): "
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
        "App last trade minus REST ticker lastPrice (USD): "
        f"median={statistics.median(price_deltas):.4f}, "
        f"median absolute={statistics.median(abs_deltas):.4f}, "
        f"max absolute={max(abs_deltas):.4f}"
    )

candle_comparisons = []
for sample in samples:
    app_candle = sample.get("app_last_closed_candle")
    rest_rows = sample.get("rest_kline_rows") or []
    if not app_candle:
        continue
    match = next((r for r in rest_rows if len(r) >= 6 and int(r[0]) == int(app_candle["timestamp_ms"])), None)
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
    candle_comparisons.append((diffs, all(abs(v) < 1e-8 for v in diffs.values())))

if candle_comparisons:
    exact = sum(1 for _, ok in candle_comparisons if ok)
    print(f"Matched closed 1m candles: {len(candle_comparisons)} samples; exact OHLCV matches: {exact}")
    for field in ("open", "high", "low", "close", "volume"):
        max_abs = max(abs(item[0][field]) for item in candle_comparisons)
        print(f"  max |app - Bybit REST| {field}: {max_abs:.8f}")
else:
    print("Matched closed 1m candles: none yet (need a live feed and at least one candle close).")

errors = []
for sample in samples:
    for key in ("ticker_error", "kline_error"):
        if sample.get(key):
            errors.append(sample[key])
if errors:
    print("Sample network/API errors:")
    for error in errors[:5]:
        print(f"  - {error}")

print("\nRaw evidence directory:", LOG_DIR)
print("This report does not prove browser rendering; inspect the forwarded dashboard separately.")
