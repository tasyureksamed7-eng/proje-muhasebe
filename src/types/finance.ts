export type DebtType =
  | 'credit_card'
  | 'consumer_loan'
  | 'installment_loan'
  | 'kmh'
  | 'cash_advance'
  | 'overdue'
  | 'other';

export type TariffPeriod = 'nov_2026' | 'dec_2026';

export type CalculationMode = 'fixed' | 'revolving';

export type StrategyType =
  | 'minimum'
  | 'fast_budget'
  | 'snowball'
  | 'avalanche'
  | 'custom';

export interface DebtItem {
  id: string;
  name: string;
  type: DebtType;
  balance: number; // Kalan anapara / güncel borç (₺)
  creditLimit?: number; // Kredi kartı limiti (BDDK asgari ödeme kademesi için)
  contractualRate: number; // Aylık akdi faiz oranı (%)
  overdueRate: number; // Aylık gecikme faizi oranı (%)
  bsmvRate: number; // BSMV oranı (%) — genelde 15 veya 0
  kkdfRate: number; // KKDF oranı (%) — genelde 15 veya 0
  minPaymentRate: number; // Asgari ödeme oranı (%)
  dueDay: number; // Ayın son ödeme günü (1-31)
  isOverdue: boolean; // Gecikmede mi?
  overdueDays: number; // Gecikme gün sayısı (gün bazlı faiz hesabı)
  remainingInstallments?: number; // Taksitli / İhtiyaç kredisi kalan vade (ay)
  monthlyInstallmentOverride?: number; // Banka sözleşme taksiti (isteğe bağlı)
  isPaidOff?: boolean; // Kullanıcı borcu kapandı olarak işaretledi mi
  rateSource: string; // Örn: "TCMB Kasım 2026 Tebliği" veya "Manuel Giriş"
  rateUpdatedAt: string; // Örn: "2026-11-01"
  isManualRate: boolean; // Kullanıcı manuel olarak değiştirdi mi
}

export interface ExtraPaymentEvent {
  id: string;
  month: number; // 1-based month index
  amount: number; // Ara ödeme / erken ödeme tutarı (₺)
  targetDebtId?: string; // Belirli bir borca veya strateji hedefine
  note?: string;
}

export interface ActualMonthLog {
  month: number;
  isPaid: boolean;
  isSkipped?: boolean; // Ödeme yapılmayan ay
  actualAmount?: number; // Kullanıcının ödediği gerçek tutar
  paidDate?: string;
  note?: string;
}

export interface RestructureConfig {
  enabled: boolean;
  monthlyRate: number; // Yapılandırma aylık faiz oranı (%)
  termMonths: number; // Vade (ay)
  bsmvRate: number;
  kkdfRate: number;
  sourceLabel: string;
}

export interface DebtMonthBreakdown {
  debtId: string;
  debtName: string;
  debtType: DebtType;
  startBalance: number;
  accruedInterest: number; // Akdi + Gecikme faizi
  contractualInterest: number;
  overdueInterest: number;
  bsmv: number;
  kkdf: number;
  minimumRequired: number;
  plannedPayment: number;
  principalPaid: number;
  interestAndTaxPaid: number;
  endBalance: number;
}

export interface MonthlyLedgerRow {
  month: number;
  monthLabel: string; // "Ara 2026", "Oca 2027" vb.
  startBalance: number;
  accruedInterest: number;
  contractualInterest: number;
  overdueInterest: number;
  bsmv: number;
  kkdf: number;
  totalFinanceCharge: number; // accruedInterest + bsmv + kkdf
  minimumRequired: number;
  plannedPayment: number;
  actualPayment: number | null; // Gerçekleşen ödeme (null ise henüz ödenmedi)
  effectivePayment: number; // Simülasyonda uygulanan ödeme (gerçekleşen varsa o, yoksa planlanan)
  extraPayment: number; // Ara ödeme + planlanan üzeri fazla ödeme
  principalPaid: number;
  interestAndTaxPaid: number;
  endBalance: number;
  interestSavedThisMonth: number;
  isPaid: boolean;
  isSkipped: boolean;
  isOverdueMonth: boolean;
  debtBreakdowns: DebtMonthBreakdown[];
}

export interface StrategyResult {
  strategy: StrategyType;
  label: string;
  shortLabel: string;
  description: string;
  monthsToPayoff: number;
  estimatedPayoffDate: string;
  isPayable: boolean; // Bütçe borcu kapatmaya yetiyor mu?
  reachedMaxCap: boolean; // 360 ay sınırına ulaşıldı mı?
  isUnderMinimum: boolean; // Bütçe asgari ödemenin altında kalıyor mu?
  budgetShortfallFirstMonth: number; // İlk ay bütçe açığı (varsa)
  minimumRequiredFirstMonth: number; // İlk ay gereken toplam asgari
  firstMonthPayment: number;
  averageMonthlyPayment: number;
  totalPrincipal: number;
  totalContractualInterest: number;
  totalOverdueInterest: number;
  totalBsmv: number;
  totalKkdf: number;
  totalInterestAndTaxes: number;
  totalPaid: number;
  interestSavedVsMinimum: number;
  monthsSavedVsMinimum: number;
  savingsPercentageVsMinimum: number;
  incomeRatio: number; // İlk ay ödemesi / Aylık bütçe (%)
  schedule: MonthlyLedgerRow[];
  debtPayoffOrder: {
    debtId: string;
    debtName: string;
    payoffMonth: number;
    payoffDate: string;
    totalInterestAndTaxPaid: number;
  }[];
}

export interface RestructureResult {
  monthlyInstallment: number;
  totalInterest: number;
  totalBsmv: number;
  totalKkdf: number;
  totalInterestAndTaxes: number;
  totalPaid: number;
  termMonths: number;
  estimatedPayoffDate: string;
  isWithinBudget: boolean;
  savingsVsCurrentMinimum: number;
  effectiveMonthlyRateWithTaxes: number;
}

export interface AllStrategiesComparison {
  totalDebt: number;
  monthlyBudget: number;
  tariffPeriod: TariffPeriod;
  strategies: Record<StrategyType, StrategyResult>;
  lowestCostStrategy: StrategyType | null;
  fastestStrategy: StrategyType | null;
  restructureResult: RestructureResult | null;
}

export interface SavedPlanSnapshot {
  id: string;
  name: string;
  createdAt: string;
  tariffPeriod: TariffPeriod;
  monthlyBudget: number;
  calculationMode: CalculationMode;
  selectedStrategy: StrategyType;
  debts: DebtItem[];
  extraPayments: ExtraPaymentEvent[];
  actualLogs: Record<number, ActualMonthLog>;
  customPriorityOrder: string[];
  restructureConfig: RestructureConfig;
  summarySnapshot: {
    totalDebt: number;
    totalInterestAndTaxes: number;
    totalPaid: number;
    monthsToPayoff: number;
    estimatedPayoffDate: string;
    firstMonthPayment: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  isGuest: boolean;
  createdAt: string;
  monthlyBudget: number;
  tariffPeriod: TariffPeriod;
  calculationMode: CalculationMode;
  selectedStrategy: StrategyType;
  debts: DebtItem[];
  extraPayments: ExtraPaymentEvent[];
  actualLogs: Record<number, ActualMonthLog>;
  customPriorityOrder: string[];
  restructureConfig: RestructureConfig;
  savedPlans: SavedPlanSnapshot[];
}
