import React, { useState } from 'react';
import {
  Check,
  XCircle,
  RotateCcw,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ActualMonthLog,
  AllStrategiesComparison,
  DebtItem,
  MonthlyLedgerRow,
  StrategyResult,
} from '../types/finance';
import { formatCurrencyTR } from '../engine/turkeyMath';
import { exportStrategyToCsv, exportTurkishPdfReport, PdfReportType } from '../utils/exporters';

interface MonthlyTrackerProps {
  profileName: string;
  comparison: AllStrategiesComparison;
  activeResult: StrategyResult;
  debts: DebtItem[];
  actualLogs: Record<number, ActualMonthLog>;
  onUpdateActualLog: (month: number, log: ActualMonthLog | null) => void;
}

type FilterMode = 'all' | 'paid' | 'pending' | 'overdue';

export const MonthlyTracker: React.FC<MonthlyTrackerProps> = ({
  profileName,
  comparison,
  activeResult,
  debts,
  actualLogs,
  onUpdateActualLog,
}) => {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editAmountDraft, setEditAmountDraft] = useState<string>('');
  const [pdfType, setPdfType] = useState<PdfReportType>('full');

  if (comparison.totalDebt <= 0 || activeResult.schedule.length === 0) {
    return null;
  }

  const schedule = activeResult.schedule;
  const filteredRows = schedule.filter((row) => {
    if (filter === 'paid') return row.isPaid;
    if (filter === 'pending') return !row.isPaid && !row.isSkipped;
    if (filter === 'overdue') return row.isSkipped || row.isOverdueMonth;
    return true;
  });

  const paidCount = schedule.filter((r) => r.isPaid).length;
  const totalActualPaid = schedule.reduce((s, r) => s + (r.actualPayment ?? 0), 0);

  const startEdit = (row: MonthlyLedgerRow) => {
    setEditingMonth(row.month);
    const seed = row.actualPayment !== null ? row.actualPayment : row.plannedPayment;
    setEditAmountDraft(String(Math.round(seed)));
  };

  const commitEdit = (row: MonthlyLedgerRow) => {
    const val = parseFloat(editAmountDraft.replace(',', '.'));
    if (Number.isNaN(val) || val < 0) {
      setEditingMonth(null);
      return;
    }
    onUpdateActualLog(row.month, {
      month: row.month,
      isPaid: val > 0,
      isSkipped: val === 0,
      actualAmount: val,
      paidDate: new Date().toISOString().slice(0, 10),
    });
    setEditingMonth(null);
  };

  const markPaidPlanned = (row: MonthlyLedgerRow) => {
    onUpdateActualLog(row.month, {
      month: row.month,
      isPaid: true,
      isSkipped: false,
      actualAmount: row.plannedPayment,
      paidDate: new Date().toISOString().slice(0, 10),
    });
  };

  const markSkipped = (row: MonthlyLedgerRow) => {
    onUpdateActualLog(row.month, {
      month: row.month,
      isPaid: false,
      isSkipped: true,
      actualAmount: 0,
    });
  };

  return (
    <section id="takip" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5">
      {/* Header & Export Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Aylık Ödeme ve Gerçekleşen Takip Tablosu
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 tabular-nums">
            {activeResult.label} · {paidCount}/{schedule.length} ay ödendi (Gerçekleşen: {formatCurrencyTR(totalActualPaid)}) · Değişiklikler kalan ayları otomatik günceller.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportStrategyToCsv(comparison, activeResult, debts)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer min-h-[38px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV İndir</span>
          </button>

          <div className="inline-flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <select
              value={pdfType}
              onChange={(e) => setPdfType(e.target.value as PdfReportType)}
              aria-label="PDF Rapor Türü"
              className="px-2.5 py-2 text-xs text-slate-700 bg-slate-50 border-r border-slate-200 focus:outline-none min-h-[38px]"
            >
              <option value="full">Tam Rapor (PDF)</option>
              <option value="status">Borç Durum Raporu</option>
              <option value="schedule">Aylık Ödeme Planı</option>
              <option value="comparison">Faiz Karşılaştırması</option>
              <option value="actuals">Borç & Gerçekleşenler</option>
            </select>
            <button
              type="button"
              onClick={() =>
                exportTurkishPdfReport({
                  reportType: pdfType,
                  profileName,
                  comparison,
                  activeResult,
                  debts,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer min-h-[38px]"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF İndir</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: `Tümü (${schedule.length})` },
            { id: 'paid', label: `Ödenenler (${paidCount})` },
            { id: 'pending', label: `Bekleyenler (${schedule.filter((r) => !r.isPaid && !r.isSkipped).length})` },
            { id: 'overdue', label: `Eksik / Geciken (${schedule.filter((r) => r.isSkipped || r.isOverdueMonth).length})` },
          ] as { id: FilterMode; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer min-h-[34px] ${
              filter === tab.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile Card List (sm:hidden) */}
      <div className="space-y-2.5 md:hidden">
        {filteredRows.map((row) => {
          const isEditing = editingMonth === row.month;
          const isExpanded = expandedMonth === row.month;
          const hasOverride = Boolean(actualLogs[row.month]);

          return (
            <div key={row.month} className="border border-slate-200 rounded-lg p-3.5 space-y-2.5 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-slate-900">
                    {row.month}. Ay · {row.monthLabel}
                  </span>
                  <span className={`block text-xs font-medium mt-0.5 ${
                    row.isSkipped
                      ? 'text-rose-600'
                      : row.isPaid
                        ? 'text-emerald-700'
                        : row.isOverdueMonth
                          ? 'text-amber-700'
                          : 'text-slate-500'
                  }`}>
                    {row.isSkipped
                      ? 'Ödeme Atlandı (Gecikme İşledi)'
                      : row.isPaid
                        ? 'Ödendi'
                        : row.isOverdueMonth
                          ? 'Asgari Altı (Gecikme Riski)'
                          : 'Planlandı'}
                  </span>
                </div>
                <span className="text-right font-mono tabular-nums">
                  <span className="block text-xs text-slate-400">Kalan Borç</span>
                  <strong className="text-sm text-slate-900">{formatCurrencyTR(row.endBalance)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100 tabular-nums">
                <div>
                  <span className="text-slate-400 block">Planlanan</span>
                  <strong className="font-mono text-slate-800">{formatCurrencyTR(row.plannedPayment)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Anapara</span>
                  <strong className="font-mono text-slate-800">{formatCurrencyTR(row.principalPaid)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Faiz+Vergi</span>
                  <strong className="font-mono text-amber-700">{formatCurrencyTR(row.totalFinanceCharge)}</strong>
                </div>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="number"
                    value={editAmountDraft}
                    onChange={(e) => setEditAmountDraft(e.target.value)}
                    className="flex-1 px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-md min-h-[40px]"
                  />
                  <button
                    type="button"
                    onClick={() => commitEdit(row)}
                    className="px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md min-h-[40px]"
                  >
                    Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMonth(null)}
                    className="px-2.5 py-2 text-xs text-slate-600 border border-slate-200 rounded-md min-h-[40px]"
                  >
                    İptal
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => markPaidPlanned(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md min-h-[36px]"
                  >
                    <Check className="w-3.5 h-3.5" /> Ödendi
                  </button>
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 text-slate-700 border border-slate-200 rounded-md min-h-[36px]"
                  >
                    {row.actualPayment !== null ? `Gerçek: ${formatCurrencyTR(row.actualPayment)}` : 'Tutar Gir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => markSkipped(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md min-h-[36px]"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Ödenmedi
                  </button>
                  {hasOverride && (
                    <button
                      type="button"
                      onClick={() => onUpdateActualLog(row.month, null)}
                      className="p-1.5 text-slate-500 border border-slate-200 rounded-md min-h-[36px]"
                      title="Kaydı temizle"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setExpandedMonth(isExpanded ? null : row.month)}
                    className="ml-auto text-xs text-slate-600 underline"
                  >
                    {isExpanded ? 'Gizle' : 'Borç Dağılımı'}
                  </button>
                </div>
              )}

              {isExpanded && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  {row.debtBreakdowns.map((b) => (
                    <div key={b.debtId} className="flex items-center justify-between text-slate-600 tabular-nums">
                      <span className="truncate pr-2 font-medium text-slate-800">{b.debtName}</span>
                      <span className="font-mono">
                        Ödeme {formatCurrencyTR(b.plannedPayment)} → Kalan {formatCurrencyTR(b.endBalance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Ledger Table (hidden on mobile) */}
      <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
              <th className="py-2.5 px-3 font-semibold">Dönem</th>
              <th className="py-2.5 px-3 font-semibold text-right">Dönem Başı</th>
              <th className="py-2.5 px-3 font-semibold text-right">Planlanan</th>
              <th className="py-2.5 px-3 font-semibold text-right">Gerçekleşen</th>
              <th className="py-2.5 px-3 font-semibold text-right">Anapara</th>
              <th className="py-2.5 px-3 font-semibold text-right">Faiz + BSMV + KKDF</th>
              <th className="py-2.5 px-3 font-semibold text-right">Kalan Borç</th>
              <th className="py-2.5 px-3 font-semibold text-right">İşlemler</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredRows.map((row) => {
              const isEditing = editingMonth === row.month;
              const isExpanded = expandedMonth === row.month;
              const hasOverride = Boolean(actualLogs[row.month]);

              return (
                <React.Fragment key={row.month}>
                  <tr className={`${row.isPaid ? 'bg-emerald-50/30' : row.isSkipped ? 'bg-rose-50/30' : 'hover:bg-slate-50/60'}`}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setExpandedMonth(isExpanded ? null : row.month)}
                        className="inline-flex items-center gap-1 font-medium text-slate-900 cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        <span className="font-mono">{row.month}.</span>
                        <span>{row.monthLabel}</span>
                      </button>
                      {row.extraPayment > 0 && (
                        <span className="block text-[11px] text-emerald-700 font-mono tabular-nums pl-5">
                          +{formatCurrencyTR(row.extraPayment)} ara/ek ödeme
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrencyTR(row.startBalance)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium text-slate-800">
                      {formatCurrencyTR(row.plannedPayment)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1 justify-end">
                          <input
                            type="number"
                            value={editAmountDraft}
                            onChange={(e) => setEditAmountDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(row);
                              if (e.key === 'Escape') setEditingMonth(null);
                            }}
                            autoFocus
                            className="w-24 px-2 py-1 text-right text-xs font-mono border border-slate-400 rounded"
                          />
                          <button
                            type="button"
                            onClick={() => commitEdit(row)}
                            className="px-2 py-1 text-[11px] bg-slate-900 text-white rounded cursor-pointer"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className={`hover:underline cursor-pointer ${
                            row.actualPayment !== null ? 'font-semibold text-emerald-700' : 'text-slate-400'
                          }`}
                          title="Gerçekleşen ödeme tutarını düzenle"
                        >
                          {row.actualPayment !== null ? formatCurrencyTR(row.actualPayment) : 'Tutar Gir'}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                      {formatCurrencyTR(row.principalPaid)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700">
                      {formatCurrencyTR(row.totalFinanceCharge)}
                      {row.overdueInterest > 0 && (
                        <span className="block text-[10px] text-rose-600">
                          Gecikme: {formatCurrencyTR(row.overdueInterest)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyTR(row.endBalance)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => markPaidPlanned(row)}
                          title="Planlanan tutarı ödenmiş say"
                          className={`p-1.5 rounded border cursor-pointer ${
                            row.isPaid
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => markSkipped(row)}
                          title="Bu ay ödeme yapılmadı olarak işaretle"
                          className={`p-1.5 rounded border cursor-pointer ${
                            row.isSkipped
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                        {hasOverride && (
                          <button
                            type="button"
                            onClick={() => onUpdateActualLog(row.month, null)}
                            title="Ödeme kaydını sıfırla"
                            className="p-1.5 rounded border border-slate-200 bg-white text-slate-500 hover:text-slate-900 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-slate-50/80">
                      <td colSpan={8} className="p-3">
                        <div className="text-xs space-y-1.5">
                          <p className="font-semibold text-slate-700">
                            {row.month}. Ay ({row.monthLabel}) — Borç Kalemi Kırılımı
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {row.debtBreakdowns.map((b) => (
                              <div key={b.debtId} className="bg-white border border-slate-200 rounded p-2.5 tabular-nums">
                                <div className="flex items-center justify-between font-semibold text-slate-900">
                                  <span className="truncate">{b.debtName}</span>
                                  <span className="font-mono">{formatCurrencyTR(b.plannedPayment)}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                                  <span>Anapara: {formatCurrencyTR(b.principalPaid)}</span>
                                  <span>Faiz+Vergi: {formatCurrencyTR(b.interestAndTaxPaid)}</span>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5 flex justify-between">
                                  <span>BSMV+KKDF: {formatCurrencyTR(b.bsmv + b.kkdf)}</span>
                                  <span className="font-semibold">Kalan: {formatCurrencyTR(b.endBalance)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
