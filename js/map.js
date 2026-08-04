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
      "T..r......WW........r..T", // 8
      "T..r..b...WW...b....r..T", // 9
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
      [8, 13, "편의점 카피24"], [20, 6, "→ 시장길"],
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
      "T......................T", // 13
      "T..F...............F...T", // 14
      "TTTTTTTTTTTTTTTTTTTTTTTT", // 15
    ],
    signs: [
      [5, 1, "한송이플라워"], [13, 1, "황금붕어빵"],
      [8, 9, "글빨장터 무대"], [15, 10, "몰팩토리 공사장"],
      [1, 6, "← 골목"],
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
