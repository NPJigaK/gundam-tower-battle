// src/scenes/Lobby.ts — RexUI based lobby screen
import { Scene } from "phaser";
import { EventBus } from "../EventBus";
import {
    createTrysteroNetwork,
    TrysteroNetwork,
} from "../../network/trysteroConnection";

const genRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export class Lobby extends Scene {
    private roomId = genRoomId();
    private inputField!: any; // RexInputText instance
    private hostNet?: TrysteroNetwork;

    constructor() {
        super("Lobby");
    }

    create() {
        EventBus.emit("current-scene-ready", this);
        const { width, height } = this.scale;
        const cx = width / 2;
        const cy = height / 2;

        const title = this.add.text(0, 0, "Gundam Tower Battle – Lobby", {
            font: "28px Arial",
            color: "#fff",
        });

        const createBtn = this.rexUI
            .add.label({
                background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x0066cc),
                text: this.add.text(0, 0, "Create Room", {
                    font: "24px Arial",
                    color: "#fff",
                }),
                space: { left: 12, right: 12, top: 8, bottom: 8 },
            })
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.onCreate(cx));

        this.inputField = this.rexUI.add.inputText(0, 0, 160, 40, {
            type: "text",
            maxLength: 6,
            fontSize: "20px",
            placeholder: "Enter Room ID",
        });

        const joinBtn = this.rexUI
            .add.label({
                background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x28a745),
                text: this.add.text(0, 0, "Join", {
                    font: "24px Arial",
                    color: "#fff",
                }),
                space: { left: 20, right: 20, top: 8, bottom: 8 },
            })
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.onJoin());

        const sizer = this.rexUI.add.sizer({
            x: cx,
            y: cy,
            orientation: "y",
            space: { item: 20 },
        });

        sizer.add(title, 0, "center", 0, true);
        sizer.add(createBtn, 0, "center", 0, true);
        sizer.add(this.inputField, 0, "center", 0, true);
        sizer.add(joinBtn, 0, "center", 0, true);
        sizer.layout();
    }

    private onCreate(cx: number) {
        this.roomId = genRoomId();
        this.hostNet = createTrysteroNetwork(this.roomId, true);

        const idText = this.rexUI
            .add.label({
                x: cx,
                y: 260,
                background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x222222),
                text: this.add.text(0, 0, `Room ID: ${this.roomId}`, {
                    font: "24px Courier",
                    color: "#ffff66",
                }),
                space: { left: 12, right: 12, top: 8, bottom: 8 },
            })
            .setOrigin(0.5, 0.5);

        const copyBtn = this.rexUI
            .add.label({
                x: cx,
                y: 300,
                background: this.rexUI.add.roundRectangle(0, 0, 0, 0, 10, 0x444444),
                text: this.add.text(0, 0, "Copy", {
                    font: "20px Arial",
                    color: "#fff",
                }),
                space: { left: 20, right: 20, top: 4, bottom: 4 },
            })
            .setOrigin(0.5, 0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", async () => {
                try {
                    await navigator.clipboard.writeText(this.roomId);
                    copyBtn.getElement("text").setText("✔").setColor("#2ecc71");
                    this.time.delayedCall(1000, () =>
                        copyBtn
                            .getElement("text")
                            .setText("Copy")
                            .setColor("#ffffff")
                    );
                } catch {
                    copyBtn.getElement("text").setText("Failed").setColor("#e74c3c");
                    this.time.delayedCall(1000, () =>
                        copyBtn
                            .getElement("text")
                            .setText("Copy")
                            .setColor("#ffffff")
                    );
                }
            });

        const waitText = this.add
            .text(cx, 350, "Waiting for opponent…", {
                font: "22px Arial",
                color: "#fff",
            })
            .setOrigin(0.5);

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

    private onJoin() {
        const id = (this.inputField.text ?? "").trim().toUpperCase();
        if (/^[A-Z0-9]{6}$/.test(id)) {
            this.scene.start("Play", { roomId: id, isHost: false });
        }
    }
}
