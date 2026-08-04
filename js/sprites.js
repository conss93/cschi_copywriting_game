// ============================================================
// 프로그래매틱 픽셀아트: 타일 + 캐릭터 스프라이트
// 외부 이미지 없이 캔버스에 직접 그린다.
// ============================================================

// ---------- 캐릭터 도트 패턴 (12 x 13) ----------
// H=머리카락 S=피부 E=눈 C=옷 c=옷(음영) P=바지 B=신발 .=투명
const BODY_SHORT = [
  "....HHHH....",
  "...HHHHHH...",
  "...HSSSSH...",
  "...SESSES...",
  "....SSSS....",
  "...CCCCCC...",
  "..CCCCCCCC..",
  ".SCCcCCcCCS.",
  "..CCCCCCCC..",
  "...CCCCCC...",
  "...PPPPPP...",
  "...PP..PP...",
  "...BB..BB...",
];

const BODY_LONG = [
  "....HHHH....",
  "...HHHHHH...",
  "..HHSSSSHH..",
  "..HSESSESH..",
  "..HHSSSSHH..",
  "..HCCCCCCH..",
  ".HCCCCCCCCH.",
  ".SCCcCCcCCS.",
  "..CCCCCCCC..",
  "...CCCCCC...",
  "...PPPPPP...",
  "...PP..PP...",
  "...BB..BB...",
];

// 모자 패턴(캐릭터 위 2줄에 겹쳐 그림): A=모자색
const HATS = {
  toque: ["..AAAAAAAA..", "...AAAAAA..."], // 제빵사 모자
  cap: ["....AAAA....", "...AAAAAAA.."], // 캡모자
  none: null,
};

// 캐릭터 프리셋
const CHAR_PRESETS = {
  playerA: { body: BODY_SHORT, hair: "#4a3628", skin: "#f0c8a0", cloth: "#e0704a", cloth2: "#c05836", pants: "#3a4a6a", hat: "none" },
  playerB: { body: BODY_LONG, hair: "#2a2a3a", skin: "#f0c8a0", cloth: "#4a8ae0", cloth2: "#3670c0", pants: "#4a4a52", hat: "none" },
  baker: { body: BODY_SHORT, hair: "#7a7a7a", skin: "#e8b890", cloth: "#e8e0d0", cloth2: "#c8c0b0", pants: "#5a4a3a", hat: "toque", hatColor: "#f5f0e8" },
  shop: { body: BODY_SHORT, hair: "#3a3a3a", skin: "#f0c8a0", cloth: "#5cb8a7", cloth2: "#48998a", pants: "#3a3a44", hat: "none", glasses: true },
  barista: { body: BODY_LONG, hair: "#8a4a3a", skin: "#f5d0aa", cloth: "#e06c88", cloth2: "#c05470", pants: "#4a4a52", hat: "cap", hatColor: "#e06c88" },
  host: { body: BODY_SHORT, hair: "#5a4a3a", skin: "#e8b890", cloth: "#7c8ce0", cloth2: "#6272c4", pants: "#3a4a5a", hat: "none" },
  cook: { body: BODY_SHORT, hair: "#b8b8b8", skin: "#e8b088", cloth: "#a0c25c", cloth2: "#86a648", pants: "#5a5a4a", hat: "toque", hatColor: "#f0ead8" },
  director: { body: BODY_LONG, hair: "#2a2a2a", skin: "#f0c8a0", cloth: "#c25c5c", cloth2: "#a44848", pants: "#2a2a34", hat: "none", glasses: true },
};

// 캐릭터를 (px, py) 픽셀 위치에 그린다. bob=걷기 애니메이션 오프셋
function drawCharacter(ctx, presetName, px, py, bob, outfitPalette) {
  const p = CHAR_PRESETS[presetName] || CHAR_PRESETS.playerA;
  const cloth = (outfitPalette && outfitPalette.cloth) || p.cloth;
  const cloth2 = (outfitPalette && outfitPalette.cloth2) || p.cloth2;
  const colors = { H: p.hair, S: p.skin, E: "#2a2020", C: cloth, c: cloth2, P: p.pants, B: "#2a2a2a" };
  const scale = 2;
  const w = 12 * scale;
  const ox = px + (TILE - w) / 2;
  const oy = py + TILE - 13 * scale + (bob || 0);

  p.body.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const ch = row[rx];
      if (ch === ".") continue;
      ctx.fillStyle = colors[ch] || "#f0f";
      ctx.fillRect(ox + rx * scale, oy + ry * scale, scale, scale);
    }
  });

  // 모자
  const hat = HATS[p.hat];
  if (hat) {
    ctx.fillStyle = p.hatColor || "#fff";
    hat.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === "A") ctx.fillRect(ox + rx * scale, oy + (ry - 1) * scale, scale, scale);
      }
    });
  }
  // 안경
  if (p.glasses) {
    ctx.fillStyle = "rgba(40,40,50,0.85)";
    const eyeRow = p.body === BODY_LONG ? 3 : 3;
    ctx.fillRect(ox + 3 * scale, oy + eyeRow * scale, 3 * scale, scale);
    ctx.fillRect(ox + 7 * scale, oy + eyeRow * scale, 3 * scale, scale);
  }
}

