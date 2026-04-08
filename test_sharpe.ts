import { generateDemoData, processStrategyData, calculateFilteredMetrics } from './src/utils';

const data = generateDemoData();
const processed = processStrategyData(data);
const strat = processed["BTC/USDT"];

console.log("Original History length:", strat.raw_wallet_history.length);
console.log("Original Sharpe:", strat.metrics.sharpe);

const cutoff1 = strat.raw_wallet_history[10].date;
const metrics1 = calculateFilteredMetrics(strat, cutoff1);

console.log("Filtered starting from 10 days later:", metrics1.sharpe);
console.log("Filtered history length:", strat.raw_wallet_history.filter((h: any) => new Date(h.date).getTime() >= new Date(cutoff1).getTime()).length);

