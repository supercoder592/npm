# 故宮守藝人：兼任館長（Palace Restorer: Curator on Duty）

第一人稱「文物修復 × 博物館經營」模擬遊戲。玩家是故宮北院的修復師兼代理館長：用擬真工序修復國寶、維持展品品質吸引觀光客賺錢，並與電腦操控的南院即時 PK。美術採像素復古（PSX 風低解析度 3D）。

**目前版本：垂直切片原型（7 天短季）**——純網頁、零建置，開瀏覽器即玩。

## 🎮 怎麼玩

### 線上遊玩（GitHub Pages）

1. 到 repo 的 **Settings → Pages → Build and deployment → Source**，選 **GitHub Actions**（只需設定一次）。
2. 之後每次推送到 `main`（或本開發分支）都會自動部署，網址：
   **https://supercoder592.github.io/npm/**
   （也可在 Actions 頁手動觸發 `Deploy to GitHub Pages`。）

### 本機遊玩

```bash
git clone https://github.com/supercoder592/npm.git && cd npm
python3 -m http.server 8000        # ES modules 需要 http 伺服器，不能直接雙擊 index.html
# 瀏覽器開 http://localhost:8000
```

建議使用電腦＋鍵盤滑鼠（Chrome / Edge / Firefox）。

### 操作

| 按鍵 | 功能 |
|---|---|
| WASD／滑鼠 | 移動／視角（點畫面鎖定滑鼠） |
| E | 互動（檢視文物、上修復台） |
| R | 搬起／放下文物 |
| Tab | 館長手冊（館藏、票價、行銷、恆濕櫃、委外、戰況） |
| 右鍵長按 | 修復中的「屏息」精修模式 |
| Esc | 收工／關閉選單 |

### 切片內容

- 第一人稱巡館：正廳 8 展位（含 2 黃金展位 ×1.3）＋修復室，觀光客即時進出
- 開局館藏 5 件：翠玉白菜、肉形石、**毛公鼎（鏽蝕待修）**、**汝窯水仙盆（碎裂待修）**、快雪時晴帖
- **青銅除鏽**：紫外燈檢視標記 → 分辨有害鏽／穩定皮殼 → 塗刮除鏽（手速過快會刮傷）→ 封護材料抉擇
- **陶瓷拼接**：八片碎瓷拖曳旋轉、依相鄰順序咬合 → 黏合劑抉擇 → 全色（比原色「略淺」才符合修復倫理）
- 材料可逆性系統：便宜的快乾膠／環氧樹脂會埋下數日後爆發的**隱患**
- 倫理評分（S–F）計入聲望；重大失誤觸發醜聞，3 次直接敗北
- 經營：門票定價、行銷檔期、恆濕展櫃、委外修復、自由搬展佈展（同類相鄰觸發主題展加成）
- 南院 AI 同規則模擬經營，每晚「晚間新聞」結算 PK，第 7 天總結算分出 4 種結局，之後可續玩無盡模式

## 📁 專案結構

```
index.html / styles.css      入口與像素 UI
src/main.js                  狀態機、主迴圈、輸入
src/world.js / player.js     場景生成、第一人稱控制
src/artifacts.js             文物資料、程序化模型、劣化、主題加成
src/visitors.js              觀光客 agent 與滿意度
src/economy.js / rival.js    日循環結算、南院 AI
src/restore/                 修復台（bench）＋塗刮引擎（scrub）＋陶瓷拼接（shards）
vendor/three.module.min.js   Three.js r160（已 vendor，不依賴 CDN）
```

## 📚 設計文件

| 文件 | 內容 |
|---|---|
| [docs/GDD.md](docs/GDD.md) | 完整企劃：概念、美術方向、核心循環、深度修復系統（六道工序×四大類別）、經營、南北院 PK 與 AI、高自由度、成長系統、事件表、數值公式、技術選型 |
| [docs/artifacts.md](docs/artifacts.md) | 文物圖鑑資料庫：開局館藏、拍賣購藏池、待鑑定箱、南院盤面、病害→工具材料對照表 |

## 開發路線

- ✅ v0.1 設計提案（GDD）
- ✅ **垂直切片原型（本版本）**：青銅除鏽＋陶瓷拼接、7 天短季、南院 AI、Pages 部署
- ⬜ 完整版：書畫揭裱／玉器拋光、30 天季、拍賣會競標、隨機事件庫、三種 AI 性格（詳見 GDD）
