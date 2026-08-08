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
  flower: { body: BODY_LONG, hair: "#6a4a5a", skin: "#f5d0aa", cloth: "#e88ab0", cloth2: "#cc6f96", pants: "#5a4a52", hat: "none" },
  fish: { body: BODY_SHORT, hair: "#3a2a1a", skin: "#e8b890", cloth: "#f0b03c", cloth2: "#d09428", pants: "#4a4a52", hat: "cap", hatColor: "#f0b03c" },
  corp: { body: BODY_SHORT, hair: "#4a4a54", skin: "#f0c8a0", cloth: "#8a8a9a", cloth2: "#6e6e7e", pants: "#2a2a34", hat: "none", glasses: true },
  laptopper: { body: BODY_LONG, hair: "#2a3a4a", skin: "#f5d0aa", cloth: "#5c7ae0", cloth2: "#4a63c0", pants: "#3a3a44", hat: "none", glasses: true },
  reader: { body: BODY_SHORT, hair: "#3a2a1a", skin: "#f0c8a0", cloth: "#c2905c", cloth2: "#a8794a", pants: "#4a4a52", hat: "none" },
};

// 캐릭터를 (px, py) 픽셀 위치에 그린다.
// anim: { moving, progress(0~1, 한 칸 이동 진행도), face('up'|'down'|'left'|'right'), idleOffset }
function drawCharacter(ctx, presetName, px, py, anim, outfitPalette) {
  anim = anim || {};
  const face = anim.face || "down";
  const moving = !!anim.moving;
  const progress = Math.min(1, Math.max(0, anim.progress || 0));

  const p = CHAR_PRESETS[presetName] || CHAR_PRESETS.playerA;
  const cloth = (outfitPalette && outfitPalette.cloth) || p.cloth;
  const cloth2 = (outfitPalette && outfitPalette.cloth2) || p.cloth2;
  const colors = { H: p.hair, S: p.skin, E: "#2a2020", C: cloth, c: cloth2, P: p.pants, B: "#2a2a2a" };
  const scale = 2;
  const w = 12 * scale;

  // 걷기 바운스: 한 걸음(progress 0→1) 동안 사인 곡선으로 살짝 떠올랐다 착지
  const bounce = moving ? Math.round(Math.sin(progress * Math.PI) * 2) : (anim.idleOffset || 0);

  // 그림자: 바운스와 무관하게 발밑 바닥에 고정 (캐릭터가 살짝 떠오르는 느낌을 준다)
  ctx.fillStyle = "rgba(10,6,14,0.28)";
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE - 3, w * 0.34, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 걸음 프레임: 절반씩 나눠 다리를 번갈아 살짝 들어올린다
  const frame = moving && progress >= 0.5 ? 1 : 0;

  // 이 타일의 절대 위치로 원점을 한 번만 이동한 뒤, 이후에는 전부 타일 기준
  // 로컬 좌표(ox/oy)만 사용한다 — 반전(mirror) 시 px를 두 번 반영하던 버그 방지.
  ctx.save();
  ctx.translate(px, py);
  const mirror = face === "left";
  if (mirror) {
    ctx.translate(TILE, 0); // 타일 폭 기준으로 좌우 반전 (오른쪽 걷기 자세를 재사용)
    ctx.scale(-1, 1);
  }
  const ox = (TILE - w) / 2;
  const oy = TILE - 13 * scale - bounce;

  // 몸통을 그리는 한 패스. flatColor가 있으면 실루엣(테두리)용, 없으면 실제 색상으로 칠한다.
  const paintBody = (offsetX, offsetY, flatColor) => {
    p.body.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        let ch = row[rx];
        if (ch === ".") continue;
        if (face === "up" && ch === "E") ch = "H"; // 뒷모습: 눈을 머리카락 색으로 가림
        let legLift = 0;
        if (moving && ry >= 11) {
          const isLeftLeg = rx < row.length / 2;
          if ((frame === 0 && !isLeftLeg) || (frame === 1 && isLeftLeg)) legLift = -1;
        }
        ctx.fillStyle = flatColor || colors[ch] || "#f0f";
        ctx.fillRect(ox + rx * scale + offsetX, oy + ry * scale + legLift + offsetY, scale, scale);
      }
    });
  };
  // 검은 테두리 실루엣을 사방으로 1px씩 먼저 깔아, 포켓몬/영웅서기풍의 또렷한 윤곽선을 만든다.
  const OUTLINE = "#221822";
  paintBody(-1, 0, OUTLINE);
  paintBody(1, 0, OUTLINE);
  paintBody(0, -1, OUTLINE);
  paintBody(0, 1, OUTLINE);
  paintBody(0, 0, null);

  // 모자
  const hat = HATS[p.hat];
  if (hat) {
    const paintHat = (offsetX, offsetY, flatColor) => {
      hat.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) {
          if (row[rx] !== "A") continue;
          ctx.fillStyle = flatColor || p.hatColor || "#fff";
          ctx.fillRect(ox + rx * scale + offsetX, oy + (ry - 1) * scale + offsetY, scale, scale);
        }
      });
    };
    paintHat(-1, 0, OUTLINE);
    paintHat(1, 0, OUTLINE);
    paintHat(0, -1, OUTLINE);
    paintHat(0, 1, OUTLINE);
    paintHat(0, 0, null);
  }
  // 안경 (뒷모습에서는 생략)
  if (p.glasses && face !== "up") {
    ctx.fillStyle = "rgba(40,40,50,0.85)";
    ctx.fillRect(ox + 3 * scale, oy + 3 * scale, 3 * scale, scale);
    ctx.fillRect(ox + 7 * scale, oy + 3 * scale, 3 * scale, scale);
  }
  ctx.restore();
}

