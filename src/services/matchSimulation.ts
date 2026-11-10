/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Match,
  Team,
  Player,
  InningsData,
  BallData,
  BatsmanScore,
  BowlerScore,
  TournamentFormat,
  PitchCondition,
  PointsTableEntry,
  MatchPrizeBreakdown,
  PrizeBonusItem,
  RoomState
} from '../types/cricket';
import { formatCurrency } from '../data/iplFranchises';
import { creditUserPurse } from './storage';

// Generate match fixtures for tournament
export const generateTournamentFixtures = (
  teams: Team[],
  format: TournamentFormat,
  pitch: PitchCondition
): Match[] => {
  const matches: Match[] = [];
  const participatingTeams = teams.slice(0, Math.min(teams.length, 8)); // Use up to 8 franchises
  let matchCounter = 1;

  if (format === 'KNOCKOUT_CUP') {
    // 4 or 8 team knockout
    const count = participatingTeams.length >= 8 ? 8 : 4;
    const pool = participatingTeams.slice(0, count);

    if (count === 8) {
      // Quarterfinals
      for (let i = 0; i < 4; i++) {
        matches.push({
          id: `match-qf-${i + 1}`,
          roundNumber: 1,
          roundName: `Quarterfinal ${i + 1}`,
          team1Id: pool[i].id,
          team2Id: pool[count - 1 - i].id,
          status: 'SCHEDULED',
          pitchCondition: pitch,
          currentInnings: 1
        });
      }
      matches.push({
        id: 'match-sf-1',
        roundNumber: 2,
        roundName: 'Semifinal 1',
        team1Id: pool[0].id,
        team2Id: pool[1].id,
        status: 'SCHEDULED',
        pitchCondition: pitch,
        currentInnings: 1
      });
      matches.push({
        id: 'match-sf-2',
        roundNumber: 2,
        roundName: 'Semifinal 2',
        team1Id: pool[2].id,
        team2Id: pool[3].id,
        status: 'SCHEDULED',
        pitchCondition: pitch,
        currentInnings: 1
      });
      matches.push({
        id: 'match-final',
        roundNumber: 3,
        roundName: 'Grand Final',
        team1Id: pool[0].id,
        team2Id: pool[2].id,
        status: 'SCHEDULED',
        pitchCondition: pitch,
        currentInnings: 1
      });
    } else {
      // 4-team Semis + Final
      matches.push({
        id: 'match-sf-1',
        roundNumber: 1,
        roundName: 'Semifinal 1',
        team1Id: pool[0].id,
        team2Id: pool[3].id,
        status: 'SCHEDULED',
        pitchCondition: pitch,
        currentInnings: 1
      });
      matches.push({
        id: 'match-sf-2',
        roundNumber: 1,
        roundName: 'Semifinal 2',
        team1Id: pool[1].id,
        team2Id: pool[2].id,
        status: 'SCHEDULED',
        pitchCondition: pitch,
        currentInnings: 1
      });
      matches.push({
        id: 'match-final',
        roundNumber: 2,
        roundName: 'Grand Final',
        team1Id: pool[0].id,
        team2Id: pool[1].id,
        status: 'SCHEDULED',
        pitchCondition: pitch,
        currentInnings: 1
      });
    }
  } else {
    // Round robin style
    // Quick League: 4 teams (6 matches)
    // Full Season: All participating franchises (up to 8 teams = 28 matches)
    const leagueTeams = format === 'QUICK_LEAGUE' || format === 'MINI_TOURNAMENT'
      ? participatingTeams.slice(0, 4)
      : participatingTeams;

    for (let i = 0; i < leagueTeams.length; i++) {
      for (let j = i + 1; j < leagueTeams.length; j++) {
        matches.push({
          id: `match-l-${matchCounter}`,
          roundNumber: 1,
          roundName: `League Match ${matchCounter}`,
          stage: 'LEAGUE',
          team1Id: leagueTeams[i].id,
          team2Id: leagueTeams[j].id,
          status: 'SCHEDULED',
          pitchCondition: pitch,
          currentInnings: 1
        });
        matchCounter++;
      }
    }
    // CRITICAL REQUIREMENT: ONLY league matches are fixed in advance!
    // The playoffs will be decided after the league matches end and the points table will determine it.
  }

  return matches;
};

// Auto-fill or select best Playing XI for a team (Enforcing max 4 overseas players rule)
export const getOrAutoSelectPlayingXI = (team: Team): Player[] => {
  if (team.playingXIIds && team.playingXIIds.length === 11) {
    const selected = team.players.filter((p) => team.playingXIIds!.includes(p.id));
    if (selected.length === 11) return selected;
  }

  // Auto-pick balanced XI with max 4 overseas
  const players = [...team.players].sort((a, b) => b.rating - a.rating);
  const xi: Player[] = [];
  let overseasCount = 0;

  // 1. Must have at least 1 Wicketkeeper
  const wk = players.find((p) => p.role === 'WICKET_KEEPER');
  if (wk) {
    xi.push(wk);
    if (wk.isOverseas) overseasCount++;
  }

  // 2. Add top bowlers (at least 3-4)
  const bowlers = players.filter((p) => p.role === 'BOWLER' && !xi.includes(p));
  for (const b of bowlers) {
    if (xi.length >= 4) break;
    if (b.isOverseas && overseasCount >= 4) continue;
    xi.push(b);
    if (b.isOverseas) overseasCount++;
  }

  // 3. Add all-rounders
  const allRounders = players.filter((p) => p.role === 'ALL_ROUNDER' && !xi.includes(p));
  for (const ar of allRounders) {
    if (xi.length >= 7) break;
    if (ar.isOverseas && overseasCount >= 4) continue;
    xi.push(ar);
    if (ar.isOverseas) overseasCount++;
  }

  // 4. Fill remaining with batsmen or highest rating
  for (const p of players) {
    if (xi.length >= 11) break;
    if (xi.includes(p)) continue;
    if (p.isOverseas && overseasCount >= 4) continue;
    xi.push(p);
    if (p.isOverseas) overseasCount++;
  }

  // Fallback if squad < 11
  for (const p of players) {
    if (xi.length >= 11) break;
    if (!xi.includes(p)) xi.push(p);
  }

  return xi;
};

