// src/network/trysteroConnection.ts
import { joinRoom, Room } from "trystero";
import type { PieceInput, SyncPayload, GameResult } from "../types";

export interface TrysteroNetwork {
  isHost: boolean;
  room: Room;

  /* チャンネル送信 */
  sendInput: (input: PieceInput) => void;
  sendSync: (sync: SyncPayload) => void;
  sendResult: (result: GameResult) => void;

  /* 受信ハンドラ登録 */
  onInput: (cb: (input: PieceInput) => void) => void;
  onSync:  (cb: (sync: SyncPayload) => void) => void;
  onResult: (cb: (result: GameResult) => void) => void;
}

export function createTrysteroNetwork(
  roomId: string,
  isHost: boolean,
): TrysteroNetwork {
  const room = joinRoom({ appId: "gundam-tower-battle" }, roomId);

  const [sendInput, onInput] = room.makeAction<PieceInput>("input");
  const [sendSync, onSync] = room.makeAction<SyncPayload>("sync");
  const [sendResult, onResult] = room.makeAction<GameResult>("result");

  return {
    isHost,
    room,
    sendInput,
    sendSync,
    sendResult,
    onInput,
    onSync,
    onResult,
  };
}
