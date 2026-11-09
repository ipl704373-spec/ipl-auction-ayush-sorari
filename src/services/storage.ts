/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, setDoc, getDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserAccount, RoomState } from '../types/cricket';

const STORAGE_USERS_KEY = 'ipl_arena_users_v1';
const STORAGE_CURRENT_USER_KEY = 'ipl_arena_session_v1';

// Standard Firestore Error Handling conforming to Firebase Integration specifications
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    username?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = getCurrentUser();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.id ?? null,
      username: currentUser?.username ?? null,
    },
    operationType,
    path,
  };
  console.warn('Firestore Warning/Notice: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore is currently operating in offline mode.');
    }
  }
}

// Test connection on boot non-blockingly
if (typeof window !== 'undefined') {
  testFirestoreConnection().catch(() => {});
}

// Generate normalized safe user ID
export const generateUserId = (username: string): string => {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40);
  return `u_${clean || 'user'}`;
};

// Storage keys partitioned per user account
const getUserRoomsKey = (userId: string) => `ipl_arena_rooms_${userId}`;
const getUserActiveRoomKey = (userId: string) => `ipl_arena_active_room_${userId}`;

// BroadcastChannel for instant cross-tab sync
let roomBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    roomBroadcastChannel = new BroadcastChannel('ipl_auction_arena_channel');
  }
} catch {
  // BroadcastChannel sandboxed or not supported
}