// Simulate a full innings ball-by-ball
export const simulateInnings = (
  battingTeam: Team,
  bowlingTeam: Team,
  pitch: PitchCondition,
  targetToChase?: number
): InningsData => {
  const batsmen = getOrAutoSelectPlayingXI(battingTeam);
  const bowlers = getOrAutoSelectPlayingXI(bowlingTeam).filter((p) => p.role === 'BOWLER' || p.role === 'ALL_ROUNDER');
  const activeBowlers = bowlers.length >= 5 ? bowlers : getOrAutoSelectPlayingXI(bowlingTeam);

  const battingScorecard: BatsmanScore[] = batsmen.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    isOut: false
  }));

  const bowlingScorecard: BowlerScore[] = activeBowlers.slice(0, 5).map((p) => ({
    playerId: p.id,
    playerName: p.name,
    overs: 0,
    maidens: 0,
    runs: 0,
    wickets: 0,
    economy: 0,
    dots: 0
  }));

  const balls: BallData[] = [];
  const fallOfWickets: { score: number; wicketNum: number; over: string; batsmanName: string }[] = [];

  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let nextBatsmanIdx = 2;
  let totalRuns = 0;
  let totalWickets = 0;

  // Pitch modifiers
  let boundaryMultiplier = 1.0;
  let wicketMultiplier = 1.0;
  if (pitch === 'BATTING_PARADISE') {
    boundaryMultiplier = 1.35;
    wicketMultiplier = 0.75;
  } else if (pitch === 'GREEN_SEAMER') {
    wicketMultiplier = 1.4;
    boundaryMultiplier = 0.85;
  } else if (pitch === 'SPIN_WEB') {
    wicketMultiplier = 1.3;
    boundaryMultiplier = 0.8;
  }

  // 20 Overs = 120 legal balls
  let ballCounter = 0;
  let currentBowlerIndex = 0;

  for (let over = 0; over < 20; over++) {
    if (totalWickets >= 10) break;
    if (targetToChase !== undefined && totalRuns >= targetToChase) break;

    // Pick bowler (rotation between 5 bowlers, max 4 overs each)
    let bowlerEntry = bowlingScorecard[currentBowlerIndex % bowlingScorecard.length];
    currentBowlerIndex++;

    let legalBallsInOver = 0;
    let overRuns = 0;

    while (legalBallsInOver < 6) {
      if (totalWickets >= 10) break;
      if (targetToChase !== undefined && totalRuns >= targetToChase) break;

      ballCounter++;
      legalBallsInOver++;

      const striker = batsmen[strikerIdx] || batsmen[0];
      const strikerCard = battingScorecard[strikerIdx] || battingScorecard[0];
      const bowler = bowlers.find((b) => b.id === bowlerEntry.playerId) || bowlers[0];

      strikerCard.balls++;

      // Probability calculations
      const batRating = (striker?.battingRating || 80) + (battingTeam.captainId === striker?.id ? 5 : 0);
      const bowlRating = (bowler?.bowlingRating || 80) + (bowlingTeam.captainId === bowler?.id ? 4 : 0);

      const netEdge = (batRating - bowlRating) / 100; // -0.2 to +0.2
      const roll = Math.random();

      // Wicket chance
      const baseWicketChance = (0.055 - netEdge * 0.02) * wicketMultiplier;
      const isWicket = roll < baseWicketChance;

      let runs = 0;
      let dismissalType: BallData['dismissalType'];
      let commentary = '';

      if (isWicket) {
        totalWickets++;
        strikerCard.isOut = true;
        bowlerEntry.wickets++;

        const dismissalRoll = Math.random();
        if (dismissalRoll < 0.45) {
          dismissalType = 'CAUGHT';
          strikerCard.dismissalText = `c & b ${bowler?.name || 'Bowler'}`;
          commentary = `OUT! ${striker?.name} tries to clear the ropes, mistimes it and caught in the deep!`;
        } else if (dismissalRoll < 0.75) {
          dismissalType = 'BOWLED';
          strikerCard.dismissalText = `b ${bowler?.name || 'Bowler'}`;
          commentary = `TIMBER! ${bowler?.name} rips through the gate and shatters the stumps! Clean bowled!`;
        } else if (dismissalRoll < 0.9) {
          dismissalType = 'LBW';
          strikerCard.dismissalText = `lbw b ${bowler?.name || 'Bowler'}`;
          commentary = `LOUD SHOUT! Finger goes up! Plumb in front! ${striker?.name} departs LBW.`;
        } else {
          dismissalType = 'RUN_OUT';
          strikerCard.dismissalText = `run out`;
          commentary = `DISASTER! Mix-up in the middle, direct hit from the fielder! Run out!`;
        }

        fallOfWickets.push({
          score: totalRuns,
          wicketNum: totalWickets,
          over: `${over}.${legalBallsInOver}`,
          batsmanName: striker?.name || 'Batsman'
        });

        // Bring next batsman
        strikerIdx = nextBatsmanIdx;
        nextBatsmanIdx++;
      } else {
        // Runs calculation
        const shotRoll = Math.random();
        const sixChance = 0.065 * boundaryMultiplier + Math.max(0, netEdge * 0.04);
        const fourChance = 0.14 * boundaryMultiplier + Math.max(0, netEdge * 0.05);

        if (shotRoll < sixChance) {
          runs = 6;
          strikerCard.runs += 6;
          strikerCard.sixes++;
          overRuns += 6;
          totalRuns += 6;
          bowlerEntry.runs += 6;
          commentary = `SIX! ${striker?.name} launches this high into the night sky! That is huge, into the top tier!`;
        } else if (shotRoll < sixChance + fourChance) {
          runs = 4;
          strikerCard.runs += 4;
          strikerCard.fours++;
          overRuns += 4;
          totalRuns += 4;
          bowlerEntry.runs += 4;
          commentary = `FOUR! Glorious stroke by ${striker?.name}! Pierces the gap at extra cover to the boundary!`;
        } else if (shotRoll < 0.45) {
          runs = 1;
          strikerCard.runs += 1;
          overRuns += 1;
          totalRuns += 1;
          bowlerEntry.runs += 1;
          commentary = `Pushed softly into the gap for a brisk single.`;
          // Swap strike
          const temp = strikerIdx;
          strikerIdx = nonStrikerIdx;
          nonStrikerIdx = temp;
        } else if (shotRoll < 0.58) {
          runs = 2;
          strikerCard.runs += 2;
          overRuns += 2;
          totalRuns += 2;
          bowlerEntry.runs += 2;
          commentary = `Good running between the wickets, turning 1 into 2 easily.`;
        } else {
          runs = 0;
          bowlerEntry.dots++;
          commentary = `Dot ball. Excellent tight line and length by ${bowler?.name}.`;
        }
      }

      // Update striker strike rate
      if (strikerCard.balls > 0) {
        strikerCard.strikeRate = Number(((strikerCard.runs / strikerCard.balls) * 100).toFixed(1));
      }

      balls.push({
        ballNumber: ballCounter,
        overNumber: over,
        ballInOver: legalBallsInOver,
        batsmanId: striker?.id || 'p-unknown',
        batsmanName: striker?.name || 'Batsman',
        bowlerId: bowler?.id || 'p-unknown',
        bowlerName: bowler?.name || 'Bowler',
        runs,
        isExtra: false,
        isWicket,
        dismissalType,
        dismissedPlayerName: isWicket ? striker?.name : undefined,
        commentary,
        totalScore: totalRuns,
        totalWickets
      });
    }

    // Over finished
    bowlerEntry.overs += 1;
    if (overRuns === 0) bowlerEntry.maidens += 1;
    bowlerEntry.economy = Number((bowlerEntry.runs / bowlerEntry.overs).toFixed(2));

    // End of over strike rotation
    const temp = strikerIdx;
    strikerIdx = nonStrikerIdx;
    nonStrikerIdx = temp;
  }

  const completedOvers = Math.floor(balls.length / 6);
  const remainingBalls = balls.length % 6;
  const oversFormatted = Number(`${completedOvers}.${remainingBalls}`);

  return {
    teamId: battingTeam.id,
    teamName: battingTeam.name,
    totalRuns,
    totalWickets,
    oversCompleted: oversFormatted,
    ballsBowled: balls.length,
    balls,
    battingScorecard,
    bowlingScorecard,
    fallOfWickets
  };
};

