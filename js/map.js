// ============================================================
// 멀티맵 시스템: 마을(town), 시장길(market), 사무실 실내(office)
// 타일 코드:
//   실외 — T=나무 .=잔디 r=길 W=분수 F=꽃 B=벽 D=문(장식) b=벤치
//          S=무대 M=공사펜스
//   실내 — ' '=공허 x=벽 f=마루 o=러그 k=책상 p=화분 g=책장
//   공통 — E=출입구(밟으면 이동)
// ============================================================

const TILE = 32;
const MAP_W = 24;
const MAP_H = 16;

const MAPS = {
  town: {
    name: "글빨골목",
    rows: [
      "TTTTTTTTTTTTTTTTTTTTTTTT", // 0
      "T.F....BBBB...BBBB..F..T", // 1  소금상회 / 살림살이
      "T......BBDB...BBDB.....T", // 2
      "T..rrrrrrrrrrrrrrrrrr..T", // 3
      "T..r...............Fr..T", // 4
      "T..r..BBBB...BBBB...r..T", // 5  채리로스터스 / 스테이여기
      "T..r..BBDB...BBDB...r..T", // 6
      "T..rrrrrrrrrrrrrrrrrrrrr", // 7  → 동쪽 끝(23,7)에서 시장길로
      "T..r......WW....LLLLr..T", // 8  연습 마당(풀숲) 시작
      "T..r..b...WW...bLLLLr..T", // 9
      "T.BBBB.........BBBB.r..T", // 10 진심반찬 / 골목기획
      "T.BBDB.........BBEB.r..T", // 11 골목기획 입구 E(17,11)
      "T..rrrrrrrrrrrrrrrrrr..T", // 12
      "T..r....BBDB.......Fr..T", // 13 편의점 카피24 (문 10,13)
      "T..rrrrrrrrrrrrrrrrrr..T", // 14
      "TTTTTTTTTTTTTTTTTTTTTTTT", // 15
    ],
    signs: [
      [7, 1, "소금상회"], [14, 1, "살림살이"],
      [6, 5, "채리로스터스"], [13, 5, "스테이여기"],
      [2, 10, "진심반찬"], [15, 10, "골목기획"],
      [8, 13, "편의점 카피24"], [20, 6, "→ 시장길"], [17, 8, "🌱 연습 마당"],
    ],
    warps: [
      { x: 17, y: 11, to: "office", tx: 11, ty: 10 },
      { x: 23, y: 7, to: "market", tx: 1, ty: 7, requires: "marketOpen", lockMsg: "아직 시장길에 갈 일이 없다. 골목 의뢰부터 해결하자." },
    ],
  },

  market: {
    name: "시장길",
    rows: [
      "TTTTTTTTTTTTTTTTTTTTTTTT", // 0
      "T....BBBB....BBBB......T", // 1  한송이플라워 / 황금붕어빵
      "T....BBDB....BBDB......T", // 2
      "T..rrrrrrrrrrrrrrrrrr..T", // 3
      "T..r................r..T", // 4
      "T..r..b..........b..r..T", // 5
      "T..r................r..T", // 6
      "rrrrr...............r..T", // 7  ← 서쪽 끝(0,7)에서 마을로
      "T..r................r..T", // 8
      "T..r....SSSS........r..T", // 9  글빨장터 무대
      "T..r....SSSS...MMMMMr..T", // 10 몰팩토리 공사펜스
      "T..r...........MMMMMr..T", // 11
      "T..rrrrrrrrrrrrrrrrrr..T", // 12
      "T........LLLLLL........T", // 13 연습 마당(풀숲) — 지나가면 즉흥 훈련이 걸릴 수 있다
      "T..F.....LLLLLL.....F..T", // 14
      "TTTTTTTTTTTTTTTTTTTTTTTT", // 15
    ],
    signs: [
      [5, 1, "한송이플라워"], [13, 1, "황금붕어빵"],
      [8, 9, "글빨장터 무대"], [15, 10, "몰팩토리 공사장"],
      [1, 6, "← 골목"], [9, 13, "🌱 연습 마당"],
    ],
    warps: [{ x: 0, y: 7, to: "town", tx: 22, ty: 7 }],
  },

  office: {
    name: "골목기획 사무실",
    rows: [
      "                        ", // 0
      "                        ", // 1
      "    xxxxxxxxxxxxxxxx    ", // 2
      "    xggggggxxggggggx    ", // 3
      "    xffffffffffffffx    ", // 4
      "    xfffffffffffffpx    ", // 5  오팀장 (11,5)
      "    xfffkkkfkkkffffx    ", // 6  책상 (가운데 통로)
      "    xffffffffffffffx    ", // 7
      "    xfoofffffffooffx    ", // 8
      "    xffffffffffffffx    ", // 9
      "    xpffffffffffffpx    ", // 10
      "    xxxxxxxExxxxxxxx    ", // 11 출구 E(11,11)
      "                        ", // 12
      "                        ", // 13
      "                        ", // 14
      "                        ", // 15
    ],
    signs: [[8, 2, "골목기획 사무실"]],
    warps: [{ x: 11, y: 11, to: "town", tx: 17, ty: 12 }],
  },
};

