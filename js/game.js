// ============================================================
// 게임 엔진: 상태, 입력, 이동, 렌더링, 상호작용
// ============================================================

(function () {
  "use strict";

  const SAVE_KEY = "copyquest_save_v2";

  // ---------- 상태 ----------
  const defaultState = () => ({
    name: "",
    charPreset: "playerA",
    outfit: null, // 착용 중인 outfit 아이템 id
    xp: 0,
    level: 1,
    points: 500,
    totalEarned: 0,
    bestScore: 0,
    completed: {}, // questId -> { score, attempts }
    attempts: {}, // questId -> 시도 횟수 (미완료 포함)
    inventory: [],
    coffees: 0,
    medals: [],
    px: 12, // 타일 좌표
    py: 9,
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* 손상된 저장은 무시 */ }
    return defaultState();
  }
  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  function xpMultiplier() {
    return state.inventory.includes("lucky_pen") ? 1.2 : 1;
  }

  function addXp(amount) {
    state.xp += Math.round(amount * xpMultiplier());
    let up = false;
    while (state.xp >= state.level * 200) {
      state.xp -= state.level * 200;
      state.level += 1;
      up = true;
    }
    return up;
  }

  function checkMedals() {
    const earned = [];
    ACHIEVEMENTS.forEach((a) => {
      if (!state.medals.includes(a.id) && a.cond(state)) {
        state.medals.push(a.id);
        earned.push(a);
      }
    });
    return earned;
  }

  // ---------- 퀘스트 진행 ----------
  function nextQuestIndex() {
    return QUESTS.findIndex((q) => !state.completed[q.id]);
  }
  // NPC에게 지금 받을 수 있는 퀘스트 (선형 진행)
  function availableQuestFor(npc) {
    const idx = nextQuestIndex();
    if (idx === -1) return null;
    return QUESTS[idx].npcId === npc.id ? QUESTS[idx] : null;
  }
  // 이 NPC의 다음 퀘스트가 아직 잠겨 있는지 (다른 NPC 먼저)
  function pendingQuestOwner() {
    const idx = nextQuestIndex();
    return idx === -1 ? null : NPCS.find((n) => n.id === QUESTS[idx].npcId);
  }

  // ---------- 채점 ----------
  function ruleGrade(quest, text) {
    const checks = quest.checks.map((c) => ({ desc: c.desc, pass: !!c.test(text) }));
    const passed = checks.filter((c) => c.pass).length;
    const score = Math.round((passed / checks.length) * 100);
    return {
      score,
      pass: score >= 66,
      feedback:
        score >= 66
          ? "기준을 잘 지켰네요. " + quest.lesson
          : "아직 기준에 못 미쳐요. 체크리스트를 보고 다시 다듬어 봅시다.",
      tip: quest.lesson,
      revised: quest.example,
      checks,
    };
  }

  async function submitCopy(quest, npc, text) {
    state.attempts[quest.id] = (state.attempts[quest.id] || 0) + 1;
    UI.showGrading(npc.name);

    let result;
    if (AI.hasKey()) {
      try {
        result = await AI.grade(quest, npc, text, state.name);
      } catch (e) {
        UI.toast("AI 채점 실패(" + e.message + ") — 기본 채점으로 전환합니다.", true);
        result = ruleGrade(quest, text);
      }
    } else {
      result = ruleGrade(quest, text);
    }

    state.bestScore = Math.max(state.bestScore, result.score);
    let leveledUp = false;
    let newMedals = [];

    if (result.pass && !state.completed[quest.id]) {
      state.completed[quest.id] = { score: result.score, attempts: state.attempts[quest.id] };
      state.points += quest.reward.points;
      state.totalEarned += quest.reward.points;
      leveledUp = addXp(quest.reward.xp);
      newMedals = checkMedals();
      result.reward = quest.reward;
    }
    result.leveledUp = leveledUp;
    result.newMedals = newMedals;
    save();
    UI.updateHUD(state);
    UI.showQuestResult(quest, npc, result, {
      onClose: () => {
        const idx = nextQuestIndex();
        if (result.pass && idx !== -1) {
          const owner = NPCS.find((n) => n.id === QUESTS[idx].npcId);
          UI.toast("다음 의뢰: " + owner.name + " (" + owner.title + ")를 찾아가자!", true);
        } else if (result.pass && idx === -1) {
          UI.toast("🎉 모든 의뢰 완료! 당신은 이제 글빨골목의 카피라이터다!", true);
        }
      },
    });
  }

  // ---------- NPC 상호작용 ----------
  function talkTo(npc) {
    const quest = availableQuestFor(npc);
    const options = [];

    if (quest) {
      options.push({
        label: "📋 의뢰 보기",
        onClick: () => {
          UI.showQuest(quest, npc, state, {
            onCoffee: () => {
              if (state.coffees > 0) {
                state.coffees -= 1;
                save();
                return true;
              }
              return false;
            },
            onSubmit: (text) => submitCopy(quest, npc, text),
          });
        },
      });
    }
    options.push({
      label: "💬 잡담하기" + (AI.hasKey() ? "" : " (기본 대사)"),
      onClick: () => startChat(npc),
    });
    options.push({ label: "👋 떠나기", onClick: () => UI.closeModals() });

    let greeting;
    if (quest) {
      greeting = "마침 잘 왔어. 부탁할 일이 있는데… (의뢰: " + quest.title + ")";
    } else {
      const owner = pendingQuestOwner();
      if (owner && owner.id !== npc.id) greeting = "지금은 부탁할 게 없네. " + owner.name + "이(가) 사람을 찾던데?";
      else if (!owner) greeting = "덕분에 골목이 살아났어. 고마워!";
      else greeting = "어서 와!";
    }
    UI.showDialogue(npc, greeting, options);
  }

  // ---------- 잡담 (AI) ----------
  function startChat(npc) {
    const history = [];
    if (!AI.hasKey()) {
      const line = npc.fallbackChat[Math.floor(Math.random() * npc.fallbackChat.length)];
      UI.showDialogue(npc, line + "\n\n(⚙️ 설정에서 Claude API 키를 넣으면 진짜 대화가 가능해요)", [
        { label: "👋 떠나기", onClick: () => UI.closeModals() },
      ]);
      return;
    }
    UI.showDialogue(npc, "…무슨 얘기가 하고 싶어? (자유롭게 입력해보세요)", []);
    chatLoop(npc, history);
  }

  function chatLoop(npc, history) {
    UI.showChatInput(
      npc,
      async (msg) => {
        history.push({ role: "user", content: msg });
        UI.showDialogue(npc, "…", []);
        try {
          const reply = await AI.chat(npc, history, state.name);
          history.push({ role: "assistant", content: reply });
          if (history.length > 12) history.splice(0, history.length - 12);
          UI.showDialogue(npc, reply, []);
        } catch (e) {
          UI.showDialogue(npc, "(대화 실패: " + e.message + ")", []);
        }
        chatLoop(npc, history);
      },
      () => UI.closeModals()
    );
  }

  // ---------- 상점 ----------
  function openShop() {
    UI.showDialogue(null, "🏪 편의점 카피24에 어서오세요~ 포인트로 결제 가능합니다.", [
      { label: "🛍️ 물건 보기", onClick: () => UI.showShop(state, buyItem) },
      { label: "👋 나가기", onClick: () => UI.closeModals() },
    ]);
  }

  function buyItem(item) {
    const owned = state.inventory.includes(item.id);
    if (item.type === "outfit" && owned) {
      state.outfit = state.outfit === item.id ? null : item.id;
      save();
      UI.showShop(state, buyItem);
      UI.toast(state.outfit === item.id ? item.name + " 착용!" : "옷을 벗었다.");
      return;
    }
    if (owned) return;
    if (state.points < item.price) {
      UI.toast("포인트가 부족해요! 의뢰를 완수하고 돌아오세요.");
      return;
    }
    state.points -= item.price;
    if (item.type === "consumable") {
      state.coffees = (state.coffees || 0) + 1;
    } else {
      state.inventory.push(item.id);
      if (item.type === "outfit") state.outfit = item.id;
    }
    const newMedals = checkMedals();
    newMedals.forEach((m) => UI.toast(m.icon + " 메달 획득: " + m.name, true));
    save();
    UI.updateHUD(state);
    UI.showShop(state, buyItem);
    UI.toast(item.name + " 구매 완료!");
  }

  function outfitPalette() {
    if (!state.outfit) return null;
    const item = SHOP_ITEMS.find((i) => i.id === state.outfit);
    return item ? item.palette : null;
  }

  // ---------- 입력 ----------
  const keys = {};
  document.addEventListener("keydown", (e) => {
    if (UI.isModalOpen()) {
      if (e.key === "Escape") UI.closeModals();
      return;
    }
    keys[e.key] = true;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      interact();
      return;
    }
    // 짧은 탭도 놓치지 않도록 keydown에서 즉시 한 칸 이동
    const dir = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[e.key];
    if (dir) {
      e.preventDefault();
      tryMove(dir[0], dir[1]);
    }
  });
  document.addEventListener("keyup", (e) => (keys[e.key] = false));

  // 모바일 터치 컨트롤
  function bindTouch(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = (e) => { e.preventDefault(); keys[key] = true; };
    const off = (e) => { e.preventDefault(); keys[key] = false; };
    btn.addEventListener("touchstart", on);
    btn.addEventListener("touchend", off);
    btn.addEventListener("mousedown", on);
    btn.addEventListener("mouseup", off);
  }

  // ---------- 이동 ----------
  const player = { x: 12, y: 9, moving: false, fromX: 12, fromY: 9, progress: 1, face: "down" };

  function tryMove(dx, dy) {
    if (player.moving) return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (isSolid(nx, ny)) return;
    player.fromX = player.x;
    player.fromY = player.y;
    player.x = nx;
    player.y = ny;
    player.progress = 0;
    player.moving = true;
  }

  function facingTile() {
    // 상하좌우 인접 칸 중 NPC/문이 있는 곳을 찾는다
    const dirs = [ [0, -1], [0, 1], [-1, 0], [1, 0] ];
    for (const [dx, dy] of dirs) {
      const tx = player.x + dx;
      const ty = player.y + dy;
      const npc = NPCS.find((n) => n.x === tx && n.y === ty);
      if (npc) return { npc };
      if (tx === SHOP_DOOR.x && ty === SHOP_DOOR.y) return { shop: true };
    }
    return null;
  }

  function interact() {
    const target = facingTile();
    if (!target) return;
    if (target.npc) talkTo(target.npc);
    else if (target.shop) openShop();
  }

  // ---------- 렌더링 ----------
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  let lastTime = 0;

  function update(dt) {
    if (player.moving) {
      player.progress += dt / 160; // 한 칸 이동에 160ms
      if (player.progress >= 1) {
        player.progress = 1;
        player.moving = false;
        state.px = player.x;
        state.py = player.y;
        save();
      }
    } else if (!UI.isModalOpen()) {
      if (keys.ArrowUp || keys.w) tryMove(0, -1);
      else if (keys.ArrowDown || keys.s) tryMove(0, 1);
      else if (keys.ArrowLeft || keys.a) tryMove(-1, 0);
      else if (keys.ArrowRight || keys.d) tryMove(1, 0);
    }
  }

  function render(time) {
    // 맵
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        drawTile(ctx, tileAt(x, y), x, y, time);
      }
    }
    SIGNS.forEach(([c, r, t]) => drawSign(ctx, c, r, t));

    // NPC
    NPCS.forEach((npc) => {
      const bob = Math.sin(time / 500 + npc.x) > 0.7 ? -1 : 0;
      drawCharacter(ctx, npc.sprite, npc.x * TILE, npc.y * TILE, bob, null);
      // 이름표
      ctx.font = "10px 'Malgun Gothic', sans-serif";
      const label = npc.name;
      const lw = ctx.measureText(label).width + 8;
      const lx = npc.x * TILE + TILE / 2 - lw / 2;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(lx, npc.y * TILE - 12, lw, 12);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + 4, npc.y * TILE - 3);
      // 의뢰 가능 표시
      if (availableQuestFor(npc)) {
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "#f0d060";
        const blink = Math.sin(time / 300) > 0 ? "❗" : "❕";
        ctx.fillText(blink, npc.x * TILE + TILE / 2 - 6, npc.y * TILE - 16);
      }
    });

    // 플레이어 (칸 사이 보간)
    const ix = (player.fromX + (player.x - player.fromX) * player.progress) * TILE;
    const iy = (player.fromY + (player.y - player.fromY) * player.progress) * TILE;
    const bob = player.moving && Math.floor(time / 120) % 2 === 0 ? -2 : 0;
    drawCharacter(ctx, state.charPreset, ix, iy, bob, outfitPalette());

    // 상호작용 안내
    const target = facingTile();
    if (target && !UI.isModalOpen()) {
      ctx.font = "bold 12px 'Malgun Gothic', sans-serif";
      const hint = target.npc ? "SPACE: " + target.npc.name + "와 대화" : "SPACE: 편의점 들어가기";
      const hw = ctx.measureText(hint).width + 16;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(canvas.width / 2 - hw / 2, canvas.height - 28, hw, 20);
      ctx.fillStyle = "#f0d060";
      ctx.fillText(hint, canvas.width / 2 - hw / 2 + 8, canvas.height - 14);
    }
  }

  function loop(time) {
    const dt = Math.min(50, time - lastTime);
    lastTime = time;
    update(dt);
    render(time);
    requestAnimationFrame(loop);
  }

  // ---------- 시작 ----------
  function startGame() {
    document.getElementById("game-wrap").classList.remove("hidden");
    player.x = player.fromX = state.px;
    player.y = player.fromY = state.py;
    UI.updateHUD(state);

    document.getElementById("btn-medals").addEventListener("click", () => UI.showMedals(state));
    document.getElementById("btn-settings").addEventListener("click", () => UI.showSettings());
    document.getElementById("btn-reset").addEventListener("click", () => {
      if (confirm("정말 처음부터 다시 시작할까요? 모든 진행이 사라집니다.")) {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
      }
    });

    bindTouch("pad-up", "ArrowUp");
    bindTouch("pad-down", "ArrowDown");
    bindTouch("pad-left", "ArrowLeft");
    bindTouch("pad-right", "ArrowRight");
    const actBtn = document.getElementById("pad-action");
    if (actBtn) {
      actBtn.addEventListener("touchstart", (e) => { e.preventDefault(); interact(); });
      actBtn.addEventListener("mousedown", (e) => { e.preventDefault(); interact(); });
    }

    requestAnimationFrame(loop);

    if (!AI.hasKey()) {
      setTimeout(() => UI.toast("⚙️ 설정에서 Claude API 키를 넣으면 NPC가 AI로 첨삭해줘요!", true), 1500);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (state.name) {
      startGame();
    } else {
      UI.runIntro((name, preset) => {
        state.name = name;
        state.charPreset = preset;
        save();
        startGame();
        UI.toast("❗ 표시가 있는 사람에게 다가가 SPACE를 눌러보세요!", true);
      });
    }
  });
})();
