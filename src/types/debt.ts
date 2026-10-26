export interface DebtItem {
  id: string;
  name: string;
  amount: number;
  interestRate?: number; // Aylık faiz oranı (%)
}

export interface MonthRecord {
  month: number;
  startBalance: number;
  interestCharged: number;
  payment: number;
  principalPaid: number;
  endBalance: number;
}

export interface PlanSummary {
  name: string;
  ratePercentage: number; // 20 or 40
  firstMonthPayment: number;
  averageMonthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
  monthsToPayoff: number;
  monthlySchedule: MonthRecord[];
  incomeRatio: number; // Ödeme / Gelir (%)
  isSustainable: boolean;
}

export interface ComparisonResult {
  debt: number;
  income: number;
  monthlyInterestRate: number;
  plan20: PlanSummary;
  plan40: PlanSummary;
  interestSaved: number;
  monthsSaved: number;
  savingsPercentage: number;
}
