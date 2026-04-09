import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  AreaChart, Area, ReferenceArea
} from 'recharts';
import { formatCurrency } from '../utils';

interface ExportSummaryProps {
  pair: string;
  metrics: any;
  filteredMetrics: any;
  walletHistory: any[];
  exclusionDate: string | null;
  yearlyPnlData: Record<number, any[]>;
}

export function ExportSummary({ 
  pair, 
  metrics, 
  filteredMetrics, 
  walletHistory, 
  exclusionDate, 
  yearlyPnlData 
}: ExportSummaryProps) {
  
  const m = filteredMetrics || metrics;

  const formatVal = (val: any, pct: boolean = false) => {
    if (val === undefined || val === null || val === 'N/A') return 'N/A';
    if (typeof val === 'object' && val.toFixed) return val.toFixed(2);
    return pct ? `${Number(val).toFixed(2)}%` : Number(val).toFixed(2);
  };

  const metricGroups = [
    {
      title: 'Primary Performance',
      rows: [
        { label: 'Final Capital', val: formatCurrency(m.final_capital) },
        { label: 'Annual Return', val: formatVal(m.annual_return_pct, true) },
        { label: 'Sharpe Ratio', val: formatVal(m.sharpe) },
        { label: 'Max Drawdown', val: `-${formatVal(m.max_drawdown_pct, true)}` },
        { label: 'Duration', val: m.duration || 'N/A' },
      ]
    },
    {
      title: 'Trading Stats',
      rows: [
        { label: 'Trades / Year', val: formatVal(m.trades_per_year) },
        { label: 'Win Rate', val: formatVal(m.win_rate_pct, true) },
        { label: 'Profit Factor', val: formatVal(m.profit_factor) },
        { label: 'Total Trades', val: m.nb_trades || metrics.nb_trades },
      ]
    },
    {
      title: 'Risk & Consistency',
      rows: [
        { label: 'Best Trade', val: formatVal(m.best_trade_pct, true) },
        { label: 'Worst Trade', val: formatVal(m.worst_trade_pct, true) },
        { label: 'Max Consec Wins', val: m.max_consec_wins },
        { label: 'Max Consec Loss', val: m.max_consec_losses },
      ]
    }
  ];

  const styles = {
    container: { width: '1000px', backgroundColor: 'white', padding: '60px', fontFamily: 'system-ui, sans-serif', color: '#111827' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '4px solid #000', paddingBottom: '20px', marginBottom: '40px' },
    title: { fontSize: '42px', fontWeight: 900, margin: 0, textTransform: 'uppercase' as const },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px', marginBottom: '50px' },
    sectionTitle: { fontSize: '14px', fontWeight: 900, backgroundColor: '#000', color: '#fff', padding: '4px 12px', display: 'inline-block', marginBottom: '20px', textTransform: 'uppercase' as const },
    metricRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' },
    metricLabel: { fontSize: '13px', fontWeight: 700, color: '#6B7280' },
    metricValue: { fontSize: '18px', fontWeight: 900 },
    chartSection: { marginBottom: '50px' },
    chartTitle: { fontSize: '16px', fontWeight: 900, marginBottom: '20px', textTransform: 'uppercase' as const, display: 'flex', alignItems: 'center', gap: '10px' },
    pnlYear: { marginBottom: '30px' },
    pnlGrid: { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '4px' },
    pnlCell: { padding: '8px 4px', textAlign: 'center' as const, borderRadius: '6px', fontSize: '11px', fontWeight: 900 }
  };

  return (
    <div id="export-container" style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{pair} AUDIT CARD</h1>
        <span style={{ fontWeight: 700, color: '#9CA3AF' }}>{new Date().toLocaleDateString()}</span>
      </div>

      <div style={styles.grid}>
        {metricGroups.map(group => (
          <div key={group.title}>
            <h2 style={styles.sectionTitle}>{group.title}</h2>
            {group.rows.map(row => (
              <div key={row.label} style={styles.metricRow}>
                <span style={styles.metricLabel}>{row.label}</span>
                <span style={{ ...styles.metricValue, color: group.title === 'Primary Performance' && row.label !== 'Max Drawdown' ? '#2563EB' : '#111827' }}>{row.val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={styles.chartSection}>
        <h3 style={styles.chartTitle}><span style={{ width: '4px', height: '16px', backgroundColor: '#2563EB' }} /> Cumulative Equity Curve</h3>
        <div style={{ height: '300px', width: '900px', backgroundColor: '#F9FAFB', padding: '20px', borderRadius: '24px' }}>
          <LineChart width={860} height={260} data={walletHistory}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700 }} dy={10} />
            <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `$${(v/1000).toFixed(1)}k`} />
            {exclusionDate && (
              <ReferenceArea x1={walletHistory[0].date} x2={exclusionDate} fill="#EF4444" fillOpacity={0.1} stroke="#EF4444" strokeOpacity={0.2} label={{ position: 'insideTopLeft', value: 'Exclusion', fill: '#EF4444', fontSize: 10, fontWeight: 900 }} />
            )}
            <Line type="stepAfter" dataKey="wallet" stroke="#2563EB" strokeWidth={3} dot={false} isAnimationActive={false} />
          </LineChart>
        </div>
      </div>

      <div style={styles.chartSection}>
        <h3 style={styles.chartTitle}><span style={{ width: '4px', height: '16px', backgroundColor: '#EF4444' }} /> Underwater Drawdown (%)</h3>
        <div style={{ height: '150px', width: '900px', backgroundColor: '#F9FAFB', padding: '20px', borderRadius: '24px' }}>
          <AreaChart width={860} height={110} data={walletHistory}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `-${v.toFixed(1)}%`} />
            {exclusionDate && (
              <ReferenceArea x1={walletHistory[0].date} x2={exclusionDate} fill="#EF4444" fillOpacity={0.1} />
            )}
            <Area type="monotone" dataKey="dd_pct" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} isAnimationActive={false} />
          </AreaChart>
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <h3 style={styles.chartTitle}><span style={{ width: '4px', height: '16px', backgroundColor: '#10B981' }} /> Monthly Performance History (%)</h3>
        {Object.entries(yearlyPnlData).sort((a,b) => Number(b[0]) - Number(a[0])).map(([year, pnl]) => (
          <div key={year} style={styles.pnlYear}>
            <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '10px' }}>{year}</div>
            <div style={styles.pnlGrid}>
              {pnl.map((m: any) => (
                <div key={m.month} style={{ 
                  ...styles.pnlCell, 
                  backgroundColor: m.hasData ? (m.pnl >= 0 ? '#ECFDF5' : '#FEF2F2') : '#F9FAFB',
                  color: m.hasData ? (m.pnl >= 0 ? '#059669' : '#DC2626') : '#D1D5DB'
                }}>
                  <div style={{ fontSize: '9px', marginBottom: '2px', opacity: 0.6 }}>{m.month}</div>
                  <div>{m.hasData ? `${m.pnl >= 0 ? '+' : ''}${m.pnl.toFixed(1)}%` : '-'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '40px', borderTop: '1px solid #E5E7EB', paddingTop: '20px', fontSize: '10px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>
        * Professional Audit Document - This strategy summary includes filters and exclusion zones. All data is retroactive.
      </div>
    </div>
  );
}
