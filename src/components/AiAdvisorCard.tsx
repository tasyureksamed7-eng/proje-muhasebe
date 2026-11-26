import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import {
  AllStrategiesComparison,
  DebtItem,
  StrategyResult,
  StrategyType,
} from '../types/finance';
import { formatCurrencyTR } from '../engine/turkeyMath';
import { DEBT_TYPE_META, TARIFF_METADATA } from '../engine/turkeyRates';

interface AiAdvisorCardProps {
  comparison: AllStrategiesComparison;
  activeResult: StrategyResult;
  debts: DebtItem[];
  paidMonthsCount: number;
  skippedMonthsCount: number;
  totalActualPaid: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const QUICK_QUESTIONS = [
  'En mantıklı borç kapatma planı hangisi?',
  'Önce hangi borcu kapatmalıyım?',
  'Aylık bütçem yeterli mi?',
  'Bütçemi 2.000 TL artırırsam ne kadar sürede borçsuz kalırım?',
  'Asgari ödeme yaparsam toplam ne kadar zarar ederim?',
  'Borç yapılandırması mantıklı mı?',
  'En yüksek faiz yükü hangi borçta?',
  'Ödeme planımı nasıl daha verimli hale getirebilirim?',
];

export const AiAdvisorCard: React.FC<AiAdvisorCardProps> = ({
  comparison,
  activeResult,
  debts,
  paidMonthsCount,
  skippedMonthsCount,
  totalActualPaid,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Merhaba! Hesaplama motorunuzdaki güncel verileri inceledim. Toplam **${formatCurrencyTR(comparison.totalDebt)}** borcunuz ve **${formatCurrencyTR(comparison.monthlyBudget)}** aylık bütçeniz için hangi stratejinin size daha avantajlı olduğunu veya ödeme planınızı nasıl hızlandırabileceğinizi sorabilirsiniz.`,
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Scoped scroll inside chat box ONLY — never scrolls the outer browser window
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollChatRef = useRef(false);

  useEffect(() => {
    if (shouldScrollChatRef.current && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
      shouldScrollChatRef.current = false;
    }
  }, [messages, isLoading]);

  const handleSend = async (questionText?: string) => {
    const textToSend = (questionText ?? input).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: textToSend,
    };

    const nextHistory = [...messages, userMsg];
    shouldScrollChatRef.current = true;
    setMessages(nextHistory);
    if (!questionText) setInput('');
    setIsLoading(true);

    try {
      const payload = {
        message: textToSend,
        history: messages
          .filter((m) => m.id !== 'welcome')
          .map((m) => ({ role: m.role, text: m.text })),
        monthlyBudget: comparison.monthlyBudget,
        totalDebt: comparison.totalDebt,
        tariffLabel: TARIFF_METADATA[comparison.tariffPeriod].label,
        calculationMode: 'fixed',
        activeStrategy: {
          strategy: activeResult.strategy,
          label: activeResult.label,
          isPayable: activeResult.isPayable,
          monthsToPayoff: activeResult.monthsToPayoff,
          estimatedPayoffDate: activeResult.estimatedPayoffDate,
          minimumRequiredFirstMonth: activeResult.minimumRequiredFirstMonth,
          firstMonthPayment: activeResult.firstMonthPayment,
          budgetShortfallFirstMonth: activeResult.budgetShortfallFirstMonth,
          totalInterestAndTaxes: activeResult.totalInterestAndTaxes,
          totalPaid: activeResult.totalPaid,
          interestSavedVsMinimum: activeResult.interestSavedVsMinimum,
        },
        allStrategiesSummary: (['minimum', 'fast_budget', 'snowball', 'avalanche', 'custom'] as StrategyType[]).map(
          (st) => {
            const s = comparison.strategies[st];
            return {
              strategy: s.strategy,
              label: s.label,
              isPayable: s.isPayable,
              monthsToPayoff: s.monthsToPayoff,
              estimatedPayoffDate: s.estimatedPayoffDate,
              firstMonthPayment: s.firstMonthPayment,
              totalInterestAndTaxes: s.totalInterestAndTaxes,
              totalPaid: s.totalPaid,
              interestSavedVsMinimum: s.interestSavedVsMinimum,
            };
          }
        ),
        debts: debts
          .filter((d) => !d.isPaidOff && d.balance > 0)
          .map((d) => ({
            name: d.name,
            type: d.type,
            typeLabel: DEBT_TYPE_META[d.type].label,
            balance: d.balance,
            contractualRate: d.contractualRate,
            overdueRate: d.overdueRate,
            bsmvRate: d.bsmvRate,
            kkdfRate: d.kkdfRate,
            minPaymentRate: d.minPaymentRate,
            isOverdue: d.isOverdue,
            overdueDays: d.overdueDays,
            rateSource: d.rateSource,
          })),
        restructureResult: comparison.restructureResult,
        actualSummary: {
          paidMonthsCount,
          skippedMonthsCount,
          totalActualPaid,
        },
      };

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error('Sunucudan geçerli bir yanıt alınamadı.');
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Danışman yanıt veremedi.');
      }

      shouldScrollChatRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: data.reply,
        },
      ]);
    } catch (err: any) {
      shouldScrollChatRef.current = true;
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: err?.message || 'Bağlantı sırasında bir sorun oluştu. Lütfen tekrar deneyin.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={i} className={line.trim() === '' ? 'h-2' : 'leading-relaxed'}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={j} className="font-semibold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={j}>{part}</span>;
          })}
        </p>
      );
    });
  };

  return (
    <section id="danisman" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Yapay Zekâ Finans Danışmanı
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Yalnızca yukarıdaki hesaplama motorunuzun ürettiği gerçek veriler üzerinden yorum yapar; hayali faiz veya tasarruf üretmez.
          </p>
        </div>
      </div>

      {/* 8 Quick Questions */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={isLoading}
            onClick={() => handleSend(q)}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Area */}
      <div
        ref={chatContainerRef}
        className="h-80 sm:h-96 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50/50 p-3.5 sm:p-4 space-y-3"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'model' && (
              <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm space-y-1 ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              {msg.role === 'user' ? <p>{msg.text}</p> : renderFormattedText(msg.text)}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Motor verileriniz analiz ediliyor...</span>
          </div>
        )}
      </div>

      {/* Chat Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Borç planınız hakkında bir soru sorun..."
          disabled={isLoading}
          className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-900 min-h-[44px]"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors cursor-pointer min-h-[44px]"
        >
          <Send className="w-4 h-4" />
          <span className="hidden sm:inline">Gönder</span>
        </button>
      </form>
    </section>
  );
};
