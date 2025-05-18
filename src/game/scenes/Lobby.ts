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
    private createContainer?: Phaser.GameObjects.Container;
    private joinContainer?: Phaser.GameObjects.Container;

    constructor() {
        // シーンキー "Lobby" を指定して親クラス初期化
        super("Lobby");
    }

    /**
     * create() — UI の生成とボタンイベント登録
     */
    create() {
        EventBus.emit("current-scene-ready", this);
        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;

        /* タイトル */
        this.add
            .text(cx, cy - 160, "Gundam Tower Battle", {
                fontFamily: "monospace",
                fontSize: "32px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        /* Create Room ボタン */
        const createBtn = this.rexUI
            .add.label({
                background: this.rexUI.add.roundRectangle(0, 0, 180, 40, 8, 0x6d8715),
                text: this.add.text(0, 0, "Create Room", {
                    fontFamily: "monospace",
                    fontSize: "24px",
                    color: "#ffffff",
                }),
                align: "center",
                space: { left: 10, right: 10, top: 10, bottom: 10 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.showCreate());
        this.add.existing(createBtn);
        createBtn.setPosition(cx, cy - 40);

        /* Join Room ボタン */
        const joinBtn = this.rexUI
            .add.label({
                background: this.rexUI.add.roundRectangle(0, 0, 180, 40, 8, 0x6d8715),
                text: this.add.text(0, 0, "Join Room", {
                    fontFamily: "monospace",
                    fontSize: "24px",
                    color: "#ffffff",
                }),
                align: "center",
                space: { left: 10, right: 10, top: 10, bottom: 10 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.showJoin());
        this.add.existing(joinBtn);
        joinBtn.setPosition(cx, cy + 40);
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
    
    /* ------------------------------------------------------------------
     * showCreate() — 部屋作成ボタン押下時の処理
     * ------------------------------------------------------------------ */
    private showCreate() {
        this.joinContainer?.destroy();
        this.joinContainer = undefined;
        this.createContainer?.destroy();

        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2 + 100;

        this.roomId = genRoomId();
        this.hostNet = createTrysteroNetwork(this.roomId, true);

        const idLabel = this.rexUI
            .add.label({
                background: this.rexUI.add.roundRectangle(0, 0, 150, 30, 6, 0x333333),
                text: this.add.text(0, 0, `ID: ${this.roomId}`, {
                    fontFamily: "monospace",
                    fontSize: "20px",
                    color: "#ffff66",
                }),
                space: { left: 10, right: 10, top: 8, bottom: 8 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", async () => {
                try {
                    await navigator.clipboard.writeText(this.roomId);
                } catch {
                    /* noop */
                }
            });

        const waitText = this.add
            .text(0, 60, "Waiting for opponent…", {
                fontFamily: "monospace",
                fontSize: "18px",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        this.createContainer = this.add.container(cx, cy, [idLabel, waitText]);

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
     * showJoin() — 入室フォームを表示
     * ------------------------------------------------------------------ */
    private showJoin() {
        this.createContainer?.destroy();
        this.createContainer = undefined;
        this.joinContainer?.destroy();

        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2 + 100;

        this.inputField = document.createElement("input");
        this.inputField.type = "text";
        this.inputField.maxLength = 6;
        this.inputField.placeholder = "Room ID";
        this.inputField.style.width = "150px";
        this.inputField.style.fontSize = "16px";
        const inputDOM = this.add.dom(0, 0, this.inputField);

        const joinBtn = this.rexUI
            .add.label({
                background: this.rexUI.add.roundRectangle(0, 0, 80, 30, 6, 0x333333),
                text: this.add.text(0, 0, "Join", {
                    fontFamily: "monospace",
                    fontSize: "18px",
                    color: "#ffffff",
                }),
                space: { left: 10, right: 10, top: 8, bottom: 8 },
            })
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.onJoin());

        this.joinContainer = this.add.container(cx, cy, [inputDOM, joinBtn]);
        inputDOM.setOrigin(0.5);
        joinBtn.setPosition(100, 0);
    }
}
