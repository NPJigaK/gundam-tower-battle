/* ========================================================================== *
 *  Boot.ts                                                                   *
 *  ------------------------------------------------------------------------ *
 *  ゲーム起動直後 **一番最初** に実行される Boot Scene です。            *
 *                                                                            *                                                      *
 *    1) グローバルなローダ設定（`load.setBaseURL()` など）を済ませる。       *
 *    2) すぐに `Preloader` シーンへ遷移して、本格的なアセット読み込みを       *
 *       委ねる。                                                             *
 *                                                                            *
 *  ※ ここでは **重い処理や画像読み込みを行わない** のがベストプラクティス。 *
 * ========================================================================== */

import { Scene } from "phaser";
import { EventBus } from "../EventBus";

/* -------------------------------------------------------------------------- *
 *  Boot シーン本体                                                           *
 *  - Scene 名は `"Boot"` に固定（他シーンから `scene.start("Boot")` で呼ぶ） *
 *  - Phaser.Scene を継承して `preload()` → `create()` を実装する     *
 * -------------------------------------------------------------------------- */
export class Boot extends Scene {
    constructor() {
        super("Boot");
    }

    /* ---------------------------------------------------------------------- */
    /*  preload() – Phaser が自動で呼ぶ “事前読み込みフェーズ”                 */
    /* ---------------------------------------------------------------------- */
    preload(): void {
        // 必要ならここでフォントやロゴ画像などの初期アセットをロード
    }

    create(): void {
        // シーン開始をイベント通知（React側で現在のシーンを把握可能にする）
        EventBus.emit("current-scene-ready", this);

        this.scene.start("Preloader");
    }
}