// Simulate full match
export const simulateFullMatch = (match: Match, team1: Team, team2: Team): Match => {
  // Coin Toss
  const tossWinner = Math.random() < 0.5 ? team1 : team2;
  const tossDecision: 'BAT' | 'BOWL' = Math.random() < 0.65 ? 'BAT' : 'BOWL';

  const firstBattingTeam =
    tossWinner.id === team1.id
      ? tossDecision === 'BAT'
        ? team1
        : team2
      : tossDecision === 'BAT'
      ? team2
      : team1;

  const secondBattingTeam = firstBattingTeam.id === team1.id ? team2 : team1;

  // First Innings
  const team1Innings = simulateInnings(firstBattingTeam, secondBattingTeam, match.pitchCondition);

  // Second Innings with Target
  const target = team1Innings.totalRuns + 1;
  const team2Innings = simulateInnings(secondBattingTeam, firstBattingTeam, match.pitchCondition, target);

  let winnerId: string;
  let margin: string;

  if (team2Innings.totalRuns >= target) {
    winnerId = secondBattingTeam.id;
    const wicketsLeft = 10 - team2Innings.totalWickets;
    margin = `won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}`;
  } else if (team1Innings.totalRuns > team2Innings.totalRuns) {
    winnerId = firstBattingTeam.id;
    const runMargin = team1Innings.totalRuns - team2Innings.totalRuns;
    margin = `won by ${runMargin} run${runMargin === 1 ? '' : 's'}`;
  } else {
    winnerId = firstBattingTeam.id; // Super over tie-breaker
    margin = 'won in Super Over thriller!';
  }

  // Find Player of the Match
  const allBatting = [...team1Innings.battingScorecard, ...team2Innings.battingScorecard];
  const allBowling = [...team1Innings.bowlingScorecard, ...team2Innings.bowlingScorecard];

  let pomId = allBatting[0]?.playerId || 'p1';
  let pomName = allBatting[0]?.playerName || 'Hero';
  let pomPerf = '';
  let highestScore = -1;

  allBatting.forEach((b) => {
    if (b.runs > highestScore) {
      highestScore = b.runs;
      pomId = b.playerId;
      pomName = b.playerName;
      pomPerf = `${b.runs} (${b.balls}) [${b.fours}x4, ${b.sixes}x6]`;
    }
  });

  allBowling.forEach((bw) => {
    if (bw.wickets >= 3 && bw.wickets * 25 > highestScore) {
      pomId = bw.playerId;
      pomName = bw.playerName;
      pomPerf = `${bw.wickets}/${bw.runs} in ${bw.overs} ov`;
    }
  });

  return {
    ...match,
    status: 'COMPLETED',
    tossWinnerId: tossWinner.id,
    tossDecision,
    team1Innings: firstBattingTeam.id === team1.id ? team1Innings : team2Innings,
    team2Innings: firstBattingTeam.id === team1.id ? team2Innings : team1Innings,
    winnerId,
    margin,
    playerOfTheMatchId: pomId,
    playerOfTheMatchName: pomName,
    playerOfTheMatchPerformance: pomPerf
  };
};

