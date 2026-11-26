import { DebtItem, DebtType, TariffPeriod } from '../types/finance';

export interface DebtTypeMeta {
  type: DebtType;
  label: string;
  shortLabel: string;
  defaultBsmvRate: number;
  defaultKkdfRate: number;
  supportsLimitTier: boolean;
  supportsInstallments: boolean;
  description: string;
}

export interface RegulatoryRateInfo {
  id: string;
  title: string;
  debtType: DebtType;
  tariffPeriod: TariffPeriod;
  contractualRate: number;
  overdueRate: number;
  bsmvRate: number;
  kkdfRate: number;
  minPaymentRate: number;
  source: string;
  effectiveDate: string;
  updatedAt: string;
  note: string;
}

export const DEBT_TYPE_META: Record<DebtType, DebtTypeMeta> = {
  credit_card: {
    type: 'credit_card',
    label: 'Kredi Kartı Borcu',
    shortLabel: 'Kredi Kartı',
    defaultBsmvRate: 15,
    defaultKkdfRate: 15,
    supportsLimitTier: true,
    supportsInstallments: false,
    description: 'TCMB dönem borcu kademeli akdi/gecikme faizi ve BDDK limit bazlı asgari ödeme oranı uygulanır.',
  },
  consumer_loan: {
    type: 'consumer_loan',
    label: 'İhtiyaç Kredisi',
    shortLabel: 'İhtiyaç Kredisi',
    defaultBsmvRate: 15,
    defaultKkdfRate: 15,
    supportsLimitTier: false,
    supportsInstallments: true,
    description: 'Anapara + aylık faiz + %15 BSMV + %15 KKDF üzerinden taksitli ödeme planı uygulanır.',
  },
  installment_loan: {
    type: 'installment_loan',
    label: 'Taksitli Kredi',
    shortLabel: 'Taksitli Kredi',
    defaultBsmvRate: 15,
    defaultKkdfRate: 15,
    supportsLimitTier: false,
    supportsInstallments: true,
    description: 'Sabit taksitli taşıt, tüketici veya yapılandırma kredisi (vergi oranları düzenlenebilir).',
  },
  kmh: {
    type: 'kmh',
    label: 'Ek Hesap / KMH',
    shortLabel: 'KMH (Ek Hesap)',
    defaultBsmvRate: 15,
    defaultKkdfRate: 15,
    supportsLimitTier: false,
    supportsInstallments: false,
    description: 'Gün bazlı işleyen Kredili Mevduat Hesabı faizi, %15 BSMV ve %15 KKDF kesintisi.',
  },
  cash_advance: {
    type: 'cash_advance',
    label: 'Nakit Avans',
    shortLabel: 'Nakit Avans',
    defaultBsmvRate: 15,
    defaultKkdfRate: 15,
    supportsLimitTier: true,
    supportsInstallments: false,
    description: 'Kredi kartından çekilen nakit avans için günlük akdi faiz ve %15 BSMV + %15 KKDF uygulanır.',
  },
  overdue: {
    type: 'overdue',
    label: 'Gecikmiş Borç',
    shortLabel: 'Gecikmiş Borç',
    defaultBsmvRate: 15,
    defaultKkdfRate: 15,
    supportsLimitTier: false,
    supportsInstallments: false,
    description: 'Gecikme gün sayısı ve gecikme faizi oranı üzerinden günlük bileşenli maliyet hesaplanır.',
  },
  other: {
    type: 'other',
    label: 'Diğer (Manuel Borç)',
    shortLabel: 'Diğer Borç',
    defaultBsmvRate: 0,
    defaultKkdfRate: 0,
    supportsLimitTier: false,
    supportsInstallments: false,
    description: 'Elden borç, senet veya özel borçlar; vergi ve faiz oranları tamamen manuel belirlenir.',
  },
};

export const TARIFF_METADATA: Record<TariffPeriod, { label: string; effectiveDate: string; referenceRate: number; source: string }> = {
  nov_2026: {
    label: 'Kasım 2026 (Güncel Tarife)',
    effectiveDate: '2026-11-01',
    referenceRate: 3.11,
    source: 'TCMB Tebliği (Referans Oran %3,11) · BDDK Kasım 2026 Asgari Kararı',
  },
  dec_2026: {
    label: '1 Aralık 2026 Yeni Tarife',
    effectiveDate: '2026-12-01',
    referenceRate: 2.94,
    source: 'TCMB Yeni Tebliği (Referans Oran %2,94) · BDDK Kasım 2026 Asgari Kararı',
  },
};

