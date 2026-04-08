import React, { useState, useMemo } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ZAxis, 
  BarChart, Bar, Cell, XAxis as BarXAxis, YAxis as BarYAxis
} from 'recharts';
import { CheckSquare, Square, ChevronUp, ChevronDown, ShieldCheck, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

interface GlobalViewProps {
  data: any;
  filters: any;
  selectedPairs: Set<string>;
  setSelectedPairs: (val: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  onPairClick: (pair: string) => void;
  onDeletePair: (pair: string) => void;
}

export function GlobalView({ data, filters, selectedPairs, setSelectedPairs, onPairClick, onDeletePair }: GlobalViewProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'sharpe', direction: 'desc' });
  const [deletingPair, setDeletingPair] = useState<string | null>(null);

  const filteredPairs = useMemo(() => {
    return Object.entries(data)
      .map(([pair, details]: [string, any]) => ({
        pair,
        ...details.metrics
      }))
      .filter((m: any) => {
        if (m.sharpe < filters.sharpeMin) return false;
        if (m.annual_return_pct < filters.returnMin) return false;
        if (m.max_drawdown_pct > filters.ddMax) return false;
        if (filters.hyperliquidOnly && !m.hyperliquid) return false;
        return true;
      });
  }, [data, filters]);

  const sortedPairs = useMemo(() => {
    const sorted = [...filteredPairs];
    sorted.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      
      if (sortConfig.key === 'pair') {
        aVal = a.pair;
        bVal = b.pair;
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredPairs, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const toggleSelectAll = () => {
    if (selectedPairs.size === sortedPairs.length && sortedPairs.length > 0) {
      setSelectedPairs(new Set());
    } else {
      setSelectedPairs(new Set(sortedPairs.map(p => p.pair)));
    }
  };

  const toggleSelect = (e: React.MouseEvent, pair: string) => {
    e.stopPropagation();
    setSelectedPairs(prev => {
      const next = new Set(prev);
      if (next.has(pair)) next.delete(pair);
      else next.add(pair);
      return next;
    });
  };

  const maxSharpe = Math.max(...sortedPairs.map(p => p.sharpe || 0), 0.01);
  const maxReturn = Math.max(...sortedPairs.map(p => p.annual_return_pct || 0), 0.01);
  const maxDrawdown = Math.max(...sortedPairs.map(p => p.max_drawdown_pct || 0), 0.01);

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) return <div className="w-4 h-4 opacity-0 group-hover:opacity-30"><ChevronDown className="w-4 h-4" /></div>;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-600" /> 
      : <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-md text-sm">
          <p className="font-bold text-gray-800 mb-1">{data.pair}</p>
          <p className="text-gray-600">Sharpe: <span className="font-semibold text-gray-900">{data.sharpe?.toFixed(2)}</span></p>
          <p className="text-gray-600">Return: <span className="font-semibold text-green-600">{data.annual_return_pct?.toFixed(1)}%</span></p>
          <p className="text-gray-600">Drawdown: <span className="font-semibold text-red-500">{data.max_drawdown_pct?.toFixed(1)}%</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 ml-72 min-h-screen bg-[#F5F6FA]">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Market Overview</h1>
          <p className="text-gray-500 mt-1">{sortedPairs.length} strategies matching filters</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[350px]">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Risk / Reward Scatter</h3>
          <ResponsiveContainer width="100%" height="90%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis type="number" dataKey="max_drawdown_pct" name="Drawdown" unit="%" stroke="#9CA3AF" tick={{fontSize: 12}} />
              <YAxis type="number" dataKey="annual_return_pct" name="Return" unit="%" stroke="#9CA3AF" tick={{fontSize: 12}} />
              <ZAxis type="number" dataKey="sharpe" range={[50, 400]} name="Sharpe" />
              <RechartsTooltip cursor={{strokeDasharray: '3 3'}} content={<CustomTooltip />} />
              <Scatter name="Strategies" data={sortedPairs} fill="#2962FF" fillOpacity={0.6} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-[350px]">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Top Strategies by Sharpe</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart layout="vertical" data={sortedPairs.slice(0, 10)} margin={{ top: 0, right: 20, bottom: 0, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
              <BarXAxis type="number" stroke="#9CA3AF" tick={{fontSize: 12}} />
              <BarYAxis type="category" dataKey="pair" stroke="#9CA3AF" tick={{fontSize: 12}} width={80} />
              <RechartsTooltip cursor={{fill: '#F3F4F6'}} content={<CustomTooltip />} />
              <Bar dataKey="sharpe" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {sortedPairs.slice(0, 10).map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.hyperliquid ? '#26A69A' : '#2962FF'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-semibold select-none">
                <th className="p-4 w-12 text-center">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600 focus:outline-none">
                    {selectedPairs.size === sortedPairs.length && sortedPairs.length > 0 ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                {[
                  { key: 'pair', label: 'Pair' },
                  { key: 'final_capital', label: 'Capital' },
                  { key: 'annual_return_pct', label: 'Return/yr' },
                  { key: 'max_drawdown_pct', label: 'Drawdown' },
                  { key: 'sharpe', label: 'Sharpe' },
                  { key: 'trades_per_year', label: 'Trades/yr' },
                  { key: 'win_rate_pct', label: 'Win Rate' },
                  { key: 'profit_factor', label: 'Profit Factor' },
                  { key: 'hyperliquid', label: 'HL' },
                ].map((col) => (
                  <th key={col.key} className="p-4 cursor-pointer hover:bg-gray-100 group transition-colors" onClick={() => handleSort(col.key)}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      <SortIcon column={col.key} />
                    </div>
                  </th>
                ))}
                <th className="p-4 w-12 text-center text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {sortedPairs.map((row) => (
                <tr 
                  key={row.pair} 
                  onClick={() => onPairClick(row.pair)}
                  className={cn(
                    "border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group",
                    row.hyperliquid && "bg-green-50/30"
                  )}
                >
                  <td className="p-4 text-center">
                    <button onClick={(e) => toggleSelect(e, row.pair)} className="text-gray-300 group-hover:text-gray-400 hover:!text-blue-600">
                      {selectedPairs.has(row.pair) ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="p-4 font-bold text-gray-800">{row.pair}</td>
                  <td className="p-4 font-medium text-gray-700">{formatCurrency(row.final_capital)}</td>
                  
                  <td className="p-4">
                    <div className="relative w-24 h-6 flex items-center">
                      <div className="absolute top-0 left-0 h-full bg-green-100 rounded" style={{ width: `${Math.max(0, (row.annual_return_pct / maxReturn) * 100)}%` }} />
                      <span className="relative z-10 px-2 font-semibold text-green-700">{row.annual_return_pct?.toFixed(2)}%</span>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="relative w-24 h-6 flex items-center">
                      <div className="absolute top-0 left-0 h-full bg-red-100 rounded" style={{ width: `${Math.max(0, (row.max_drawdown_pct / maxDrawdown) * 100)}%` }} />
                      <span className="relative z-10 px-2 font-semibold text-red-600">{row.max_drawdown_pct?.toFixed(2)}%</span>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="relative w-24 h-6 flex items-center">
                      <div className="absolute top-0 left-0 h-full bg-blue-100 rounded" style={{ width: `${Math.max(0, (row.sharpe / maxSharpe) * 100)}%` }} />
                      <span className="relative z-10 px-2 font-semibold text-blue-700">{row.sharpe?.toFixed(2)}</span>
                    </div>
                  </td>

                  <td className="p-4 text-gray-600">{row.trades_per_year?.toFixed(1)}</td>
                  <td className="p-4 text-gray-600">{row.win_rate_pct?.toFixed(1)}%</td>
                  <td className="p-4 text-gray-600">{row.profit_factor?.toFixed(2)}</td>
                  <td className="p-4 text-center">
                    {row.hyperliquid && <ShieldCheck className="w-5 h-5 text-green-500 mx-auto" />}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPair(row.pair);
                      }} 
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Strategy"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {sortedPairs.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500">
                    No strategies match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={!!deletingPair}
        onClose={() => setDeletingPair(null)}
        onConfirm={() => deletingPair && onDeletePair(deletingPair)}
        title="Confirm Deletion"
        message={`Are you sure you want to remove ${deletingPair}? This cannot be undone until you reload the file.`}
      />
    </div>
  );
}