// Calculate Points Table & Net Run Rate
export const calculatePointsTable = (teams: Team[], matches: Match[]): PointsTableEntry[] => {
  const tableMap: Record<string, PointsTableEntry> = {};

  teams.forEach((t) => {
    tableMap[t.id] = {
      teamId: t.id,
      teamName: t.name,
      shortName: t.shortName,
      primaryColor: t.primaryColor,
      played: 0,
      won: 0,
      lost: 0,
      tied: 0,
      points: 0,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
      nrr: 0
    };
  });

  matches.forEach((m) => {
    // Only LEAGUE matches count toward the official points table!
    if (
      m.stage === 'PLAYOFF' ||
      m.stage === 'FINAL' ||
      m.id.includes('playoff') ||
      m.roundName.toLowerCase().includes('qualifier') ||
      m.roundName.toLowerCase().includes('eliminator') ||
      m.roundName.toLowerCase().includes('final')
    ) {
      return;
    }
    if (m.status !== 'COMPLETED' || !m.team1Innings || !m.team2Innings) return;

    const t1Entry = tableMap[m.team1Id];
    const t2Entry = tableMap[m.team2Id];
    if (!t1Entry || !t2Entry) return;

    t1Entry.played += 1;
    t2Entry.played += 1;

    t1Entry.runsScored += m.team1Innings.totalRuns;
    t1Entry.oversFaced += Math.max(1, Math.floor(m.team1Innings.ballsBowled / 6));
    t1Entry.runsConceded += m.team2Innings.totalRuns;
    t1Entry.oversBowled += Math.max(1, Math.floor(m.team2Innings.ballsBowled / 6));

    t2Entry.runsScored += m.team2Innings.totalRuns;
    t2Entry.oversFaced += Math.max(1, Math.floor(m.team2Innings.ballsBowled / 6));
    t2Entry.runsConceded += m.team1Innings.totalRuns;
    t2Entry.oversBowled += Math.max(1, Math.floor(m.team1Innings.ballsBowled / 6));

    if (m.winnerId === m.team1Id) {
      t1Entry.won += 1;
      t1Entry.points += 2;
      t2Entry.lost += 1;
    } else if (m.winnerId === m.team2Id) {
      t2Entry.won += 1;
      t2Entry.points += 2;
      t1Entry.lost += 1;
    } else {
      t1Entry.tied += 1;
      t1Entry.points += 1;
      t2Entry.tied += 1;
      t2Entry.points += 1;
    }
  });

  const list = Object.values(tableMap).map((entry) => {
    const forRate = entry.oversFaced > 0 ? entry.runsScored / entry.oversFaced : 0;
    const againstRate = entry.oversBowled > 0 ? entry.runsConceded / entry.oversBowled : 0;
    entry.nrr = Number((forRate - againstRate).toFixed(3));
    return entry;
  });

  // Sort by Points, then by NRR, then by total wins
  list.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;
    return b.won - a.won;
  });

  return list;
};

