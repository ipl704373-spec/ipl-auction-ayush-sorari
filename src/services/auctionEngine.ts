/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, Team, RoomState, AuctionLogEntry } from '../types/cricket';
import { formatCurrency } from '../data/iplFranchises';
import { INITIAL_PLAYERS } from '../data/mockPlayers';

// IPL Minimum and Maximum Squad Parameters
export const MIN_PLAYERS_PER_TEAM = 15;
export const MAX_PLAYERS_PER_TEAM = 25;

export const allTeamsHaveMinimumSquad = (teams: Team[]): boolean => {
  return teams.length > 0 && teams.every((team) => team.players.length >= MIN_PLAYERS_PER_TEAM);
};

export const getIncompleteTeams = (teams: Team[]): Team[] => {
  return teams.filter((team) => team.players.length < MIN_PLAYERS_PER_TEAM);
};

// Emergency squad depth player generator if pool ever runs out before all teams hit 15
export const generateEmergencySquadFillers = (startIndex: number, count: number): Player[] => {
  const roles: ('BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER')[] = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'];
  const players: Player[] = [];
  const firstNames = ['Arjun', 'Devendra', 'Naveen', 'Siddharth', 'Prateek', 'Rajat', 'Aniket', 'Saurav', 'Manan', 'Abhay'];
  const lastNames = ['Singh', 'Sharma', 'Patel', 'Kumar', 'Verma', 'Gupta', 'Yadav', 'Reddy', 'Rao', 'Choudhary'];

  for (let i = 0; i < count; i++) {
    const idNum = startIndex + i + 1;
    const role = roles[i % roles.length];
    const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`;
    players.push({
      id: `p-emerg-${idNum}`,
      name,
      country: 'India',
      isOverseas: false,
      role,
      battingStyle: i % 2 === 0 ? 'Right-Hand Bat' : 'Left-Hand Bat',
      bowlingStyle: role === 'BOWLER' ? 'Right-Arm Medium' : 'Right-Arm Off Spin',
      rating: 74,
      battingRating: role === 'BATSMAN' ? 76 : 50,
      bowlingRating: role === 'BOWLER' ? 76 : 40,
      fieldingRating: 75,
      basePrice: 2000000,
      status: 'UPCOMING',
      setNumber: 21,
      setName: 'Accelerated Round Squad Fillers',
      specialSkill: 'Dependable Domestic Squad Depth Player',
      stats: {
        matches: 15,
        runs: role === 'BOWLER' ? 20 : 250,
        highestScore: role === 'BOWLER' ? 10 : 54,
        strikeRate: 130.5,
        average: 24.2,
        fifties: role === 'BOWLER' ? 0 : 2,
        hundreds: 0,
        wickets: role === 'BATSMAN' || role === 'WICKET_KEEPER' ? 0 : 18,
        economy: 7.8,
        bestBowling: role === 'BATSMAN' || role === 'WICKET_KEEPER' ? '0/0' : '3/21'
      },
      avatarBgColor: '#059669'
    });
  }
  return players;
};

// Compute next mandatory minimum bid increment
export const getNextBidIncrement = (currentAmount: number): number => {
  if (currentAmount < 10000000) {
    return 1000000; // +10 Lakh below 1 Cr
  } else if (currentAmount < 50000000) {
    return 2000000; // +20 Lakh between 1 Cr and 5 Cr
  } else if (currentAmount < 100000000) {
    return 5000000; // +50 Lakh between 5 Cr and 10 Cr
  } else {
    return 10000000; // +1 Cr above 10 Cr
  }
};

// Check if team can place a bid
export const canTeamBid = (
  team: Team,
  amount: number,
  player: Player
): { canBid: boolean; reason?: string } => {
  if (team.budget < amount) {
    return { canBid: false, reason: 'Insufficient remaining purse' };
  }

  // Max 25 players in IPL squad
  if (team.players.length >= MAX_PLAYERS_PER_TEAM) {
    return { canBid: false, reason: 'Squad limit reached (25 players max)' };
  }

  // Max 8 overseas players
  const overseasCount = team.players.filter((p) => p.isOverseas).length;
  if (player.isOverseas && overseasCount >= 8) {
    return { canBid: false, reason: 'Overseas quota full (8 players max)' };
  }

  // Purse reserve check: Need at least 20L per remaining unfilled squad spot (min 15 players)
  const remainingSlotsNeeded = Math.max(0, MIN_PLAYERS_PER_TEAM - (team.players.length + 1));
  const reserveNeeded = remainingSlotsNeeded * 2000000;
  if (team.budget - amount < reserveNeeded) {
    return { canBid: false, reason: 'Purse reserve required to complete minimum 15-player squad' };
  }

  return { canBid: true };
};

// AI Bot evaluation function: ensures bots aggressively complete their 15-player minimum roster
export const evaluateBotBid = (
  botTeam: Team,
  player: Player,
  currentBid: number,
  currentBidderId: string | null,
  mode?: string
): boolean => {
  // CRITICAL: Strictly NO bot bids in full multiplayer mode
  if (mode === 'FULL_MULTIPLAYER') return false;
  if (!botTeam.isBot) return false;
  if (currentBidderId === botTeam.id) return false; // Already leading bidder

  const nextBid = currentBid === 0 ? player.basePrice : currentBid + getNextBidIncrement(currentBid);
  const eligibility = canTeamBid(botTeam, nextBid, player);
  if (!eligibility.canBid) return false;

  // Role count in team
  const batsmenCount = botTeam.players.filter((p) => p.role === 'BATSMAN').length;
  const bowlersCount = botTeam.players.filter((p) => p.role === 'BOWLER').length;
  const allRoundersCount = botTeam.players.filter((p) => p.role === 'ALL_ROUNDER').length;
  const wkCount = botTeam.players.filter((p) => p.role === 'WICKET_KEEPER').length;

  let roleDesperationMultiplier = 1.0;
  if (player.role === 'WICKET_KEEPER' && wkCount === 0) roleDesperationMultiplier = 1.6;
  if (player.role === 'BOWLER' && bowlersCount < 3) roleDesperationMultiplier = 1.4;
  if (player.role === 'BATSMAN' && batsmenCount < 4) roleDesperationMultiplier = 1.3;
  if (player.role === 'ALL_ROUNDER' && allRoundersCount < 2) roleDesperationMultiplier = 1.35;

  // 15-Player Minimum Squad Priority: Bots prioritize completing minimum 15-player roster
  const squadDeficit = Math.max(0, MIN_PLAYERS_PER_TEAM - botTeam.players.length);
  if (squadDeficit > 0) {
    const deficitUrgency = 1.0 + (squadDeficit / MIN_PLAYERS_PER_TEAM) * 1.2;
    roleDesperationMultiplier *= deficitUrgency;

    const remainingPurseAfterBid = botTeam.budget - nextBid;
    const reserveNeeded = Math.max(0, squadDeficit - 1) * 2000000;

    if (remainingPurseAfterBid >= reserveNeeded) {
      // If opening bid and price is low (<= 1 Cr or base price), bid to fill squad!
      if (currentBid === 0) {
        if (player.basePrice <= 10000000 || botTeam.budget > squadDeficit * 5000000) {
          return true;
        }
      }
      // If current bid is competitive but within affordable valuation, continue bidding
      if (nextBid <= Math.max(player.basePrice * 1.5, (botTeam.budget / squadDeficit) * 1.2)) {
        return true;
      }
    }
  }

  // Strategy multiplier
  let strategyMultiplier = 1.0;
  if (botTeam.botStrategy === 'AGGRESSIVE') strategyMultiplier = 1.3;
  if (botTeam.botStrategy === 'VALUE_HUNTER') strategyMultiplier = 0.9;
  if (botTeam.botStrategy === 'BOWLING_FOCUS' && player.role === 'BOWLER') strategyMultiplier = 1.4;

  // Max valuation calculation based on player rating (70-98)
  const ratingNormalized = (player.rating - 70) / 28; // 0 to 1
  const maxPurseShare = (0.05 + ratingNormalized * 0.22) * roleDesperationMultiplier * strategyMultiplier;
  const botMaxValuation = Math.min(botTeam.budget * 0.35, botTeam.initialBudget * maxPurseShare);

  // Add slight random appetite
  const randomFactor = 0.85 + Math.random() * 0.3; // 0.85 to 1.15
  const finalThreshold = Math.max(player.basePrice, botMaxValuation * randomFactor);

  return nextBid <= finalThreshold;
};

// Process bid action
export const placeBidOnCurrentPlayer = (
  room: RoomState,
  biddingTeamId: string
): { updatedRoom: RoomState; success: boolean; message: string } => {
  const player = room.playersPool[room.currentPlayerIndex];
  if (!player || player.status !== 'CURRENT') {
    return { updatedRoom: room, success: false, message: 'No active player in auction lot' };
  }

  const team = room.teams.find((t) => t.id === biddingTeamId);
  if (!team) {
    return { updatedRoom: room, success: false, message: 'Franchise not found' };
  }

  const nextBidAmount =
    room.currentBid === 0 ? player.basePrice : room.currentBid + getNextBidIncrement(room.currentBid);

  const check = canTeamBid(team, nextBidAmount, player);
  if (!check.canBid) {
    return { updatedRoom: room, success: false, message: check.reason || 'Cannot place bid' };
  }

  const newLog: AuctionLogEntry = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: Date.now(),
    type: 'BID',
    playerId: player.id,
    playerName: player.name,
    teamId: team.id,
    teamName: team.name,
    amount: nextBidAmount,
    message: `${team.shortName} raises the paddle to ${formatCurrency(nextBidAmount)}!`
  };

  const updatedRoom: RoomState = {
    ...room,
    currentBid: nextBidAmount,
    currentBidderTeamId: team.id,
    hammerStage: 0,
    timerRemaining: 10, // Reset countdown on new bid
    auctionLogs: [newLog, ...room.auctionLogs.slice(0, 49)]
  };

  return { updatedRoom, success: true, message: 'Bid placed successfully' };
};

// Finalize current player as SOLD or UNSOLD
export const finalizeCurrentPlayer = (
  room: RoomState
): { updatedRoom: RoomState; sold: boolean; winnerTeam?: Team; player: Player } => {
  const player = room.playersPool[room.currentPlayerIndex];
  const isSold = room.currentBid > 0 && room.currentBidderTeamId !== null;

  let winnerTeam: Team | undefined;
  const updatedTeams = room.teams.map((t) => {
    if (isSold && t.id === room.currentBidderTeamId) {
      winnerTeam = t;
      const boughtPlayer: Player = {
        ...player,
        status: 'SOLD',
        soldPrice: room.currentBid,
        soldToTeamId: t.id
      };
      return {
        ...t,
        budget: t.budget - room.currentBid,
        players: [...t.players, boughtPlayer]
      };
    }
    return t;
  });

  const updatedPlayer: Player = {
    ...player,
    status: isSold ? 'SOLD' : 'UNSOLD',
    soldPrice: isSold ? room.currentBid : undefined,
    soldToTeamId: isSold ? room.currentBidderTeamId! : undefined
  };

  let updatedPool = [...room.playersPool];
  updatedPool[room.currentPlayerIndex] = updatedPlayer;

  const newLog: AuctionLogEntry = isSold
    ? {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'SOLD',
        playerId: player.id,
        playerName: player.name,
        teamId: room.currentBidderTeamId!,
        teamName: winnerTeam?.name || 'Winning Team',
        amount: room.currentBid,
        message: `🔨 SOLD! ${player.name} goes to ${winnerTeam?.shortName} for ${formatCurrency(room.currentBid)}!`
      }
    : {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'UNSOLD',
        playerId: player.id,
        playerName: player.name,
        amount: player.basePrice,
        message: `❌ UNSOLD! No bids received for ${player.name} at ${formatCurrency(player.basePrice)}.`
      };

  // Find next upcoming player
  let nextIndex = room.currentPlayerIndex + 1;
  while (nextIndex < updatedPool.length && updatedPool[nextIndex].status !== 'UPCOMING') {
    nextIndex++;
  }

  // REQUIREMENT: Auction MUST NOT end until each team has completed at least 15 players!
  let extraLogs: AuctionLogEntry[] = [];
  if (nextIndex >= updatedPool.length) {
    const incompleteTeams = getIncompleteTeams(updatedTeams);
    if (incompleteTeams.length > 0) {
      // Find all UNSOLD players to recycle for the accelerated round
      const unsoldIndices: number[] = [];
      updatedPool.forEach((p, idx) => {
        if (p.status === 'UNSOLD') {
          unsoldIndices.push(idx);
        }
      });

      if (unsoldIndices.length > 0) {
        unsoldIndices.forEach((idx) => {
          updatedPool[idx] = {
            ...updatedPool[idx],
            status: 'UPCOMING',
            setName: 'Accelerated Round (Re-Auction)',
            basePrice: Math.min(updatedPool[idx].basePrice, 5000000) // Capped at 50 Lakh for affordability
          };
        });
        nextIndex = unsoldIndices[0];

        extraLogs.push({
          id: `log-accelerated-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ANNOUNCEMENT',
          playerId: updatedPool[nextIndex].id,
          playerName: 'Accelerated Round',
          amount: 0,
          message: `📢 ACCELERATED ROUND INITIATED: Squads incomplete! ${incompleteTeams.map((t) => `${t.shortName} (${t.players.length}/15)`).join(', ')} still need players. Re-listing ${unsoldIndices.length} unsold players for bidding!`
        });
      } else {
        // If all pool players were sold, inject emergency squad depth players
        const neededCount = incompleteTeams.reduce((sum, t) => sum + (MIN_PLAYERS_PER_TEAM - t.players.length), 0) + 10;
        const emergencyPlayers = generateEmergencySquadFillers(updatedPool.length, neededCount);
        const startIndex = updatedPool.length;
        updatedPool = [...updatedPool, ...emergencyPlayers];
        nextIndex = startIndex;

        extraLogs.push({
          id: `log-emergency-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ANNOUNCEMENT',
          playerId: updatedPool[nextIndex].id,
          playerName: 'Supplemental Talent Pool',
          amount: 0,
          message: `📢 SUPPLEMENTAL DRAFT ADDED: Injecting ${neededCount} domestic squad depth players to guarantee every franchise achieves the mandatory 15-player squad.`
        });
      }
    }
  }

  const isAuctionCompleted = nextIndex >= updatedPool.length && allTeamsHaveMinimumSquad(updatedTeams);

  if (!isAuctionCompleted && updatedPool[nextIndex]) {
    updatedPool[nextIndex] = {
      ...updatedPool[nextIndex],
      status: 'CURRENT'
    };
  }

  const updatedRoom: RoomState = {
    ...room,
    teams: updatedTeams,
    playersPool: updatedPool,
    currentPlayerIndex: isAuctionCompleted ? room.currentPlayerIndex : nextIndex,
    currentBid: 0,
    currentBidderTeamId: null,
    hammerStage: 0,
    timerRemaining: 12,
    status: isAuctionCompleted ? 'SQUAD_SELECTION' : 'AUCTION',
    auctionLogs: [...extraLogs, newLog, ...room.auctionLogs.slice(0, 48)]
  };

  return { updatedRoom, sold: isSold, winnerTeam, player: updatedPlayer };
};

// Step 1 of Lot Closing: Close bidding for current player without immediately jumping
export const closeBiddingForCurrentPlayer = (
  room: RoomState
): { updatedRoom: RoomState; sold: boolean; winnerTeam?: Team; player: Player; soldPrice?: number } => {
  const player = room.playersPool[room.currentPlayerIndex];
  if (!player) {
    return { updatedRoom: room, sold: false, player: room.playersPool[0] };
  }

  const isSold = room.currentBid > 0 && room.currentBidderTeamId !== null;

  let winnerTeam: Team | undefined;
  const updatedTeams = room.teams.map((t) => {
    if (isSold && t.id === room.currentBidderTeamId) {
      winnerTeam = t;
      const boughtPlayer: Player = {
        ...player,
        status: 'SOLD',
        soldPrice: room.currentBid,
        soldToTeamId: t.id
      };
      return {
        ...t,
        budget: t.budget - room.currentBid,
        players: [...t.players, boughtPlayer]
      };
    }
    return t;
  });

  const updatedPlayer: Player = {
    ...player,
    status: isSold ? 'SOLD' : 'UNSOLD',
    soldPrice: isSold ? room.currentBid : undefined,
    soldToTeamId: isSold ? room.currentBidderTeamId! : undefined
  };

  const updatedPool = [...room.playersPool];
  updatedPool[room.currentPlayerIndex] = updatedPlayer;

  const newLog: AuctionLogEntry = isSold
    ? {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'SOLD',
        playerId: player.id,
        playerName: player.name,
        teamId: room.currentBidderTeamId!,
        teamName: winnerTeam?.name || 'Winning Team',
        amount: room.currentBid,
        message: `🔨 SOLD! ${player.name} goes to ${winnerTeam?.shortName} for ${formatCurrency(room.currentBid)}!`
      }
    : {
        id: `log-${Date.now()}`,
        timestamp: Date.now(),
        type: 'UNSOLD',
        playerId: player.id,
        playerName: player.name,
        amount: player.basePrice,
        message: `❌ UNSOLD! No bids received for ${player.name} at ${formatCurrency(player.basePrice)}.`
      };

  const updatedRoom: RoomState = {
    ...room,
    teams: updatedTeams,
    playersPool: updatedPool,
    hammerStage: 3, // Closed / Hammer down stage
    timerRemaining: 0,
    auctionLogs: [newLog, ...room.auctionLogs.slice(0, 49)]
  };

  return { updatedRoom, sold: isSold, winnerTeam, player: updatedPlayer, soldPrice: isSold ? room.currentBid : undefined };
};

// Step 2 of Lot Closing: Advance to the next player lot and reset timer for next bidding round
export const advanceToNextPlayerLot = (room: RoomState): RoomState => {
  let updatedPool = [...room.playersPool];

  let nextIndex = room.currentPlayerIndex + 1;
  while (nextIndex < updatedPool.length && updatedPool[nextIndex].status !== 'UPCOMING') {
    nextIndex++;
  }

  // REQUIREMENT: Auction MUST NOT end until each team has completed at least 15 players!
  let extraLogs: AuctionLogEntry[] = [];
  if (nextIndex >= updatedPool.length) {
    const incompleteTeams = getIncompleteTeams(room.teams);
    if (incompleteTeams.length > 0) {
      // Find all UNSOLD players to recycle for the accelerated round
      const unsoldIndices: number[] = [];
      updatedPool.forEach((p, idx) => {
        if (p.status === 'UNSOLD') {
          unsoldIndices.push(idx);
        }
      });

      if (unsoldIndices.length > 0) {
        unsoldIndices.forEach((idx) => {
          updatedPool[idx] = {
            ...updatedPool[idx],
            status: 'UPCOMING',
            setName: 'Accelerated Round (Re-Auction)',
            basePrice: Math.min(updatedPool[idx].basePrice, 5000000) // Capped at 50 Lakh for affordability
          };
        });
        nextIndex = unsoldIndices[0];

        extraLogs.push({
          id: `log-accelerated-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ANNOUNCEMENT',
          playerId: updatedPool[nextIndex].id,
          playerName: 'Accelerated Round',
          amount: 0,
          message: `📢 ACCELERATED ROUND INITIATED: Squads incomplete! ${incompleteTeams.map((t) => `${t.shortName} (${t.players.length}/15)`).join(', ')} still need players. Re-listing ${unsoldIndices.length} unsold players for bidding!`
        });
      } else {
        // If all pool players were sold, inject emergency squad depth players
        const neededCount = incompleteTeams.reduce((sum, t) => sum + (MIN_PLAYERS_PER_TEAM - t.players.length), 0) + 10;
        const emergencyPlayers = generateEmergencySquadFillers(updatedPool.length, neededCount);
        const startIndex = updatedPool.length;
        updatedPool = [...updatedPool, ...emergencyPlayers];
        nextIndex = startIndex;

        extraLogs.push({
          id: `log-emergency-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ANNOUNCEMENT',
          playerId: updatedPool[nextIndex].id,
          playerName: 'Supplemental Talent Pool',
          amount: 0,
          message: `📢 SUPPLEMENTAL DRAFT ADDED: Injecting ${neededCount} domestic squad depth players to guarantee every franchise achieves the mandatory 15-player squad.`
        });
      }
    }
  }

  const isAuctionCompleted = nextIndex >= updatedPool.length && allTeamsHaveMinimumSquad(room.teams);

  if (!isAuctionCompleted && updatedPool[nextIndex]) {
    updatedPool[nextIndex] = {
      ...updatedPool[nextIndex],
      status: 'CURRENT'
    };

    const nextPlayer = updatedPool[nextIndex];
    const announcementLog: AuctionLogEntry = {
      id: `log-lot-${Date.now()}`,
      timestamp: Date.now(),
      type: 'ANNOUNCEMENT',
      playerId: nextPlayer.id,
      playerName: nextPlayer.name,
      amount: nextPlayer.basePrice,
      message: `📢 Next Lot #${nextIndex + 1}: ${nextPlayer.name} (${nextPlayer.role.replace('_', ' ')}) at base price ${formatCurrency(nextPlayer.basePrice)}.`
    };

    return {
      ...room,
      playersPool: updatedPool,
      currentPlayerIndex: nextIndex,
      currentBid: 0,
      currentBidderTeamId: null,
      hammerStage: 0,
      timerRemaining: 12,
      status: 'AUCTION',
      auctionLogs: [...extraLogs, announcementLog, ...room.auctionLogs.slice(0, 48)]
    };
  }

  const completedLog: AuctionLogEntry = {
    id: `log-concluded-${Date.now()}`,
    timestamp: Date.now(),
    type: 'ANNOUNCEMENT',
    playerId: 'auction-finish',
    playerName: 'Auction Concluded',
    amount: 0,
    message: `🏆 MEGA AUCTION CONCLUDED! All ${room.teams.length} franchises have successfully met the minimum 15-player squad requirement! Proceeding to Squad Selection.`
  };

  return {
    ...room,
    playersPool: updatedPool,
    currentBid: 0,
    currentBidderTeamId: null,
    hammerStage: 0,
    timerRemaining: 0,
    status: 'SQUAD_SELECTION',
    auctionLogs: [completedLog, ...extraLogs, ...room.auctionLogs.slice(0, 48)]
  };
};

