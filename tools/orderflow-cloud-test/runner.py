#!/usr/bin/env python3
"""Run the pinned OrderFlow candidate on one Bybit instrument and record evidence."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import aiohttp

ROOT = Path(__file__).resolve().parents[2]
REPO = Path(os.environ.get("ORDERFLOW_REPO", ROOT / ".cloud-test" / "OrderFlow-Analysis-Pro"))
LOG_DIR = Path(os.environ.get("ORDERFLOW_PROBE_LOG_DIR", ROOT / "orderflow-cloud-test-output"))
LOG_DIR.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(REPO))

from orderflow_system.config.settings import DASHBOARD, DataSource, get_btcusd_config  # noqa: E402
from orderflow_system.data.bybit_feed import BybitFeed  # noqa: E402
from orderflow_system.data.models import Candle  # noqa: E402
from orderflow_system.main import OrderflowSystem, setup_logging  # noqa: E402

TICK_LOG = LOG_DIR / "ticks.jsonl"
SAMPLE_LOG = LOG_DIR / "samples.jsonl"
WS_LOG = LOG_DIR / "ws_control.jsonl"
SEED_LOG = LOG_DIR / "history_seed.jsonl"
REST_TICKER = "https://api.bybit.com/v5/market/tickers"
REST_KLINE = "https://api.bybit.com/v5/market/kline"


def append_jsonl(path: Path, row: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, separators=(",", ":"), ensure_ascii=False) + "\n")


def candle_snapshot(candle: Any) -> dict[str, Any] | None:
    if candle is None:
        return None
    return {
        "timestamp_ms": int(candle.timestamp_ms),
        "open": float(candle.open),
        "high": float(candle.high),
        "low": float(candle.low),
        "close": float(candle.close),
        "volume": float(candle.volume),
        "tick_count": int(candle.tick_count),
    }


async def seed_history(system: OrderflowSystem) -> None:
    """Preload closed 1m history so the chart is not an empty live-only view."""
    pipeline = system.pipelines["BTCUSDT"]
    timeout = aiohttp.ClientTimeout(total=10)
    row: dict[str, Any] = {"kind": "history_seed", "local_time_ms": int(time.time() * 1000)}
    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            params = {"category": "linear", "symbol": "BTCUSDT", "interval": "1", "limit": "500"}
            async with session.get(REST_KLINE, params=params) as response:
                row["http_status"] = response.status
                payload = await response.json(content_type=None)
        row["ret_code"] = payload.get("retCode")
        if response.status != 200 or payload.get("retCode") != 0:
            row["error"] = payload.get("retMsg", f"HTTP {response.status}")
            append_jsonl(SEED_LOG, row)
            print(f"[probe] REST history seed unavailable: {row['error']}", flush=True)
            return

        now_ms = int(time.time() * 1000)
        candles = []
        for item in payload.get("result", {}).get("list", []):
            if len(item) < 6:
                continue
            start_ms = int(item[0])
            if start_ms + 60_000 > now_ms:
                continue  # Do not seed the still-forming exchange candle.
            candles.append(Candle(
                timestamp_ms=start_ms,
                open=float(item[1]),
                high=float(item[2]),
                low=float(item[3]),
                close=float(item[4]),
                volume=float(item[5]),
            ))
        loaded = pipeline.candle_builder.load_historical_candles(candles)
        row["received_rows"] = len(payload.get("result", {}).get("list", []))
        row["closed_rows_loaded"] = loaded
        row["first_timestamp_ms"] = candles[0].timestamp_ms if candles else None
        row["last_timestamp_ms"] = candles[-1].timestamp_ms if candles else None
        append_jsonl(SEED_LOG, row)
        print(f"[probe] Seeded {loaded} closed Bybit 1m candles for chart history.", flush=True)
    except Exception as exc:
        row["error"] = f"{type(exc).__name__}: {exc}"
        append_jsonl(SEED_LOG, row)
        print(f"[probe] REST history seed failed: {row['error']}", flush=True)


async def rest_monitor(system: OrderflowSystem, stop: asyncio.Event) -> None:
    timeout = aiohttp.ClientTimeout(total=8)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        while not stop.is_set():
            started_ms = int(time.time() * 1000)
            row: dict[str, Any] = {
                "kind": "sample",
                "local_time_ms": started_ms,
                "symbol": "BTCUSDT",
            }

            for name, url, params in (
                ("ticker", REST_TICKER, {"category": "linear", "symbol": "BTCUSDT"}),
                ("kline", REST_KLINE, {"category": "linear", "symbol": "BTCUSDT", "interval": "1", "limit": "3"}),
            ):
                try:
                    async with session.get(url, params=params) as response:
                        row[name + "_http_status"] = response.status
                        payload = await response.json(content_type=None)
                        row[name + "_ret_code"] = payload.get("retCode")
                        if name == "ticker" and payload.get("result", {}).get("list"):
                            item = payload["result"]["list"][0]
                            row["rest_last_price"] = item.get("lastPrice")
                            row["rest_mark_price"] = item.get("markPrice")
                            row["rest_index_price"] = item.get("indexPrice")
                            row["rest_ticker_time_ms"] = payload.get("time")
                        elif name == "kline":
                            row["rest_kline_rows"] = payload.get("result", {}).get("list", [])
                        if payload.get("retCode") not in (0, None):
                            row[name + "_error"] = payload.get("retMsg")
                except Exception as exc:  # Network/proxy errors are evidence too.
                    row[name + "_error"] = f"{type(exc).__name__}: {exc}"

            pipeline = system.pipelines.get("BTCUSDT")
            if pipeline:
                row["app_current_candle"] = candle_snapshot(pipeline.candle_builder.current_candle)
                history = pipeline.candle_builder.history
                row["app_last_closed_candle"] = candle_snapshot(history[-1]) if history else None
                row["app_tick_count"] = pipeline._tick_count
                row["app_current_price"] = pipeline.current_price

            append_jsonl(SAMPLE_LOG, row)
            print(
                "[probe] REST ticker={last} mark={mark} index={index} | "
                "app_price={app} ticks={ticks} REST={status}".format(
                    last=row.get("rest_last_price", "n/a"),
                    mark=row.get("rest_mark_price", "n/a"),
                    index=row.get("rest_index_price", "n/a"),
                    app=row.get("app_current_price", "n/a"),
                    ticks=row.get("app_tick_count", 0),
                    status=row.get("ticker_http_status", row.get("ticker_error", "n/a")),
                ),
                flush=True,
            )

            try:
                await asyncio.wait_for(stop.wait(), timeout=5)
            except asyncio.TimeoutError:
                pass


async def run() -> None:
    setup_logging()
    DASHBOARD.host = "0.0.0.0"
    DASHBOARD.port = 8080
    DASHBOARD.enabled = True

    # Capture subscription acknowledgements, which the candidate otherwise ignores.
    original_message_handler = BybitFeed._handle_message

    async def traced_message_handler(feed: BybitFeed, message: dict) -> None:
        if "op" in message or "success" in message:
            append_jsonl(WS_LOG, {
                "local_receive_time_ms": int(time.time() * 1000),
                "control_message": message,
            })
        await original_message_handler(feed, message)

    BybitFeed._handle_message = traced_message_handler

    system = OrderflowSystem(
        instruments=[get_btcusd_config()],
        data_source=DataSource.BYBIT,
    )

    async def traced_on_tick(symbol: str, tick: Any) -> None:
        await original_on_tick(symbol, tick)
        pipeline = system.pipelines.get(symbol)
        if pipeline is None:
            return
        local_ms = int(time.time() * 1000)
        append_jsonl(TICK_LOG, {
            "kind": "tick",
            "local_receive_time_ms": local_ms,
            "exchange_time_ms": int(tick.timestamp_ms),
            "receive_minus_exchange_ms": local_ms - int(tick.timestamp_ms),
            "symbol": symbol,
            "price": float(tick.price),
            "size": float(tick.size),
            "side": str(tick.side.value),
            "trade_id": str(tick.trade_id),
            "current_candle": candle_snapshot(pipeline.candle_builder.current_candle),
        })

    original_on_tick = system._on_tick
    system._on_tick = traced_on_tick

    await seed_history(system)

    stop = asyncio.Event()
    monitor_task = asyncio.create_task(rest_monitor(system, stop))

    codespace = os.environ.get("CODESPACE_NAME")
    forwarding_domain = os.environ.get("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev")
    if codespace:
        print(f"Dashboard: https://{codespace}-8080.{forwarding_domain}", flush=True)
    else:
        print("Dashboard: http://localhost:8080", flush=True)

    print(f"Candidate source: {REPO}", flush=True)
    print(f"Tick log: {TICK_LOG}", flush=True)
    print(f"REST/candle samples: {SAMPLE_LOG}", flush=True)
    print(f"WebSocket control messages: {WS_LOG}", flush=True)
    print(f"REST history seed: {SEED_LOG}", flush=True)

    try:
        await system.start()
    finally:
        stop.set()
        try:
            await asyncio.wait_for(monitor_task, timeout=10)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            monitor_task.cancel()
        try:
            await system.stop()
        except Exception as exc:
            print(f"[probe] shutdown warning: {type(exc).__name__}: {exc}", flush=True)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\n[probe] stopped by user", flush=True)
