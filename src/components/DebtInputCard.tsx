import React, { useState } from 'react';
import {
  Wallet,
  CreditCard,
  Percent,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
} from 'lucide-react';
import { DebtItem } from '../types/debt';

interface DebtInputCardProps {
  income: number;
  setIncome: (val: number) => void;
  debt: number;
  setDebt: (val: number) => void;
  monthlyInterestRate: number;
  setMonthlyInterestRate: (val: number) => void;
  debtsList: DebtItem[];
  setDebtsList: React.Dispatch<React.SetStateAction<DebtItem[]>>;
  calculationMode: 'fixed' | 'revolving';
  setCalculationMode: (mode: 'fixed' | 'revolving') => void;
  onCalculate: () => void;
}

export const DebtInputCard: React.FC<DebtInputCardProps> = ({
  income,
  setIncome,
  debt,
  setDebt,
  monthlyInterestRate,
  setMonthlyInterestRate,
  debtsList,
  setDebtsList,
  calculationMode,
  setCalculationMode,
  onCalculate,
}) => {
  const [showItemized, setShowItemized] = useState(debtsList.length > 0);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');

  const handleAddDebtItem = () => {
    const amountNum = parseFloat(newItemAmount);
    if (!amountNum || amountNum <= 0) return;

    const newItem: DebtItem = {
      id: Date.now().toString(),
      name: newItemName.trim() || `Borç ${debtsList.length + 1}`,
      amount: amountNum,
    };

    const updated = [...debtsList, newItem];
    setDebtsList(updated);
    const total = updated.reduce((sum, item) => sum + item.amount, 0);
    setDebt(total);

    setNewItemName('');
    setNewItemAmount('');
  };

  const handleRemoveDebtItem = (id: string) => {
    const updated = debtsList.filter((item) => item.id !== id);
    setDebtsList(updated);
    const total = updated.reduce((sum, item) => sum + item.amount, 0);
    setDebt(total);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Borç ve Ödeme Bilgileri
          </h2>
          <p className="text-xs text-gray-500">
            Aylık ödeyebileceğiniz tutarı ve toplam borcunuzu girin
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowItemized(!showItemized)}
          className="text-xs text-gray-700 hover:text-gray-900 font-medium flex items-center gap-1 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200 transition cursor-pointer"
        >
          {showItemized ? (
            <>
              Basit Girişe Dön <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Borçları Tek Tek Ayır <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Payable Budget Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Aylık Ödeyebileceğim Tutar (₺)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-medium">
              ₺
            </div>
            <input
              type="number"
              min="0"
              step="500"
              value={income === 0 ? '' : income}
              onChange={(e) => setIncome(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="Örn: 20000"
              className="w-full bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg py-2.5 pl-8 pr-4 text-gray-900 text-sm font-medium placeholder-gray-400 transition outline-none"
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3 text-gray-400" /> Her ay borç ödemeye ayırabileceğiniz bütçe
          </p>
        </div>

        {/* Debt Input (Total) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-700">
              Toplam Borç Tutarı (₺)
            </label>
            {debtsList.length > 0 && (
              <span className="text-xs text-gray-500 font-mono">
                {debtsList.length} kalem toplandı
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 font-medium">
              ₺
            </div>
            <input
              type="number"
              min="0"
              step="1000"
              disabled={debtsList.length > 0 && showItemized}
              value={debt === 0 ? '' : debt}
              onChange={(e) => setDebt(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="Örn: 100000"
              className={`w-full bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg py-2.5 pl-8 pr-4 text-gray-900 text-sm font-medium placeholder-gray-400 transition outline-none ${
                debtsList.length > 0 && showItemized ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''
              }`}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-gray-400" /> Kart, kredi veya diğer borçlarınızın toplamı
          </p>
        </div>
      </div>

      {/* Itemized Debt Sub-List if toggled */}
      {showItemized && (
        <div className="mt-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
          <h3 className="text-xs font-semibold text-gray-700 mb-2">
            Borç Kalemleri
          </h3>

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              placeholder="Borç Adı (Örn: Banka Kartı)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 outline-none"
            />
            <div className="relative w-full sm:w-40">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 text-xs">
                ₺
              </span>
              <input
                type="number"
                placeholder="Tutar"
                value={newItemAmount}
                onChange={(e) => setNewItemAmount(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-6 pr-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-gray-900 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAddDebtItem}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-medium transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Ekle
            </button>
          </div>

          {debtsList.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {debtsList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-200 text-xs"
                >
                  <span className="font-medium text-gray-800">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-900 font-semibold">
                      {item.amount.toLocaleString('tr-TR')} ₺
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDebtItem(item.id)}
                      className="text-gray-400 hover:text-red-600 p-1 transition cursor-pointer"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic py-1">
              Henüz kalem eklenmedi. Yukarıdan tek tek ekleyebilir veya ana alana toplamı yazabilirsiniz.
            </p>
          )}
        </div>
      )}

      {/* Advanced Parameters */}
      <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-700 font-medium flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-gray-500" />
              Aylık Faiz Oranı
            </span>
            <span className="text-gray-900 font-bold font-mono">
              %{monthlyInterestRate.toFixed(2)} / ay
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="10"
              step="0.05"
              value={monthlyInterestRate}
              onChange={(e) => setMonthlyInterestRate(parseFloat(e.target.value) || 0)}
              className="w-full accent-gray-900 h-1.5 bg-gray-200 rounded-lg cursor-pointer"
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>%0 (Faizsiz)</span>
            <span>%4.25 (TCMB Referans)</span>
            <span>%10</span>
          </div>
        </div>

        <div>
          <span className="block text-xs text-gray-700 font-medium mb-1">
            Hesaplama Yöntemi
          </span>
          <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setCalculationMode('fixed')}
              className={`py-1.5 px-2 rounded-md font-medium transition text-center cursor-pointer ${
                calculationMode === 'fixed'
                  ? 'bg-white text-gray-900 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sabit Taksit
            </button>
            <button
              type="button"
              onClick={() => setCalculationMode('revolving')}
              className={`py-1.5 px-2 rounded-md font-medium transition text-center cursor-pointer ${
                calculationMode === 'revolving'
                  ? 'bg-white text-gray-900 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Dönen Asgari
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            {calculationMode === 'fixed'
              ? 'Tavsiye: Her ay borcun %20 veya %40 tutarını sabit öder, borcu hızla kapatır.'
              : 'Ekstre Mantığı: Her ay azalan güncel borcun %20 veya %40 tutarını öder.'}
          </p>
        </div>
      </div>

      {/* Main Calculate Button */}
      <div className="mt-5">
        <button
          type="button"
          onClick={onCalculate}
          className="w-full bg-gray-900 hover:bg-black text-white font-semibold text-sm py-3 px-6 rounded-lg shadow-sm transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>HESAPLA</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
