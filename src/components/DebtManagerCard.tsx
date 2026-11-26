import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Landmark,
  CalendarPlus,
} from 'lucide-react';
import {
  CalculationMode,
  DebtItem,
  DebtType,
  ExtraPaymentEvent,
  RestructureConfig,
  RestructureResult,
  TariffPeriod,
} from '../types/finance';
import {
  DEBT_TYPE_META,
  TARIFF_METADATA,
  getPresetForDebt,
  getRegulatoryReferenceRows,
} from '../engine/turkeyRates';
import { formatCurrencyTR, getEffectiveMonthlyRatePercent } from '../engine/turkeyMath';

interface DebtManagerCardProps {
  monthlyBudget: number;
  setMonthlyBudget: (val: number) => void;
  tariffPeriod: TariffPeriod;
  onChangeTariffPeriod: (tariff: TariffPeriod) => void;
  calculationMode: CalculationMode;
  setCalculationMode: (mode: CalculationMode) => void;
  debts: DebtItem[];
  onAddDebt: (debt: DebtItem) => void;
  onUpdateDebt: (id: string, patch: Partial<DebtItem>) => void;
  onRemoveDebt: (id: string) => void;
  extraPayments: ExtraPaymentEvent[];
  onAddExtraPayment: (ev: ExtraPaymentEvent) => void;
  onRemoveExtraPayment: (id: string) => void;
  restructureConfig: RestructureConfig;
  onUpdateRestructure: (patch: Partial<RestructureConfig>) => void;
  restructureResult: RestructureResult | null;
  totalDebt: number;
  minimumRequiredFirstMonth: number;
  budgetShortfallFirstMonth: number;
}

const DEBT_TYPE_OPTIONS: DebtType[] = [
  'credit_card',
  'consumer_loan',
  'installment_loan',
  'kmh',
  'cash_advance',
  'overdue',
  'other',
];

