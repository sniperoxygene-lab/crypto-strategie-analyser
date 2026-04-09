import React, { useState, useMemo, useEffect, useRef } from 'react';
import Plotly from 'plotly.js-basic-dist';
import createPlotlyComponent from 'react-plotly.js/factory';
const Plot = createPlotlyComponent(Plotly);
import { 
  Trash2, 
  Upload, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Database,
  ArrowRight,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Activity,
  AlertTriangle,
  FileJson,
  RotateCcw,
  Share2,
  Copy,
  Download as DownloadIcon
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { ExportSummary } from './components/ExportSummary';
import { 
  cn, 
  formatCurrency, 
  formatPct, 
  processStrategyData, 
  generateDemoData, 
  calculateFilteredMetrics 
} from './utils';

// --- Components ---

const MetricCard = ({ 
  label, 
  value, 
  filteredValue, 
  formatter = (v: any) => v, 
  icon: Icon, 
  isPositiveBetter = true,
  simulationResult = null
}: any) => {
  const hasFilter = filteredValue !== undefined && filteredValue !== null;
  const isImproved = isPositiveBetter ? (filteredValue > value) : (filteredValue < value);
  const isSame = filteredValue === value;

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className={cn("absolute top-0 left-0 w-full h-1 opacity-20", isPositiveBetter ? "bg-green-500" : "bg-red-500")} />
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-blue-500 opacity-60" />}
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={cn("text-lg font-bold tracking-tight", hasFilter ? "text-gray-400 text-sm line-through" : "text-gray-900")}>
            {formatter(value)}
          </span>
          {hasFilter && !isSame && (
            <>
              <ArrowRight className="w-3 h-3 text-gray-400" />
              <span className={cn(
                "text-lg font-black tracking-tight",
                isImproved ? "text-blue-600" : "text-red-500"
              )}>
                {formatter(filteredValue)}
              </span>
            </>
          )}
        </div>
        {simulationResult && hasFilter && (
          <div className="mt-1 pt-1 border-t border-gray-50 flex items-center justify-between">
             <span className="text-[9px] font-bold text-gray-400 uppercase">Sim:</span>
             <span className={cn("text-[10px] font-black", simulationResult.pct >= 0 ? "text-green-600" : "text-red-500")}>
               {formatCurrency(simulationResult.value)} ({simulationResult.pct >= 0 ? '+' : ''}{simulationResult.pct.toFixed(1)}%)
             </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ConfirmationModal = ({ isOpen, onConfirm, onCancel, title, message }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in duration-200">
        <div className="p-8">
          <div className="flex items-center gap-4 text-red-500 mb-6">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900">{title}</h3>
          </div>
          <p className="text-gray-600 leading-relaxed mb-8 font-medium">{message}</p>
          <div className="flex gap-3 justify-end">
            <button 
              onClick={onCancel}
              className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={onConfirm}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95"
            >
              Confirm Deletion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [data, setData] = useState<Record<string, any>>({});
  const [selectedPair, setSelectedPair] = useState<string | null>(null);
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    minSharpe: 0,
    minReturn: 0,
    maxDrawdown: 100,
    hyperliquidOnly: false,
    sortBy: 'sharpe'
  });
  const [exclusionZones, setExclusionZones] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('exclusion-zones-v2');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Transient state for smooth dragging
  const [tempExclusionDate, setTempExclusionDate] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [view, setView] = useState<'global' | 'detail'>('global');
  const [search, setSearch] = useState('');
  const [tableSortKey, setTableSortKey] = useState<string>('sharpe');
  const [tableSortDir, setTableSortDir] = useState<'desc' | 'asc' | null>('desc');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScrollPosition = useRef<number>(0);

  const changeView = (newView: 'global' | 'detail') => {
    if (view === 'global' && newView === 'detail' && containerRef.current) {
      lastScrollPosition.current = containerRef.current.scrollTop;
    }
    setView(newView);
  };

  const handleExport = async (type: 'copy' | 'download') => {
    setIsExporting(true);
    setShowExportMenu(false);
    
    // Small delay
    await new Promise(r => setTimeout(r, 100));

    try {
      const element = document.getElementById('export-container');
      if (!element) throw new Error('Export container not found');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      if (type === 'download') {
        const link = document.createElement('a');
        link.download = `${selectedPair?.replace(/\//g, '-')}-performance.png`;
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
            alert('Failed to copy. Download instead?');
          }
        }, 'image/png');
      }
    } catch (err) {
      alert('Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (view === 'global' && containerRef.current) {
      containerRef.current.scrollTop = lastScrollPosition.current;
    }
  }, [view]);

  // Persist exclusion zones
  useEffect(() => {
    localStorage.setItem('exclusion-zones-v2', JSON.stringify(exclusionZones));
  }, [exclusionZones]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const processed = processStrategyData(json);
        setData(processed);
        setSelectedPair(null);
        setView('global');
      } catch (err) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const loadDemoData = () => {
    const demo = generateDemoData();
    const processed = processStrategyData(demo);
    setData(processed);
    setSelectedPair(null);
    setView('global');
  };

  const deletePair = (pair: string) => {
    const newData = { ...data };
    delete newData[pair];
    setData(newData);
    
    const newExclusion = { ...exclusionZones };
    delete newExclusion[pair];
    setExclusionZones(newExclusion);

    if (selectedPair === pair) {
      const keys = Object.keys(newData);
      if (keys.length > 0) {
        const currentIndex = Object.keys(data).indexOf(pair);
        const nextIndex = Math.min(currentIndex, keys.length - 1);
        setSelectedPair(keys[nextIndex]);
      } else {
        setSelectedPair(null);
        setView('global');
      }
    }
    setIsDeleting(null);
  };

  const handleTableSort = (key: string) => {
    if (tableSortKey === key) {
      if (tableSortDir === 'desc') setTableSortDir('asc');
      else if (tableSortDir === 'asc') { setTableSortKey('sharpe'); setTableSortDir('desc'); }
      else setTableSortDir('desc');
    } else {
      setTableSortKey(key);
      setTableSortDir('desc');
    }
  };

  const sortIndicator = (key: string) => {
    if (tableSortKey !== key || tableSortDir === null) return ' ↕';
    return tableSortDir === 'desc' ? ' ↓' : ' ↑';
  };

  const filteredPairs = useMemo(() => {
    const sortKeyMap: Record<string, (m: any, pair: string) => number | string> = {
      pair: (_m, pair) => pair,
      capital: (m) => m.final_capital,
      return: (m) => m.annual_return_pct,
      drawdown: (m) => m.max_drawdown_pct,
      sharpe: (m) => m.sharpe,
      winrate: (m) => m.win_rate_pct,
      pf: (m) => m.profit_factor,
      tpy: (m) => m.trades_per_year,
    };

    return Object.entries(data)
      .filter(([pair, strategy]) => {
        const m = strategy.metrics;
        const matchesSearch = pair.toLowerCase().includes(search.toLowerCase());
        const matchesSharpe = m.sharpe >= filters.minSharpe;
        const matchesReturn = m.annual_return_pct >= filters.minReturn;
        const matchesDD = m.max_drawdown_pct <= filters.maxDrawdown;
        const matchesHL = !filters.hyperliquidOnly || m.hyperliquid;
        return matchesSearch && matchesSharpe && matchesReturn && matchesDD && matchesHL;
      })
      .sort((a, b) => {
        const getter = sortKeyMap[tableSortKey] || sortKeyMap['sharpe'];
        const valA = getter(a[1].metrics, a[0]);
        const valB = getter(b[1].metrics, b[0]);
        const dir = tableSortDir === 'asc' ? 1 : -1;
        if (typeof valA === 'string' && typeof valB === 'string') return dir * valA.localeCompare(valB);
        // Corrected numeric sort: (valB - valA) for DESC (dir=-1), (valA - valB) for ASC (dir=1)
        return dir === -1 ? (valB as number) - (valA as number) : (valA as number) - (valB as number);
      });
  }, [data, filters, search, tableSortKey, tableSortDir]);

  const toggleShortlist = (pair: string) => {
    const next = new Set(shortlist);
    if (next.has(pair)) next.delete(pair);
    else next.add(pair);
    setShortlist(next);
  };

  const toggleAllShortlist = () => {
    if (shortlist.size === filteredPairs.length) setShortlist(new Set());
    else setShortlist(new Set(filteredPairs.map(([p]) => p)));
  };

  const exportSelectedCsv = () => {
    const selected = filteredPairs.filter(([p]) => shortlist.has(p));
    if (selected.length === 0) return alert('Select pairs to export');
    
    let csv = "Pair,Final Capital,Annual Return %,Max Drawdown %,Sharpe,Win Rate %,Profit Factor\n";
    selected.forEach(([pair, s]) => {
      const m = s.metrics;
      csv += `${pair},${m.final_capital.toFixed(2)},${m.annual_return_pct.toFixed(2)},${m.max_drawdown_pct.toFixed(2)},${m.sharpe.toFixed(2)},${m.win_rate_pct.toFixed(1)},${m.profit_factor.toFixed(2)}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screener_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const navigatePair = (dir: 'next' | 'prev') => {
    const keys = filteredPairs.map(([p]) => p);
    const idx = keys.indexOf(selectedPair || '');
    if (idx === -1) return;
    const nextIdx = dir === 'next' ? (idx + 1) % keys.length : (idx - 1 + keys.length) % keys.length;
    setSelectedPair(keys[nextIdx]);
    setTempExclusionDate(null); // Reset temp on navigation
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view === 'detail') {
        if (e.key === 'ArrowRight') navigatePair('next');
        if (e.key === 'ArrowLeft') navigatePair('prev');
        if (e.key === 'Escape') changeView('global');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, selectedPair, filteredPairs]);

  const activeStrategy = selectedPair ? data[selectedPair] : null;
  const activeExclusion = selectedPair ? exclusionZones[selectedPair] : null;
  const displayExclusion = isDragging ? (tempExclusionDate || activeExclusion) : activeExclusion;

  const filteredMetrics = useMemo(() => {
    if (!activeStrategy || !activeExclusion) return null;
    return calculateFilteredMetrics(activeStrategy, activeExclusion);
  }, [activeStrategy, activeExclusion]);

  const simulationResult = useMemo(() => {
    if (!filteredMetrics) return null;
    const ratio = filteredMetrics.final_capital / filteredMetrics.start_capital;
    return {
      value: 1000 * ratio,
      pct: (ratio - 1) * 100
    };
  }, [filteredMetrics]);

  return (
    <div className="flex h-screen bg-[#F8F9FC] text-gray-900 font-sans overflow-hidden">
      {/* Sidebar - Hidden on Detail View */}
      {view === 'global' && (
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-xl z-20 animate-in slide-in-from-left duration-300">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900">Screener</h1>
              <p className="text-[10px] uppercase tracking-widest text-blue-600 font-black">Pro Strategy Analyzer</p>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-100 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-5 h-5 text-gray-300 group-hover:text-blue-500 mb-2 transition-colors" />
              <p className="text-[11px] font-bold text-gray-400 group-hover:text-blue-600">Drop backtest JSON here</p>
            </div>
            <input type="file" className="hidden" accept=".json" onChange={handleFileUpload} />
          </label>
          
          <button 
            onClick={loadDemoData}
            className="w-full mt-3 py-2.5 text-xs font-black text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center justify-center gap-2 transition-colors border border-blue-100"
          >
            <Database className="w-4 h-4" /> Load Demo Data
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-black text-gray-400 flex items-center gap-2 uppercase tracking-widest">
                <Filter className="w-3.5 h-3.5 text-blue-500" /> Filters
              </h3>
              <span className="text-[10px] font-black bg-blue-50 px-2 py-0.5 rounded-full text-blue-600 border border-blue-100">
                {filteredPairs.length} FOUND
              </span>
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">
                  <span>Min Sharpe</span>
                  <span className="text-blue-600">{filters.minSharpe}</span>
                </div>
                <input 
                  type="range" min="0" max="5" step="0.1" 
                  value={filters.minSharpe}
                  onChange={e => setFilters({...filters, minSharpe: parseFloat(e.target.value)})}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">
                  <span>Min Return %</span>
                  <span className="text-blue-600">{filters.minReturn}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="5" 
                  value={filters.minReturn}
                  onChange={e => setFilters({...filters, minReturn: parseFloat(e.target.value)})}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black text-gray-400 mb-3 uppercase tracking-widest">
                  <span>Max Drawdown %</span>
                  <span className="text-blue-600">{filters.maxDrawdown}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" step="5" 
                  value={filters.maxDrawdown}
                  onChange={e => setFilters({...filters, maxDrawdown: parseFloat(e.target.value)})}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Hyperliquid only</span>
                <button 
                  onClick={() => setFilters({...filters, hyperliquidOnly: !filters.hyperliquidOnly})}
                  className={cn(
                    "w-10 h-5 rounded-full transition-colors relative shadow-inner",
                    filters.hyperliquidOnly ? "bg-green-500" : "bg-gray-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                    filters.hyperliquidOnly ? "left-6" : "left-1"
                  )} />
                </button>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">Sort by</h3>
            <select 
              value={tableSortKey}
              onChange={e => { setTableSortKey(e.target.value); setTableSortDir('desc'); }}
              className="w-full bg-gray-50 border border-gray-100 text-gray-700 text-xs font-bold rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500/10 appearance-none"
            >
              <option value="sharpe">Sharpe Ratio</option>
              <option value="capital">Final Capital</option>
              <option value="return">Annual Return</option>
              <option value="drawdown">Max Drawdown</option>
              <option value="winrate">Win Rate</option>
              <option value="pf">Profit Factor</option>
              <option value="tpy">Trades / Year</option>
              <option value="pair">Pair (A→Z)</option>
            </select>
          </section>
        </div>

        <div className="p-6 bg-white border-t border-gray-100">
          <button 
            onClick={exportSelectedCsv}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={shortlist.size === 0}
          >
            <Download className="w-4 h-4" /> Export Selected ({shortlist.size})
          </button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 px-8 flex items-center justify-between shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            {view === 'detail' && (
              <button 
                onClick={() => changeView('global')}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-blue-600"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <h2 className="text-2xl font-black text-gray-900 truncate tracking-tight">
              {view === 'global' ? 'Market Intelligence' : selectedPair}
            </h2>
            {view === 'global' && (
              <div className="relative max-w-xs w-full ml-6">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input 
                  type="text" 
                  placeholder="Search assets..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {view === 'detail' && (
              <>
                <button 
                  onClick={() => setIsDeleting(selectedPair)}
                  className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Delete strategy"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-gray-100 mx-2" />

                <div className="relative">
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)} 
                    disabled={isExporting}
                    className={cn(
                      "p-2.5 border border-blue-200 rounded-xl transition-colors flex items-center gap-2 font-black text-[10px] uppercase tracking-widest",
                      isExporting ? "bg-gray-100 text-gray-400 border-gray-100" : "hover:bg-blue-50 text-blue-600 border-blue-100"
                    )}
                  >
                    {isExporting ? 'Generating...' : <><Share2 className="w-4 h-4" /> Share</>}
                  </button>
                  
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-2xl z-[60] overflow-hidden py-1 animate-in fade-in zoom-in duration-200">
                      <button 
                        onClick={() => handleExport('copy')}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600"
                      >
                        <Copy className="w-4 h-4 text-blue-500" /> Copy Image
                      </button>
                      <button 
                        onClick={() => handleExport('download')}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-gray-600"
                      >
                        <DownloadIcon className="w-4 h-4 text-blue-500" /> Download PNG
                      </button>
                    </div>
                  )}
                </div>

                <div className="h-8 w-px bg-gray-100 mx-2" />
                <button 
                  onClick={() => toggleShortlist(selectedPair!)}
                  className={cn(
                    "p-2.5 rounded-xl transition-colors",
                    shortlist.has(selectedPair!) 
                      ? "text-blue-600 bg-blue-50 hover:bg-blue-100" 
                      : "text-gray-400 hover:text-blue-600 hover:bg-gray-50"
                  )}
                  title={shortlist.has(selectedPair!) ? "Remove from shortlist" : "Add to shortlist"}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-gray-100 mx-2" />
                <button 
                  onClick={() => navigatePair('prev')}
                  className="p-2.5 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => navigatePair('next')}
                  className="p-2.5 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-gray-900"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#F8F9FC] custom-scrollbar" ref={containerRef}>
          {view === 'global' ? (
            <div className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {Object.keys(data).length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[65vh] text-center">
                  <div className="w-28 h-28 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mb-8 rotate-3">
                    <FileJson className="w-14 h-14 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3">No Strategies Detected</h3>
                  <p className="text-gray-400 max-w-sm mx-auto mb-10 font-medium">Upload your backtest export JSON or use demo data to explore the professional analytics dashboard.</p>
                  <div className="flex gap-4">
                     <button 
                      onClick={loadDemoData}
                      className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3 active:scale-95"
                    >
                      <RefreshCw className="w-4 h-4" /> Load Demo Dataset
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Global Analytics Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Risk vs Reward Mapping</h3>
                      <div className="h-80">
                        <Plot
                          data={[{
                            x: filteredPairs.map(([, s]) => s.metrics.max_drawdown_pct),
                            y: filteredPairs.map(([, s]) => s.metrics.annual_return_pct),
                            text: filteredPairs.map(([p]) => p),
                            mode: 'markers',
                            marker: {
                              size: filteredPairs.map(([, s]) => Math.max(8, s.metrics.sharpe * 18)),
                              color: filteredPairs.map(([, s]) => s.metrics.sharpe),
                              colorscale: [[0, '#EF5350'], [0.5, '#2962FF'], [1, '#26A69A']],
                              showscale: true,
                              opacity: 0.8,
                              line: { width: 1.5, color: 'white' }
                            },
                            hovertemplate: '<b>%{text}</b><br>DD: %{x:.1f}%<br>Return: %{y:.1f}%<extra></extra>'
                          }]}
                          layout={{
                            margin: { l: 50, r: 10, t: 10, b: 50 },
                            xaxis: { title: { text: 'MAX DRAWDOWN (%)', font: { size: 10, weight: 900 } }, gridcolor: '#F8F9FA' },
                            yaxis: { title: { text: 'ANNUAL RETURN (%)', font: { size: 10, weight: 900 } }, gridcolor: '#F8F9FA' },
                            plot_bgcolor: 'white',
                            paper_bgcolor: 'white',
                            autosize: true,
                            transition: { duration: 0 }
                          }}
                          config={{ displayModeBar: false, responsive: true }}
                          className="w-full h-full"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Performance Leaderboard</h3>
                      <div className="h-80">
                        <Plot
                          data={[{
                            y: filteredPairs.slice(0, 10).reverse().map(([p]) => p),
                            x: filteredPairs.slice(0, 10).reverse().map(([, s]) => s.metrics.sharpe),
                            type: 'bar',
                            orientation: 'h',
                            marker: {
                              color: filteredPairs.slice(0, 10).reverse().map(([, s]) => s.metrics.hyperliquid ? '#26A69A' : '#2962FF'),
                              opacity: 0.9,
                              line: { width: 0 }
                            }
                          }]}
                          layout={{
                            margin: { l: 90, r: 20, t: 10, b: 50 },
                            xaxis: { title: { text: 'SHARPE RATIO', font: { size: 10, weight: 900 } }, gridcolor: '#F8F9FA' },
                            yaxis: { gridcolor: 'transparent', tickfont: { size: 10, weight: 700 } },
                            plot_bgcolor: 'white',
                            paper_bgcolor: 'white',
                            autosize: true,
                            transition: { duration: 0 }
                          }}
                          config={{ displayModeBar: false, responsive: true }}
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Main Table View */}
                  <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-8 py-6">
                              <input 
                                type="checkbox" 
                                checked={shortlist.size === filteredPairs.length && filteredPairs.length > 0}
                                onChange={toggleAllShortlist}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </th>
                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleTableSort('pair')}>Pair{sortIndicator('pair')}</th>
                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleTableSort('capital')}>Final Capital{sortIndicator('capital')}</th>
                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleTableSort('return')}>Return / Year{sortIndicator('return')}</th>
                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleTableSort('drawdown')}>Max Drawdown{sortIndicator('drawdown')}</th>
                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleTableSort('sharpe')}>Sharpe{sortIndicator('sharpe')}</th>
                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center cursor-pointer select-none hover:text-blue-600 transition-colors" onClick={() => handleTableSort('winrate')}>Win Rate{sortIndicator('winrate')}</th>
                            <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">HL</th>
                            <th className="px-8 py-6 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {filteredPairs.map(([pair, s]) => (
                            <tr 
                              key={pair} 
                              className={cn(
                                "group hover:bg-blue-50/40 transition-all cursor-pointer",
                                s.metrics.hyperliquid ? "bg-green-50/10" : ""
                              )}
                              onClick={() => {
                                setSelectedPair(pair);
                                changeView('detail');
                              }}
                            >
                              <td className="px-8 py-6" onClick={e => e.stopPropagation()}>
                                <input 
                                  type="checkbox" 
                                  checked={shortlist.has(pair)}
                                  onChange={() => toggleShortlist(pair)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-8 py-6 font-black text-gray-900">{pair}</td>
                              <td className="px-8 py-6 font-bold text-gray-600">{formatCurrency(s.metrics.final_capital)}</td>
                              <td className="px-8 py-6 relative min-w-[140px]">
                                <div className="absolute inset-y-4 left-6 right-12 bg-green-500/5 rounded overflow-hidden">
                                  <div className="h-full bg-green-500/20" style={{ width: `${Math.min(100, s.metrics.annual_return_pct)}%` }} />
                                </div>
                                <span className="relative z-10 font-black text-green-700">{formatPct(s.metrics.annual_return_pct)}</span>
                              </td>
                              <td className="px-8 py-6 relative min-w-[140px]">
                                <div className="absolute inset-y-4 left-6 right-12 bg-red-500/5 rounded overflow-hidden">
                                  <div className="h-full bg-red-500/20" style={{ width: `${Math.min(100, s.metrics.max_drawdown_pct)}%` }} />
                                </div>
                                <span className="relative z-10 font-black text-red-600">-{formatPct(s.metrics.max_drawdown_pct)}</span>
                              </td>
                              <td className="px-8 py-6 relative text-center">
                                <span className="font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                                  {s.metrics.sharpe.toFixed(2)}
                                </span>
                              </td>
                              <td className="px-8 py-6 text-center font-bold text-gray-600">{formatPct(s.metrics.win_rate_pct)}</td>
                              <td className="px-8 py-6 text-center">
                                {s.metrics.hyperliquid ? (
                                  <div className="flex justify-center"><CheckCircle2 className="w-5 h-5 text-green-500" /></div>
                                ) : (
                                  <div className="flex justify-center"><XCircle className="w-5 h-5 text-gray-200" /></div>
                                )}
                              </td>
                              <td className="px-8 py-6 text-right" onClick={e => e.stopPropagation()}>
                                <button 
                                  onClick={() => setIsDeleting(pair)}
                                  className="p-2 text-gray-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : activeStrategy && (
            <div className="p-8 space-y-8 animate-in slide-in-from-right-8 duration-500">
              {/* Performance Scorecards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                <MetricCard 
                  label="Final Capital" 
                  value={activeStrategy.metrics.final_capital} 
                  filteredValue={filteredMetrics?.final_capital} 
                  formatter={formatCurrency} 
                  icon={Database} 
                  simulationResult={simulationResult}
                />
                <MetricCard label="Annual Return" value={activeStrategy.metrics.annual_return_pct} filteredValue={filteredMetrics?.annual_return_pct} formatter={formatPct} icon={TrendingUp} />
                <MetricCard label="Sharpe Ratio" value={activeStrategy.metrics.sharpe} filteredValue={filteredMetrics?.sharpe} formatter={(v: number) => v.toFixed(2)} icon={Activity} />
                <MetricCard label="Max Drawdown" value={activeStrategy.metrics.max_drawdown_pct} filteredValue={filteredMetrics?.max_drawdown_pct} formatter={(v: number) => `-${formatPct(v)}`} icon={AlertTriangle} isPositiveBetter={false} />
                <MetricCard label="Win Rate" value={activeStrategy.metrics.win_rate_pct} filteredValue={filteredMetrics?.win_rate_pct} formatter={formatPct} icon={CheckCircle2} />
                <MetricCard label="Profit Factor" value={activeStrategy.metrics.profit_factor} filteredValue={filteredMetrics?.profit_factor} formatter={(v: number) => v.toFixed(2)} />
                <MetricCard label="Trades / Year" value={activeStrategy.metrics.trades_per_year} filteredValue={filteredMetrics?.trades_per_year} formatter={(v: number) => v.toFixed(1)} />
                <MetricCard label="Best Trade" value={activeStrategy.metrics.best_trade_pct} filteredValue={filteredMetrics?.best_trade_pct} formatter={formatPct} />
                <MetricCard label="Worst Trade" value={activeStrategy.metrics.worst_trade_pct} filteredValue={filteredMetrics?.worst_trade_pct} formatter={formatPct} isPositiveBetter={false} />
                <MetricCard label="Max Consec Wins" value={activeStrategy.metrics.max_consec_wins} filteredValue={filteredMetrics?.max_consec_wins} />
                <MetricCard label="Max Consec Loss" value={activeStrategy.metrics.max_consec_losses} filteredValue={filteredMetrics?.max_consec_losses} isPositiveBetter={false} />
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center group hover:shadow-md transition-shadow">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">HL Compatibility</span>
                  {activeStrategy.metrics.hyperliquid ? (
                    <div className="flex items-center gap-2 text-green-600 font-black text-sm">
                      <CheckCircle2 className="w-5 h-5" /> READY
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-300 font-black text-sm">
                      <XCircle className="w-5 h-5" /> N/A
                    </div>
                  )}
                </div>
              </div>

              {/* Main Analysis Hub */}
              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                  <div className="flex flex-wrap items-center justify-between gap-8">
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 mb-1 tracking-tight">Equity Curve & Drawdown Analysis</h3>
                      <p className="text-sm font-medium text-gray-400">Deep-dive into chronological growth and risk exposure</p>
                    </div>
                    
                    {/* Visual Warm-up Logic */}
                    <div className="bg-gray-50/50 px-6 py-4 rounded-2xl border border-gray-100 flex items-center gap-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Exclusion Zone (Warm-up)</p>
                        <div className="flex items-center gap-4">
                          <input 
                            type="text"
                            placeholder="YYYY-MM-DD HH:MM:SS"
                            value={tempExclusionDate || activeExclusion || ''}
                            onChange={e => setTempExclusionDate(e.target.value)}
                            onBlur={() => {
                               if (tempExclusionDate) {
                                 setExclusionZones({...exclusionZones, [selectedPair!]: tempExclusionDate});
                                 setTempExclusionDate(null);
                               }
                            }}
                            className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-xs font-mono w-52 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-bold"
                          />
                          <button 
                            onClick={() => {
                              const next = {...exclusionZones};
                              delete next[selectedPair!];
                              setExclusionZones(next);
                              setTempExclusionDate(null);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white border border-gray-100 rounded-lg hover:border-red-100"
                            title="Reset Exclusion"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      {(displayExclusion) && (
                        <div className="pl-8 border-l border-gray-200">
                          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Duration Blocked</p>
                          <p className="text-sm font-black text-red-500">
                            {(() => {
                              const start = new Date(activeStrategy.wallet_history[0].date);
                              const end = new Date(displayExclusion);
                              if (isNaN(end.getTime())) return "Invalid Date";
                              const diff = end.getTime() - start.getTime();
                              const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
                              const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
                              return `${years}y ${months}m removed`;
                            })()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Primary Equity Chart */}
                    <div 
                      className="h-[450px] relative select-none"
                      ref={chartContainerRef}
                      onMouseMove={(e) => {
                        if (isDragging && chartContainerRef.current) {
                          const rect = chartContainerRef.current.getBoundingClientRect();
                          const plotAreaLeft = rect.left + 60;
                          const plotAreaWidth = rect.width - 80;
                          const x = Math.max(0, Math.min(plotAreaWidth, e.clientX - plotAreaLeft));
                          const pct = x / plotAreaWidth;
                          
                          const history = activeStrategy.wallet_history;
                          const targetIdx = Math.round(pct * (history.length - 1));
                          const newDate = history[targetIdx].date;
                          setTempExclusionDate(newDate);
                        }
                      }}
                      onMouseUp={() => {
                        if (isDragging && tempExclusionDate) {
                          setExclusionZones({...exclusionZones, [selectedPair!]: tempExclusionDate});
                          setTempExclusionDate(null);
                        }
                        setIsDragging(false);
                      }}
                      onMouseLeave={() => {
                         if (isDragging && tempExclusionDate) {
                          setExclusionZones({...exclusionZones, [selectedPair!]: tempExclusionDate});
                          setTempExclusionDate(null);
                        }
                        setIsDragging(false);
                      }}
                    >
                      <Plot
                        data={[
                          {
                            x: activeStrategy.wallet_history.map((h: any) => h.date),
                            y: activeStrategy.wallet_history.map((h: any) => h.wallet),
                            type: 'scatter',
                            mode: 'lines',
                            name: 'Equity',
                            line: { color: '#2962FF', width: 3, shape: 'hv' },
                            fill: 'tozeroy',
                            fillcolor: 'rgba(41, 98, 255, 0.03)'
                          }
                        ]}
                        layout={{
                          margin: { l: 60, r: 20, t: 0, b: 40 },
                          xaxis: { 
                            type: 'date',
                            gridcolor: '#F8F9FA',
                            tickfont: { color: '#94A3B8', size: 10, weight: 700 },
                            linecolor: '#E2E8F0'
                          },
                          yaxis: { 
                            gridcolor: '#F8F9FA',
                            tickfont: { color: '#94A3B8', size: 10, weight: 700 },
                            title: { text: 'PORTFOLIO VALUE (USD)', font: { size: 9, weight: 900, color: '#94A3B8' } },
                            linecolor: '#E2E8F0'
                          },
                          plot_bgcolor: 'white',
                          paper_bgcolor: 'white',
                          autosize: true,
                          showlegend: false,
                          transition: { duration: 0 },
                          shapes: displayExclusion ? [{
                            type: 'rect',
                            xref: 'x',
                            yref: 'paper',
                            x0: activeStrategy.wallet_history[0].date,
                            x1: displayExclusion,
                            y0: 0,
                            y1: 1,
                            fillcolor: 'rgba(239, 83, 80, 0.1)',
                            line: { width: 1, color: 'rgba(239, 83, 80, 0.3)' },
                            layer: 'below'
                          }] : []
                        }}
                        config={{ displayModeBar: false, responsive: true, staticPlot: false }}
                        className="w-full h-full"
                      />

                      {/* DRAGGABLE HANDLE */}
                      <div 
                        style={{
                          left: (() => {
                            const history = activeStrategy.wallet_history;
                            const currentIdx = history.findIndex((h: any) => h.date >= (displayExclusion || ''));
                            const idx = currentIdx === -1 ? 0 : currentIdx;
                            const pct = idx / (history.length - 1);
                            return `calc(60px + ${pct * 100}% - ${pct * 80}px)`;
                          })(),
                          top: '50%',
                          transform: 'translate(-50%, -50%)'
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        className={cn(
                          "absolute w-10 h-10 bg-red-500 rounded-full border-[3px] border-white shadow-2xl cursor-grab active:cursor-grabbing flex items-center justify-center transition-transform z-30",
                          isDragging ? "scale-110 shadow-red-200" : "hover:scale-110"
                        )}
                      >
                        <ArrowRight className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    
                    {/* Secondary Drawdown Chart */}
                    <div className="h-[180px]">
                      <Plot
                        data={[
                          {
                            x: activeStrategy.wallet_history.map((h: any) => h.date),
                            y: activeStrategy.wallet_history.map((h: any) => -h.dd_pct),
                            type: 'scatter',
                            fill: 'tozeroy',
                            mode: 'lines',
                            name: 'Drawdown',
                            line: { color: '#EF5350', width: 1.5 },
                            fillcolor: 'rgba(239, 83, 80, 0.15)'
                          }
                        ]}
                        layout={{
                          margin: { l: 60, r: 20, t: 0, b: 40 },
                          xaxis: { 
                            type: 'date',
                            gridcolor: '#F8F9FA',
                            tickfont: { color: '#94A3B8', size: 10, weight: 700 }
                          },
                          yaxis: { 
                            gridcolor: '#F8F9FA',
                            tickfont: { color: '#94A3B8', size: 10, weight: 700 },
                            title: { text: 'MAX DRAWDOWN (%)', font: { size: 9, weight: 900, color: '#94A3B8' } }
                          },
                          plot_bgcolor: 'white',
                          paper_bgcolor: 'white',
                          autosize: true,
                          transition: { duration: 0 },
                          shapes: displayExclusion ? [{
                            type: 'rect',
                            xref: 'x',
                            yref: 'paper',
                            x0: activeStrategy.wallet_history[0].date,
                            x1: displayExclusion,
                            y0: 0,
                            y1: 1,
                            fillcolor: 'rgba(239, 83, 80, 0.1)',
                            line: { width: 0 },
                            layer: 'below'
                          }] : []
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Detailed Performance Calendar */}
                  <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">Monthly Performance Heatmap</h3>
                        <p className="text-sm font-medium text-gray-400">Isolated year-by-year monthly returns</p>
                      </div>
                    </div>
                    
                    <div className="space-y-12 max-h-[700px] overflow-y-auto pr-4 custom-scrollbar">
                      {activeStrategy.precomputed.monthlyPnlYears.map((year: number) => {
                        const yearData = activeStrategy.precomputed.yearlyPnlData[year];
                        return (
                          <div key={year} className="space-y-4">
                            <h4 className="text-lg font-black text-gray-900 flex items-center gap-3">
                              <span className="w-1.5 h-6 bg-blue-600 rounded-full" />
                              {year}
                            </h4>
                            <div className="h-[250px]">
                              <Plot
                                data={[
                                  {
                                    x: yearData.map((d: any) => d.month),
                                    y: yearData.map((d: any) => d.pnl),
                                    type: 'bar',
                                    marker: {
                                      color: yearData.map((d: any) => d.pnl >= 0 ? '#26A69A' : '#EF5350'),
                                      opacity: 0.9,
                                      line: { width: 0 }
                                    },
                                    text: yearData.map((d: any) => `${d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(1)}%`),
                                    textposition: 'outside',
                                    textfont: { size: 10, weight: 800, family: 'DM Sans' }
                                  }
                                ]}
                                layout={{
                                  margin: { l: 50, r: 10, t: 40, b: 30 },
                                  xaxis: { gridcolor: 'transparent', tickfont: { size: 10, weight: 700 } },
                                  yaxis: { 
                                    gridcolor: '#F8F9FA', 
                                    range: activeStrategy.precomputed.yDomain,
                                    zeroline: true,
                                    zerolinecolor: '#1A1A2E',
                                    zerolinewidth: 1,
                                    tickfont: { size: 10, weight: 700 }
                                  },
                                  plot_bgcolor: 'white',
                                  paper_bgcolor: 'white',
                                  autosize: true,
                                  transition: { duration: 0 }
                                }}
                                config={{ displayModeBar: false, responsive: true }}
                                className="w-full h-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Allocation & Statistics Breakdown */}
                  <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Side Allocation</h3>
                      <div className="h-64">
                        <Plot
                          data={[{
                            values: activeStrategy.precomputed.longShortData.map((d: any) => d.value),
                            labels: activeStrategy.precomputed.longShortData.map((d: any) => d.name),
                            type: 'pie',
                            hole: 0.6,
                            marker: {
                              colors: activeStrategy.precomputed.longShortData.map((d: any) => d.color)
                            },
                            textinfo: 'label+percent',
                            textfont: { size: 10, weight: 900, color: 'white' }
                          }]}
                          layout={{
                            margin: { l: 0, r: 0, t: 0, b: 0 },
                            showlegend: false,
                            autosize: true,
                            transition: { duration: 0 }
                          }}
                          config={{ displayModeBar: false, responsive: true }}
                          className="w-full h-full"
                        />
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                      <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8">Executive Summary</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Avg Trade PnL</span>
                          <span className={cn("font-black text-sm", activeStrategy.metrics.avg_trade_pct >= 0 ? "text-green-600" : "text-red-600")}>
                            {formatPct(activeStrategy.metrics.avg_trade_pct * 100)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Profit Factor</span>
                          <span className="font-black text-sm text-gray-900">{activeStrategy.metrics.profit_factor.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Horizon</span>
                          <span className="font-black text-sm text-gray-900">{activeStrategy.metrics.history_days} Days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secure Audit Trail / Ledger */}
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden mb-12">
                  <div className="px-10 py-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">Trade Ledger Audit</h3>
                      <p className="text-sm font-medium text-gray-400 italic">Verified execution log for all strategy signals</p>
                    </div>
                    <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100">
                      {activeStrategy.trades.length} Verified Events
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white shadow-sm z-10 border-b border-gray-100">
                        <tr>
                          <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Timestamp Open</th>
                          <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Timestamp Close</th>
                          <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Execution</th>
                          <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Resolution</th>
                          <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Yield %</th>
                          <th className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Result $</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {activeStrategy.trades.map((t: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-10 py-5 text-xs font-mono font-bold text-gray-400">{t.open_date}</td>
                            <td className="px-10 py-5 text-xs font-mono font-bold text-gray-400">{t.close_date}</td>
                            <td className="px-10 py-5">
                              <span className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                t.side === 'LONG' ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"
                              )}>
                                {t.side}
                              </span>
                            </td>
                            <td className="px-10 py-5 text-xs font-black text-gray-600">{t.close_reason}</td>
                            <td className={cn(
                              "px-10 py-5 text-xs font-black text-right",
                              t.pnl_pct >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {t.pnl_pct >= 0 ? '+' : ''}{(t.pnl_pct * 100).toFixed(2)}%
                            </td>
                            <td className={cn(
                              "px-10 py-5 text-xs font-black text-right",
                              t.pnl_usd >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {formatCurrency(t.pnl_usd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modals */}
      <ConfirmationModal 
        isOpen={!!isDeleting}
        title="Permanently remove pair?"
        message={`Are you sure you want to delete ${isDeleting}? This action removes all historical data and performance metrics from the current session. This cannot be undone.`}
        onConfirm={() => deletePair(isDeleting!)}
        onCancel={() => setIsDeleting(null)}
      />

      {/* Off-screen Export Container */}
      {view === 'detail' && selectedPair && data[selectedPair] && (
        <div style={{ position: 'absolute', top: '-10000px', left: '-10000px' }}>
          <ExportSummary 
            pair={selectedPair} 
            metrics={data[selectedPair].metrics} 
            filteredMetrics={filteredMetrics} 
            walletHistory={data[selectedPair].wallet_history} 
          />
        </div>
      )}
    </div>
  );
}