export const broadcastRoomUpdate = (room: RoomState) => {
  if (roomBroadcastChannel) {
    try {
      roomBroadcastChannel.postMessage({ type: 'ROOM_UPDATED', room });
    } catch {
      // broadcast fallback
    }
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
        console.warn('Firestore room snapshot notice:', error.message);
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

export const logoutUser = () => {
  setCurrentUser(null);
};

// Register user with instant ₹10,000,000 Bonus
export const registerUser = async (
  username: string,
  password: string,
  securityQuestion: string,
  securityAnswer: string
): Promise<{ success: boolean; error?: string; user?: UserAccount }> => {
  const trimmed = username.trim();
  if (!trimmed || !password.trim()) {
    return { success: false, error: 'Username and password are required.' };
  }

  const userId = generateUserId(trimmed);
  const users = getUsers();
  const existingLocal = users.find((u) => u.username.toLowerCase() === trimmed.toLowerCase());
  if (existingLocal) {
    return { success: false, error: 'Username already registered on this device. Please sign in.' };
  }

  // Check Cloud Firestore for existing username
  try {
    const userDocRef = doc(db, 'users', userId);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return { success: false, error: 'Username is already taken by another franchise. Please choose another.' };
    }
  } catch {
    // offline or first run fallback
  }

  const newUser: UserAccount = {
    id: userId,
    username: trimmed,
    passwordHash: btoa(password),
    securityQuestion,
    securityAnswer: securityAnswer.trim().toLowerCase(),
    purseBalance: 10000000, // ₹10,000,000 Starting Bonus Base Support
    trophiesWon: 0,
    matchesPlayed: 0,
    auctionsCompleted: 0,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);

  // Sync to Cloud Firestore
  try {
    const userDocRef = doc(db, 'users', newUser.id);
    await setDoc(userDocRef, {
      uid: newUser.id,
      username: newUser.username,
      passwordHash: newUser.passwordHash,
      securityQuestion: newUser.securityQuestion,
      securityAnswer: newUser.securityAnswer,
      purseBalance: newUser.purseBalance,
      trophiesWon: newUser.trophiesWon,
      matchesPlayed: newUser.matchesPlayed,
      auctionsCompleted: newUser.auctionsCompleted,
      createdAt: newUser.createdAt,
    });
  } catch (err) {
    console.warn('Firestore user save notice:', err);
  }

  return { success: true, user: newUser };
};

// Credit prize money to user's persistent franchise purse and wallet
export const creditUserPurse = async (
  userId: string,
  amount: number,
  trophiesWonIncrement = 0
): Promise<UserAccount | null> => {
  if (amount <= 0 && trophiesWonIncrement <= 0) return null;

  const users = getUsers();
  const index = users.findIndex((u) => u.id === userId);
  let updatedUser: UserAccount | null = null;

  if (index !== -1) {
    users[index].purseBalance = (users[index].purseBalance || 0) + amount;
    users[index].trophiesWon = (users[index].trophiesWon || 0) + trophiesWonIncrement;
    users[index].matchesPlayed = (users[index].matchesPlayed || 0) + 1;
    updatedUser = users[index];
    saveUsers(users);
  }

  const current = getCurrentUser();
  if (current && current.id === userId) {
    const fresh: UserAccount = {
      ...current,
      purseBalance: (current.purseBalance || 0) + amount,
      trophiesWon: (current.trophiesWon || 0) + trophiesWonIncrement,
      matchesPlayed: (current.matchesPlayed || 0) + 1,
    };
    setCurrentUser(fresh);
    updatedUser = fresh;
  }

  // Sync to Cloud Firestore
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(
      userDocRef,
      {
        purseBalance: updatedUser?.purseBalance,
        trophiesWon: updatedUser?.trophiesWon,
        matchesPlayed: updatedUser?.matchesPlayed,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore purse credit sync notice:', err);
  }

  return updatedUser;
};

// Login user: validates credentials and restores progress
export const loginUser = async (
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: UserAccount }> => {
  const trimmed = username.trim();
  const users = getUsers();
  const pwdHash = btoa(password);

  // 1. Check local users first
  let found = users.find(
    (u) => u.username.toLowerCase() === trimmed.toLowerCase() && u.passwordHash === pwdHash
  );

  // 2. If not found locally, try fetching from Cloud Firestore
  if (!found) {
    try {
      const userId = generateUserId(trimmed);
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) {
        const cloudData = snap.data();
        if (cloudData && cloudData.passwordHash === pwdHash) {
          found = {
            id: cloudData.uid || userId,
            username: cloudData.username || trimmed,
            passwordHash: cloudData.passwordHash,
            securityQuestion: cloudData.securityQuestion || '',
            securityAnswer: cloudData.securityAnswer || '',
            purseBalance: cloudData.purseBalance ?? 10000000,
            trophiesWon: cloudData.trophiesWon ?? 0,
            matchesPlayed: cloudData.matchesPlayed ?? 0,
            auctionsCompleted: cloudData.auctionsCompleted ?? 0,
            createdAt: cloudData.createdAt || new Date().toISOString(),
          };

          // Cache locally
          const updatedUsers = users.filter((u) => u.id !== found!.id);
          updatedUsers.push(found);
          saveUsers(updatedUsers);

          // If user had an activeRoomCode in Firestore, restore it
          if (cloudData.activeRoomCode) {
            setUserActiveRoomCode(found.id, cloudData.activeRoomCode);
          }
        }
      }
    } catch (err) {
      console.warn('Cloud login fetch notice:', err);
    }
  }

  if (!found) {
    return { success: false, error: 'Invalid username or password.' };
  }

  setCurrentUser(found);
  return { success: true, user: found };
};

// Password Recovery via Security Question
export const recoverPassword = async (
  username: string,
  securityAnswer: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> => {
  const trimmed = username.trim();
  const answer = securityAnswer.trim().toLowerCase();
  const users = getUsers();
  let index = users.findIndex((u) => u.username.toLowerCase() === trimmed.toLowerCase());

  if (index !== -1) {
    if (users[index].securityAnswer !== answer) {
      return { success: false, error: 'Incorrect answer to security question.' };
    }
    users[index].passwordHash = btoa(newPassword);
    saveUsers(users);
    
    // Cloud sync
    try {
      await setDoc(doc(db, 'users', users[index].id), { passwordHash: btoa(newPassword) }, { merge: true });
    } catch {
      // non-blocking
    }
    return { success: true };
  }

  // Check Cloud Firestore
  try {
    const userId = generateUserId(trimmed);
    const snap = await getDoc(doc(db, 'users', userId));
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.securityAnswer === answer) {
        await setDoc(doc(db, 'users', userId), { passwordHash: btoa(newPassword) }, { merge: true });
        return { success: true };
      } else {
        return { success: false, error: 'Incorrect answer to security question.' };
      }
    }
  } catch {
    // fallback
  }

  return { success: false, error: 'Franchise account not found.' };
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
    setDoc(
      doc(db, 'users', updated.id),
      {
        uid: updated.id,
        username: updated.username,
        purseBalance: updated.purseBalance,
        trophiesWon: updated.trophiesWon,
        matchesPlayed: updated.matchesPlayed,
        createdAt: updated.createdAt,
      },
      { merge: true }
    ).catch(() => {});
  } catch {
    // non-blocking
  }
};