// ---------- 건물 테마 ----------
// 간판 텍스트를 키로, 건물마다 다른 색/스타일을 지정한다 (포켓몬/영웅서기풍으로 건물을 구분).
const BUILDING_THEMES = {
  "소금상회": { wall: "#caa06a", wallDark: "#a8834e", roof: "#8a4a30", roofDark: "#5e3220", trim: "#f4e6c8", window: "#5c3a22", style: "bakery" },
  "살림살이": { wall: "#7fb8ae", wallDark: "#5f9a90", roof: "#48586a", roofDark: "#313e4c", trim: "#eaf6f4", window: "#26333a", style: "modern" },
  "채리로스터스": { wall: "#e6a0ae", wallDark: "#c67e8c", roof: "#7a3a42", roofDark: "#552830", trim: "#fff0f2", window: "#3a2024", style: "cafe" },
  "스테이여기": { wall: "#9aaee0", wallDark: "#7a8ec2", roof: "#33406a", roofDark: "#222b4a", trim: "#eef2ff", window: "#20263e", style: "guesthouse" },
  "진심반찬": { wall: "#c9b184", wallDark: "#a8905e", roof: "#5c6a3a", roofDark: "#3e4926", trim: "#f2ead0", window: "#3a2e1a", style: "hanok" },
  "골목기획": { wall: "#9098a6", wallDark: "#707886", roof: "#3a3e48", roofDark: "#24272e", trim: "#dfe4ea", window: "#1c2027", style: "office" },
  "편의점 카피24": { wall: "#3a6fb0", wallDark: "#28568f", roof: "#e8b83c", roofDark: "#c2941f", trim: "#ffffff", window: "#173a5c", style: "conbini" },
  "한송이플라워": { wall: "#e8b8cc", wallDark: "#cf95ac", roof: "#5a8a5e", roofDark: "#3d6640", trim: "#fff5f8", window: "#3a2c34", style: "flower" },
  "황금붕어빵": { wall: "#e8a04c", wallDark: "#c6832e", roof: "#7a4020", roofDark: "#552c14", trim: "#fff2dc", window: "#3a2410", style: "stall" },
};
const DEFAULT_BUILDING_THEME = { wall: "#b0705a", wallDark: "#9a5e4a", roof: "#5a3a3a", roofDark: "#432a2a", trim: "#f0d8c0", window: "#3a2a24", style: "plain" };

// 현재 맵의 (x,y) 타일이 어느 건물(테마)에 속하는지 캐시. 간판 위치에서 시작해 연결된
// B/D/E 타일을 BFS로 채우는 방식이라, 맵 배열을 손으로 다시 세지 않아도 항상 정확하다.
let buildingThemeGrid = null;
let buildingThemeMapId = null;

function computeBuildingThemes() {
  const m = MAPS[currentMapId];
  const rows = m.rows;
  const isBuildingTile = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && "BDE".includes(rows[y][x]);
  const grid = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(null));
  m.signs.forEach(([sx, sy, text]) => {
    const theme = BUILDING_THEMES[text];
    if (!theme || !isBuildingTile(sx, sy) || grid[sy][sx]) return;
    const queue = [[sx, sy]];
    grid[sy][sx] = theme;
    while (queue.length) {
      const [cx, cy] = queue.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = cx + dx, ny = cy + dy;
        if (isBuildingTile(nx, ny) && !grid[ny][nx]) {
          grid[ny][nx] = theme;
          queue.push([nx, ny]);
        }
      });
    }
  });
  buildingThemeGrid = grid;
  buildingThemeMapId = currentMapId;
}

function themeAt(x, y) {
  if (buildingThemeMapId !== currentMapId) computeBuildingThemes();
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
  return buildingThemeGrid[y][x] || null;
}

// 편의점 문 (마을에서 앞에 서서 스페이스)
const SHOP_DOOR = { map: "town", x: 10, y: 13 };

const SOLID_TILES = new Set(["T", "W", "B", "D", "b", "S", "M", "x", "k", "p", "g", " "]);

// 현재 맵 (game.js가 setCurrentMap으로 변경)
let currentMapId = "town";
function setCurrentMap(id) {
  currentMapId = id;
}
function currentMap() {
  return MAPS[currentMapId];
}

(function validateMaps() {
  Object.entries(MAPS).forEach(([id, m]) => {
    if (m.rows.length !== MAP_H) throw new Error(id + " 높이 오류");
    m.rows.forEach((row, i) => {
      if (row.length !== MAP_W) throw new Error(id + " " + i + "행 길이 오류: " + row.length);
    });
  });
})();

function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return currentMapId === "office" ? " " : "T";
  return currentMap().rows[y][x];
}

function npcsHere() {
  return NPCS.filter((n) => n.map === currentMapId);
}

function isSolid(x, y) {
  if (SOLID_TILES.has(tileAt(x, y))) return true;
  return npcsHere().some((n) => n.x === x && n.y === y);
}

function warpAt(x, y) {
  return currentMap().warps.find((w) => w.x === x && w.y === y) || null;
}