// ---------- 타일 그리기 ----------
// 시드 기반 의사난수: 프레임마다 같은 노이즈 패턴 유지
function noise(x, y, i) {
  const n = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawTile(ctx, code, tx, ty, time) {
  const px = tx * TILE;
  const py = ty * TILE;

  // 바닥 (모든 타일의 기본)
  ctx.fillStyle = "#7fb069";
  ctx.fillRect(px, py, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    if (noise(tx, ty, i) > 0.6) {
      ctx.fillStyle = "#6fa059";
      ctx.fillRect(px + Math.floor(noise(tx, ty, i + 10) * 28), py + Math.floor(noise(tx, ty, i + 20) * 28), 4, 4);
    }
  }

  switch (code) {
    case "r": { // 길
      ctx.fillStyle = "#d8c8a8";
      ctx.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#c8b898";
        ctx.fillRect(px + Math.floor(noise(tx, ty, i) * 26), py + Math.floor(noise(tx, ty, i + 5) * 26), 5, 4);
      }
      break;
    }
    case "T": { // 나무
      ctx.fillStyle = "#6a4a32";
      ctx.fillRect(px + 13, py + 18, 6, 12);
      ctx.fillStyle = "#3e7a3e";
      ctx.beginPath();
      ctx.arc(px + 16, py + 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4e8e4a";
      ctx.beginPath();
      ctx.arc(px + 12, py + 9, 7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "W": { // 분수 (물결 애니메이션)
      ctx.fillStyle = "#4a90c2";
      ctx.fillRect(px, py, TILE, TILE);
      const phase = Math.floor(time / 400) % 2;
      ctx.fillStyle = "#6ab0dd";
      for (let i = 0; i < 3; i++) {
        const wy = py + 5 + i * 10 + (phase === 0 ? 0 : 3);
        ctx.fillRect(px + 4, wy, 10, 2);
        ctx.fillRect(px + 18, wy + 5, 10, 2);
      }
      ctx.strokeStyle = "#3a7aa8";
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      break;
    }
    case "F": { // 꽃
      const colors = ["#e06c88", "#f0d060", "#e8e8f0"];
      for (let i = 0; i < 3; i++) {
        const fx = px + 5 + Math.floor(noise(tx, ty, i) * 20);
        const fy = py + 5 + Math.floor(noise(tx, ty, i + 3) * 20);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(fx, fy, 4, 4);
        ctx.fillStyle = "#f8f0d8";
        ctx.fillRect(fx + 1, fy + 1, 2, 2);
      }
      break;
    }
    case "B": { // 건물 벽 (벽돌)
      ctx.fillStyle = "#b0705a";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#9a5e4a";
      for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 0 ? 0 : 8;
        for (let col = -1; col < 3; col++) {
          ctx.fillRect(px + offset + col * 16 + 1, py + row * 8 + 1, 14, 6);
        }
      }
      // 지붕 라인 (위 타일이 건물이 아니면)
      if (tileAt(tx, ty - 1) !== "B" && tileAt(tx, ty - 1) !== "D") {
        ctx.fillStyle = "#5a3a3a";
        ctx.fillRect(px, py, TILE, 6);
      }
      break;
    }
    case "D": { // 문
      ctx.fillStyle = "#b0705a";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#6a4a32";
      ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 4);
      ctx.fillStyle = "#8a6a4a";
      ctx.fillRect(px + 7, py + 7, TILE - 14, TILE - 10);
      ctx.fillStyle = "#f0d060";
      ctx.fillRect(px + TILE - 11, py + 17, 3, 3);
      break;
    }
    case "b": { // 벤치
      ctx.fillStyle = "#8a6a4a";
      ctx.fillRect(px + 3, py + 12, TILE - 6, 8);
      ctx.fillStyle = "#6a4a32";
      ctx.fillRect(px + 5, py + 20, 4, 8);
      ctx.fillRect(px + TILE - 9, py + 20, 4, 8);
      break;
    }
  }
}

// 간판 그리기
function drawSign(ctx, col, row, text) {
  const px = col * TILE;
  const py = row * TILE;
  ctx.font = "bold 11px 'Malgun Gothic', sans-serif";
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = "rgba(42,32,26,0.92)";
  ctx.fillRect(px - 2, py - 4, w, 16);
  ctx.fillStyle = "#f0d060";
  ctx.fillText(text, px + 4, py + 8);
}
