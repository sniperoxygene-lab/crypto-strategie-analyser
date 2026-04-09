import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

export function formatPct(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function downsample(data: any[], maxPoints: number) {
  if (data.length <= maxPoints) return data;
  const step = Math.floor(data.length / maxPoints);
  const downsampled = [];
  for (let i = 0; i < data.length; i += step) {
    if (downsampled.length < maxPoints) downsampled.push(data[i]);
  }
  if (downsampled[downsampled.length - 1] !== data[data.length - 1]) {
    downsampled[downsampled.length - 1] = data[data.length - 1];
  }
  return downsampled;
}

export function calculateCAGR(history: any[]) {
  if (history.length < 2) return 0;
  const startVal = history[0].wallet;
  const endVal = history[history.length - 1].wallet;
  const startDate = new Date(history[0].date);
  const endDate = new Date(history[history.length - 1].date);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (years <= 0) return 0;
  return (Math.pow(endVal / startVal, 1 / years) - 1) * 100;
}

export function calculateMaxDD(history: any[]) {
  if (history.length === 0) return 0;
  let maxWallet = -Infinity;
  let maxDD = 0;
  history.forEach(h => {
    if (h.wallet > maxWallet) maxWallet = h.wallet;
    const dd = ((maxWallet - h.wallet) / maxWallet) * 100;
    if (dd > maxDD) maxDD = dd;
  });
  return maxDD;
}

export function calculateFilteredMetrics(strategy: any, exclusionDate: string) {
  const safeDateParse = (dStr: string) => {
    let tStr = dStr.trim().replace(' ', 'T');
    if (!tStr.includes('T')) tStr += 'T00:00:00';
    if (!tStr.endsWith('Z') && !tStr.includes('+') && !tStr.includes('-')) tStr += 'Z';
    const ms = new Date(tStr).getTime();
    return isNaN(ms) ? new Date(dStr).getTime() : ms;
  };

  const cutoff = safeDateParse(exclusionDate);
  const history = strategy.raw_wallet_history || strategy.wallet_history;
  const trades = strategy.trades || [];

  const filteredHistory = history.filter((h: any) => safeDateParse(h.date) > cutoff);
  const filteredTrades = trades.filter((t: any) => safeDateParse(t.open_date) > cutoff);

  if (filteredHistory.length < 2) return null;

  const startWallet = filteredHistory[0].wallet;
  const endWallet = filteredHistory[filteredHistory.length - 1].wallet;
  
  const wins = filteredTrades.filter((t: any) => (t.pnl_pct ?? 0) > 0).length;
  const winRate = filteredTrades.length > 0 ? (wins / filteredTrades.length) * 100 : 0;
  
  const grossProfit = filteredTrades.filter((t: any) => (t.pnl_usd ?? 0) > 0).reduce((acc: number, t: any) => acc + t.pnl_usd, 0);
  const grossLoss = Math.abs(filteredTrades.filter((t: any) => (t.pnl_usd ?? 0) < 0).reduce((acc: number, t: any) => acc + t.pnl_usd, 0));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : grossProfit / grossLoss;

  const firstDate = safeDateParse(filteredHistory[0].date);
  const lastDate = safeDateParse(filteredHistory[filteredHistory.length - 1].date);
  const days = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
  const tradesPerYear = days > 0 ? (filteredTrades.length / days) * 365.25 : 0;

  const pnlPctList = filteredTrades.map((t: any) => t.pnl_pct ?? 0);
  const avgTradePct = pnlPctList.length > 0 ? pnlPctList.reduce((a: number, b: number) => a + b, 0) / pnlPctList.length : 0;
  const bestTradePct = pnlPctList.length > 0 ? Math.max(...pnlPctList) * 100 : 0;
  const worstTradePct = pnlPctList.length > 0 ? Math.min(...pnlPctList) * 100 : 0;

  let maxWins = 0, maxLosses = 0, currentWins = 0, currentLosses = 0;
  filteredTrades.forEach((t: any) => {
    if (t.pnl_pct > 0) {
      currentWins++;
      currentLosses = 0;
      if (currentWins > maxWins) maxWins = currentWins;
    } else {
      currentLosses++;
      currentWins = 0;
      if (currentLosses > maxLosses) maxLosses = currentLosses;
    }
  });

  const returns = [];
  for(let i=1; i<filteredHistory.length; i++) {
    returns.push((filteredHistory[i].wallet - filteredHistory[i-1].wallet) / filteredHistory[i-1].wallet);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b, 0) / (returns.length || 1));
  
  const periodsPerYear = days > 0 ? (returns.length / days) * 365.25 : 365;
  let sharpe: any = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(periodsPerYear);

  if (filteredHistory.length < 30) {
    sharpe = { toFixed: () => 'N/A', toString: () => 'N/A', valueOf: () => 0 };
  }

  return {
    final_capital: endWallet,
    annual_return_pct: calculateCAGR(filteredHistory),
    max_drawdown_pct: calculateMaxDD(filteredHistory),
    sharpe: sharpe,
    win_rate_pct: winRate,
    profit_factor: profitFactor,
    trades_per_year: tradesPerYear,
    nb_trades: filteredTrades.length,
    avg_trade_pct: avgTradePct,
    best_trade_pct: bestTradePct,
    worst_trade_pct: worstTradePct,
    max_consec_wins: maxWins,
    max_consec_losses: maxLosses,
    start_capital: startWallet,
    duration: (() => {
      const y = Math.floor(days / 365.25);
      const m = Math.floor((days % 365.25) / 30.44);
      const d = Math.floor(days % 30.44);
      return `${y > 0 ? `${y}y ` : ''}${m > 0 ? `${m}m ` : ''}${d}d`;
    })()
  };
}

