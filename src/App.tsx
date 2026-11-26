import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { DebtManagerCard } from './components/DebtManagerCard';
import { StrategyComparisonView } from './components/StrategyComparisonView';
import { ChartsDashboard } from './components/ChartsDashboard';
import { MonthlyTracker } from './components/MonthlyTracker';
import { AiAdvisorCard } from './components/AiAdvisorCard';
import { AccountModal } from './components/AccountModal';
import {
  ActualMonthLog,
  CalculationMode,
  DebtItem,
  ExtraPaymentEvent,
  RestructureConfig,
  SavedPlanSnapshot,
  StrategyType,
  TariffPeriod,
  UserProfile,
} from './types/finance';
import { compareAllStrategies } from './engine/turkeyMath';
import { getPresetForDebt } from './engine/turkeyRates';
import {
  createNewProfile,
  createPlanSnapshot,
  exportProfileBackupJson,
  loadProfileStore,
  parseProfileBackupJson,
  ProfileStore,
  saveProfileStore,
  wipeAllLocalData,
} from './utils/storage';

export default function App() {
  const [store, setStore] = useState<ProfileStore>(() => loadProfileStore());
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeProfile: UserProfile = useMemo(() => {
    return (
      store.profiles.find((p) => p.id === store.activeProfileId) ||
      store.profiles[0]
    );
  }, [store]);

  useEffect(() => {
    saveProfileStore(store);
  }, [store]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const updateActiveProfile = (updater: (prev: UserProfile) => UserProfile) => {
    setStore((prevStore) => ({
      ...prevStore,
      profiles: prevStore.profiles.map((p) =>
        p.id === activeProfile.id ? updater(p) : p
      ),
    }));
  };

  // Run multi-debt Turkish calculation engine
  const comparison = useMemo(() => {
    return compareAllStrategies({
      debts: activeProfile.debts,
      monthlyBudget: activeProfile.monthlyBudget,
      tariffPeriod: activeProfile.tariffPeriod,
      calculationMode: activeProfile.calculationMode,
      extraPayments: activeProfile.extraPayments,
      actualLogs: activeProfile.actualLogs,
      customPriorityOrder: activeProfile.customPriorityOrder,
      restructureConfig: activeProfile.restructureConfig,
    });
  }, [
    activeProfile.debts,
    activeProfile.monthlyBudget,
    activeProfile.tariffPeriod,
    activeProfile.calculationMode,
    activeProfile.extraPayments,
    activeProfile.actualLogs,
    activeProfile.customPriorityOrder,
    activeProfile.restructureConfig,
  ]);

  const activeResult = comparison.strategies[activeProfile.selectedStrategy];

  const paidMonthsCount = activeResult.schedule.filter((r) => r.isPaid).length;
  const skippedMonthsCount = activeResult.schedule.filter((r) => r.isSkipped).length;
  const totalActualPaid = activeResult.schedule.reduce(
    (s, r) => s + (r.actualPayment ?? 0),
    0
  );

  // Handlers
  const handleSetMonthlyBudget = (val: number) => {
    updateActiveProfile((p) => ({ ...p, monthlyBudget: val }));
  };

  const handleChangeTariffPeriod = (tariffPeriod: TariffPeriod) => {
    updateActiveProfile((p) => ({
      ...p,
      tariffPeriod,
      debts: p.debts.map((d) => {
        if (d.isManualRate) return d;
        const preset = getPresetForDebt(d.type, d.balance, d.creditLimit, tariffPeriod);
        return {
          ...d,
          contractualRate: preset.contractualRate,
          overdueRate: preset.overdueRate,
          bsmvRate: preset.bsmvRate,
          kkdfRate: preset.kkdfRate,
          minPaymentRate: preset.minPaymentRate,
          rateSource: preset.rateSource,
          rateUpdatedAt: preset.rateUpdatedAt,
        };
      }),
    }));
  };

  const handleSetCalculationMode = (calculationMode: CalculationMode) => {
    updateActiveProfile((p) => ({ ...p, calculationMode }));
  };

  const handleAddDebt = (debt: DebtItem) => {
    updateActiveProfile((p) => ({
      ...p,
      debts: [...p.debts, debt],
      customPriorityOrder: [...p.customPriorityOrder, debt.id],
    }));
  };

  const handleUpdateDebt = (id: string, patch: Partial<DebtItem>) => {
    updateActiveProfile((p) => ({
      ...p,
      debts: p.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  };

  const handleRemoveDebt = (id: string) => {
    updateActiveProfile((p) => ({
      ...p,
      debts: p.debts.filter((d) => d.id !== id),
      customPriorityOrder: p.customPriorityOrder.filter((x) => x !== id),
      extraPayments: p.extraPayments.filter((e) => e.targetDebtId !== id),
    }));
  };

  const handleAddExtraPayment = (ev: ExtraPaymentEvent) => {
    updateActiveProfile((p) => ({
      ...p,
      extraPayments: [...p.extraPayments, ev],
    }));
  };

  const handleRemoveExtraPayment = (id: string) => {
    updateActiveProfile((p) => ({
      ...p,
      extraPayments: p.extraPayments.filter((e) => e.id !== id),
    }));
  };

  const handleUpdateRestructure = (patch: Partial<RestructureConfig>) => {
    updateActiveProfile((p) => ({
      ...p,
      restructureConfig: { ...p.restructureConfig, ...patch },
    }));
  };

  const handleSelectStrategy = (selectedStrategy: StrategyType) => {
    updateActiveProfile((p) => ({ ...p, selectedStrategy }));
  };

  const handleChangeCustomPriority = (customPriorityOrder: string[]) => {
    updateActiveProfile((p) => ({ ...p, customPriorityOrder }));
  };

  const handleUpdateActualLog = (month: number, log: ActualMonthLog | null) => {
    updateActiveProfile((p) => {
      const nextLogs = { ...p.actualLogs };
      if (log === null) {
        delete nextLogs[month];
      } else {
        nextLogs[month] = log;
      }
      return { ...p, actualLogs: nextLogs };
    });
  };

  const handleReset = () => {
    updateActiveProfile((p) => ({
      ...p,
      monthlyBudget: 0,
      debts: [],
      extraPayments: [],
      actualLogs: {},
      customPriorityOrder: [],
      restructureConfig: {
        ...p.restructureConfig,
        enabled: false,
      },
    }));
    setToastMessage('Aktif çalışma alanındaki borç ve bütçe alanları sıfırlandı.');
  };

  // Account & Plan Snapshots
  const handleSaveCurrentPlan = (planName?: string) => {
    const label =
      planName ||
      `${activeResult.shortLabel} (${new Date().toLocaleDateString('tr-TR')})`;
    const snapshot = createPlanSnapshot(activeProfile, label, activeResult);
    updateActiveProfile((p) => ({
      ...p,
      savedPlans: [snapshot, ...p.savedPlans],
    }));
    setToastMessage(`"${snapshot.name}" planı kaydedildi.`);
  };

  const handleLoadPlan = (plan: SavedPlanSnapshot) => {
    updateActiveProfile((p) => ({
      ...p,
      tariffPeriod: plan.tariffPeriod,
      monthlyBudget: plan.monthlyBudget,
      calculationMode: plan.calculationMode,
      selectedStrategy: plan.selectedStrategy,
      debts: JSON.parse(JSON.stringify(plan.debts)),
      extraPayments: JSON.parse(JSON.stringify(plan.extraPayments)),
      actualLogs: JSON.parse(JSON.stringify(plan.actualLogs)),
      customPriorityOrder: [...plan.customPriorityOrder],
      restructureConfig: { ...plan.restructureConfig },
    }));
    setToastMessage(`"${plan.name}" planı tarihi oranlarıyla yüklendi.`);
  };

  const handleDeletePlan = (planId: string) => {
    updateActiveProfile((p) => ({
      ...p,
      savedPlans: p.savedPlans.filter((pl) => pl.id !== planId),
    }));
  };

  const handleSwitchProfile = (id: string) => {
    setStore((prev) => ({ ...prev, activeProfileId: id }));
  };

  const handleCreateProfile = (name: string) => {
    const newProf = createNewProfile(name, false, false);
    setStore((prev) => ({
      profiles: [...prev.profiles, newProf],
      activeProfileId: newProf.id,
    }));
  };

  const handleDeleteProfile = (id: string) => {
    setStore((prev) => {
      const remaining = prev.profiles.filter((p) => p.id !== id);
      if (remaining.length === 0) return prev;
      const nextActive =
        prev.activeProfileId === id ? remaining[0].id : prev.activeProfileId;
      return { profiles: remaining, activeProfileId: nextActive };
    });
  };

  const handleExportBackup = () => {
    const json = exportProfileBackupJson(store);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thoth-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (jsonText: string): boolean => {
    const parsed = parseProfileBackupJson(jsonText);
    if (!parsed) return false;
    setStore(parsed);
    return true;
  };

  const handleWipeAllData = () => {
    const clean = wipeAllLocalData();
    setStore(clean);
    setToastMessage('Tüm yerel profiller ve veriler temizlendi.');
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-zinc-100 font-sans antialiased flex flex-col">
      <Header
        profileName={activeProfile.name}
        savedPlansCount={activeProfile.savedPlans.length}
        onOpenAccountModal={() => setIsAccountModalOpen(true)}
        onReset={handleReset}
      />

      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-40 bg-violet-600 text-white border border-violet-400/40 text-xs sm:text-sm px-4 py-2.5 rounded-lg shadow-xl">
          {toastMessage}
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-6">
        <DebtManagerCard
          monthlyBudget={activeProfile.monthlyBudget}
          setMonthlyBudget={handleSetMonthlyBudget}
          tariffPeriod={activeProfile.tariffPeriod}
          onChangeTariffPeriod={handleChangeTariffPeriod}
          calculationMode={activeProfile.calculationMode}
          setCalculationMode={handleSetCalculationMode}
          debts={activeProfile.debts}
          onAddDebt={handleAddDebt}
          onUpdateDebt={handleUpdateDebt}
          onRemoveDebt={handleRemoveDebt}
          extraPayments={activeProfile.extraPayments}
          onAddExtraPayment={handleAddExtraPayment}
          onRemoveExtraPayment={handleRemoveExtraPayment}
          restructureConfig={activeProfile.restructureConfig}
          onUpdateRestructure={handleUpdateRestructure}
          restructureResult={comparison.restructureResult}
          totalDebt={comparison.totalDebt}
          minimumRequiredFirstMonth={activeResult.minimumRequiredFirstMonth}
          budgetShortfallFirstMonth={activeResult.budgetShortfallFirstMonth}
        />

        <StrategyComparisonView
          comparison={comparison}
          selectedStrategy={activeProfile.selectedStrategy}
          onSelectStrategy={handleSelectStrategy}
          debts={activeProfile.debts}
          customPriorityOrder={activeProfile.customPriorityOrder}
          onChangeCustomPriority={handleChangeCustomPriority}
          onSavePlan={() => handleSaveCurrentPlan()}
        />

        <ChartsDashboard comparison={comparison} activeResult={activeResult} />

        <MonthlyTracker
          profileName={activeProfile.name}
          comparison={comparison}
          activeResult={activeResult}
          debts={activeProfile.debts}
          actualLogs={activeProfile.actualLogs}
          onUpdateActualLog={handleUpdateActualLog}
        />

        <AiAdvisorCard
          comparison={comparison}
          activeResult={activeResult}
          debts={activeProfile.debts}
          paidMonthsCount={paidMonthsCount}
          skippedMonthsCount={skippedMonthsCount}
          totalActualPaid={totalActualPaid}
        />
      </main>

      <footer className="py-6 border-t border-zinc-800/90 bg-[#08080d] text-center text-xs text-zinc-500 px-4">
        <span className="text-zinc-300 font-semibold">Thoth</span> · Hesaplamalar TCMB/BDDK mevzuat parametreleri ve girdiğiniz verilere dayanır; verileriniz tarayıcınızda yerel olarak saklanır.
      </footer>

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        profiles={store.profiles}
        activeProfile={activeProfile}
        onSwitchProfile={handleSwitchProfile}
        onCreateProfile={handleCreateProfile}
        onDeleteProfile={handleDeleteProfile}
        onSaveCurrentPlan={handleSaveCurrentPlan}
        onLoadPlan={handleLoadPlan}
        onDeletePlan={handleDeletePlan}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onWipeAllData={handleWipeAllData}
      />
    </div>
  );
}
