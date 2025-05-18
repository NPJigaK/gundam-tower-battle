/* ========================================================================== *
 *  Play.ts
 * -------------------------------------------------------------------------- *
 *  実際にゲームループを司る Scene クラス です。
 *  - ブロック（＝ガンダム機体）を 1 体ずつ生成しては落とし、塔を作ります
 *  - ブロックたちが完全に静止したら次のブロックを出現させます
 *  - どれかが画面の一番下 +80 px を超えて落ちたらゲームオーバー
 *  - カメラ・ワールド境界・ミニマップの動的拡張もすべてここで行います
 * ======================================================================= */

import { Scene, Input } from "phaser";
import { gundams } from "../const/gundams"; // ← ピースのメタ定義
import { EventBus } from "../EventBus"; // ← 簡易デバッグ用

/* -------------------------------------------------------------------------- *
 *  Scene クラス本体
 *  （Phaser では 1 つのゲーム画面＝1 Scene。create → update を繰り返す）
 * ------------------------------------------------------------------------ */
export class Play extends Scene {
    /* ─────────────────────── UI / ゲーム進行ステート ──────────────────── */
    /** 現在のスコア（＝落としたブロック数）。GameOver で送信する            */
    private score = 0;
    /** 残り時間（秒）。毎秒デクリメントし 0 になったら強制 GameOver         */
    private timeLeft = 600;

    /** 左上 “Score: ” の Text  */
    private scoreText!: Phaser.GameObjects.Text;
    /** 右上 “Time: ” の Text   */
    private timerText!: Phaser.GameObjects.Text;

    /* ─────────────────────── ピース状態管理 ─────────────────────────── */
    /** 空中で操作待機している **静止** ピース（カーソル追従）               */
    private current?: Phaser.Physics.Matter.Image;
    /** dynamic 化して落下中のピース。静止を検知したら settled へ移動        */
    private dropping?: Phaser.Physics.Matter.Image;
    /** 完全停止判定済みのピースたち（dynamic のまま塔を構成する）          */
    private settled: Phaser.Physics.Matter.Image[] = [];

    /* ────────────── “全ピース静止” 判定パラメータ ───────────────────── */
    /** 連続静止フレーム数（動いたら 0 に戻す）                             */
    private stillFrames = 0;
    /** true の間は “全ピース静止” を監視し、静止確定で次ピース生成           */
    private waitingForStill = false;
    /** 速度がこれ未満なら「ほぼ静止」（単位: px/step）                     */
    private static readonly MAX_SPEED = 0.01;
    /** 角速度がこれ未満なら「ほぼ静止」（単位: rad/step）                  */
    private static readonly MAX_ANG = 0.01;
    /** 上 2 条件を **NEED_STILL** フレーム連続で満たしたら静止確定         */
    private static readonly NEED_STILL = 90; // ≒1.5 秒

    /* ────────────── カメラ & ワールド拡張に関する定数 ────────────────── */
    /** 次ピースは「塔頂(＋土台) の 120px 上」に出現させる                  */
    private static readonly DROP_MARGIN = 120;
    /** メインカメラは塔頂 +400px を常に映し続ける                          */
    private static readonly TOP_OFFSET = 400;
    /** ワールド上端に達したら 1 回ごとに 200px ずつ上へ延長する             */
    private static readonly EXTEND_Y = 200;

    /* ────────────── 動的に変わるワールド境界情報 ────────────────────── */
    /** 現在のワールド最上端（負値で上方向へ拡張していく）                  */
    private worldTop = 0;
    /** ワールドの総高さ（下端 0 〜 上端 worldTop）                         */
    private worldHeight = 0;
    /** 土台(ground) の当たり判定 “上面 y”（塔頂計算に含めるため保持）       */
    private groundTop = 0;

    /** ミニマップ用カメラ（右下 160×240）                                  */
    private miniCam!: Phaser.Cameras.Scene2D.Camera;

    constructor() {
        super("Play");
    }

