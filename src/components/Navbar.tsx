/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UserAccount, RoomState } from '../types/cricket';
import { formatCurrency } from '../data/iplFranchises';
import { sound } from '../services/soundFx';
import { Volume2, VolumeX, Trophy, Users, Shield, LogOut, Radio, PlaySquare, Award } from 'lucide-react';

interface NavbarProps {
  currentUser: UserAccount | null;
  activeRoom: RoomState | null;
  activeTab: 'LOBBY' | 'AUCTION' | 'SQUADS' | 'MATCHES' | 'STANDINGS';
  setActiveTab: (tab: 'LOBBY' | 'AUCTION' | 'SQUADS' | 'MATCHES' | 'STANDINGS') => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeRoom,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onLogout
}) => {
  const [muted, setMuted] = React.useState(sound.getMuted());

  const handleToggleSound = () => {
    const isNowMuted = sound.toggleMute();
    setMuted(isNowMuted);
  };

  const userFranchise = activeRoom?.teams.find((t) => t.isUserTeam);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        
        {/* Zone 1: Wordmark & Live Room Badge */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('LOBBY')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 shadow-md shadow-amber-500/20 text-slate-950 font-black text-lg">
              IPL
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold tracking-tight text-white font-display text-xl leading-none uppercase">
                AUCTION ARENA
              </span>
              <span className="text-[10px] font-medium text-amber-400/90 tracking-wider uppercase">
                Premier League 2026
              </span>
            </div>
          </div>

          {activeRoom && (
            <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
              <span className="text-slate-400">Room:</span>
              <span className="font-mono font-bold tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                {activeRoom.code}
              </span>
              {activeRoom.status === 'AUCTION' && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 animate-pulse">
                  <Radio className="w-3 h-3" /> LIVE
                </span>
              )}
            </div>
          )}
        </div>

        {/* Zone 2: Navigation Links (Single-Line Controls) */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-semibold text-slate-300">
          <button
            onClick={() => setActiveTab('LOBBY')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'LOBBY'
                ? 'bg-amber-500/15 text-amber-400 font-bold'
                : 'hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" /> Lobby
          </button>

          <button
            onClick={() => setActiveTab('AUCTION')}
            disabled={!activeRoom}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'AUCTION'
                ? 'bg-amber-500/15 text-amber-400 font-bold'
                : 'hover:text-white hover:bg-slate-900'
            }`}
          >
            <Radio className="w-4 h-4" /> Auction Arena
          </button>

          <button
            onClick={() => setActiveTab('SQUADS')}
            disabled={!activeRoom}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'SQUADS'
                ? 'bg-amber-500/15 text-amber-400 font-bold'
                : 'hover:text-white hover:bg-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" /> Squad Hub
          </button>

          <button
            onClick={() => setActiveTab('MATCHES')}
            disabled={!activeRoom}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'MATCHES'
                ? 'bg-amber-500/15 text-amber-400 font-bold'
                : 'hover:text-white hover:bg-slate-900'
            }`}
          >
            <PlaySquare className="w-4 h-4" /> Match Center
          </button>

          <button
            onClick={() => setActiveTab('STANDINGS')}
            disabled={!activeRoom}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'STANDINGS'
                ? 'bg-amber-500/15 text-amber-400 font-bold'
                : 'hover:text-white hover:bg-slate-900'
            }`}
          >
            <Trophy className="w-4 h-4" /> Standings
          </button>
        </nav>

        {/* Zone 3: Purse Wallet, Audio & User Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Sound Toggle */}
          <button
            onClick={handleToggleSound}
            title={muted ? 'Unmute Stadium Sounds' : 'Mute Sounds'}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* User Purse / Franchise Info */}
          {userFranchise && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: userFranchise.primaryColor }}
              />
              <span className="text-xs font-bold text-slate-200">{userFranchise.shortName}</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {formatCurrency(userFranchise.budget)}
              </span>
            </div>
          )}

          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="hidden xl:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-200">{currentUser.username}</span>
                <span className="text-[10px] font-mono text-amber-400">
                  Wallet: {formatCurrency(currentUser.purseBalance)}
                </span>
              </div>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm shadow-amber-400/20 transition-colors whitespace-nowrap"
            >
              Sign In / Bonus
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex md:hidden overflow-x-auto border-t border-slate-900 px-3 py-1.5 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('LOBBY')}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap ${
            activeTab === 'LOBBY' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          Lobby
        </button>
        <button
          onClick={() => setActiveTab('AUCTION')}
          disabled={!activeRoom}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap disabled:opacity-40 ${
            activeTab === 'AUCTION' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          Auction
        </button>
        <button
          onClick={() => setActiveTab('SQUADS')}
          disabled={!activeRoom}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap disabled:opacity-40 ${
            activeTab === 'SQUADS' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          Squads
        </button>
        <button
          onClick={() => setActiveTab('MATCHES')}
          disabled={!activeRoom}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap disabled:opacity-40 ${
            activeTab === 'MATCHES' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          Matches
        </button>
        <button
          onClick={() => setActiveTab('STANDINGS')}
          disabled={!activeRoom}
          className={`px-2.5 py-1 rounded-md whitespace-nowrap disabled:opacity-40 ${
            activeTab === 'STANDINGS' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400'
          }`}
        >
          Table
        </button>
      </div>
    </header>
  );
};
