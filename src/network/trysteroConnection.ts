// src/network/trysteroConnection.ts
// ---------------------------------------------------------------------------
//  Trystero を用いたシンプルな P2P 接続ヘルパー。
//  ゲーム内ではこのモジュールだけを触れば通信処理が完結するよう、
//  チャンネル作成とハンドラ登録をまとめたラッパーを提供します。
//  ChatGPT などがコードを読む際にも概要が掴みやすいよう、
//  必要な情報をコメントとして残しています。
// ---------------------------------------------------------------------------
import { joinRoom, Room } from "trystero";
import type { PieceInput, SyncPayload, GameResult } from "../types";

export interface TrysteroNetwork {
  /** true のときホストとして振る舞う */
  isHost: boolean;

  /** 生の Trystero Room オブジェクト。必要があれば直接参照可能 */
  room: Room;

  /* チャンネル送信 — ゲームロジックから直接呼び出す */
  sendInput: (input: PieceInput) => void;
  sendSync: (sync: SyncPayload) => void;
  sendResult: (result: GameResult) => void;
  sendRematch: () => void;
  sendName: (name: string) => void;

  /* 受信ハンドラ登録 — onXXX(cb) 形式でリスナを追加 */
  onInput: (cb: (input: PieceInput) => void) => void;
  onSync:  (cb: (sync: SyncPayload) => void) => void;
  onResult: (cb: (result: GameResult) => void) => void;
  onRematch: (cb: () => void) => void;
  onName: (cb: (name: string) => void) => void;
}

// 重要: Nostr Relay によっては publish に認証が必要で接続が不安定になるため、
//       ここで「認証不要の公開 Relay を固定」し、リマッチ含む疎通の安定性を上げる。
const DEFAULT_RELAY_URLS = [
  "wss://eu.purplerelay.com",
  "wss://nostr.data.haus",
  "wss://nostr.grooveix.com",
  "wss://nostr.huszonegy.world",
  "wss://nostr.mom",
  "wss://nostr.sathoarder.com",
  "wss://nostr.vulpem.com",
  "wss://relay.fountain.fm",
  "wss://relay.nostromo.social",
  "wss://relay.snort.social",
];

const resolveRelayUrls = () => {
  const env = import.meta.env.VITE_TRYSTERO_RELAYS;
  if (!env) return DEFAULT_RELAY_URLS;
  const urls = env
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return urls.length > 0 ? urls : DEFAULT_RELAY_URLS;
};

export function createTrysteroNetwork(
  roomId: string,
  isHost: boolean,
): TrysteroNetwork {
  // Trystero で P2P ルームを生成 / 参加。appId はゲーム固有の識別子
  const room = joinRoom(
    {
      appId: "gundam-tower-battle",
      relayUrls: resolveRelayUrls(),
    },
    roomId,
  );

  // makeAction() で送受信用の関数ペアを作成
  const [sendInput, onInput] = room.makeAction<PieceInput>("input");
  const [sendSync, onSync] = room.makeAction<SyncPayload>("sync");
  const [sendResult, onResult] = room.makeAction<GameResult>("result");
  const [sendRematchRaw, onRematch] = room.makeAction<null>("rematch");
  const [sendName, onName] = room.makeAction<string>("name");

  return {
    isHost,
    room,
    sendInput,
    sendSync,
    sendResult,
    sendRematch: () => sendRematchRaw(null),
    sendName,
    onInput,
    onSync,
    onResult,
    onRematch,
    onName,
  };
}
