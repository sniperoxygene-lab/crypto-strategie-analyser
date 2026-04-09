import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  AreaChart, Area
} from 'recharts';
import { formatCurrency } from '../utils';

interface ExportSummaryProps {
  pair: string;
  metrics: any;
  filteredMetrics: any;
  walletHistory: any[];
}

export function ExportSummary({ pair, metrics, filteredMetrics, walletHistory }: ExportSummaryProps) {
  const formatVal = (val: any, pct: boolean = false) => {
    if (val === undefined || val === null) return '-';
    return pct ? `${val.toFixed(2)}%` : val.toFixed(2);
  };

  const metricRows = [
    { label: 'Final Capital', original: formatCurrency(metrics.final_capital), filtered: filteredMetrics ? formatCurrency(filteredMetrics.final_capital) : null },
    { label: 'Annual Return', original: formatVal(metrics.annual_return_pct, true), filtered: filteredMetrics ? formatVal(filteredMetrics.annual_return_pct, true) : null },
    { label: 'Sharpe Ratio', original: formatVal(metrics.sharpe), filtered: filteredMetrics ? formatVal(filteredMetrics.sharpe) : null },
    { label: 'Max Drawdown', original: formatVal(metrics.max_drawdown_pct, true), filtered: filteredMetrics ? formatVal(filteredMetrics.max_drawdown_pct, true) : null },
    { label: 'Win Rate', original: formatVal(metrics.win_rate_pct, true), filtered: filteredMetrics ? formatVal(filteredMetrics.win_rate_pct, true) : null },
    { label: 'Profit Factor', original: formatVal(metrics.profit_factor), filtered: filteredMetrics ? formatVal(filteredMetrics.profit_factor) : null },
  ];

  return (
    <div id="export-container" className="bg-white p-12 text-gray-900 font-sans" style={{ width: '1000px' }}>
      <div className="flex justify-between items-baseline border-b-4 border-black pb-4 mb-8">
        <h1 className="text-4xl font-black">{pair} PERFORMANCE SUMMARY</h1>
        <span className="text-sm font-bold text-gray-500">Generated on {new Date().toLocaleDateString()}</span>
      </div>

      <div className="grid grid-cols-2 gap-12 mb-12">
        <div className="space-y-6">
          <h2 className="text-xl font-black bg-black text-white px-4 py-1 inline-block">STRATEGY METRICS</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="py-2 text-xs font-black uppercase text-gray-400">Metric</th>
                <th className="py-2 text-xs font-black uppercase text-gray-400">Original</th>
                {filteredMetrics && <th className="py-2 text-xs font-black uppercase text-blue-600">Filtered</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {metricRows.map((row) => (
                <tr key={row.label}>
                  <td className="py-3 font-bold text-gray-600">{row.label}</td>
                  <td className="py-3 font-black text-lg">{row.original}</td>
                  {filteredMetrics && (
                    <td className="py-3 font-black text-lg text-blue-600">{row.filtered}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-8">
          <div className="bg-gray-50 p-6 border-2 border-gray-100 rounded-2xl">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Equity Curve</h3>
            <div style={{ height: '220px', width: '900px' }}>
              <LineChart width={900} height={220} data={walletHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Line type="stepAfter" dataKey="wallet" stroke="#2962FF" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </div>
          </div>

          <div className="bg-gray-50 p-6 border-2 border-gray-100 rounded-2xl">
            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Drawdown Analysis</h3>
            <div style={{ height: '120px', width: '900px' }}>
              <AreaChart width={900} height={120} data={walletHistory}>
                <Area type="monotone" dataKey="dd_pct" stroke="#EF5350" fill="#EF5350" fillOpacity={0.2} isAnimationActive={false} />
              </AreaChart>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-6 border-2 border-blue-100 rounded-2xl">
        <p className="text-xs font-bold text-blue-600 leading-relaxed uppercase">
          * Note: Combined view showing both original backtest results and filtered metrics (exclusion zone applied).
          Data strictly provided for strategy auditing and AI assessment.
        </p>
      </div>
    </div>
  );
}
