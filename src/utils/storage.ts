import {
  CalculationMode,
  DebtItem,
  RestructureConfig,
  SavedPlanSnapshot,
  StrategyResult,
  StrategyType,
  TariffPeriod,
  UserProfile,
} from '../types/finance';
import { createDefaultDebts, getPresetForDebt } from '../engine/turkeyRates';

const STORAGE_KEY_V2 = 'borcplan_profiles_v2';
const ACTIVE_PROFILE_KEY = 'borcplan_active_profile_v2';
const LEGACY_STORAGE_KEY = 'borc_butce_data';

export interface ProfileStore {
  profiles: UserProfile[];
  activeProfileId: string;
}

export function createDefaultRestructureConfig(): RestructureConfig {
  return {
    enabled: false,
    monthlyRate: 3.11,
    termMonths: 24,
    bsmvRate: 15,
    kkdfRate: 15,
    sourceLabel: 'TCMB Referans Oran Bazlı Yapılandırma',
  };
}

export function createNewProfile(name: string, isGuest: boolean = false, withDefaults: boolean = true): UserProfile {
  const tariff: TariffPeriod = 'nov_2026';
  const debts = withDefaults ? createDefaultDebts(tariff) : [];
  return {
    id: isGuest ? 'guest-profile' : `profile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    isGuest,
    createdAt: new Date().toISOString(),
    monthlyBudget: withDefaults ? 22000 : 0,
    tariffPeriod: tariff,
    calculationMode: 'fixed',
    selectedStrategy: 'avalanche',
    debts,
    extraPayments: [],
    actualLogs: {},
    customPriorityOrder: debts.map((d) => d.id),
    restructureConfig: createDefaultRestructureConfig(),
    savedPlans: [],
  };
}

function migrateLegacyData(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const tariff: TariffPeriod = 'nov_2026';
    const migratedDebts: DebtItem[] = [];

    if (Array.isArray(parsed.debtsList) && parsed.debtsList.length > 0) {
      for (const item of parsed.debtsList) {
        const amt = Number(item?.amount || 0);
        if (amt <= 0) continue;
        const nameLower = String(item?.name || '').toLowerCase();
        const inferredType = nameLower.includes('kmh') || nameLower.includes('ek hesap')
          ? 'kmh'
          : nameLower.includes('kredi') && !nameLower.includes('kart')
            ? 'consumer_loan'
            : 'credit_card';
        const preset = getPresetForDebt(inferredType, amt, undefined, tariff);
        const manualRate = typeof parsed.monthlyInterestRate === 'number' && parsed.monthlyInterestRate > 0
          ? parsed.monthlyInterestRate
          : preset.contractualRate;
        migratedDebts.push({
          id: String(item.id || `mig-${Math.random().toString(36).slice(2, 7)}`),
          name: String(item.name || 'Borç Kalemi'),
          type: inferredType,
          balance: amt,
          contractualRate: manualRate,
          overdueRate: Math.max(manualRate + 0.3, preset.overdueRate),
          bsmvRate: preset.bsmvRate,
          kkdfRate: preset.kkdfRate,
          minPaymentRate: preset.minPaymentRate,
          dueDay: 15,
          isOverdue: false,
          overdueDays: 0,
          rateSource: 'Önceki Kayıttan Aktarıldı',
          rateUpdatedAt: new Date().toISOString().slice(0, 10),
          isManualRate: typeof parsed.monthlyInterestRate === 'number',
        });
      }
    } else if (typeof parsed.debt === 'number' && parsed.debt > 0) {
      const preset = getPresetForDebt('credit_card', parsed.debt, undefined, tariff);
      const manualRate = typeof parsed.monthlyInterestRate === 'number' ? parsed.monthlyInterestRate : preset.contractualRate;
      migratedDebts.push({
        id: 'mig-main-debt',
        name: 'Toplam Borç',
        type: 'credit_card',
        balance: parsed.debt,
        contractualRate: manualRate,
        overdueRate: Math.max(manualRate + 0.3, preset.overdueRate),
        bsmvRate: preset.bsmvRate,
        kkdfRate: preset.kkdfRate,
        minPaymentRate: preset.minPaymentRate,
        dueDay: 15,
        isOverdue: false,
        overdueDays: 0,
        rateSource: 'Önceki Kayıttan Aktarıldı',
        rateUpdatedAt: new Date().toISOString().slice(0, 10),
        isManualRate: true,
      });
    }

    if (migratedDebts.length === 0 && !parsed.income) {
      return null;
    }

    const profile = createNewProfile('Misafir Hesabı', true, false);
    profile.monthlyBudget = typeof parsed.income === 'number' ? Math.max(0, parsed.income) : 0;
    profile.calculationMode = parsed.calculationMode === 'revolving' ? 'revolving' : 'fixed';
    profile.debts = migratedDebts;
    profile.customPriorityOrder = migratedDebts.map((d) => d.id);
    return profile;
  } catch {
    return null;
  }
}

export function loadProfileStore(): ProfileStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2);
    const activeId = localStorage.getItem(ACTIVE_PROFILE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validActive = parsed.some((p: UserProfile) => p.id === activeId)
          ? (activeId as string)
          : parsed[0].id;
        return { profiles: parsed, activeProfileId: validActive };
      }
    }

    // Attempt legacy migration before seeding fresh default
    const migrated = migrateLegacyData();
    const initialProfile = migrated ?? createNewProfile('Misafir Hesabı', true, true);
    const store: ProfileStore = {
      profiles: [initialProfile],
      activeProfileId: initialProfile.id,
    };
    saveProfileStore(store);
    return store;
  } catch {
    const fallback = createNewProfile('Misafir Hesabı', true, true);
    return { profiles: [fallback], activeProfileId: fallback.id };
  }
}

export function saveProfileStore(store: ProfileStore): void {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(store.profiles));
    localStorage.setItem(ACTIVE_PROFILE_KEY, store.activeProfileId);
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}

export function createPlanSnapshot(
  profile: UserProfile,
  planName: string,
  activeResult: StrategyResult
): SavedPlanSnapshot {
  const totalDebt = profile.debts
    .filter((d) => !d.isPaidOff && d.balance > 0)
    .reduce((s, d) => s + d.balance, 0);

  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: planName.trim() || `Plan (${new Date().toLocaleDateString('tr-TR')})`,
    createdAt: new Date().toISOString(),
    tariffPeriod: profile.tariffPeriod,
    monthlyBudget: profile.monthlyBudget,
    calculationMode: profile.calculationMode,
    selectedStrategy: profile.selectedStrategy,
    debts: JSON.parse(JSON.stringify(profile.debts)), // Tarihi oran ve kaynakları dondurur
    extraPayments: JSON.parse(JSON.stringify(profile.extraPayments)),
    actualLogs: JSON.parse(JSON.stringify(profile.actualLogs)),
    customPriorityOrder: [...profile.customPriorityOrder],
    restructureConfig: { ...profile.restructureConfig },
    summarySnapshot: {
      totalDebt,
      totalInterestAndTaxes: activeResult.totalInterestAndTaxes,
      totalPaid: activeResult.totalPaid,
      monthsToPayoff: activeResult.monthsToPayoff,
      estimatedPayoffDate: activeResult.estimatedPayoffDate,
      firstMonthPayment: activeResult.firstMonthPayment,
    },
  };
}

export function exportProfileBackupJson(store: ProfileStore): string {
  return JSON.stringify(
    {
      schema: 'borcplan_backup_v2',
      exportedAt: new Date().toISOString(),
      ...store,
    },
    null,
    2
  );
}

export function parseProfileBackupJson(jsonText: string): ProfileStore | null {
  try {
    const parsed = JSON.parse(jsonText);
    if (!parsed || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
      return null;
    }
    const validProfiles: UserProfile[] = parsed.profiles.filter(
      (p: any) => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.debts)
    );
    if (validProfiles.length === 0) return null;

    const activeId = validProfiles.some((p) => p.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : validProfiles[0].id;

    return {
      profiles: validProfiles,
      activeProfileId: activeId,
    };
  } catch {
    return null;
  }
}

export function wipeAllLocalData(): ProfileStore {
  try {
    localStorage.removeItem(STORAGE_KEY_V2);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
  const fresh = createNewProfile('Misafir Hesabı', true, false);
  const store: ProfileStore = {
    profiles: [fresh],
    activeProfileId: fresh.id,
  };
  saveProfileStore(store);
  return store;
}
