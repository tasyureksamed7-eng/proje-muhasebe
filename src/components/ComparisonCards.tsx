import React from 'react';
import {
  Calendar,
  PiggyBank,
  Percent,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { ComparisonResult } from '../types/debt';
import { formatCurrency } from '../utils/calculator';

interface ComparisonCardsProps {
  result: ComparisonResult;
}

export const ComparisonCards: React.FC<ComparisonCardsProps> = ({ result }) => {
  const { plan20, plan40, interestSaved, monthsSaved, savingsPercentage, income } = result;

  return (
    <div className="space-y-5">
      {/* Savings Banner */}
      {interestSaved > 0 && (
        <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-950">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-0.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              %40 Ödeme ile Net Kazanç
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">
              Toplam {formatCurrency(interestSaved)} Faiz Tasarrufu
            </h3>
            <p className="text-xs text-emerald-800/90 mt-0.5">
              Borcunuz <strong className="font-semibold text-emerald-900">{monthsSaved} ay daha erken</strong> biter ve faiz yükünüz <strong className="font-semibold text-emerald-900">%{savingsPercentage}</strong> azalır.
            </p>
          </div>

          <div className="bg-white/90 border border-emerald-200/80 px-4 py-2.5 rounded-lg text-right w-full sm:w-auto">
            <span className="block text-[11px] text-gray-500 font-medium">Faiz Kazancı:</span>
            <span className="text-lg font-bold text-emerald-700 font-mono">
              +{formatCurrency(interestSaved)}
            </span>
          </div>
        </div>
      )}

      {/* Dual Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Strategy 1: %20 Asgari Yol */}
        <div className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">1. Yol: Asgari Yol</h3>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-gray-100 text-gray-700 rounded-md border border-gray-200">
                    %20 Ödeme
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">En düşük aylık taksit, uzun vade</p>
              </div>
            </div>

            {/* Budget Warning */}
            {income > 0 && !plan20.isSustainable && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>İlk ay ödemesi bütçenizi ({formatCurrency(income)}) aşıyor!</span>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 my-4">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Bitiş Süresi
                </span>
                <span className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {plan20.monthsToPayoff} Ay
                </span>
                <span className="block text-[10px] text-gray-400">
                  ({(plan20.monthsToPayoff / 12).toFixed(1)} yıl)
                </span>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
                  <PiggyBank className="w-3.5 h-3.5 text-gray-400" />
                  İlk Ay Ödemesi
                </span>
                <span className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {formatCurrency(plan20.firstMonthPayment)}
                </span>
                {income > 0 && (
                  <span className="block text-[10px] text-gray-500">
                    Bütçenin %{plan20.incomeRatio}'si
                  </span>
                )}
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
                  <Percent className="w-3.5 h-3.5 text-gray-400" />
                  Toplam Faiz
                </span>
                <span className="text-base sm:text-lg font-bold text-red-600 font-mono">
                  {formatCurrency(plan20.totalInterest)}
                </span>
                <span className="block text-[10px] text-gray-400">Ekstra maliyet</span>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
                  <TrendingDown className="w-3.5 h-3.5 text-gray-400" />
                  Toplam Geri Ödeme
                </span>
                <span className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {formatCurrency(plan20.totalPaid)}
                </span>
                <span className="block text-[10px] text-gray-400">Anapara + Faiz</span>
              </div>
            </div>

            <p className="text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">
              Aylık ödemesi düşüktür ancak borç uzun sürede bittiği için toplamda <strong>{formatCurrency(plan20.totalInterest)}</strong> faiz ödenir.
            </p>
          </div>
        </div>

        {/* Strategy 2: %40 Hızlı Kurtuluş */}
        <div className="rounded-xl bg-white border-2 border-gray-900 p-5 shadow-sm flex flex-col justify-between relative">
          <div className="absolute -top-2.5 right-4">
            <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gray-900 text-white rounded-full">
              Önerilen Yol
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">2. Yol: Hızlı Kurtuluş</h3>
                  <span className="px-2 py-0.5 text-[11px] font-semibold bg-gray-900 text-white rounded-md">
                    %40 Ödeme
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Anaparayı hızla eritir, faizi keser</p>
              </div>
            </div>

            {/* Budget Warning */}
            {income > 0 && !plan40.isSustainable && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>İlk ay ödemesi bütçenizi aşıyor. %20 ile başlayıp kademeli artırabilirsiniz.</span>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 my-4">
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <span className="text-[11px] text-emerald-800 flex items-center gap-1 mb-0.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Bitiş Süresi
                </span>
                <span className="text-base sm:text-lg font-bold text-emerald-900 font-mono">
                  {plan40.monthsToPayoff} Ay
                </span>
                <span className="block text-[10px] text-emerald-700 font-medium">
                  {monthsSaved > 0 ? `${monthsSaved} ay daha erken!` : 'Hızlı kapanış'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
                  <PiggyBank className="w-3.5 h-3.5 text-gray-400" />
                  İlk Ay Ödemesi
                </span>
                <span className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {formatCurrency(plan40.firstMonthPayment)}
                </span>
                {income > 0 && (
                  <span className="block text-[10px] text-gray-500">
                    Bütçenin %{plan40.incomeRatio}'si
                  </span>
                )}
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
                  <Percent className="w-3.5 h-3.5 text-gray-400" />
                  Toplam Faiz
                </span>
                <span className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {formatCurrency(plan40.totalInterest)}
                </span>
                {interestSaved > 0 && (
                  <span className="block text-[10px] text-emerald-700 font-semibold">
                    %{savingsPercentage} daha az faiz
                  </span>
                )}
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[11px] text-gray-500 flex items-center gap-1 mb-0.5">
                  <TrendingDown className="w-3.5 h-3.5 text-gray-400" />
                  Toplam Geri Ödeme
                </span>
                <span className="text-base sm:text-lg font-bold text-gray-900 font-mono">
                  {formatCurrency(plan40.totalPaid)}
                </span>
                <span className="block text-[10px] text-gray-400">Anapara + Faiz</span>
              </div>
            </div>

            <p className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed">
              Borcu yarı yarıya daha kısa sürede bitirir ve toplamda <strong>{formatCurrency(interestSaved)}</strong> daha az faiz ödemenizi sağlar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