// Evaluates league completion and determines / progresses IPL Playoffs dynamically based on the final Points Table
export const checkAndProgressPlayoffs = (room: RoomState): RoomState => {
  const matches = [...room.matches];
  const leagueMatches = matches.filter(
    (m) =>
      m.stage === 'LEAGUE' ||
      (!m.stage &&
        !m.id.includes('playoff') &&
        !m.roundName.toLowerCase().includes('qualifier') &&
        !m.roundName.toLowerCase().includes('eliminator') &&
        !m.roundName.toLowerCase().includes('final'))
  );

  if (leagueMatches.length === 0) return room;

  const allLeagueCompleted = leagueMatches.every((m) => m.status === 'COMPLETED');
  const existingPlayoffs = matches.filter(
    (m) => m.stage === 'PLAYOFF' || m.stage === 'FINAL' || m.id.includes('playoff')
  );

  // 1. If all league matches are done and playoffs have not been unlocked yet:
  if (allLeagueCompleted && existingPlayoffs.length === 0) {
    const standings = calculatePointsTable(room.teams, matches);
    if (standings.length < 4) return room;

    const rank1 = standings[0];
    const rank2 = standings[1];
    const rank3 = standings[2];
    const rank4 = standings[3];

    const pitch = room.pitchCondition || 'BALANCED';

    // 1. Qualifier 1: Rank 1 vs Rank 2 (Winner goes to Grand Final, Loser to Qualifier 2)
    const q1: Match = {
      id: 'match-playoff-q1',
      roundNumber: 2,
      roundName: 'Qualifier 1 (Rank 1 vs Rank 2)',
      stage: 'PLAYOFF',
      playoffType: 'QUALIFIER_1',
      team1Id: rank1.teamId,
      team2Id: rank2.teamId,
      status: 'SCHEDULED',
      pitchCondition: pitch,
      currentInnings: 1
    };

    // 2. Eliminator: Rank 3 vs Rank 4 (Winner goes to Qualifier 2, Loser is eliminated)
    const elim: Match = {
      id: 'match-playoff-elim',
      roundNumber: 2,
      roundName: 'Eliminator (Rank 3 vs Rank 4)',
      stage: 'PLAYOFF',
      playoffType: 'ELIMINATOR',
      team1Id: rank3.teamId,
      team2Id: rank4.teamId,
      status: 'SCHEDULED',
      pitchCondition: pitch,
      currentInnings: 1
    };

    // 3. Qualifier 2: Loser Q1 vs Winner Eliminator (Unlocked when Q1 & Eliminator complete)
    const q2: Match = {
      id: 'match-playoff-q2',
      roundNumber: 3,
      roundName: 'Qualifier 2 (Loser Q1 vs Winner Eliminator)',
      stage: 'PLAYOFF',
      playoffType: 'QUALIFIER_2',
      team1Id: '',
      team2Id: '',
      placeholderTeam1Text: 'Loser of Qualifier 1',
      placeholderTeam2Text: 'Winner of Eliminator',
      status: 'SCHEDULED',
      pitchCondition: pitch,
      currentInnings: 1
    };

    // 4. IPL Grand Final: Winner Q1 vs Winner Q2 (Unlocked when Q1 & Q2 complete)
    const finalMatch: Match = {
      id: 'match-playoff-final',
      roundNumber: 4,
      roundName: 'IPL Championship Final (Winner Q1 vs Winner Q2)',
      stage: 'FINAL',
      playoffType: 'FINAL',
      team1Id: '',
      team2Id: '',
      placeholderTeam1Text: 'Winner of Qualifier 1',
      placeholderTeam2Text: 'Winner of Qualifier 2',
      status: 'SCHEDULED',
      pitchCondition: pitch,
      currentInnings: 1
    };

    const announcementLog = {
      id: `log-playoffs-${Date.now()}`,
      timestamp: Date.now(),
      type: 'ANNOUNCEMENT' as const,
      playerId: 'playoffs-unlocked',
      playerName: 'Playoffs Unlocked',
      amount: 0,
      message: `🏆 LEAGUE STAGE COMPLETE! Points table finalized: 1. ${rank1.shortName}, 2. ${rank2.shortName}, 3. ${rank3.shortName}, 4. ${rank4.shortName} have qualified for the IPL Playoffs! Qualifier 1: ${rank1.shortName} vs ${rank2.shortName} | Eliminator: ${rank3.shortName} vs ${rank4.shortName}.`
    };

    return {
      ...room,
      matches: [...matches, q1, elim, q2, finalMatch],
      auctionLogs: [announcementLog, ...(room.auctionLogs || []).slice(0, 48)],
      lastUpdated: Date.now()
    };
  }

  // 2. If playoffs exist, dynamically advance Qualifier 2 and Final as feeder matches complete
  if (existingPlayoffs.length > 0) {
    let matchesChanged = false;
    const extraLogs: any[] = [];

    const q1 = matches.find((m) => m.playoffType === 'QUALIFIER_1' || m.id === 'match-playoff-q1');
    const elim = matches.find((m) => m.playoffType === 'ELIMINATOR' || m.id === 'match-playoff-elim');
    const q2 = matches.find((m) => m.playoffType === 'QUALIFIER_2' || m.id === 'match-playoff-q2');
    const finalMatch = matches.find((m) => m.playoffType === 'FINAL' || m.id === 'match-playoff-final');

    // Update Qualifier 2 once Q1 and Eliminator are done
    if (q1 && elim && q2 && q1.status === 'COMPLETED' && elim.status === 'COMPLETED') {
      const q1LoserId = q1.winnerId === q1.team1Id ? q1.team2Id : q1.team1Id;
      const elimWinnerId = elim.winnerId;

      if (q1LoserId && elimWinnerId && (q2.team1Id !== q1LoserId || q2.team2Id !== elimWinnerId)) {
        const t1 = room.teams.find((t) => t.id === q1LoserId);
        const t2 = room.teams.find((t) => t.id === elimWinnerId);

        q2.team1Id = q1LoserId;
        q2.team2Id = elimWinnerId;
        q2.placeholderTeam1Text = undefined;
        q2.placeholderTeam2Text = undefined;
        matchesChanged = true;

        extraLogs.push({
          id: `log-q2-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ANNOUNCEMENT',
          playerId: 'q2-lineup',
          playerName: 'Qualifier 2 Confirmed',
          amount: 0,
          message: `🔥 QUALIFIER 2 CONFIRMED: ${t1?.shortName || 'Team 1'} vs ${t2?.shortName || 'Team 2'}! Winner books the final ticket to the IPL Championship Final.`
        });
      }
    }

    // Update Grand Final once Q1 and Q2 are done
    if (q1 && q2 && finalMatch && q1.status === 'COMPLETED' && q2.status === 'COMPLETED') {
      const q1WinnerId = q1.winnerId;
      const q2WinnerId = q2.winnerId;

      if (q1WinnerId && q2WinnerId && (finalMatch.team1Id !== q1WinnerId || finalMatch.team2Id !== q2WinnerId)) {
        const t1 = room.teams.find((t) => t.id === q1WinnerId);
        const t2 = room.teams.find((t) => t.id === q2WinnerId);

        finalMatch.team1Id = q1WinnerId;
        finalMatch.team2Id = q2WinnerId;
        finalMatch.placeholderTeam1Text = undefined;
        finalMatch.placeholderTeam2Text = undefined;
        matchesChanged = true;

        extraLogs.push({
          id: `log-final-${Date.now()}`,
          timestamp: Date.now(),
          type: 'ANNOUNCEMENT',
          playerId: 'final-lineup',
          playerName: 'Grand Final Set',
          amount: 0,
          message: `👑 IPL CHAMPIONSHIP GRAND FINAL: ${t1?.shortName || 'Team 1'} vs ${t2?.shortName || 'Team 2'}! The ultimate battle for the IPL Trophy.`
        });
      }
    }

    // When Grand Final completes, crown champion
    if (finalMatch && finalMatch.status === 'COMPLETED' && room.status !== 'COMPLETED') {
      const champ = room.teams.find((t) => t.id === finalMatch.winnerId);
      extraLogs.push({
        id: `log-champ-${Date.now()}`,
        timestamp: Date.now(),
        type: 'ANNOUNCEMENT',
        playerId: 'champion',
        playerName: 'IPL Champions',
        amount: 50000000,
        message: `🎉 CHAMPIONS OF THE IPL: ${champ?.name || 'Grand Champions'} lift the prestigious IPL Trophy! ₹5.00 Cr championship bonus awarded!`
      });

      return {
        ...room,
        status: 'COMPLETED',
        matches: [...matches],
        auctionLogs: [...extraLogs, ...(room.auctionLogs || []).slice(0, 48)],
        lastUpdated: Date.now()
      };
    }

    if (matchesChanged) {
      return {
        ...room,
        matches: [...matches],
        auctionLogs: [...extraLogs, ...(room.auctionLogs || []).slice(0, 48)],
        lastUpdated: Date.now()
      };
    }
  }

  return room;
};

// Calculate Orange Cap (Top Run Scorers) & Purple Cap (Top Wicket Takers)
export const getTournamentCapLeaders = (matches: Match[]) => {
  const runScorers: Record<string, { playerName: string; teamName: string; runs: number; strikeRate: number; matches: number }> = {};
  const wicketTakers: Record<string, { playerName: string; teamName: string; wickets: number; economy: number; runs: number; overs: number }> = {};

  matches.forEach((m) => {
    if (m.status !== 'COMPLETED') return;
    [m.team1Innings, m.team2Innings].forEach((inn) => {
      if (!inn) return;
      inn.battingScorecard.forEach((b) => {
        if (!runScorers[b.playerId]) {
          runScorers[b.playerId] = {
            playerName: b.playerName,
            teamName: inn.teamName,
            runs: 0,
            strikeRate: b.strikeRate,
            matches: 0
          };
        }
        runScorers[b.playerId].runs += b.runs;
        runScorers[b.playerId].matches += 1;
      });

      inn.bowlingScorecard.forEach((bw) => {
        if (!wicketTakers[bw.playerId]) {
          wicketTakers[bw.playerId] = {
            playerName: bw.playerName,
            teamName: inn.teamName,
            wickets: 0,
            economy: bw.economy,
            runs: 0,
            overs: 0
          };
        }
        wicketTakers[bw.playerId].wickets += bw.wickets;
        wicketTakers[bw.playerId].runs += bw.runs;
        wicketTakers[bw.playerId].overs += bw.overs;
      });
    });
  });

  const orangeCapList = Object.values(runScorers).sort((a, b) => b.runs - a.runs);
  const purpleCapList = Object.values(wicketTakers).sort((a, b) => b.wickets - a.wickets);

  return {
    orangeCapLeader: orangeCapList[0] || null,
    orangeCapTop5: orangeCapList.slice(0, 5),
    purpleCapLeader: purpleCapList[0] || null,
    purpleCapTop5: purpleCapList.slice(0, 5)
  };
};

// Calculate comprehensive performance-based prize money for a franchise
export const calculateTeamMatchPrize = (
  match: Match,
  team: Team,
  opponentTeam: Team,
  isTeam1: boolean
): MatchPrizeBreakdown => {
  const isWinner = match.winnerId === team.id;
  const isTie = !match.winnerId;

  // Base Match Result Prize
  let basePrize = 7500000; // ₹75 Lakhs minimum fighting participation prize
  if (isWinner) {
    basePrize = 25000000; // ₹2.50 Cr for winning the match
  } else if (isTie) {
    basePrize = 15000000; // ₹1.50 Cr for tied thriller
  }

  // Identify innings
  const teamInnings = isTeam1 ? match.team1Innings : match.team2Innings;
  const opponentInnings = isTeam1 ? match.team2Innings : match.team1Innings;

  const bonuses: PrizeBonusItem[] = [];

  // 1. Batting Team Totals
  if (teamInnings) {
    if (teamInnings.totalRuns >= 200) {
      bonuses.push({
        category: 'BATTING',
        label: `Explosive 200+ Team Total (${teamInnings.totalRuns}/${teamInnings.totalWickets})`,
        amount: 5000000 // ₹50 L
      });
    } else if (teamInnings.totalRuns >= 175) {
      bonuses.push({
        category: 'BATTING',
        label: `Commanding 175+ Team Total (${teamInnings.totalRuns}/${teamInnings.totalWickets})`,
        amount: 2500000 // ₹25 L
      });
    }

    // Individual Batting Milestones
    teamInnings.battingScorecard.forEach((b) => {
      if (b.runs >= 100) {
        bonuses.push({
          category: 'BATTING',
          label: `Century Milestone: ${b.playerName} (${b.runs} off ${b.balls})`,
          amount: 4000000 // ₹40 L
        });
      } else if (b.runs >= 50) {
        bonuses.push({
          category: 'BATTING',
          label: `Half-Century Milestone: ${b.playerName} (${b.runs} off ${b.balls})`,
          amount: 1500000 // ₹15 L
        });
      }
    });

    // Team Sixes Power
    const totalSixes = teamInnings.battingScorecard.reduce((sum, b) => sum + b.sixes, 0);
    if (totalSixes >= 8) {
      bonuses.push({
        category: 'BATTING',
        label: `Maximums Artillery (${totalSixes} Sixes Hit)`,
        amount: 1500000 // ₹15 L
      });
    }
  }

  // 2. Bowling Dominance (from opponent innings where team bowled)
  if (opponentInnings) {
    const oppWickets = opponentInnings.totalWickets;
    if (oppWickets === 10) {
      bonuses.push({
        category: 'BOWLING',
        label: 'Bowling Masterclass (All 10 Wickets Taken)',
        amount: 4000000 // ₹40 L
      });
    } else if (oppWickets >= 7) {
      bonuses.push({
        category: 'BOWLING',
        label: `Wicket Hunters Strike (${oppWickets} Wickets Taken)`,
        amount: 2000000 // ₹20 L
      });
    }

    // Stifling Economy Defense
    if (opponentInnings.totalRuns < 140 && (opponentInnings.oversCompleted >= 18 || oppWickets === 10)) {
      bonuses.push({
        category: 'BOWLING',
        label: `Stifling Defense (Opponent Held to ${opponentInnings.totalRuns} Runs)`,
        amount: 2500000 // ₹25 L
      });
    }

    // Individual Bowling hauls
    opponentInnings.bowlingScorecard.forEach((bw) => {
      if (bw.wickets >= 4) {
        bonuses.push({
          category: 'BOWLING',
          label: `Bowling Heroics: ${bw.playerName} (${bw.wickets}/${bw.runs} in ${bw.overs} ov)`,
          amount: 3000000 // ₹30 L
        });
      }
    });
  }

  // 3. Player of the Match
  const potmInThisTeam = team.players.some((p) => p.id === match.playerOfTheMatchId);
  if (potmInThisTeam && match.playerOfTheMatchName) {
    bonuses.push({
      category: 'POTM',
      label: `Player of the Match Award: ${match.playerOfTheMatchName}`,
      amount: 3500000 // ₹35 L
    });
  }

  // 4. Decisive Victory Margin
  if (isWinner && match.margin) {
    if (match.margin.includes('run')) {
      const runs = parseInt(match.margin.replace(/[^0-9]/g, ''), 10) || 0;
      if (runs >= 30) {
        bonuses.push({
          category: 'RESULT',
          label: `Dominant Win by ${runs} Runs`,
          amount: 2500000 // ₹25 L
        });
      }
    } else if (match.margin.includes('wicket')) {
      const w = parseInt(match.margin.replace(/[^0-9]/g, ''), 10) || 0;
      if (w >= 7) {
        bonuses.push({
          category: 'RESULT',
          label: `Clinical Win by ${w} Wickets`,
          amount: 2500000 // ₹25 L
        });
      }
    } else if (match.margin.toLowerCase().includes('super over')) {
      bonuses.push({
        category: 'RESULT',
        label: 'Super Over Thriller Triumph',
        amount: 1500000 // ₹15 L
      });
    }
  }

  // 5. Championship / Playoff High Stakes Multiplier
  const roundLower = match.roundName.toLowerCase();
  if (roundLower.includes('final') && !roundLower.includes('semi') && !roundLower.includes('quarter')) {
    if (isWinner) {
      bonuses.push({
        category: 'CHAMPIONSHIP',
        label: 'IPL Championship Grand Trophy Purse',
        amount: 100000000 // ₹10.00 Cr champion reward!
      });
    } else {
      bonuses.push({
        category: 'CHAMPIONSHIP',
        label: 'IPL Grand Finalist Podium Award',
        amount: 50000000 // ₹5.00 Cr finalist reward!
      });
    }
  } else if (roundLower.includes('semifinal') || roundLower.includes('qualifier')) {
    bonuses.push({
      category: 'CHAMPIONSHIP',
      label: 'Playoffs High-Stakes Bonus',
      amount: 10000000 // ₹1.00 Cr playoff incentive
    });
  }

  const performanceTotal = bonuses.reduce((acc, b) => acc + b.amount, 0);
  const totalPrize = basePrize + performanceTotal;

  return {
    teamId: team.id,
    teamName: team.name,
    shortName: team.shortName,
    basePrize,
    performanceBonuses: bonuses,
    totalPrize,
    previousPurse: team.budget,
    newPurse: team.budget + totalPrize
  };
};

// Apply match prize money to franchise budgets, user account wallet, and room state
export const applyMatchPrizeToRoom = (
  room: RoomState,
  completedMatch: Match,
  currentUserId?: string
): {
  updatedRoom: RoomState;
  finalizedMatch: Match;
  team1Prize: MatchPrizeBreakdown;
  team2Prize: MatchPrizeBreakdown;
} => {
  const team1 = room.teams.find((t) => t.id === completedMatch.team1Id);
  const team2 = room.teams.find((t) => t.id === completedMatch.team2Id);

  if (!team1 || !team2) {
    return {
      updatedRoom: room,
      finalizedMatch: completedMatch,
      team1Prize: completedMatch.team1Prize || {
        teamId: completedMatch.team1Id,
        teamName: 'Team 1',
        shortName: 'T1',
        basePrize: 0,
        performanceBonuses: [],
        totalPrize: 0,
        previousPurse: 0,
        newPurse: 0
      },
      team2Prize: completedMatch.team2Prize || {
        teamId: completedMatch.team2Id,
        teamName: 'Team 2',
        shortName: 'T2',
        basePrize: 0,
        performanceBonuses: [],
        totalPrize: 0,
        previousPurse: 0,
        newPurse: 0
      }
    };
  }

  // If already awarded, return existing
  if (completedMatch.prizeAwarded && completedMatch.team1Prize && completedMatch.team2Prize) {
    return {
      updatedRoom: room,
      finalizedMatch: completedMatch,
      team1Prize: completedMatch.team1Prize,
      team2Prize: completedMatch.team2Prize
    };
  }

  // Calculate prizes based on actual performance
  const team1Prize = calculateTeamMatchPrize(completedMatch, team1, team2, true);
  const team2Prize = calculateTeamMatchPrize(completedMatch, team2, team1, false);

  const finalizedMatch: Match = {
    ...completedMatch,
    status: 'COMPLETED',
    team1Prize,
    team2Prize,
    prizeAwarded: true
  };

  // Add prize money to team purse budgets in the room
  const updatedTeams = room.teams.map((t) => {
    if (t.id === team1.id) {
      return { ...t, budget: t.budget + team1Prize.totalPrize };
    }
    if (t.id === team2.id) {
      return { ...t, budget: t.budget + team2Prize.totalPrize };
    }
    return t;
  });

  const isGrandFinal = completedMatch.roundName.toLowerCase().includes('final') &&
    !completedMatch.roundName.toLowerCase().includes('semi') &&
    !completedMatch.roundName.toLowerCase().includes('quarter');

  // Credit user's persistent wallet if user's franchise participated
  if (currentUserId) {
    const userFranchise = room.teams.find((t) => t.userId === currentUserId || t.isUserTeam);
    if (userFranchise) {
      if (userFranchise.id === team1.id) {
        const isUserWinner = completedMatch.winnerId === team1.id;
        creditUserPurse(currentUserId, team1Prize.totalPrize, isUserWinner && isGrandFinal ? 1 : 0);
      } else if (userFranchise.id === team2.id) {
        const isUserWinner = completedMatch.winnerId === team2.id;
        creditUserPurse(currentUserId, team2Prize.totalPrize, isUserWinner && isGrandFinal ? 1 : 0);
      }
    }
  }

  // Record broadcast log in auction / room feed
  const prizeLog = {
    id: `log-prize-${Date.now()}`,
    timestamp: Date.now(),
    type: 'ANNOUNCEMENT' as const,
    playerId: completedMatch.playerOfTheMatchId || 'match-prize',
    playerName: completedMatch.playerOfTheMatchName || 'Prize Payout',
    amount: team1Prize.totalPrize + team2Prize.totalPrize,
    message: `💰 MATCH REWARDS ADDED TO PURSE: ${team1.shortName} earned ${formatCurrency(team1Prize.totalPrize)} & ${team2.shortName} earned ${formatCurrency(team2Prize.totalPrize)}!`
  };

  const updatedMatches = room.matches.map((m) =>
    m.id === finalizedMatch.id ? finalizedMatch : m
  );

  const intermediateRoom: RoomState = {
    ...room,
    teams: updatedTeams,
    matches: updatedMatches,
    auctionLogs: [prizeLog, ...(room.auctionLogs || []).slice(0, 48)],
    lastUpdated: Date.now()
  };

  const updatedRoom = checkAndProgressPlayoffs(intermediateRoom);

  return {
    updatedRoom,
    finalizedMatch,
    team1Prize,
    team2Prize
  };
};