export function processStrategyData(rawJson: any) {
  const processed: Record<string, any> = {};
  
  Object.entries(rawJson).forEach(([pair, pairData]: [string, any]) => {
    const rawHistory = pairData.wallet_history || [];
    
    // Heuristic to detect if percentages are in decimal form (e.g. 0.05 for 5%)
    const mRaw = pairData.metrics || {};
    const needsMultiplication = (mRaw.max_drawdown_pct > 0 && mRaw.max_drawdown_pct < 1) || 
                               (Math.abs(mRaw.annual_return_pct) > 0 && Math.abs(mRaw.annual_return_pct) < 0.5);

    const maybeMult = (val: number) => needsMultiplication ? val * 100 : val;

    const walletHistory = downsample(rawHistory, 500);
    const formattedHistory = walletHistory.map((w: any) => ({
      ...w,
      dd_pct: maybeMult(w.dd_pct || 0),
      dateFormatted: (w.date || '').split(' ')[0]
    }));

    const metrics = {
      ...mRaw,
      annual_return_pct: maybeMult(mRaw.annual_return_pct || 0),
      max_drawdown_pct: maybeMult(mRaw.max_drawdown_pct || 0),
      win_rate_pct: maybeMult(mRaw.win_rate_pct || 0),
      best_trade_pct: maybeMult(mRaw.best_trade_pct || 0),
      worst_trade_pct: maybeMult(mRaw.worst_trade_pct || 0),
      avg_trade_pct: maybeMult(mRaw.avg_trade_pct || 0),
      duration: '' // Will be set below
    };

    const trades = (pairData.trades || []).map((t: any) => ({
      ...t,
      pnl_pct: maybeMult(t.pnl_pct || 0)
    }));
    const longs = trades.filter((t: any) => t.side === 'LONG').length;
    const shorts = trades.filter((t: any) => t.side === 'SHORT').length;
    
    const longShortData = [
      { name: 'LONG', value: longs, color: '#26A69A' },
      { name: 'SHORT', value: shorts, color: '#EF5350' }
    ];

    const monthlyGroups: Record<string, { year: number, month: number, first: number, last: number }> = {};
    rawHistory.forEach((h: any) => {
      const date = new Date(h.date);
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;
      if (!monthlyGroups[key]) monthlyGroups[key] = { year, month, first: h.wallet, last: h.wallet };
      else monthlyGroups[key].last = h.wallet;
    });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyPnlRaw = Object.values(monthlyGroups).map(group => ({
      year: group.year,
      month: group.month,
      monthName: monthNames[group.month],
      pnl: ((group.last - group.first) / group.first) * 100
    }));

    const strategyYears = Array.from(new Set(monthlyPnlRaw.map(m => m.year))).sort((a, b) => b - a);
    let minPnl = 0, maxPnl = 0;
    monthlyPnlRaw.forEach(m => {
      if (m.pnl < minPnl) minPnl = m.pnl;
      if (m.pnl > maxPnl) maxPnl = m.pnl;
    });
    
    const padding = Math.max(2, Math.abs(maxPnl - minPnl) * 0.25);
    const yDomain = [minPnl - padding, maxPnl + padding];

    const yearlyPnlData: Record<number, any[]> = {};
    strategyYears.forEach(year => {
      yearlyPnlData[year] = monthNames.map((name, idx) => {
        const match = monthlyPnlRaw.find(m => m.year === year && m.month === idx);
        return { month: name, year: year, pnl: match ? match.pnl : 0, hasData: !!match };
      });
    });

    const startDateRaw = new Date(rawHistory[0].date);
    const endDateRaw = new Date(rawHistory[rawHistory.length - 1].date);
    const diffDays = (endDateRaw.getTime() - startDateRaw.getTime()) / (1000 * 60 * 60 * 24);
    const y = Math.floor(diffDays / 365.25);
    const m = Math.floor((diffDays % 365.25) / 30.44);
    const d = Math.floor(diffDays % 30.44);
    const durationStr = `${y > 0 ? `${y}y ` : ''}${m > 0 ? `${m}m ` : ''}${d}d`;

    processed[pair] = {
      ...pairData,
      metrics: {
        ...metrics,
        duration: durationStr
      },
      trades,
      raw_wallet_history: rawHistory,
      wallet_history: formattedHistory,
      precomputed: {
        longShortData,
        yearlyPnlData,
        monthlyPnlYears: strategyYears,
        yDomain,
        years: Array.from(new Set(trades.map((t: any) => t.open_date.split('-')[0]))).sort()
      }
    };
  });
  return processed;
}

