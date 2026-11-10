/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { UserAccount, RoomState } from './types/cricket';
import {
  getCurrentUser,
  logoutUser,
  getActiveRoomCode,
  setActiveRoomCode,
  getRoomByCode,
  getStoredRooms,
  getUserActiveRoomCode,
  getUserRooms,
  saveRoom,
  subscribeToRoomBroadcast,
  subscribeToCloudRoom
} from './services/storage';
import { prepareRoomForExit, prepareRoomForRejoin } from './services/auctionEngine';
import { Navbar } from './components/Navbar';
import { AuthScreen } from './components/AuthScreen';
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
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Load user session and account progress on initial mount
  useEffect(() => {
    const user = getCurrentUser();
    if (user) {
      setCurrentUserState(user);
      // Retrieve progress saved specifically in this user's account
      const userActiveCode = getUserActiveRoomCode(user.id) || getActiveRoomCode();
      if (userActiveCode) {
        getRoomByCode(userActiveCode).then((room) => {
          if (room) {
            const readyRoom = prepareRoomForRejoin(room);
            setActiveRoom(readyRoom);
            saveRoom(readyRoom);
            setActiveTab('AUCTION');
          }
          setIsCheckingSession(false);
        }).catch(() => {
          setIsCheckingSession(false);
        });
      } else {
        const userRooms = getUserRooms(user.id);
        const roomKeys = Object.keys(userRooms);
        if (roomKeys.length > 0) {
          const readyRoom = prepareRoomForRejoin(userRooms[roomKeys[0]]);
          setActiveRoom(readyRoom);
          saveRoom(readyRoom);
        }
        setIsCheckingSession(false);
      }
    } else {
      // User is not logged in: clear active room so no progress is leaked
      setCurrentUserState(null);
      setActiveRoom(null);
      setIsCheckingSession(false);
    }
  }, []);

  // Subscribe to real-time BroadcastChannel & Cloud Firestore updates for the active room
  useEffect(() => {
    if (!currentUser || !activeRoom) return;

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
  }, [currentUser?.id, activeRoom?.code]);

  // Handle successful login or registration
  const handleAuthSuccess = (user: UserAccount) => {
    setCurrentUserState(user);
    // Restore progress saved in this specific account
    const userActiveCode = getUserActiveRoomCode(user.id);
    if (userActiveCode) {
      getRoomByCode(userActiveCode).then((room) => {
        if (room) {
          const readyRoom = prepareRoomForRejoin(room);
          setActiveRoom(readyRoom);
          saveRoom(readyRoom);
          setActiveTab('AUCTION');
        } else {
          setActiveTab('LOBBY');
        }
      });
    } else {
      const userRooms = getUserRooms(user.id);
      const roomKeys = Object.keys(userRooms);
      if (roomKeys.length > 0) {
        const readyRoom = prepareRoomForRejoin(userRooms[roomKeys[0]]);
        setActiveRoom(readyRoom);
        saveRoom(readyRoom);
        setActiveTab('AUCTION');
      } else {
        setActiveRoom(null);
        setActiveTab('LOBBY');
      }
    }
  };

  // Immediate logout: safely saves active auction state before clearing session
  const handleLogout = () => {
    if (activeRoom && activeRoom.status === 'AUCTION') {
      const exitedRoom = prepareRoomForExit(activeRoom);
      saveRoom(exitedRoom);
    }
    logoutUser();
    setCurrentUserState(null);
    setActiveRoom(null);
    setActiveTab('LOBBY');
  };

  // Re-enter or start room: guarantees starting from the exact same player lot
  const handleEnterRoom = (room: RoomState) => {
    const readyRoom = prepareRoomForRejoin(room);
    setActiveRoom(readyRoom);
    setActiveRoomCode(readyRoom.code);
    saveRoom(readyRoom);
    setActiveTab('AUCTION');
  };

  // Leaving auction to Lobby: freezes room at current lot
  const handleLeaveAuction = () => {
    if (activeRoom && activeRoom.status === 'AUCTION') {
      const exitedRoom = prepareRoomForExit(activeRoom);
      setActiveRoom(exitedRoom);
      saveRoom(exitedRoom);
    }
    setActiveTab('LOBBY');
  };

  // Tab switching: freezes auction state when navigating away, restores when returning
  const handleTabChange = (newTab: 'LOBBY' | 'AUCTION' | 'SQUADS' | 'MATCHES' | 'STANDINGS') => {
    if (activeTab === 'AUCTION' && newTab !== 'AUCTION' && activeRoom && activeRoom.status === 'AUCTION') {
      const exitedRoom = prepareRoomForExit(activeRoom);
      setActiveRoom(exitedRoom);
      saveRoom(exitedRoom);
    } else if (newTab === 'AUCTION' && activeRoom && activeRoom.status === 'AUCTION') {
      const readyRoom = prepareRoomForRejoin(activeRoom);
      setActiveRoom(readyRoom);
      saveRoom(readyRoom);
    }
    setActiveTab(newTab);
  };

  const handleUpdateRoom = (updated: RoomState) => {
    setActiveRoom(updated);
    const freshUser = getCurrentUser();
    if (freshUser) {
      setCurrentUserState(freshUser);
    }
  };

  // While checking initial local session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          <span className="font-display font-bold text-amber-400 text-lg uppercase tracking-wider">
            Loading Franchise Arena...
          </span>
        </div>
      </div>
    );
  }

  // REQUIREMENT: If not logged in first, login and register, then only the app will open.
  // The moment logged out it will not show the progress, when logged in then only it will show the progress.
  if (!currentUser) {
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

        {/* Dedicated Auth Gate Screen */}
        <main className="relative z-10 flex-1 flex flex-col justify-center">
          <AuthScreen onSuccess={handleAuthSuccess} />
        </main>

        <footer className="relative z-10 border-t border-slate-900 bg-slate-950/90 py-4 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-400 font-display">IPL AUCTION ARENA</span>
              <span>·</span>
              <span>Authentication Gate &bull; Account Progress Shield</span>
            </div>
            <div>
              <span>Starting Bonus: ₹10,000,000 on registration</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Once authenticated: Render full IPL Auction & Tournament Arena
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
          setActiveTab={handleTabChange}
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
            onLeaveAuction={handleLeaveAuction}
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

      {/* Clean Editorial Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-400 font-display">IPL AUCTION ARENA</span>
            <span>·</span>
            <span>Premier League Auction & Match Simulation</span>
          </div>
          <div>
            <span className="text-amber-400/90 font-mono">
              Account: {currentUser.username} &bull; Progress Active
            </span>
          </div>
        </div>
      </footer>

      {/* Profile / Account Modal if triggered */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

    </div>
  );
}
