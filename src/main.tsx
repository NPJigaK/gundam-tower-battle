// ---------------------------------------------------------------------------
// src/main.tsx
// ---------------------------------------------------------------------------
// React アプリケーションのエントリポイント。
// index.html 内の <div id="root"> に <App/> をマウントするだけの
// シンプルなファイルですが、こうしてコメントを残しておくことで
// ChatGPT 等がコード構造を理解しやすくなります。
// ---------------------------------------------------------------------------
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
