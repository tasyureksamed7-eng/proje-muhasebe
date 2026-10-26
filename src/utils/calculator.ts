import { ComparisonResult, MonthRecord, PlanSummary } from '../types/debt';

/**
 * Calculates debt repayment projection for 20% and 40% payment strategies.
 * 
 * @param totalDebt Total debt amount in TRY
 * @param monthlyIncome Monthly net income in TRY
 * @param monthlyInterestRate Monthly interest rate (e.g. 4.25 for 4.25%)
 * @param calculationMode 'fixed' (fixed monthly payment based on initial debt) or 'revolving' (calculated each month on remaining balance)
 */
export function calculateDebtPlans(
  totalDebt: number,
  monthlyIncome: number,
  monthlyInterestRate: number = 4.25,
  calculationMode: 'fixed' | 'revolving' = 'fixed'
): ComparisonResult {
  const safeDebt = Math.max(0, totalDebt);
  const safeIncome = Math.max(0, monthlyIncome);
  const rateDecimal = Math.max(0, monthlyInterestRate) / 100;

  const plan20 = simulatePlan(
    safeDebt,
    safeIncome,
    20,
    rateDecimal,
    calculationMode
  );
  const plan40 = simulatePlan(
    safeDebt,
    safeIncome,
    40,
    rateDecimal,
    calculationMode
  );

  const interestSaved = Math.max(0, plan20.totalInterest - plan40.totalInterest);
  const monthsSaved = Math.max(0, plan20.monthsToPayoff - plan40.monthsToPayoff);
  const savingsPercentage =
    plan20.totalInterest > 0
      ? Math.round((interestSaved / plan20.totalInterest) * 100)
      : 0;

  return {
    debt: safeDebt,
    income: safeIncome,
    monthlyInterestRate,
    plan20,
    plan40,
    interestSaved,
    monthsSaved,
    savingsPercentage,
  };
}

function simulatePlan(
  initialDebt: number,
  income: number,
  percent: 20 | 40,
  monthlyRate: number,
  mode: 'fixed' | 'revolving'
): PlanSummary {
  if (initialDebt <= 0) {
    return {
      name: `%${percent} Ödeme Planı`,
      ratePercentage: percent,
      firstMonthPayment: 0,
      averageMonthlyPayment: 0,
      totalInterest: 0,
      totalPaid: 0,
      monthsToPayoff: 0,
      monthlySchedule: [],
      incomeRatio: 0,
      isSustainable: true,
    };
  }

  const fixedMonthlyPayment = initialDebt * (percent / 100);
  let currentBalance = initialDebt;
  let totalInterest = 0;
  let totalPaid = 0;
  let month = 0;
  const maxMonths = 360; // 30 years safety cap
  const schedule: MonthRecord[] = [];

  while (currentBalance > 0.5 && month < maxMonths) {
    month++;
    const startBalance = currentBalance;
    const interest = startBalance * monthlyRate;
    totalInterest += interest;

    let targetPayment: number;
    if (mode === 'fixed') {
      targetPayment = fixedMonthlyPayment;
    } else {
      // Revolving: % of current balance including interest, with a minimum floor of 500 TL or 5%
      targetPayment = Math.max(startBalance * (percent / 100), 500);
    }

    // You cannot pay more than the total remaining plus interest
    const fullPayoff = startBalance + interest;
    const actualPayment = Math.min(targetPayment, fullPayoff);

    const principalPaid = Math.max(0, actualPayment - interest);
    currentBalance = Math.max(0, fullPayoff - actualPayment);
    totalPaid += actualPayment;

    schedule.push({
      month,
      startBalance: Math.round(startBalance),
      interestCharged: Math.round(interest),
      payment: Math.round(actualPayment),
      principalPaid: Math.round(principalPaid),
      endBalance: Math.round(currentBalance),
    });

    // Check if repayment is mathematically impossible (payment <= interest)
    if (actualPayment <= interest && currentBalance >= startBalance) {
      break;
    }
  }

  const firstMonthPayment = schedule.length > 0 ? schedule[0].payment : 0;
  const averageMonthlyPayment = month > 0 ? Math.round(totalPaid / month) : 0;
  const incomeRatio = income > 0 ? Math.round((firstMonthPayment / income) * 100) : 0;
  const isSustainable = income > 0 ? firstMonthPayment <= income : true;

  return {
    name: percent === 20 ? 'Asgari Yol (%20)' : 'Hızlı Kurtuluş (%40)',
    ratePercentage: percent,
    firstMonthPayment,
    averageMonthlyPayment,
    totalInterest: Math.round(totalInterest),
    totalPaid: Math.round(totalPaid),
    monthsToPayoff: month,
    monthlySchedule: schedule,
    incomeRatio,
    isSustainable,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}
