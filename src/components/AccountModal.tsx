import React, { useState, useRef } from 'react';
import {
  X,
  UserPlus,
  Trash2,
  BookmarkCheck,
  Download,
  Upload,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';
import { SavedPlanSnapshot, UserProfile } from '../types/finance';
import { formatCurrencyTR } from '../engine/turkeyMath';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: UserProfile[];
  activeProfile: UserProfile;
  onSwitchProfile: (id: string) => void;
  onCreateProfile: (name: string) => void;
  onDeleteProfile: (id: string) => void;
  onSaveCurrentPlan: (planName: string) => void;
  onLoadPlan: (plan: SavedPlanSnapshot) => void;
  onDeletePlan: (planId: string) => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => boolean;
  onWipeAllData: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfile,
  onSwitchProfile,
  onCreateProfile,
  onDeleteProfile,
  onSaveCurrentPlan,
  onLoadPlan,
  onDeletePlan,
  onExportBackup,
  onImportBackup,
  onWipeAllData,
}) => {
  const [newProfileName, setNewProfileName] = useState('');
  const [planNameDraft, setPlanNameDraft] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const toggleCompare = (planId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(planId)) return prev.filter((id) => id !== planId);
      if (prev.length >= 2) return [prev[1], planId];
      return [...prev, planId];
    });
  };

  const comparedPlans = compareIds
    .map((id) => activeProfile.savedPlans.find((p) => p.id === id))
    .filter((p): p is SavedPlanSnapshot => Boolean(p));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportBackup(String(reader.result || ''));
      setStatusNote(
        ok ? 'Yedek dosyası başarıyla yüklendi.' : 'Geçersiz yedek dosyası formatı.'
      );
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const paidLogs = Object.values(activeProfile.actualLogs).filter((l) => l.isPaid);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white dark:bg-[#111118] border border-zinc-200 dark:border-zinc-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-white">
              Profiller, Kayıtlı Planlar ve Veri Yönetimi
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Verileriniz tarayıcınızda yerel olarak saklanır; JSON yedeğiyle cihazlar arası taşıyabilirsiniz.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-950 dark:hover:text-white rounded-lg cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-6">
          {statusNote && (
            <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-300 dark:border-violet-500/40 text-xs text-violet-900 dark:text-violet-200 flex items-center justify-between">
              <span>{statusNote}</span>
              <button
                type="button"
                onClick={() => setStatusNote(null)}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
              >
                Kapat
              </button>
            </div>
          )}

          {/* 1. Local Profiles */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">Kullanıcı Profilleri (Misafir & Kişisel)</h3>
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => {
                const isActive = p.id === activeProfile.id;
                return (
                  <div
                    key={p.id}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs sm:text-sm ${
                      isActive
                        ? 'bg-violet-600 text-white border-violet-500'
                        : 'bg-zinc-100 dark:bg-[#09090e] text-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSwitchProfile(p.id)}
                      className="font-medium cursor-pointer"
                    >
                      {p.name}
                    </button>
                    {profiles.length > 1 && !p.isGuest && (
                      <button
                        type="button"
                        onClick={() => onDeleteProfile(p.id)}
                        className={`cursor-pointer ${isActive ? 'text-violet-200 hover:text-white' : 'text-zinc-400 hover:text-zinc-950 dark:hover:text-white'}`}
                        title="Profili sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newProfileName.trim()) return;
                onCreateProfile(newProfileName.trim());
                setNewProfileName('');
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Yeni profil adı (Örn: Ev Bütçesi)"
                className="flex-1 px-3 py-2 text-sm text-zinc-950 dark:text-white bg-zinc-50 dark:bg-[#09090e] border border-zinc-300 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-violet-600 dark:focus:border-violet-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 min-h-[40px]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg cursor-pointer min-h-[40px]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Profil Oluştur</span>
              </button>
            </form>
          </div>

          {/* 2. Save Current Plan & Saved Plans List */}
          <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Kayıtlı Ödeme Planları ({activeProfile.savedPlans.length})
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSaveCurrentPlan(planNameDraft || `Plan ${activeProfile.savedPlans.length + 1}`);
                setPlanNameDraft('');
                setStatusNote('Mevcut plan ve geçerli faiz oranları kaydedildi.');
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={planNameDraft}
                onChange={(e) => setPlanNameDraft(e.target.value)}
                placeholder="Plan adı (Örn: Kasım 2026 Çığ Planım)"
                className="flex-1 px-3 py-2 text-sm text-zinc-950 dark:text-white bg-zinc-50 dark:bg-[#09090e] border border-zinc-300 dark:border-zinc-800 rounded-lg focus:outline-none focus:border-violet-600 dark:focus:border-violet-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 min-h-[40px]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-zinc-950 hover:bg-zinc-800 dark:text-zinc-950 dark:bg-white dark:hover:bg-zinc-200 rounded-lg cursor-pointer min-h-[40px]"
              >
                <BookmarkCheck className="w-4 h-4 text-violet-400 dark:text-violet-700" />
                <span>Mevcut Planı Kaydet</span>
              </button>
            </form>

            {activeProfile.savedPlans.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-2">
                Henüz kaydedilmiş plan yok. Farklı strateji veya bütçe senaryolarını kaydedip yan yana karşılaştırabilirsiniz.
              </p>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-[#09090e]">
                {activeProfile.savedPlans.map((plan) => {
                  const isCompared = compareIds.includes(plan.id);
                  return (
                    <div
                      key={plan.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-950 dark:text-white truncate">{plan.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums mt-0.5">
                          {new Date(plan.createdAt).toLocaleDateString('tr-TR')} · Borç{' '}
                          {formatCurrencyTR(plan.summarySnapshot.totalDebt)} · Bütçe{' '}
                          {formatCurrencyTR(plan.monthlyBudget)} ·{' '}
                          {plan.summarySnapshot.monthsToPayoff} Ay · Faiz+Vergi{' '}
                          {formatCurrencyTR(plan.summarySnapshot.totalInterestAndTaxes)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleCompare(plan.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border cursor-pointer ${
                            isCompared
                              ? 'bg-violet-600 text-white border-violet-500'
                              : 'bg-white dark:bg-[#111118] text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-800 hover:border-violet-500/50'
                          }`}
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          <span>{isCompared ? 'Seçildi' : 'Karşılaştır'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onLoadPlan(plan);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-zinc-800 dark:text-zinc-950 dark:bg-white dark:hover:bg-zinc-200 rounded cursor-pointer"
                        >
                          Yükle
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeletePlan(plan.id)}
                          className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                          title="Planı sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {comparedPlans.length === 2 && (
              <div className="bg-zinc-50 dark:bg-[#09090e] border border-violet-300 dark:border-violet-500/30 rounded-lg p-3.5 space-y-2">
                <h4 className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider">
                  Kayıtlı İki Plan Karşılaştırması
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
                  <div className="font-semibold text-zinc-500 dark:text-zinc-400">Kriter</div>
                  <div className="font-bold text-zinc-950 dark:text-white truncate">{comparedPlans[0].name}</div>
                  <div className="font-bold text-zinc-950 dark:text-white truncate">{comparedPlans[1].name}</div>

                  <div className="text-zinc-500 dark:text-zinc-400">Aylık Bütçe</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{formatCurrencyTR(comparedPlans[0].monthlyBudget)}</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{formatCurrencyTR(comparedPlans[1].monthlyBudget)}</div>

                  <div className="text-zinc-500 dark:text-zinc-400">Kapanış Süresi</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{comparedPlans[0].summarySnapshot.monthsToPayoff} Ay</div>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">{comparedPlans[1].summarySnapshot.monthsToPayoff} Ay</div>

                  <div className="text-zinc-500 dark:text-zinc-400">Toplam Faiz+Vergi</div>
                  <div className="font-mono text-violet-700 dark:text-violet-300 font-semibold">
                    {formatCurrencyTR(comparedPlans[0].summarySnapshot.totalInterestAndTaxes)}
                  </div>
                  <div className="font-mono text-violet-700 dark:text-violet-300 font-semibold">
                    {formatCurrencyTR(comparedPlans[1].summarySnapshot.totalInterestAndTaxes)}
                  </div>

                  <div className="text-zinc-500 dark:text-zinc-400">Toplam Geri Ödeme</div>
                  <div className="font-mono text-zinc-950 dark:text-white font-semibold">
                    {formatCurrencyTR(comparedPlans[0].summarySnapshot.totalPaid)}
                  </div>
                  <div className="font-mono text-zinc-950 dark:text-white font-semibold">
                    {formatCurrencyTR(comparedPlans[1].summarySnapshot.totalPaid)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Payment History Summary */}
          <div className="space-y-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">
              Ödeme Geçmişi Özeti ({paidLogs.length} İşaretli Ay)
            </h3>
            {paidLogs.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Henüz ödenmiş olarak işaretlenen bir ay bulunmuyor.</p>
            ) : (
              <div className="flex flex-wrap gap-2 text-xs tabular-nums">
                {paidLogs.map((l) => (
                  <span key={l.month} className="px-2.5 py-1 bg-violet-100 dark:bg-violet-950/40 text-violet-900 dark:text-violet-200 border border-violet-300 dark:border-violet-500/40 rounded">
                    {l.month}. Ay: {formatCurrencyTR(l.actualAmount ?? 0)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 4. JSON Backup & Delete All Data */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onExportBackup}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-[#09090e] hover:bg-zinc-200 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>JSON Yedek İndir</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-[#09090e] hover:bg-zinc-200 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                <span>Yedek Yükle</span>
              </button>
            </div>

            <div>
              {!confirmWipe ? (
                <button
                  type="button"
                  onClick={() => setConfirmWipe(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-[#09090e] hover:bg-zinc-200 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-violet-500/50 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Tüm Verileri Sil</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 bg-violet-50 dark:bg-violet-950/40 border border-violet-300 dark:border-violet-500/50 px-3 py-1.5 rounded-lg text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-violet-700 dark:text-violet-300" />
                  <span className="text-zinc-950 dark:text-white font-medium">Emin misiniz?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onWipeAllData();
                      setConfirmWipe(false);
                      onClose();
                    }}
                    className="px-2 py-1 bg-violet-600 text-white rounded font-semibold cursor-pointer"
                  >
                    Evet, Sil
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(false)}
                    className="px-2 py-1 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    Vazgeç
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
