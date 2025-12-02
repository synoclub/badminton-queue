import { Player, Court, Member } from '../types';

// WebSocket message types
export type MessageType = 'state_update' | 'sync_request' | 'sync_response' | 'ping' | 'pong';

// Application state structure
export interface AppState {
  players: Player[];
  courts: Court[];
  members: Member[];
  timestamp: number;
}

// Base message structure
export interface BaseMessage {
  type: MessageType;
  clientId: string;
  timestamp: number;
}

// State update message (sent when local state changes)
export interface StateUpdateMessage extends BaseMessage {
  type: 'state_update';
  state: Partial<AppState>;
}

// Sync request message (request full state from server)
export interface SyncRequestMessage extends BaseMessage {
  type: 'sync_request';
}

// Sync response message (server sends full state)
export interface SyncResponseMessage extends BaseMessage {
  type: 'sync_response';
  state: AppState;
}

// Ping/Pong for heartbeat
export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
}

// Union type for all messages
export type WebSocketMessage =
  | StateUpdateMessage
  | SyncRequestMessage
  | SyncResponseMessage
  | PingMessage
  | PongMessage;

// Connection status
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
