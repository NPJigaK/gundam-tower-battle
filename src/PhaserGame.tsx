/**
 * --------------------------------------------------------------------------
 *  PhaserGame.tsx
 *  ------------------------------------------------------------------------
 *  React から **Phaser 3** のゲームインスタンスを生成・破棄し、
 *  Scene が ready になったタイミングでコールバック／ref へ通知する
 *  **ブリッジコンポーネント** です。
 * --------------------------------------------------------------------------
 */

import { forwardRef, useEffect, useLayoutEffect, useRef } from "react";
import StartGame from "./game/main"; // Phaser.Game を生成する factory
import { EventBus } from "./game/EventBus"; // React–Phaser 通信用バス

/* -------------------------------------------------------------------------- */
/*  外部から参照したい値をまとめた ref 型                                     */
/* -------------------------------------------------------------------------- */
export interface IRefPhaserGame {
    game: Phaser.Game | null; // Phaser の Game インスタンス
    scene: Phaser.Scene | null; // 現在アクティブな Scene
}

/* -------------------------------------------------------------------------- */
/*  コンポーネント Props                                                      */
/* -------------------------------------------------------------------------- */
interface IProps {
    /** Scene が `EventBus.emit("current-scene-ready", scene)` した時に呼ばれる */
    currentActiveScene?: (scene_instance: Phaser.Scene) => void;
}

/* -------------------------------------------------------------------------- */
/*  <PhaserGame> コンポーネント                                               */
/* -------------------------------------------------------------------------- */
export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(
    /**
     * forwardRef でラップすると親から `ref={...}` で参照を渡せる。
     * コンポーネント名を無名関数で定義しているのは ESLint 対策。
     */
    function PhaserGame({ currentActiveScene }, ref) {
        /* =========================================== *
         * 1. React 側に保持しておく Phaser.Game 参照
         * =========================================== */
        const game = useRef<Phaser.Game | null>(null!);

        /* -------------------------------------------------------------- *
         * 2. useLayoutEffect — マウント時にゲームを生成、アンマウント時に破棄
         *    - useEffect ではなく useLayoutEffect を使うことで
         *      DOM に #game-container が描画された直後に Phaser を初期化。
         * -------------------------------------------------------------- */
        useLayoutEffect(() => {
            /* --- 2-1) 初回のみ Game を生成 ---------------------------- */
            if (game.current === null) {
                // StartGame(…) は `new Phaser.Game({...})` を返す factory
                game.current = StartGame("game-container");

                /* 外部へ ref を即時反映（Scene はまだ null） ---------- */
                if (typeof ref === "function") {
                    ref({ game: game.current, scene: null });
                } else if (ref) {
                    ref.current = { game: game.current, scene: null };
                }
            }

            /* --- 2-2) アンマウント時に Game を完全破棄 ---------------- */
            return () => {
                if (game.current) {
                    game.current.destroy(true); // Canvas まで破棄
                    game.current = null;
                }
            };
        }, [ref]); // ref への参照が変わることは基本無いが念のため dependency 指定

        /* -------------------------------------------------------------- *
         * 3. useEffect — EventBus で Scene 準備完了を受け取り、通知
         * -------------------------------------------------------------- */
        useEffect(() => {
            /* 3-1) 監視開始 ------------------------------------------- */
            EventBus.on(
                "current-scene-ready",
                (scene_instance: Phaser.Scene) => {
                    /* --- 親コンポーネントへコールバック -------------- */
                    if (currentActiveScene) {
                        currentActiveScene(scene_instance);
                    }

                    /* --- ref へ game / scene を格納 ------------------ */
                    if (typeof ref === "function") {
                        ref({ game: game.current, scene: scene_instance });
                    } else if (ref) {
                        ref.current = {
                            game: game.current,
                            scene: scene_instance,
                        };
                    }
                }
            );

            /* 3-2) クリーンアップ — リスナ解除 ------------------------- */
            return () => {
                EventBus.off("current-scene-ready");
            };
        }, [currentActiveScene, ref]);

        /* -------------------------------------------------------------- *
         * 4. コンテナ div だけレンダリング。
         *    Phaser 側で `document.getElementById("game-container")`
         *    へ <canvas> が自動で追加される。
         * -------------------------------------------------------------- */
        return <div id="game-container"></div>;
    }
);
