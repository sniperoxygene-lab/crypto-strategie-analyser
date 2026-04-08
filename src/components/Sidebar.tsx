import React from 'react';
import { Upload, Download, Settings2, SlidersHorizontal } from 'lucide-react';
import { cn } from '../utils';

interface SidebarProps {
  onFileUpload: (data: any) => void;
  filters: {
    sharpeMin: number;
    returnMin: number;
    ddMax: number;
    hyperliquidOnly: boolean;
  };
  setFilters: (filters: any) => void;
  onExport: () => void;
  hasSelectedPairs: boolean;
  onLoadDemo: () => void;
}

export function Sidebar({ onFileUpload, filters, setFilters, onExport, hasSelectedPairs, onLoadDemo }: SidebarProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onFileUpload(json);
      } catch (error) {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-72 bg-[#F0F2F5] border-r border-gray-200 h-screen overflow-y-auto flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-blue-600" />
          Screener
        </h1>
        
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-gray-50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 font-medium">Upload JSON</p>
          </div>
          <input type="file" className="hidden" accept=".json" onChange={handleFileChange} />
        </label>
        
        <button 
          onClick={onLoadDemo}
          className="mt-3 w-full text-sm text-blue-600 font-medium hover:text-blue-700 py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Load Demo Data
        </button>
      </div>

      <div className="p-6 flex-1 space-y-6">
        <div className="flex items-center gap-2 text-gray-700 font-semibold mb-4">
          <SlidersHorizontal className="w-5 h-5" />
          <h2>Filters</h2>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <label className="text-gray-600 font-medium">Min Sharpe</label>
              <span className="text-blue-600 font-semibold">{filters.sharpeMin.toFixed(2)}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="3" 
              step="0.1" 
              value={filters.sharpeMin}
              onChange={(e) => setFilters({ ...filters, sharpeMin: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <label className="text-gray-600 font-medium">Min Annual Return</label>
              <span className="text-blue-600 font-semibold">{filters.returnMin}%</span>
            </div>
            <input 
              type="range" 
              min="-50" 
              max="150" 
              step="5" 
              value={filters.returnMin}
              onChange={(e) => setFilters({ ...filters, returnMin: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <label className="text-gray-600 font-medium">Max Drawdown</label>
              <span className="text-blue-600 font-semibold">{filters.ddMax}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5" 
              value={filters.ddMax}
              onChange={(e) => setFilters({ ...filters, ddMax: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                filters.hyperliquidOnly ? "bg-green-500" : "bg-gray-300"
              )}>
                <div className={cn(
                  "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm",
                  filters.hyperliquidOnly ? "translate-x-4" : "translate-x-0"
                )} />
              </div>
              <input 
                type="checkbox"
                className="hidden"
                checked={filters.hyperliquidOnly}
                onChange={(e) => setFilters({ ...filters, hyperliquidOnly: e.target.checked })}
              />
              <span className="text-sm font-medium text-gray-700">Hyperliquid Only</span>
            </label>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-gray-200">
        <button
          onClick={onExport}
          disabled={!hasSelectedPairs}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors shadow-sm",
            hasSelectedPairs 
              ? "bg-[#2962FF] text-white hover:bg-blue-700" 
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
        >
          <Download className="w-4 h-4" />
          Export Selected CSV
        </button>
      </div>
    </div>
  );
}