/**
 * BDDK Kasım 2026 kararı uyarınca kredi kartı limitine göre asgari ödeme oranı:
 * - 100.000 TL ve altı: %20
 * - 100.001 TL – 200.000 TL arası: %30
 * - 200.000 TL üzeri: %40
 */
export function getBddkMinimumPaymentRate(creditLimit: number | undefined, fallbackBalance: number): number {
  const basis = creditLimit && creditLimit > 0 ? creditLimit : fallbackBalance;
  if (basis <= 100000) return 20;
  if (basis <= 200000) return 30;
  return 40;
}

/**
 * TCMB Dönem Borcuna Göre Azami Akdi ve Gecikme Faiz Oranları
 */
export function getTcmbCardRates(balance: number, tariff: TariffPeriod): {
  contractualRate: number;
  overdueRate: number;
  tierLabel: string;
} {
  const isDec = tariff === 'dec_2026';
  if (balance < 30000) {
    return {
      contractualRate: isDec ? 3.08 : 3.25,
      overdueRate: isDec ? 3.38 : 3.55,
      tierLabel: '30.000 TL Altı Kademe',
    };
  }
  if (balance <= 180000) {
    return {
      contractualRate: isDec ? 3.58 : 3.75,
      overdueRate: isDec ? 3.88 : 4.05,
      tierLabel: '30.000 – 180.000 TL Kademe',
    };
  }
  return {
    contractualRate: isDec ? 4.08 : 4.25,
    overdueRate: isDec ? 4.38 : 4.55,
    tierLabel: '180.000 TL Üzeri Kademe',
  };
}

export function getPresetForDebt(
  type: DebtType,
  balance: number,
  creditLimit: number | undefined,
  tariff: TariffPeriod
): {
  contractualRate: number;
  overdueRate: number;
  bsmvRate: number;
  kkdfRate: number;
  minPaymentRate: number;
  rateSource: string;
  rateUpdatedAt: string;
} {
  const tariffMeta = TARIFF_METADATA[tariff];
  const isDec = tariff === 'dec_2026';
  const meta = DEBT_TYPE_META[type];

  if (type === 'credit_card') {
    const cardRates = getTcmbCardRates(balance, tariff);
    const minRate = getBddkMinimumPaymentRate(creditLimit, balance);
    return {
      contractualRate: cardRates.contractualRate,
      overdueRate: cardRates.overdueRate,
      bsmvRate: meta.defaultBsmvRate,
      kkdfRate: meta.defaultKkdfRate,
      minPaymentRate: minRate,
      rateSource: `TCMB (${cardRates.tierLabel}) · BDDK %${minRate} Asgari`,
      rateUpdatedAt: tariffMeta.effectiveDate,
    };
  }

  if (type === 'kmh' || type === 'cash_advance') {
    const cRate = isDec ? 4.08 : 4.25;
    const oRate = isDec ? 4.38 : 4.55;
    const minRate = type === 'cash_advance'
      ? getBddkMinimumPaymentRate(creditLimit, balance)
      : 10; // KMH için aylık minimum faiz+anapara tamponu veya kullanıcı ayarı
    return {
      contractualRate: cRate,
      overdueRate: oRate,
      bsmvRate: meta.defaultBsmvRate,
      kkdfRate: meta.defaultKkdfRate,
      minPaymentRate: minRate,
      rateSource: `TCMB Azami ${meta.shortLabel} Oranı`,
      rateUpdatedAt: tariffMeta.effectiveDate,
    };
  }

  if (type === 'overdue') {
    const cRate = isDec ? 4.08 : 4.25;
    const oRate = isDec ? 4.38 : 4.55;
    return {
      contractualRate: cRate,
      overdueRate: oRate,
      bsmvRate: meta.defaultBsmvRate,
      kkdfRate: meta.defaultKkdfRate,
      minPaymentRate: 25,
      rateSource: 'TCMB Azami Gecikme Üst Sınırı',
      rateUpdatedAt: tariffMeta.effectiveDate,
    };
  }

  if (type === 'consumer_loan' || type === 'installment_loan') {
    // Bankalar serbest piyasa faizi uygular; referans örnek oran + manuel düzenleme açık
    return {
      contractualRate: 3.99,
      overdueRate: 5.19, // Akdi faizin en fazla %30 fazlası (Tüketici Kredisi Yönetmeliği)
      bsmvRate: meta.defaultBsmvRate,
      kkdfRate: meta.defaultKkdfRate,
      minPaymentRate: 15,
      rateSource: 'Banka Piyasa Referansı (Manuel Düzenlenebilir)',
      rateUpdatedAt: '2026-11-20',
    };
  }

  // 'other'
  return {
    contractualRate: 0,
    overdueRate: 0,
    bsmvRate: 0,
    kkdfRate: 0,
    minPaymentRate: 10,
    rateSource: 'Manuel Tanımlı Borç',
    rateUpdatedAt: new Date().toISOString().slice(0, 10),
  };
}

