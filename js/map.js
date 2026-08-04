// ============================================================
// 맵 데이터와 충돌 판정
// 타일 코드: T=나무 .=잔디 r=길 W=분수/물 F=꽃
//            B=건물벽 D=문(장식) b=벤치
// ============================================================

const TILE = 32;
const MAP_W = 24;
const MAP_H = 16;

// 24 x 16 — 각 줄은 반드시 24자
const MAP_ROWS = [
  "TTTTTTTTTTTTTTTTTTTTTTTT", // 0
  "T.F....BBBB...BBBB..F..T", // 1  소금상회 / 살림살이
  "T......BBDB...BBDB.....T", // 2
  "T..rrrrrrrrrrrrrrrrrr..T", // 3
  "T..r...............Fr..T", // 4  (npc: salt 8,4 / bottle 14,4)
  "T..r..BBBB...BBBB...r..T", // 5  채리로스터스 / 스테이여기
  "T..r..BBDB...BBDB...r..T", // 6
  "T..rrrrrrrrrrrrrrrrrr..T", // 7
  "T..r......WW........r..T", // 8  (npc: cherry 8,8 / bong 14,8)
  "T..r..b...WW...b....r..T", // 9  분수 광장
  "T.BBBB.........BBBB.r..T", // 10 진심반찬 / 골목기획
  "T.BBDB.........BBDB.r..T", // 11
  "T..rrrrrrrrrrrrrrrrrr..T", // 12 (npc: jinsim 5,11→광장에 배치, oh 15,12)
  "T..r....BBDB.......Fr..T", // 13 편의점 카피24 (문: 10,13)
  "T..rrrrrrrrrrrrrrrrrr..T", // 14 (문 앞 10,14에서 상호작용)
  "TTTTTTTTTTTTTTTTTTTTTTTT", // 15
];

// 건물 간판: [열, 행, 텍스트]
const SIGNS = [
  [7, 1, "소금상회"],
  [14, 1, "살림살이"],
  [6, 5, "채리로스터스"],
  [13, 5, "스테이여기"],
  [2, 10, "진심반찬"],
  [15, 10, "골목기획"],
  [8, 13, "편의점 카피24"],
];

// 편의점 문 위치 (앞에 서서 스페이스를 누르면 상점이 열린다)
const SHOP_DOOR = { x: 10, y: 13 };

const SOLID_TILES = new Set(["T", "W", "B", "D", "b"]);

(function validateMap() {
  if (MAP_ROWS.length !== MAP_H) throw new Error("맵 높이 오류: " + MAP_ROWS.length);
  MAP_ROWS.forEach((row, i) => {
    if (row.length !== MAP_W) throw new Error("맵 " + i + "행 길이 오류: " + row.length);
  });
})();

function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return "T";
  return MAP_ROWS[y][x];
}

function isSolid(x, y) {
  if (SOLID_TILES.has(tileAt(x, y))) return true;
  // NPC가 서 있는 칸도 통과 불가
  return NPCS.some((n) => n.x === x && n.y === y);
}
