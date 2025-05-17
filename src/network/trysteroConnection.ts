// src/network/trysteroConnection.ts
// ---------------------------------------------------------------------------
//  Trystero を用いたシンプルな P2P 接続ヘルパー。
//  ゲーム内ではこのモジュールだけを触れば通信処理が完結するよう、
//  チャンネル作成とハンドラ登録をまとめたラッパーを提供します。
//  ChatGPT などがコードを読む際にも概要が掴みやすいよう、
//  必要な情報をコメントとして残しています。
// ---------------------------------------------------------------------------
import { joinRoom, Room } from "trystero";
import type { PieceInput, SyncPayload, GameResult, RematchDecision } from "../types";

export interface TrysteroNetwork {
  /** true のときホストとして振る舞う */
  isHost: boolean;

  /** ルームID */
  roomId: string;

  /** 生の Trystero Room オブジェクト。必要があれば直接参照可能 */
  room: Room;

  /* チャンネル送信 — ゲームロジックから直接呼び出す */
  sendInput: (input: PieceInput) => void;
  sendSync: (sync: SyncPayload) => void;
  sendResult: (result: GameResult) => void;

  sendRematch: (d: RematchDecision) => void;

  /* 受信ハンドラ登録 — onXXX(cb) 形式でリスナを追加 */
  onInput: (cb: (input: PieceInput) => void) => void;
  onSync:  (cb: (sync: SyncPayload) => void) => void;
  onResult: (cb: (result: GameResult) => void) => void;

  onRematch: (cb: (d: RematchDecision) => void) => void;
}

export function createTrysteroNetwork(
  roomId: string,
  isHost: boolean,
): TrysteroNetwork {
  // Trystero で P2P ルームを生成 / 参加。appId はゲーム固有の識別子
  const room = joinRoom({ appId: "gundam-tower-battle" }, roomId);

  // makeAction() で送受信用の関数ペアを作成
  const [sendInput, onInput] = room.makeAction<PieceInput>("input");
  const [sendSync, onSync] = room.makeAction<SyncPayload>("sync");
  const [sendResult, onResult] = room.makeAction<GameResult>("result");
  const [sendRematch, onRematch] = room.makeAction<RematchDecision>("rematch");

  return {
    isHost,
    roomId,
    room,
    sendInput,
    sendSync,
    sendResult,
    sendRematch,
    onInput,
    onSync,
    onResult,
    onRematch,
  };
}