export const DebtManagerCard: React.FC<DebtManagerCardProps> = ({
  monthlyBudget,
  setMonthlyBudget,
  tariffPeriod,
  onChangeTariffPeriod,
  calculationMode,
  setCalculationMode,
  debts,
  onAddDebt,
  onUpdateDebt,
  onRemoveDebt,
  extraPayments,
  onAddExtraPayment,
  onRemoveExtraPayment,
  restructureConfig,
  onUpdateRestructure,
  restructureResult,
  totalDebt,
  minimumRequiredFirstMonth,
  budgetShortfallFirstMonth,
}) => {
  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);
  const [showRateSources, setShowRateSources] = useState(false);
  const [showExtraPanel, setShowExtraPanel] = useState(false);
  const [showRestructurePanel, setShowRestructurePanel] = useState(false);

  // New debt draft
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<DebtType>('credit_card');
  const [newBalance, setNewBalance] = useState('');
  const [newLimit, setNewLimit] = useState('');

  // Extra payment draft
  const [extraMonth, setExtraMonth] = useState('2');
  const [extraAmount, setExtraAmount] = useState('');
  const [extraTargetId, setExtraTargetId] = useState('');
  const [extraNote, setExtraNote] = useState('');

  const handleNumberInput = (raw: string, setter: (v: number) => void) => {
    const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.');
    if (cleaned === '') {
      setter(0);
      return;
    }
    const parsed = parseFloat(cleaned);
    if (!Number.isNaN(parsed)) {
      setter(Math.max(0, parsed));
    }
  };

  const handleCreateDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(newBalance.replace(',', '.')) || 0;
    if (bal <= 0) return;

    const lim = parseFloat(newLimit.replace(',', '.')) || undefined;
    const preset = getPresetForDebt(newType, bal, lim, tariffPeriod);
    const label = newName.trim() || `${DEBT_TYPE_META[newType].shortLabel} ${debts.length + 1}`;

    const newItem: DebtItem = {
      id: `debt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: label,
      type: newType,
      balance: bal,
      creditLimit: DEBT_TYPE_META[newType].supportsLimitTier ? lim : undefined,
      contractualRate: preset.contractualRate,
      overdueRate: preset.overdueRate,
      bsmvRate: preset.bsmvRate,
      kkdfRate: preset.kkdfRate,
      minPaymentRate: preset.minPaymentRate,
      dueDay: 15,
      isOverdue: newType === 'overdue',
      overdueDays: newType === 'overdue' ? 15 : 0,
      remainingInstallments: DEBT_TYPE_META[newType].supportsInstallments ? 12 : undefined,
      rateSource: preset.rateSource,
      rateUpdatedAt: preset.rateUpdatedAt,
      isManualRate: false,
    };

    onAddDebt(newItem);
    setNewName('');
    setNewBalance('');
    setNewLimit('');
  };

  const handleDebtTypeChange = (debt: DebtItem, nextType: DebtType) => {
    const preset = getPresetForDebt(nextType, debt.balance, debt.creditLimit, tariffPeriod);
    onUpdateDebt(debt.id, {
      type: nextType,
      contractualRate: preset.contractualRate,
      overdueRate: preset.overdueRate,
      bsmvRate: preset.bsmvRate,
      kkdfRate: preset.kkdfRate,
      minPaymentRate: preset.minPaymentRate,
      isOverdue: nextType === 'overdue' ? true : debt.isOverdue,
      overdueDays: nextType === 'overdue' ? Math.max(15, debt.overdueDays) : debt.overdueDays,
      remainingInstallments: DEBT_TYPE_META[nextType].supportsInstallments
        ? debt.remainingInstallments || 12
        : undefined,
      rateSource: preset.rateSource,
      rateUpdatedAt: preset.rateUpdatedAt,
      isManualRate: false,
    });
  };

  const handleApplyPresetToDebt = (debt: DebtItem) => {
    const preset = getPresetForDebt(debt.type, debt.balance, debt.creditLimit, tariffPeriod);
    onUpdateDebt(debt.id, {
      contractualRate: preset.contractualRate,
      overdueRate: preset.overdueRate,
      bsmvRate: preset.bsmvRate,
      kkdfRate: preset.kkdfRate,
      minPaymentRate: preset.minPaymentRate,
      rateSource: preset.rateSource,
      rateUpdatedAt: preset.rateUpdatedAt,
      isManualRate: false,
    });
  };

  const handleCreateExtra = (e: React.FormEvent) => {
    e.preventDefault();
    const m = Math.max(1, Math.round(Number(extraMonth) || 1));
    const amt = parseFloat(extraAmount.replace(',', '.')) || 0;
    if (amt <= 0) return;

    onAddExtraPayment({
      id: `extra-${Date.now()}`,
      month: m,
      amount: amt,
      targetDebtId: extraTargetId || undefined,
      note: extraNote.trim() || undefined,
    });
    setExtraAmount('');
    setExtraNote('');
  };

  const referenceRows = getRegulatoryReferenceRows(tariffPeriod);
  const tariffMeta = TARIFF_METADATA[tariffPeriod];

  return (
    <section id="borclar" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-6">
      {/* Header & Global Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Borç Kalemleri ve Aylık Ödeme Bütçesi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {tariffMeta.source} · Güncel Tarife: {tariffMeta.effectiveDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => onChangeTariffPeriod('nov_2026')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tariffPeriod === 'nov_2026'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kasım 2026 (%3,11)
            </button>
            <button
              type="button"
              onClick={() => onChangeTariffPeriod('dec_2026')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tariffPeriod === 'dec_2026'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 Aralık (%2,94)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowRateSources(!showRateSources)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer min-h-[34px]"
          >
            <Landmark className="w-3.5 h-3.5 text-slate-500" />
            <span>Oran Kaynakları</span>
            {showRateSources ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Regulatory Rate Sources Drawer */}
      {showRateSources && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Türkiye Güncel Referans Faiz ve Vergi Tablosu ({tariffMeta.label})
              </h3>
              <p className="text-xs text-slate-500">
                Oranlar değişse bile kayıtlı eski planlarınızdaki tarihi oranlar otomatik korunur. Her borç kaleminde oranı manuel olarak düzenleyebilirsiniz.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3 font-medium">Borç Türü / Kademe</th>
                  <th className="py-2 px-2 font-medium text-right">Akdi</th>
                  <th className="py-2 px-2 font-medium text-right">Gecikme</th>
                  <th className="py-2 px-2 font-medium text-right">BSMV+KKDF</th>
                  <th className="py-2 px-2 font-medium text-right">Asgari</th>
                  <th className="py-2 pl-3 font-medium">Kaynak & Geçerlilik</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {referenceRows.map((row) => (
                  <tr key={row.id} className="text-slate-700">
                    <td className="py-2 pr-3 font-medium text-slate-900">{row.title}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">%{row.contractualRate.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">%{row.overdueRate.toFixed(2)}</td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">
                      %{row.bsmvRate} + %{row.kkdfRate}
                    </td>
                    <td className="py-2 px-2 text-right font-mono tabular-nums">%{row.minPaymentRate}</td>
                    <td className="py-2 pl-3 text-slate-500">
                      {row.source} ({row.effectiveDate}) · {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top KPI Summary + Budget Input */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
        <div className="md:col-span-5 space-y-1.5">
          <label htmlFor="monthly-budget-input" className="block text-sm font-semibold text-slate-800">
            Aylık Ödeyebileceğiniz Bütçe (₺)
          </label>
          <div className="relative">
            <input
              id="monthly-budget-input"
              type="text"
              inputMode="decimal"
              value={monthlyBudget === 0 ? '' : monthlyBudget}
              placeholder="Örn: 22000"
              onChange={(e) => handleNumberInput(e.target.value, setMonthlyBudget)}
              className="w-full px-3.5 py-2.5 pr-10 text-base font-semibold font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 min-h-[44px]"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
              ₺
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Tüm stratejiler bu bütçe sınırınıza sadık kalarak hesaplanır.
          </p>
        </div>

        <div className="md:col-span-4 space-y-1.5">
          <span className="block text-sm font-semibold text-slate-800">Asgari Ödeme Hesaplama Yöntemi</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCalculationMode('fixed')}
              className={`px-3 py-2.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors cursor-pointer min-h-[44px] ${
                calculationMode === 'fixed'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Sabit Taksit / Başlangıç
            </button>
            <button
              type="button"
              onClick={() => setCalculationMode('revolving')}
              className={`px-3 py-2.5 text-xs sm:text-sm font-medium rounded-lg border transition-colors cursor-pointer min-h-[44px] ${
                calculationMode === 'revolving'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Dönen Bakiye
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {calculationMode === 'fixed'
              ? 'Asgari tutar ilk dönem borcu bazında sabit tutulur.'
              : 'Borç azaldıkça aylık asgari ödeme oranı da düşer.'}
          </p>
        </div>

        <div className="md:col-span-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col justify-center">
          <span className="text-xs font-medium text-slate-500">Toplam Aktif Borç</span>
          <span className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {formatCurrencyTR(totalDebt)}
          </span>
          <span className="text-xs text-slate-500 mt-1 tabular-nums">
            İlk ay asgari: <strong className="text-slate-700">{formatCurrencyTR(minimumRequiredFirstMonth)}</strong>
          </span>
        </div>
      </div>

      {/* Budget Shortfall / Zero Warning */}
      {totalDebt > 0 && (monthlyBudget <= 0 || budgetShortfallFirstMonth > 0) && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-950 text-xs sm:text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {monthlyBudget <= 0 ? (
              <>
                <p className="font-semibold">Aylık ödeme bütçeniz 0 ₺ olarak görünüyor.</p>
                <p className="text-amber-800">
                  İlk ay yasal/sözleşmesel asgari ödeme gereksinimi{' '}
                  <strong className="font-mono tabular-nums">{formatCurrencyTR(minimumRequiredFirstMonth)}</strong>{' '}
                  tutardadır. Bütçe girilmediği için planlanan ödemeler 0 ₺ olarak gösterilir ve borç gecikme faiziyle büyür.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">
                  Bütçeniz ilk ay asgari ödemenin {formatCurrencyTR(budgetShortfallFirstMonth)} altında kalıyor.
                </p>
                <p className="text-amber-800">
                  Gereken asgari tutar <strong className="font-mono tabular-nums">{formatCurrencyTR(minimumRequiredFirstMonth)}</strong>, bütçeniz{' '}
                  <strong className="font-mono tabular-nums">{formatCurrencyTR(monthlyBudget)}</strong>. Eksik kalan kısım için sonraki aylarda gecikme faizi işler; yapılandırma veya ara ödeme seçeneklerini inceleyebilirsiniz.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Existing Debts List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            Tanımlı Borç Kalemleri ({debts.length})
          </h2>
          <span className="text-xs text-slate-500">
            Detaylı faiz, vergi, vade ve gecikme ayarları için borca tıklayın
          </span>
        </div>

        {debts.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
            Henüz borç kalemi eklenmedi. Aşağıdaki formdan yeni borç ekleyebilirsiniz.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
            {debts.map((debt) => {
              const isExpanded = expandedDebtId === debt.id;
              const effectiveRate = getEffectiveMonthlyRatePercent(debt);
              const meta = DEBT_TYPE_META[debt.type];

              return (
                <div key={debt.id} className={debt.isPaidOff ? 'bg-slate-50/60 opacity-75' : 'bg-white'}>
                  {/* Summary Row */}
                  <div className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onUpdateDebt(debt.id, { isPaidOff: !debt.isPaidOff })}
                        title={debt.isPaidOff ? 'Borcu tekrar aktifleştir' : 'Borcu kapandı olarak işaretle'}
                        className={`mt-0.5 sm:mt-0 w-5 h-5 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                          debt.isPaidOff
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 bg-white hover:border-slate-500'
                        }`}
                      >
                        {debt.isPaidOff && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={`font-semibold text-sm text-slate-900 truncate ${debt.isPaidOff ? 'line-through' : ''}`}>
                            {debt.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            · {meta.shortLabel}
                            {debt.isOverdue && (
                              <span className="text-rose-600 font-medium"> · Gecikmiş ({debt.overdueDays} gün)</span>
                            )}
                            {debt.isPaidOff && (
                              <span className="text-emerald-700 font-medium"> · Kapandı</span>
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                          Akdi %{debt.contractualRate.toFixed(2)} · Vergi %{debt.bsmvRate + debt.kkdfRate} (Efektif %{effectiveRate.toFixed(2)}) · Asgari %{debt.minPaymentRate} · Son Ödeme: Ayın {debt.dueDay}&apos;i
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`${debt.name} bakiyesi`}
                          value={debt.balance === 0 ? '' : debt.balance}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^\d.,]/g, '').replace(',', '.');
                            const val = cleaned === '' ? 0 : parseFloat(cleaned);
                            if (!Number.isNaN(val)) {
                              const patch: Partial<DebtItem> = { balance: Math.max(0, val) };
                              if (!debt.isManualRate) {
                                const preset = getPresetForDebt(debt.type, Math.max(0, val), debt.creditLimit, tariffPeriod);
                                patch.contractualRate = preset.contractualRate;
                                patch.overdueRate = preset.overdueRate;
                                patch.minPaymentRate = preset.minPaymentRate;
                                patch.rateSource = preset.rateSource;
                              }
                              onUpdateDebt(debt.id, patch);
                            }
                          }}
                          className="w-28 sm:w-32 px-2.5 py-1.5 text-right text-sm font-semibold font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-slate-900 min-h-[38px]"
                        />
                        <span className="text-xs text-slate-400">₺</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedDebtId(isExpanded ? null : debt.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer min-h-[38px]"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Detay</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => onRemoveDebt(debt.id)}
                        aria-label={`${debt.name} sil`}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Advanced Parameters */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-3 bg-slate-50/70 border-t border-slate-200/70 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Borç Adı</label>
                          <input
                            type="text"
                            value={debt.name}
                            onChange={(e) => onUpdateDebt(debt.id, { name: e.target.value })}
                            className="w-full px-2.5 py-2 text-sm bg-white border border-slate-200 rounded-md min-h-[40px]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Borç Türü</label>
                          <select
                            value={debt.type}
                            onChange={(e) => handleDebtTypeChange(debt, e.target.value as DebtType)}
                            className="w-full px-2.5 py-2 text-sm bg-white border border-slate-200 rounded-md min-h-[40px]"
                          >
                            {DEBT_TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>
                                {DEBT_TYPE_META[t].label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {meta.supportsLimitTier && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Kart Limiti (BDDK Kademesi)
                            </label>
                            <input
                              type="number"
                              value={debt.creditLimit ?? ''}
                              placeholder="Örn: 90000"
                              onChange={(e) => {
                                const lim = Math.max(0, Number(e.target.value) || 0);
                                const preset = getPresetForDebt(debt.type, debt.balance, lim || undefined, tariffPeriod);
                                onUpdateDebt(debt.id, {
                                  creditLimit: lim || undefined,
                                  minPaymentRate: debt.isManualRate ? debt.minPaymentRate : preset.minPaymentRate,
                                  rateSource: debt.isManualRate ? debt.rateSource : preset.rateSource,
                                });
                              }}
                              className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                            />
                          </div>
                        )}

                        {meta.supportsInstallments && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">
                              Kalan Vade (Ay)
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={120}
                              value={debt.remainingInstallments ?? 12}
                              onChange={(e) =>
                                onUpdateDebt(debt.id, {
                                  remainingInstallments: Math.max(1, Math.round(Number(e.target.value) || 1)),
                                })
                              }
                              className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Aylık Akdi Faiz (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={debt.contractualRate}
                            onChange={(e) =>
                              onUpdateDebt(debt.id, {
                                contractualRate: Math.max(0, Number(e.target.value) || 0),
                                isManualRate: true,
                                rateSource: 'Manuel Giriş',
                                rateUpdatedAt: new Date().toISOString().slice(0, 10),
                              })
                            }
                            className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Aylık Gecikme Faizi (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={debt.overdueRate}
                            onChange={(e) =>
                              onUpdateDebt(debt.id, {
                                overdueRate: Math.max(0, Number(e.target.value) || 0),
                                isManualRate: true,
                              })
                            }
                            className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            BSMV (%) / KKDF (%)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min={0}
                              max={50}
                              value={debt.bsmvRate}
                              onChange={(e) =>
                                onUpdateDebt(debt.id, {
                                  bsmvRate: Math.max(0, Number(e.target.value) || 0),
                                  isManualRate: true,
                                })
                              }
                              className="w-full px-2 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                              title="BSMV %"
                            />
                            <input
                              type="number"
                              min={0}
                              max={50}
                              value={debt.kkdfRate}
                              onChange={(e) =>
                                onUpdateDebt(debt.id, {
                                  kkdfRate: Math.max(0, Number(e.target.value) || 0),
                                  isManualRate: true,
                                })
                              }
                              className="w-full px-2 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                              title="KKDF %"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Asgari Oran (%) / Ödeme Günü
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={debt.minPaymentRate}
                              onChange={(e) =>
                                onUpdateDebt(debt.id, {
                                  minPaymentRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                  isManualRate: true,
                                })
                              }
                              className="w-full px-2 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                              title="Asgari ödeme %"
                            />
                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={debt.dueDay}
                              onChange={(e) =>
                                onUpdateDebt(debt.id, {
                                  dueDay: Math.max(1, Math.min(31, Math.round(Number(e.target.value) || 1))),
                                })
                              }
                              className="w-full px-2 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
                              title="Son ödeme günü"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Overdue toggle + Source line */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={debt.isOverdue}
                              onChange={(e) =>
                                onUpdateDebt(debt.id, {
                                  isOverdue: e.target.checked,
                                  overdueDays: e.target.checked ? Math.max(1, debt.overdueDays || 10) : 0,
                                })
                              }
                              className="rounded border-slate-300"
                            />
                            Gecikmiş Borç (Gün bazlı gecikme faizi uygula)
                          </label>

                          {debt.isOverdue && (
                            <div className="inline-flex items-center gap-1.5 text-xs">
                              <span className="text-slate-500">Gecikme Günü:</span>
                              <input
                                type="number"
                                min={1}
                                max={365}
                                value={debt.overdueDays}
                                onChange={(e) =>
                                  onUpdateDebt(debt.id, {
                                    overdueDays: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                  })
                                }
                                className="w-16 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>
                            Kaynak: <strong className="text-slate-700">{debt.rateSource}</strong> ({debt.rateUpdatedAt})
                          </span>
                          {debt.isManualRate && (
                            <button
                              type="button"
                              onClick={() => handleApplyPresetToDebt(debt)}
                              className="text-slate-700 underline hover:text-slate-900 cursor-pointer"
                            >
                              Güncel TCMB Oranına Sıfırla
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Add New Debt Form */}
        <form onSubmit={handleCreateDebt} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yeni borç adı (Örn: Banka Kartı)"
            className="sm:col-span-4 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900 min-h-[42px]"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as DebtType)}
            className="sm:col-span-3 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900 min-h-[42px]"
          >
            {DEBT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {DEBT_TYPE_META[t].label}
              </option>
            ))}
          </select>
          <input
            type="text"
            inputMode="decimal"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            placeholder="Tutar (₺)"
            className="sm:col-span-2 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900 min-h-[42px]"
          />
          <input
            type="text"
            inputMode="decimal"
            value={newLimit}
            disabled={!DEBT_TYPE_META[newType].supportsLimitTier}
            onChange={(e) => setNewLimit(e.target.value)}
            placeholder={DEBT_TYPE_META[newType].supportsLimitTier ? 'Kart Limiti (₺)' : 'Limit yok'}
            className="sm:col-span-2 px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900 disabled:opacity-50 min-h-[42px]"
          />
          <button
            type="submit"
            className="sm:col-span-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer min-h-[42px]"
          >
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Borç Ekle</span>
          </button>
        </form>
      </div>

      {/* Collapsible Tools: Interim Payments & Debt Restructuring */}
      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowExtraPanel(!showExtraPanel)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer min-h-[40px]"
        >
          <CalendarPlus className="w-4 h-4 text-slate-500" />
          <span>Ara / Erken Ödeme Planla ({extraPayments.length})</span>
          {showExtraPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setShowRestructurePanel(!showRestructurePanel)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer min-h-[40px]"
        >
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <span>
            Borç Yapılandırma Simülatörü {restructureConfig.enabled ? '(Aktif)' : ''}
          </span>
          {showRestructurePanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Interim / Extra Payments Panel */}
      {showExtraPanel && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Ara Ödeme ve Erken Kapatma Planlayıcı</h3>
            <p className="text-xs text-slate-500">
              İlerleyen aylarda elinize geçecek prim, ikramiye veya toplu parayı girin; tüm stratejiler ve kapanış tarihleri anında güncellenir.
            </p>
          </div>

          <form onSubmit={handleCreateExtra} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-2">
              <input
                type="number"
                min={1}
                max={360}
                value={extraMonth}
                onChange={(e) => setExtraMonth(e.target.value)}
                placeholder="Kaçıncı ay"
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
              />
            </div>
            <div className="sm:col-span-3">
              <input
                type="text"
                inputMode="decimal"
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
                placeholder="Ara Ödeme (₺)"
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
              />
            </div>
            <div className="sm:col-span-3">
              <select
                value={extraTargetId}
                onChange={(e) => setExtraTargetId(e.target.value)}
                className="w-full px-2.5 py-2 text-sm bg-white border border-slate-200 rounded-md min-h-[40px]"
              >
                <option value="">Strateji Önceliğine Göre</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    Hedef: {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <input
                type="text"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="Not (Örn: İkramiye)"
                className="w-full px-2.5 py-2 text-sm bg-white border border-slate-200 rounded-md min-h-[40px]"
              />
            </div>
            <button
              type="submit"
              className="sm:col-span-1 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer min-h-[40px]"
            >
              Ekle
            </button>
          </form>

          {extraPayments.length > 0 && (
            <div className="divide-y divide-slate-200 border border-slate-200 bg-white rounded-md">
              {extraPayments.map((ev) => {
                const targetName = ev.targetDebtId
                  ? debts.find((d) => d.id === ev.targetDebtId)?.name || 'Belirli Borç'
                  : 'Aktif Strateji Önceliği';
                return (
                  <div key={ev.id} className="px-3 py-2 flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900">{ev.month}. Ay</span>
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                        +{formatCurrencyTR(ev.amount)}
                      </span>
                      <span className="text-slate-500">· {targetName}</span>
                      {ev.note && <span className="text-slate-400">· {ev.note}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveExtraPayment(ev.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Debt Restructuring Simulator Panel */}
      {showRestructurePanel && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Borç Yapılandırma / Tek Kredide Birleştirme Simülatörü</h3>
              <p className="text-xs text-slate-500">
                Mevcut toplam borcunuzu tek bir taksitli yapılandırma kredisine dönüştürmenin maliyetini karşılaştırın.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={restructureConfig.enabled}
                onChange={(e) => onUpdateRestructure({ enabled: e.target.checked })}
                className="rounded border-slate-300"
              />
              Simülasyonu Aktifleştir
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Aylık Yapılandırma Faizi (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={restructureConfig.monthlyRate}
                onChange={(e) =>
                  onUpdateRestructure({
                    monthlyRate: Math.max(0, Number(e.target.value) || 0),
                    enabled: true,
                  })
                }
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Vade (Ay)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={restructureConfig.termMonths}
                onChange={(e) =>
                  onUpdateRestructure({
                    termMonths: Math.max(1, Math.min(60, Math.round(Number(e.target.value) || 12))),
                    enabled: true,
                  })
                }
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">BSMV (%)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={restructureConfig.bsmvRate}
                onChange={(e) =>
                  onUpdateRestructure({ bsmvRate: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">KKDF (%)</label>
              <input
                type="number"
                min={0}
                max={30}
                value={restructureConfig.kkdfRate}
                onChange={(e) =>
                  onUpdateRestructure({ kkdfRate: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-full px-2.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-md min-h-[40px]"
              />
            </div>
          </div>

          {restructureConfig.enabled && restructureResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
              <div>
                <span className="text-xs text-slate-500">Sabit Aylık Taksit</span>
                <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrencyTR(restructureResult.monthlyInstallment)}
                </p>
                <span className={`text-xs ${restructureResult.isWithinBudget ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {restructureResult.isWithinBudget ? 'Bütçenize uygun' : 'Aylık bütçeyi aşıyor'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500">Toplam Faiz + Vergi</span>
                <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrencyTR(restructureResult.totalInterestAndTaxes)}
                </p>
                <span className="text-xs text-slate-500">
                  Efektif %{restructureResult.effectiveMonthlyRateWithTaxes.toFixed(2)}/ay
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500">Toplam Geri Ödeme</span>
                <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrencyTR(restructureResult.totalPaid)}
                </p>
                <span className="text-xs text-slate-500">Bitiş: {restructureResult.estimatedPayoffDate}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500">Asgari Ödemeye Göre Fark</span>
                <p className={`text-base font-bold font-mono tabular-nums ${
                  restructureResult.savingsVsCurrentMinimum >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}>
                  {restructureResult.savingsVsCurrentMinimum >= 0 ? '+' : ''}
                  {formatCurrencyTR(restructureResult.savingsVsCurrentMinimum)}
                </p>
                <span className="text-xs text-slate-500">
                  {restructureResult.savingsVsCurrentMinimum >= 0 ? 'Tahmini faiz avantajı' : 'Ek maliyet'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
