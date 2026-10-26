import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: Request, res: Response) {
  // Set CORS and JSON headers
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      success: false,
      error: 'Vercel ortamında GEMINI_API_KEY henüz eklenmemiş. Lütfen Vercel panelinde Settings > Environment Variables kısmına GEMINI_API_KEY anahtarınızı ekleyin ve Redeploy yapın.',
    });
  }

  try {
    const {
      message = '',
      history = [],
      income = 0,
      debt = 0,
      monthlyInterestRate = 4.25,
      debtsList = [],
    } = req.body || {};

    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Mesaj boş olamaz.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const formattedPayable = Number(income).toLocaleString('tr-TR');
    const formattedDebt = Number(debt).toLocaleString('tr-TR');

    let debtsBreakdownText = '';
    if (Array.isArray(debtsList) && debtsList.length > 0) {
      debtsBreakdownText = `\nKullanıcının Borç Kalemleri:\n` + debtsList
        .map((d: { name: string; amount: number }) => `- ${d.name || 'Borç'}: ${Number(d.amount).toLocaleString('tr-TR')} ₺`)
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
4. Kullanıcı soru sormaktan çekinmesin; her türlü sorusuna uzman gözüyle tarafsız, gerçekçi ve dürüst tavsiyeler ver.`;

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
          config: { systemInstruction },
        });
        if (response.text) {
          reply = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Chat model ${model} error:`, err?.message || err);
      }
    }

    if (!reply) {
      reply = `Sorunuzu aldım: "${String(message).trim()}". Bir uzman muhasebeci olarak ${formattedDebt} TL borcunuz ve ${formattedPayable} TL aylık bütçeniz için tavsiyem; faiz yükünü (%${monthlyInterestRate}) hafifletmek adına her ay bütçenizi en az %40 seviyesine zorlamanız ve küçük borçları ilk önce kapatmanızdır. Başka bir sorunuz varsa memnuniyetle yanıtlarım!`;
    }

    return res.status(200).json({ success: true, reply });
  } catch (error: any) {
    console.error('Vercel Serverless Function Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Yapay zeka yanıt verirken bir sorun oluştu. Lütfen tekrar deneyin.',
    });
  }
}
