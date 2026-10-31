import { DEFAULT_MC_ITERATIONS } from './constants';
import { DisplayUnit } from './units';
export type MessageType =
  | 'START_SESSION'
  | 'STOP_SESSION'
  | 'GET_SESSION_STATE'
  | 'SESSION_UPDATE'
  | 'ADVICE_UPDATE'
  | 'SETTINGS_UPDATED'
  | 'GET_TRACKED_PLAYERS'
  | 'ADD_TRACKED_PLAYER'
  | 'REMOVE_TRACKED_PLAYER'
  | 'SET_PLAYER_MAPPINGS'
  | 'GET_TABLE_PLAYERS'
  | 'GET_LEARNING_STATS'
  | 'RESET_LEARNING'
  | 'RUN_SELF_CHECK'
  | 'GET_SCRAPER_DEBUG'
  | 'GET_PROFILES'
  | 'GET_HAND_COUNT'
  | 'EXPORT_HAND_HISTORY'
  | 'ANALYSE_OPPONENT';

/*
 * Gone with the profiling: EXPORT_BACKUP and IMPORT_BACKUP, whose file
 * format was a profile format, and FETCH_JSON, which relayed PokerNow's
 * session log through the background worker for pages whose content-security
 * policy blocked the direct request. The log existed to build opponent
 * observations, so both the relay and the messages that drove it have no
 * sender and no handler left.
 */

export interface Message {
  type: MessageType;
  payload?: any;
}

export interface Settings {
  overlayEnabled: boolean;
  overlayX: number;
  overlayY: number;
  /** Persisted panel size. 0 means "never resized — fit to content". */
  overlayWidth: number;
  overlayHeight: number;
  mcIterations: number;
  trackedPlayers: string[];
  collapsed: boolean;
  learningMode: 'on' | 'off';
  /**
   * How willing the advisor is to take the aggressive line in spots where
   * both are defensible. 'standard' is the behaviour this engine was
   * measured at; 'aggressive' nudges it, and is the default.
   *
   * It moves frequencies, never hand strength: a spot the engine is sure
   * about is decided before this is consulted. See `engine/aggression.ts`.
   */
  aggression: 'standard' | 'aggressive';
}

export const DEFAULT_SETTINGS: Settings = {
  overlayEnabled: true,
  overlayX: 20,
  overlayY: 20,
  overlayWidth: 0,
  overlayHeight: 0,
  mcIterations: DEFAULT_MC_ITERATIONS,
  trackedPlayers: [],
  collapsed: false,
  learningMode: 'on',
  aggression: 'aggressive',
};

export interface AdvicePayload {
  action: string;
  amount?: number;
  confidence: number;
  equity: number;
  potOdds: number;
  handCategory: string;
  boardTexture: string;
  reasoning: string[];
  alternatives: { action: string; amount?: number; note: string }[];
  currentBalance: number;
  startingBalance: number;
  profit: number;
  handsPlayed: number;
  handsWon: number;
  /**
   * The unit the table is counting in; undefined means chips.
   *
   * The balance figures are stacks as the page states them, so in blinds
   * mode they are blinds. Showing them unlabelled would read as a stack of
   * fifty-six chips.
   */
  displayUnit?: DisplayUnit;
  sessionStats?: {
    winRate: number;
    /** null until a bluff has actually resolved — not a default of 0.5. */
    bluffSuccessRate: number | null;
    adjustments: string[];
  };
}
