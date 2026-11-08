/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserAccount, RoomState, Team, TournamentFormat, PitchCondition } from '../types/cricket';
import { OFFICIAL_FRANCHISES, formatCurrency } from '../data/iplFranchises';
import { INITIAL_PLAYERS } from '../data/mockPlayers';
import { generateRoomCode, saveRoom, getRoomByCode } from '../services/storage';
import { generateTournamentFixtures } from '../services/matchSimulation';
import { Users, Plus, LogIn, Sparkles, Copy, Check, Play, Shield, Globe, Award, Swords } from 'lucide-react';

interface LobbyViewProps {
  currentUser: UserAccount | null;
  activeRoom: RoomState | null;
  onEnterRoom: (room: RoomState) => void;
  onOpenAuth: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  currentUser,
  activeRoom,
  onEnterRoom,
  onOpenAuth
}) => {
  const [tab, setTab] = useState<'CREATE' | 'JOIN'>('CREATE');

  // Room config
  const [roomName, setRoomName] = useState('IPL Mega Auction 2026');
  const [gameMode, setGameMode] = useState<'SOLO_AUCTION_MULTI_MATCH' | 'FULL_MULTIPLAYER'>('SOLO_AUCTION_MULTI_MATCH');
  const [tournamentFormat, setTournamentFormat] = useState<TournamentFormat>('QUICK_LEAGUE');
  const [pitchCondition, setPitchCondition] = useState<PitchCondition>('BALANCED');

  // Franchise customization
  const [franchiseType, setFranchiseType] = useState<'PRESET' | 'CUSTOM'>('PRESET');
  const [selectedPresetFranchiseId, setSelectedPresetFranchiseId] = useState('team-rcb');
  const [customTeamName, setCustomTeamName] = useState('Apex Titans');
  const [customShortCode, setCustomShortCode] = useState('AT');
  const [customPrimaryColor, setCustomPrimaryColor] = useState('#EC1C24');
  const [customSecondaryColor, setCustomSecondaryColor] = useState('#F59E0B');

  // Join Room
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const roomCode = generateRoomCode();
    const userId = currentUser ? currentUser.id : `guest-${Date.now()}`;

    // Build user's team
    let userTeam: Team;
    if (franchiseType === 'PRESET') {
      const preset = OFFICIAL_FRANCHISES.find((f) => f.id === selectedPresetFranchiseId)!;
      userTeam = {
        ...preset,
        isUserTeam: true,
        userId,
        isBot: false,
        players: []
      };
    } else {
      userTeam = {
        id: `custom-${Date.now()}`,
        name: customTeamName.trim() || 'My Custom Warriors',
        shortName: (customShortCode.trim() || 'MCW').slice(0, 4).toUpperCase(),
        primaryColor: customPrimaryColor,
        secondaryColor: customSecondaryColor,
        budget: 1000000000, // ₹100 Cr
        initialBudget: 1000000000,
        isUserTeam: true,
        userId,
        isBot: false,
        players: []
      };
    }

    // Populate bot franchises for remaining spots
    const otherFranchises = OFFICIAL_FRANCHISES.filter((f) => f.id !== selectedPresetFranchiseId);
    const botTeams: Team[] = otherFranchises.slice(0, 7).map((f) => ({
      ...f,
      isUserTeam: false,
      isBot: true,
      players: []
    }));

    const allTeams = [userTeam, ...botTeams];

    // Initialize players pool
    const playersPool = INITIAL_PLAYERS.map((p, idx) => ({
      ...p,
      status: (idx === 0 ? 'CURRENT' : 'UPCOMING') as 'CURRENT' | 'UPCOMING'
    }));

    const fixtures = generateTournamentFixtures(allTeams, tournamentFormat, pitchCondition);

    const newRoom: RoomState = {
      code: roomCode,
      name: roomName.trim() || 'IPL Auction Arena',
      hostUserId: userId,
      mode: gameMode,
      status: 'AUCTION',
      tournamentFormat,
      pitchCondition,
      teams: allTeams,
      playersPool,
      currentPlayerIndex: 0,
      currentBid: 0,
      currentBidderTeamId: null,
      hammerStage: 0,
      timerRemaining: 12,
      auctionLogs: [
        {
          id: `log-init-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ANNOUNCEMENT',
          playerId: playersPool[0].id,
          playerName: playersPool[0].name,
          amount: playersPool[0].basePrice,
          message: `🎙️ Welcome to the ${roomName}! Lot #1 is ${playersPool[0].name} (${playersPool[0].role}) at base price ${formatCurrency(playersPool[0].basePrice)}.`
        }
      ],
      matches: fixtures,
      currentMatchIndex: 0,
      lastUpdated: Date.now()
    };

    saveRoom(newRoom);
    onEnterRoom(newRoom);
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const code = joinCodeInput.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setErrorMsg('Please enter a valid 6-character room code.');
      return;
    }

    try {
      const room = await getRoomByCode(code);
      if (!room) {
        setErrorMsg(`Room "${code}" not found. Verify the code or create a new room.`);
        return;
      }
      onEnterRoom(room);
    } catch {
      setErrorMsg(`Could not connect to room "${code}". Please check your connection.`);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
        
        {/* Active room prompt if one exists */}
        {activeRoom && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-amber-400 animate-ping" />
              <div>
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Active Session in Progress</p>
                <p className="text-sm font-semibold text-white">
                  Room: <span className="font-mono text-amber-400">{activeRoom.code}</span> — {activeRoom.name}
                </p>
              </div>
            </div>
            <button
              onClick={() => onEnterRoom(activeRoom)}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-current" /> Re-enter Arena
            </button>
          </div>
        )}

        {/* Hero title banner */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400 mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Real-Time IPL Auction & Tournament Engine
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-display uppercase">
            Create or Join Auction Room
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
            Experience the pulse of the IPL Mega Auction. Bid with live paddle physics, build your championship squad, and simulate tournament matches.
          </p>
        </div>

        {/* Tab switch: Create vs Join */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 mb-8 max-w-md mx-auto">
          <button
            onClick={() => setTab('CREATE')}
            className={`py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              tab === 'CREATE'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-4 h-4" /> Host New Room
          </button>
          <button
            onClick={() => setTab('JOIN')}
            className={`py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              tab === 'JOIN'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-4 h-4" /> Enter 6-Digit Code
          </button>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-300 text-center">
            {errorMsg}
          </div>
        )}

        {/* TAB 1: CREATE ROOM */}
        {tab === 'CREATE' && (
          <form onSubmit={handleCreateRoom} className="space-y-6">
            
            {/* Mode selection: Solo vs Full Multiplayer */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                1. Select Game Mode
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  onClick={() => setGameMode('SOLO_AUCTION_MULTI_MATCH')}
                  className={`cursor-pointer rounded-xl p-4 border transition-all ${
                    gameMode === 'SOLO_AUCTION_MULTI_MATCH'
                      ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/5'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white font-display tracking-wide uppercase">
                      Solo Auction + Multi Match
                    </span>
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded border border-amber-400/20">
                      Popular
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Bid in real-time against smart AI franchise bots. Build your dream squad without waiting, then simulate high-stakes matches!
                  </p>
                </div>

                <div
                  onClick={() => setGameMode('FULL_MULTIPLAYER')}
                  className={`cursor-pointer rounded-xl p-4 border transition-all ${
                    gameMode === 'FULL_MULTIPLAYER'
                      ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/5'
                      : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-white font-display tracking-wide uppercase">
                      Full Multiplayer (Auction + Match)
                    </span>
                    <span className="text-[11px] font-mono text-sky-400 bg-sky-400/15 px-2 py-0.5 rounded border border-sky-400/20">
                      Live Sync
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Live room bidding synced across devices/tabs via room code. Friends take franchise tables and battle simultaneously!
                  </p>
                </div>
              </div>
            </div>

            {/* Franchise Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  2. Choose or Create Your Franchise
                </label>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFranchiseType('PRESET')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      franchiseType === 'PRESET'
                        ? 'bg-slate-800 text-amber-400 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Official IPL Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setFranchiseType('CUSTOM')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      franchiseType === 'CUSTOM'
                        ? 'bg-slate-800 text-amber-400 font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Custom Franchise
                  </button>
                </div>
              </div>

              {franchiseType === 'PRESET' ? (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {OFFICIAL_FRANCHISES.map((team) => (
                    <div
                      key={team.id}
                      onClick={() => setSelectedPresetFranchiseId(team.id)}
                      className={`cursor-pointer rounded-xl p-3 border text-center transition-all ${
                        selectedPresetFranchiseId === team.id
                          ? 'border-amber-400 bg-slate-800 shadow-md'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className="w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center font-black text-xs text-white shadow-inner"
                        style={{ backgroundColor: team.primaryColor }}
                      >
                        {team.shortName}
                      </div>
                      <div className="font-bold text-xs text-slate-200 truncate">{team.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">₹100 Cr Purse</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Franchise Name</label>
                    <input
                      type="text"
                      value={customTeamName}
                      onChange={(e) => setCustomTeamName(e.target.value)}
                      placeholder="e.g. Apex Titans"
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Code (2-4 letters)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={customShortCode}
                      onChange={(e) => setCustomShortCode(e.target.value)}
                      placeholder="AT"
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white uppercase focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customPrimaryColor}
                        onChange={(e) => setCustomPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-xs text-slate-300">{customPrimaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Secondary Accent</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customSecondaryColor}
                        onChange={(e) => setCustomSecondaryColor(e.target.value)}
                        className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-xs text-slate-300">{customSecondaryColor}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tournament Format & Pitch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  3. Tournament Format
                </label>
                <select
                  value={tournamentFormat}
                  onChange={(e) => setTournamentFormat(e.target.value as TournamentFormat)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="QUICK_LEAGUE">Quick League (4 Teams, 6 Matches + Final)</option>
                  <option value="FULL_SEASON">Full IPL Season (All franchises + Playoffs)</option>
                  <option value="MINI_TOURNAMENT">Mini-Tournament (4 Franchises)</option>
                  <option value="KNOCKOUT_CUP">Knockout Cup (Quarterfinals & Finals)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  4. Pitch Condition
                </label>
                <select
                  value={pitchCondition}
                  onChange={(e) => setPitchCondition(e.target.value as PitchCondition)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="BALANCED">Balanced Pitch (170-190 Par Score, Equal Contest)</option>
                  <option value="BATTING_PARADISE">Batting Paradise (210+ Sixes Fest, High Scoring)</option>
                  <option value="GREEN_SEAMER">Green Seamer (Powerplay Swing, Fast Bowlers Dominate)</option>
                  <option value="SPIN_WEB">Spin Web (Chepauk/Lucknow Turn, Mystery Spinners)</option>
                </select>
              </div>
            </div>

            {/* Action CTA Button */}
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Swords className="w-5 h-5" /> Launch IPL Auction Room
            </button>
          </form>
        )}

        {/* TAB 2: JOIN WITH ROOM CODE */}
        {tab === 'JOIN' && (
          <form onSubmit={handleJoinRoom} className="space-y-6 max-w-md mx-auto py-4">
            <div className="text-center">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Enter 6-Digit Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. IPL884"
                className="w-full tracking-widest text-center text-3xl font-mono font-black uppercase py-4 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                required
              />
              <p className="text-xs text-slate-400 mt-2">
                Ask your friend or room host for their 6-character room code.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm uppercase tracking-wider shadow-md shadow-amber-400/20 transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Connect to Room
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
