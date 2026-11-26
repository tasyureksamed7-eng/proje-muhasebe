import React, { useState } from 'react';
import {
  AllStrategiesComparison,
  StrategyResult,
  StrategyType,
} from '../types/finance';
import { formatCurrencyTR } from '../engine/turkeyMath';

interface ChartsDashboardProps {
  comparison: AllStrategiesComparison;
  activeResult: StrategyResult;
}

export const ChartsDashboard: React.FC<ChartsDashboardProps> = ({
  comparison,
  activeResult,
}) => {
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);

  if (comparison.totalDebt <= 0 || activeResult.schedule.length === 0) {
    return null;
  }

  const schedule = activeResult.schedule;
  const minSchedule = comparison.strategies.minimum.schedule;
  const maxMonths = Math.max(schedule.length, minSchedule.length, 1);

  // Chart 1: Debt reduction over months (Active vs Minimum)
  const W = 560;
  const H = 200;
  const PAD_L = 56;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const maxBal = Math.max(
    comparison.totalDebt,
    ...schedule.map((r) => Math.max(r.startBalance, r.endBalance)),
    ...minSchedule.map((r) => Math.max(r.startBalance, r.endBalance)),
    1
  );

  const buildPolyline = (rows: typeof schedule, totalCount: number) => {
    if (rows.length === 0) return '';
    const pts = [
      `0,${comparison.totalDebt}`,
      ...rows.map((r) => `${r.month},${r.endBalance}`),
    ];
    return pts
      .map((pair) => {
        const [mStr, vStr] = pair.split(',');
        const x = PAD_L + (Number(mStr) / Math.max(1, totalCount)) * innerW;
        const y = PAD_T + innerH - (Number(vStr) / maxBal) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const activeLinePoints = buildPolyline(schedule, schedule.length);
  const minLinePoints = buildPolyline(minSchedule.slice(0, Math.max(schedule.length * 2, 24)), Math.max(schedule.length, Math.min(minSchedule.length, Math.max(schedule.length * 2, 24))));

  // Chart 2: Sampled Principal vs Interest+Tax bars (up to 18 bars evenly sampled)
  const barSample = schedule.length <= 18
    ? schedule
    : schedule.filter((_, idx) => idx % Math.ceil(schedule.length / 18) === 0 || idx === schedule.length - 1);
  const maxBarPay = Math.max(...barSample.map((r) => r.principalPaid + r.totalFinanceCharge), 1);

  // Chart 3: Per-debt payoff timeline
  const maxPayoffMonth = Math.max(
    ...activeResult.debtPayoffOrder.map((d) => d.payoffMonth || activeResult.monthsToPayoff),
    1
  );

  // Chart 4: Planned vs Actual
  const trackedMonths = schedule.filter((r) => r.actualPayment !== null || r.isPaid || r.isSkipped);
  const comparisonWindow = trackedMonths.length > 0 ? schedule.slice(0, Math.min(schedule.length, Math.max(6, trackedMonths[trackedMonths.length - 1].month + 2))) : schedule.slice(0, 6);
  const maxCompVal = Math.max(
    ...comparisonWindow.map((r) => Math.max(r.plannedPayment, r.actualPayment ?? 0)),
    1
  );

  // Chart 5: Strategy total interest comparison
  const strategyList = (['minimum', 'fast_budget', 'snowball', 'avalanche', 'custom'] as StrategyType[]).map(
    (st) => comparison.strategies[st]
  );
  const maxStrategyInterest = Math.max(
    ...strategyList.map((s) => s.totalInterestAndTaxes),
    1
  );

  const hoveredRow = hoveredMonthIdx !== null ? schedule[hoveredMonthIdx] : null;

  return (
    <section id="grafikler" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          Görsel Borç ve Tasarruf Analizi
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Seçili strateji ({activeResult.label}) ve diğer yöntemlerin grafiksel görünümü
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Borç Azalış Eğrisi */}
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">1. Aylara Göre Borç Azalış Eğrisi</h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-slate-900 inline-block" /> {activeResult.shortLabel}
              </span>
              {activeResult.strategy !== 'minimum' && (
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-0.5 bg-amber-500 inline-block" /> Asgari Ödeme
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
              {/* Grid lines */}
              {[0, 0.5, 1].map((frac) => {
                const y = PAD_T + innerH * (1 - frac);
                const val = maxBal * frac;
                return (
                  <g key={frac}>
                    <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                    <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b" className="font-mono">
                      {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
                    </text>
                  </g>
                );
              })}

              {/* Minimum reference curve */}
              {activeResult.strategy !== 'minimum' && minLinePoints && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  points={minLinePoints}
                />
              )}

              {/* Active strategy curve */}
              {activeLinePoints && (
                <polyline
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  points={activeLinePoints}
                />
              )}

              {/* Interactive points */}
              {schedule.map((row, idx) => {
                const x = PAD_L + (row.month / Math.max(1, schedule.length)) * innerW;
                const y = PAD_T + innerH - (row.endBalance / maxBal) * innerH;
                return (
                  <circle
                    key={row.month}
                    cx={x}
                    cy={y}
                    r={hoveredMonthIdx === idx ? 5 : 2.5}
                    fill={hoveredMonthIdx === idx ? '#0f172a' : '#475569'}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredMonthIdx(idx)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                  />
                );
              })}

              {/* X labels */}
              <text x={PAD_L} y={H - 6} fontSize="10" fill="#64748b">
                Başlangıç
              </text>
              <text x={W - PAD_R} y={H - 6} textAnchor="end" fontSize="10" fill="#64748b">
                {schedule.length}. Ay ({schedule[schedule.length - 1]?.monthLabel})
              </text>
            </svg>

            {hoveredRow && (
              <div className="mt-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs flex flex-wrap items-center justify-between gap-2 tabular-nums">
                <span className="font-semibold text-slate-900">
                  {hoveredRow.month}. Ay ({hoveredRow.monthLabel})
                </span>
                <span className="text-slate-600">
                  Kalan Borç: <strong className="text-slate-900">{formatCurrencyTR(hoveredRow.endBalance)}</strong>
                </span>
                <span className="text-slate-600">
                  Faiz+Vergi: <strong className="text-amber-700">{formatCurrencyTR(hoveredRow.totalFinanceCharge)}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Anapara vs Faiz+Vergi Dağılımı */}
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">2. Anapara ve Faiz+Vergi Dağılımı</h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-800 inline-block" /> Anapara
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Faiz+BSMV+KKDF
              </span>
            </div>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            {barSample.map((row, idx) => {
              const slotW = innerW / Math.max(1, barSample.length);
              const barW = Math.max(6, Math.min(24, slotW * 0.65));
              const x = PAD_L + idx * slotW + (slotW - barW) / 2;
              const prinH = (row.principalPaid / maxBarPay) * innerH;
              const intH = (row.totalFinanceCharge / maxBarPay) * innerH;
              const yInt = PAD_T + innerH - intH;
              const yPrin = yInt - prinH;
              return (
                <g key={row.month}>
                  <rect x={x} y={yPrin} width={barW} height={Math.max(0, prinH)} fill="#1e293b" rx="1.5" />
                  <rect x={x} y={yInt} width={barW} height={Math.max(0, intH)} fill="#f59e0b" rx="1.5" />
                  {(barSample.length <= 12 || idx % 2 === 0) && (
                    <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="9.5" fill="#64748b">
                      {row.month}.A
                    </text>
                  )}
                </g>
              );
            })}
            <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="#cbd5e1" />
          </svg>

          <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100 tabular-nums">
            <span>
              Toplam Anapara: <strong className="text-slate-900">{formatCurrencyTR(activeResult.totalPrincipal)}</strong>
            </span>
            <span>
              Toplam Faiz+Vergi: <strong className="text-amber-700">{formatCurrencyTR(activeResult.totalInterestAndTaxes)}</strong>
            </span>
          </div>
        </div>

        {/* 3. Her Borcun Kapanış Süreci */}
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">3. Borç Bazlı Kapanış Sırası ve Süresi</h3>
          <div className="space-y-3 pt-1">
            {activeResult.debtPayoffOrder.map((item) => {
              const pct = item.payoffMonth > 0
                ? Math.max(8, Math.round((item.payoffMonth / maxPayoffMonth) * 100))
                : 100;
              return (
                <div key={item.debtId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium text-slate-800 truncate">{item.debtName}</span>
                    <span className="font-mono tabular-nums text-slate-600 shrink-0">
                      {item.payoffMonth > 0
                        ? `${item.payoffMonth}. Ay (${item.payoffDate}) · Maliyet: ${formatCurrencyTR(item.totalInterestAndTaxPaid)}`
                        : 'Kapanmadı'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.payoffMonth > 0 ? 'bg-slate-800' : 'bg-rose-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Planlanan vs Gerçekleşen Ödeme Karşılaştırması */}
        <div className="border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">4. Planlanan vs. Gerçekleşen Ödeme</h3>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 inline-block" /> Planlanan
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" /> Gerçekleşen
              </span>
            </div>
          </div>

          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
            {comparisonWindow.map((row, idx) => {
              const slotW = innerW / Math.max(1, comparisonWindow.length);
              const singleW = Math.max(8, Math.min(18, slotW * 0.32));
              const centerX = PAD_L + idx * slotW + slotW / 2;
              const pH = (row.plannedPayment / maxCompVal) * innerH;
              const aVal = row.actualPayment ?? 0;
              const aH = (aVal / maxCompVal) * innerH;
              return (
                <g key={row.month}>
                  <rect
                    x={centerX - singleW - 1}
                    y={PAD_T + innerH - pH}
                    width={singleW}
                    height={Math.max(1, pH)}
                    fill="#cbd5e1"
                    rx="1.5"
                  />
                  <rect
                    x={centerX + 1}
                    y={PAD_T + innerH - aH}
                    width={singleW}
                    height={row.actualPayment !== null ? Math.max(2, aH) : 0}
                    fill={row.isSkipped ? '#e11d48' : '#059669'}
                    rx="1.5"
                  />
                  <text x={centerX} y={H - 6} textAnchor="middle" fontSize="10" fill="#64748b">
                    {row.monthLabel}
                  </text>
                </g>
              );
            })}
            <line x1={PAD_L} y1={PAD_T + innerH} x2={W - PAD_R} y2={PAD_T + innerH} stroke="#cbd5e1" />
          </svg>
          <p className="text-xs text-slate-500">
            {trackedMonths.length === 0
              ? 'Aylık takip tablosundan ödeme girdikçe yeşil çubuklar planlanan ödemeyle yan yana güncellenir.'
              : `${trackedMonths.length} ay için gerçekleşen ödeme kaydı karşılaştırılıyor.`}
          </p>
        </div>

        {/* 5. Stratejilere Göre Toplam Faiz Yükü ve Tasarruf */}
        <div className="lg:col-span-2 border border-slate-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">
            5. Stratejilere Göre Toplam Faiz + Vergi Maliyeti Karşılaştırması
          </h3>
          <div className="space-y-2.5">
            {strategyList.map((s) => {
              const pct = Math.max(4, Math.round((s.totalInterestAndTaxes / maxStrategyInterest) * 100));
              const isActive = s.strategy === activeResult.strategy;
              return (
                <div key={s.strategy} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2 text-xs">
                  <div className="sm:col-span-3 font-medium text-slate-800 flex items-center gap-1.5">
                    <span>{s.shortLabel}</span>
                    {isActive && <span className="text-[11px] font-semibold text-slate-500">(Seçili)</span>}
                  </div>
                  <div className="sm:col-span-6">
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isActive
                            ? 'bg-slate-900'
                            : s.strategy === 'minimum'
                              ? 'bg-amber-500'
                              : 'bg-slate-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-3 sm:text-right font-mono tabular-nums text-slate-700">
                    <strong>{formatCurrencyTR(s.totalInterestAndTaxes)}</strong>
                    {s.interestSavedVsMinimum > 0 && (
                      <span className="text-emerald-700 ml-1.5">
                        (-{formatCurrencyTR(s.interestSavedVsMinimum)})
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
