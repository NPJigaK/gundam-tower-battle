declare global {
    interface Window {
        rexuiplugin: any;
        rexinputtextplugin: any;
    }
}

declare module "phaser" {
    interface Scene {
        rexUI: any;
        rexInputText: any;
    }
}

export {};
