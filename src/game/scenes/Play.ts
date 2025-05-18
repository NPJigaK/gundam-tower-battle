/* ========================================================================= *
 * Play.ts – オンライン版 + ミニマップ／ワールド拡張／自動 spawnY 復活
 * ------------------------------------------------------------------------- *
 *  • Host → Client 50 ms 同期は以前の実装を維持
 *  • 追加機能
 *      1. 動的ワールド拡張 (上方向 200 px ずつ)
 *      2. ミニマップカメラ (右下 160×240) – ワールド中央を常に表示
 *      3. ピース spawnY = 現在タワー頂 -120 px
 *      4. カメラを塔頂 +400 px へ追従
 * ========================================================================= */

import Phaser, { Scene, Input } from "phaser";
import { gundams } from "../const/gundams";
import {
    createTrysteroNetwork,
    TrysteroNetwork,
} from "../../network/trysteroConnection";
import type {
    PieceSync,
    PieceInput,
    GameResult,
    PlayerSide,
    SyncPayload,
    NetCommand,
} from "../../types";

export class Play extends Scene {
    /* ── ネットワーク related ─────────────────────────────────────────── */
    private net?: TrysteroNetwork;
    private isOffline = true;
    private roomId?: string;
    private rematchHost = false;
    private rematchClient = false;
    private overlay?: Phaser.GameObjects.Container;

    /* ── ターン制 ─────────────────────────────────────────────────────── */
    private currentTurn: PlayerSide = "host";
    private get mySide(): PlayerSide {
        return this.net?.isHost ? "host" : "client";
    }
    private get isMyTurn(): boolean {
        return this.currentTurn === this.mySide;
    }

    /* ── ピース管理 ───────────────────────────────────────────────────── */
    private pieceSeq = 0;
    private current?: Phaser.Physics.Matter.Image;
    private dropping?: Phaser.Physics.Matter.Image;
    private settled: Map<string, Phaser.Physics.Matter.Image> = new Map();

    /* ── 静止判定 ─────────────────────────────────────────────────────── */
    private waitingForStill = false;
    private stillFrames = 0;
    private static readonly STILL_NEED = 6;
    private static readonly SPEED_TH = 0.02;

    /* ── UI / 状態 ─────────────────────────────────────────────────────── */
    private score = 0;
    private timeLeft = 600;
    private scoreText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;

    /* ── ワールド／カメラ拡張 ─────────────────────────────────────────── */
    private worldTop = 0; // 上端 y (負)
    private worldHeight = 0; // 総高さ
    private groundTop = 0; // 土台上面 y
    private miniCam!: Phaser.Cameras.Scene2D.Camera;

    /* ── 定数 (旧シングル版を踏襲) ───────────────────────────────────── */
    private static readonly SYNC_MS = 50;
    private static readonly DROP_MARGIN = 120;
    private static readonly TOP_OFFSET = 400;
    private static readonly EXTEND_Y = 200;
    private static readonly FALL_MARGIN = 80;

    constructor() {
        super("Play");
    }

    /* ======================================================================
     * init – room 情報受取
     * ==================================================================== */
    init(data: { roomId?: string; isHost?: boolean; net?: TrysteroNetwork }) {
        if (data.roomId) {
            this.roomId = data.roomId;
            const isNewNet = !data.net;
            this.net =
                data.net ?? createTrysteroNetwork(data.roomId, !!data.isHost);
            this.isOffline = false;

            if (isNewNet) {
                if (this.net.isHost) {
                    this.net.onInput((input) => this.applyRemoteInput(input));
                } else {
                    this.net.onSync((sync) => this.applySync(sync));
                }

                this.net.onResult((r) => this.showGameOver(r));
                this.net.onCommand((c) => this.handleCommand(c));
            }
        }
    }