export function getRegulatoryReferenceRows(tariff: TariffPeriod): RegulatoryRateInfo[] {
  const tariffMeta = TARIFF_METADATA[tariff];
  const isDec = tariff === 'dec_2026';

  return [
    {
      id: 'cc_low',
      title: 'Kredi Kartı (30.000 TL Altı)',
      debtType: 'credit_card',
      tariffPeriod: tariff,
      contractualRate: isDec ? 3.08 : 3.25,
      overdueRate: isDec ? 3.38 : 3.55,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 20,
      source: 'TCMB Tebliği & BDDK',
      effectiveDate: tariffMeta.effectiveDate,
      updatedAt: '2026-11-25',
      note: '100 bin TL altı kart limitinde asgari %20',
    },
    {
      id: 'cc_mid',
      title: 'Kredi Kartı (30.000 – 180.000 TL)',
      debtType: 'credit_card',
      tariffPeriod: tariff,
      contractualRate: isDec ? 3.58 : 3.75,
      overdueRate: isDec ? 3.88 : 4.05,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 30,
      source: 'TCMB Tebliği & BDDK',
      effectiveDate: tariffMeta.effectiveDate,
      updatedAt: '2026-11-25',
      note: '100-200 bin TL kart limitinde asgari %30',
    },
    {
      id: 'cc_high',
      title: 'Kredi Kartı (180.000 TL Üzeri)',
      debtType: 'credit_card',
      tariffPeriod: tariff,
      contractualRate: isDec ? 4.08 : 4.25,
      overdueRate: isDec ? 4.38 : 4.55,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 40,
      source: 'TCMB Tebliği & BDDK',
      effectiveDate: tariffMeta.effectiveDate,
      updatedAt: '2026-11-25',
      note: '200 bin TL üzeri kart limitinde asgari %40',
    },
    {
      id: 'kmh_cash',
      title: 'Nakit Avans & Ek Hesap (KMH)',
      debtType: 'kmh',
      tariffPeriod: tariff,
      contractualRate: isDec ? 4.08 : 4.25,
      overdueRate: isDec ? 4.38 : 4.55,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 20,
      source: 'TCMB Azami Oranı',
      effectiveDate: tariffMeta.effectiveDate,
      updatedAt: '2026-11-25',
      note: 'Günlük faiz + %15 BSMV + %15 KKDF',
    },
    {
      id: 'consumer',
      title: 'İhtiyaç / Taksitli Kredi',
      debtType: 'consumer_loan',
      tariffPeriod: tariff,
      contractualRate: 3.99,
      overdueRate: 5.19,
      bsmvRate: 15,
      kkdfRate: 15,
      minPaymentRate: 15,
      source: 'Banka Piyasa Referansı',
      effectiveDate: '2026-11-20',
      updatedAt: '2026-11-25',
      note: 'Banka sözleşmenize göre manuel girilebilir (gecikme en fazla akdi + %30)',
    },
  ];
}

export function createDefaultDebts(tariff: TariffPeriod = 'nov_2026'): DebtItem[] {
  const ccPreset = getPresetForDebt('credit_card', 55000, 90000, tariff);
  const kmhPreset = getPresetForDebt('kmh', 20000, undefined, tariff);
  const loanPreset = getPresetForDebt('consumer_loan', 45000, undefined, tariff);

  return [
    {
      id: 'debt-1',
      name: 'Kredi Kartı 1',
      type: 'credit_card',
      balance: 55000,
      creditLimit: 90000,
      ...ccPreset,
      dueDay: 10,
      isOverdue: false,
      overdueDays: 0,
      isManualRate: false,
    },
    {
      id: 'debt-2',
      name: 'Ek Hesap (KMH)',
      type: 'kmh',
      balance: 20000,
      ...kmhPreset,
      dueDay: 5,
      isOverdue: false,
      overdueDays: 0,
      isManualRate: false,
    },
    {
      id: 'debt-3',
      name: 'İhtiyaç Kredisi',
      type: 'consumer_loan',
      balance: 45000,
      ...loanPreset,
      remainingInstallments: 12,
      dueDay: 15,
      isOverdue: false,
      overdueDays: 0,
      isManualRate: false,
    },
  ];
}
