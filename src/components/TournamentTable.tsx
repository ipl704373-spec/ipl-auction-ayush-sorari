/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RoomState } from '../types/cricket';
import { calculatePointsTable, getTournamentCapLeaders } from '../services/matchSimulation';
import { Trophy, Award, TrendingUp, Shield, Flame, Sparkles } from 'lucide-react';

interface TournamentTableProps {
  room: RoomState;
  onNavigateToMatches: () => void;
}

export const TournamentTable: React.FC<TournamentTableProps> = ({
  room,
  onNavigateToMatches
}) => {
  const pointsTable = calculatePointsTable(room.teams, room.matches);
  const { orangeCapLeader, orangeCapTop5, purpleCapLeader, purpleCapTop5 } =
    getTournamentCapLeaders(room.matches);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white font-display uppercase tracking-wide flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" /> League Standings & Caps
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time NRR calculation, Orange Cap & Purple Cap awards race
          </p>
        </div>

        <button
          onClick={onNavigateToMatches}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
        >
          Simulate More Matches →
        </button>
      </div>

      {/* Cap Leaders Showcase Podium Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ORANGE CAP PODIUM */}
        <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-slate-900 to-slate-950 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                🧢
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-display uppercase tracking-wider">
                  Aramco Orange Cap
                </h3>
                <span className="text-[10px] text-orange-400 font-mono">Leading Run Scorer</span>
              </div>
            </div>
            {orangeCapLeader && (
              <span className="text-xl font-black font-mono text-orange-400">
                {orangeCapLeader.runs} <span className="text-xs text-slate-400 font-normal">Runs</span>
              </span>
            )}
          </div>

          {orangeCapLeader ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-orange-500/20 flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-white block">{orangeCapLeader.playerName}</span>
                  <span className="text-xs text-slate-400 font-mono">{orangeCapLeader.teamName}</span>
                </div>
                <div className="text-right text-xs font-mono">
                  <span className="text-slate-400 block">Strike Rate</span>
                  <span className="font-bold text-emerald-400">{orangeCapLeader.strikeRate}</span>
                </div>
              </div>

              {/* Top 5 leaderboard */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                {orangeCapTop5.map((scorer, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300 py-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 w-3">{idx + 1}.</span>
                      <span className="font-medium">{scorer.playerName}</span>
                      <span className="text-[10px] text-slate-500">({scorer.teamName})</span>
                    </span>
                    <span className="font-mono font-bold text-orange-400">{scorer.runs} r</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              Play tournament matches to unlock the Orange Cap race.
            </p>
          )}
        </div>

        {/* PURPLE CAP PODIUM */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-slate-900 to-slate-950 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                🧢
              </div>
              <div>
                <h3 className="font-bold text-sm text-white font-display uppercase tracking-wider">
                  Purple Cap
                </h3>
                <span className="text-[10px] text-purple-400 font-mono">Leading Wicket Taker</span>
              </div>
            </div>
            {purpleCapLeader && (
              <span className="text-xl font-black font-mono text-purple-400">
                {purpleCapLeader.wickets} <span className="text-xs text-slate-400 font-normal">Wickets</span>
              </span>
            )}
          </div>

          {purpleCapLeader ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-purple-500/20 flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-white block">{purpleCapLeader.playerName}</span>
                  <span className="text-xs text-slate-400 font-mono">{purpleCapLeader.teamName}</span>
                </div>
                <div className="text-right text-xs font-mono">
                  <span className="text-slate-400 block">Economy</span>
                  <span className="font-bold text-sky-400">{purpleCapLeader.economy}</span>
                </div>
              </div>

              {/* Top 5 leaderboard */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                {purpleCapTop5.map((taker, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300 py-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-slate-500 w-3">{idx + 1}.</span>
                      <span className="font-medium">{taker.playerName}</span>
                      <span className="text-[10px] text-slate-500">({taker.teamName})</span>
                    </span>
                    <span className="font-mono font-bold text-purple-400">{taker.wickets} w</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">
              Play tournament matches to unlock the Purple Cap race.
            </p>
          )}
        </div>

      </div>

      {/* Main Points Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-display">
            Official Standings & Net Run Rate (NRR)
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-400">Playoffs Zone (Top 4)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono text-[11px] uppercase">
                <th className="py-3 px-4">Pos</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-3 text-center">P</th>
                <th className="py-3 px-3 text-center">W</th>
                <th className="py-3 px-3 text-center">L</th>
                <th className="py-3 px-3 text-center">T</th>
                <th className="py-3 px-4 text-center font-bold text-white">Pts</th>
                <th className="py-3 px-4 text-right">NRR</th>
              </tr>
            </thead>
            <tbody>
              {pointsTable.map((row, index) => {
                const isPlayoffZone = index < 4;
                const isUser = room.teams.find((t) => t.id === row.teamId)?.isUserTeam;

                return (
                  <tr
                    key={row.teamId}
                    className={`border-b border-slate-800/60 transition-colors ${
                      isUser
                        ? 'bg-amber-400/10 font-bold'
                        : index % 2 === 0
                        ? 'bg-slate-950/30'
                        : 'bg-transparent'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <div className="flex items-center gap-2">
                        {isPlayoffZone && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        )}
                        <span className={index === 0 ? 'text-amber-400' : 'text-slate-400'}>
                          {index + 1}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: row.primaryColor }}
                        />
                        <span className="font-semibold text-slate-200">
                          {row.teamName}
                          {isUser && <span className="ml-1.5 text-[10px] text-amber-400 font-mono">(You)</span>}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center font-mono text-slate-300">{row.played}</td>
                    <td className="py-3.5 px-3 text-center font-mono text-emerald-400 font-bold">{row.won}</td>
                    <td className="py-3.5 px-3 text-center font-mono text-rose-400">{row.lost}</td>
                    <td className="py-3.5 px-3 text-center font-mono text-slate-400">{row.tied}</td>
                    <td className="py-3.5 px-4 text-center font-mono text-base font-black text-amber-400">
                      {row.points}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold">
                      <span className={row.nrr >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {row.nrr > 0 ? `+${row.nrr.toFixed(3)}` : row.nrr.toFixed(3)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
