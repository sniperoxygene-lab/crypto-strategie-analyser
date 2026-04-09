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

  // Inline styles for absolute capture reliability
  const styles = {
    container: {
      width: '1000px',
      backgroundColor: 'white',
      padding: '60px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#111827'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      borderBottom: '4px solid #000',
      paddingBottom: '20px',
      marginBottom: '40px'
    },
    title: {
      fontSize: '42px',
      fontWeight: 900,
      margin: 0,
      letterSpacing: '-0.02em',
      textTransform: 'uppercase' as const
    },
    subtitle: {
      fontSize: '14px',
      fontWeight: 700,
      color: '#6B7280'
    },
    grid: {
      display: 'flex',
      gap: '40px'
    },
    leftCol: {
      flex: 1
    },
    rightCol: {
      width: '500px'
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 900,
      backgroundColor: '#000',
      color: '#fff',
      padding: '6px 16px',
      display: 'inline-block',
      marginBottom: '24px',
      textTransform: 'uppercase' as const
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const
    },
    th: {
      textAlign: 'left' as const,
      fontSize: '11px',
      fontWeight: 900,
      color: '#9CA3AF',
      textTransform: 'uppercase' as const,
      padding: '8px 0',
      borderBottom: '2px solid #E5E7EB'
    },
    tdLabel: {
      padding: '16px 0',
      fontSize: '15px',
      fontWeight: 700,
      color: '#4B5563',
      borderBottom: '1px solid #F3F4F6'
    },
    tdValue: {
      padding: '16px 0',
      fontSize: '20px',
      fontWeight: 900,
      borderBottom: '1px solid #F3F4F6'
    },
    chartBox: {
      backgroundColor: '#F9FAFB',
      padding: '24px',
      borderRadius: '24px',
      border: '2px solid #F3F4F6',
      marginBottom: '32px'
    },
    chartTitle: {
      fontSize: '12px',
      fontWeight: 900,
      color: '#9CA3AF',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      marginBottom: '16px'
    },
    footer: {
      marginTop: '40px',
      backgroundColor: '#EFF6FF',
      padding: '24px',
      borderRadius: '24px',
      border: '2px solid #DBEAFE'
    },
    footerText: {
      fontSize: '12px',
      fontWeight: 700,
      color: '#2563EB',
      margin: 0,
      textTransform: 'uppercase' as const,
      lineHeight: 1.5
    }
  };

  return (
    <div id="export-container" style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{pair} PERFORMANCE SUMMARY</h1>
        <span style={styles.subtitle}>Generated on {new Date().toLocaleDateString()}</span>
      </div>

      <div style={styles.grid}>
        {/* Metrics Column */}
        <div style={styles.leftCol}>
          <h2 style={styles.sectionTitle}>Key Performance Indicators</h2>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Metric</th>
                <th style={styles.th}>Original</th>
                {filteredMetrics && <th style={{ ...styles.th, color: '#2563EB' }}>Filtered</th>}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row) => (
                <tr key={row.label}>
                  <td style={styles.tdLabel}>{row.label}</td>
                  <td style={styles.tdValue}>{row.original}</td>
                  {filteredMetrics && (
                    <td style={{ ...styles.tdValue, color: '#2563EB' }}>{row.filtered}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Charts Column */}
        <div style={styles.rightCol}>
          <div style={styles.chartBox}>
            <h3 style={styles.chartTitle}>Equity Curve (Growth)</h3>
            <div style={{ height: '200px', width: '450px' }}>
              <LineChart width={450} height={200} data={walletHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto', 'auto']} hide />
                <Line type="stepAfter" dataKey="wallet" stroke="#2563EB" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </div>
          </div>

          <div style={styles.chartBox}>
            <h3 style={styles.chartTitle}>Drawdown Analysis (Risk)</h3>
            <div style={{ height: '100px', width: '450px' }}>
              <AreaChart width={450} height={100} data={walletHistory}>
                <Area type="monotone" dataKey="dd_pct" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} isAnimationActive={false} />
              </AreaChart>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <p style={styles.footerText}>
          * Note: This summary provides a combined view of the original backtest results and the recalculated performance metrics following the applied exclusion zone.
        </p>
      </div>
    </div>
  );
}
