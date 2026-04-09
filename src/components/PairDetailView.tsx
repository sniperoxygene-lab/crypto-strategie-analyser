import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, RotateCcw, Share2, Copy, Download as DownloadIcon } from 'lucide-react';
import { 
  LineChart as RechartsLineChart, Line as RechartsLine, XAxis as RechartsXAxis, 
  YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer as RechartsResponsiveContainer,
  AreaChart as RechartsAreaChart, Area as RechartsArea, BarChart as RechartsBarChart,
  Bar as RechartsBar, Cell as RechartsCell, PieChart as RechartsPieChart, 
  Pie as RechartsPie, Legend as RechartsLegend, ReferenceLine, LabelList, ReferenceArea
} from 'recharts';
import html2canvas from 'html2canvas';
import { formatCurrency, cn, calculateFilteredMetrics } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';
import { ExportSummary } from './ExportSummary';

interface PairDetailViewProps {
  pair: string;
  data: any;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDeletePair: (pair: string) => void;
}

const MetricCard = ({ title, value, filteredValue, colorClass = "text-gray-900", subtext = "" }: any) => {
  const hasFilter = filteredValue !== undefined && filteredValue !== null && filteredValue !== value;
  
  // Logic for color coding the comparison
  let filteredColor = "text-blue-600";
  if (typeof value === 'string' && value.includes('%')) {
    const v1 = parseFloat(value);
    const v2 = parseFloat(filteredValue);
    if (v2 < v1) filteredColor = "text-red-500";
  } else if (typeof value === 'number') {
    if (filteredValue < value) filteredColor = "text-red-500";
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between relative overflow-hidden">
      <div className={cn("absolute top-0 left-0 w-full h-1", 
        colorClass.includes('green') ? 'bg-green-500' : colorClass.includes('red') ? 'bg-red-500' : 'bg-blue-500'
      )} />
      <h4 className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">{title}</h4>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          {hasFilter ? (
            <>
              <span className="text-sm text-gray-400 font-medium line-through">{value}</span>
              <span className="text-gray-400 text-xs">→</span>
              <span className={cn("text-2xl font-bold tracking-tight", filteredColor)}>{filteredValue}</span>
            </>
          ) : (
            <span className={cn("text-2xl font-bold tracking-tight", colorClass)}>{value}</span>
          )}
        </div>
        {subtext && <span className="text-xs text-gray-400 font-medium mt-1">{subtext}</span>}
      </div>
    </div>
  );
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("bg-gray-200 animate-pulse rounded-xl opacity-40", className)} />
);

const MonthlyPnLLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  const isPositive = value > 0;
  const labelText = `${isPositive ? '+' : ''}${value.toFixed(1)}%`;
  const color = isPositive ? '#26A69A' : '#EF5350';
  const verticalOffset = isPositive ? -12 : 20;
  return (
    <text x={x + width / 2} y={y + verticalOffset} fill={color} textAnchor="middle" fontSize="11px" fontWeight="bold" fontFamily="DM Sans, sans-serif">
      {labelText}
    </text>
  );
};

