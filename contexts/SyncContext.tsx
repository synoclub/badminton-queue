import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { Player, Court, Member, INITIAL_COURT_COUNT } from '../types';
import { AppState, ConnectionStatus } from '../types/websocket';

interface SyncContextType {
  // Connection status
  connectionStatus: ConnectionStatus;

  // Sync state
  players: Player[];
  courts: Court[];
  members: Member[];

  // Sync actions
  updatePlayers: (updates: Player[] | ((prev: Player[]) => Player[])) => void;
  updateCourts: (updates: Court[] | ((prev: Court[]) => Court[])) => void;
  updateMembers: (updates: Member[] | ((prev: Member[]) => Member[])) => void;

  // Manual reconnect
  reconnect: () => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

interface SyncProviderProps {
  children: React.ReactNode;
  initialPlayers?: Player[];
  initialCourts?: Court[];
  initialMembers?: Member[];
}

export function SyncProvider({
  children,
  initialPlayers = [],
  initialCourts = [],
  initialMembers = []
}: SyncProviderProps) {
  const [players, setPlayers] = useState<Player[]>(() => {
    if (initialPlayers.length > 0) return initialPlayers;
    const saved = localStorage.getItem('badminton_players');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((p: any) => ({ ...p, level: p.level || 'beginner' }));
    }
    return [];
  });

  const [courts, setCourts] = useState<Court[]>(() => {
    if (initialCourts.length > 0) return initialCourts;
    const saved = localStorage.getItem('badminton_courts');
    if (saved) return JSON.parse(saved);
    return Array.from({ length: INITIAL_COURT_COUNT }, (_, i) => ({
      id: i + 1,
      name: `場地 ${i + 1}`,
      playerIds: [],
      startTime: null,
    }));
  });

  const [members, setMembers] = useState<Member[]>(() => {
    if (initialMembers.length > 0) return initialMembers;
    const saved = localStorage.getItem('badminton_members');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((m: any) => ({ ...m, level: m.level || 'beginner' }));
    }
    return [];
  });

  // Refs to track latest state for immediate access in callbacks (solving race conditions)
  const playersRef = useRef(players);
  const courtsRef = useRef(courts);
  const membersRef = useRef(members);

  // Sync refs with state
  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { courtsRef.current = courts; }, [courts]);
  useEffect(() => { membersRef.current = members; }, [members]);

  // Track if this is a remote update to prevent echo
  const isRemoteUpdateRef = useRef(false);

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'state_update') {
      // Mark as remote update
      isRemoteUpdateRef.current = true;

      // Update local state with remote changes
      if (message.state.players) {
        setPlayers(message.state.players);
        playersRef.current = message.state.players;
      }
      if (message.state.courts) {
        setCourts(message.state.courts);
        courtsRef.current = message.state.courts;
      }
      if (message.state.members) {
        setMembers(message.state.members);
        membersRef.current = message.state.members;
      }

      // Reset flag after state updates
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 0);
    } else if (message.type === 'sync_response') {
      // Full state sync from server
      isRemoteUpdateRef.current = true;

      const newPlayers = message.state.players || [];
      const newCourts = message.state.courts || [];
      const newMembers = message.state.members || [];

      setPlayers(newPlayers);
      setCourts(newCourts);
      setMembers(newMembers);

      playersRef.current = newPlayers;
      courtsRef.current = newCourts;
      membersRef.current = newMembers;

      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 0);
    }
  }, []);

  const { status, sendMessage, reconnect } = useWebSocket({
    onMessage: handleMessage,
    onConnect: () => {
      console.log('🔗 Connected to sync server');
    },
    onDisconnect: () => {
      console.log('🔌 Disconnected from sync server');
    }
  });

  // Broadcast state changes to other clients
  const broadcastUpdate = useCallback((state: Partial<AppState>) => {
    // Don't broadcast if this was triggered by a remote update
    if (isRemoteUpdateRef.current) {
      return;
    }

    sendMessage({
      type: 'state_update',
      state
    });
  }, [sendMessage]);

  const updatePlayers = useCallback((updates: Player[] | ((prev: Player[]) => Player[])) => {
    // Use ref to get the absolute latest state, ignoring closure staleness
    const currentPlayers = playersRef.current;
    const newPlayers = typeof updates === 'function' ? updates(currentPlayers) : updates;

    // Optimistically update ref to prevent race conditions in rapid successive calls
    playersRef.current = newPlayers;

    setPlayers(newPlayers);
    broadcastUpdate({ players: newPlayers });
  }, [broadcastUpdate]);

  const updateCourts = useCallback((updates: Court[] | ((prev: Court[]) => Court[])) => {
    const currentCourts = courtsRef.current;
    const newCourts = typeof updates === 'function' ? updates(currentCourts) : updates;

    courtsRef.current = newCourts;

    setCourts(newCourts);
    broadcastUpdate({ courts: newCourts });
  }, [broadcastUpdate]);

  const updateMembers = useCallback((updates: Member[] | ((prev: Member[]) => Member[])) => {
    const currentMembers = membersRef.current;
    const newMembers = typeof updates === 'function' ? updates(currentMembers) : updates;

    membersRef.current = newMembers;

    setMembers(newMembers);
    broadcastUpdate({ members: newMembers });
  }, [broadcastUpdate]);

  const value: SyncContextType = {
    connectionStatus: status,
    players,
    courts,
    members,
    updatePlayers,
    updateCourts,
    updateMembers,
    reconnect
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
