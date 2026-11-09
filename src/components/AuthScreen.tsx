/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount } from '../types/cricket';
import { SECURITY_QUESTIONS } from '../data/iplFranchises';
import { registerUser, loginUser, recoverPassword } from '../services/storage';
import {
  ShieldCheck,
  KeyRound,
  User,
  Lock,
  HelpCircle,
  Gift,
  Radio,
  Trophy,
  Swords,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AuthScreenProps {
  onSuccess: (user: UserAccount) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password.trim() || !securityAnswer.trim()) {
      setError('Please fill in all required registration fields.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerUser(username, password, securityQuestion, securityAnswer);
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setError(res.error || 'Failed to create account.');
      }
    } catch {
      setError('Network or server error during registration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter both your username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginUser(username, password);
      if (res.success && res.user) {
        onSuccess(res.user);
      } else {
        setError(res.error || 'Invalid credentials. Please verify your details or register.');
      }
    } catch {
      setError('Network or server error during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !securityAnswer.trim() || !newPassword.trim()) {
      setError('Please fill in all fields to reset your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await recoverPassword(username, securityAnswer, newPassword);
      if (res.success) {
        setSuccessMsg('Password updated successfully! You can now sign in.');
        setTab('LOGIN');
        setPassword(newPassword);
      } else {
        setError(res.error || 'Password recovery failed. Check your username and answer.');
      }
    } catch {
      setError('Error communicating with recovery service.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick fill helper for convenience
  const fillSample = (role: 'CHOPRA' | 'DHONI') => {
    if (role === 'CHOPRA') {
      setUsername('AakashChopra');
      setPassword('ipl2026!');
      setSecurityAnswer('Cricket');
    } else {
      setUsername('Thala07');
      setPassword('csk2026!');
      setSecurityAnswer('Chennai');
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center px-4 py-12 sm:px-6 lg:px-8 z-10 selection:bg-amber-400 selection:text-slate-950">
      
      {/* Stadium Accent Lighting */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[400px] rounded-full bg-blue-600/10 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-4xl mx-auto space-y-8">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-400 tracking-wide shadow-sm shadow-amber-500/20">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>IPL MEGA AUCTION & TOURNAMENT 2026</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white font-display uppercase leading-none">
            Franchise Command Portal
          </h1>
          
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Please sign in or create your franchise account. The arena and all tournament progress are strictly locked to your verified account and will only show when you are logged in.
          </p>
        </div>

        {/* Main Authentication Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
          
          {/* Tabs Selector */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('LOGIN');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                tab === 'LOGIN'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('REGISTER');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                tab === 'REGISTER'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gift className="w-3.5 h-3.5" /> Register (+₹10M)
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('FORGOT');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 px-3 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                tab === 'FORGOT'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Recovery
            </button>
          </div>

          {/* Registration ₹10M Bonus Notice */}
          {tab === 'REGISTER' && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 p-3.5 text-xs text-amber-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-300">
                <Gift className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-extrabold text-amber-300 uppercase tracking-wide">
                  ₹10,000,000 Base Support Bonus!
                </p>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  Registering a new account instantly credits ₹10M bonus support into your franchise wallet for the Mega Auction!
                </p>
              </div>
            </div>
          )}

          {/* Messages Banner */}
          {error && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {tab === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Franchise Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your franchise username"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('FORGOT');
                      setError(null);
                    }}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Franchise...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In & Open Arena</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Sample Credentials Helper */}
              <div className="pt-4 border-t border-slate-800 text-center">
                <p className="text-[11px] text-slate-400 mb-2">Need a quick demo account?</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fillSample('DHONI')}
                    className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono transition-colors"
                  >
                    Use &ldquo;Thala07&rdquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSample('CHOPRA')}
                    className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono transition-colors"
                  >
                    Use &ldquo;AakashChopra&rdquo;
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: REGISTER FORM */}
          {tab === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Choose Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. MumbaiBoss26"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Create Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Account Recovery Question
                </label>
                <div className="relative">
                  <HelpCircle className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <select
                    value={securityQuestion}
                    onChange={(e) => setSecurityQuestion(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  >
                    {SECURITY_QUESTIONS.map((q, idx) => (
                      <option key={idx} value={q}>
                        {q}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Security Answer
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Your recovery secret answer"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering & Crediting ₹10M...</span>
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" />
                    <span>Claim ₹10M Bonus & Register</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD */}
          {tab === 'FORGOT' && (
            <form onSubmit={handleRecover} className="space-y-4 max-w-lg mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Franchise Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your registered username"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Security Answer
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="Enter the secret answer you saved"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Update Password & Return to Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Feature Grid Highlighting Security & Engine Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-2 font-display uppercase font-bold text-sm">
              <ShieldCheck className="w-4 h-4" /> Account-Locked Progress
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your auction bids, custom franchise squads, tournament fixtures, and purse balance are tied strictly to your account. When logged out, all progress disappears until you sign back in.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-2 font-display uppercase font-bold text-sm">
              <Radio className="w-4 h-4" /> Live Mega Auction
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time paddle bidding, hammer stages (Going Once, Going Twice, Sold), purse calculations, and AI bot bidding strategies across 8 official IPL franchises.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-2 font-display uppercase font-bold text-sm">
              <Swords className="w-4 h-4" /> Cricket Match Engine
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Realistic 20-over match simulation with over-by-over commentary, pitch conditions, wagon wheels, comprehensive batting and bowling scorecards, and live points table.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
