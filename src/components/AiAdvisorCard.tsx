import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  RotateCcw,
  Bot,
  User,
} from 'lucide-react';
import { DebtItem } from '../types/debt';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface AiAdvisorCardProps {
  debt: number;
  income: number;
  monthlyInterestRate: number;
  debtsList: DebtItem[];
}

export const AiAdvisorCard: React.FC<AiAdvisorCardProps> = ({
  debt,
  income,
  monthlyInterestRate,
  debtsList,
}) => {
  const formattedDebt = debt.toLocaleString('tr-TR');
  const formattedPayable = income.toLocaleString('tr-TR');

  const getInitialMessage = (): ChatMessage => ({
    id: 'welcome',
    role: 'model',
    text: `Merhaba! ${formattedDebt} ₺ toplam borcunuz ve aylık ${formattedPayable} ₺ ödeyebileceğiniz bütçeniz için buradayım. Borcunuzu en hızlı nasıl kapatabileceğinizi, hangi karttan başlamanız gerektiğini veya aklınıza takılan herhangi bir finansal konuyu sorabilirsiniz.`,
    timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([getInitialMessage()]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [getInitialMessage()];
      }
      return prev;
    });
  }, [debt, income, monthlyInterestRate]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputText;
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    if (debt <= 0) {
      setError('Lütfen önce borç tutarınızı girin.');
      return;
    }

    setError(null);
    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      timestamp: nowTime,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const apiHistory = updatedMessages
        .slice(1, -1)
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: apiHistory,
          income,
          debt,
          monthlyInterestRate,
          debtsList,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Yapay zeka yanıt veremedi.');
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Bağlantı hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([getInitialMessage()]);
    setError(null);
    setInputText('');
  };

  const quickQuestions = [
    'Borcumu en hızlı nasıl kapatırım?',
    'Aylık ödeyebileceğim tutar yeterli mi?',
    'Kredi kartlarını mı krediyi mi önce kapatmalıyım?',
    'Borçları tek bir kredide toplamak mantıklı mı?',
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            AI Danışmanı
          </h2>
          <p className="text-xs text-gray-500">
            Borç ve bütçenize göre anlık finansal sorularınızı yanıtlar
          </p>
        </div>

        <button
          type="button"
          onClick={handleResetChat}
          className="text-xs text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 transition flex items-center gap-1 cursor-pointer"
          title="Sohbeti temizle"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Temizle</span>
        </button>
      </div>

      {/* Quick Suggestion Chips */}
      <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[11px] text-gray-400 font-medium">Hızlı Sor:</span>
          {quickQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q)}
              disabled={isLoading || debt <= 0}
              className="text-xs text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 transition cursor-pointer disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="p-4 sm:p-5 space-y-3 min-h-[280px] max-h-[460px] overflow-y-auto bg-gray-50/40">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-medium ${
                  isUser
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              <div className={`max-w-[85%] sm:max-w-[78%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-3 rounded-xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gray-900 text-white rounded-tr-none'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-line font-sans">
                    {msg.text}
                  </div>
                </div>

                <div className={`flex items-center gap-1.5 text-[10px] text-gray-400 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
                      title="Kopyala"
                    >
                      {copiedId === msg.id ? (
                        <span className="text-emerald-600 flex items-center gap-0.5 font-medium">
                          <Check className="w-2.5 h-2.5" /> Kopyalandı
                        </span>
                      ) : (
                        <Copy className="w-2.5 h-2.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-md bg-gray-200 text-gray-700 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 rounded-xl rounded-tl-none bg-white border border-gray-200 text-gray-500 text-xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
              <span>Yanıt hazırlanıyor...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 bg-white border-t border-gray-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Bir soru yazın..."
            disabled={isLoading}
            className="w-full bg-white border border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 rounded-lg py-2.5 pl-3.5 pr-10 text-xs sm:text-sm text-gray-900 placeholder-gray-400 outline-none transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim() || debt <= 0}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-gray-900 hover:bg-black disabled:opacity-40 text-white rounded-md transition flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
            title="Gönder"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
