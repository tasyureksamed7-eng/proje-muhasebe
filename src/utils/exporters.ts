import { jsPDF } from 'jspdf';
import {
  AllStrategiesComparison,
  DebtItem,
  StrategyResult,
  StrategyType,
} from '../types/finance';
import { formatCurrencyTR } from '../engine/turkeyMath';
import { DEBT_TYPE_META, TARIFF_METADATA } from '../engine/turkeyRates';

export type PdfReportType = 'full' | 'status' | 'schedule' | 'comparison' | 'actuals';

/**
 * UTF-8 BOM destekli Excel uyumlu CSV Dışa Aktarma
 */
export function exportStrategyToCsv(
  comparison: AllStrategiesComparison,
  activeResult: StrategyResult,
  debts: DebtItem[]
): void {
  const headers = [
    'Ay',
    'Dönem',
    'Dönem Başı Borç (TL)',
    'Asgari Ödeme (TL)',
    'Planlanan Ödeme (TL)',
    'Gerçekleşen Ödeme (TL)',
    'Ek / Ara Ödeme (TL)',
    'Ödenen Anapara (TL)',
    'Akdi Faiz (TL)',
    'Gecikme Faizi (TL)',
    'BSMV (TL)',
    'KKDF (TL)',
    'Toplam Faiz+Vergi (TL)',
    'Dönem Sonu Borç (TL)',
    'Durum',
  ];

  const rows = activeResult.schedule.map((row) => [
    row.month,
    row.monthLabel,
    row.startBalance.toFixed(2),
    row.minimumRequired.toFixed(2),
    row.plannedPayment.toFixed(2),
    row.actualPayment !== null ? row.actualPayment.toFixed(2) : '',
    row.extraPayment.toFixed(2),
    row.principalPaid.toFixed(2),
    row.contractualInterest.toFixed(2),
    row.overdueInterest.toFixed(2),
    row.bsmv.toFixed(2),
    row.kkdf.toFixed(2),
    row.totalFinanceCharge.toFixed(2),
    row.endBalance.toFixed(2),
    row.isSkipped ? 'Atlandı (Gecikme)' : row.isPaid ? 'Ödendi' : 'Planlandı',
  ]);

  // Alt bölüm: Borç kalemleri ve oran kaynakları
  const debtSummaryRows = [
    [],
    ['BORÇ KALEMLERİ VE ORAN KAYNAKLARI'],
    ['Borç Adı', 'Tür', 'Kalan Bakiye (TL)', 'Akdi Faiz (%)', 'Gecikme (%)', 'BSMV (%)', 'KKDF (%)', 'Asgari (%)', 'Kaynak', 'Tarih'],
    ...debts.map((d) => [
      d.name,
      DEBT_TYPE_META[d.type].label,
      d.balance.toFixed(2),
      d.contractualRate.toFixed(2),
      d.overdueRate.toFixed(2),
      d.bsmvRate.toFixed(2),
      d.kkdfRate.toFixed(2),
      d.minPaymentRate.toFixed(2),
      d.rateSource,
      d.rateUpdatedAt,
    ]),
  ];

  const strategyComparisonRows = [
    [],
    ['STRATEJİ KARŞILAŞTIRMASI'],
    ['Strateji', 'Süre (Ay)', 'Tahmini Bitiş', 'İlk Ay Ödeme (TL)', 'Toplam Faiz+Vergi (TL)', 'Toplam Geri Ödeme (TL)', 'Asgariye Göre Tasarruf (TL)'],
    ...(['minimum', 'fast_budget', 'snowball', 'avalanche', 'custom'] as StrategyType[]).map((st) => {
      const s = comparison.strategies[st];
      return [
        s.label,
        s.monthsToPayoff,
        s.estimatedPayoffDate,
        s.firstMonthPayment.toFixed(2),
        s.totalInterestAndTaxes.toFixed(2),
        s.totalPaid.toFixed(2),
        s.interestSavedVsMinimum.toFixed(2),
      ];
    }),
  ];

  const allLines = [headers, ...rows, ...debtSummaryRows, ...strategyComparisonRows]
    .map((line) =>
      line
        .map((cell) => {
          const str = String(cell ?? '');
          return str.includes(';') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(';')
    )
    .join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + allLines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `thoth-${activeResult.strategy}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Türkçe karakterleri tam destekleyen yüksek çözünürlüklü Canvas tabanlı çok sayfalı PDF üreticisi
 */
export function exportTurkishPdfReport(params: {
  reportType: PdfReportType;
  profileName: string;
  comparison: AllStrategiesComparison;
  activeResult: StrategyResult;
  debts: DebtItem[];
}): void {
  const { reportType, profileName, comparison, activeResult, debts } = params;

  // A4 oranları (1240 x 1754 px yüksek DPI tuval)
  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN = 72;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BOTTOM_LIMIT = PAGE_H - 90;

  const pages: HTMLCanvasElement[] = [];

  const createPage = (pageNum: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Üst şerit
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(MARGIN, 46, CONTENT_W, 3);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 22px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText('Thoth — Kişisel Borç Yönetim Raporu', MARGIN, 82);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 16px "Plus Jakarta Sans", Arial, sans-serif';
    const dateStr = new Date().toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    const rightText = `${profileName} · ${dateStr} · Sayfa ${pageNum}`;
    const rW = ctx.measureText(rightText).width;
    ctx.fillText(rightText, PAGE_W - MARGIN - rW, 82);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, 98);
    ctx.lineTo(PAGE_W - MARGIN, 98);
    ctx.stroke();

    // Alt bilgi
    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 14px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(
      `Tarife: ${TARIFF_METADATA[comparison.tariffPeriod].label} · Hesaplanan veriler bilgi amaçlıdır.`,
      MARGIN,
      PAGE_H - 42
    );

    pages.push(canvas);
    return { canvas, ctx };
  };

  let current = createPage(1);
  let y = 136;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > BOTTOM_LIMIT) {
      current = createPage(pages.length + 1);
      y = 136;
    }
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(70);
    current.ctx.fillStyle = '#0f172a';
    current.ctx.font = '700 22px "Plus Jakarta Sans", Arial, sans-serif';
    current.ctx.fillText(title, MARGIN, y);
    y += 24;
    if (subtitle) {
      current.ctx.fillStyle = '#475569';
      current.ctx.font = '400 15px "Plus Jakarta Sans", Arial, sans-serif';
      current.ctx.fillText(subtitle, MARGIN, y);
      y += 18;
    }
    current.ctx.strokeStyle = '#cbd5e1';
    current.ctx.lineWidth = 1.5;
    current.ctx.beginPath();
    current.ctx.moveTo(MARGIN, y);
    current.ctx.lineTo(PAGE_W - MARGIN, y);
    current.ctx.stroke();
    y += 26;
  };

  const drawKpiRow = (items: { label: string; value: string; accent?: string }[]) => {
    ensureSpace(100);
    const gap = 16;
    const boxW = (CONTENT_W - gap * (items.length - 1)) / items.length;
    items.forEach((item, idx) => {
      const x = MARGIN + idx * (boxW + gap);
      current.ctx.fillStyle = '#f8fafc';
      current.ctx.strokeStyle = '#e2e8f0';
      current.ctx.lineWidth = 1;
      current.ctx.fillRect(x, y, boxW, 82);
      current.ctx.strokeRect(x, y, boxW, 82);

      current.ctx.fillStyle = '#64748b';
      current.ctx.font = '600 14px "Plus Jakarta Sans", Arial, sans-serif';
      current.ctx.fillText(item.label, x + 16, y + 28);

      current.ctx.fillStyle = item.accent || '#0f172a';
      current.ctx.font = '700 22px "Plus Jakarta Sans", Arial, sans-serif';
      current.ctx.fillText(item.value, x + 16, y + 60);
    });
    y += 106;
  };

  const drawTable = (cols: { title: string; width: number; align?: 'left' | 'right' }[], rows: string[][]) => {
    const rowH = 34;
    const drawHeader = () => {
      ensureSpace(rowH * 2);
      current.ctx.fillStyle = '#f1f5f9';
      current.ctx.fillRect(MARGIN, y, CONTENT_W, rowH);
      current.ctx.fillStyle = '#334155';
      current.ctx.font = '700 14px "Plus Jakarta Sans", Arial, sans-serif';

      let cx = MARGIN + 10;
      cols.forEach((col) => {
        if (col.align === 'right') {
          const w = current.ctx.measureText(col.title).width;
          current.ctx.fillText(col.title, cx + col.width - 20 - w, y + 22);
        } else {
          current.ctx.fillText(col.title, cx, y + 22);
        }
        cx += col.width;
      });
      y += rowH;
    };

    drawHeader();

    rows.forEach((row, rIdx) => {
      if (y + rowH > BOTTOM_LIMIT) {
        current = createPage(pages.length + 1);
        y = 136;
        drawHeader();
      }
      if (rIdx % 2 === 1) {
        current.ctx.fillStyle = '#f8fafc';
        current.ctx.fillRect(MARGIN, y, CONTENT_W, rowH);
      }
      current.ctx.strokeStyle = '#e2e8f0';
      current.ctx.beginPath();
      current.ctx.moveTo(MARGIN, y + rowH);
      current.ctx.lineTo(PAGE_W - MARGIN, y + rowH);
      current.ctx.stroke();

      current.ctx.fillStyle = '#0f172a';
      current.ctx.font = '500 14px "Plus Jakarta Sans", Arial, sans-serif';

      let cx = MARGIN + 10;
      cols.forEach((col, cIdx) => {
        let txt = String(row[cIdx] ?? '');
        while (current.ctx.measureText(txt).width > col.width - 18 && txt.length > 3) {
          txt = txt.slice(0, -4) + '...';
        }
        if (col.align === 'right') {
          const w = current.ctx.measureText(txt).width;
          current.ctx.fillText(txt, cx + col.width - 20 - w, y + 22);
        } else {
          current.ctx.fillText(txt, cx, y + 22);
        }
        cx += col.width;
      });
      y += rowH;
    });
    y += 22;
  };

  // 1. Özet & Borç Durum Raporu
  if (reportType === 'full' || reportType === 'status') {
    drawSectionTitle(
      '1. Borç Durum Özeti ve Aktif Plan',
      `Seçili Strateji: ${activeResult.label} · Aylık Bütçe: ${formatCurrencyTR(comparison.monthlyBudget)}`
    );

    drawKpiRow([
      { label: 'Toplam Borç Anapara', value: formatCurrencyTR(comparison.totalDebt) },
      { label: 'Aylık Bütçe', value: formatCurrencyTR(comparison.monthlyBudget) },
      { label: 'İlk Ay Planlanan Ödeme', value: formatCurrencyTR(activeResult.firstMonthPayment) },
      {
        label: 'Tahmini Bitiş',
        value: activeResult.isPayable ? `${activeResult.monthsToPayoff} Ay (${activeResult.estimatedPayoffDate})` : 'Bütçe Yetersiz',
        accent: activeResult.isPayable ? '#047857' : '#b91c1c',
      },
    ]);

    drawKpiRow([
      { label: 'Toplam Faiz + BSMV + KKDF', value: formatCurrencyTR(activeResult.totalInterestAndTaxes), accent: '#b45309' },
      { label: 'Toplam Geri Ödeme', value: formatCurrencyTR(activeResult.totalPaid) },
      { label: 'Asgariye Göre Faiz Tasarrufu', value: formatCurrencyTR(activeResult.interestSavedVsMinimum), accent: '#047857' },
    ]);

    drawSectionTitle('Borç Kalemleri ve Yasal Oran Kaynakları');
    drawTable(
      [
        { title: 'Borç Adı', width: 220 },
        { title: 'Tür', width: 150 },
        { title: 'Bakiye', width: 140, align: 'right' },
        { title: 'Akdi %', width: 90, align: 'right' },
        { title: 'Vergi %', width: 100, align: 'right' },
        { title: 'Asgari %', width: 95, align: 'right' },
        { title: 'Kaynak / Tarih', width: 300 },
      ],
      debts.map((d) => [
        d.name,
        DEBT_TYPE_META[d.type].shortLabel,
        formatCurrencyTR(d.balance),
        `%${d.contractualRate.toFixed(2)}`,
        `%${(d.bsmvRate + d.kkdfRate).toFixed(0)}`,
        `%${d.minPaymentRate.toFixed(0)}`,
        `${d.rateSource} (${d.rateUpdatedAt})`,
      ])
    );
  }

  // 2. Strateji & Toplam Faiz Karşılaştırması
  if (reportType === 'full' || reportType === 'comparison') {
    drawSectionTitle('Strateji ve Toplam Faiz Karşılaştırması');
    drawTable(
      [
        { title: 'Strateji', width: 230 },
        { title: 'Süre', width: 90, align: 'right' },
        { title: 'Tahmini Bitiş', width: 160 },
        { title: 'İlk Ay Ödeme', width: 145, align: 'right' },
        { title: 'Faiz + Vergi', width: 150, align: 'right' },
        { title: 'Toplam Ödeme', width: 155, align: 'right' },
        { title: 'Tasarruf', width: 165, align: 'right' },
      ],
      (['minimum', 'fast_budget', 'snowball', 'avalanche', 'custom'] as StrategyType[]).map((st) => {
        const s = comparison.strategies[st];
        return [
          s.label,
          s.isPayable ? `${s.monthsToPayoff} Ay` : 'Kapanmaz',
          s.estimatedPayoffDate,
          formatCurrencyTR(s.firstMonthPayment),
          formatCurrencyTR(s.totalInterestAndTaxes),
          formatCurrencyTR(s.totalPaid),
          formatCurrencyTR(s.interestSavedVsMinimum),
        ];
      })
    );
  }

  // 3. Borç Bazlı Kapanış & Gerçekleşen Ödemeler
  if (reportType === 'full' || reportType === 'actuals') {
    drawSectionTitle('Borç Bazlı Kapanış Sırası');
    drawTable(
      [
        { title: 'Sıra', width: 80 },
        { title: 'Borç Adı', width: 320 },
        { title: 'Kapanış Ayı', width: 180, align: 'right' },
        { title: 'Tahmini Tarih', width: 240 },
        { title: 'Toplam Faiz+Vergi Yükü', width: 275, align: 'right' },
      ],
      activeResult.debtPayoffOrder.map((item, idx) => [
        `${idx + 1}.`,
        item.debtName,
        item.payoffMonth > 0 ? `${item.payoffMonth}. Ay` : 'Kapanmadı',
        item.payoffDate,
        formatCurrencyTR(item.totalInterestAndTaxPaid),
      ])
    );

    const actualRows = activeResult.schedule.filter((r) => r.actualPayment !== null || r.isPaid || r.isSkipped);
    drawSectionTitle(
      'Gerçekleşen Ödemeler Raporu',
      actualRows.length === 0 ? 'Henüz gerçekleşen ödeme kaydı girilmedi.' : undefined
    );
    if (actualRows.length > 0) {
      drawTable(
        [
          { title: 'Ay', width: 90 },
          { title: 'Dönem', width: 140 },
          { title: 'Planlanan', width: 180, align: 'right' },
          { title: 'Gerçekleşen', width: 180, align: 'right' },
          { title: 'Anapara', width: 170, align: 'right' },
          { title: 'Kalan Bakiye', width: 180, align: 'right' },
          { title: 'Durum', width: 155 },
        ],
        actualRows.map((r) => [
          `${r.month}. Ay`,
          r.monthLabel,
          formatCurrencyTR(r.plannedPayment),
          formatCurrencyTR(r.actualPayment ?? 0),
          formatCurrencyTR(r.principalPaid),
          formatCurrencyTR(r.endBalance),
          r.isSkipped ? 'Atlandı' : 'Ödendi',
        ])
      );
    }
  }

  // 4. Aylık Ödeme Planı Tablosu
  if (reportType === 'full' || reportType === 'schedule') {
    drawSectionTitle(`Aylık Ödeme Planı (${activeResult.label})`);
    drawTable(
      [
        { title: 'Ay', width: 65 },
        { title: 'Dönem', width: 115 },
        { title: 'Dönem Başı', width: 155, align: 'right' },
        { title: 'Planlanan', width: 150, align: 'right' },
        { title: 'Anapara', width: 150, align: 'right' },
        { title: 'Faiz+BSMV+KKDF', width: 175, align: 'right' },
        { title: 'Kalan Borç', width: 155, align: 'right' },
        { title: 'Durum', width: 130 },
      ],
      activeResult.schedule.map((r) => [
        `${r.month}`,
        r.monthLabel,
        formatCurrencyTR(r.startBalance),
        formatCurrencyTR(r.effectivePayment),
        formatCurrencyTR(r.principalPaid),
        formatCurrencyTR(r.totalFinanceCharge),
        formatCurrencyTR(r.endBalance),
        r.isSkipped ? 'Gecikme' : r.isPaid ? 'Ödendi' : 'Plan',
      ])
    );
  }

  // Tüm canvas sayfalarını jsPDF belgesine ekle
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  pages.forEach((canvas, index) => {
    if (index > 0) pdf.addPage();
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
  });

  pdf.save(`thoth-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
