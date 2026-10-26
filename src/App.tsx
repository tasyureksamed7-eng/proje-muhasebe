/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { DebtInputCard } from './components/DebtInputCard';
import { ComparisonCards } from './components/ComparisonCards';
import { AiAdvisorCard } from './components/AiAdvisorCard';
import { PayoffScheduleTable } from './components/PayoffScheduleTable';
import { DebtItem, ComparisonResult } from './types/debt';
import { calculateDebtPlans } from './utils/calculator';

export default function App() {
  const [income, setIncome] = useState<number>(20000);
  const [debt, setDebt] = useState<number>(100000);
  const [monthlyInterestRate, setMonthlyInterestRate] = useState<number>(4.25);
  const [calculationMode, setCalculationMode] = useState<'fixed' | 'revolving'>('fixed');
  const [debtsList, setDebtsList] = useState<DebtItem[]>([
    { id: '1', name: 'Kredi Kartı 1', amount: 50000 },
    { id: '2', name: 'Kredi Kartı 2', amount: 30000 },
    { id: '3', name: 'Kredili Mevduat (KMH)', amount: 20000 },
  ]);

  const [result, setResult] = useState<ComparisonResult>(() =>
    calculateDebtPlans(100000, 20000, 4.25, 'fixed')
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem('borc_butce_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.income === 'number') setIncome(parsed.income);
        if (typeof parsed.debt === 'number') setDebt(parsed.debt);
        if (typeof parsed.monthlyInterestRate === 'number')
          setMonthlyInterestRate(parsed.monthlyInterestRate);
        if (Array.isArray(parsed.debtsList)) setDebtsList(parsed.debtsList);
        if (parsed.calculationMode) setCalculationMode(parsed.calculationMode);

        setResult(
          calculateDebtPlans(
            parsed.debt || 100000,
            parsed.income || 20000,
            parsed.monthlyInterestRate || 4.25,
            parsed.calculationMode || 'fixed'
          )
        );
      }
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        'borc_butce_data',
        JSON.stringify({
          income,
          debt,
          monthlyInterestRate,
          debtsList,
          calculationMode,
        })
      );
    } catch (e) {
      console.warn(e);
    }
  }, [income, debt, monthlyInterestRate, debtsList, calculationMode]);

  const handleCalculate = () => {
    setResult(calculateDebtPlans(debt, income, monthlyInterestRate, calculationMode));
  };

  const handleReset = () => {
    setIncome(0);
    setDebt(0);
    setDebtsList([]);
    setMonthlyInterestRate(4.25);
    setCalculationMode('fixed');
    setResult(calculateDebtPlans(0, 0, 4.25, 'fixed'));
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans antialiased flex flex-col">
      <Header onReset={handleReset} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Input Card */}
        <DebtInputCard
          income={income}
          setIncome={setIncome}
          debt={debt}
          setDebt={setDebt}
          monthlyInterestRate={monthlyInterestRate}
          setMonthlyInterestRate={setMonthlyInterestRate}
          debtsList={debtsList}
          setDebtsList={setDebtsList}
          calculationMode={calculationMode}
          setCalculationMode={setCalculationMode}
          onCalculate={handleCalculate}
        />

        {/* Comparison Cards */}
        {debt > 0 ? (
          <ComparisonCards result={result} />
        ) : (
          <div className="p-8 text-center bg-white border border-gray-200 rounded-xl text-gray-500 text-xs">
            Hesaplama yapmak için yukarıdan borç tutarınızı girin.
          </div>
        )}

        {/* AI Advisor Chat */}
        <AiAdvisorCard
          debt={debt}
          income={income}
          monthlyInterestRate={monthlyInterestRate}
          debtsList={debtsList}
        />

        {/* Payoff Schedule Table */}
        {debt > 0 && result.plan40.monthlySchedule.length > 0 && (
          <PayoffScheduleTable result={result} />
        )}
      </main>

      <footer className="py-6 border-t border-gray-200 text-center text-xs text-gray-400">
        Verileriniz tarayıcınızda güvendedir ve gizli tutulur.
      </footer>
    </div>
  );
}
