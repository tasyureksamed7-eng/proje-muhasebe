import type { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

function formatTL(val: unknown): string {
  const num = Number(val);
  if (!Number.isFinite(num)) return '0 TL';
  return `${Math.round(num).toLocaleString('tr-TR')} TL`;
}

function buildFinancialSystemInstruction(body: any): {
  systemInstruction: string;
  fallbackText: (question: string) => string;
} {
  const {
    monthlyBudget = 0,
    totalDebt = 0,
    tariffLabel = 'Kasım 2026 TCMB Tarifesi',
    calculationMode = 'fixed',
    activeStrategy = null,
    allStrategiesSummary = [],
    debts = [],
    restructureResult = null,
    actualSummary = null,
  } = body || {};

  const debtsText = Array.isArray(debts) && debts.length > 0
    ? debts
        .map(
          (d: any, i: number) =>
            `${i + 1}. ${d.name} (${d.typeLabel || d.type}): Bakiye ${formatTL(d.balance)} | Akdi %${d.contractualRate} | Gecikme %${d.overdueRate} | BSMV %${d.bsmvRate} | KKDF %${d.kkdfRate} | Asgari %${d.minPaymentRate}${d.isOverdue ? ` | GECİKMİŞ (${d.overdueDays} gün)` : ''} | Kaynak: ${d.rateSource}`
        )
        .join('\n')
    : 'Aktif borç kalemi girilmemiş.';

  const strategiesText = Array.isArray(allStrategiesSummary) && allStrategiesSummary.length > 0
    ? allStrategiesSummary
        .map(
          (s: any) =>
            `- ${s.label}: ${s.isPayable ? `${s.monthsToPayoff} ay (${s.estimatedPayoffDate})` : 'Mevcut bütçeyle kapanmıyor'} | İlk Ay: ${formatTL(s.firstMonthPayment)} | Toplam Faiz+Vergi: ${formatTL(s.totalInterestAndTaxes)} | Toplam Ödeme: ${formatTL(s.totalPaid)} | Asgariye Göre Tasarruf: ${formatTL(s.interestSavedVsMinimum)}`
        )
        .join('\n')
    : 'Strateji karşılaştırma verisi henüz hesaplanmadı.';

  const activeText = activeStrategy
    ? `Seçili Strateji: ${activeStrategy.label}
- Bitiş Süresi: ${activeStrategy.isPayable ? `${activeStrategy.monthsToPayoff} ay (${activeStrategy.estimatedPayoffDate})` : 'Bütçe yetersiz (kapanmıyor)'}
- İlk Ay Asgari Gereksinimi: ${formatTL(activeStrategy.minimumRequiredFirstMonth)}
- İlk Ay Planlanan Ödeme: ${formatTL(activeStrategy.firstMonthPayment)}
- İlk Ay Bütçe Açığı: ${formatTL(activeStrategy.budgetShortfallFirstMonth)}
- Toplam Faiz + BSMV + KKDF: ${formatTL(activeStrategy.totalInterestAndTaxes)}
- Toplam Geri Ödeme: ${formatTL(activeStrategy.totalPaid)}
- Asgari Ödemeye Göre Faiz Tasarrufu: ${formatTL(activeStrategy.interestSavedVsMinimum)}`
    : 'Aktif strateji özeti yok.';

  const restructureText = restructureResult
    ? `Yapılandırma Simülasyonu: ${restructureResult.termMonths} ay vade, Aylık Taksit ${formatTL(restructureResult.monthlyInstallment)}, Toplam Faiz+Vergi ${formatTL(restructureResult.totalInterestAndTaxes)}, Bütçeye Uygun mu: ${restructureResult.isWithinBudget ? 'Evet' : 'Hayır'}`
    : 'Yapılandırma simülasyonu kapalı.';

  const actualText = actualSummary
    ? `Gerçekleşen Takip: ${actualSummary.paidMonthsCount || 0} ay ödendi (Toplam ödenen: ${formatTL(actualSummary.totalActualPaid)}), ${actualSummary.skippedMonthsCount || 0} ay atlandı.`
    : 'Henüz gerçekleşen ödeme kaydı yok.';

  const systemInstruction = `Sen Türkiye finansal mevzuatına hakim, gerçekçi ve güvenilir bir kişisel borç danışmanısın.

HESAPLANMIŞ GERÇEK MOTOR VERİLERİ (BUNLAR KESİNDİR, ASLA KENDİN ORAN VEYA RAKAM UYDURMA):
- Aktif Tarife: ${tariffLabel}
- Hesaplama Yöntemi: ${calculationMode === 'fixed' ? 'Sabit Taksit / Başlangıç Bazlı' : 'Dönen Bakiye Bazlı'}
- Toplam Aktif Borç: ${formatTL(totalDebt)}
- Kullanıcının Aylık Ödeyebileceği Bütçe: ${formatTL(monthlyBudget)}

BORÇ KALEMLERİ:
${debtsText}

SEÇİLİ STRATEJİ DETAYI:
${activeText}

5 STRATEJİNİN KARŞILAŞTIRMASI:
${strategiesText}

${restructureText}
${actualText}

KESİN KURALLAR:
1. SIFIR UYDURMA: Hesaplama motorunun verdiği sayılar dışında asla yeni faiz oranı, sahte tasarruf rakamı veya hayali ödeme tutarı üretme. Tüm sayısal yorumlarını yukarıdaki motor çıktılarına dayandır.
2. BÜTÇE TUTARLILIĞI: Kullanıcının aylık bütçesi ${formatTL(monthlyBudget)}. Eğer bütçe 0 TL ise veya ilk ay bütçe açığı (${activeStrategy ? formatTL(activeStrategy.budgetShortfallFirstMonth) : '0 TL'}) varsa bunu açıkça ve dürüstçe vurgula; asgari ödemenin karşılanmadığı durumda gecikme riski doğacağını belirt.
3. KESİN BİLGİ VS. YORUM AYRIMI: Hesaplanan kesin verileri ("Hesaplama Verisi:") ve stratejik/davranışsal önerilerini ("Stratejik Öneri:") net şekilde ayır.
4. DİL VE ÜSLUP: Sade, net, anlaşılır Türkçe kullan. Kısa maddeler ve net eylem adımları ver.`;

  const fallbackText = (question: string) => {
    const budgetNum = Number(monthlyBudget) || 0;
    const debtNum = Number(totalDebt) || 0;
    if (debtNum <= 0) {
      return `**Hesaplama Verisi:** Şu anda aktif bir borç bakiyeniz bulunmuyor.\n\n**Stratejik Öneri:** Yeni bir borç kalemi eklediğinizde stratejileri ve tasarruf farklarını sizin için analiz edebilirim.`;
    }
    if (budgetNum <= 0) {
      return `**Hesaplama Verisi:** Toplam borcunuz **${formatTL(debtNum)}** ancak aylık ödeme bütçeniz **0 TL** olarak görünüyor. İlk ay gereken toplam asgari tutar **${formatTL(activeStrategy?.minimumRequiredFirstMonth)}** seviyesindedir.\n\n**Stratejik Öneri:** Bütçe 0 TL iken hiçbir strateji borcu kapatamaz ve gecikme faizi işlemeye devam eder. Öncelikle aylık ödeyebileceğiniz gerçekçi tutarı belirlemeniz gerekir.`;
    }
    const shortfall = Number(activeStrategy?.budgetShortfallFirstMonth || 0);
    const shortfallNote = shortfall > 0
      ? `\n- **Bütçe Açığı Uyarısı:** İlk ay gereken asgari ödeme **${formatTL(activeStrategy?.minimumRequiredFirstMonth)}** iken bütçeniz **${formatTL(shortfall)}** eksik kalıyor.`
      : '';
    return `Sorunuz ("${question}") için mevcut hesaplama motoru verilerine dayalı özet:\n\n**Hesaplama Verisi:**\n- Toplam Borç: **${formatTL(debtNum)}** | Aylık Bütçe: **${formatTL(budgetNum)}**\n- Seçili Plan (${activeStrategy?.label || 'Aktif Strateji'}): ${activeStrategy?.isPayable ? `**${activeStrategy.monthsToPayoff} ayda** (${activeStrategy.estimatedPayoffDate}) kapanır.` : 'Mevcut bütçeyle kapanmıyor.'}\n- Toplam Faiz + BSMV + KKDF Yükü: **${formatTL(activeStrategy?.totalInterestAndTaxes)}** (Asgariye göre tasarruf: **${formatTL(activeStrategy?.interestSavedVsMinimum)}**)${shortfallNote}\n\n**Stratejik Öneri:**\n- En yüksek maliyetli (gecikmiş veya yüksek faiz + %30 vergi yüklü) borcu önceliklendirmek toplam faiz maliyetini düşürür.\n- Ara ödeme veya aylık bütçe artışı yaptığınızda aylık takip tablosu yeni bitiş tarihini otomatik olarak öne çekecektir.`;
  };

  return { systemInstruction, fallbackText };
}

export default async function handler(req: Request, res: Response) {
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
    const { message = '', history = [] } = req.body || {};

    if (!message || String(message).trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Mesaj boş olamaz.' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });

    const { systemInstruction, fallbackText } = buildFinancialSystemInstruction(req.body);

    const formattedHistory = Array.isArray(history)
      ? history
          .filter(
            (item: any) =>
              item &&
              (item.role === 'user' || item.role === 'model') &&
              typeof item.text === 'string' &&
              item.text.trim().length > 0
          )
          .slice(-10)
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
    const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

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
      reply = fallbackText(String(message).trim());
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
