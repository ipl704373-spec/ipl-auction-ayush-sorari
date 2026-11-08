/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { RoomState, Match, Team, BallData, InningsData } from '../types/cricket';
import { simulateFullMatch } from '../services/matchSimulation';
import { sound } from '../services/soundFx';
import { saveRoom } from '../services/storage';
import {
  Play,
  RotateCcw,
  Zap,
  FastForward,
  Trophy,
  Award,
  ChevronRight,
  Shield,
  Clock,
  Sparkles,
  Radio,
  FileText
} from 'lucide-react';

interface MatchCenterProps {
  room: RoomState;
  onUpdateRoom: (updated: RoomState) => void;
  onNavigateToStandings: () => void;
}

export const MatchCenter: React.FC<MatchCenterProps> = ({
  room,
  onUpdateRoom,
  onNavigateToStandings
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    room.matches[room.currentMatchIndex]?.id || room.matches[0]?.id || ''
  );
  const [isSimulatingLive, setIsSimulatingLive] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState<1 | 2 | 5>(2);
  const [liveBallIndex, setLiveBallIndex] = useState(0);
  const [liveInnings, setLiveInnings] = useState<1 | 2>(1);
  const [activeScorecardModalMatch, setActiveScorecardModalMatch] = useState<Match | null>(null);

  const activeMatch = room.matches.find((m) => m.id === selectedMatchId) || room.matches[0];
  const team1 = room.teams.find((t) => t.id === activeMatch?.team1Id);
  const team2 = room.teams.find((t) => t.id === activeMatch?.team2Id);

  const simIntervalRef = useRef<number | null>(null);

  // Instant simulate entire match
  const handleInstantSimulate = (matchToSim: Match) => {
    if (!team1 || !team2) return;
    const completedMatch = simulateFullMatch(matchToSim, team1, team2);

    const updatedMatches = room.matches.map((m) =>
      m.id === completedMatch.id ? completedMatch : m
    );

    const updatedRoom: RoomState = {
      ...room,
      matches: updatedMatches
    };

    onUpdateRoom(updatedRoom);
    saveRoom(updatedRoom);
  };

  // Start live ball-by-ball playback
  const handleStartLiveSimulation = () => {
    if (!activeMatch || !team1 || !team2) return;

    // First generate the full match data if not simulated yet
    let preparedMatch = activeMatch;
    if (activeMatch.status !== 'COMPLETED' || !activeMatch.team1Innings) {
      preparedMatch = simulateFullMatch(activeMatch, team1, team2);
    }

    setLiveBallIndex(0);
    setLiveInnings(1);
    setIsSimulatingLive(true);
  };

  // Live simulation tick
  useEffect(() => {
    if (!isSimulatingLive || !activeMatch || !activeMatch.team1Innings || !activeMatch.team2Innings) {
      return;
    }

    const currentInningsData = liveInnings === 1 ? activeMatch.team1Innings : activeMatch.team2Innings;
    const intervalTime = 1000 / simulationSpeed;

    simIntervalRef.current = window.setInterval(() => {
      setLiveBallIndex((prev) => {
        const next = prev + 1;
        const currentBall = currentInningsData.balls[prev];

        if (currentBall) {
          if (currentBall.runs === 4) sound.playBoundaryFour();
          else if (currentBall.runs === 6) sound.playMaximumSix();
          else if (currentBall.isWicket) sound.playWicket();
        }

        if (next >= currentInningsData.balls.length) {
          if (liveInnings === 1) {
            setLiveInnings(2);
            return 0;
          } else {
            setIsSimulatingLive(false);
            // Save completed state
            const updatedMatches = room.matches.map((m) =>
              m.id === activeMatch.id ? { ...activeMatch, status: 'COMPLETED' as const } : m
            );
            const updatedRoom = { ...room, matches: updatedMatches };
            onUpdateRoom(updatedRoom);
            saveRoom(updatedRoom);
            return prev;
          }
        }
        return next;
      });
    }, intervalTime);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isSimulatingLive, liveInnings, simulationSpeed, activeMatch]);

  const currentInningsData = liveInnings === 1 ? activeMatch?.team1Innings : activeMatch?.team2Innings;
  const currentBall: BallData | undefined = currentInningsData?.balls[liveBallIndex];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white font-display uppercase tracking-wide flex items-center gap-2">
            <Radio className="w-5 h-5 text-amber-400" /> Match Center & Simulation
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Format: <span className="text-amber-400 font-semibold">{room.tournamentFormat.replace('_', ' ')}</span> · Pitch: <span className="text-emerald-400 font-semibold">{room.pitchCondition.replace('_', ' ')}</span>
          </p>
        </div>

        <button
          onClick={onNavigateToStandings}
          className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
        >
          View Points Table →
        </button>
      </div>

      {/* Main Grid: Match Arena & Fixture Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / CENTER: THE CRICKET MATCH ARENA (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {activeMatch && team1 && team2 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-md overflow-hidden">
              
              {/* Stadium Banner & Match Info */}
              <div
                className="h-32 sm:h-36 w-full bg-cover bg-center relative p-4 flex flex-col justify-between"
                style={{
                  backgroundImage: `url('/src/assets/images/cricket_pitch_aerial_1794069365741.jpg')`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
                
                <div className="relative z-10 flex items-center justify-between text-xs">
                  <span className="font-mono font-bold uppercase tracking-wider text-amber-400 bg-slate-950/80 px-2.5 py-1 rounded border border-amber-400/20 backdrop-blur-sm">
                    {activeMatch.roundName}
                  </span>
                  <span className="text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-700/60 font-mono">
                    Pitch: {activeMatch.pitchCondition.replace('_', ' ')}
                  </span>
                </div>

                {/* Team Logos & Clash Banner */}
                <div className="relative z-10 flex items-center justify-around">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md"
                      style={{ backgroundColor: team1.primaryColor }}
                    >
                      {team1.shortName}
                    </div>
                    <span className="font-bold text-base text-white font-display uppercase">{team1.name}</span>
                  </div>

                  <span className="font-mono font-black text-amber-400 text-lg">VS</span>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white font-display uppercase">{team2.name}</span>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md"
                      style={{ backgroundColor: team2.primaryColor }}
                    >
                      {team2.shortName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Match Score Display */}
              <div className="p-6">
                {activeMatch.status === 'COMPLETED' && activeMatch.team1Innings && activeMatch.team2Innings ? (
                  <div className="mb-6 space-y-4">
                    {/* Final Result Strip */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                        <Trophy className="w-5 h-5 text-amber-400" />
                        <span>
                          {room.teams.find((t) => t.id === activeMatch.winnerId)?.name} {activeMatch.margin}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveScorecardModalMatch(activeMatch)}
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white font-semibold flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> Full Scorecard
                      </button>
                    </div>

                    {/* Both Innings summary cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-200">{activeMatch.team1Innings.teamName}</span>
                          <span className="font-mono font-black text-base text-amber-400">
                            {activeMatch.team1Innings.totalRuns}/{activeMatch.team1Innings.totalWickets}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {activeMatch.team1Innings.oversCompleted} Overs
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-200">{activeMatch.team2Innings.teamName}</span>
                          <span className="font-mono font-black text-base text-amber-400">
                            {activeMatch.team2Innings.totalRuns}/{activeMatch.team2Innings.totalWickets}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {activeMatch.team2Innings.oversCompleted} Overs
                        </span>
                      </div>
                    </div>

                    {/* Player of the Match banner */}
                    {activeMatch.playerOfTheMatchName && (
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3 text-xs">
                        <Award className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <span className="text-slate-500 font-mono block text-[10px] uppercase">Player of the Match</span>
                          <span className="font-bold text-white text-sm">{activeMatch.playerOfTheMatchName}</span>
                          <span className="text-slate-400 ml-2">({activeMatch.playerOfTheMatchPerformance})</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* LIVE OR PRE-MATCH DISPLAY */
                  <div className="mb-6 space-y-4">
                    {isSimulatingLive && currentBall ? (
                      <div>
                        {/* Live Scorecard Center */}
                        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center mb-4">
                          <span className="text-xs uppercase font-mono tracking-widest text-slate-400 block mb-1">
                            Innings {liveInnings} · {currentInningsData?.teamName}
                          </span>
                          <div className="text-4xl font-mono font-black text-amber-400">
                            {currentBall.totalScore} / {currentBall.totalWickets}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-1">
                            Over {currentBall.overNumber}.{currentBall.ballInOver} of 20
                          </div>
                        </div>

                        {/* Striker & Bowler info */}
                        <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-slate-500 font-mono block text-[10px]">On Strike</span>
                            <span className="font-bold text-slate-200 text-sm">{currentBall.batsmanName}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-slate-500 font-mono block text-[10px]">Bowler</span>
                            <span className="font-bold text-slate-200 text-sm">{currentBall.bowlerName}</span>
                          </div>
                        </div>

                        {/* Ball commentary callout */}
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-medium leading-relaxed">
                          <span className="font-bold text-amber-400 mr-1.5 font-mono">
                            Ball {currentBall.ballNumber}:
                          </span>
                          {currentBall.commentary}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Clock className="w-10 h-10 text-amber-400 mx-auto mb-2 opacity-80" />
                        <h3 className="text-lg font-bold text-white font-display uppercase">Fixture Scheduled</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                          Ready for action! Choose ball-by-ball broadcast simulation or instant result calculation.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Simulation controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStartLiveSimulation}
                      className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isSimulatingLive ? 'Restart Broadcast' : 'Simulate Live Match'}
                    </button>

                    <button
                      onClick={() => handleInstantSimulate(activeMatch)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5"
                    >
                      <FastForward className="w-3.5 h-3.5" /> Instant Result
                    </button>
                  </div>

                  {/* Playback speed toggle */}
                  {isSimulatingLive && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-slate-400 mr-1 font-mono">Speed:</span>
                      {[1, 2, 5].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => setSimulationSpeed(spd as 1 | 2 | 5)}
                          className={`px-2 py-1 rounded font-mono font-bold ${
                            simulationSpeed === spd
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400 text-sm">
              Select a fixture from the right column to inspect and simulate.
            </div>
          )}
        </div>

        {/* RIGHT: TOURNAMENT FIXTURES LIST (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md shadow-xl">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Tournament Fixtures</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {room.matches.filter((m) => m.status === 'COMPLETED').length} / {room.matches.length} Done
              </span>
            </h3>

            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {room.matches.map((match) => {
                const t1 = room.teams.find((t) => t.id === match.team1Id);
                const t2 = room.teams.find((t) => t.id === match.team2Id);
                const isSelected = match.id === selectedMatchId;
                const isCompleted = match.status === 'COMPLETED';

                return (
                  <div
                    key={match.id}
                    onClick={() => setSelectedMatchId(match.id)}
                    className={`cursor-pointer rounded-xl p-3 border transition-all text-xs ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400/10 shadow-md'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-400 text-[10px] uppercase font-mono">
                        {match.roundName}
                      </span>
                      {isCompleted ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          SCHEDULED
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between font-bold text-slate-200 mb-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t1?.primaryColor }} />
                        <span className="truncate">{t1?.shortName || 'T1'}</span>
                      </div>
                      {isCompleted && match.team1Innings && (
                        <span className="font-mono text-amber-400">
                          {match.team1Innings.totalRuns}/{match.team1Innings.totalWickets}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between font-bold text-slate-200">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t2?.primaryColor }} />
                        <span className="truncate">{t2?.shortName || 'T2'}</span>
                      </div>
                      {isCompleted && match.team2Innings && (
                        <span className="font-mono text-amber-400">
                          {match.team2Innings.totalRuns}/{match.team2Innings.totalWickets}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Full Scorecard Modal */}
      {activeScorecardModalMatch && activeScorecardModalMatch.team1Innings && activeScorecardModalMatch.team2Innings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl relative">
            <button
              onClick={() => setActiveScorecardModalMatch(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white font-bold text-lg"
            >
              ×
            </button>

            <h3 className="text-xl font-bold text-white font-display uppercase mb-1">
              Official Match Scorecard
            </h3>
            <p className="text-xs text-amber-400 font-semibold mb-4">
              {room.teams.find((t) => t.id === activeScorecardModalMatch.winnerId)?.name} {activeScorecardModalMatch.margin}
            </p>

            {/* Innings 1 Scorecard */}
            <div className="mb-6">
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-2">
                <span className="font-bold text-sm text-white">{activeScorecardModalMatch.team1Innings.teamName}</span>
                <span className="font-mono font-bold text-amber-400">
                  {activeScorecardModalMatch.team1Innings.totalRuns}/{activeScorecardModalMatch.team1Innings.totalWickets} ({activeScorecardModalMatch.team1Innings.oversCompleted} Ov)
                </span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-mono">
                      <th className="py-1">Batter</th>
                      <th className="py-1">Runs</th>
                      <th className="py-1">Balls</th>
                      <th className="py-1">4s</th>
                      <th className="py-1">6s</th>
                      <th className="py-1 text-right">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScorecardModalMatch.team1Innings.battingScorecard.map((b, idx) => (
                      <tr key={idx} className="border-b border-slate-800/40 text-slate-300">
                        <td className="py-1 font-semibold text-white">{b.playerName}</td>
                        <td className="py-1 font-mono font-bold text-amber-400">{b.runs}</td>
                        <td className="py-1 font-mono">{b.balls}</td>
                        <td className="py-1 font-mono">{b.fours}</td>
                        <td className="py-1 font-mono">{b.sixes}</td>
                        <td className="py-1 font-mono text-right">{b.strikeRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Innings 2 Scorecard */}
            <div className="mb-6">
              <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-800 mb-2">
                <span className="font-bold text-sm text-white">{activeScorecardModalMatch.team2Innings.teamName}</span>
                <span className="font-mono font-bold text-amber-400">
                  {activeScorecardModalMatch.team2Innings.totalRuns}/{activeScorecardModalMatch.team2Innings.totalWickets} ({activeScorecardModalMatch.team2Innings.oversCompleted} Ov)
                </span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-mono">
                      <th className="py-1">Batter</th>
                      <th className="py-1">Runs</th>
                      <th className="py-1">Balls</th>
                      <th className="py-1">4s</th>
                      <th className="py-1">6s</th>
                      <th className="py-1 text-right">SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeScorecardModalMatch.team2Innings.battingScorecard.map((b, idx) => (
                      <tr key={idx} className="border-b border-slate-800/40 text-slate-300">
                        <td className="py-1 font-semibold text-white">{b.playerName}</td>
                        <td className="py-1 font-mono font-bold text-amber-400">{b.runs}</td>
                        <td className="py-1 font-mono">{b.balls}</td>
                        <td className="py-1 font-mono">{b.fours}</td>
                        <td className="py-1 font-mono">{b.sixes}</td>
                        <td className="py-1 font-mono text-right">{b.strikeRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => setActiveScorecardModalMatch(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Close Scorecard
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
