/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player, Team, RoomState, AuctionLogEntry } from '../types/cricket';
import { formatCurrency } from '../data/iplFranchises';

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
  if (team.players.length >= 25) {
    return { canBid: false, reason: 'Squad limit reached (25 players max)' };
  }

  // Max 8 overseas players
  const overseasCount = team.players.filter((p) => p.isOverseas).length;
  if (player.isOverseas && overseasCount >= 8) {
    return { canBid: false, reason: 'Overseas quota full (8 players max)' };
  }

  // Purse reserve check: Need at least 20L per remaining unfilled squad spot (min 15 players)
  const remainingSlotsNeeded = Math.max(0, 15 - (team.players.length + 1));
  const reserveNeeded = remainingSlotsNeeded * 2000000;
  if (team.budget - amount < reserveNeeded) {
    return { canBid: false, reason: 'Purse reserve required to complete minimum 15-player squad' };
  }

  return { canBid: true };
};

// AI Bot evaluation function
export const evaluateBotBid = (
  botTeam: Team,
  player: Player,
  currentBid: number,
  currentBidderId: string | null
): boolean => {
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

  // Find next upcoming player
  let nextIndex = room.currentPlayerIndex + 1;
  while (nextIndex < updatedPool.length && updatedPool[nextIndex].status !== 'UPCOMING') {
    nextIndex++;
  }

  const isAuctionCompleted = nextIndex >= updatedPool.length;

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
    auctionLogs: [newLog, ...room.auctionLogs.slice(0, 49)]
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
  const updatedPool = [...room.playersPool];

  let nextIndex = room.currentPlayerIndex + 1;
  while (nextIndex < updatedPool.length && updatedPool[nextIndex].status !== 'UPCOMING') {
    nextIndex++;
  }

  const isAuctionCompleted = nextIndex >= updatedPool.length;

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
      auctionLogs: [announcementLog, ...room.auctionLogs.slice(0, 48)]
    };
  }

  return {
    ...room,
    playersPool: updatedPool,
    currentBid: 0,
    currentBidderTeamId: null,
    hammerStage: 0,
    timerRemaining: 0,
    status: 'SQUAD_SELECTION'
  };
};

