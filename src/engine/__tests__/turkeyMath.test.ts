import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyFinanceCharges,
  compareAllStrategies,
  roundKurus,
  simulateMultiDebtStrategy,
  simulateRestructuring,
} from '../turkeyMath';
import { getPresetForDebt } from '../turkeyRates';
import { DebtItem } from '../../types/finance';

function makeDebt(overrides: Partial<DebtItem> & { id: string; name: string; balance: number }): DebtItem {
  const type = overrides.type ?? 'credit_card';
  const preset = getPresetForDebt(type, overrides.balance, overrides.creditLimit, 'nov_2026');
  return {
    type,
    contractualRate: preset.contractualRate,
    overdueRate: preset.overdueRate,
    bsmvRate: preset.bsmvRate,
    kkdfRate: preset.kkdfRate,
    minPaymentRate: preset.minPaymentRate,
    dueDay: 15,
    isOverdue: false,
    overdueDays: 0,
    rateSource: preset.rateSource,
    rateUpdatedAt: preset.rateUpdatedAt,
    isManualRate: false,
    ...overrides,
  };
}

describe('Türkiye Borç Hesaplama Motoru - Doğruluk ve Tutarlılık Testleri', () => {
  it('1. Tek borçlu kullanıcı için BSMV (%15) ve KKDF (%15) dahil kesin kuruş tutarlılığı sağlar', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Kredi Kartı',
      type: 'credit_card',
      balance: 30000,
      contractualRate: 3.75,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 20,
    });

    const result = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 10000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
    });

    expect(result.isPayable).toBe(true);
    expect(result.firstMonthPayment).toBe(10000);
    // 1. ay faiz = 30000 * 0.0375 = 1125; BSMV = 168.75; KKDF = 168.75; Toplam maliyet = 1462.50
    expect(result.schedule[0].accruedInterest).toBe(1125);
    expect(result.schedule[0].bsmv).toBe(168.75);
    expect(result.schedule[0].kkdf).toBe(168.75);
    expect(result.schedule[0].totalFinanceCharge).toBe(1462.5);
    expect(result.schedule[0].principalPaid).toBe(8537.5);
    // Kuruş toplam mutabakatı: Toplam Ödeme == Toplam Anapara + Toplam Faiz ve Vergi
    expect(roundKurus(result.totalPrincipal + result.totalInterestAndTaxes)).toBe(result.totalPaid);
  });

  it('2. Birden fazla borcu olan kullanıcıda tüm borçların kapanışını takip eder', () => {
    const debts = [
      makeDebt({ id: 'd1', name: 'Kart A', balance: 15000, contractualRate: 3.25 }),
      makeDebt({ id: 'd2', name: 'KMH B', type: 'kmh', balance: 25000, contractualRate: 4.25 }),
      makeDebt({ id: 'd3', name: 'Kredi C', type: 'consumer_loan', balance: 40000, contractualRate: 3.99, remainingInstallments: 10 }),
    ];

    const comparison = compareAllStrategies({
      debts,
      monthlyBudget: 25000,
      tariffPeriod: 'nov_2026',
      calculationMode: 'fixed',
    });

    expect(comparison.totalDebt).toBe(80000);
    expect(comparison.strategies.fast_budget.isPayable).toBe(true);
    expect(comparison.strategies.fast_budget.debtPayoffOrder.length).toBe(3);
    expect(comparison.strategies.fast_budget.schedule.at(-1)?.endBalance).toBe(0);
  });

  it('3. Faiz oranları farklı borçlarda Çığ (Avalanche) yöntemi Kartopu yönteminden daha az veya eşit toplam faiz üretir', () => {
    const debts = [
      makeDebt({ id: 'low_bal_low_rate', name: 'Düşük Faizli Küçük Borç', type: 'other', balance: 20000, contractualRate: 1.0, overdueRate: 1.0, bsmvRate: 0, kkdfRate: 0, minPaymentRate: 10 }),
      makeDebt({ id: 'high_bal_high_rate', name: 'Yüksek Faizli Büyük Borç', type: 'kmh', balance: 60000, contractualRate: 4.25, overdueRate: 4.55, bsmvRate: 15, kkdfRate: 15, minPaymentRate: 10 }),
    ];

    const comparison = compareAllStrategies({
      debts,
      monthlyBudget: 18000,
      tariffPeriod: 'nov_2026',
      calculationMode: 'fixed',
    });

    expect(comparison.strategies.avalanche.isPayable).toBe(true);
    expect(comparison.strategies.snowball.isPayable).toBe(true);
    // Çığ önce %4.25+vergi borcu hedeflediği için toplam maliyeti daha düşüktür
    expect(comparison.strategies.avalanche.totalInterestAndTaxes).toBeLessThan(
      comparison.strategies.snowball.totalInterestAndTaxes
    );
    // Kartopu önce 20.000 TL borcu bitirdiği için ilk borç kapanış ayı daha erkendir
    const snowballFirstPayoff = comparison.strategies.snowball.debtPayoffOrder.find((d) => d.debtId === 'low_bal_low_rate')!.payoffMonth;
    const avalancheFirstPayoff = comparison.strategies.avalanche.debtPayoffOrder.find((d) => d.debtId === 'low_bal_low_rate')!.payoffMonth;
    expect(snowballFirstPayoff).toBeLessThan(avalancheFirstPayoff);
  });

  it('4. Aylık bütçesi asgari ödemeyi karşılamayan kullanıcıda bütçeyi aşmaz ve açığı net gösterir', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Kredi Kartı',
      balance: 100000,
      contractualRate: 3.75,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 20, // Asgari 20.000 TL
    });

    const comparison = compareAllStrategies({
      debts: [debt],
      monthlyBudget: 8000, // Asgariden düşük!
      tariffPeriod: 'nov_2026',
      calculationMode: 'fixed',
    });

    const fast = comparison.strategies.fast_budget;
    const min = comparison.strategies.minimum;

    expect(fast.firstMonthPayment).toBeLessThanOrEqual(8000);
    expect(min.firstMonthPayment).toBeLessThanOrEqual(8000);
    expect(fast.isUnderMinimum).toBe(true);
    expect(fast.minimumRequiredFirstMonth).toBe(20000);
    expect(fast.budgetShortfallFirstMonth).toBe(12000);
  });

  it('5. Aylık bütçesi yüksek olan kullanıcı borcu hızlı kapatır ve ciddi faiz tasarrufu sağlar', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Kredi Kartı',
      balance: 100000,
      contractualRate: 3.75,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 20,
    });

    const comparison = compareAllStrategies({
      debts: [debt],
      monthlyBudget: 50000,
      tariffPeriod: 'nov_2026',
      calculationMode: 'revolving',
    });

    expect(comparison.strategies.fast_budget.monthsToPayoff).toBeLessThan(
      comparison.strategies.minimum.monthsToPayoff
    );
    expect(comparison.strategies.fast_budget.interestSavedVsMinimum).toBeGreaterThan(0);
    expect(comparison.strategies.fast_budget.monthsToPayoff).toBeLessThanOrEqual(3);
  });

  it('6. Faizsiz ve vergisiz borçta toplam faiz/vergi maliyeti sıfırdır', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Elden Borç',
      type: 'other',
      balance: 24000,
      contractualRate: 0,
      overdueRate: 0,
      bsmvRate: 0,
      kkdfRate: 0,
      minPaymentRate: 10,
    });

    const res = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 6000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
    });

    expect(res.totalInterestAndTaxes).toBe(0);
    expect(res.totalPaid).toBe(24000);
    expect(res.monthsToPayoff).toBe(4);
  });

  it('7. Sıfır bakiyede tüm sonuçlar sıfır ve borç yok olarak döner', () => {
    const debt = makeDebt({ id: 'd1', name: 'Boş Kart', balance: 0 });
    const comparison = compareAllStrategies({
      debts: [debt],
      monthlyBudget: 15000,
      tariffPeriod: 'nov_2026',
      calculationMode: 'fixed',
    });

    expect(comparison.totalDebt).toBe(0);
    expect(comparison.strategies.fast_budget.monthsToPayoff).toBe(0);
    expect(comparison.strategies.fast_budget.totalPaid).toBe(0);
    expect(comparison.strategies.fast_budget.estimatedPayoffDate).toBe('Borç Bulunmuyor');
  });

  it('8. Erken kapatma (yüksek gerçekleşen ödeme) toplam faizi düşürür ve süreyi kısaltır', () => {
    const debt = makeDebt({ id: 'd1', name: 'Kart', balance: 60000, contractualRate: 3.75 });

    const baseline = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 12000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
    });

    const earlyClose = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 12000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
      actualLogs: {
        1: { month: 1, isPaid: true, actualAmount: 62925 }, // 1. ayda tam kapatma
      },
    });

    expect(earlyClose.monthsToPayoff).toBe(1);
    expect(earlyClose.totalInterestAndTaxes).toBeLessThan(baseline.totalInterestAndTaxes);
    expect(earlyClose.schedule[0].endBalance).toBe(0);
  });

  it('9. Ara ödeme eklendiğinde toplam vade ve toplam faiz azalır', () => {
    const debt = makeDebt({ id: 'd1', name: 'Kart', balance: 80000, contractualRate: 3.75 });

    const baseline = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 12000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
    });

    const withInterim = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 12000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
      extraPayments: [{ id: 'ex1', month: 2, amount: 25000, note: 'Prim ödemesi' }],
    });

    expect(withInterim.monthsToPayoff).toBeLessThan(baseline.monthsToPayoff);
    expect(withInterim.totalInterestAndTaxes).toBeLessThan(baseline.totalInterestAndTaxes);
    expect(withInterim.schedule[1].extraPayment).toBe(25000);
  });

  it('10. Gecikmiş borçta gecikme günü ve gecikme faizi gün bazlı olarak işler', () => {
    const normalDebt = makeDebt({
      id: 'd1',
      name: 'Normal',
      balance: 30000,
      contractualRate: 3.75,
      overdueRate: 4.05,
      isOverdue: false,
      overdueDays: 0,
    });

    const overdueDebt = makeDebt({
      id: 'd2',
      name: 'Gecikmiş',
      balance: 30000,
      contractualRate: 3.75,
      overdueRate: 4.05,
      isOverdue: true,
      overdueDays: 15,
    });

    const cNormal = calculateMonthlyFinanceCharges(30000, normalDebt, 1);
    const cOverdue = calculateMonthlyFinanceCharges(30000, overdueDebt, 1);

    expect(cOverdue.overdueInterest).toBe(607.5); // 30000 * 0.0405 * (15/30) = 607.50
    expect(cOverdue.totalFinanceCharge).toBeGreaterThan(cNormal.totalFinanceCharge);
  });

  it('11. Ödeme yapılmayan (atlanan) ay sonraki ayda gecikme faizi doğurur ve toplam maliyeti artırır', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Kart',
      balance: 50000,
      contractualRate: 3.75,
      overdueRate: 4.05,
    });

    const regular = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 15000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
    });

    const skippedMonth1 = simulateMultiDebtStrategy({
      debts: [debt],
      monthlyBudget: 15000,
      strategy: 'fast_budget',
      calculationMode: 'fixed',
      actualLogs: {
        1: { month: 1, isPaid: false, isSkipped: true, actualAmount: 0 },
      },
    });

    expect(skippedMonth1.schedule[0].effectivePayment).toBe(0);
    expect(skippedMonth1.schedule[0].isOverdueMonth).toBe(true);
    expect(skippedMonth1.schedule[1].overdueInterest).toBeGreaterThan(0);
    expect(skippedMonth1.totalInterestAndTaxes).toBeGreaterThan(regular.totalInterestAndTaxes);
  });

  it('12. Bir borç kapandığında serbest kalan bütçe otomatik olarak diğer borca aktarılır (Kartopu devri)', () => {
    const debts = [
      makeDebt({ id: 'small', name: 'Küçük Borç', type: 'other', balance: 5000, contractualRate: 2.0, overdueRate: 2.0, bsmvRate: 0, kkdfRate: 0, minPaymentRate: 20 }),
      makeDebt({ id: 'big', name: 'Büyük Borç', type: 'other', balance: 40000, contractualRate: 2.0, overdueRate: 2.0, bsmvRate: 0, kkdfRate: 0, minPaymentRate: 10 }),
    ];

    const res = simulateMultiDebtStrategy({
      debts,
      monthlyBudget: 10000,
      strategy: 'snowball',
      calculationMode: 'fixed',
    });

    // 1. ayda büyük borcun asgarisi (4000) korunur, küçük borç 5000 + 100 faiz = 5100 ile tamamen kapanır; kalan 900 büyük borca eklenir (toplam 4900)
    expect(res.schedule[0].debtBreakdowns.find((b) => b.debtId === 'small')?.endBalance).toBe(0);
    expect(res.schedule[0].debtBreakdowns.find((b) => b.debtId === 'big')?.plannedPayment).toBe(4900);
    // 2. ayda tüm 10000 TL bütçe büyük borca aktarılır
    expect(res.schedule[1].debtBreakdowns.find((b) => b.debtId === 'big')?.plannedPayment).toBe(10000);
  });

  it('13. KRİTİK TUTARSIZLIK KONTROLÜ: Aylık bütçe 0 TL iken hiçbir planda 5.400 TL gibi hayali ilk ödeme görünmez', () => {
    const debt = makeDebt({
      id: 'd1',
      name: 'Borç',
      balance: 27000, // Eskiden %20=5400, %40=10800 çıkaran senaryo!
      contractualRate: 3.75,
      minPaymentRate: 20,
    });

    const comparison = compareAllStrategies({
      debts: [debt],
      monthlyBudget: 0,
      tariffPeriod: 'nov_2026',
      calculationMode: 'fixed',
    });

    for (const s of Object.values(comparison.strategies)) {
      expect(s.firstMonthPayment).toBe(0);
      expect(s.isPayable).toBe(false);
      expect(s.budgetShortfallFirstMonth).toBe(5400);
      expect(s.minimumRequiredFirstMonth).toBe(5400);
    }
  });

  it('14. Borç yapılandırma simülasyonu doğru taksit ve vergi hesabı yapar', () => {
    const res = simulateRestructuring(
      100000,
      15000,
      {
        enabled: true,
        monthlyRate: 2.94,
        termMonths: 12,
        bsmvRate: 15,
        kkdfRate: 15,
        sourceLabel: 'Yapılandırma',
      },
      50000
    );

    expect(res).not.toBeNull();
    expect(res!.monthlyInstallment).toBeGreaterThan(10000);
    expect(res!.totalPaid).toBe(roundKurus(100000 + res!.totalInterestAndTaxes));
  });
});
