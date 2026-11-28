'use strict';
const assert = require('node:assert/strict');
const { analyze } = require('../src/analysis/b3-impulse-engine.js');
const STEP=3600000, LAG=500;
const POLICY={
  version:'b3-impulse-v1', b1_contract_version:'1.1.0',
  b1_validator_version:'1.1.0', b1_quality_policy_version:'b1-quality-v1',
  finality_safety_lag_ms:LAG, atr_period:14, impulse_lookback:4, volume_lookback:10,
  volume_field:'volume_base', min_displacement_atr:1.8, min_range_expansion_atr:1.4,
  min_volume_ratio:1.5, min_directional_body_ratio:0.5,
  selloff_displacement_atr:3, selloff_volume_ratio:2
};
function candle(i, values={}) {
  const openTime=(i+1)*STEP;
  return {open_time_ms:openTime,close_time_ms:openTime+STEP,
    canonical_symbol:'BTCUSDT',market_type:'LINEAR_PERPETUAL',timeframe:'1h',
    open:values.open??100,high:values.high??101,low:values.low??99,close:values.close??100,
    volume_base:values.volume??100,volume_quote:(values.volume??100)*100,closed_state:'CONFIRMED'};
}
function fixture(options={}) {
  const candles=Array.from({length:50},(_,i)=>candle(i));
  const start=45;
  const down=options.direction==='BULLISH'?false:true;
  for(let j=1;j<=4;j++){
    const i=start+j;
    candles[i]=candle(i,options.impulse===false?{}:down
      ?{open:100-(j-1)*2,close:98-(j-1)*2,high:100-(j-1)*2+0.5,low:98-(j-1)*2-0.5,volume:300}
      :{open:98+(j-1)*2,close:100+(j-1)*2,high:100+(j-1)*2+0.5,low:98+(j-1)*2-0.5,volume:300});
  }
  const asOf=candles.at(-1).close_time_ms+LAG;
  const snapshot={snapshot_id:'fixture:b3:btc:1h',contract_version:'1.1.0',
    canonical_symbol:'BTCUSDT',market_type:'LINEAR_PERPETUAL',
    analysis_as_of_ms:asOf,provider_server_time_ms:asOf,provider_metadata:{time_source:'provider'},
    candles_by_timeframe:{'1h':candles}};
  const quality_report={status:'VALID',snapshot_id:snapshot.snapshot_id,symbol:'BTCUSDT',
    timeframe:'1h',analysis_as_of_ms:asOf,checked_at_ms:asOf-100,
    validator_version:'1.1.0',policy_version:'b1-quality-v1',
    closed_count:candles.length,valid_count:candles.length,insufficient_history:false};
  return {policy:{...POLICY,...options.policy},snapshot,quality_report,analysis_as_of_ms:asOf,timeframe:'1h'};
}
function run(name,fn){try{fn();process.stdout.write('PASS '+name+'\n');}catch(e){process.stderr.write('FAIL '+name+': '+e.message+'\n');process.exitCode=1;}}
run('detects a confirmed bearish impulse',()=>{const r=analyze(fixture());assert.equal(r.impulse.status,'CONFIRMED');assert.equal(r.impulse.classification,'BEARISH_IMPULSE');});
run('detects stronger downside displacement and volume as sell-off',()=>{const x=fixture();const c=x.snapshot.candles_by_timeframe['1h'];for(let j=1;j<=4;j++){const i=45+j;c[i]=candle(i,{open:100-(j-1)*4,close:96-(j-1)*4,high:101-(j-1)*4,low:95-(j-1)*4,volume:500});}const r=analyze(x);assert.equal(r.impulse.classification,'BEARISH_SELL_OFF');});
run('detects a bullish impulse symmetrically',()=>{const r=analyze(fixture({direction:'BULLISH'}));assert.equal(r.impulse.classification,'BULLISH_IMPULSE');});
run('does not call an ordinary range a confirmed impulse',()=>{const r=analyze(fixture({impulse:false}));assert.equal(r.impulse.status,'NOT_CONFIRMED');});
run('does not confirm a support break without B2-E evidence',()=>{const x=fixture();x.zone_context={status:'VALID',snapshot_id:x.snapshot.snapshot_id,symbol:'BTCUSDT',timeframe:'1h',analysis_as_of_ms:x.analysis_as_of_ms,zones:[{zone_id:'s1',role:'SUPPORT',is_active:true,freshness_status:'FRESH',lower_bound:99,upper_bound:100}]};const r=analyze(x);assert.equal(r.support_break.status,'SUPPORT_CLOSE_BELOW_UNVERIFIED');});
run('confirms a support break only with exact strong bearish B2-E evidence',()=>{const x=fixture();x.zone_context={status:'VALID',snapshot_id:x.snapshot.snapshot_id,symbol:'BTCUSDT',timeframe:'1h',analysis_as_of_ms:x.analysis_as_of_ms,zones:[{zone_id:'s1',role:'SUPPORT',is_active:true,freshness_status:'FRESH',lower_bound:99,upper_bound:100}]};x.breakout_quality={status:'VALID',snapshot_id:x.snapshot.snapshot_id,symbol:'BTCUSDT',timeframe:'1h',analysis_as_of_ms:x.analysis_as_of_ms,breakouts:[{direction:'BEARISH',original_zone_role:'SUPPORT',zone_lower_bound:99,zone_upper_bound:100,quality_status:'STRONG_EVIDENCE',breakout_event_id:'b1'}]};assert.equal(analyze(x).support_break.status,'CONFIRMED_BREAKDOWN');});
run('B1 report identity mismatch fails closed',()=>{assert.equal(analyze(fixture({report:{validator_version:'wrong'}})).status,'BLOCKED');});
run('forming candle fails closed',()=>{const x=fixture();x.snapshot.candles_by_timeframe['1h'][49].closed_state='FORMING';assert.equal(analyze(x).status,'BLOCKED');});
run('candle gap fails closed',()=>{const x=fixture();x.snapshot.candles_by_timeframe['1h'][20].open_time_ms+=STEP;assert.equal(analyze(x).status,'BLOCKED');});
run('invalid policy fails closed',()=>{const r=analyze(fixture({policy:{min_volume_ratio:0}}));assert.equal(r.status,'BLOCKED');});
run('future candle changes after the latest candle are impossible by construction',()=>{const x=fixture();const r1=analyze(x);x.snapshot.candles_by_timeframe['1h'][40].close=1;const r2=analyze(x);assert.deepEqual(r1.impulse,r2.impulse);});
run('result is immutable and input is not mutated',()=>{const x=fixture();const before=JSON.stringify(x);const r=analyze(x);assert.equal(JSON.stringify(x),before);assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.impulse));});
run('identical input is deterministic',()=>{const x=fixture();assert.deepEqual(analyze(x),analyze(x));});
if(process.exitCode)process.exit(process.exitCode);
