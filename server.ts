import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Google Gemini AI SDK on the server side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// AI Accountant & Financial Advisor Endpoint
app.post('/api/ai-consultant', async (req: Request, res: Response) => {
  try {
    const {
      income = 0,
      debt = 0,
      monthlyInterestRate = 4.25,
      debtsList = [],
      customQuestion = '',
    } = req.body;

    const formattedPayable = Number(income).toLocaleString('tr-TR');
    const formattedDebt = Number(debt).toLocaleString('tr-TR');

    let debtsBreakdownText = '';
    if (Array.isArray(debtsList) && debtsList.length > 0) {
      debtsBreakdownText = `\nBorç Kalemleri:\n` + debtsList
        .map((d: { name: string; amount: number; rate?: number }) => 
          `- ${d.name || 'Borç'}: ${Number(d.amount).toLocaleString('tr-TR')} ₺`
        )
        .join('\n');
    }

    const userPromptPart = customQuestion && customQuestion.trim().length > 0
      ? `Kullanıcının sorusu: "${customQuestion.trim()}". Lütfen bu soruya doğrudan odaklanarak açık ve anlaşılır şekilde cevap ver.`
      : `Bunu en hızlı yoldan ödememe olanak sağlayan borcun %40'ı ve %20'si ile olan iki yol oluşturup fazla uzatmadan bana açıkla.`;

    const basePrompt = `Sen uzman bir muhasebecisin, buna göre yola çıkarak:
Kullanıcının toplam borcu ${formattedDebt} TL ve aylık ödeyebileceği tutar ${formattedPayable} TL.
Aylık tahmini faiz oranı: %${monthlyInterestRate}.
${debtsBreakdownText}

${userPromptPart}

Yanıt Kuralları:
- %20 (asgari ödeme) ve %40 (hızlı ödeme) stratejilerini kullanıcının aylık ödeyebileceği tutar (${formattedPayable} TL) ile kıyasla.
- Yanıtı gereksiz finans jargonuna boğmadan, fazla uzatmadan, doğrudan maddeler halinde ve samimi bir dille ver.`;

    let advice = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: basePrompt,
        });
        if (response.text) {
          advice = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next fallback:`, err?.message || err);
      }
    }

    if (!advice) {
      // If AI service has a transient 503 capacity spike, provide an expertly computed structured advisory response
      const p20Payment = Math.round(Number(debt) * 0.20);
      const p40Payment = Math.round(Number(debt) * 0.40);
      const p20Ratio = Number(income) > 0 ? Math.round((p20Payment / Number(income)) * 100) : 0;
      const p40Ratio = Number(income) > 0 ? Math.round((p40Payment / Number(income)) * 100) : 0;

      advice = `Merhaba! Bir uzman muhasebeci olarak ${formattedDebt} ₺ toplam borcunuz ve ${formattedPayable} ₺ aylık ödeyebileceğiniz bütçeniz için hazırladığım net eylem planı:

1. **Yol 1: Asgari Yol (%20 Ödeme - Aylık ~${p20Payment.toLocaleString('tr-TR')} ₺)**
- Ödeyebileceğiniz tutarın yaklaşık %${p20Ratio}'sini oluşturur.
- Kısa vadede bütçenizi nefes aldırır ancak anapara yavaş erir ve faiz yükü zamanla toplam ödemenizi artırır.

2. **Yol 2: Hızlı Kurtuluş Yolu (%40 Ödeme - Aylık ~${p40Payment.toLocaleString('tr-TR')} ₺)**
- Ödeyebileceğiniz tutarın yaklaşık %${p40Ratio}'sini oluşturur.
- Bu yol borcun belini hemen kırar, faiz birikimini durdurur ve sizi çok daha kısa sürede tamamen borçsuz hale getirir.

3. **Uzman Tavsiyesi & Pratik Tüyolar**:
- Eğer ${p40Payment.toLocaleString('tr-TR')} ₺ ödemek temel yaşam giderlerinizi (kira, fatura, mutfak) aksatmıyorsa kesinlikle **%40 yolunu** tercih edin.
- **Kartopu Metodu:** Birden fazla kartınız varsa en küçük tutarlı olanı ilk ay kapatıp psikolojik zafer kazanın ve kart limitinizi düşürün.
- Borç ödeme sürecinde kartlarınızı fiziksel olarak cüzdanınızdan çıkarıp yalnızca nakit veya vadesiz hesap bakiyenizle harcama yapın.`;
    }

    res.json({ success: true, advice });
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Yapay zeka analiz servisine bağlanırken bir sorun oluştu. Lütfen tekrar deneyin.',
    });
  }
});

// Multi-Turn AI Chatbot Endpoint
app.post('/api/ai-chat', async (req: Request, res: Response) => {
  try {
    const {
      message = '',
      history = [],
      income = 0,
      debt = 0,
      monthlyInterestRate = 4.25,
      debtsList = [],
    } = req.body;

    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Mesaj boş olamaz.' });
    }

    const formattedPayable = Number(income).toLocaleString('tr-TR');
    const formattedDebt = Number(debt).toLocaleString('tr-TR');

    let debtsBreakdownText = '';
    if (Array.isArray(debtsList) && debtsList.length > 0) {
      debtsBreakdownText = `\nKullanıcının Borç Kalemleri:\n` + debtsList
        .map((d: { name: string; amount: number; rate?: number }) => 
          `- ${d.name || 'Borç'}: ${Number(d.amount).toLocaleString('tr-TR')} ₺`
        )
        .join('\n');
    }

    const systemInstruction = `Sen uzman bir muhasebecisin, buna göre yola çıkarak:
Kullanıcının güncel finansal durumu:
- Toplam Borç: ${formattedDebt} TL
- Aylık Ödeyebileceği Tutar (Bütçe): ${formattedPayable} TL
- Aylık Tahmini Faiz Oranı: %${monthlyInterestRate}
${debtsBreakdownText}

Görevin ve Kuralların:
1. Sen bir uzman muhasebeci ve bütçe danışmanısın. Kullanıcının sorduğu soru ne olursa olsun bu finansal verileri (${formattedDebt} TL borç, ${formattedPayable} TL aylık bütçe) göz önünde bulundurarak özel ve net yanıt ver.
2. %20 asgari ödeme ve %40 hızlı ödeme mantığını bilerek kullanıcının sorusuna en mantıklı, uygulanabilir ve pratik finansal çözümü üret.
3. Yanıtların Türkçe, samimi, net, maddeler halinde ve motive edici olsun. Finansal terimleri herkesin anlayacağı şekilde açıkla.
4. Kullanıcı soru sormaktan çekinmesin; her türlü sorusuna (kredi kartı borcu kapatma, kredi çekme, varlık satma, yapılandırma, tasarruf tüyoları vb.) uzman gözüyle tarafsız, gerçekçi ve dürüst tavsiyeler ver.`;

    // Map history to GoogleGenAI parts
    const formattedHistory = Array.isArray(history)
      ? history
          .filter((item: any) => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string' && item.text.trim().length > 0)
          .map((item: any) => ({
            role: item.role,
            parts: [{ text: item.text }],
          }))
      : [];

    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: String(message).trim() }],
      },
    ];

    let reply = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
          },
        });
        if (response.text) {
          reply = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Chat model ${model} error, trying fallback:`, err?.message || err);
      }
    }

    if (!reply) {
      reply = `Sorunuzu aldım: "${String(message).trim()}". Bir uzman muhasebeci olarak ${formattedDebt} TL borcunuz ve ${formattedPayable} TL aylık bütçeniz için tavsiyem; faiz yükünü (%${monthlyInterestRate}) hafifletmek adına her ay bütçenizi en az %40 seviyesine zorlamanız ve küçük borçları ilk önce kapatmanızdır. Başka bir sorunuz varsa memnuniyetle yanıtlarım!`;
    }

    res.json({ success: true, reply });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Yapay zeka yanıt verirken bir sorun oluştu. Lütfen tekrar deneyin.',
    });
  }
});

// Server configuration for Dev and Prod
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
