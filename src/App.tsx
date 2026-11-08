/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserAccount, RoomState } from './types/cricket';
import {
  getCurrentUser,
  setCurrentUser,
  getActiveRoomCode,
  setActiveRoomCode,
  getRoomByCode,
  getStoredRooms,
  saveRoom,
  subscribeToRoomBroadcast,
  subscribeToCloudRoom
} from './services/storage';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { LobbyView } from './components/LobbyView';
import { AuctionArena } from './components/AuctionArena';
import { SquadHub } from './components/SquadHub';
import { MatchCenter } from './components/MatchCenter';
import { TournamentTable } from './components/TournamentTable';

export default function App() {
  const [currentUser, setCurrentUserState] = useState<UserAccount | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState<RoomState | null>(null);
  const [activeTab, setActiveTab] = useState<'LOBBY' | 'AUCTION' | 'SQUADS' | 'MATCHES' | 'STANDINGS'>('LOBBY');

  // Load user session on mount
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUserState(user);
    }

    // Load active room if exists
    const roomCode = getActiveRoomCode();
    if (roomCode) {
      getRoomByCode(roomCode).then((room) => {
        if (room) {
          setActiveRoom(room);
          setActiveTab('AUCTION');
        }
      });
    } else {
      // Check if any rooms exist
      const allRooms = getStoredRooms();
      const firstRoomKey = Object.keys(allRooms)[0];
      if (firstRoomKey) {
        setActiveRoom(allRooms[firstRoomKey]);
      }
    }
  }, []);

  // Subscribe to real-time BroadcastChannel & Cloud Firestore updates
  useEffect(() => {
    if (!activeRoom) return;

    // 1. Instant same-device cross-tab BroadcastChannel
    const unsubscribeBroadcast = subscribeToRoomBroadcast((updatedRoom) => {
      if (activeRoom.code === updatedRoom.code) {
        setActiveRoom(updatedRoom);
      }
    });

    // 2. Real-time Cloud Firestore listener for cross-device multiplayer
    const unsubscribeCloud = subscribeToCloudRoom(activeRoom.code, (updatedRoom) => {
      if (activeRoom.code === updatedRoom.code) {
        setActiveRoom(updatedRoom);
      }
    });

    return () => {
      unsubscribeBroadcast();
      unsubscribeCloud();
    };
  }, [activeRoom?.code]);

  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUserState(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentUserState(null);
  };

  const handleEnterRoom = (room: RoomState) => {
    setActiveRoom(room);
    setActiveRoomCode(room.code);
    setActiveTab('AUCTION');
  };

  const handleUpdateRoom = (updated: RoomState) => {
    setActiveRoom(updated);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative selection:bg-amber-400 selection:text-slate-950 font-sans">
      
      {/* Stadium Ambient Lighting & Subtle Backdrop */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-15 bg-cover bg-center mix-blend-screen"
        style={{
          backgroundImage: `url('/src/assets/images/ipl_stadium_atmosphere_1794069365422.jpg')`
        }}
      />
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-slate-950/80 via-slate-950/95 to-slate-950" />

      {/* Top Bar Navigation */}
      <div className="relative z-20">
        <Navbar
          currentUser={currentUser}
          activeRoom={activeRoom}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 pb-12">
        {activeTab === 'LOBBY' && (
          <LobbyView
            currentUser={currentUser}
            activeRoom={activeRoom}
            onEnterRoom={handleEnterRoom}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        )}

        {activeTab === 'AUCTION' && activeRoom && (
          <AuctionArena
            room={activeRoom}
            onUpdateRoom={handleUpdateRoom}
            onNavigateToSquads={() => setActiveTab('SQUADS')}
          />
        )}

        {activeTab === 'SQUADS' && activeRoom && (
          <SquadHub
            room={activeRoom}
            onUpdateRoom={handleUpdateRoom}
            onNavigateToMatches={() => setActiveTab('MATCHES')}
          />
        )}

        {activeTab === 'MATCHES' && activeRoom && (
          <MatchCenter
            room={activeRoom}
            onUpdateRoom={handleUpdateRoom}
            onNavigateToStandings={() => setActiveTab('STANDINGS')}
          />
        )}

        {activeTab === 'STANDINGS' && activeRoom && (
          <TournamentTable
            room={activeRoom}
            onNavigateToMatches={() => setActiveTab('MATCHES')}
          />
        )}
      </main>

      {/* Quiet, Clean Editorial Footer adhering to guidelines */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400 font-display">IPL AUCTION ARENA</span>
            <span>·</span>
            <span>Premier League Auction & Match Simulation</span>
          </div>
          <div>
            <span>Starting Bonus Base Support: ₹10,000,000</span>
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

    </div>
  );
}