// ---------- 타일 그리기 ----------
// 시드 기반 의사난수: 프레임마다 같은 노이즈 패턴 유지
function noise(x, y, i) {
  const n = Math.sin(x * 127.1 + y * 311.7 + i * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

// 건물 벽 한 칸을 그린다. 위 타일이 건물이 아니면 지붕 캡을, 바닥에 닿는 줄이면 접지 그림자를 얹어
// '땅에 붙은 사각형'이 아니라 입체감 있는 건물처럼 보이게 한다. 테마별로 지붕 모양/창문/장식이 달라진다.
function drawBuildingWall(ctx, px, py, tx, ty, theme, time, isDoor, isExit) {
  const aboveIsBuilding = "BDE".includes(tileAt(tx, ty - 1));
  const belowIsBuilding = "BDE".includes(tileAt(tx, ty + 1));
  const isTopRow = !aboveIsBuilding;
  const isBottomRow = !belowIsBuilding;

  // 벽 바탕 (아래로 갈수록 살짝 어두워지는 2톤 음영으로 평면 느낌을 줄인다)
  ctx.fillStyle = theme.wall;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = theme.wallDark;
  ctx.fillRect(px, py + TILE - 10, TILE, 10);

  // 벽돌/판넬 결 (은은하게, 스타일 대비를 해치지 않는 선에서)
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let row = 0; row < 4; row++) {
    const offset = row % 2 === 0 ? 0 : 8;
    for (let col = -1; col < 3; col++) ctx.fillRect(px + offset + col * 16 + 1, py + row * 8 + 1, 14, 5);
  }

  // 지붕: 건물 맨 윗줄에만 얹어서 벽보다 튀어나온 것처럼 보이게 한다
  if (isTopRow) {
    const roofH = 11;
    if (theme.style === "cafe" || theme.style === "conbini" || theme.style === "stall") {
      // 줄무늬 차양(어닝)
      ctx.fillStyle = theme.roof;
      ctx.fillRect(px, py, TILE, roofH);
      ctx.fillStyle = theme.trim;
      for (let i = 0; i < 4; i++) ctx.fillRect(px + i * 8, py, 4, roofH);
      ctx.fillStyle = theme.roofDark;
      ctx.fillRect(px, py + roofH - 2, TILE, 2);
    } else if (theme.style === "hanok") {
      // 기와지붕: 대각 결을 넣어 전통 기와 느낌
      ctx.fillStyle = theme.roof;
      ctx.fillRect(px, py, TILE, roofH);
      ctx.fillStyle = theme.roofDark;
      for (let i = -1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(px + i * 8, py + roofH);
        ctx.lineTo(px + i * 8 + 6, py);
        ctx.lineTo(px + i * 8 + 9, py);
        ctx.lineTo(px + i * 8 + 3, py + roofH);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = theme.roof;
      ctx.fillRect(px, py, TILE, roofH);
      ctx.fillStyle = theme.roofDark;
      ctx.fillRect(px, py + roofH - 2, TILE, 2);
    }
    // 처마 그림자 (지붕이 벽 위에 얹힌 듯한 굵은 하이라이트 라인)
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(px, py, TILE, 2);
  }

  // 창문 / 스타일별 장식: 문이 아닌 칸에만, 지붕 캡 아래 여유 공간에 그린다
  if (!isDoor) {
    const wy = isTopRow ? py + 15 : py + 6;
    if (theme.style === "flower" || theme.style === "guesthouse") {
      // 창틀 + 화분 박스
      ctx.fillStyle = theme.trim;
      ctx.fillRect(px + 8, py + (isTopRow ? 14 : 5), 16, 10);
      ctx.fillStyle = theme.window;
      ctx.fillRect(px + 10, py + (isTopRow ? 16 : 7), 12, 6);
      ctx.fillStyle = "#7a5a3a";
      ctx.fillRect(px + 7, py + (isTopRow ? 24 : 13), 18, 3);
      const dots = ["#e06c88", "#f0d060", "#e8e8f0"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = dots[i];
        ctx.fillRect(px + 9 + i * 5, py + (isTopRow ? 22 : 11), 3, 3);
      }
    } else if (theme.style === "bakery" || theme.style === "hanok") {
      // 작은 격자창
      ctx.fillStyle = theme.trim;
      ctx.fillRect(px + 9, py + wy - py, 14, 10);
      ctx.fillStyle = theme.window;
      ctx.fillRect(px + 11, py + wy - py + 2, 10, 6);
      ctx.fillStyle = theme.trim;
      ctx.fillRect(px + 15, py + wy - py + 2, 2, 6);
    } else {
      // 모던/오피스/편의점 등: 큰 통유리창
      ctx.fillStyle = theme.trim;
      ctx.fillRect(px + 6, py + wy - py, 20, 12);
      ctx.fillStyle = theme.window;
      ctx.fillRect(px + 8, py + wy - py + 2, 16, 8);
      ctx.strokeStyle = theme.trim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 16, py + wy - py + 2);
      ctx.lineTo(px + 16, py + wy - py + 10);
      ctx.stroke();
    }
  }

  // 문
  if (isDoor) {
    ctx.fillStyle = theme.roofDark;
    ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 4);
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(px + 7, py + 7, TILE - 14, TILE - 10);
    if (isExit) {
      const glow = Math.sin((time || 0) / 400) > 0 ? "#f0d060" : "#d8b850";
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 5);
      ctx.fillStyle = glow;
      ctx.fillRect(px + TILE - 12, py + 17, 3, 3);
    } else {
      ctx.fillStyle = theme.trim;
      ctx.fillRect(px + TILE - 11, py + 17, 3, 3);
    }
  }

  // 접지 그림자: 건물이 땅과 닿는 맨 아랫줄에만, 발밑을 살짝 눌러줘서 '붙어있는' 느낌을 없앤다
  if (isBottomRow) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(px, py + TILE - 3, TILE, 3);
  }
}

