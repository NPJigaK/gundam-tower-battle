/* =============================================================================
 *  共通型定義 – 50 ms 高頻度同期仕様
 * ========================================================================== */

/* プレイヤーサイド */
export type PlayerSide = "host" | "client";

/* ---------------------------------------------------------------------------
 * 1. ピース同期ペイロード  (ホスト → クライアント, 50 msごと)
 * ------------------------------------------------------------------------ */
export interface PieceSync {
    id: string; // ピース固有 ID
    g: number; // gundams 配列インデックス
    x: number;
    y: number;
    angle: number;

    [k: string]: string | number;
}

/* チャンネル: sync で送るトップレベルオブジェクト */
export interface SyncPayload {
    turn: PlayerSide; // 現在操作権を持つサイド
    pieces: PieceSync[]; // ワールド全ピース

    worldTop: number;
    worldHeight: number;
    scrollY: number; // ホストカメラの scrollY

    [k: string]: string | number | PieceSync[];
}

/* ---------------------------------------------------------------------------
 * 2. クライアント → ホスト : 入力コマンド
 * ------------------------------------------------------------------------ */
export interface PieceInput {
    action: "move" | "rotate" | "drop";
    x?: number; // move 用
    [k: string]: string | number;
}

/* ---------------------------------------------------------------------------
 * 3. ゲーム結果
 * ------------------------------------------------------------------------ */
export type GameResult = PlayerSide | "draw";
