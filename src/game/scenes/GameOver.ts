/* ---------------------------------------------------------------------------
 *  GameOver.ts ― ゲーム終了シーン
 *  -------------------------------------------------------------------------
 *  - Play シーンから渡されたスコアを表示し、「Restart」ボタンでゲームを再開
 *  - React 側（外部 UI）から現在のアクティブシーンを参照できるよう
 *    EventBus で “current-scene-ready” を発火させる
 * -------------------------------------------------------------------------*/

import { Scene } from "phaser"; // Phaser の基本クラス群
import { EventBus } from "../EventBus"; // シーン切り替え通知用の簡易イベントバス
import type { GameResult } from "../../types";

export class GameOver extends Scene {
    /* ──────────────────────────── フィールド ─────────────────────────── */
    /** Play シーンから受け取った最終スコア。init() でセットされる */
    private finalScore: number = 0;
    /** 勝者 (host/client/draw) */
    private winner?: GameResult;

    /* ──────────────────────────── コンストラクタ ──────────────────────── */
    constructor() {
        /* Scene に一意なキーを与える（GameOver シーンとして登録） */
        super("GameOver");
    }

    /* =====================================================================
     *  init() : 前シーンからデータを受け取るためのライフサイクルメソッド
     *           Scene.start("GameOver", { score }) の第 2 引数がここに来る
     * =================================================================== */
    init(data: any): void {
        // Play シーンで渡されたスコアがあれば保持（安全に 0 初期化も兼ねる）
        this.finalScore = data.score || 0;
        this.winner = data.winner;
    }

    /* =====================================================================
     *  create() : Scene 開始後に 1 回だけ呼ばれる。ゲームオブジェクト生成はここ
     * =================================================================== */
    create(): void {
        /* ------- 背景を黒にして“暗転”効果（リスタート時に雰囲気を出す） ---- */
        this.cameras.main.setBackgroundColor(0x000000);

        /* ------- 座標計算：画面中央を基準に各テキストを配置 --------------- */
        const centerX = this.cameras.main.width * 0.5;
        const centerY = this.cameras.main.height * 0.5;

        /* ------- 「Game Over」タイトル ------------------------------------ */
        this.add
            .text(centerX, centerY - 80, "Game Over", {
                font: "48px Arial",
                color: "#ffffff",
            })
            .setOrigin(0.5); // 文字列中央を基準点にする

        /* ------- 勝者表示 ---------------------------------------------- */
        if (this.winner) {
            this.add
                .text(centerX, centerY - 40, `Winner: ${this.winner}`, {
                    font: "32px Arial",
                    color: "#ffffff",
                })
                .setOrigin(0.5);
        }

        /* ------- 最終スコア --------------------------------------------- */
        this.add
            .text(centerX, centerY, `Score: ${this.finalScore}`, {
                font: "32px Arial",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        /* ------- Restart ボタン（テキストをボタン代わりに） -------------- */
        const restartText = this.add
            .text(centerX, centerY + 80, "Restart", {
                font: "28px Arial",
                color: "#ffff00",
            })
            .setOrigin(0.5)
            .setInteractive(); // ポインタ入力を有効化（ボタン化）

        /* クリック / タップで Play シーンを再起動 */
        restartText.on("pointerup", () => {
            this.scene.start("Play"); // 新規に Play シーンを作成して遷移
        });

        /* ------- React 側へ “シーン準備完了” を通知 ---------------------- */
        EventBus.emit("current-scene-ready", this);
    }
}

