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
      <section id="stratejiler" className="bg-white dark:bg-[#111118] border border-zinc-200 dark:border-zinc-800/90 rounded-xl p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Strateji karşılaştırmasını görmek için yukarıdan en az bir aktif borç kalemi girin.
      </section>
    );
  }

  return (
    <section id="stratejiler" className="bg-white dark:bg-[#111118] border border-zinc-200 dark:border-zinc-800/90 rounded-xl p-4 sm:p-6 space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-950 dark:text-white tracking-tight">
            Borç Kapatma Stratejileri Karşılaştırması
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            5 farklı yöntem aynı borç ve aylık bütçe ({formatCurrencyTR(comparison.monthlyBudget)}) verilerinizle hesaplanır. Size uygun olanı seçebilirsiniz.
          </p>
        </div>

        <button
          type="button"
          onClick={onSavePlan}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 dark:text-zinc-950 dark:bg-white dark:hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer min-h-[40px] shrink-0"
        >
          <BookmarkPlus className="w-4 h-4 text-violet-400 dark:text-violet-700" />
          <span>Bu Planı Kaydet</span>
        </button>
      </div>

      {/* Custom Priority Editor */}
      {selectedStrategy === 'custom' && orderedCustomDebts.length > 1 && (
        <div className="bg-zinc-50 dark:bg-[#09090e] border border-violet-300 dark:border-violet-500/30 rounded-lg p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h3 className="text-xs sm:text-sm font-semibold text-zinc-950 dark:text-white">
              Özel Plan Öncelik Sırası (Önce Kapatılacak Borç En Üstte)
            </h3>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Asgari ödemeler karşılandıktan sonra kalan bütçe üstteki borca aktarılır.
            </span>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-[#111118] border border-zinc-200 dark:border-zinc-800 rounded-md">
            {orderedCustomDebts.map((debt, index) => (
              <div key={debt.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-5 h-5 rounded bg-violet-100 dark:bg-violet-600/20 text-violet-700 dark:text-violet-300 font-mono text-xs font-semibold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="font-medium text-zinc-950 dark:text-white truncate">{debt.name}</span>
                  <span className="text-zinc-500 dark:text-zinc-400 font-mono tabular-nums shrink-0">
                    {formatCurrencyTR(debt.balance)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => movePriority(debt.id, -1)}
                    className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
                    title="Yukarı taşı"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={index === orderedCustomDebts.length - 1}
                    onClick={() => movePriority(debt.id, 1)}
                    className="p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
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
                  ? 'border-violet-600 dark:border-violet-500 bg-violet-50/70 dark:bg-[#171326] ring-1 ring-violet-600 dark:ring-violet-500'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-[#0b0b12] hover:border-zinc-400 dark:hover:border-zinc-600'
              }`}
            >
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{item.shortLabel}</h3>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                        <Check className="w-3.5 h-3.5" /> Seçili
                      </span>
                    )}
                  </div>
                  {(isLowestCost || isFastest) && (
                    <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-400 mt-0.5">
                      {[
                        isLowestCost ? 'En Düşük Toplam Faiz' : null,
                        isFastest ? 'En Kısa Süre' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
                </div>

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                  <span className="text-[11px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold">
                    Tahmini Bitiş
                  </span>
                  {item.isPayable ? (
                    <div className="mt-0.5">
                      <span className="text-xl font-bold text-zinc-950 dark:text-white font-mono tabular-nums">
                        {item.monthsToPayoff} Ay
                      </span>
                      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-0.5">
                        {item.estimatedPayoffDate}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-0.5 flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <AlertCircle className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                      <span className="text-xs font-semibold">{item.estimatedPayoffDate}</span>
                    </div>
                  )}
                </div>

                <dl className="space-y-1.5 text-xs pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">İlk Ay Ödeme</dt>
                    <dd className="font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {formatCurrencyTR(item.firstMonthPayment)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">Ort. Aylık</dt>
                    <dd className="font-mono font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {formatCurrencyTR(item.averageMonthlyPayment)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">Toplam Faiz+Vergi</dt>
                    <dd className="font-mono font-semibold text-violet-700 dark:text-violet-300 tabular-nums">
                      {formatCurrencyTR(item.totalInterestAndTaxes)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-zinc-500 dark:text-zinc-400">Toplam Ödeme</dt>
                    <dd className="font-mono font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {formatCurrencyTR(item.totalPaid)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800/80">
                    <dt className="text-zinc-500 dark:text-zinc-400">Faiz Tasarrufu</dt>
                    <dd className={`font-mono font-bold tabular-nums ${
                      item.interestSavedVsMinimum > 0 ? 'text-violet-700 dark:text-violet-300' : 'text-zinc-400 dark:text-zinc-500'
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