    /* ====================================================================== *
     *  create() : シーン初期化。ここでステージ・UI・入力を全て構築する
     * ==================================================================== */
    create(): void {
        /* 画面サイズを取得してワールド初期高さとして保存 ---------------- */
        const { width, height } = this.scale;
        this.worldHeight = height;

        /* ──────────── Matter World ▸ 物理シミュレーション設定 ───────── */
        this.matter.world.createDebugGraphic(); // 緑線ワイヤーフレーム
        this.matter.world.setBounds(
            /* x,y,width,height        */ 0,
            0,
            width,
            height,
            /* thickness               */ 
            64,
            /* 左 右 下 上 の壁         */ 
            false,
            false,
            false,
            false
        ); // ← 左右の壁を除去
        this.matter.world.setGravity(0, 0.8); // 標準より軽い重力
        this.matter.world.engine.positionIterations = 12; // すり抜け防止
        this.matter.world.engine.velocityIterations = 12;

        /* ──────────── Ground（土台）生成 ───────────────────────── */
        const groundH = 40;
        const groundW = width * 0.5;
        const groundY = height * 0.8;
        // 物理 Body（isStatic=true なので動かない）
        this.matter.add.rectangle(width / 2, groundY, groundW, groundH, {
            isStatic: true,
            friction      : 0.9,  // 動摩擦   ← 土台だけ高めに
            frictionStatic: 1.0,  // 静止摩擦 ← 土台だけ高めに
        });
        // 見た目用の矩形（茶色）
        this.add.rectangle(width / 2, groundY, groundW, groundH, 0x8b4513);
        // 土台上面 y（衝突判定は中心 y 基準なので半分引く）
        this.groundTop = groundY - groundH / 2;

        /* ──────────── UI: スコア / タイマー ───────────────────── */
        this.scoreText = this.add
            .text(10, 10, `Score: ${this.score}`, { color: "#fff" })
            .setScrollFactor(0); // カメラに影響されない
        this.timerText = this.add
            .text(width - 10, 10, `Time: ${this.timeLeft}`, { color: "#fff" })
            .setOrigin(1, 0)
            .setScrollFactor(0);

        /* ──────────── ミニマップカメラ ───────────────────────── */
        const miniW = 160,
            miniH = 240;
        this.miniCam = this.cameras.add(
            width - miniW - 12,
            height - miniH - 12,
            miniW,
            miniH
        );
        this.miniCam.setBackgroundColor("#9AD1FF"); // 水色枠
        this.miniCam.ignore([this.scoreText, this.timerText]); // UI を除外
        this.updateMiniCamZoom(); // 初回ズーム計算

        /* ──────────── 1 秒タイマー ▸ timeLeft-- / GameOver ------ */
        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.timeLeft--;
                this.timerText.setText(`Time: ${this.timeLeft}`);
                if (this.timeLeft <= 0) this.gameOver();
            },
        });

        /* ──────────── 入力イベント設定 ───────────────────────── */
        this.input.mouse?.disableContextMenu(); // 右クリックメニュー抑止

        // マウス移動 → current が static 状態のときのみ X 座標を追従
        this.input.on(Input.Events.POINTER_MOVE, (p: Input.Pointer) => {
            if (!this.input.enabled || !this.current) return;
            this.current.x = Phaser.Math.Clamp(p.worldX, 48, width - 48);
        });

        // マウス離し：
        //   右クリック：45° 回転
        //   左クリック：ピースを drop（dynamic 化）して still 監視モード突入
        this.input.on(Input.Events.POINTER_UP, (p: Input.Pointer) => {
            if (!this.input.enabled || !this.current) return;
            if (p.rightButtonReleased()) {
                this.current.angle += 45; // 右クリック回転
                return;
            }
            // --- Drop 開始 ---
            this.current.setStatic(false).setFriction(0.8);
            this.dropping = this.current;
            this.current = undefined;

            this.waitingForStill = true;
            this.stillFrames = 0;
            this.input.enabled = false; // 停止確定まで操作禁止
            this.scoreText.setText(`Score: ${++this.score}`);
        });

        // Start with input disabled to ignore pointer events from the previous
        // scene (e.g., releasing the Restart button). It is re-enabled shortly
        // after the scene starts to avoid an unintended immediate drop.
        this.input.enabled = false;
        this.time.delayedCall(100, () => {
            this.input.enabled = true;
        });

        /* ──────────── 最初のピースを出現 ─────────────────────── */
        this.spawnPiece();
        EventBus.emit("scene-ready", this); // 開発デバッグ用
    }

    /* ====================================================================== *
     *  spawnPiece() : 塔の一番上 + DROP_MARGIN に current ピースを生成
     * ==================================================================== */
    private spawnPiece() {
        /* 1) スポーン位置を決定（x は中央固定、y は塔頂 -120px） */
        const meta = gundams[Math.floor(Math.random() * gundams.length)];
        const x = this.scale.width / 2;
        const towerTop = this.getTowerTopY();
        const y = towerTop - Play.DROP_MARGIN;

        /* 2) y がワールド上端を突き抜けそうなら世界を延長する */
        this.ensureWorldHeight(y);

        /* 3) ピース生成（Matter + 複雑ポリゴン shape） */
        const shapes = this.cache.json.get("shapes");
        this.current = this.matter.add
            .sprite(x, y, meta.key, undefined, { shape: shapes[meta.key] })
            .setScale(meta.scale)
            .setFriction(meta.friction)
            .setBounce(meta.bounce)
            .setMass(meta.mass)
            .setStatic(true); // 空中で静止待機

        /* 4) 生成直後、必要ならメインカメラを上へジャンプさせる */
        const targetY = towerTop - Play.TOP_OFFSET;
        if (targetY < this.cameras.main.scrollY) {
            this.cameras.main.scrollY = targetY;
        }
    }

    /* ====================================================================== *
     *  update() : 毎フレーム呼ばれるメインループ
     * ==================================================================== */
    update(): void {
        /* 1) GameOver 判定 – ブロックが画面下 +80px を超えたら終了 */
        const toWatch = this.waitingForStill
            ? [...this.settled, ...(this.dropping ? [this.dropping] : [])]
            : this.settled;
        if (toWatch.some((p) => p.y > this.scale.height + 80)) {
            this.gameOver();
            return;
        }

        /* 2) “全ピース静止” を監視。NEED_STILL フレーム連続静止で確定 */
        if (this.waitingForStill) {
            const all = [
                ...this.settled,
                ...(this.dropping ? [this.dropping] : []),
            ];
            const moving = all.some((p) => {
                const b = p.body as MatterJS.BodyType;
                return (
                    b.speed >= Play.MAX_SPEED || b.angularSpeed >= Play.MAX_ANG
                );
            });
            if (moving) this.stillFrames = 0;
            else if (++this.stillFrames >= Play.NEED_STILL) {
                if (this.dropping) {
                    this.settled.push(this.dropping);
                    this.dropping = undefined;
                }
                this.waitingForStill = false;
                this.input.enabled = true;
                if (this.timeLeft > 0) this.spawnPiece();
            }
        }

        /* 3) カメラ X を常に画面中央に合わせる（幅が広いため） */
        this.cameras.main.scrollX =
            -(this.cameras.main.width - this.scale.width) / 2;
    }

    /* ====================================================================== *
     *  gameOver() : ピース落下 or タイムアップで呼ばれるリセット処理
     * ==================================================================== */
    private gameOver() {
        /* ① GameOver シーンへスコアを渡して遷移 */
        this.scene.start("GameOver", { score: this.score });

        /* ② すべての GameObject を安全に破棄 */
        this.current?.destroy();
        this.dropping?.destroy();
        this.settled.forEach((p) => p.destroy());
        this.settled = [];

        /* ③ 変数を初期値に戻す（同 Scene 再利用を想定） */
        this.current = this.dropping = undefined;
        this.stillFrames = 0;
        this.waitingForStill = false;
        this.score = 0;
        this.timeLeft = 600;

        /* ④ ワールド & カメラ境界を元のサイズへリセット */
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
            false
        );
        this.cameras.main.setBounds(0, 0, width, height);
        this.cameras.main.scrollY = 0;
        this.updateMiniCamZoom(); // ミニマップ再計算
    }

    /* ====================================================================== *
     *  Utility 関数
     * ==================================================================== */

    /** 塔（＋土台）の最上端 y を取得（値が小さいほど高い）*/
    private getTowerTopY(): number {
        let minY = this.groundTop;
        [...this.settled, ...(this.dropping ? [this.dropping] : [])].forEach(
            (p) => {
                minY = Math.min(minY, p.getBounds().top);
            }
        );
        return minY;
    }

    /** spawnY が上端 +100px を越えたら EXTEND_Y ずつワールドを延長 */
    private ensureWorldHeight(spawnY: number) {
        while (spawnY < this.worldTop + 100) {
            this.worldTop -= Play.EXTEND_Y;
            this.worldHeight += Play.EXTEND_Y;

            const w = this.scale.width;
            // 物理 & カメラ境界を同時に更新（上方向だけ伸ばす）
            this.matter.world.setBounds(
                0,
                this.worldTop,
                w,
                this.worldHeight,
                64,
                false,
                false,
                false,
                false
            );
            this.cameras.main.setBounds(0, this.worldTop, w, this.worldHeight);
            this.updateMiniCamZoom();
        }
    }

    /** ミニマップのズーム & 位置を“ワールド中央”へ合わせ直す */
    private updateMiniCamZoom() {
        // ズーム = カメラ枠 / ワールドサイズ（入る方の倍率を採用）
        const zoomX = this.miniCam.width / this.scale.width;
        const zoomY = this.miniCam.height / this.worldHeight;
        this.miniCam.setZoom(Math.min(zoomX, zoomY));

        // 中央位置を算出して centerOn
        const centerX = this.scale.width / 2;
        const centerY = this.worldTop + this.worldHeight / 2;
        this.miniCam.centerOn(centerX, centerY);
    }
}
