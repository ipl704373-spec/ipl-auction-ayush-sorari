/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserAccount, RoomState } from '../types/cricket';

const STORAGE_USERS_KEY = 'ipl_arena_users_v1';
const STORAGE_CURRENT_USER_KEY = 'ipl_arena_session_v1';
const STORAGE_ROOMS_KEY = 'ipl_arena_rooms_v1';
const STORAGE_ACTIVE_ROOM_KEY = 'ipl_arena_active_room_code_v1';

// BroadcastChannel for instant cross-tab sync
let roomBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    roomBroadcastChannel = new BroadcastChannel('ipl_auction_arena_channel');
  }
} catch {
  // BroadcastChannel not available or sandboxed
}

export const broadcastRoomUpdate = (room: RoomState) => {
  if (roomBroadcastChannel) {
    roomBroadcastChannel.postMessage({ type: 'ROOM_UPDATED', room });
  }
};

export const subscribeToRoomBroadcast = (onUpdate: (room: RoomState) => void) => {
  if (!roomBroadcastChannel) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'ROOM_UPDATED' && event.data?.room) {
      onUpdate(event.data.room);
    }
  };
  roomBroadcastChannel.addEventListener('message', handler);
  return () => {
    roomBroadcastChannel?.removeEventListener('message', handler);
  };
};

// Real-Time Cloud Firestore Room Listener across all devices
export const subscribeToCloudRoom = (roomCode: string, onUpdate: (room: RoomState) => void) => {
  try {
    const unsub = onSnapshot(
      doc(db, 'rooms', roomCode.toUpperCase()),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.stateJson) {
            try {
              const parsed: RoomState = JSON.parse(data.stateJson);
              onUpdate(parsed);
            } catch {
              // json parse fallback
            }
          }
        }
      },
      (error) => {
        console.warn('Firestore room snapshot note:', error.message);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Firestore subscription fallback:', err);
    return () => {};
  }
};

// Users management
export const getUsers = (): UserAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveUsers = (users: UserAccount[]) => {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users', err);
  }
};

export const getCurrentUser = (): UserAccount | null => {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setCurrentUser = (user: UserAccount | null) => {
  try {
    if (user) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    }
  } catch (err) {
    console.error('Failed to set current user', err);
  }
};

export const registerUser = (
  username: string,
  password: string,
  securityQuestion: string,
  securityAnswer: string
): { success: boolean; error?: string; user?: UserAccount } => {
  const users = getUsers();
  const existing = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (existing) {
    return { success: false, error: 'Username already taken. Please choose another.' };
  }

  const newUser: UserAccount = {
    id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    username: username.trim(),
    passwordHash: btoa(password),
    securityQuestion,
    securityAnswer: securityAnswer.trim().toLowerCase(),
    purseBalance: 10000000, // ₹10,000,000 Starting Bonus
    trophiesWon: 0,
    matchesPlayed: 0,
    auctionsCompleted: 0,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  // Sync to Cloud Firestore asynchronously
  try {
    setDoc(doc(db, 'users', newUser.id), {
      uid: newUser.id,
      username: newUser.username,
      purseBalance: newUser.purseBalance,
      trophiesWon: newUser.trophiesWon,
      matchesPlayed: newUser.matchesPlayed,
      createdAt: newUser.createdAt
    }).catch(() => {});
  } catch {
    // Non-blocking
  }

  return { success: true, user: newUser };
};

export const loginUser = (
  username: string,
  password: string
): { success: boolean; error?: string; user?: UserAccount } => {
  const users = getUsers();
  const found = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.passwordHash === btoa(password)
  );

  if (!found) {
    return { success: false, error: 'Invalid username or password.' };
  }

  setCurrentUser(found);
  return { success: true, user: found };
};

export const recoverPassword = (
  username: string,
  securityAnswer: string,
  newPassword: string
): { success: boolean; error?: string } => {
  const users = getUsers();
  const index = users.findIndex((u) => u.username.toLowerCase() === username.trim().toLowerCase());

  if (index === -1) {
    return { success: false, error: 'Username not found.' };
  }

  if (users[index].securityAnswer !== securityAnswer.trim().toLowerCase()) {
    return { success: false, error: 'Incorrect answer to security question.' };
  }

  users[index].passwordHash = btoa(newPassword);
  saveUsers(users);
  return { success: true };
};

export const updateUserAccount = (updated: UserAccount) => {
  const users = getUsers();
  const idx = users.findIndex((u) => u.id === updated.id);
  if (idx !== -1) {
    users[idx] = updated;
    saveUsers(users);
  }
  const curr = getCurrentUser();
  if (curr && curr.id === updated.id) {
    setCurrentUser(updated);
  }

  // Cloud sync
  try {
    setDoc(doc(db, 'users', updated.id), {
      uid: updated.id,
      username: updated.username,
      purseBalance: updated.purseBalance,
      trophiesWon: updated.trophiesWon,
      matchesPlayed: updated.matchesPlayed,
      createdAt: updated.createdAt
    }, { merge: true }).catch(() => {});
  } catch {
    // non-blocking
  }
};

// Rooms Management
export const getStoredRooms = (): Record<string, RoomState> => {
  try {
    const raw = localStorage.getItem(STORAGE_ROOMS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveRoom = (room: RoomState) => {
  try {
    const rooms = getStoredRooms();
    room.lastUpdated = Date.now();
    rooms[room.code] = room;
    localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(rooms));
    broadcastRoomUpdate(room);

    // Persist to Cloud Firestore for cross-device live multiplayer
    setDoc(doc(db, 'rooms', room.code), {
      code: room.code,
      name: room.name,
      hostUserId: room.hostUserId,
      mode: room.mode,
      status: room.status,
      lastUpdated: room.lastUpdated,
      stateJson: JSON.stringify(room)
    }).catch((err) => {
      console.warn('Firestore room sync notice:', err.message);
    });
  } catch (err) {
    console.error('Failed to save room', err);
  }
};

export const getRoomByCode = async (code: string): Promise<RoomState | null> => {
  const rooms = getStoredRooms();
  const normalized = code.toUpperCase();
  if (rooms[normalized]) {
    return rooms[normalized];
  }

  // Check Cloud Firestore
  try {
    const snap = await getDoc(doc(db, 'rooms', normalized));
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.stateJson) {
        const parsed: RoomState = JSON.parse(data.stateJson);
        saveRoom(parsed); // cache locally
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Firestore fetch fallback:', err);
  }

  return null;
};

export const getActiveRoomCode = (): string | null => {
  return localStorage.getItem(STORAGE_ACTIVE_ROOM_KEY);
};

export const setActiveRoomCode = (code: string | null) => {
  if (code) {
    localStorage.setItem(STORAGE_ACTIVE_ROOM_KEY, code.toUpperCase());
  } else {
    localStorage.removeItem(STORAGE_ACTIVE_ROOM_KEY);
  }
};

// Generate unique 6-digit room code
export const generateRoomCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};
