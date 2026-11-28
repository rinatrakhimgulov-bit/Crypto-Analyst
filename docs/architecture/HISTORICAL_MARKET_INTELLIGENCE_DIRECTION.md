# Historical Market Intelligence & Live Market Intelligence

**Status:** Strategic direction recorded; not scheduled for implementation  
**Recorded:** 2026-11-28  
**Project:** Crypto Analyst

## 1. Purpose

Evolve Crypto Analyst from a tool that analyzes the current chart into an evidence-driven market research system. The system should be able to study historical market behavior, continuously observe current market behavior, compare the two, and develop candidate strategies from measurable evidence.

This is a long-term direction, not a commitment to start implementation now.

## 2. Current decision

Do not begin this work during the current journal and cloud-integration tasks.

- Keep the existing market journal and its current workflow working.
- Do not interrupt or destabilize current analysis in order to build a historical research platform.
- Do not import large historical datasets yet.
- Do not add a complex processing backend before the current application demonstrates sufficient analytical value.
- Return to this direction when the current work is stable and the user can continue implementation from a desktop environment.

Historical market data will remain available for later acquisition. There is no need to rush this stage.

## 3. Core concept: two parallel intelligence streams

### 3.1 Historical Market Intelligence

A separate historical dataset containing complete market candle history for selected instruments and timeframes (initial candidates: BTC and ETH).

Its purpose is to let the application study market behavior before the live journal has accumulated months or years of observations.

Historical research may examine:

- Market regimes and regime transitions.
- Trend, consolidation, volatility and volume behavior.
- Support/resistance interactions.
- Breakouts, false breakouts and retests.
- Candle structures and sequences.
- EMA and other indicator relationships.
- Subsequent price movement after defined market conditions.
- Strategy performance across different market regimes.

Historical candle data is not the same thing as journal observations. The journal's candle snapshots (currently limited windows attached to observations) are not a substitute for a complete historical OHLCV dataset.

### 3.2 Live Market Intelligence

The existing journal is the foundation of this stream. It records current analytical observations and, as the journal workflow develops, follow-ups and actual trade outcomes.

The live stream should preserve:

- Market and instrument identity.
- Timeframe and timestamps.
- Data source and data-quality/freshness context.
- The analysis and decision produced at that time.
- Feature/engine versions used.
- Follow-up development and eventual outcomes.
- Actual trade results when supplied by the user.

The live stream provides forward evidence: what the system observed and what happened afterward.

## 4. Comparative Engine

A future Comparative Engine should compare historical research with the live stream using consistent definitions and feature calculations.

Potential responsibilities:

- Find historical analogues for current market conditions.
- Compare the frequency and outcomes of similar setups.
- Detect changes in volatility, trend, volume and market-regime distributions.
- Identify whether previously observed patterns are repeating, weakening or disappearing.
- Monitor strategy performance drift between historical tests and live forward observations.
- Highlight when current conditions differ materially from the historical sample.

A similarity to a historical setup is evidence for analysis, not a prediction or a guaranteed trade.

## 5. Strategy Research Engine and Strategy Library

Research should produce **candidate strategies**, not silently rewrite the live decision engine.

Proposed lifecycle:

1. Form a hypothesis from historical and/or live evidence.
2. Define explicit, testable entry, invalidation and exit rules.
3. Backtest on historical data with fees, funding and realistic slippage assumptions.
4. Prevent lookahead bias and data leakage.
5. Validate on separate out-of-sample periods.
6. Run forward/paper tests on new live data.
7. Approve a version for use only after predefined acceptance criteria are met.
8. Monitor the approved version for performance degradation.

The future Strategy Library should persist versioned strategy definitions, parameters, provenance, test results, approval status and performance history. Previous versions must remain available for comparison; a new version must not erase the old one.

The main analytical/decision engine should use only explicitly approved strategy versions. Research findings may inform a review, but must not automatically activate or alter live trading rules.

## 6. Keep the data domains separate

The future architecture should not collapse every kind of information into one oversized journal.

Keep distinct logical datasets:

1. **Raw historical market data:** complete OHLCV and source/provenance metadata.
2. **Live journal observations:** point-in-time application analyses and market snapshots.
3. **Follow-ups and outcomes:** what happened after an observation or setup, including measurable favorable/adverse excursion where supported.
4. **Research runs and hypotheses:** reproducible experiments, inputs, algorithm versions and results.
5. **Strategy Library:** versioned candidate and approved strategy definitions.

Every derived result should be traceable to its source data, time range, instrument, timeframe, processing version and assumptions.

## 7. Processing and storage principles

Historical datasets may be large. Do not load multi-year archives wholesale into browser memory or localStorage.

When this direction is implemented, prefer a batch/worker processing model:

- Process historical data in bounded chunks.
- Track import and processing status.
- Record source, checksums, schema versions and algorithm versions.
- Make processing resumable and idempotent.
- Store derived features and research results separately from raw source data.
- Preserve raw archives so results can be reproduced.
- Keep browser storage bounded and use it for the active working set, not as the historical warehouse.

The current working assumption is that Supabase can support active journal records and selected derived results, while Google Drive or another suitable archive can hold source backups. The final storage and compute design must be revisited against actual dataset size, cost, query needs and reliability before implementation. No automatic Supabase-to-Drive archival pipeline is authorized by this note.

## 8. Data integrity and research safeguards

Historical and live data must be normalized consistently:

- Instrument, market type, venue/source and timeframe.
- UTC timestamps and candle open/close semantics.
- Explicit candle finality (closed versus still forming).
- Missing candles, duplicates and gaps.
- Consistent feature calculations and versioning.
- Fees, funding and slippage assumptions where strategy returns are evaluated.

Backtests must avoid lookahead bias. A decision must use only information that would have been available at that decision time. Intrabar assumptions must be explicit. Historical performance must not be presented as a guarantee of future performance.

A strategy must not be changed merely because of one loss or a small number of observations. Require adequate samples, out-of-sample validation and forward testing.

## 9. Suggested implementation sequence (future, not scheduled)

The order should be refined after auditing the state of the application at that time.

1. Stabilize and validate the existing journal and its backups/synchronization.
2. Define a canonical historical OHLCV schema and data-quality contract.
3. Select a reliable historical data source and acquire a limited BTC/ETH sample.
4. Build a resumable historical import and batch-processing pipeline.
5. Reuse the same versioned feature calculations for historical and live data.
6. Produce reproducible baseline research reports.
7. Add historical/live comparison and analogue analysis.
8. Add candidate strategy experiments, validation gates and versioned Strategy Library.
9. Connect only approved strategies to the main analysis/decision engine.
10. Monitor forward performance and strategy drift.

This sequence is indicative. It is not a request to start these tasks now.

## 10. Acceptance principles

The future system should be considered useful only if it:

- Improves the quality and explainability of LONG / SHORT / WAIT analysis.
- Shows the evidence and limitations behind a comparison or strategy.
- Can reproduce a research result from recorded inputs and versions.
- Separates historical backtest results from live/forward results.
- Detects poor data quality and refuses unsupported conclusions.
- Does not silently change approved trading logic.
- Remains maintainable and proportionate to the actual value it provides.

## 11. Relationship to the current project

This direction extends the existing Crypto Analyst purpose; it does not replace it.

The immediate priority remains a reliable current-market analysis workflow and a journal that safely records observations, follow-ups and user-entered trade outcomes. Historical intelligence is a later multiplier: it can give the system a broader evidence base and let it compare current conditions against much more than the relatively recent live journal.

**No implementation is implied by this document. It records the architectural idea so work can resume deliberately when the current stage is ready.**