function drawTile(ctx, code, tx, ty, time) {
  const px = tx * TILE;
  const py = ty * TILE;

  // ---- 실내 타일 (자체 배경, 잔디 없음) ----
  if (code === " ") {
    ctx.fillStyle = "#0d0a12";
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }
  // 실내 맵 목록 — 새 실내 맵을 추가하면 여기 등록해야 실내용 바닥/출구 렌더링을 탄다.
  const INDOOR_MAPS = { office: true, cafe: true };
  if ("xfokpgC".includes(code) || (code === "E" && INDOOR_MAPS[currentMapId])) {
    const isCafe = currentMapId === "cafe";
    // 마루 바닥: 카페는 좀 더 붉은기 도는 원목 톤, 사무실은 기존 톤 유지 — 공간마다 다른 느낌을 준다
    ctx.fillStyle = isCafe ? "#c98a5a" : "#c9a06a";
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = isCafe ? "#b87848" : "#b8905c";
    ctx.fillRect(px, py + 15, TILE, 2);
    ctx.fillRect(px + (ty % 2 ? 8 : 20), py, 2, TILE);
    // 마루널 결 텍스처 (은은한 세로 줄무늬)
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(px + ((tx + ty) % 2 ? 12 : 4), py, 1, TILE);
    switch (code) {
      case "x": // 실내 벽: 아래쪽에 걸레받이(baseboard)를 더해 평면 느낌을 줄인다
        ctx.fillStyle = isCafe ? "#4a3428" : "#5a4a5e";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = isCafe ? "#5c4434" : "#6a5a6e";
        ctx.fillRect(px, py, TILE, 8);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(px, py + TILE - 5, TILE, 5);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(px, py + TILE - 5, TILE, 1);
        break;
      case "o": // 러그
        if (isCafe) {
          ctx.fillStyle = "#5a3a2c";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = "#7a5238";
          ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        } else {
          ctx.fillStyle = "#a34a4a";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = "#c26a5a";
          ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
        }
        break;
      case "k": // 책상 / 카페 테이블
        if (isCafe) {
          // 동그란 원목 테이블 + 커피잔
          ctx.fillStyle = "rgba(20,10,5,0.2)";
          ctx.beginPath();
          ctx.ellipse(px + 16, py + 26, 10, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#6a4428";
          ctx.beginPath();
          ctx.arc(px + 16, py + 16, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#8a5c38";
          ctx.beginPath();
          ctx.arc(px + 16, py + 16, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#f5f0e8";
          ctx.beginPath();
          ctx.arc(px + 19, py + 13, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#5c3a1e";
          ctx.beginPath();
          ctx.arc(px + 19, py + 13, 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#7a5a3a";
          ctx.fillRect(px + 1, py + 6, TILE - 2, TILE - 12);
          ctx.fillStyle = "#8a6a48";
          ctx.fillRect(px + 1, py + 6, TILE - 2, 6);
          ctx.fillStyle = "#dde8f0"; // 서류
          ctx.fillRect(px + 6, py + 10, 8, 6);
        }
        break;
      case "p": // 화분
        ctx.fillStyle = "#8a5a3a";
        ctx.fillRect(px + 10, py + 18, 12, 10);
        ctx.fillStyle = "#4e8e4a";
        ctx.beginPath();
        ctx.arc(px + 16, py + 12, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#5fa15c";
        ctx.beginPath();
        ctx.arc(px + 12, py + 9, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "g": // 책장 / 카페 원두 진열대
        if (isCafe) {
          ctx.fillStyle = "#4a3020";
          ctx.fillRect(px, py, TILE, TILE);
          // 원두 자루(마대) 두 개
          const sackColors = ["#a87848", "#8a5c34"];
          for (let i = 0; i < 2; i++) {
            const sx = px + 4 + i * 14;
            ctx.fillStyle = sackColors[i % 2];
            ctx.beginPath();
            ctx.ellipse(sx + 5, py + 20, 6, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#3a2818";
            for (let d = 0; d < 5; d++) {
              ctx.fillRect(sx + 2 + noise(tx, ty, d + i * 5) * 6, py + 15 + noise(tx, ty, d + 10) * 8, 1.5, 1.5);
            }
          }
          ctx.fillStyle = "#e8d8b8";
          ctx.font = "8px sans-serif";
          ctx.fillText("BEANS", px + 4, py + 8);
        } else {
          ctx.fillStyle = "#6a4a32";
          ctx.fillRect(px, py, TILE, TILE);
          const bookColors = ["#c25c5c", "#5c8ac2", "#c2a05c", "#5cb8a7"];
          for (let row = 0; row < 2; row++) {
            for (let i = 0; i < 4; i++) {
              ctx.fillStyle = bookColors[(i + row + tx) % 4];
              ctx.fillRect(px + 3 + i * 7, py + 4 + row * 14, 5, 10);
            }
          }
        }
        break;
      case "E": // 출구 매트
        ctx.fillStyle = "#8a3a3a";
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = "#f0d060";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText("▼", px + 10, py + 21);
        break;
      case "C": { // 카페 바 카운터
        ctx.fillStyle = "#3a2818";
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#5c4028";
        ctx.fillRect(px, py, TILE, 10);
        ctx.fillStyle = "#2a1c10";
        ctx.fillRect(px, py + 8, TILE, 2);
        if (tx % 3 === 0) { // 세 칸마다 에스프레소 머신 실루엣
          ctx.fillStyle = "#9a9aa2";
          ctx.fillRect(px + 8, py + 1, 16, 7);
          ctx.fillStyle = "#d8c8b0";
          ctx.fillRect(px + 10, py + 3, 4, 3);
          ctx.fillRect(px + 18, py + 3, 4, 3);
        } else {
          ctx.fillStyle = "#e8d8b8";
          ctx.beginPath();
          ctx.arc(px + 16, py + 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
    return;
  }

  // ---- 실외 타일 ----
  // 잔디 바탕: 단색이 아니라 두 톤의 유기적인 얼룩 + 짧은 잎 텍스처를 겹쳐서 밋밋함을 줄인다.
  ctx.fillStyle = "#7fb069";
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = "#739f5f";
  for (let i = 0; i < 3; i++) {
    const bx = px + Math.floor(noise(tx, ty, i) * 22) + 4;
    const by = py + Math.floor(noise(tx, ty, i + 8) * 22) + 4;
    ctx.beginPath();
    ctx.ellipse(bx, by, 6, 3.5, noise(tx, ty, i + 15) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#8fc07a";
  for (let i = 0; i < 5; i++) {
    if (noise(tx, ty, i + 20) < 0.5) continue;
    const gx = px + Math.floor(noise(tx, ty, i + 30) * 29);
    const gy = py + Math.floor(noise(tx, ty, i + 40) * 29);
    ctx.fillRect(gx, gy, 1, 3);
  }

  switch (code) {
    case "r": { // 길
      ctx.fillStyle = "#d8c8a8";
      ctx.fillRect(px, py, TILE, TILE);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#c8b898";
        ctx.fillRect(px + Math.floor(noise(tx, ty, i) * 26), py + Math.floor(noise(tx, ty, i + 5) * 26), 5, 4);
      }
      // 자갈 알갱이 몇 개를 더해 아스팔트가 아니라 흙길 느낌을 살린다
      ctx.fillStyle = "#b8a888";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + Math.floor(noise(tx, ty, i + 50) * 28), py + Math.floor(noise(tx, ty, i + 60) * 28), 2, 2);
      }
      // 잔디와 맞닿는 가장자리를 살짝 어둡게 눌러줘서 길의 경계가 또렷해지게 한다
      ctx.fillStyle = "rgba(110, 90, 60, 0.15)";
      if (tileAt(tx, ty - 1) !== "r") ctx.fillRect(px, py, TILE, 3);
      if (tileAt(tx, ty + 1) !== "r") ctx.fillRect(px, py + TILE - 3, TILE, 3);
      if (tileAt(tx - 1, ty) !== "r") ctx.fillRect(px, py, 3, TILE);
      if (tileAt(tx + 1, ty) !== "r") ctx.fillRect(px + TILE - 3, py, 3, TILE);
      break;
    }
    case "T": { // 나무
      // 접지 그림자: 나무가 땅에 뿌리내린 것처럼 보이게 한다
      ctx.fillStyle = "rgba(20, 40, 20, 0.18)";
      ctx.beginPath();
      ctx.ellipse(px + 16, py + 29, 11, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6a4a32";
      ctx.fillRect(px + 13, py + 18, 6, 12);
      ctx.fillStyle = "#523822";
      ctx.fillRect(px + 13, py + 18, 2, 12);
      ctx.fillStyle = "#3e7a3e";
      ctx.beginPath();
      ctx.arc(px + 16, py + 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4e8e4a";
      ctx.beginPath();
      ctx.arc(px + 12, py + 9, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5fa15c";
      ctx.beginPath();
      ctx.arc(px + 19, py + 7, 4, 0, Math.PI * 2);
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
    case "B": { // 건물 벽 (테마별 색상 + 창문으로 건물마다 개성을 준다)
      const theme = (typeof themeAt === "function" && themeAt(tx, ty)) || DEFAULT_BUILDING_THEME;
      drawBuildingWall(ctx, px, py, tx, ty, theme, time, false);
      break;
    }
    case "D": { // 문
      const theme = (typeof themeAt === "function" && themeAt(tx, ty)) || DEFAULT_BUILDING_THEME;
      drawBuildingWall(ctx, px, py, tx, ty, theme, time, true);
      break;
    }
    case "E": { // 실외 출입구 (빛나는 문)
      const theme = (typeof themeAt === "function" && themeAt(tx, ty)) || DEFAULT_BUILDING_THEME;
      drawBuildingWall(ctx, px, py, tx, ty, theme, time, true, true);
      break;
    }
    case "S": { // 무대
      ctx.fillStyle = "#9a6a42";
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = "#b07e50";
      ctx.fillRect(px, py, TILE, 5);
      ctx.fillStyle = "#7e5636";
      for (let i = 0; i < 3; i++) ctx.fillRect(px, py + 9 + i * 8, TILE, 2);
      break;
    }
    case "M": { // 공사 펜스
      ctx.fillStyle = "#c8c8d0";
      ctx.fillRect(px, py + 4, TILE, TILE - 8);
      ctx.fillStyle = "#e8b83c";
      ctx.fillRect(px, py + 8, TILE, 8);
      ctx.fillStyle = "#3a3a44";
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 16);
      ctx.lineTo(px + 12, py + 8);
      ctx.lineTo(px + 18, py + 8);
      ctx.lineTo(px + 10, py + 16);
      ctx.fill();
      ctx.fillStyle = "#8a8a94";
      ctx.fillRect(px + 2, py + 4, 3, TILE - 8);
      ctx.fillRect(px + TILE - 5, py + 4, 3, TILE - 8);
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
    case "L": { // 키 큰 풀숲 (지나가면 즉흥 훈련 인카운터가 걸릴 수 있다)
      ctx.fillStyle = "#3e7a3e";
      ctx.fillRect(px, py, TILE, TILE);
      const sway = Math.sin(time / 500 + tx * 0.7 + ty * 1.3) * 1.4;
      ctx.fillStyle = "#4e9a4e";
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const bx = px + 2 + col * 7 + (row % 2 ? 2 : 0);
          const by = py + 2 + row * 7;
          const lean = sway * (row % 2 ? 1 : -1);
          ctx.beginPath();
          ctx.moveTo(bx, by + 6);
          ctx.lineTo(bx + 2 + lean, by);
          ctx.lineTo(bx + 4, by + 6);
          ctx.fill();
        }
      }
      ctx.fillStyle = "rgba(20,50,20,0.25)";
      ctx.fillRect(px, py + TILE - 4, TILE, 4);
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
