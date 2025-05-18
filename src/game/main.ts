/*  =======================================================================
 *  main.ts
 *  -----------------------------------------------------------------------
 *  Phaser-React テンプレートの **エントリポイント** となるファイルです。
 *
 *  - **この 1 ファイル** で _Phaser.Game_ の生成&設定を完結させ、
 *    React 側（`PhaserGame.tsx`）から `StartGame()` を呼ぶだけで
 *    Phaser ランタイムをインスタンス化できるようにしています。
 *  - `export default StartGame` という **デフォルトエクスポート** を
 *    必ず提供することで、React 側からインポートしやすくしています。
 * -----------------------------------------------------------------------
 *  ファイル構成
 *  1. Phaser シーン（Boot / Preloader / Play / GameOver）を import
 *  2. `config` 変数に GameConfig を定義
 *  3. Helper 関数 `StartGame(parentId)` で Phaser.Game を new する
 *  4. React から使うため `default` でエクスポート
 * ======================================================================= */

import { Game } from "phaser";

/* --- ゲームを構成する Scene クラス群を import --------------------- */
import { Boot } from "./scenes/Boot"; // アセットパス登録など
import { Preloader } from "./scenes/Preloader"; // 画像／JSON ロード
import { Play } from "./scenes/Play"; // ゲーム本編
import { GameOver } from "./scenes/GameOver"; // リザルト画面
import { Lobby } from "./scenes/Lobby";

/* --- Phaser GameConfig ------------------------------------------------ *
 *  公式 API : https://newdocs.phaser.io/docs/3.55.2/Phaser.Types.Core.GameConfig
 * ------------------------------------------------------------------------ */
const config: Phaser.Types.Core.GameConfig = {
    /* 描画モード : 自動判定（WebGL ⇒ fallback で Canvas） ---------------
     */
    type: Phaser.AUTO,

    /* 画面解像度（＝ <canvas> 要素の幅高さ）---------------------------- */
    width: 1024,
    height: 768,

    /* <div id="game-container"> の中に <canvas> を注入する指定 --------- */
    parent: "game-container",

    /* 背景色（CSS color 文字列 or 16 進）-------------------------------- */
    backgroundColor: "#80c6ff", // 空色

    /* 有効化する Scene 順序（配列の先頭から順に起動される）-------------- */
    scene: [Boot, Preloader, Lobby, Play, GameOver],

    dom: { createContainer: true },

    plugins: {
        scene: [
            {
                key: "rexUI",
                plugin: (window as any).rexuiplugin,
                mapping: "rexUI",
            },
            {
                key: "rexInputText",
                plugin: (window as any).rexinputtextplugin,
                mapping: "rexInputText",
            },
        ],
    },
    
    /* 物理エンジン設定 -------------------------------------------------- */
    physics: {
        default: "matter", // Matter.js を採用
        matter: {
            gravity: { x: 0, y: 1000 }, // y 正方向が下へ 1000 px/s²
            debug: true,
        },
    },
};

/* --- Helper : 親 DOM ID を差し替えて Game を生成 ------------------ *
 *  React 側から “mount 先 <div> の id” を渡してもらうラッパー関数。
 *  （同じ GameConfig を使いまわしつつ、parent だけ上書きできる）
 * -------------------------------------------------------------------- */
const StartGame = (parent: string) => new Game({ ...config, parent });

/* --- デフォルトエクスポート ---------------------------------------- *
 *  React 側 (`import StartGame from "./main"`) で呼び出される想定。
 *  default を忘れると Vite / Webpack が “export named …” エラーになる。
 * -------------------------------------------------------------------- */
export default StartGame;