/**
 * Freezes and prepares an auction room when the user leaves or navigates away.
 * Ensures the exact player lot they were on is preserved with status 'CURRENT'
 * and the timer is safely reset so they don't lose bidding time upon returning.
 */
export const prepareRoomForExit = (room: RoomState): RoomState => {
  if (room.status !== 'AUCTION') {
    return room;
  }

  const pool = [...room.playersPool];
  let targetIndex = room.currentPlayerIndex;

  if (targetIndex >= pool.length) {
    targetIndex = Math.max(0, pool.length - 1);
  }

  const activePlayer = pool[targetIndex];

  // If the active player lot was already finalized (SOLD or UNSOLD) right before exit,
  // ensure targetIndex moves cleanly to the next UPCOMING lot
  if (activePlayer && (activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD')) {
    let nextUpcoming = targetIndex + 1;
    while (nextUpcoming < pool.length && pool[nextUpcoming].status !== 'UPCOMING') {
      nextUpcoming++;
    }
    if (nextUpcoming < pool.length) {
      targetIndex = nextUpcoming;
    }
  }

  // Ensure target player is marked CURRENT
  if (pool[targetIndex]) {
    pool[targetIndex] = {
      ...pool[targetIndex],
      status: 'CURRENT'
    };
  }

  // Ensure all subsequent players remain UPCOMING
  for (let i = targetIndex + 1; i < pool.length; i++) {
    if (pool[i].status === 'CURRENT') {
      pool[i] = { ...pool[i], status: 'UPCOMING' };
    }
  }

  return {
    ...room,
    playersPool: pool,
    currentPlayerIndex: targetIndex,
    timerRemaining: 12, // Fresh full timer countdown for this player
    hammerStage: 0,
    currentBid: 0,
    currentBidderTeamId: null,
    isPaused: true,
    lastUpdated: Date.now()
  };
};

/**
 * Restores and verifies an auction room when the user rejoins.
 * Guarantees the auction starts from the exact same player lot with which he left,
 * with full 12s countdown and open bidding paddle.
 */
export const prepareRoomForRejoin = (room: RoomState): RoomState => {
  if (room.status !== 'AUCTION') {
    return room;
  }

  let pool = [...room.playersPool];

  // Seamlessly backfill existing rooms with the full 500+ player roster
  if (pool.length < INITIAL_PLAYERS.length) {
    const existingIds = new Set(pool.map((p) => p.id));
    const missing = INITIAL_PLAYERS.filter((p) => !existingIds.has(p.id)).map((p) => ({
      ...p,
      status: 'UPCOMING' as const
    }));
    pool = [...pool, ...missing];
  }

  let targetIndex = room.currentPlayerIndex;

  if (targetIndex >= pool.length) {
    targetIndex = Math.max(0, pool.length - 1);
  }

  const activePlayer = pool[targetIndex];

  // If already sold/unsold, advance to next upcoming
  if (activePlayer && (activePlayer.status === 'SOLD' || activePlayer.status === 'UNSOLD')) {
    let nextUpcoming = targetIndex + 1;
    while (nextUpcoming < pool.length && pool[nextUpcoming].status !== 'UPCOMING') {
      nextUpcoming++;
    }
    if (nextUpcoming < pool.length) {
      targetIndex = nextUpcoming;
    }
  }

  // Set active target player to CURRENT
  if (pool[targetIndex]) {
    pool[targetIndex] = {
      ...pool[targetIndex],
      status: 'CURRENT'
    };
  }

  // Ensure all subsequent players remain UPCOMING
  for (let i = targetIndex + 1; i < pool.length; i++) {
    if (pool[i].status === 'CURRENT') {
      pool[i] = { ...pool[i], status: 'UPCOMING' };
    }
  }

  return {
    ...room,
    playersPool: pool,
    currentPlayerIndex: targetIndex,
    timerRemaining: 12,
    hammerStage: 0,
    currentBid: 0,
    currentBidderTeamId: null,
    isPaused: false, // Active and ready to bid
    lastUpdated: Date.now()
  };
};


