// src/App.tsx
// =============================================================================
//  React ルートエントリ
// -----------------------------------------------------------------------------
//  - phaser × react は “分業” が基本
//  - React 側は <div> を 1 つ用意して Phaser ゲームをマウントするだけ。
//  - それ以外の UI は **すべて Phaser 側（Scene）で完結** させる方針。
//  - 初回マウント時に `StartGame()` を呼び、Phaser.Game インスタンスを
//    生成して <div> にバインドする。React の再レンダリングは不要。
// =============================================================================

import { useEffect, useRef } from "react";
import StartGame from "./game/main"; // Phaser エントリポイント

/**
 * <App/> — CRA / Vite などのエントリで最初に呼ばれるコンポーネント
 *
 * 1. `containerRef` がマウントされたタイミング（useEffect 内）で
 *    StartGame() を叩く。
 * 2. StartGame() 側は `{ parent: <HTMLDivElement> }` を受け取り
 *    new Phaser.Game(...) を生成。以降は Phaser ワールド内で完結。
 */
export default function App() {
    // ---------------------------------------------------------------------
    // `containerRef` : <div> 要素を参照するための React Ref
    // ---------------------------------------------------------------------
    const containerRef = useRef<HTMLDivElement | null>(null);

    // ---------------------------------------------------------------------
    // マウント時に 1 度だけ Phaser ゲームを起動
    // ---------------------------------------------------------------------
    useEffect(() => {
        // <div> がまだ DOM に存在しない場合は何もしない
        if (!containerRef.current) return;

        // 親 div に一意の ID を付与（無ければ）
        const parentId = "game-container";
        containerRef.current.id = parentId;

        // parent: HTMLDivElement を渡して Phaser.Game を生成
        const phaserGame = StartGame(parentId);

        // アンマウント時にゲームを破棄してメモリリークを防ぐ
        return () => {
            phaserGame.destroy(true);
        };
    }, []); // ← 依存配列空 = コンポーネント初回マウント時のみ実行

    // ---------------------------------------------------------------------
    // この <div> が Phaser の描画ターゲットになる
    //   - width / height: 100vw・100vh でブラウザ全域を覆う
    //   - overflow hidden + 黒背景 で余白チラつきを防止
    // ---------------------------------------------------------------------
    return (
        <div
            ref={containerRef} // ← useRef で参照を取得
            style={{
                width: "100vw", // ビューポート幅いっぱい
                height: "100vh", // ビューポート高いっぱい
                margin: 0,
                padding: 0,
                overflow: "hidden", // 画面外スクロール禁止
                backgroundColor: "#000", // 背景は黒（ロード中のチラ見え防止）
            }}
        />
    );
}
