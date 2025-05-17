// src/scenes/Lobby.ts  – コピー機能付き
import { Scene } from "phaser";
import { EventBus } from "../EventBus";
import {
    createTrysteroNetwork,
    TrysteroNetwork,
} from "../../network/trysteroConnection";

/* ------------------------------------------------------------------
 * 6 桁のランダム英数字を生成するユーティリティ
 * ------------------------------------------------------------------ */
const genRoomId = () =>
    Math.random().toString(36).substring(2, 8).toUpperCase();

/**
 * Lobby シーン — オンライン対戦部屋の作成・参加を行う
 */
export class Lobby extends Scene {
    private roomId = genRoomId();
    private inputField?: HTMLInputElement;
    private hostNet?: TrysteroNetwork;

    constructor() {
        // シーンキー "Lobby" を指定して親クラス初期化
        super("Lobby");
    }

    /**
     * create() — UI の生成とボタンイベント登録
     */
    create() {
        EventBus.emit("current-scene-ready", this);
        const { width } = this.scale;
        const cx = width / 2;

        /* タイトル */
        this.add
            .text(cx, 100, "Gundam Tower Battle – Lobby", {
                font: "28px Arial",
                color: "#fff",
            })
            .setOrigin(0.5);

        /* ============= ① Create Room ============= */
        this.add
            .text(cx, 200, "Create Room", {
                font: "24px Arial",
                backgroundColor: "#0066cc",
                padding: { left: 12, right: 12, top: 4, bottom: 4 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.onCreate(cx));

        /* ============= ② Join ============= */
        this.inputField = document.createElement("input");
        this.inputField.type = "text";
        this.inputField.maxLength = 6;
        this.inputField.placeholder = "Enter Room ID";
        this.inputField.style.width = "160px";
        this.add.dom(cx, 320, this.inputField);

        this.add
            .text(cx, 380, "Join", {
                font: "24px Arial",
                backgroundColor: "#28a745",
                padding: { left: 28, right: 28, top: 4, bottom: 4 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.onJoin());
    }

    /* ------------------------------------------------------------------
     * onCreate() — 部屋作成ボタン押下時の処理
     * ------------------------------------------------------------------ */
    private onCreate(cx: number) {
        /* 部屋を生成して待機 */
        this.roomId = genRoomId();
        this.hostNet = createTrysteroNetwork(this.roomId, true);

        /* Room ID 表示 */
        const idText = this.add
            .text(cx, 260, `Room ID: ${this.roomId}`, {
                font: "24px Courier",
                color: "#ffff66",
            })
            .setOrigin(0.5);

        /* Copy ボタン */
        const copyBtn = this.add
            .text(cx, 300, "Copy", {
                font: "20px Arial",
                backgroundColor: "#444",
                padding: { left: 20, right: 20, top: 2, bottom: 2 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", async () => {
                try {
                    await navigator.clipboard.writeText(this.roomId);
                    copyBtn.setText("✔︎ Copied!").setBackgroundColor("#2ecc71");
                    this.time.delayedCall(1000, () =>
                        copyBtn.setText("Copy").setBackgroundColor("#444")
                    );
                } catch {
                    copyBtn.setText("Failed").setBackgroundColor("#e74c3c");
                    this.time.delayedCall(1000, () =>
                        copyBtn.setText("Copy").setBackgroundColor("#444")
                    );
                }
            });

        /* 待機中テキスト */
        const waitText = this.add
            .text(cx, 350, "Waiting for opponent…", {
                font: "22px Arial",
                color: "#fff",
            })
            .setOrigin(0.5);

        /* 相手が join → Play へ遷移 */
        this.hostNet.room.onPeerJoin(() => {
            waitText.setText("Opponent found!");
            this.time.delayedCall(500, () =>
                this.scene.start("Play", {
                    roomId: this.roomId,
                    isHost: true,
                    net: this.hostNet,
                })
            );
        });
    }

    /* ------------------------------------------------------------------
     * onJoin() — 入力された部屋IDで Play シーンへ移動
     * ------------------------------------------------------------------ */
    private onJoin() {
        const id = (this.inputField?.value ?? "").trim().toUpperCase();
        if (/^[A-Z0-9]{6}$/.test(id)) {
            this.scene.start("Play", { roomId: id, isHost: false });
        }
    }
}
