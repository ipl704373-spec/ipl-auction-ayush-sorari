/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Team } from '../types/cricket';

export const OFFICIAL_FRANCHISES: Omit<Team, 'isUserTeam' | 'userId' | 'players'>[] = [
  {
    id: 'team-csk',
    name: 'Chennai Super Kings',
    shortName: 'CSK',
    primaryColor: '#FDB913',
    secondaryColor: '#0081E8',
    budget: 1000000000, // ₹100 Cr
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'VALUE_HUNTER'
  },
  {
    id: 'team-mi',
    name: 'Mumbai Indians',
    shortName: 'MI',
    primaryColor: '#004BA0',
    secondaryColor: '#D1AB3E',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'AGGRESSIVE'
  },
  {
    id: 'team-rcb',
    name: 'Royal Challengers Bengaluru',
    shortName: 'RCB',
    primaryColor: '#EC1C24',
    secondaryColor: '#1B1B1B',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'AGGRESSIVE'
  },
  {
    id: 'team-kkr',
    name: 'Kolkata Knight Riders',
    shortName: 'KKR',
    primaryColor: '#3A225D',
    secondaryColor: '#EDCE33',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'BALANCED'
  },
  {
    id: 'team-srh',
    name: 'Sunrisers Hyderabad',
    shortName: 'SRH',
    primaryColor: '#F26522',
    secondaryColor: '#111111',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'AGGRESSIVE'
  },
  {
    id: 'team-rr',
    name: 'Rajasthan Royals',
    shortName: 'RR',
    primaryColor: '#EA1A85',
    secondaryColor: '#001D48',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'VALUE_HUNTER'
  },
  {
    id: 'team-dc',
    name: 'Delhi Capitals',
    shortName: 'DC',
    primaryColor: '#004C93',
    secondaryColor: '#D71920',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'BALANCED'
  },
  {
    id: 'team-gt',
    name: 'Gujarat Titans',
    shortName: 'GT',
    primaryColor: '#1B2133',
    secondaryColor: '#C6A24E',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'BOWLING_FOCUS'
  },
  {
    id: 'team-lsg',
    name: 'Lucknow Super Giants',
    shortName: 'LSG',
    primaryColor: '#0057B8',
    secondaryColor: '#F36F21',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'BALANCED'
  },
  {
    id: 'team-pbks',
    name: 'Punjab Kings',
    shortName: 'PBKS',
    primaryColor: '#DD1F2D',
    secondaryColor: '#C4CED4',
    budget: 1000000000,
    initialBudget: 1000000000,
    isBot: true,
    botStrategy: 'AGGRESSIVE'
  }
];

export const formatCurrency = (amount: number): string => {
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr.toFixed(2).replace(/\.00$/, '')} Cr`;
  }
  if (amount >= 100000) {
    const lk = amount / 100000;
    return `₹${lk.toFixed(1).replace(/\.0$/, '')} Lakh`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

export const SECURITY_QUESTIONS = [
  'What is the name of your first cricket bat / sport gear?',
  'Who was your favourite cricket player growing up?',
  'What is your home cricket stadium or hometown?',
  'What is your childhood pet’s name?',
  'What is the name of your high school cricket team?'
];
