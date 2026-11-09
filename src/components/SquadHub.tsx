/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RoomState, Team, Player } from '../types/cricket';
import { formatCurrency } from '../data/iplFranchises';
import { getOrAutoSelectPlayingXI } from '../services/matchSimulation';
import { saveRoom, getCurrentUser } from '../services/storage';
import {
  Shield,
  Star,
  Users,
  Award,
  Crown,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Info
} from 'lucide-react';

interface SquadHubProps {
  room: RoomState;
  onUpdateRoom: (updated: RoomState) => void;
  onNavigateToMatches: () => void;
}

export const SquadHub: React.FC<SquadHubProps> = ({
  room,
  onUpdateRoom,
  onNavigateToMatches
}) => {
  const currentUser = getCurrentUser();
  const userTeam =
    room.teams.find((t) => t.userId === currentUser?.id) ||
    room.teams.find((t) => t.isUserTeam) ||
    room.teams[0];

  const [selectedTeamId, setSelectedTeamId] = useState(userTeam.id);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER'>('ALL');
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<Player | null>(null);

  const currentViewTeam = room.teams.find((t) => t.id === selectedTeamId) || userTeam;
  const isMyTeam =
    currentViewTeam.userId === currentUser?.id ||
    (currentViewTeam.isUserTeam && (!currentViewTeam.userId || currentViewTeam.userId === currentUser?.id));

  // Selected Playing XI IDs
  const activePlayingXI = getOrAutoSelectPlayingXI(currentViewTeam);
  const [playingXIIds, setPlayingXIIds] = useState<string[]>(
    currentViewTeam.playingXIIds && currentViewTeam.playingXIIds.length === 11
      ? currentViewTeam.playingXIIds
      : activePlayingXI.map((p) => p.id)
  );

  const [captainId, setCaptainId] = useState<string | undefined>(
    currentViewTeam.captainId || activePlayingXI[0]?.id
  );
  const [viceCaptainId, setViceCaptainId] = useState<string | undefined>(
    currentViewTeam.viceCaptainId || activePlayingXI[1]?.id
  );

  // Overseas in Playing XI check
  const selectedXIPlayers = currentViewTeam.players.filter((p) => playingXIIds.includes(p.id));
  const overseasCountInXI = selectedXIPlayers.filter((p) => p.isOverseas).length;
  const isXIValid = playingXIIds.length === 11 && overseasCountInXI <= 4;

  const togglePlayerInXI = (playerId: string) => {
    if (!isMyTeam) return; // Only edit your own franchise team

    const player = currentViewTeam.players.find((p) => p.id === playerId);
    if (!player) return;

    if (playingXIIds.includes(playerId)) {
      setPlayingXIIds(playingXIIds.filter((id) => id !== playerId));
    } else {
      if (playingXIIds.length >= 11) return;
      if (player.isOverseas && overseasCountInXI >= 4) {
        alert('IPL Rule: Maximum 4 Overseas players allowed in the Playing XI!');
        return;
      }
      setPlayingXIIds([...playingXIIds, playerId]);
    }
  };

  const handleAutoSelectBestXI = () => {
    const autoXI = getOrAutoSelectPlayingXI(currentViewTeam);
    const ids = autoXI.map((p) => p.id);
    setPlayingXIIds(ids);
    if (!captainId && autoXI[0]) setCaptainId(autoXI[0].id);
    if (!viceCaptainId && autoXI[1]) setViceCaptainId(autoXI[1].id);

    // Save to team
    saveTeamXI(ids, captainId || autoXI[0]?.id, viceCaptainId || autoXI[1]?.id);
  };

  const saveTeamXI = (xiIds: string[], capId?: string, vcId?: string) => {
    const updatedTeams = room.teams.map((t) => {
      if (t.id === currentViewTeam.id) {
        return {
          ...t,
          playingXIIds: xiIds,
          captainId: capId,
          viceCaptainId: vcId
        };
      }
      return t;
    });

    const updatedRoom: RoomState = {
      ...room,
      teams: updatedTeams
    };
    onUpdateRoom(updatedRoom);
    saveRoom(updatedRoom);
  };

  const filteredPlayers = currentViewTeam.players.filter((p) => {
    if (roleFilter === 'ALL') return true;
    return p.role === roleFilter;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      
      {/* Franchise Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-base shadow-lg"
            style={{ backgroundColor: currentViewTeam.primaryColor }}
          >
            {currentViewTeam.shortName}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white font-display uppercase tracking-wide">
              {currentViewTeam.name} Roster
            </h1>
            <p className="text-xs text-slate-400">
              {isMyTeam ? 'Your Team · Manage Squad & Playing XI' : 'Franchise Profile'}
            </p>
          </div>
        </div>

        {/* Team Selector Dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={selectedTeamId}
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              const t = room.teams.find((tm) => tm.id === e.target.value);
              if (t) {
                const xi = getOrAutoSelectPlayingXI(t);
                setPlayingXIIds(t.playingXIIds || xi.map((p) => p.id));
                setCaptainId(t.captainId || xi[0]?.id);
                setViceCaptainId(t.viceCaptainId || xi[1]?.id);
              }
            }}
            className="rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
          >
            {room.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.isUserTeam ? '(You)' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={onNavigateToMatches}
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
          >
            Match Center →
          </button>
        </div>
      </div>

      {/* Squad KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Squad Strength</span>
          <span className="text-lg font-bold font-mono text-white">
            {currentViewTeam.players.length} <span className="text-xs text-slate-500">/ 25 Max</span>
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Purse Left</span>
          <span className="text-lg font-bold font-mono text-emerald-400">
            {formatCurrency(currentViewTeam.budget)}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Spent</span>
          <span className="text-lg font-bold font-mono text-amber-400">
            {formatCurrency(currentViewTeam.initialBudget - currentViewTeam.budget)}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Overseas Cap</span>
          <span className="text-lg font-bold font-mono text-sky-400">
            {currentViewTeam.players.filter((p) => p.isOverseas).length} <span className="text-xs text-slate-500">/ 8 Max</span>
          </span>
        </div>
      </div>

      {/* Playing XI Selection Panel */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 backdrop-blur-md shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white font-display uppercase tracking-wide flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" /> Match Day Playing XI
            </h2>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className={`font-semibold ${playingXIIds.length === 11 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {playingXIIds.length} / 11 Players Selected
              </span>
              <span className="text-slate-600">·</span>
              <span className={`font-semibold ${overseasCountInXI <= 4 ? 'text-sky-400' : 'text-rose-400'}`}>
                {overseasCountInXI} / 4 Overseas Players
              </span>
            </div>
          </div>

          {currentViewTeam.isUserTeam && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoSelectBestXI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:text-amber-400 border border-slate-700 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" /> Auto-Pick Optimal XI
              </button>
              <button
                onClick={() => saveTeamXI(playingXIIds, captainId, viceCaptainId)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors"
              >
                Save Lineup
              </button>
            </div>
          )}
        </div>

        {/* Selected XI Badges List */}
        {selectedXIPlayers.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No players selected yet. Click "Auto-Pick Optimal XI" or select players from your roster below.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {selectedXIPlayers.map((player, idx) => {
              const isCap = captainId === player.id;
              const isVc = viceCaptainId === player.id;
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono text-slate-500 font-bold w-4 text-center">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-200 truncate flex items-center gap-1">
                        {player.name}
                        {player.isOverseas && <span className="text-[10px] text-sky-400">✈️</span>}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {player.role.replace('_', ' ')} · {player.rating} RTG
                      </span>
                    </div>
                  </div>

                  {currentViewTeam.isUserTeam && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setCaptainId(player.id);
                          if (viceCaptainId === player.id) setViceCaptainId(undefined);
                        }}
                        title="Set Captain"
                        className={`p-1 rounded text-[10px] font-bold ${
                          isCap ? 'bg-amber-400 text-slate-950' : 'text-slate-500 hover:text-amber-400'
                        }`}
                      >
                        (C)
                      </button>
                      <button
                        onClick={() => {
                          setViceCaptainId(player.id);
                          if (captainId === player.id) setCaptainId(undefined);
                        }}
                        title="Set Vice Captain"
                        className={`p-1 rounded text-[10px] font-bold ${
                          isVc ? 'bg-sky-400 text-slate-950' : 'text-slate-500 hover:text-sky-400'
                        }`}
                      >
                        (VC)
                      </button>
                      <button
                        onClick={() => togglePlayerInXI(player.id)}
                        className="text-slate-500 hover:text-rose-400 px-1 font-bold"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800 max-w-lg overflow-x-auto">
        {(['ALL', 'BATSMAN', 'ALL_ROUNDER', 'WICKET_KEEPER', 'BOWLER'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRoleFilter(r)}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              roleFilter === r
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {r === 'ALL' ? 'All Squad' : r.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Squad Player Cards Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400 text-sm">
          No players purchased in this category yet. Return to the Live Auction to acquire talent.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlayers.map((player) => {
            const inXI = playingXIIds.includes(player.id);
            return (
              <div
                key={player.id}
                className={`relative rounded-2xl border p-4 transition-all ${
                  inXI
                    ? 'border-amber-400/40 bg-slate-900/90 shadow-lg shadow-amber-400/5'
                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0 font-display"
                      style={{ backgroundColor: player.avatarBgColor || '#3b82f6' }}
                    >
                      {player.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white leading-tight">{player.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                        <span>{player.role.replace('_', ' ')}</span>
                        <span>·</span>
                        <span className={player.isOverseas ? 'text-sky-400' : 'text-emerald-400'}>
                          {player.country}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-mono block">Bought For</span>
                    <span className="text-xs font-black font-mono text-amber-400">
                      {formatCurrency(player.soldPrice || player.basePrice)}
                    </span>
                  </div>
                </div>

                {/* Rating & Skill */}
                <div className="mb-3 flex items-center justify-between text-xs text-slate-400 bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                  <span className="font-semibold text-slate-300 truncate max-w-[200px]">
                    {player.specialSkill}
                  </span>
                  <span className="font-mono font-bold text-amber-400 shrink-0">
                    {player.rating} RTG
                  </span>
                </div>

                {/* Card footer CTA */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <button
                    onClick={() => setSelectedPlayerModal(player)}
                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    <Info className="w-3.5 h-3.5" /> Full Stats
                  </button>

                  {currentViewTeam.isUserTeam && (
                    <button
                      onClick={() => togglePlayerInXI(player.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                        inXI
                          ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {inXI ? '✓ In Starting XI' : '+ Add to XI'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Player Stats Modal */}
      {selectedPlayerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedPlayerModal(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ×
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg font-display"
                style={{ backgroundColor: selectedPlayerModal.avatarBgColor || '#3b82f6' }}
              >
                {selectedPlayerModal.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-display uppercase">{selectedPlayerModal.name}</h3>
                <p className="text-xs text-slate-400">{selectedPlayerModal.country} · {selectedPlayerModal.role}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs mb-6">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block mb-1">Batting Style</span>
                <span className="font-semibold text-slate-200">{selectedPlayerModal.battingStyle}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block mb-1">Bowling Style</span>
                <span className="font-semibold text-slate-200">{selectedPlayerModal.bowlingStyle}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block font-mono">Runs / Average</span>
                  <span className="font-bold text-slate-200">{selectedPlayerModal.stats.runs} ({selectedPlayerModal.stats.average})</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block font-mono">Strike Rate</span>
                  <span className="font-bold text-emerald-400">{selectedPlayerModal.stats.strikeRate}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block font-mono">Wickets / Economy</span>
                  <span className="font-bold text-sky-400">{selectedPlayerModal.stats.wickets} ({selectedPlayerModal.stats.economy || '-'})</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-500 block font-mono">50s / 100s</span>
                  <span className="font-bold text-amber-400">{selectedPlayerModal.stats.fifties} / {selectedPlayerModal.stats.hundreds}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlayerModal(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