    /* ======================================================================
     * create
     * ==================================================================== */
    create() {
        this.overlay?.destroy(true);
        this.overlay = undefined;
        this.rematchHost = false;
        this.rematchClient = false;

        this.resetState();

        const { width, height } = this.scale;
        this.worldHeight = height;

        /* 物理ワールド設定 - 床を作らず落下可能にする */
        this.matter.world.setBounds(
            0,
            0,
            width,
            height,
            64,
            false,
            false,
            false,
            false,
        );
        this.matter.world.setGravity(0, 0.8);

        /* 土台 */
        const groundH = 40;
        const groundW = width * 0.5;
        const groundY = height * 0.8;
        this.matter.add.rectangle(width / 2, groundY, groundW, groundH, {
            isStatic: true,
        });
        this.add.rectangle(width / 2, groundY, groundW, groundH, 0x8b4513);
        this.groundTop = groundY - groundH / 2;

        /* UI */
        this.scoreText = this.add.text(10, 10, "Score: 0", { color: "#fff" });
        this.timerText = this.add
            .text(width - 10, 10, `Time: ${this.timeLeft}`, { color: "#fff" })
            .setOrigin(1, 0);

        /* ミニマップカメラ */
        const miniW = 160,
            miniH = 240;
        this.miniCam = this.cameras.add(
            width - miniW - 12,
            height - miniH - 12,
            miniW,
            miniH
        );
        this.miniCam.setBackgroundColor("#9AD1FF");
        this.miniCam.ignore([this.scoreText, this.timerText]);
        this.updateMiniCamZoom();

        /* カウントダウン */
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                if (--this.timeLeft <= 0) this.gameOver();
                this.timerText.setText(`Time: ${this.timeLeft}`);
            },
        });

        /* 入力 */
        this.input.mouse?.disableContextMenu();
        this.registerInputHandlers();

        /* 周期イベント */
        if (this.net?.isHost) {
            this.time.addEvent({
                delay: Play.SYNC_MS,
                loop: true,
                callback: () => this.broadcastAllPieces(),
            });
        } else if (!this.isOffline) {
            this.time.addEvent({
                delay: Play.SYNC_MS,
                loop: true,
                callback: () => this.sendCurrentPosition(),
            });
        }

        /* 初回ピース */
        if (this.isOffline || this.net?.isHost) this.spawnPiece("host");
    }

    /* ------------------------------------------------------------------
     * registerInputHandlers() — マウス操作のイベント登録
     * ------------------------------------------------------------------ */
    private registerInputHandlers() {
        this.input.on(Input.Events.POINTER_MOVE, (p: Input.Pointer) => {
            if (!this.isMyTurn || !this.current) return;
            const x = Phaser.Math.Clamp(p.worldX, 48, this.scale.width - 48);
            this.current.x = x;
        });

        this.input.on(Input.Events.POINTER_UP, (p: Input.Pointer) => {
            if (!this.isMyTurn || !this.current) return;
            p.rightButtonReleased() ? this.rotateCurrent() : this.dropCurrent();
        });
    }

    /**
     * sendCurrentPosition() — クライアント側から現在位置を送信
     */
    private sendCurrentPosition() {
        if (this.net?.isHost || !this.current || !this.isMyTurn) return;
        this.net!.sendInput({ action: "move", x: this.current.x });
    }

    /* ------------------------------------------------------------------
     * spawnPiece() — 新しいブロック(機体)を出現させる
     * ------------------------------------------------------------------ */
    private spawnPiece(turnOwner: PlayerSide) {
        this.currentTurn = turnOwner;

        const meta = gundams[Math.floor(Math.random() * gundams.length)];
        const shapes = this.cache.json.get("shapes");

        /* y を塔頂 - DROP_MARGIN に合わせ、必要ならワールド拡張 */
        const towerTop = this.getTowerTopY();
        const spawnY = towerTop - Play.DROP_MARGIN;
        this.ensureWorldHeight(spawnY);

        this.current = this.matter.add
            .sprite(this.scale.width / 2, spawnY, meta.key, undefined, {
                shape: shapes[meta.key],
            })
            .setScale(meta.scale)
            .setFriction(meta.friction)
            .setBounce(meta.bounce)
            .setMass(meta.mass)
            .setStatic(true)
            .setData("pid", `p${++this.pieceSeq}`)
            .setData("gIdx", gundams.indexOf(meta));

        /* カメラを追従 */
        const targetY = towerTop - Play.TOP_OFFSET;
        if (targetY < this.cameras.main.scrollY)
            this.cameras.main.scrollY = targetY;
    }

    /** 現在操作中のピースを 45 度回転 */
    private rotateCurrent() {
        if (!this.current) return;
        this.current.angle += 45;
        if (!this.net?.isHost) this.net!.sendInput({ action: "rotate" });
    }

    /** 現在操作中のピースを落下させる */
    private dropCurrent() {
        if (!this.current) return;
        this.current.setStatic(false);
        this.dropping = this.current;
        this.current = undefined;
        this.waitingForStill = true;
        this.stillFrames = 0;
        if (!this.net?.isHost) this.net!.sendInput({ action: "drop" });
    }

    /* ------------------------------------------------------------------
     * applyRemoteInput() — クライアントから届いた操作を適用
     * ------------------------------------------------------------------ */
    private applyRemoteInput(input: PieceInput) {
        if (this.currentTurn !== "client" || !this.current) return;
        if (input.action === "move" && typeof input.x === "number")
            this.current.x = input.x;
        else if (input.action === "rotate") this.current.angle += 45;
        else if (input.action === "drop") this.dropCurrent();
    }

    /* ------------------------------------------------------------------
     * broadcastAllPieces() — ホスト側の状態を全クライアントへ送信
     * ------------------------------------------------------------------ */
    private broadcastAllPieces() {
        if (!this.net?.isHost) return;

        const pieces: PieceSync[] = [];
        const push = (s: Phaser.Physics.Matter.Image) =>
            pieces.push({
                id: s.getData("pid"),
                g: s.getData("gIdx"),
                x: Math.round(s.x),
                y: Math.round(s.y),
                angle: Math.round(s.angle),
            });

        this.settled.forEach(push);
        if (this.current) push(this.current);
        if (this.dropping) push(this.dropping);

        this.net.sendSync({
            turn: this.currentTurn,
            pieces,
            worldTop: this.worldTop,
            worldHeight: this.worldHeight,
            scrollY: this.cameras.main.scrollY,
        });
    }

    /* ------------------------------------------------------------------
     * applySync() — ホストから受け取った全ピース情報を反映
     * ------------------------------------------------------------------ */
    private applySync(sync: SyncPayload) {
        this.currentTurn = sync.turn;
        this.input.enabled = this.isMyTurn;

        /* ---------- ① ワールド境界をホスト値に強制合わせ ---------- */
        /* 値を更新して物理 & カメラ両方を再設定 */
        this.worldTop = sync.worldTop;
        this.worldHeight = sync.worldHeight;
        this.cameras.main.scrollY = sync.scrollY;

        const towerTop = this.getTowerTopY();
        const spawnY = towerTop - Play.DROP_MARGIN;
        this.ensureWorldHeight(spawnY);
        this.updateMiniCamZoom(); // ミニマップ再計算

        sync.pieces.forEach((p) => {
            const exists =
                this.settled.get(p.id) ||
                (this.current && this.current.getData("pid") === p.id
                    ? this.current
                    : undefined);
            if (exists) {
                exists.setPosition(p.x, p.y).setAngle(p.angle);
                return;
            }

            const meta = gundams[p.g];
            const shapes = this.cache.json.get("shapes");
            const s = this.matter.add
                .sprite(p.x, p.y, meta.key, undefined, {
                    shape: shapes[meta.key],
                })
                .setScale(meta.scale)
                .setFriction(meta.friction)
                .setBounce(meta.bounce)
                .setMass(meta.mass)
                .setAngle(p.angle)
                .setStatic(true)
                .setData("pid", p.id)
                .setData("gIdx", p.g);
            this.settled.set(p.id, s);

            if (this.isMyTurn && !this.current) this.current = s;
        });
    }

    /* ------------------------------------------------------------------
     * update() — 毎フレーム呼ばれるゲームループ
     *  - ピースの静止判定
     *  - タワー崩落チェック
     * ------------------------------------------------------------------ */
    update() {
        /* 静止判定（ホストのみ） */
        if (this.net?.isHost && this.waitingForStill && this.dropping) {
            const { speed, angularSpeed } = this.dropping
                .body as MatterJS.BodyType;
            speed < Play.SPEED_TH && angularSpeed < Play.SPEED_TH
                ? this.stillFrames++
                : (this.stillFrames = 0);

            if (this.stillFrames >= Play.STILL_NEED) {
                this.settled.set(this.dropping.getData("pid"), this.dropping);
                this.dropping = undefined;
                this.waitingForStill = false;

                /* ターン交代 & 新ピース */
                this.currentTurn =
                    this.currentTurn === "host" ? "client" : "host";
                this.spawnPiece(this.currentTurn);
                this.broadcastAllPieces();
            }
        }

        /* カメラ中央寄せ (X) */
        this.cameras.main.scrollX =
            -(this.cameras.main.width - this.scale.width) / 2;

        /* タワー崩落検知 - ブロックが画面下 +FALL_MARGIN を越えたら終了 */
        const pieces: Phaser.Physics.Matter.Image[] = [];
        this.settled.forEach((s) => pieces.push(s));
        if (this.dropping) pieces.push(this.dropping);
        if (this.current) pieces.push(this.current);

        for (const s of pieces)
            if (s.y > this.scale.height + Play.FALL_MARGIN) {
                this.gameOver();
                break;
            }
    }

    /* ------------------------------------------------------------------
     * getTowerTopY() — 現在の塔の最上部Y座標を取得
     * ------------------------------------------------------------------ */
    private getTowerTopY(): number {
        let minY = this.groundTop;
        this.settled.forEach((p) => (minY = Math.min(minY, p.getBounds().top)));
        if (this.current) minY = Math.min(minY, this.current.getBounds().top);
        return minY;
    }

    /** ワールド上端を必要に応じて拡張 */
    private ensureWorldHeight(spawnY: number) {
        while (spawnY < this.worldTop + 100) {
            this.worldTop -= Play.EXTEND_Y;
            this.worldHeight += Play.EXTEND_Y;

            const w = this.scale.width;
            this.matter.world.setBounds(
                0,
                this.worldTop,
                w,
                this.worldHeight,
                64,
                false,
                false,
                false,
                false,
            );
            this.cameras.main.setBounds(0, this.worldTop, w, this.worldHeight);
            this.updateMiniCamZoom();
        }
    }

    /** ミニマップのズーム量を再計算 */
    private updateMiniCamZoom() {
        const zoomX = this.miniCam.width / this.scale.width;
        const zoomY = this.miniCam.height / this.worldHeight;
        this.miniCam.setZoom(Math.min(zoomX, zoomY));

        const centerX = this.scale.width / 2;
        const centerY = this.worldTop + this.worldHeight / 2;
        this.miniCam.centerOn(centerX, centerY);
    }

    /* ------------------------------------------------------------------
     * gameOver() — ゲーム終了処理
     * ------------------------------------------------------------------ */
    private gameOver() {
        const winner: GameResult =
            this.currentTurn === "host" ? "client" : "host";
        if (this.net?.isHost) this.net.sendResult(winner);
        this.showGameOver(winner);
    }

    /** 結果表示と選択肢 */
    private showGameOver(winner: GameResult) {
        if (this.overlay) return;
        const { width, height } = this.scale;
        this.overlay = this.add.container(0, 0);

        const bg = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0);
        const title = this.add
            .text(width / 2, height / 2 - 80, "Game Over", {
                font: "48px Arial",
                color: "#ffffff",
            })
            .setOrigin(0.5);
        const winnerText = this.add
            .text(width / 2, height / 2 - 40, `Winner: ${winner}`, {
                font: "32px Arial",
                color: "#ffffff",
            })
            .setOrigin(0.5);

        const rematchBtn = this.add
            .text(width / 2, height / 2 + 20, "Rematch", {
                font: "28px Arial",
                color: "#ffff00",
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.requestRematch());

        const lobbyBtn = this.add
            .text(width / 2, height / 2 + 60, "Lobby", {
                font: "28px Arial",
                color: "#ffff00",
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on("pointerup", () => this.gotoLobby());

        this.overlay.add([bg, title, winnerText, rematchBtn, lobbyBtn]);
    }

    private requestRematch() {
        if (this.net) {
            if (this.net.isHost) {
                this.rematchHost = true;
                this.net.sendCommand("rematch");
                if (this.rematchClient) this.startRematch();
            } else {
                this.rematchClient = true;
                this.net.sendCommand("rematch");
            }
        } else {
            this.scene.restart();
        }
    }

    private gotoLobby() {
        if (this.net) this.net.sendCommand("lobby");
        this.resetState();
        this.scene.start("Lobby");
    }

    private handleCommand(cmd: NetCommand) {
        if (cmd === "rematch") {
            if (this.net?.isHost) {
                this.rematchClient = true;
                if (this.rematchHost) this.startRematch();
            } else {
                this.rematchHost = true;
            }
        } else if (cmd === "restart") {
            this.startRematchLocal();
        } else if (cmd === "lobby") {
            this.scene.start("Lobby");
        }
    }

    private startRematch() {
        this.net?.sendCommand("restart");
        this.startRematchLocal();
    }

    /** 盤面と状態を初期化 */
    private resetState() {
        this.current?.destroy();
        this.dropping?.destroy();
        this.settled.forEach((p) => p.destroy());
        this.settled.clear();

        this.current = this.dropping = undefined;
        this.stillFrames = 0;
        this.waitingForStill = false;
        this.pieceSeq = 0;
        this.score = 0;
        this.timeLeft = 600;

        const { width, height } = this.scale;
        this.worldTop = 0;
        this.worldHeight = height;
        this.matter.world.setBounds(
            0,
            0,
            width,
            height,
            64,
            false,
            false,
            false,
            false,
        );
        this.cameras.main.setBounds(0, 0, width, height);
        this.cameras.main.scrollY = 0;
        if (this.miniCam) this.updateMiniCamZoom();
    }

    private startRematchLocal() {
        this.overlay?.destroy(true);
        this.overlay = undefined;
        this.resetState();
        this.scene.restart({ roomId: this.roomId, isHost: this.net?.isHost, net: this.net });
    }
}