export function PairDetailView({ pair, data, onBack, onPrev, onNext, onDeletePair }: PairDetailViewProps) {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [tradeFilter, setTradeFilter] = useState({ year: 'ALL', side: 'ALL', reason: 'ALL' });
  const [showSecondary, setShowSecondary] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Exclusion Zone State
  const [exclusionZones, setExclusionZones] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('exclusion-zones-store');
    return saved ? JSON.parse(saved) : {};
  });

  const pairData = data[pair];
  if (!pairData) return null;
  
  const m = pairData.metrics;
  const p = pairData.precomputed;
  const walletHistory = pairData.wallet_history;
  const rawHistory = pairData.raw_wallet_history || pairData.wallet_history;
  
  const startDate = rawHistory[0].date;
  const endDate = rawHistory[rawHistory.length - 1].date;
  const currentExclusionDate = exclusionZones[pair] || startDate;

  // Persistence
  useEffect(() => {
    localStorage.setItem('exclusion-zones-store', JSON.stringify(exclusionZones));
  }, [exclusionZones]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext, onBack]);

  useEffect(() => {
    setShowSecondary(false);
    const timer = setTimeout(() => setShowSecondary(true), 300);
    return () => clearTimeout(timer);
  }, [pair]);

  // Recalculate Metrics
  const filteredMetrics = useMemo(() => {
    if (currentExclusionDate === startDate) return null;
    return calculateFilteredMetrics(pairData, currentExclusionDate);
  }, [pairData, currentExclusionDate, startDate]);

  const filteredTrades = useMemo(() => {
    let t = pairData.trades || [];
    if (currentExclusionDate !== startDate) {
      const cutoff = new Date(currentExclusionDate).getTime();
      t = t.filter((item: any) => new Date(item.open_date).getTime() >= cutoff);
    }
    return t.filter((t: any) => {
      const year = t.open_date.split('-')[0];
      if (tradeFilter.year !== 'ALL' && year !== tradeFilter.year) return false;
      if (tradeFilter.side !== 'ALL' && t.side !== tradeFilter.side) return false;
      if (tradeFilter.reason !== 'ALL' && t.close_reason !== tradeFilter.reason) return false;
      return true;
    });
  }, [pairData.trades, tradeFilter, currentExclusionDate, startDate]);

  // Handle Dragging (mapped to slider)
  const handleExclusionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value);
    const newDate = rawHistory[index].date;
    setExclusionZones(prev => ({ ...prev, [pair]: newDate }));
  };

  const currentExclusionIndex = useMemo(() => {
    const idx = rawHistory.findIndex((h: any) => h.date === currentExclusionDate);
    return idx === -1 ? 0 : idx;
  }, [rawHistory, currentExclusionDate]);

  const exclusionDuration = useMemo(() => {
    if (currentExclusionDate === startDate) return null;
    const start = new Date(startDate);
    const end = new Date(currentExclusionDate);
    const monthsTotal = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    const years = Math.floor(monthsTotal / 12);
    const months = monthsTotal % 12;
    return `${years > 0 ? `${years} year${years > 1 ? 's' : ''} ` : ''}${months} month${months !== 1 ? 's' : ''}`;
  }, [startDate, currentExclusionDate]);

  const formatVal = (val: any, type: string) => {
    if (val === undefined || val === null) return '-';
    if (type === 'pct') return `${val.toFixed(2)}%`;
    if (type === 'num') return val.toFixed(2);
    if (type === 'curr') return formatCurrency(val);
    return val;
  };

  const handleExport = async (type: 'copy' | 'download') => {
    setIsExporting(true);
    setShowExportMenu(false);
    
    // Small delay to ensure any dynamic content is settled
    await new Promise(r => setTimeout(r, 100));

    try {
      const element = document.getElementById('export-container');
      if (!element) throw new Error('Export container not found');

      const canvas = await html2canvas(element, {
        scale: 2, // High resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      if (type === 'download') {
        const link = document.createElement('a');
        link.download = `${pair.replace(/\//g, '-')}-performance.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            alert('Image copied to clipboard!');
          } catch (err) {
            console.error('Clipboard error:', err);
            alert('Failed to copy. Download instead?');
          }
        }, 'image/png');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors font-medium text-sm">
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
            <div className="h-6 w-px bg-gray-300" />
            <h1 className="text-2xl font-bold text-gray-900">{pair}</h1>
            {m.hyperliquid && <span className="px-2.5 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full uppercase tracking-wide">Hyperliquid Ready</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowConfirmDelete(true)} className="p-2 border border-red-200 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete Pair">
              <Trash2 className="w-5 h-5" />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)} 
                disabled={isExporting}
                className={cn(
                  "p-2 border border-blue-200 rounded-lg transition-colors flex items-center gap-2 font-bold text-xs",
                  isExporting ? "bg-gray-100 text-gray-400 border-gray-200" : "hover:bg-blue-50 text-blue-600"
                )}
              >
                {isExporting ? 'Generating...' : <><Share2 className="w-5 h-5" /> Share</>}
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-[60] overflow-hidden py-1 animate-in fade-in zoom-in duration-200">
                  <button 
                    onClick={() => handleExport('copy')}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-700"
                  >
                    <Copy className="w-4 h-4 text-blue-500" /> Copy Image
                  </button>
                  <button 
                    onClick={() => handleExport('download')}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm font-semibold text-gray-700"
                  >
                    <DownloadIcon className="w-4 h-4 text-blue-500" /> Download PNG
                  </button>
                </div>
              )}
            </div>

            <div className="h-6 w-px bg-gray-300 mx-2" />
            <button onClick={onPrev} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
            <button onClick={onNext} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={showConfirmDelete} 
        onClose={() => setShowConfirmDelete(false)} 
        onConfirm={() => onDeletePair(pair)} 
        title="Confirm Deletion" 
        message={`Are you sure you want to remove ${pair}?`} 
      />

      <div className="flex-1 p-8 overflow-y-auto">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <MetricCard title="Final Capital" value={formatCurrency(m.final_capital)} filteredValue={filteredMetrics ? formatCurrency(filteredMetrics.final_capital) : null} />
          <MetricCard title="Annual Return" value={formatVal(m.annual_return_pct, 'pct')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.annual_return_pct, 'pct') : null} colorClass="text-green-600" />
          <MetricCard title="Sharpe Ratio" value={formatVal(m.sharpe, 'num')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.sharpe, 'num') : null} />
          <MetricCard title="Max Drawdown" value={formatVal(m.max_drawdown_pct, 'pct')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.max_drawdown_pct, 'pct') : null} colorClass="text-red-500" />
          <MetricCard title="Win Rate" value={formatVal(m.win_rate_pct, 'pct')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.win_rate_pct, 'pct') : null} />
          <MetricCard title="Profit Factor" value={formatVal(m.profit_factor, 'num')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.profit_factor, 'num') : null} />
          <MetricCard title="Trades / Year" value={formatVal(m.trades_per_year, 'num')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.trades_per_year, 'num') : null} subtext={`Total: ${filteredMetrics?.nb_trades ?? m.nb_trades}`} />
          <MetricCard title="Avg Trade" value={formatVal(m.avg_trade_pct * 100, 'pct')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.avg_trade_pct * 100, 'pct') : null} />
          <MetricCard title="Best Trade" value={formatVal(m.best_trade_pct, 'pct')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.best_trade_pct, 'pct') : null} colorClass="text-green-600" />
          <MetricCard title="Worst Trade" value={formatVal(m.worst_trade_pct, 'pct')} filteredValue={filteredMetrics ? formatVal(filteredMetrics.worst_trade_pct, 'pct') : null} colorClass="text-red-500" />
          <MetricCard title="Max Consec Wins" value={m.max_consec_wins} filteredValue={filteredMetrics?.max_consec_wins} colorClass="text-green-600" />
          <MetricCard title="Max Consec Loss" value={m.max_consec_losses} filteredValue={filteredMetrics?.max_consec_losses} colorClass="text-red-500" />
        </div>

        {/* Simulation Card */}
        {filteredMetrics && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-blue-800 font-bold text-lg mb-1">Filtered Simulation</h3>
              <p className="text-blue-600 text-sm">Hypothetical performance starting with $1,000 at the end of exclusion zone.</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-blue-700">
                $1,000 → {formatCurrency(1000 * (filteredMetrics.final_capital / filteredMetrics.start_capital))}
              </div>
              <div className={cn("font-bold", (filteredMetrics.final_capital / filteredMetrics.start_capital) >= 1 ? "text-green-600" : "text-red-500")}>
                ({((filteredMetrics.final_capital / filteredMetrics.start_capital - 1) * 100).toFixed(2)}%)
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Equity Curve & Drawdown</h3>
              <div className="flex items-center gap-4">
                {exclusionDuration && <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Excluded: {exclusionDuration}</span>}
                <button 
                  onClick={() => setExclusionZones(prev => ({ ...prev, [pair]: startDate }))}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset Zone
                </button>
              </div>
            </div>
            
            {/* Chart Area */}
            <div className="h-[400px] relative">
              <RechartsResponsiveContainer width="100%" height="70%">
                <RechartsLineChart data={walletHistory} syncId="anyId">
                  <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <RechartsXAxis dataKey="date" hide />
                  <RechartsYAxis domain={['auto', 'auto']} tick={{fontSize: 12}} stroke="#9CA3AF" tickFormatter={(val) => `$${val}`} width={80} />
                  <RechartsTooltip contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB'}} formatter={(val: any) => [formatCurrency(val), 'Capital']} />
                  
                  {/* Exclusion Overlay */}
                  <ReferenceArea x1={walletHistory[0].date} x2={currentExclusionDate} fill="rgba(239, 83, 80, 0.15)" />
                  <ReferenceLine x={currentExclusionDate} stroke="#EF5350" strokeDasharray="3 3" />
                  
                  <RechartsLine type="stepAfter" dataKey="wallet" stroke="#2962FF" strokeWidth={2} dot={false} isAnimationActive={false} />
                </RechartsLineChart>
              </RechartsResponsiveContainer>
              
              <RechartsResponsiveContainer width="100%" height="30%">
                <RechartsAreaChart data={walletHistory} syncId="anyId" margin={{top: 10}}>
                  <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <RechartsXAxis dataKey="date" tick={{fontSize: 12}} stroke="#9CA3AF" minTickGap={50} tickFormatter={(val) => val.split(' ')[0]} />
                  <RechartsYAxis reversed tick={{fontSize: 12}} stroke="#9CA3AF" tickFormatter={(val) => `${val}%`} width={80} />
                  <RechartsTooltip formatter={(val: any) => [`${Number(val).toFixed(2)}%`, 'Drawdown']} contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB'}} />
                  <ReferenceArea x1={walletHistory[0].date} x2={currentExclusionDate} fill="rgba(239, 83, 80, 0.15)" />
                  <RechartsArea type="monotone" dataKey="dd_pct" stroke="#EF5350" fill="#EF5350" fillOpacity={0.2} isAnimationActive={false} />
                </RechartsAreaChart>
              </RechartsResponsiveContainer>
            </div>

            {/* Draggable Handle Overlay (Sync with Slider) */}
            <div className="mt-6 px-20">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input 
                    type="range" 
                    min={0} 
                    max={rawHistory.length - 1} 
                    value={currentExclusionIndex} 
                    onChange={handleExclusionChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-bold">
                    <span>{startDate.split(' ')[0]}</span>
                    <span>{endDate.split(' ')[0]}</span>
                  </div>
                </div>
                <div className="w-60">
                  <input 
                    type="text" 
                    value={currentExclusionDate}
                    onChange={(e) => setExclusionZones(prev => ({ ...prev, [pair]: e.target.value }))}
                    className="w-full bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="YYYY-MM-DD HH:MM:SS"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[264px]">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Yearly PnL (USD)</h3>
              {showSecondary ? (
                <div className="h-[180px]">
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={pairData.by_year || []}>
                      <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <RechartsXAxis dataKey="year" tick={{fontSize: 12}} stroke="#9CA3AF" />
                      <RechartsYAxis tick={{fontSize: 12}} stroke="#9CA3AF" tickFormatter={(val) => `$${val}`} width={60} />
                      <RechartsTooltip cursor={{fill: '#F3F4F6'}} formatter={(val: any) => formatCurrency(val)} />
                      <RechartsBar dataKey="pnl_usd" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {(pairData.by_year || []).map((entry: any, index: number) => (
                          <RechartsCell key={`cell-${index}`} fill={(entry.pnl_usd ?? 0) >= 0 ? '#26A69A' : '#EF5350'} />
                        ))}
                      </RechartsBar>
                    </RechartsBarChart>
                  </RechartsResponsiveContainer>
                </div>
              ) : <Skeleton className="h-[180px] w-full" />}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[264px]">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Long vs Short</h3>
              {showSecondary ? (
                <div className="h-[180px]">
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <RechartsPie data={p.longShortData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value" isAnimationActive={false}>
                        {p.longShortData.map((entry: any, index: number) => <RechartsCell key={`cell-${index}`} fill={entry.color} />)}
                      </RechartsPie>
                      <RechartsTooltip />
                      <RechartsLegend verticalAlign="bottom" height={36} />
                    </RechartsPieChart>
                  </RechartsResponsiveContainer>
                </div>
              ) : <Skeleton className="h-[180px] w-full" />}
            </div>
          </div>
        </div>

        {/* Monthly Performance */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8 min-h-[340px]">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-6 border-b border-gray-100 pb-2">Monthly Performance (%)</h3>
          {showSecondary ? (
            <div className="space-y-12">
              {p.monthlyPnlYears.map((year: number) => (
                <div key={year} className="relative">
                  <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{year}</span><div className="flex-1 h-px bg-gray-100" /></div>
                  <div className="h-[180px]">
                    <RechartsResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart data={p.yearlyPnlData[year]} margin={{ top: 25, right: 30, left: 0, bottom: 25 }}>
                        <RechartsCartesianGrid vertical={false} stroke="#E0E3EB" strokeDasharray="0" />
                        <RechartsXAxis dataKey="month" tick={{fontSize: 10, fontWeight: 500}} stroke="#9CA3AF" axisLine={false} tickLine={false} />
                        <RechartsYAxis domain={p.yDomain} tick={{fontSize: 10}} stroke="#9CA3AF" tickFormatter={(val) => `${val}%`} width={60} axisLine={false} tickLine={false} />
                        <RechartsTooltip cursor={{fill: '#F3F4F6', opacity: 0.4}} formatter={(value: any) => [`${value.toFixed(2)}%`, 'PnL']} />
                        <ReferenceLine y={0} stroke="#1A1A2E" strokeWidth={1} />
                        <RechartsBar dataKey="pnl" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey="pnl" content={<MonthlyPnLLabel />} />
                          {p.yearlyPnlData[year].map((entry: any, index: number) => <RechartsCell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#26A69A' : '#EF5350'} fillOpacity={entry.hasData ? 1 : 0} />)}
                        </RechartsBar>
                      </RechartsBarChart>
                    </RechartsResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="space-y-8"><Skeleton className="h-[180px] w-full" /><Skeleton className="h-[180px] w-full" /></div>}
        </div>

        {/* Trades Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-12 min-h-[400px]">
          {showSecondary ? (
            <>
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Trade History</h3>
                <div className="flex gap-4">
                  <select className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2" value={tradeFilter.year} onChange={(e) => setTradeFilter({...tradeFilter, year: e.target.value})}>
                    <option value="ALL">All Years</option>
                    {p.years.map((y: any) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <select className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg p-2" value={tradeFilter.side} onChange={(e) => setTradeFilter({...tradeFilter, side: e.target.value})}>
                    <option value="ALL">All Sides</option>
                    <option value="LONG">Long</option>
                    <option value="SHORT">Short</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8F9FA] text-gray-500 font-semibold uppercase tracking-wider text-xs border-b border-gray-200">
                    <tr><th className="p-4">Open Date</th><th className="p-4">Close Date</th><th className="p-4">Side</th><th className="p-4">Close Reason</th><th className="p-4 text-right">PnL %</th><th className="p-4 text-right">PnL USD</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTrades.map((t: any, i: number) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-gray-700">{t.open_date}</td>
                        <td className="p-4 text-gray-700">{t.close_date}</td>
                        <td className={cn("p-4 font-bold", t.side === 'LONG' ? "text-green-600" : "text-red-500")}>{t.side}</td>
                        <td className="p-4 text-gray-600">{t.close_reason}</td>
                        <td className={cn("p-4 text-right font-medium", t.pnl_pct >= 0 ? "text-green-600" : "text-red-500")}>{(t.pnl_pct * 100).toFixed(2)}%</td>
                        <td className={cn("p-4 text-right font-bold", t.pnl_usd >= 0 ? "text-green-600" : "text-red-500")}>{t.pnl_usd >= 0 ? '+' : ''}{formatCurrency(t.pnl_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : <div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>}
        </div>
      </div>

      {/* Off-screen Export Container */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
        <ExportSummary 
          pair={pair} 
          metrics={m} 
          filteredMetrics={filteredMetrics} 
          walletHistory={walletHistory} 
        />
      </div>
    </div>
  );
}
