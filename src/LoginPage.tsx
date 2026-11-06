import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  UserCheck,
  ShieldCheck,
  Eye,
  EyeOff,
  LogIn,
  RotateCcw,
  Check,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  Download,
  Edit2,
  Users
} from 'lucide-react';
import {
  AuthAccount,
  DEFAULT_AUTH_ACCOUNTS,
  authenticateLoginAccount,
  getVerifiedDeveloperMetadata,
  attachSafeCreditWatchdog,
  getWashmenLogoSrc,
  WASHMEN_LOGO_FALLBACK
} from './kioskTypes';

const _LOGIN_DEV_META = getVerifiedDeveloperMetadata();

interface LoginPageProps {
  accounts: AuthAccount[];
  currentTime: Date;
  onLoginSuccess: (account: AuthAccount) => void;
}

export function LoginPage({ accounts, currentTime, onLoginSuccess }: LoginPageProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || 'acc_manager');
  const [usernameInput, setUsernameInput] = useState<string>(accounts[0]?.username || 'Manager');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [showCredentialsGuide, setShowCredentialsGuide] = useState<boolean>(false);
  const [creatorModalOpen, setCreatorModalOpen] = useState<boolean>(false);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const loginCreditContainerRef = useRef<HTMLDivElement | null>(null);
  const loginModalCreditRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return attachSafeCreditWatchdog(
      loginCreditContainerRef.current,
      _LOGIN_DEV_META.fullName,
      _LOGIN_DEV_META.verificationTitle
    );
  }, []);

  useEffect(() => {
    if (!creatorModalOpen) return;
    return attachSafeCreditWatchdog(
      loginModalCreditRef.current,
      _LOGIN_DEV_META.fullName,
      _LOGIN_DEV_META.verificationTitle
    );
  }, [creatorModalOpen]);

  const handleSelectAccountCard = (acc: AuthAccount) => {
    setSelectedAccountId(acc.id);
    setUsernameInput(acc.username);
    setLoginError('');
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const matched = authenticateLoginAccount(accounts, usernameInput, passwordInput);
    if (!matched) {
      setLoginError('Invalid username or password. Please check your credentials and try again.');
      return;
    }
    setPasswordInput('');
    onLoginSuccess(matched);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FC] text-[#171262] font-sans antialiased selection:bg-[#4D3FDC] selection:text-white">
      {/* Top Header */}
      <header className="bg-[#251B7C] text-white border-b border-[#1E1668] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <img
              src={getWashmenLogoSrc()}
              alt="Washmen Laundry Logo"
              width={44}
              height={44}
              className="w-11 h-11 rounded-xl object-contain bg-[#17105C] p-1 border border-white/20 shadow-inner"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.src !== WASHMEN_LOGO_FALLBACK) img.src = WASHMEN_LOGO_FALLBACK;
              }}
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-extrabold tracking-wider text-white lowercase">
                  washmen
                </span>
                <span className="px-2.5 py-0.5 text-[11px] uppercase tracking-widest font-extrabold bg-[#4D3FDC] text-white rounded-md shadow-sm">
                  WASH &amp; FOLD
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                Break Time Tracker &amp; Shift Portal • Authorized Login
              </p>
            </div>
          </div>

          <div className="bg-[#1C1466] px-3.5 py-1.5 rounded-xl border border-white/10 text-right min-w-[135px]">
            <div className="text-[10px] text-indigo-200 font-medium uppercase tracking-wider">
              {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <div className="text-xs font-black font-mono text-cyan-300">
              {currentTime.toLocaleTimeString('en-US', { hour12: true })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Login Content (PC & Tablet Optimized) */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 bg-white rounded-3xl shadow-xl border border-[#E4E7F2] overflow-hidden">
          {/* Left Column: Role Selection (Manager, Supervisor, Display Kiosk-Only) */}
          <div className="lg:col-span-6 bg-[#251B7C] text-white p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-lg bg-[#4D3FDC] text-xs font-bold text-cyan-200">
                <Lock className="w-3.5 h-3.5" />
                <span>Manager, Supervisor &amp; Display Kiosk Portal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Wash &amp; Fold Break Station Login
              </h1>
              <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed">
                Select your login role below (Manager, Supervisor, or Display Kiosk-Only) and enter your password to continue.
              </p>

              {/* 3 Role Cards (Manager, Supervisor & Display) */}
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
                  Select Login Role:
                </p>
                <div className="grid grid-cols-1 gap-2.5">
                  {accounts.map((acc) => {
                    const isSelected = selectedAccountId === acc.id;
                    const isManager = acc.role === 'Manager';
                    const isDisplay = acc.role === 'Display';
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleSelectAccountCard(acc)}
                        className={`w-full text-left px-4 py-3.5 rounded-2xl border-2 transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-white text-[#171262] border-cyan-300 shadow-lg'
                            : 'bg-[#1C1466]/90 hover:bg-[#1C1466] text-white border-white/15'
                        }`}
                      >
                        <div className="flex items-center space-x-3.5">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              isSelected
                                ? isManager
                                  ? 'bg-amber-400 text-slate-950'
                                  : isDisplay
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#4D3FDC] text-white'
                                : isManager
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-300/30'
                                : isDisplay
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                : 'bg-white/10 text-indigo-200'
                            }`}
                          >
                            {isManager ? 'MGR' : isDisplay ? 'KIOSK' : 'SUP'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm sm:text-base">
                                {isManager
                                  ? 'Manager Login'
                                  : isDisplay
                                  ? 'Display Login (Kiosk Only)'
                                  : 'Supervisor Login'}
                              </span>
                            </div>
                            <p
                              className={`text-xs font-medium mt-0.5 ${
                                isSelected ? 'text-[#5C5A85]' : 'text-indigo-300'
                              }`}
                            >
                              {isManager
                                ? 'Full Dashboard, Kiosk, Reports & Password Access'
                                : isDisplay
                                ? 'Employee Kiosk Only (Dashboard & Reports Prohibited)'
                                : 'Shared Shift Supervisor Access (Dashboard, Kiosk & Reports)'}
                            </p>
                            <p
                              className={`text-[11px] font-mono mt-0.5 ${
                                isSelected ? 'text-[#4D3FDC] font-bold' : 'text-cyan-300'
                              }`}
                            >
                              Username: {acc.username}
                            </p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200">
              <span>PC, Tablet &amp; Android Local Ready</span>
              <button
                type="button"
                onClick={() => setShowCredentialsGuide(!showCredentialsGuide)}
                className="text-cyan-300 hover:text-white font-bold underline cursor-pointer"
              >
                {showCredentialsGuide ? 'Hide Login Help' : 'Login Help'}
              </button>
            </div>
          </div>

          {/* Right Column: Login Credentials Form */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center space-y-6 bg-white">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-[#171262]">
                {selectedAccountId === 'acc_display' ? 'Sign In to Employee Kiosk' : 'Sign In to Portal'}
              </h2>
              <p className="text-xs text-[#5C5A85]">
                Enter your Manager, Supervisor, or Display login credentials to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#171262] mb-1.5">
                  Login Username
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-[#5C5A85] absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => {
                      setUsernameInput(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    placeholder="Manager, Supervisor, or Display"
                    className="w-full bg-[#F8F9FE] border-2 border-[#E4E7F2] rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-[#171262] focus:border-[#4D3FDC] focus:ring-2 focus:ring-[#4D3FDC]/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#171262] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#5C5A85] absolute left-3.5 top-3" />
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    placeholder="Enter password..."
                    className="w-full bg-[#F8F9FE] border-2 border-[#E4E7F2] rounded-xl pl-10 pr-11 py-2.5 text-sm font-bold text-[#171262] focus:border-[#4D3FDC] focus:ring-2 focus:ring-[#4D3FDC]/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#5C5A85] hover:text-[#171262] p-1 cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white font-black py-3 px-5 rounded-xl text-sm shadow-md transition flex items-center justify-center space-x-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  {selectedAccountId === 'acc_display' || usernameInput.trim().toLowerCase() === 'display'
                    ? 'Sign In to Employee Kiosk'
                    : 'Sign In to Dashboard'}
                </span>
              </button>
            </form>

            {/* Collapsible Credentials & Password Reset Info */}
            {showCredentialsGuide && (
              <div className="p-4 rounded-2xl bg-[#F8F9FE] border border-[#D5D0F9] space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#171262]">
                    Default Login Roles
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCredentialsGuide(false)}
                    className="text-[#5C5A85] hover:text-[#171262] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {accounts.map((a) => {
                    const isDefault = a.password === a.defaultPassword;
                    return (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-[#E4E7F2]"
                      >
                        <div>
                          <strong className="text-[#171262]">{a.role} Login:</strong>{' '}
                          <span className="font-mono text-[#4D3FDC]">({a.username})</span>
                        </div>
                        <span className="font-mono font-bold text-[#5C5A85]">
                          {isDefault ? `Default PW: ${a.defaultPassword}` : 'Custom password active'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[#5C5A85] leading-relaxed">
                  To change or reset either password, sign in and open the{' '}
                  <strong className="text-[#171262]">Settings &amp; Backup</strong> tab.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-[#E4E7F2] text-[11px] text-[#5C5A85] flex items-center justify-between">
              <span>Need to reset a password?</span>
              <span className="font-semibold text-[#171262]">
                Go to Settings &amp; Backup after login
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Permanent Footer */}
      <footer
        data-system-architect={_LOGIN_DEV_META.fullName}
        data-created-by={_LOGIN_DEV_META.createdByLabel}
        className="bg-[#251B7C] border-t border-[#1E1668] py-4 mt-auto text-indigo-200 text-xs shadow-md"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <img
                src={getWashmenLogoSrc()}
                alt="Logo"
                width={20}
                height={20}
                className="w-5 h-5 rounded object-contain bg-[#17105C] p-0.5 border border-white/20"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== WASHMEN_LOGO_FALLBACK) img.src = WASHMEN_LOGO_FALLBACK;
                }}
              />
              <span className="font-bold text-white lowercase">washmen</span>
              <span>•</span>
              <span className="text-indigo-200">Wash &amp; Fold Department</span>
            </div>

            <div className="flex items-center space-x-2.5">
              <div
                ref={loginCreditContainerRef}
                data-credit-container="login"
                className="flex items-center space-x-2.5"
              >
                <span data-uf-protected-label="true" className="text-indigo-200">
                  Created By
                </span>
                <span>•</span>
                <span data-uf-protected-name="true" className="font-bold text-white">
                  {_LOGIN_DEV_META.fullName}
                </span>
                <span data-uf-protected-title="true" className="sr-only">
                  About the creator
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCreatorModalOpen(true)}
                className="text-indigo-300 hover:text-white p-1.5 transition cursor-pointer"
                title="About the creator"
                aria-label="About the creator"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-2.5 border-t border-white/10 text-center text-indigo-200/90 text-xs font-medium tracking-wide">
            © 2026 Washmen. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Modal: About the creator */}
      {creatorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            ref={loginModalCreditRef}
            data-credit-container="login-modal"
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-[#E4E7F2]"
          >
            <div className="bg-[#251B7C] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-cyan-300" />
                <h3 data-uf-protected-title="true" className="font-bold text-base text-white">
                  About the creator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCreatorModalOpen(false)}
                className="text-indigo-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-[#4D3FDC] mx-auto flex items-center justify-center shadow-md text-white font-black text-2xl">
                UF
              </div>

              <div>
                <h4 data-uf-protected-name="true" className="text-lg font-black text-[#171262]">
                  {_LOGIN_DEV_META.fullName}
                </h4>
                <p className="text-xs text-[#4D3FDC] font-bold">Wash &amp; Fold Department • Washmen Laundry</p>
                <p className="text-xs text-[#5C5A85] mt-1">Creator &amp; Lead Architect of this Break Management System</p>
              </div>

              <div className="bg-[#F8F9FE] p-4 rounded-xl border border-[#E4E7F2] text-left text-xs space-y-2 text-[#5C5A85]">
                <p className="text-[11px] text-[#5C5A85]">
                  This system was conceptualized, structured, and customized by{' '}
                  <strong data-uf-protected-name="true">{_LOGIN_DEV_META.fullName}</strong> to solve shift break overruns,
                  maintain employee fairness, and streamline supervisor logs.
                </p>
                <div className="pt-1 flex items-center text-[#4D3FDC] font-medium text-xs">
                  <Check className="w-4 h-4 text-emerald-600 mr-1.5" />
                  <span>Project Creator &amp; Author</span>
                </div>
              </div>

              <a
                href={_LOGIN_DEV_META.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#0077b5] hover:bg-[#006396] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center space-x-2 shadow-md"
              >
                <span>Visit {_LOGIN_DEV_META.fullName}&apos;s LinkedIn Profile</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AccountPasswordManagerCardProps {
  accounts: AuthAccount[];
  currentUser: AuthAccount | null;
  onUpdateAccounts: (nextAccounts: AuthAccount[]) => void;
  onDownloadUpdatedHtml: () => void;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export function AccountPasswordManagerCard({
  accounts,
  currentUser,
  onUpdateAccounts,
  onDownloadUpdatedHtml,
  showToast,
}: AccountPasswordManagerCardProps) {
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [editUsernameInput, setEditUsernameInput] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState<boolean>(false);
  const [accessWarningMessage, setAccessWarningMessage] = useState<string>('');

  const isCurrentUserManager = currentUser?.role === 'Manager';

  const triggerSupervisorAccessWarning = (msg: string) => {
    setAccessWarningMessage(msg);
    showToast(msg, 'warning');
  };

  const startEditingAccount = (acc: AuthAccount) => {
    if (acc.role === 'Manager' && !isCurrentUserManager) {
      triggerSupervisorAccessWarning(
        'Warning: Supervisor login cannot view or change the Manager password. Only Manager login has access.'
      );
      return;
    }
    setAccessWarningMessage('');
    setEditingAccountId(acc.id);
    setEditUsernameInput(acc.username);
    setNewPasswordInput(acc.password);
    setShowNewPassword(true);
  };

  const handleSaveAccountChanges = (e: React.FormEvent, acc: AuthAccount) => {
    e.preventDefault();
    if (acc.role === 'Manager' && !isCurrentUserManager) {
      triggerSupervisorAccessWarning(
        'Warning: Supervisor login cannot change the Manager password. Only Manager login has access.'
      );
      return;
    }
    const cleanPass = newPasswordInput.trim();
    const cleanUser = editUsernameInput.trim() || acc.username;

    if (cleanPass.length < 4) {
      showToast('Password must be at least 4 characters', 'warning');
      return;
    }

    const updated = accounts.map((item) =>
      item.id === acc.id
        ? {
            ...item,
            username: cleanUser,
            password: cleanPass,
            updatedAt: Date.now(),
          }
        : item
    );

    onUpdateAccounts(updated);
    setEditingAccountId(null);
    setAccessWarningMessage('');
    showToast(`Updated login password for ${acc.role} Login`, 'success');
  };

  const handleResetSingleDefault = (acc: AuthAccount) => {
    if (acc.role === 'Manager' && !isCurrentUserManager) {
      triggerSupervisorAccessWarning(
        'Warning: Supervisor login cannot use "Default PW" in the Manager section. You can only use your own Supervisor "Default PW" card.'
      );
      return;
    }
    setAccessWarningMessage('');
    const def = DEFAULT_AUTH_ACCOUNTS.find((d) => d.id === acc.id);
    if (!def) return;
    const updated = accounts.map((item) =>
      item.id === acc.id
        ? {
            ...item,
            username: def.username,
            password: def.defaultPassword,
            updatedAt: Date.now(),
          }
        : item
    );
    onUpdateAccounts(updated);
    if (editingAccountId === acc.id) {
      setNewPasswordInput(def.defaultPassword);
      setEditUsernameInput(def.username);
    }
    showToast(`${acc.role} Login password reset to default (${def.defaultPassword})`, 'info');
  };

  const handleResetAllDefaults = () => {
    if (!isCurrentUserManager) {
      triggerSupervisorAccessWarning(
        'Warning: Supervisor login does not have access to use "Reset Both Passwords to Default". Only Manager login can reset both passwords.'
      );
      setConfirmResetAllOpen(false);
      return;
    }
    setAccessWarningMessage('');
    const resetList = DEFAULT_AUTH_ACCOUNTS.map((d) => ({
      ...d,
      updatedAt: Date.now(),
    }));
    onUpdateAccounts(resetList);
    setConfirmResetAllOpen(false);
    setEditingAccountId(null);
    showToast('Manager and Supervisor logins reset to default credentials', 'success');
  };

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-[#D5D0F9] space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-[#171262] flex items-center space-x-2 text-sm sm:text-base">
            <Users className="w-5 h-5 text-[#4D3FDC]" />
            <span>Manager &amp; Supervisor Login Password Reset</span>
          </h3>
          <p className="text-xs text-[#5C5A85] mt-0.5">
            {isCurrentUserManager
              ? 'Manager Login has full access to view Supervisor password and reset both Manager and Supervisor passwords.'
              : 'Supervisor Login can only change or reset the Supervisor password. Manager password and "Reset Both Passwords to Default" are restricted to Manager Login.'}
          </p>
        </div>

        {currentUser && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-extrabold border ${
              isCurrentUserManager
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-[#EEECFB] text-[#4D3FDC] border-[#D5D0F9]'
            }`}
          >
            Signed in as: {currentUser.role} ({currentUser.username})
          </span>
        )}
      </div>

      {/* Warning Banner when Supervisor attempts a restricted Manager action */}
      {accessWarningMessage && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 flex items-start justify-between gap-2.5 text-amber-900 text-xs font-bold shadow-2xs">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{accessWarningMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setAccessWarningMessage('')}
            className="text-amber-700 hover:text-amber-950 p-0.5 cursor-pointer shrink-0"
            title="Dismiss warning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3 Role Accounts Cards */}
      <div className="space-y-3 pt-1">
        {accounts.map((acc) => {
          const isManager = acc.role === 'Manager';
          const isDisplay = acc.role === 'Display';
          const isRestrictedForSupervisor = isManager && !isCurrentUserManager;
          const isEditing = !isRestrictedForSupervisor && editingAccountId === acc.id;
          const isShowingPw = !isRestrictedForSupervisor && Boolean(visiblePasswords[acc.id]);

          return (
            <div
              key={acc.id}
              className={`p-4 rounded-2xl border transition ${
                isEditing
                  ? 'bg-[#F8F9FE] border-2 border-[#4D3FDC] shadow-sm'
                  : isRestrictedForSupervisor
                  ? 'bg-slate-50/90 border-slate-200'
                  : 'bg-[#FAFBFD] border-[#E4E7F2]'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      isManager
                        ? 'bg-amber-400 text-slate-950'
                        : isDisplay
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#251B7C] text-white'
                    }`}
                  >
                    {isManager ? 'MGR' : isDisplay ? 'DSP' : 'SUP'}
                  </div>
                  <div>
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-black text-sm text-[#171262]">
                        {isManager
                          ? 'Manager Login'
                          : isDisplay
                          ? 'Display Login (Kiosk Only)'
                          : 'Supervisor Login'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-md ${
                          isManager
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : isDisplay
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-[#EEECFB] text-[#4D3FDC] border border-[#D5D0F9]'
                        }`}
                      >
                        {isManager ? '1 Manager' : isDisplay ? 'Kiosk Only' : 'All 4 Supervisors'}
                      </span>
                      {isRestrictedForSupervisor && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Manager Access Only</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5C5A85] mt-0.5">
                      <span>
                        Username: <strong className="font-mono text-[#171262]">{acc.username}</strong>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1.5">
                        Password:{' '}
                        <strong className="font-mono text-[#4D3FDC]">
                          {isShowingPw ? acc.password : '••••••••'}
                        </strong>
                        <button
                          type="button"
                          onClick={() => {
                            if (isRestrictedForSupervisor) {
                              triggerSupervisorAccessWarning(
                                'Warning: Supervisor login cannot see the Manager password. Only Manager login can view it.'
                              );
                              return;
                            }
                            setAccessWarningMessage('');
                            setVisiblePasswords((prev) => ({
                              ...prev,
                              [acc.id]: !prev[acc.id],
                            }));
                          }}
                          className="text-[#5C5A85] hover:text-[#171262] p-0.5 cursor-pointer"
                          title={
                            isRestrictedForSupervisor
                              ? 'Manager password is hidden for Supervisor login'
                              : isShowingPw
                              ? 'Hide password'
                              : 'Show password'
                          }
                        >
                          {isShowingPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (isRestrictedForSupervisor) {
                        triggerSupervisorAccessWarning(
                          'Warning: Supervisor login cannot change or reset the Manager password. Only Manager login has access.'
                        );
                        return;
                      }
                      if (isEditing) {
                        setEditingAccountId(null);
                      } else {
                        startEditingAccount(acc);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-2xs ${
                      isRestrictedForSupervisor
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                        : 'bg-[#4D3FDC] hover:bg-[#3B2EC9] text-white'
                    }`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Close' : 'Reset / Change Password'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetSingleDefault(acc)}
                    className={`px-2.5 py-1.5 rounded-xl border font-semibold text-xs transition cursor-pointer ${
                      isRestrictedForSupervisor
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-300'
                        : 'bg-white hover:bg-slate-100 text-[#5C5A85] hover:text-[#171262] border-[#E4E7F2]'
                    }`}
                    title={
                      isRestrictedForSupervisor
                        ? 'Restricted: Supervisor login cannot use Default PW in Manager section'
                        : `Reset ${acc.role} password back to default (${acc.defaultPassword})`
                    }
                  >
                    Default PW
                  </button>
                </div>
              </div>

              {isEditing && (
                <form
                  onSubmit={(e) => handleSaveAccountChanges(e, acc)}
                  className="mt-4 pt-4 border-t border-[#D5D0F9] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
                >
                  <div>
                    <label className="block font-bold text-[#171262] mb-1">
                      Login Username ({acc.role})
                    </label>
                    <input
                      type="text"
                      required
                      value={editUsernameInput}
                      onChange={(e) => setEditUsernameInput(e.target.value)}
                      className="w-full bg-white border border-[#D5D0F9] rounded-xl px-3 py-2 font-mono font-bold text-[#171262] focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#171262] mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                        placeholder="Enter new password..."
                        className="w-full bg-white border border-[#D5D0F9] rounded-xl pl-3 pr-9 py-2 font-mono font-bold text-[#171262] focus:ring-2 focus:ring-[#4D3FDC] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-2 text-[#5C5A85] hover:text-[#171262] cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingAccountId(null)}
                      className="px-3.5 py-2 rounded-xl bg-white border border-[#E4E7F2] text-[#5C5A85] font-semibold hover:text-[#171262] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save New Password</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Actions: Reset Both to Default & Download Updated Single-File HTML for GitHub Pages / Android */}
      <div className="pt-3 border-t border-[#E4E7F2] flex flex-wrap items-center justify-between gap-3">
        {!confirmResetAllOpen ? (
          <button
            type="button"
            onClick={() => {
              if (!isCurrentUserManager) {
                triggerSupervisorAccessWarning(
                  'Warning: Supervisor login does not have access to use "Reset Both Passwords to Default". Please use your own Supervisor "Default PW" card only.'
                );
                return;
              }
              setAccessWarningMessage('');
              setConfirmResetAllOpen(true);
            }}
            className={`px-3.5 py-2 rounded-xl border font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer ${
              isCurrentUserManager
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-300'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Both Passwords to Default</span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 bg-rose-50 px-3 py-2 rounded-xl border border-rose-200 text-xs">
            <span className="font-bold text-rose-800">Reset Manager &amp; Supervisor passwords to default?</span>
            <button
              type="button"
              onClick={handleResetAllDefaults}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
            >
              Yes, Reset Both
            </button>
            <button
              type="button"
              onClick={() => setConfirmResetAllOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-slate-700 font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onDownloadUpdatedHtml}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
          title="Download updated index.html with your custom passwords, roster, and settings embedded for GitHub Pages or Android local storage"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save Updated index.html (GitHub Pages / Android)</span>
        </button>
      </div>
    </div>
  );
}