export function generateDemoData() {
  const data: Record<string, any> = {};
  const pairs = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT"];
  pairs.forEach(pair => {
    const isHyperliquid = Math.random() > 0.4;
    const annualReturn = 5 + Math.random() * 60;
    const maxDrawdown = 5 + Math.random() * 25;
    const winRate = 45 + Math.random() * 20;
    const walletHistory = [];
    let currentWallet = 1000;
    let maxWallet = 1000;
    let startDate = new Date('2021-01-01');
    for (let i = 0; i < 1095; i++) {
      startDate.setDate(startDate.getDate() + 1);
      const dailyReturn = (Math.random() - 0.47) * 0.02; 
      currentWallet *= (1 + dailyReturn);
      if (currentWallet > maxWallet) maxWallet = currentWallet;
      walletHistory.push({
        date: startDate.toISOString().split('T')[0] + ' 00:00:00',
        wallet: currentWallet,
        dd_pct: ((maxWallet - currentWallet) / maxWallet) * 100
      });
    }
    const trades = [];
    let tradeDate = new Date('2021-01-01');
    for (let i = 0; i < 60; i++) {
      tradeDate.setDate(tradeDate.getDate() + Math.floor(Math.random() * 10) + 1);
      const closeDate = new Date(tradeDate);
      closeDate.setDate(closeDate.getDate() + 2);
      const isWin = Math.random() < (winRate / 100);
      const pnlPct = isWin ? 0.02 : -0.015;
      trades.push({
        open_date: tradeDate.toISOString().split('T')[0] + ' 00:00:00',
        close_date: closeDate.toISOString().split('T')[0] + ' 00:00:00',
        side: Math.random() > 0.5 ? "LONG" : "SHORT",
        close_reason: isWin ? "TP" : "SL",
        pnl_pct: pnlPct,
        pnl_usd: pnlPct * currentWallet
      });
    }
    data[pair] = {
      metrics: {
        final_capital: currentWallet,
        annual_return_pct: annualReturn,
        max_drawdown_pct: maxDrawdown,
        sharpe: 1.2,
        nb_trades: 60,
        trades_per_year: 20,
        win_rate_pct: winRate,
        profit_factor: 1.5,
        avg_trade_pct: 0.005,
        best_trade_pct: 15,
        worst_trade_pct: -10,
        max_consec_wins: 6,
        max_consec_losses: 4,
        history_days: 1095,
        hyperliquid: isHyperliquid
      },
      wallet_history: walletHistory,
      trades: trades,
      by_year: [{ year: 2021, pnl_usd: 500 }, { year: 2022, pnl_usd: 600 }, { year: 2023, pnl_usd: 800 }]
    };
  });
  return data;
}
