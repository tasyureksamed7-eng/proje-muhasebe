import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Check } from 'lucide-react';
import { ComparisonResult } from '../types/debt';
import { formatCurrency } from '../utils/calculator';

interface PayoffScheduleTableProps {
  result: ComparisonResult;
}

export const PayoffScheduleTable: React.FC<PayoffScheduleTableProps> = ({ result }) => {
  const [activePlan, setActivePlan] = useState<20 | 40>(40);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const plan = activePlan === 20 ? result.plan20 : result.plan40;
  const schedule = plan.monthlySchedule;

  const displayedSchedule = isExpanded ? schedule : schedule.slice(0, 6);

  const handleExportCsv = () => {
    const headers = 'Ay,Baslangic Borcu,Isleyen Faiz,Odenen Tutar,Anaparadan Dusen,Kalan Borc\n';
    const rows = schedule
      .map(
        (r) =>
          `${r.month},${r.startBalance},${r.interestCharged},${r.payment},${r.principalPaid},${r.endBalance}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `borc_odeme_plani_yol_${activePlan}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Aylık Ödeme ve Bakiye Takvimi
          </h3>
          <p className="text-xs text-gray-500">
            Her ay anaparadan düşen tutarı ve işleyen faizi inceleyin
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-lg text-xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActivePlan(20)}
              className={`py-1.5 px-3 rounded-md font-medium transition cursor-pointer ${
                activePlan === 20
                  ? 'bg-white text-gray-900 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              %20 Planı
            </button>
            <button
              type="button"
              onClick={() => setActivePlan(40)}
              className={`py-1.5 px-3 rounded-md font-medium transition cursor-pointer ${
                activePlan === 40
                  ? 'bg-white text-gray-900 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              %40 Planı
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 transition cursor-pointer"
            title="CSV olarak indir"
          >
            {isCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-gray-500" />
            )}
            CSV İndir
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-[11px] font-semibold bg-gray-50/70">
              <th className="py-2.5 px-3">Ay</th>
              <th className="py-2.5 px-3">Dönem Başı</th>
              <th className="py-2.5 px-3">İşleyen Faiz</th>
              <th className="py-2.5 px-3">Aylık Ödeme</th>
              <th className="py-2.5 px-3">Anapara İndirimi</th>
              <th className="py-2.5 px-3">Kalan Borç</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayedSchedule.map((row) => (
              <tr key={row.month} className="hover:bg-gray-50/60 transition">
                <td className="py-2.5 px-3 font-semibold text-gray-900">
                  {row.month}. Ay
                </td>
                <td className="py-2.5 px-3 font-mono text-gray-600">
                  {formatCurrency(row.startBalance)}
                </td>
                <td className="py-2.5 px-3 font-mono text-red-600">
                  +{formatCurrency(row.interestCharged)}
                </td>
                <td className="py-2.5 px-3 font-mono font-medium text-gray-900">
                  {formatCurrency(row.payment)}
                </td>
                <td className="py-2.5 px-3 font-mono text-emerald-700">
                  -{formatCurrency(row.principalPaid)}
                </td>
                <td className="py-2.5 px-3 font-mono font-semibold text-gray-900">
                  {row.endBalance === 0 ? (
                    <span className="text-emerald-700 font-bold">0 ₺ (Kapandı)</span>
                  ) : (
                    formatCurrency(row.endBalance)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand / Collapse */}
      {schedule.length > 6 && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-center">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 transition cursor-pointer"
          >
            {isExpanded ? (
              <>
                Daha Az Göster <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Tüm {schedule.length} Ayı Göster <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
