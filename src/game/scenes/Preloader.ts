/* ======================================================================= *
 *  Preloader.ts ― アセット（画像 / JSON など）を **最初に一括ロード** する Scene
 *  ─────────────────────────────────────────────────────────────────────── *
 *                                                                         *
 *  ★ “ロード完了後に nextScene へ遷移” という単純な作りにしておくと、       *
 *    ・ロード失敗時のエラーハンドリング                                   *
 *    ・プログレスバー表示                                                 *
 *    ・後々アセット追加時の修正                                           *
 *    が Preloader だけで完結するため保守がラク               *
 * ======================================================================= */

import { Scene } from "phaser";
import { EventBus } from "../EventBus";

/** アセットの配置先ディレクトリ（相対パス） */
const IMG_DIR = "assets/images/";
const AUDIO_DIR = "assets/audio/";
const SHAPES_DIR = "assets/shapes/";

export class Preloader extends Scene {
    constructor() {
        super("Preloader");
    }

    /* ======================================================================= *
     *  preload() — Phaser が自動で呼び、ここでファイルロードを行う            *
     * ======================================================================= */
    preload(): void {
        /* ------------------ 1. ローディングバーの簡易表示 ------------------ */
        const { width, height } = this.scale;
        const barW = width * 0.6,
            barH = 18;
        const barX = (width - barW) / 2;
        const barY = (height - barH) / 2;

        /** 外枠（白） */
        this.add
            .rectangle(barX, barY, barW, barH, 0xffffff)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x000000);

        /** 内側の進捗バー（水色） */
        const progress = this.add
            .rectangle(barX, barY, 0, barH, 0x9ad1ff)
            .setOrigin(0, 0);

        // ▶ 進捗イベントでバー幅を更新
        this.load.on("progress", (ratio: number) => {
            progress.width = barW * ratio;
        });

        /* ------------------ 画像（PNG / TextureAtlas） ------------------ */
        // ※ ここに追加したファイルは **全シーンで key 名だけで参照可能** になる
        this.load.image("palerider", IMG_DIR + "palerider.png");
        this.load.image("guntank", IMG_DIR + "guntank.png");
        this.load.image("sazabi", IMG_DIR + "sazabi.png");
        this.load.image("zakuII-ranged", IMG_DIR + "zakuII-ranged.png");
        this.load.image("gundam", IMG_DIR + "gundam.png");

        /* ------------------ 多角形シェイプ JSON（PhysicsEditor） -------- */
        this.load.json("shapes", SHAPES_DIR + "shapes.json");

        /* ------------------ BGM / SE などのオーディオ ------------------- */
        // （ToDo） this.load.audio('bgm',   [AUDIO_DIR + 'bgm.mp3']);
        // （ToDo） this.load.audio('drop',  [AUDIO_DIR + 'drop.wav']);

        /* ------------------ その他フォント / テキスト等 ----------------- */
        // WebFont, BitmapFont, CSV などあればここに追加
    }

    create(): void {
        // シーン開始を通知
        EventBus.emit("current-scene-ready", this);

        /* --- 1. 進捗バーのイベントリスナーを解除（不要な参照を残さない） --- */
        this.load.off("progress");

        /* --- 2. 次シーンへ遷移（Boot.ts で指定されている “Play” へ） ------ */
        this.scene.start("Play");
    }
}
