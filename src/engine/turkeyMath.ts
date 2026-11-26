import {
  ActualMonthLog,
  AllStrategiesComparison,
  CalculationMode,
  DebtItem,
  DebtMonthBreakdown,
  ExtraPaymentEvent,
  MonthlyLedgerRow,
  RestructureConfig,
  RestructureResult,
  StrategyResult,
  StrategyType,
  TariffPeriod,
} from '../types/finance';

export const MAX_SIMULATION_MONTHS = 360;

const TURKISH_MONTHS = [
  'Oca',
  'Şub',
  'Mar',
  'Nis',
  'May',
  'Haz',
  'Tem',
  'Ağu',
  'Eyl',
  'Eki',
  'Kas',
  'Ara',
];

const TURKISH_MONTHS_FULL = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

/**
 * Kuruş düzeyinde kesin yuvarlama (1/100 TL)
 */
export function roundKurus(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrencyTR(amount: number, showDecimals: boolean = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(showDecimals ? roundKurus(safe) : Math.round(safe));
}

export function addMonthsLabel(baseDate: Date, monthOffset: number, fullMonth: boolean = false): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1);
  const monthNames = fullMonth ? TURKISH_MONTHS_FULL : TURKISH_MONTHS;
  return `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Vergiler (BSMV + KKDF) dahil aylık efektif maliyet çarpanı
 */
export function getEffectiveMonthlyRatePercent(debt: DebtItem): number {
  const baseRate = debt.isOverdue || debt.type === 'overdue'
    ? Math.max(debt.contractualRate, debt.overdueRate)
    : debt.contractualRate;
  const taxMultiplier = 1 + (Math.max(0, debt.bsmvRate) + Math.max(0, debt.kkdfRate)) / 100;
  return roundKurus(Math.max(0, baseRate) * taxMultiplier);
}

/**
 * Gün bazlı akdi/gecikme faizi + BSMV + KKDF hesaplama
 */
export function calculateMonthlyFinanceCharges(
  balance: number,
  debt: DebtItem,
  monthIndex: number,
  previousMonthShortfall: number = 0,
  daysInMonth: number = 30
): {
  contractualInterest: number;
  overdueInterest: number;
  totalInterest: number;
  bsmv: number;
  kkdf: number;
  totalFinanceCharge: number;
} {
  if (balance <= 0.005) {
    return {
      contractualInterest: 0,
      overdueInterest: 0,
      totalInterest: 0,
      bsmv: 0,
      kkdf: 0,
      totalFinanceCharge: 0,
    };
  }

  const dayRatio = Math.max(1, daysInMonth) / 30;
  const cRate = Math.max(0, debt.contractualRate) / 100;
  const oRate = Math.max(cRate, Math.max(0, debt.overdueRate) / 100);

  let contractualInterest = 0;
  let overdueInterest = 0;

  if (debt.type === 'overdue') {
    const effectiveDays = monthIndex === 1 && debt.overdueDays > 0
      ? (30 + debt.overdueDays) / 30
      : dayRatio;
    overdueInterest = roundKurus(balance * oRate * effectiveDays);
  } else if (monthIndex === 1 && debt.isOverdue && debt.overdueDays > 0) {
    contractualInterest = roundKurus(balance * cRate * dayRatio);
    overdueInterest = roundKurus(balance * oRate * (debt.overdueDays / 30));
  } else if (previousMonthShortfall > 0.01) {
    // Önceki ay asgari ödenmediyse veya eksik ödendiyse geciken tutara gecikme faizi, kalana akdi faiz
    const overdueBase = Math.min(balance, previousMonthShortfall);
    const normalBase = Math.max(0, balance - overdueBase);
    contractualInterest = roundKurus(normalBase * cRate * dayRatio);
    overdueInterest = roundKurus(overdueBase * oRate * dayRatio);
  } else {
    contractualInterest = roundKurus(balance * cRate * dayRatio);
  }

  const totalInterest = roundKurus(contractualInterest + overdueInterest);
  const bsmv = roundKurus(totalInterest * (Math.max(0, debt.bsmvRate) / 100));
  const kkdf = roundKurus(totalInterest * (Math.max(0, debt.kkdfRate) / 100));
  const totalFinanceCharge = roundKurus(totalInterest + bsmv + kkdf);

  return {
    contractualInterest,
    overdueInterest,
    totalInterest,
    bsmv,
    kkdf,
    totalFinanceCharge,
  };
}

/**
 * Borç türüne göre o ay ödenmesi gereken yasal/sözleşmesel asgari tutar
 */
export function computeDebtMinimumRequired(
  currentBalance: number,
  initialBalance: number,
  financeCharge: number,
  debt: DebtItem,
  mode: CalculationMode,
  monthsElapsed: number
): number {
  if (currentBalance <= 0.005) return 0;
  const fullPayoff = roundKurus(currentBalance + financeCharge);

  // Taksitli veya ihtiyaç kredisi
  if (debt.type === 'consumer_loan' || debt.type === 'installment_loan') {
    if (debt.monthlyInstallmentOverride && debt.monthlyInstallmentOverride > 0) {
      return Math.min(fullPayoff, roundKurus(debt.monthlyInstallmentOverride));
    }
    if (debt.remainingInstallments && debt.remainingInstallments > 0) {
      const remainingMonths = Math.max(1, debt.remainingInstallments - (monthsElapsed - 1));
      const effRate = getEffectiveMonthlyRatePercent(debt) / 100;
      if (effRate <= 0) {
        return Math.min(fullPayoff, roundKurus(currentBalance / remainingMonths));
      }
      const factor = Math.pow(1 + effRate, remainingMonths);
      const installment = currentBalance * ((effRate * factor) / (factor - 1));
      return Math.min(fullPayoff, roundKurus(installment));
    }
  }

  const minRate = Math.max(0, debt.minPaymentRate) / 100;
  if (minRate === 0) return 0;

  const basis = mode === 'fixed' ? initialBalance : currentBalance;
  // Türkiye bankacılık pratiği: En az (dönem borcu * asgari oran) veya (işleyen faiz+vergi), tam kapamayı aşamaz.
  // Küçük kuruş kalıntılarının sonsuz döngüye girmemesi için en az 1 ₺ (veya tam kapama tutarı) uygulanır.
  const calculatedMin = Math.max(roundKurus(basis * minRate), roundKurus(financeCharge), 1);
  return Math.min(fullPayoff, calculatedMin);
}

interface SimulationOptions {
  debts: DebtItem[];
  monthlyBudget: number;
  strategy: StrategyType;
  calculationMode: CalculationMode;
  extraPayments?: ExtraPaymentEvent[];
  actualLogs?: Record<number, ActualMonthLog>;
  customPriorityOrder?: string[];
  baselineMinimumTotalInterest?: number;
  baselineMinimumMonths?: number;
  baseDate?: Date;
}

const STRATEGY_LABELS: Record<StrategyType, { label: string; shortLabel: string; description: string }> = {
  minimum: {
    label: 'Asgari Ödeme Yöntemi',
    shortLabel: 'Asgari Ödeme',
    description: 'Her borç için yalnızca yasal/sözleşmesel asgari tutar ödenir. Aylık yük düşüktür ancak toplam faiz yüksektir.',
  },
  fast_budget: {
    label: 'Hızlı Kapatma Yöntemi',
    shortLabel: 'Hızlı Kapatma',
    description: 'Aylık ödeyebileceğiniz bütçenin tamamı gecikmiş ve yüksek maliyetli borçlardan başlayarak aktif kullanılır.',
  },
  snowball: {
    label: 'Kartopu Yöntemi (Snowball)',
    shortLabel: 'Kartopu',
    description: 'En düşük bakiyeli borçtan başlanır; bir borç kapandığında bütçesi sıradaki en küçük borca aktarılır.',
  },
  avalanche: {
    label: 'Çığ Yöntemi (Avalanche)',
    shortLabel: 'Çığ',
    description: 'Vergiler dahil en yüksek efektif faizli borçtan başlanır; kapanan borcun bütçesi diğerine devredilir.',
  },
  custom: {
    label: 'Kullanıcıya Özel Plan',
    shortLabel: 'Özel Plan',
    description: 'Belirlediğiniz borç öncelik sırası, ara ödemeler ve ödeme günlerine göre oluşturulan kişisel plan.',
  },
};

export function simulateMultiDebtStrategy(options: SimulationOptions): StrategyResult {
  const {
    debts,
    monthlyBudget,
    strategy,
    calculationMode,
    extraPayments = [],
    actualLogs = {},
    customPriorityOrder = [],
    baselineMinimumTotalInterest,
    baselineMinimumMonths,
    baseDate = new Date(),
  } = options;

  const meta = STRATEGY_LABELS[strategy];
  const safeBudget = Math.max(0, roundKurus(monthlyBudget));

  // Filter active debts (not explicitly marked as paid off and balance > 0)
  const activeInitialDebts = debts
    .filter((d) => !d.isPaidOff && d.balance > 0.005)
    .map((d) => ({
      ...d,
      balance: roundKurus(d.balance),
    }));

  const totalInitialDebt = roundKurus(
    activeInitialDebts.reduce((sum, d) => sum + d.balance, 0)
  );

  if (activeInitialDebts.length === 0 || totalInitialDebt <= 0) {
    return {
      strategy,
      ...meta,
      monthsToPayoff: 0,
      estimatedPayoffDate: 'Borç Bulunmuyor',
      isPayable: true,
      reachedMaxCap: false,
      isUnderMinimum: false,
      budgetShortfallFirstMonth: 0,
      minimumRequiredFirstMonth: 0,
      firstMonthPayment: 0,
      averageMonthlyPayment: 0,
      totalPrincipal: 0,
      totalContractualInterest: 0,
      totalOverdueInterest: 0,
      totalBsmv: 0,
      totalKkdf: 0,
      totalInterestAndTaxes: 0,
      totalPaid: 0,
      interestSavedVsMinimum: 0,
      monthsSavedVsMinimum: 0,
      savingsPercentageVsMinimum: 0,
      incomeRatio: 0,
      schedule: [],
      debtPayoffOrder: [],
    };
  }

  // Mutable balances and tracking per debt
  const balances: Record<string, number> = {};
  const initialBalances: Record<string, number> = {};
  const prevShortfalls: Record<string, number> = {};
  const debtInterestAccum: Record<string, number> = {};
  const payoffMonthMap: Record<string, number> = {};

  for (const d of activeInitialDebts) {
    balances[d.id] = d.balance;
    initialBalances[d.id] = d.balance;
    prevShortfalls[d.id] = 0;
    debtInterestAccum[d.id] = 0;
  }

  const schedule: MonthlyLedgerRow[] = [];
  let month = 0;
  let totalContractualInterest = 0;
  let totalOverdueInterest = 0;
  let totalBsmv = 0;
  let totalKkdf = 0;
  let totalPaid = 0;
  let totalPrincipalPaid = 0;
  let minimumRequiredFirstMonth = 0;
  let budgetShortfallFirstMonth = 0;
  let isUnderMinimumAny = false;
  let reachedMaxCap = false;

  // Determine simulation cap: if budget === 0 and no actual/extra payments exist beyond month 12, cap at 12 projection months so we clearly show deficit without stalling
  const hasAnyExtraOrActual =
    extraPayments.some((e) => e.amount > 0) ||
    Object.values(actualLogs).some((l) => (l.actualAmount ?? 0) > 0);

  while (month < MAX_SIMULATION_MONTHS) {
    const remainingTotalStart = roundKurus(
      Object.values(balances).reduce((s, v) => s + v, 0)
    );
    if (remainingTotalStart <= 0.005) break;

    month++;

    // 1. Calculate finance charges & minimum required for each active debt
    const chargesByDebt: Record<string, ReturnType<typeof calculateMonthlyFinanceCharges>> = {};
    const minsByDebt: Record<string, number> = {};
    const fullPayoffByDebt: Record<string, number> = {};
    let monthTotalMin = 0;
    let monthContractualInterest = 0;
    let monthOverdueInterest = 0;
    let monthBsmv = 0;
    let monthKkdf = 0;

    for (const d of activeInitialDebts) {
      const bal = balances[d.id];
      if (bal <= 0.005) {
        chargesByDebt[d.id] = {
          contractualInterest: 0,
          overdueInterest: 0,
          totalInterest: 0,
          bsmv: 0,
          kkdf: 0,
          totalFinanceCharge: 0,
        };
        minsByDebt[d.id] = 0;
        fullPayoffByDebt[d.id] = 0;
        continue;
      }

      const charges = calculateMonthlyFinanceCharges(bal, d, month, prevShortfalls[d.id], 30);
      chargesByDebt[d.id] = charges;
      const fullPayoff = roundKurus(bal + charges.totalFinanceCharge);
      fullPayoffByDebt[d.id] = fullPayoff;

      const minReq = computeDebtMinimumRequired(
        bal,
        initialBalances[d.id],
        charges.totalFinanceCharge,
        d,
        calculationMode,
        month
      );
      minsByDebt[d.id] = minReq;

      monthTotalMin = roundKurus(monthTotalMin + minReq);
      monthContractualInterest = roundKurus(monthContractualInterest + charges.contractualInterest);
      monthOverdueInterest = roundKurus(monthOverdueInterest + charges.overdueInterest);
      monthBsmv = roundKurus(monthBsmv + charges.bsmv);
      monthKkdf = roundKurus(monthKkdf + charges.kkdf);
    }

    const monthTotalFinanceCharge = roundKurus(
      monthContractualInterest + monthOverdueInterest + monthBsmv + monthKkdf
    );
    const monthFullPayoffAll = roundKurus(remainingTotalStart + monthTotalFinanceCharge);

    if (month === 1) {
      minimumRequiredFirstMonth = monthTotalMin;
      budgetShortfallFirstMonth = Math.max(0, roundKurus(monthTotalMin - safeBudget));
    }
    if (safeBudget < monthTotalMin - 0.01) {
      isUnderMinimumAny = true;
    }

    // 2. Determine Planned Payment STRICTLY consistent with monthlyBudget
    const scheduledExtrasThisMonth = extraPayments.filter((e) => e.month === month && e.amount > 0);
    const totalExtraScheduled = roundKurus(
      scheduledExtrasThisMonth.reduce((s, e) => s + e.amount, 0)
    );

    let plannedBaseBudget: number;
    if (safeBudget <= 0) {
      plannedBaseBudget = 0;
    } else if (strategy === 'minimum') {
      // Asgari ödeme stratejisi: asgari kadar öder, ancak kullanıcının bütçesini ASLA aşmaz!
      plannedBaseBudget = Math.min(safeBudget, monthTotalMin, monthFullPayoffAll);
    } else {
      // Hızlı, Kartopu, Çığ, Özel: bütçenin tamamını (gerektiği kadarını) kullanır
      plannedBaseBudget = Math.min(safeBudget, monthFullPayoffAll);
    }

    const plannedPayment = Math.min(
      monthFullPayoffAll,
      roundKurus(plannedBaseBudget + totalExtraScheduled)
    );

    // 3. Apply actual log overrides if user logged this month
    const log = actualLogs[month];
    const isPaid = Boolean(log?.isPaid && !log?.isSkipped);
    const isSkipped = Boolean(log?.isSkipped);
    let actualPayment: number | null = null;
    let effectivePayment = plannedPayment;

    if (log) {
      if (log.isSkipped) {
        actualPayment = 0;
        effectivePayment = 0;
      } else if (typeof log.actualAmount === 'number' && log.actualAmount >= 0) {
        actualPayment = Math.min(monthFullPayoffAll, roundKurus(log.actualAmount));
        effectivePayment = actualPayment;
      } else if (log.isPaid) {
        actualPayment = plannedPayment;
        effectivePayment = plannedPayment;
      }
    }

    const extraPaymentThisMonth = roundKurus(
      totalExtraScheduled +
        (actualPayment !== null && actualPayment > plannedPayment
          ? actualPayment - plannedPayment
          : 0)
    );

    const isOverdueMonth = isSkipped || effectivePayment < monthTotalMin - 0.01;

    // 4. Allocate effectivePayment across debts according to strategy priority
    const activeDebtsThisMonth = activeInitialDebts.filter((d) => balances[d.id] > 0.005);

    const sortPriority = (a: DebtItem, b: DebtItem): number => {
      if (strategy === 'snowball') {
        if (balances[a.id] !== balances[b.id]) return balances[a.id] - balances[b.id];
        return getEffectiveMonthlyRatePercent(b) - getEffectiveMonthlyRatePercent(a);
      }
      if (strategy === 'avalanche') {
        const rateDiff = getEffectiveMonthlyRatePercent(b) - getEffectiveMonthlyRatePercent(a);
        if (Math.abs(rateDiff) > 0.001) return rateDiff;
        return balances[a.id] - balances[b.id];
      }
      if (strategy === 'custom') {
        const idxA = customPriorityOrder.indexOf(a.id);
        const idxB = customPriorityOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.dueDay - b.dueDay;
      }
      // 'fast_budget' or 'minimum': prioritize overdue first, then highest effective rate, then due day
      const aOver = a.isOverdue || a.type === 'overdue' ? 1 : 0;
      const bOver = b.isOverdue || b.type === 'overdue' ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;
      const rateDiff = getEffectiveMonthlyRatePercent(b) - getEffectiveMonthlyRatePercent(a);
      if (Math.abs(rateDiff) > 0.001) return rateDiff;
      return a.dueDay - b.dueDay;
    };

    const prioritizedDebts = [...activeDebtsThisMonth].sort(sortPriority);
    const allocatedPayments: Record<string, number> = {};
    for (const d of activeDebtsThisMonth) allocatedPayments[d.id] = 0;

    let remainingCash = effectivePayment;

    // First pass: targeted extra payments (if user targeted a specific debtId)
    for (const extra of scheduledExtrasThisMonth) {
      if (extra.targetDebtId && allocatedPayments[extra.targetDebtId] !== undefined && remainingCash > 0) {
        const maxCanTake = roundKurus(fullPayoffByDebt[extra.targetDebtId] - allocatedPayments[extra.targetDebtId]);
        const applyAmt = Math.min(remainingCash, extra.amount, maxCanTake);
        allocatedPayments[extra.targetDebtId] = roundKurus(allocatedPayments[extra.targetDebtId] + applyAmt);
        remainingCash = roundKurus(remainingCash - applyAmt);
      }
    }

    // Second pass: cover minimum payments (in priority order if cash is insufficient)
    for (const d of prioritizedDebts) {
      if (remainingCash <= 0.005) break;
      const minNeeded = Math.max(0, roundKurus(minsByDebt[d.id] - allocatedPayments[d.id]));
      const payAmt = Math.min(remainingCash, minNeeded);
      allocatedPayments[d.id] = roundKurus(allocatedPayments[d.id] + payAmt);
      remainingCash = roundKurus(remainingCash - payAmt);
    }

    // Third pass: pour surplus into priority order (for fast_budget, snowball, avalanche, custom, or overpayment)
    if (remainingCash > 0.005) {
      for (const d of prioritizedDebts) {
        if (remainingCash <= 0.005) break;
        const maxNeeded = Math.max(0, roundKurus(fullPayoffByDebt[d.id] - allocatedPayments[d.id]));
        const payAmt = Math.min(remainingCash, maxNeeded);
        allocatedPayments[d.id] = roundKurus(allocatedPayments[d.id] + payAmt);
        remainingCash = roundKurus(remainingCash - payAmt);
      }
    }

    // 5. Compute end-of-month ledger per debt
    const debtBreakdowns: DebtMonthBreakdown[] = [];
    let monthPrincipalPaid = 0;
    let monthInterestAndTaxPaid = 0;
    let monthEndBalance = 0;

    for (const d of activeInitialDebts) {
      const startBal = balances[d.id];
      if (startBal <= 0.005) continue;

      const ch = chargesByDebt[d.id];
      const pay = allocatedPayments[d.id] || 0;
      const fullPayoff = fullPayoffByDebt[d.id];

      const intTaxPaid = Math.min(pay, ch.totalFinanceCharge);
      const prinPaid = Math.max(0, roundKurus(pay - ch.totalFinanceCharge));
      const endBal = pay >= fullPayoff - 0.005
        ? 0
        : roundKurus(startBal + ch.totalFinanceCharge - pay);

      // Update shortfall for next month's overdue calculation
      prevShortfalls[d.id] = pay < minsByDebt[d.id] - 0.01
        ? roundKurus(minsByDebt[d.id] - pay)
        : 0;

      balances[d.id] = endBal;
      debtInterestAccum[d.id] = roundKurus(debtInterestAccum[d.id] + ch.totalFinanceCharge);

      if (endBal <= 0.005 && !payoffMonthMap[d.id]) {
        payoffMonthMap[d.id] = month;
      }

      monthPrincipalPaid = roundKurus(monthPrincipalPaid + prinPaid);
      monthInterestAndTaxPaid = roundKurus(monthInterestAndTaxPaid + intTaxPaid);
      monthEndBalance = roundKurus(monthEndBalance + endBal);

      debtBreakdowns.push({
        debtId: d.id,
        debtName: d.name,
        debtType: d.type,
        startBalance: startBal,
        accruedInterest: ch.totalInterest,
        contractualInterest: ch.contractualInterest,
        overdueInterest: ch.overdueInterest,
        bsmv: ch.bsmv,
        kkdf: ch.kkdf,
        minimumRequired: minsByDebt[d.id],
        plannedPayment: pay,
        principalPaid: prinPaid,
        interestAndTaxPaid: intTaxPaid,
        endBalance: endBal,
      });
    }

    totalContractualInterest = roundKurus(totalContractualInterest + monthContractualInterest);
    totalOverdueInterest = roundKurus(totalOverdueInterest + monthOverdueInterest);
    totalBsmv = roundKurus(totalBsmv + monthBsmv);
    totalKkdf = roundKurus(totalKkdf + monthKkdf);
    totalPaid = roundKurus(totalPaid + effectivePayment);
    totalPrincipalPaid = roundKurus(totalPrincipalPaid + monthPrincipalPaid);

    schedule.push({
      month,
      monthLabel: addMonthsLabel(baseDate, month - 1, false),
      startBalance: remainingTotalStart,
      accruedInterest: roundKurus(monthContractualInterest + monthOverdueInterest),
      contractualInterest: monthContractualInterest,
      overdueInterest: monthOverdueInterest,
      bsmv: monthBsmv,
      kkdf: monthKkdf,
      totalFinanceCharge: monthTotalFinanceCharge,
      minimumRequired: monthTotalMin,
      plannedPayment,
      actualPayment,
      effectivePayment,
      extraPayment: extraPaymentThisMonth,
      principalPaid: monthPrincipalPaid,
      interestAndTaxPaid: monthInterestAndTaxPaid,
      endBalance: monthEndBalance,
      interestSavedThisMonth: 0, // populated below relative to minimum baseline if provided
      isPaid,
      isSkipped,
      isOverdueMonth,
      debtBreakdowns,
    });

    // If budget is 0 and no future extra/actual payments exist, stop after 12 months projection so debt explosion is clear without 360 dead rows
    if (safeBudget <= 0 && !hasAnyExtraOrActual && month >= 12) {
      reachedMaxCap = true;
      break;
    }

    // If debt is growing or stagnant after 60 months with no future extra payments
    if (month >= MAX_SIMULATION_MONTHS) {
      reachedMaxCap = true;
      break;
    }
  }

  const finalBalance = roundKurus(Object.values(balances).reduce((s, v) => s + v, 0));
  const isPayable = finalBalance <= 0.01 && !reachedMaxCap;

  const totalInterestAndTaxes = roundKurus(
    totalContractualInterest + totalOverdueInterest + totalBsmv + totalKkdf
  );

  const firstMonthPayment = schedule.length > 0 ? schedule[0].effectivePayment : 0;
  const averageMonthlyPayment = schedule.length > 0 ? roundKurus(totalPaid / schedule.length) : 0;
  const incomeRatio = safeBudget > 0 ? Math.round((firstMonthPayment / safeBudget) * 100) : 0;

  const estimatedPayoffDate = !isPayable
    ? safeBudget <= 0
      ? 'Bütçe 0 ₺ (Kapanmıyor)'
      : 'Bütçe Yetersiz (Kapanmıyor)'
    : addMonthsLabel(baseDate, Math.max(0, schedule.length - 1), true);

  let interestSavedVsMinimum = 0;
  let monthsSavedVsMinimum = 0;
  let savingsPercentageVsMinimum = 0;

  if (
    baselineMinimumTotalInterest !== undefined &&
    baselineMinimumMonths !== undefined &&
    isPayable &&
    strategy !== 'minimum'
  ) {
    interestSavedVsMinimum = Math.max(0, roundKurus(baselineMinimumTotalInterest - totalInterestAndTaxes));
    monthsSavedVsMinimum = Math.max(0, baselineMinimumMonths - schedule.length);
    savingsPercentageVsMinimum =
      baselineMinimumTotalInterest > 0
        ? Math.round((interestSavedVsMinimum / baselineMinimumTotalInterest) * 100)
        : 0;
  }

  const debtPayoffOrder = activeInitialDebts
    .map((d) => ({
      debtId: d.id,
      debtName: d.name,
      payoffMonth: payoffMonthMap[d.id] || (isPayable ? schedule.length : 0),
      payoffDate: payoffMonthMap[d.id]
        ? addMonthsLabel(baseDate, payoffMonthMap[d.id] - 1, true)
        : 'Kapanmadı',
      totalInterestAndTaxPaid: debtInterestAccum[d.id] || 0,
    }))
    .sort((a, b) => {
      if (a.payoffMonth === 0) return 1;
      if (b.payoffMonth === 0) return -1;
      return a.payoffMonth - b.payoffMonth;
    });

  return {
    strategy,
    ...meta,
    monthsToPayoff: schedule.length,
    estimatedPayoffDate,
    isPayable,
    reachedMaxCap,
    isUnderMinimum: isUnderMinimumAny,
    budgetShortfallFirstMonth,
    minimumRequiredFirstMonth,
    firstMonthPayment,
    averageMonthlyPayment,
    totalPrincipal: totalInitialDebt,
    totalContractualInterest,
    totalOverdueInterest,
    totalBsmv,
    totalKkdf,
    totalInterestAndTaxes,
    totalPaid,
    interestSavedVsMinimum,
    monthsSavedVsMinimum,
    savingsPercentageVsMinimum,
    incomeRatio,
    schedule,
    debtPayoffOrder,
  };
}

/**
 * Borç Yapılandırma / Tek Kredide Birleştirme Simülatörü
 */
export function simulateRestructuring(
  totalDebt: number,
  monthlyBudget: number,
  config: RestructureConfig,
  minimumBaselineTotalCost: number,
  baseDate: Date = new Date()
): RestructureResult | null {
  if (!config.enabled || totalDebt <= 0 || config.termMonths <= 0) return null;

  const principal = roundKurus(totalDebt);
  const taxMultiplier = 1 + (Math.max(0, config.bsmvRate) + Math.max(0, config.kkdfRate)) / 100;
  const baseRate = Math.max(0, config.monthlyRate) / 100;
  const effRate = baseRate * taxMultiplier;
  const n = Math.max(1, Math.round(config.termMonths));

  let monthlyInstallment = 0;
  if (effRate <= 0) {
    monthlyInstallment = roundKurus(principal / n);
  } else {
    const f = Math.pow(1 + effRate, n);
    monthlyInstallment = roundKurus(principal * ((effRate * f) / (f - 1)));
  }

  let bal = principal;
  let totalInt = 0;
  let totalBsmv = 0;
  let totalKkdf = 0;
  let totalPaid = 0;

  for (let i = 1; i <= n; i++) {
    const interest = roundKurus(bal * baseRate);
    const bsmv = roundKurus(interest * (config.bsmvRate / 100));
    const kkdf = roundKurus(interest * (config.kkdfRate / 100));
    const fin = roundKurus(interest + bsmv + kkdf);

    const payment = i === n ? roundKurus(bal + fin) : Math.min(monthlyInstallment, roundKurus(bal + fin));
    const prin = Math.max(0, roundKurus(payment - fin));
    bal = Math.max(0, roundKurus(bal - prin));

    totalInt = roundKurus(totalInt + interest);
    totalBsmv = roundKurus(totalBsmv + bsmv);
    totalKkdf = roundKurus(totalKkdf + kkdf);
    totalPaid = roundKurus(totalPaid + payment);
  }

  const totalInterestAndTaxes = roundKurus(totalInt + totalBsmv + totalKkdf);

  return {
    monthlyInstallment,
    totalInterest: totalInt,
    totalBsmv,
    totalKkdf,
    totalInterestAndTaxes,
    totalPaid,
    termMonths: n,
    estimatedPayoffDate: addMonthsLabel(baseDate, n - 1, true),
    isWithinBudget: monthlyBudget >= monthlyInstallment,
    savingsVsCurrentMinimum: roundKurus(minimumBaselineTotalCost - totalInterestAndTaxes),
    effectiveMonthlyRateWithTaxes: roundKurus(config.monthlyRate * taxMultiplier),
  };
}

/**
 * Tüm 5 stratejiyi çalıştırıp karşılaştırır, en düşük faiz ve en hızlı bitişi vurgular
 */
export function compareAllStrategies(params: {
  debts: DebtItem[];
  monthlyBudget: number;
  tariffPeriod: TariffPeriod;
  calculationMode: CalculationMode;
  extraPayments?: ExtraPaymentEvent[];
  actualLogs?: Record<number, ActualMonthLog>;
  customPriorityOrder?: string[];
  restructureConfig?: RestructureConfig;
  baseDate?: Date;
}): AllStrategiesComparison {
  const {
    debts,
    monthlyBudget,
    tariffPeriod,
    calculationMode,
    extraPayments = [],
    actualLogs = {},
    customPriorityOrder = [],
    restructureConfig,
    baseDate = new Date(),
  } = params;

  const activeDebts = debts.filter((d) => !d.isPaidOff && d.balance > 0);
  const totalDebt = roundKurus(activeDebts.reduce((s, d) => s + d.balance, 0));

  // First simulate minimum baseline
  const minimumResult = simulateMultiDebtStrategy({
    debts,
    monthlyBudget,
    strategy: 'minimum',
    calculationMode,
    extraPayments,
    actualLogs,
    customPriorityOrder,
    baseDate,
  });

  const baselineCost = minimumResult.isPayable ? minimumResult.totalInterestAndTaxes : undefined;
  const baselineMonths = minimumResult.isPayable ? minimumResult.monthsToPayoff : undefined;

  const otherTypes: StrategyType[] = ['fast_budget', 'snowball', 'avalanche', 'custom'];
  const strategies: Record<StrategyType, StrategyResult> = {
    minimum: minimumResult,
    fast_budget: minimumResult,
    snowball: minimumResult,
    avalanche: minimumResult,
    custom: minimumResult,
  };

  for (const st of otherTypes) {
    const res = simulateMultiDebtStrategy({
      debts,
      monthlyBudget,
      strategy: st,
      calculationMode,
      extraPayments,
      actualLogs,
      customPriorityOrder,
      baselineMinimumTotalInterest: baselineCost,
      baselineMinimumMonths: baselineMonths,
      baseDate,
    });

    // Distribute per-month interest savings vs minimum baseline
    if (res.isPayable && minimumResult.isPayable) {
      for (let i = 0; i < res.schedule.length; i++) {
        const minRow = minimumResult.schedule[i];
        const curRow = res.schedule[i];
        if (minRow && curRow) {
          curRow.interestSavedThisMonth = Math.max(
            0,
            roundKurus(minRow.totalFinanceCharge - curRow.totalFinanceCharge)
          );
        }
      }
    }
    strategies[st] = res;
  }

  // Find lowest cost & fastest among payable strategies
  const payableList = (Object.values(strategies) as StrategyResult[]).filter(
    (s) => s.isPayable && s.monthsToPayoff > 0
  );

  let lowestCostStrategy: StrategyType | null = null;
  let fastestStrategy: StrategyType | null = null;

  if (payableList.length > 0) {
    const byCost = [...payableList].sort(
      (a, b) => a.totalInterestAndTaxes - b.totalInterestAndTaxes
    );
    lowestCostStrategy = byCost[0].strategy;

    const bySpeed = [...payableList].sort((a, b) => {
      if (a.monthsToPayoff !== b.monthsToPayoff) return a.monthsToPayoff - b.monthsToPayoff;
      return a.totalInterestAndTaxes - b.totalInterestAndTaxes;
    });
    fastestStrategy = bySpeed[0].strategy;
  }

  const restructureResult = restructureConfig
    ? simulateRestructuring(
        totalDebt,
        monthlyBudget,
        restructureConfig,
        minimumResult.totalInterestAndTaxes,
        baseDate
      )
    : null;

  return {
    totalDebt,
    monthlyBudget: Math.max(0, roundKurus(monthlyBudget)),
    tariffPeriod,
    strategies,
    lowestCostStrategy,
    fastestStrategy,
    restructureResult,
  };
}
