import React from 'react';
import { ArrowUp, ArrowDown, BookmarkPlus, Check, AlertCircle } from 'lucide-react';
import {
  AllStrategiesComparison,
  DebtItem,
  StrategyType,
} from '../types/finance';
import { formatCurrencyTR } from '../engine/turkeyMath';

interface StrategyComparisonViewProps {
  comparison: AllStrategiesComparison;
  selectedStrategy: StrategyType;
  onSelectStrategy: (st: StrategyType) => void;
  debts: DebtItem[];
  customPriorityOrder: string[];
  onChangeCustomPriority: (nextOrder: string[]) => void;
  onSavePlan: () => void;
}

const STRATEGY_ORDER: StrategyType[] = [
  'minimum',
  'fast_budget',
  'snowball',
  'avalanche',
  'custom',
];

export const StrategyComparisonView: React.FC<StrategyComparisonViewProps> = ({
  comparison,
  selectedStrategy,
  onSelectStrategy,
  debts,
  customPriorityOrder,
  onChangeCustomPriority,
  onSavePlan,
}) => {
  const activeDebts = debts.filter((d) => !d.isPaidOff && d.balance > 0);
  const orderedCustomDebts = [...activeDebts].sort((a, b) => {
    const idxA = customPriorityOrder.indexOf(a.id);
    const idxB = customPriorityOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const movePriority = (debtId: string, direction: -1 | 1) => {
    const ids = orderedCustomDebts.map((d) => d.id);
    const idx = ids.indexOf(debtId);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= ids.length) return;
    const copy = [...ids];
    [copy[idx], copy[targetIdx]] = [copy[targetIdx], copy[idx]];
    onChangeCustomPriority(copy);
  };

  if (comparison.totalDebt <= 0) {
    return (
      <section id="stratejiler" className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
        Strateji karşılaştırmasını görmek için yukarıdan en az bir aktif borç kalemi girin.
      </section>
    );
  }

  return (
    <section id="stratejiler" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Borç Kapatma Stratejileri Karşılaştırması
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            5 farklı yöntem aynı borç ve aylık bütçe ({formatCurrencyTR(comparison.monthlyBudget)}) verilerinizle hesaplanır. Size uygun olanı seçebilirsiniz.
          </p>
        </div>

        <button
          type="button"
          onClick={onSavePlan}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer min-h-[40px] shrink-0"
        >
          <BookmarkPlus className="w-4 h-4 text-slate-600" />
          <span>Bu Planı Kaydet</span>
        </button>
      </div>

      {/* Custom Priority Editor (shown when custom strategy is active) */}
      {selectedStrategy === 'custom' && orderedCustomDebts.length > 1 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
              Özel Plan Öncelik Sırası (Önce Kapatılacak Borç En Üstte)
            </h3>
            <span className="text-xs text-slate-500">
              Asgari ödemeler karşılandıktan sonra kalan bütçe üstteki borca aktarılır.
            </span>
          </div>
          <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-md">
            {orderedCustomDebts.map((debt, index) => (
              <div key={debt.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="font-medium text-slate-900 truncate">{debt.name}</span>
                  <span className="text-slate-500 font-mono tabular-nums shrink-0">
                    {formatCurrencyTR(debt.balance)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => movePriority(debt.id, -1)}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                    title="Yukarı taşı"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === orderedCustomDebts.length - 1}
                    onClick={() => movePriority(debt.id, 1)}
                    className="p-1.5 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                    title="Aşağı taşı"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {STRATEGY_ORDER.map((st) => {
          const item = comparison.strategies[st];
          const isSelected = selectedStrategy === st;
          const isLowestCost = comparison.lowestCostStrategy === st;
          const isFastest = comparison.fastestStrategy === st;

          return (
            <div
              key={st}
              onClick={() => onSelectStrategy(st)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectStrategy(st);
                }
              }}
              className={`rounded-xl border p-4 flex flex-col justify-between transition-all cursor-pointer text-left ${
                isSelected
                  ? 'border-slate-900 bg-slate-50/70 ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-3">
                {/* Title & Highlights (plain inline typography, no pill spam) */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">{item.shortLabel}</h3>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900">
                        <Check className="w-3.5 h-3.5" /> Seçili
                      </span>
                    )}
                  </div>
                  {(isLowestCost || isFastest) && (
                    <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                      {[
                        isLowestCost ? 'En Düşük Toplam Faiz' : null,
                        isFastest ? 'En Kısa Süre' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                </div>

                {/* Primary Hero Stat */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Tahmini Bitiş
                  </span>
                  {item.isPayable ? (
                    <div className="mt-0.5">
                      <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                        {item.monthsToPayoff} Ay
                      </span>
                      <span className="block text-xs font-medium text-slate-600 mt-0.5">
                        {item.estimatedPayoffDate}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-0.5 flex items-center gap-1.5 text-rose-700">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="text-xs font-semibold">{item.estimatedPayoffDate}</span>
                    </div>
                  )}
                </div>

                {/* Key Financial Figures */}
                <dl className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">İlk Ay Ödeme</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrencyTR(item.firstMonthPayment)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Ort. Aylık</dt>
                    <dd className="font-mono font-medium text-slate-700 tabular-nums">
                      {formatCurrencyTR(item.averageMonthlyPayment)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Toplam Faiz+Vergi</dt>
                    <dd className="font-mono font-semibold text-amber-700 tabular-nums">
                      {formatCurrencyTR(item.totalInterestAndTaxes)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-500">Toplam Ödeme</dt>
                    <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatCurrencyTR(item.totalPaid)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <dt className="text-slate-500">Faiz Tasarrufu</dt>
                    <dd className={`font-mono font-bold tabular-nums ${
                      item.interestSavedVsMinimum > 0 ? 'text-emerald-700' : 'text-slate-400'
                    }`}>
                      {item.interestSavedVsMinimum > 0
                        ? `${formatCurrencyTR(item.interestSavedVsMinimum)}`
                        : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
