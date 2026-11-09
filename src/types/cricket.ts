/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PlayerRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
export type PlayerStatus = 'UPCOMING' | 'CURRENT' | 'SOLD' | 'UNSOLD';
export type BattingStyle = 'Right-Hand Bat' | 'Left-Hand Bat';
export type BowlingStyle = 'Right-Arm Fast' | 'Right-Arm Medium' | 'Left-Arm Fast' | 'Left-Arm Medium' | 'Right-Arm Off Spin' | 'Leg Spin' | 'Left-Arm Orthodox';

export interface PlayerStats {
  matches: number;
  runs: number;
  highestScore: number;
  strikeRate: number;
  average: number;
  fifties: number;
  hundreds: number;
  wickets: number;
  economy: number;
  bestBowling: string;
}

export interface Player {
  id: string;
  name: string;
  country: string;
  isOverseas: boolean;
  role: PlayerRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  rating: number; // 70 - 99
  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;
  basePrice: number; // in INR e.g. 20000000 for 2 Cr
  soldPrice?: number;
  soldToTeamId?: string;
  status: PlayerStatus;
  setNumber: number;
  setName: string;
  specialSkill: string;
  stats: PlayerStats;
  avatarBgColor?: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  budget: number; // Current remaining purse
  initialBudget: number; // Starting purse (e.g. 100 Cr)
  isUserTeam: boolean;
  userId?: string;
  isBot: boolean;
  botStrategy?: 'AGGRESSIVE' | 'VALUE_HUNTER' | 'BOWLING_FOCUS' | 'BALANCED';
  players: Player[];
  captainId?: string;
  viceCaptainId?: string;
  wicketKeeperId?: string;
  playingXIIds?: string[];
}

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  securityQuestion: string;
  securityAnswer: string;
  purseBalance: number; // Starting bonus / wallet
  trophiesWon: number;
  matchesPlayed: number;
  auctionsCompleted: number;
  createdAt: string;
}

export interface AuctionLogEntry {
  id: string;
  timestamp: number;
  type: 'BID' | 'SOLD' | 'UNSOLD' | 'WARNING' | 'ANNOUNCEMENT';
  playerId: string;
  playerName: string;
  teamId?: string;
  teamName?: string;
  amount: number;
  message: string;
}

export type TournamentFormat = 'QUICK_LEAGUE' | 'FULL_SEASON' | 'MINI_TOURNAMENT' | 'KNOCKOUT_CUP';
export type PitchCondition = 'BALANCED' | 'BATTING_PARADISE' | 'GREEN_SEAMER' | 'SPIN_WEB';

export interface BallData {
  ballNumber: number; // 1 to 120
  overNumber: number; // 0 to 19
  ballInOver: number; // 1 to 6
  batsmanId: string;
  batsmanName: string;
  bowlerId: string;
  bowlerName: string;
  runs: number;
  isExtra: boolean;
  extraType?: 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE';
  isWicket: boolean;
  dismissalType?: 'BOWLED' | 'CAUGHT' | 'LBW' | 'RUN_OUT' | 'STUMPED';
  dismissedPlayerName?: string;
  commentary: string;
  totalScore: number;
  totalWickets: number;
}

export interface BatsmanScore {
  playerId: string;
  playerName: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalText?: string;
}

export interface BowlerScore {
  playerId: string;
  playerName: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  dots: number;
}

export interface InningsData {
  teamId: string;
  teamName: string;
  totalRuns: number;
  totalWickets: number;
  oversCompleted: number;
  ballsBowled: number;
  balls: BallData[];
  battingScorecard: BatsmanScore[];
  bowlingScorecard: BowlerScore[];
  fallOfWickets: { score: number; wicketNum: number; over: string; batsmanName: string }[];
}

export interface PrizeBonusItem {
  category: 'RESULT' | 'BATTING' | 'BOWLING' | 'POTM' | 'CHAMPIONSHIP';
  label: string;
  amount: number; // in INR
}

export interface MatchPrizeBreakdown {
  teamId: string;
  teamName: string;
  shortName: string;
  basePrize: number;
  performanceBonuses: PrizeBonusItem[];
  totalPrize: number;
  previousPurse: number;
  newPurse: number;
}

export interface Match {
  id: string;
  roundNumber: number;
  roundName: string;
  team1Id: string;
  team2Id: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
  pitchCondition: PitchCondition;
  tossWinnerId?: string;
  tossDecision?: 'BAT' | 'BOWL';
  currentInnings: 1 | 2;
  team1Innings?: InningsData;
  team2Innings?: InningsData;
  winnerId?: string;
  margin?: string;
  playerOfTheMatchId?: string;
  playerOfTheMatchName?: string;
  playerOfTheMatchPerformance?: string;
  team1Prize?: MatchPrizeBreakdown;
  team2Prize?: MatchPrizeBreakdown;
  prizeAwarded?: boolean;
}

export interface PointsTableEntry {
  teamId: string;
  teamName: string;
  shortName: string;
  primaryColor: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  points: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  nrr: number;
}

export interface RoomState {
  code: string; // 6-digit room code
  name: string;
  hostUserId: string;
  mode: 'SOLO_AUCTION_MULTI_MATCH' | 'FULL_MULTIPLAYER';
  status: 'LOBBY' | 'AUCTION' | 'SQUAD_SELECTION' | 'TOURNAMENT' | 'COMPLETED';
  tournamentFormat: TournamentFormat;
  pitchCondition: PitchCondition;
  teams: Team[];
  playersPool: Player[];
  currentPlayerIndex: number;
  currentBid: number;
  currentBidderTeamId: string | null;
  hammerStage: 0 | 1 | 2 | 3; // 0=Running, 1=Going Once, 2=Going Twice, 3=Sold
  timerRemaining: number;
  isPaused?: boolean;
  pausedByUserId?: string;
  auctionLogs: AuctionLogEntry[];
  matches: Match[];
  currentMatchIndex: number;
  lastUpdated: number;
}