// -------------------------------------------------------------
// USER-SCOPED ROOMS & PROGRESS MANAGEMENT
// "the moment logged out it will not show the progress,
// when logged in then only it will show the progress"
// -------------------------------------------------------------

export const getUserRooms = (userId: string): Record<string, RoomState> => {
  try {
    const raw = localStorage.getItem(getUserRoomsKey(userId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveUserRoom = (userId: string, room: RoomState) => {
  try {
    const rooms = getUserRooms(userId);
    room.lastUpdated = Date.now();
    rooms[room.code] = room;
    localStorage.setItem(getUserRoomsKey(userId), JSON.stringify(rooms));
  } catch (err) {
    console.error('Failed to save user room locally:', err);
  }
};

export const getUserActiveRoomCode = (userId: string): string | null => {
  try {
    return localStorage.getItem(getUserActiveRoomKey(userId));
  } catch {
    return null;
  }
};

export const setUserActiveRoomCode = (userId: string, code: string | null) => {
  try {
    if (code) {
      localStorage.setItem(getUserActiveRoomKey(userId), code.toUpperCase());
    } else {
      localStorage.removeItem(getUserActiveRoomKey(userId));
    }
  } catch {
    // fallback
  }
};

export const deleteUserRoom = (roomCode: string) => {
  const user = getCurrentUser();
  if (!user) return;
  const rooms = getUserRooms(user.id);
  delete rooms[roomCode.toUpperCase()];
  localStorage.setItem(getUserRoomsKey(user.id), JSON.stringify(rooms));

  const active = getUserActiveRoomCode(user.id);
  if (active === roomCode.toUpperCase()) {
    setUserActiveRoomCode(user.id, null);
  }
};

// Public getters for the currently authenticated session:
// If NOT logged in, returns EMPTY (Zero progress leaked or shown)
export const getStoredRooms = (): Record<string, RoomState> => {
  const user = getCurrentUser();
  if (!user) {
    return {};
  }
  return getUserRooms(user.id);
};

export const getActiveRoomCode = (): string | null => {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }
  return getUserActiveRoomCode(user.id);
};

export const setActiveRoomCode = (code: string | null) => {
  const user = getCurrentUser();
  if (user) {
    setUserActiveRoomCode(user.id, code);
  }
};

// Saves room progress strictly scoped to the active logged-in user
export const saveRoom = (room: RoomState) => {
  const user = getCurrentUser();
  if (!user) {
    console.warn('Cannot save room progress: User is not authenticated.');
    return;
  }

  try {
    room.lastUpdated = Date.now();
    // 1. Save in user's scoped storage
    saveUserRoom(user.id, room);
    setUserActiveRoomCode(user.id, room.code);
    broadcastRoomUpdate(room);

    // 2. Persist to Cloud Firestore for cross-device live sync
    setDoc(doc(db, 'rooms', room.code), {
      code: room.code,
      name: room.name,
      hostUserId: room.hostUserId || user.id,
      mode: room.mode,
      status: room.status,
      lastUpdated: room.lastUpdated,
      stateJson: JSON.stringify(room),
    }).catch((err) => {
      console.warn('Firestore room sync notice:', err.message);
    });

    // 3. Update user doc with active room code in Firestore
    setDoc(
      doc(db, 'users', user.id),
      {
        activeRoomCode: room.code,
        lastUpdated: Date.now(),
      },
      { merge: true }
    ).catch(() => {});
  } catch (err) {
    console.error('Failed to save room progress:', err);
  }
};

// Retrieve a room by code (scoped to user or Cloud Firestore)
export const getRoomByCode = async (code: string): Promise<RoomState | null> => {
  const normalized = code.toUpperCase();
  const user = getCurrentUser();

  // 1. Check user-scoped rooms first
  if (user) {
    const userRooms = getUserRooms(user.id);
    if (userRooms[normalized]) {
      return userRooms[normalized];
    }
  }

  // 2. Check Cloud Firestore
  try {
    const snap = await getDoc(doc(db, 'rooms', normalized));
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.stateJson) {
        const parsed: RoomState = JSON.parse(data.stateJson);
        if (user) {
          saveUserRoom(user.id, parsed); // Cache under user's account
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Firestore room fetch notice:', err);
  }

  return null;
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
