/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { RoomState, Team, Player } from '../types/cricket';
import { formatCurrency } from '../data/iplFranchises';
import {
  getNextBidIncrement,
  canTeamBid,
  evaluateBotBid,
  placeBidOnCurrentPlayer,
  closeBiddingForCurrentPlayer,
  advanceToNextPlayerLot,
  finalizeCurrentPlayer
} from '../services/auctionEngine';
import { sound } from '../services/soundFx';
import { saveRoom } from '../services/storage';
import {
  Gavel,
  Radio,
  Clock,
  Shield,
  Zap,
  TrendingUp,
  AlertTriangle,
  Play,
  Pause,
  ChevronRight,
  Flame,
  CheckCircle2,
  XCircle,
  Sparkles,
  Award,
  ArrowRight,
  Check
} from 'lucide-react';

interface AuctionArenaProps {
  room: RoomState;
  onUpdateRoom: (updated: RoomState) => void;
  onNavigateToSquads: () => void;
}

interface LotOutcome {
  type: 'SOLD' | 'UNSOLD';
  winnerTeam?: Team;
  player: Player;
  amount: number;
  secondsUntilNext: number;
}

export const AuctionArena: React.FC<AuctionArenaProps> = ({
  room,
  onUpdateRoom,
  onNavigateToSquads
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [autoBidCeiling, setAutoBidCeiling] = useState<number | null>(null);
  const [isAutoBidding, setIsAutoBidding] = useState(false);
  const [lotOutcome, setLotOutcome] = useState<LotOutcome | null>(null);

  const roomRef = useRef<RoomState>(room);
  roomRef.current = room;

  const currentPlayer = room.playersPool[room.currentPlayerIndex] as Player | undefined;
  const userTeam = room.teams.find((t) => t.isUserTeam) || room.teams[0];
  const leadingTeam = room.teams.find((t) => t.id === room.currentBidderTeamId);

  const nextBidAmount =
    room.currentBid === 0
      ? currentPlayer?.basePrice || 20000000
      : room.currentBid + getNextBidIncrement(room.currentBid);

  const canUserBidStatus = currentPlayer
    ? canTeamBid(userTeam, nextBidAmount, currentPlayer)
    : { canBid: false, reason: 'No active player' };

  const botTimeoutRef = useRef<number | null>(null);

  // Trigger celebration confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6']
      });
    } catch {
      // safe fallback
    }
  };

  // Main real-time countdown timer: counts down every second and closes bidding at zero
  useEffect(() => {
    if (isPaused || !currentPlayer || room.status !== 'AUCTION' || lotOutcome !== null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const currentRoom = roomRef.current;
      if (currentRoom.status !== 'AUCTION' || isPaused) return;

      if (currentRoom.timerRemaining > 1) {
        const nextTime = currentRoom.timerRemaining - 1;

        // Audio warnings as timer ticks down
        if (nextTime === 6) {
          sound.playGoingWarning(1); // Going once warning
        } else if (nextTime === 3) {
          sound.playGoingWarning(2); // Going twice warning
        } else if (nextTime <= 3) {
          sound.playTick(true); // Urgent pulse tick
        } else {
          sound.playTick(false);
        }

        const updatedRoom: RoomState = {
          ...currentRoom,
          timerRemaining: nextTime,
          hammerStage: (nextTime <= 3 ? 2 : nextTime <= 6 ? 1 : 0) as 0 | 1 | 2
        };

        onUpdateRoom(updatedRoom);
        saveRoom(updatedRoom);
      } else {
        // TIMER REACHED ZERO: Automatically close bidding for current player!
        sound.playHammerKnock();

        const res = closeBiddingForCurrentPlayer(currentRoom);

        if (res.sold) {
          sound.playSoldGong();
          if (res.winnerTeam?.isUserTeam) {
            triggerConfetti();
          }
        }

        onUpdateRoom(res.updatedRoom);
        saveRoom(res.updatedRoom);

        // Set outcome state with a 3-second auto-transition to next lot
        setLotOutcome({
          type: res.sold ? 'SOLD' : 'UNSOLD',
          winnerTeam: res.winnerTeam,
          player: res.player,
          amount: res.soldPrice || res.player.basePrice,
          secondsUntilNext: 3
        });
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPaused, currentPlayer?.id, room.status, lotOutcome]);

  // Automated transition timer after lot closes: counts down 3..2..1 and triggers next bidding round
  useEffect(() => {
    if (!lotOutcome) return;

    const transitionInterval = window.setInterval(() => {
      setLotOutcome((prev) => {
        if (!prev) return null;
        if (prev.secondsUntilNext <= 1) {
          // Time to trigger the next bidding round automatically!
          const nextRoom = advanceToNextPlayerLot(roomRef.current);
          onUpdateRoom(nextRoom);
          saveRoom(nextRoom);
          return null; // Closes outcome overlay and resumes timer on next player
        }
        return {
          ...prev,
          secondsUntilNext: prev.secondsUntilNext - 1
        };
      });
    }, 1000);

    return () => clearInterval(transitionInterval);
  }, [lotOutcome]);

  // Skip delay and advance to next player lot immediately
  const handleAdvanceNextLotImmediately = () => {
    setLotOutcome(null);
    const nextRoom = advanceToNextPlayerLot(roomRef.current);
    onUpdateRoom(nextRoom);
    saveRoom(nextRoom);
  };

  // AI Bot Bidding Behavior
  useEffect(() => {
    if (isPaused || !currentPlayer || room.status !== 'AUCTION' || lotOutcome !== null) return;
    if (room.timerRemaining < 2) return; // Don't interrupt final second before hammer

    // Random delay between 1.2s to 2.8s
    const delay = 1200 + Math.random() * 1600;

    botTimeoutRef.current = window.setTimeout(() => {
      const currentRoom = roomRef.current;
      if (currentRoom.timerRemaining < 2 || lotOutcome !== null) return;

      // Find eligible bot teams interested in player
      const botTeams = currentRoom.teams.filter((t) => t.isBot && t.id !== currentRoom.currentBidderTeamId);
      const shuffled = [...botTeams].sort(() => Math.random() - 0.5);

      for (const bot of shuffled) {
        const wantsToBid = evaluateBotBid(bot, currentPlayer, currentRoom.currentBid, currentRoom.currentBidderTeamId);
        if (wantsToBid) {
          sound.playBidPop();
          const { updatedRoom, success } = placeBidOnCurrentPlayer(currentRoom, bot.id);
          if (success) {
            onUpdateRoom(updatedRoom);
            saveRoom(updatedRoom);
          }
          break;
        }
      }
    }, delay);

    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
  }, [room.currentBid, room.currentBidderTeamId, currentPlayer?.id, isPaused, room.status, lotOutcome]);

  // User Auto-Bidding check
  useEffect(() => {
    if (!isAutoBidding || !autoBidCeiling || !currentPlayer || room.status !== 'AUCTION' || lotOutcome !== null) {
      return;
    }

    if (room.currentBidderTeamId !== userTeam.id && nextBidAmount <= autoBidCeiling) {
      const check = canTeamBid(userTeam, nextBidAmount, currentPlayer);
      if (check.canBid) {
        const timeout = setTimeout(() => {
          handleUserBid();
        }, 800);
        return () => clearTimeout(timeout);
      }
    }
  }, [room.currentBid, room.currentBidderTeamId, isAutoBidding, autoBidCeiling, lotOutcome]);

  // Place manual user bid
  const handleUserBid = () => {
    if (!currentPlayer || lotOutcome !== null) return;
    sound.playBidPop();
    const { updatedRoom, success, message } = placeBidOnCurrentPlayer(room, userTeam.id);
    if (success) {
      onUpdateRoom(updatedRoom);
      saveRoom(updatedRoom);
    } else {
      console.warn('Bid error:', message);
    }
  };

  // Host manual pass / skip lot
  const handleSkipPlayer = () => {
    sound.playHammerKnock();
    const res = finalizeCurrentPlayer(room);
    onUpdateRoom(res.updatedRoom);
    saveRoom(res.updatedRoom);
    setLotOutcome(null);
  };

  // Timer visual progress math
  const maxTimerDuration = 12;
  const timerPercent = Math.min(100, Math.max(0, (room.timerRemaining / maxTimerDuration) * 100));

  // Dynamic status notice and styling
  let hammerNotice = 'Bidding is Active · Paddle Open';
  let hammerColor = 'text-amber-400 border-amber-400/20 bg-amber-400/10';
  let dialColor = '#F59E0B'; // Amber

  if (room.timerRemaining <= 6 && room.timerRemaining > 3) {
    hammerNotice = `Going Once at ${formatCurrency(room.currentBid || currentPlayer?.basePrice || 0)}!`;
    hammerColor = 'text-orange-400 border-orange-400/30 bg-orange-500/15';
    dialColor = '#F97316';
  } else if (room.timerRemaining <= 3 && room.timerRemaining > 0) {
    hammerNotice = `Going Twice... Fair Warning!`;
    hammerColor = 'text-rose-400 border-rose-400/40 bg-rose-500/20 animate-pulse';
    dialColor = '#EF4444';
  } else if (room.timerRemaining === 0 || lotOutcome) {
    hammerNotice = lotOutcome?.type === 'SOLD' ? 'HAMMER DOWN · SOLD!' : 'HAMMER DOWN · UNSOLD!';
    hammerColor = lotOutcome?.type === 'SOLD' ? 'text-emerald-400 border-emerald-400/40 bg-emerald-500/20' : 'text-rose-400 border-rose-400/40 bg-rose-500/20';
    dialColor = lotOutcome?.type === 'SOLD' ? '#10B981' : '#EF4444';
  }

  // Overseas player count for user team
  const userOverseasCount = userTeam.players.filter((p) => p.isOverseas).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Broadcast Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-400 animate-pulse">
            <Radio className="w-3.5 h-3.5" /> LIVE AUCTION LOT #{room.currentPlayerIndex + 1} OF {room.playersPool.length}
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Set: <span className="text-slate-200 font-semibold">{currentPlayer?.setName}</span>
          </span>
        </div>

        {/* Host Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume Timer' : 'Pause Timer'}
          </button>

          <button
            onClick={handleSkipPlayer}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:text-rose-300 transition-colors"
          >
            Pass Lot <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onNavigateToSquads}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" /> Squad Hub
          </button>
        </div>
      </div>

      {/* Main Grid: Player Card & Live Bidding Podium + Ticker & Purse Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / CENTER: CURRENT PLAYER LOT & BIDDING PODIUM (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {currentPlayer && room.status === 'AUCTION' ? (
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl backdrop-blur-md">
              
              {/* Background gradient banner */}
              <div
                className="h-28 w-full bg-cover bg-center relative"
                style={{
                  backgroundImage: `url('/src/assets/images/ipl_auction_arena_1794069365429.jpg')`
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wider font-mono uppercase bg-slate-950/80 text-amber-400 px-2.5 py-1 rounded border border-amber-400/20 backdrop-blur-sm">
                    {currentPlayer.role.replace('_', ' ')}
                  </span>
                  {currentPlayer.isOverseas ? (
                    <span className="text-[11px] font-bold tracking-wider font-mono uppercase bg-sky-950/80 text-sky-400 px-2 py-1 rounded border border-sky-400/20 backdrop-blur-sm">
                      OVERSEAS ({currentPlayer.country})
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold tracking-wider font-mono uppercase bg-emerald-950/80 text-emerald-400 px-2 py-1 rounded border border-emerald-400/20 backdrop-blur-sm">
                      INDIAN ICON
                    </span>
                  )}
                </div>

                <div className="absolute top-3 right-3 text-right">
                  <div className="text-[10px] text-slate-300 uppercase tracking-widest font-mono">Base Price</div>
                  <div className="text-sm font-black font-mono text-amber-400">
                    {formatCurrency(currentPlayer.basePrice)}
                  </div>
                </div>
              </div>

              {/* Player Details & Rating Stats */}
              <div className="p-6 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-lg border border-white/10 shrink-0 font-display"
                      style={{ backgroundColor: currentPlayer.avatarBgColor || '#3b82f6' }}
                    >
                      {currentPlayer.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display uppercase tracking-wide leading-none">
                        {currentPlayer.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span>{currentPlayer.battingStyle}</span>
                        <span>·</span>
                        <span>{currentPlayer.bowlingStyle}</span>
                      </div>
                    </div>
                  </div>

                  {/* Overall Rating Badge */}
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Player Rating</span>
                    <span className="text-2xl font-black font-mono text-amber-400">
                      {currentPlayer.rating}
                      <span className="text-xs text-slate-500 font-normal"> / 100</span>
                    </span>
                  </div>
                </div>

                {/* Special Skill Callout */}
                <div className="mb-5 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold">{currentPlayer.specialSkill}</span>
                </div>

                {/* Career IPL Stats Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center mb-6">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Matches</span>
                    <span className="text-base font-bold text-slate-200 font-mono">
                      {currentPlayer.stats.matches}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Runs (Avg)</span>
                    <span className="text-base font-bold text-slate-200 font-mono">
                      {currentPlayer.stats.runs} <span className="text-xs text-slate-400">({currentPlayer.stats.average})</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Strike Rate</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">
                      {currentPlayer.stats.strikeRate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Wickets (Eco)</span>
                    <span className="text-base font-bold text-sky-400 font-mono">
                      {currentPlayer.stats.wickets} <span className="text-xs text-slate-400">({currentPlayer.stats.economy || '-'})</span>
                    </span>
                  </div>
                </div>

                {/* THE AUCTION PODIUM & REAL-TIME HAMMER COUNTDOWN DISPLAY */}
                <div className="rounded-2xl border-2 border-slate-700 bg-gradient-to-b from-slate-950 to-slate-900 p-5 text-center relative shadow-inner overflow-hidden">
                  
                  {/* Status Banner */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-4 ${hammerColor}`}>
                    <Clock className="w-3.5 h-3.5" /> {hammerNotice}
                  </div>

                  {/* Real-Time Countdown Timer Dial & Progress Ring */}
                  <div className="flex flex-col items-center justify-center mb-4">
                    <div className="relative flex items-center justify-center w-28 h-28">
                      {/* SVG Radial Countdown Progress Ring */}
                      <svg className="w-28 h-28 transform -rotate-90">
                        <circle
                          cx="56"
                          cy="56"
                          r="48"
                          stroke="rgba(51, 65, 85, 0.4)"
                          strokeWidth="8"
                          fill="transparent"
                        />
                        <circle
                          cx="56"
                          cy="56"
                          r="48"
                          stroke={dialColor}
                          strokeWidth="8"
                          strokeDasharray={301.6}
                          strokeDashoffset={301.6 - (301.6 * timerPercent) / 100}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-300 ease-linear"
                        />
                      </svg>

                      {/* Number Display Center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          className={`text-4xl font-mono font-black tracking-tight ${
                            room.timerRemaining <= 3 && room.timerRemaining > 0
                              ? 'text-rose-500 scale-110 animate-ping'
                              : room.timerRemaining === 0
                              ? 'text-emerald-400'
                              : 'text-white'
                          }`}
                        >
                          {room.timerRemaining}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-sans tracking-wider">
                          seconds
                        </span>
                      </div>
                    </div>

                    {/* Horizontal Smooth Progress Bar */}
                    <div className="w-full max-w-xs mt-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-300 ease-linear rounded-full"
                        style={{
                          width: `${timerPercent}%`,
                          backgroundColor: dialColor
                        }}
                      />
                    </div>
                  </div>

                  {/* LOT OUTCOME OVERLAY / ANNOUNCEMENT BANNER */}
                  {lotOutcome ? (
                    <div className="mb-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md animate-in fade-in zoom-in duration-200">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Gavel className="w-5 h-5 text-amber-400" />
                        <span className="font-extrabold text-base uppercase tracking-wider text-white font-display">
                          {lotOutcome.type === 'SOLD' ? '🔨 LOT CLOSED — SOLD!' : '❌ LOT CLOSED — UNSOLD!'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 mb-3">
                        {lotOutcome.type === 'SOLD' ? (
                          <>
                            <strong className="text-amber-400 font-bold">{lotOutcome.player.name}</strong> sold to{' '}
                            <span className="font-bold text-emerald-400">{lotOutcome.winnerTeam?.name}</span> for{' '}
                            <span className="font-mono font-black text-amber-300">{formatCurrency(lotOutcome.amount)}</span>!
                          </>
                        ) : (
                          <>No bids received for <strong className="text-amber-400">{lotOutcome.player.name}</strong>.</>
                        )}
                      </p>

                      <div className="flex items-center justify-center gap-3">
                        <div className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          Next lot starting in <span className="font-mono text-amber-400 font-bold text-sm">{lotOutcome.secondsUntilNext}s</span>
                        </div>

                        <button
                          onClick={handleAdvanceNextLotImmediately}
                          className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-1 shadow-sm"
                        >
                          Start Next Lot <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Current Bid Display */
                    <div className="mb-4">
                      <span className="text-xs uppercase tracking-widest text-slate-400 font-mono">Current Bid</span>
                      <div className="text-3xl sm:text-4xl font-extrabold text-amber-400 font-mono mt-0.5">
                        {room.currentBid === 0 ? 'NO BIDS YET' : formatCurrency(room.currentBid)}
                      </div>

                      {leadingTeam && (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-1 border border-slate-700">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: leadingTeam.primaryColor }}
                          />
                          <span className="text-xs text-slate-300">Leading Bidder:</span>
                          <span className="text-xs font-bold text-white uppercase">{leadingTeam.name}</span>
                          {leadingTeam.id === userTeam.id && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* USER PADDLE BIDDING CONTROLS */}
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        onClick={handleUserBid}
                        disabled={!canUserBidStatus.canBid || isPaused || lotOutcome !== null}
                        className={`py-3.5 px-8 rounded-xl font-black text-sm uppercase tracking-wider shadow-lg transition-all flex items-center gap-2.5 ${
                          canUserBidStatus.canBid && !isPaused && lotOutcome === null
                            ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 shadow-amber-500/30 scale-100 hover:scale-102 active:scale-98'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                        }`}
                      >
                        <Gavel className="w-5 h-5" />
                        Raise Paddle ({formatCurrency(nextBidAmount)})
                      </button>
                    </div>

                    {!canUserBidStatus.canBid && !lotOutcome && (
                      <p className="text-xs text-rose-400 mt-2 flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {canUserBidStatus.reason}
                      </p>
                    )}

                    {/* Auto-Bid Feature */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 pt-3 border-t border-slate-800/60 text-xs">
                      <span className="text-slate-400">Smart Auto-Bid:</span>
                      <select
                        value={autoBidCeiling || ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setAutoBidCeiling(val);
                          setIsAutoBidding(val !== null);
                        }}
                        className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
                      >
                        <option value="">Off (Manual)</option>
                        <option value="50000000">Up to ₹5 Cr</option>
                        <option value="100000000">Up to ₹10 Cr</option>
                        <option value="150000000">Up to ₹15 Cr</option>
                        <option value="200000000">Up to ₹20 Cr</option>
                      </select>
                      {isAutoBidding && (
                        <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Auto-Bid Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 text-center backdrop-blur-md">
              <Award className="w-12 h-12 text-amber-400 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-white font-display uppercase">Auction Completed!</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                All lots have been hammered down. Head over to the Squad Hub to finalize your Starting XI and kick off tournament matches.
              </p>
              <button
                onClick={onNavigateToSquads}
                className="mt-6 px-6 py-3 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm uppercase tracking-wider hover:bg-amber-300 transition-colors shadow-lg shadow-amber-400/20"
              >
                Go to Squad Hub & Playing XI
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: LIVE COMMENTARY FEED & FRANCHISE PURSE BOARDS (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* User Franchise Status Card */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                  style={{ backgroundColor: userTeam.primaryColor }}
                >
                  {userTeam.shortName}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white leading-none">{userTeam.name}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">YOUR FRANCHISE</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-mono uppercase block">Remaining Purse</span>
                <span className="text-base font-extrabold font-mono text-emerald-400">
                  {formatCurrency(userTeam.budget)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block font-mono">Squad Count</span>
                <span className="font-bold text-slate-200">
                  {userTeam.players.length} / 25
                </span>
              </div>
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800/80">
                <span className="text-[10px] text-slate-400 block font-mono">Overseas Limit</span>
                <span className={`font-bold ${userOverseasCount >= 8 ? 'text-rose-400' : 'text-sky-400'}`}>
                  {userOverseasCount} / 8
                </span>
              </div>
            </div>
          </div>

          {/* Franchise Purse Leaderboard */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md shadow-xl">
            <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Franchise Purse Board</span>
              <span className="text-[10px] text-slate-500 font-normal">Purse / Squad / Overseas</span>
            </h3>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {room.teams.map((team) => {
                const overseas = team.players.filter((p) => p.isOverseas).length;
                const isLeading = room.currentBidderTeamId === team.id;
                return (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                      isLeading
                        ? 'bg-amber-400/15 border border-amber-400/30'
                        : 'bg-slate-950/70 border border-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: team.primaryColor }}
                      />
                      <span className="font-semibold text-slate-200 truncate">
                        {team.shortName}
                        {team.isUserTeam && <span className="ml-1 text-[10px] text-amber-400">(You)</span>}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono">
                      <span className="text-slate-400 text-[11px]">
                        {team.players.length}/25 ({overseas} OS)
                      </span>
                      <span className="font-bold text-emerald-400">
                        {formatCurrency(team.budget)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Auction Commentary Ticker Feed */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 backdrop-blur-md shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" /> Auction Ticker Feed
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Live updates</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 text-xs">
              {room.auctionLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No auction logs yet</p>
              ) : (
                room.auctionLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-xl border text-xs leading-relaxed transition-all ${
                      log.type === 'SOLD'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : log.type === 'UNSOLD'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : log.type === 'BID'
                        ? 'bg-slate-950/80 border-slate-800 text-slate-300'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mb-1">
                      <span>{log.playerName}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <div>{log.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
