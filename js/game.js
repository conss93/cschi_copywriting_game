// ============================================================
// 게임 엔진: 상태, 스토리 진행, 입력, 이동, 맵 전환, 렌더링
// ============================================================

(function () {
  "use strict";

  const SAVE_KEY = "copyquest_save_v3";

  // ---------- 상태 ----------
  const defaultState = () => ({
    name: "",
    charPreset: "playerA",
    outfit: null,
    xp: 0,
    level: 1,
    points: 500,
    totalEarned: 0,
    bestScore: 0,
    completed: {}, // questId -> { score, attempts }
    attempts: {},
    inventory: [],
    coffees: 0,
    coffeesBought: 0,
    chatCount: 0,
    medals: [],
    flags: {}, // 스토리 플래그 (tutorialDone, marketOpen, ending …)
    storyDone: [], // 재생 완료된 스토리 이벤트 id
    objective: "",
    map: "town",
    px: 12,
    py: 9,
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* 손상된 저장은 무시 */ }
    return null;
  }
  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }
  function hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
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

  function checkMedals(silent) {
    const earned = [];
    ACHIEVEMENTS.forEach((a) => {
      if (!state.medals.includes(a.id) && a.cond(state)) {
        state.medals.push(a.id);
        earned.push(a);
        if (!silent) UI.toast(a.icon + " 메달 획득: " + a.name, true);
      }
    });
    return earned;
  }

  // ---------- 스토리 엔진 ----------
  let storyPlaying = false;

  function fireStory(trigger) {
    if (storyPlaying) return false;
    const event = STORY.find((ev) => {
      if (state.storyDone.includes(ev.id)) return false;
      const t = ev.trigger;
      if (t.type !== trigger.type) return false;
      if (t.type === "enter") return t.map === trigger.map;
      if (t.type === "questDone") return t.quest === trigger.quest;
      return t.type === "start";
    });
    if (!event) return false;

    storyPlaying = true;
    state.storyDone.push(event.id);
    UI.playStory(event.lines, () => {
      storyPlaying = false;
      if (event.flags) Object.assign(state.flags, event.flags);
      if (event.objective) state.objective = event.objective;
      UI.updateObjective(state.objective);
      checkMedals();
      save();
      UI.updateHUD(state);
    });
    return true;
  }

  // ---------- 퀘스트 진행 ----------
  const MAIN_QUESTS = QUESTS.filter((q) => q.type === "main");

  function nextMainQuest() {
    return MAIN_QUESTS.find((q) => !state.completed[q.id]) || null;
  }

  function subQuestAvailable(q) {
    if (q.type !== "sub" || state.completed[q.id]) return false;
    const req = q.requires;
    return !req || !!state.flags[req] || !!state.completed[req];
  }

  function availableQuestsFor(npc) {
    const list = [];
    const main = nextMainQuest();
    // 메인 퀘스트는 튜토리얼(오팀장 면접) 이후부터
    if (main && main.npcId === npc.id && state.flags.tutorialDone) list.push(main);
    QUESTS.forEach((q) => {
      if (q.npcId === npc.id && subQuestAvailable(q)) list.push(q);
    });
    return list;
  }

  function anyQuestAvailable(npc) {
    return availableQuestsFor(npc).length > 0;
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
      newMedals = checkMedals(true);
    }
    result.reward = result.pass && state.completed[quest.id] && state.completed[quest.id].attempts === state.attempts[quest.id] ? quest.reward : null;
    result.leveledUp = leveledUp;
    result.newMedals = newMedals;
    save();
    UI.updateHUD(state);
    UI.showQuestResult(quest, npc, result, {
      onClose: () => {
        if (result.pass) {
          // 퀘스트 완료 스토리 재생 (목표 갱신 포함)
          if (!fireStory({ type: "questDone", quest: quest.id })) {
            const main = nextMainQuest();
            if (main) {
              const owner = NPCS.find((n) => n.id === main.npcId);
              UI.toast("다음 의뢰: " + owner.name + " (" + MAPS[owner.map].name + ")", true);
            }
          }
        }
      },
    });
  }

  // ---------- NPC 상호작용 ----------
  function talkTo(npc) {
    const quests = availableQuestsFor(npc);
    const options = [];

    quests.forEach((quest) => {
      options.push({
        label: (quest.type === "sub" ? "🔖 " : "📋 ") + quest.title,
        primary: quest.type === "main",
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
    });
    options.push({ label: "💬 잡담" + (AI.hasKey() ? "" : " (기본)"), onClick: () => startChat(npc) });
    options.push({ label: "👋 떠나기", onClick: () => UI.closeModals() });

    let greeting;
    if (quests.length > 0) {
      greeting = quests.length === 1
        ? "마침 잘 왔어. 부탁할 일이 있는데… (" + quests[0].title + ")"
        : "부탁할 일이 " + quests.length + "개나 있어. 뭐부터 볼래?";
    } else {
      const main = nextMainQuest();
      if (main && state.flags.tutorialDone) {
        const owner = NPCS.find((n) => n.id === main.npcId);
        greeting = owner.id === npc.id ? "어서 와!" : "지금은 부탁할 게 없네. " + owner.name + "이(가) 사람을 찾던데?";
      } else if (!main) {
        greeting = "골목을 지켜줘서 고마워. 덕분에 오늘도 영업 중이야!";
      } else {
        greeting = "처음 보는 얼굴이네. 골목기획 오팀장부터 만나보는 게 어때?";
      }
    }
    UI.showDialogue(npc, greeting, options);
  }

  // ---------- 잡담 (AI) ----------
  function startChat(npc) {
    state.chatCount = (state.chatCount || 0) + 1;
    checkMedals();
    save();
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
      { label: "🛍️ 물건 보기", primary: true, onClick: () => UI.showShop(state, buyItem) },
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
      state.coffeesBought = (state.coffeesBought || 0) + 1;
    } else {
      state.inventory.push(item.id);
      if (item.type === "outfit") state.outfit = item.id;
    }
    checkMedals();
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

  // ---------- 맵 전환 ----------
  function changeMap(mapId, tx, ty) {
    setCurrentMap(mapId);
    state.map = mapId;
    player.x = player.fromX = tx;
    player.y = player.fromY = ty;
    player.progress = 1;
    player.moving = false;
    state.px = tx;
    state.py = ty;
    save();
    UI.updateHUD(state);
    UI.toast("📍 " + MAPS[mapId].name);
    fireStory({ type: "enter", map: mapId });
  }

  // ---------- 입력 ----------
  const keys = {};
  document.addEventListener("keydown", (e) => {
    if (UI.isModalOpen()) {
      if (e.key === "Escape" && !storyPlaying) UI.closeModals();
      return;
    }
    keys[e.key] = true;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      interact();
      return;
    }
    const dir = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[e.key];
    if (dir) {
      e.preventDefault();
      tryMove(dir[0], dir[1]);
    }
  });
  document.addEventListener("keyup", (e) => (keys[e.key] = false));

  function bindTouch(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = (e) => { e.preventDefault(); keys[key] = true; if (!UI.isModalOpen() && !player.moving) { const d = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key]; if (d) tryMove(d[0], d[1]); } };
    const off = (e) => { e.preventDefault(); keys[key] = false; };
    btn.addEventListener("touchstart", on, { passive: false });
    btn.addEventListener("touchend", off, { passive: false });
    btn.addEventListener("mousedown", on);
    btn.addEventListener("mouseup", off);
    btn.addEventListener("mouseleave", off);
  }

  // ---------- 이동 ----------
  const player = { x: 12, y: 9, moving: false, fromX: 12, fromY: 9, progress: 1 };

  function tryMove(dx, dy) {
    if (player.moving || UI.isModalOpen()) return;
    const nx = player.x + dx;
    const ny = player.y + dy;
    // 잠긴 출입구 체크
    const warp = warpAt(nx, ny);
    if (warp && warp.requires && !state.flags[warp.requires]) {
      UI.toast(warp.lockMsg || "아직 갈 수 없다.");
      return;
    }
    if (isSolid(nx, ny)) return;
    player.fromX = player.x;
    player.fromY = player.y;
    player.x = nx;
    player.y = ny;
    player.progress = 0;
    player.moving = true;
  }

  function facingTile() {
    const dirs = [ [0, -1], [0, 1], [-1, 0], [1, 0] ];
    for (const [dx, dy] of dirs) {
      const tx = player.x + dx;
      const ty = player.y + dy;
      const npc = npcsHere().find((n) => n.x === tx && n.y === ty);
      if (npc) return { npc };
      if (SHOP_DOOR.map === state.map && tx === SHOP_DOOR.x && ty === SHOP_DOOR.y) return { shop: true };
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
      player.progress += dt / 160;
      if (player.progress >= 1) {
        player.progress = 1;
        player.moving = false;
        state.px = player.x;
        state.py = player.y;
        // 출입구 도착 → 맵 전환
        const warp = warpAt(player.x, player.y);
        if (warp && (!warp.requires || state.flags[warp.requires])) {
          changeMap(warp.to, warp.tx, warp.ty);
          return;
        }
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
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        drawTile(ctx, tileAt(x, y), x, y, time);
      }
    }
    currentMap().signs.forEach(([c, r, t]) => drawSign(ctx, c, r, t));

    npcsHere().forEach((npc) => {
      const bob = Math.sin(time / 500 + npc.x) > 0.7 ? -1 : 0;
      drawCharacter(ctx, npc.sprite, npc.x * TILE, npc.y * TILE, bob, null);
      ctx.font = "10px 'Malgun Gothic', sans-serif";
      const label = npc.name;
      const lw = ctx.measureText(label).width + 8;
      const lx = npc.x * TILE + TILE / 2 - lw / 2;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(lx, npc.y * TILE - 12, lw, 12);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, lx + 4, npc.y * TILE - 3);
      if (anyQuestAvailable(npc)) {
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "#f0d060";
        const blink = Math.sin(time / 300) > 0 ? "❗" : "❕";
        ctx.fillText(blink, npc.x * TILE + TILE / 2 - 6, npc.y * TILE - 16);
      }
    });

    const ix = (player.fromX + (player.x - player.fromX) * player.progress) * TILE;
    const iy = (player.fromY + (player.y - player.fromY) * player.progress) * TILE;
    const bob = player.moving && Math.floor(time / 120) % 2 === 0 ? -2 : 0;
    drawCharacter(ctx, state.charPreset, ix, iy, bob, outfitPalette());

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
  function startGame(isNew) {
    document.getElementById("game-wrap").classList.remove("hidden");
    setCurrentMap(state.map);
    player.x = player.fromX = state.px;
    player.y = player.fromY = state.py;
    UI.updateHUD(state);
    UI.updateObjective(state.objective);

    document.getElementById("btn-medals").addEventListener("click", () => UI.showMedals(state));
    document.getElementById("btn-settings").addEventListener("click", () => UI.showSettings());
    document.getElementById("btn-title-back").addEventListener("click", () => {
      if (confirm("타이틀로 돌아갈까요? (진행은 저장되어 있어요)")) UI.backToTitle();
    });

    bindTouch("pad-up", "ArrowUp");
    bindTouch("pad-down", "ArrowDown");
    bindTouch("pad-left", "ArrowLeft");
    bindTouch("pad-right", "ArrowRight");
    const actBtn = document.getElementById("pad-action");
    if (actBtn) {
      actBtn.addEventListener("touchstart", (e) => { e.preventDefault(); if (!UI.isModalOpen()) interact(); }, { passive: false });
      actBtn.addEventListener("mousedown", (e) => { e.preventDefault(); if (!UI.isModalOpen()) interact(); });
    }

    requestAnimationFrame(loop);

    if (isNew) {
      setTimeout(() => fireStory({ type: "start" }), 400);
    }
    if (!AI.hasKey()) {
      setTimeout(() => UI.toast("⚙️ 설정에서 Claude API 키를 넣으면 NPC가 AI로 첨삭해줘요!", true), isNew ? 8000 : 1500);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    UI.showTitle(hasSave() && state && state.name, {
      onNew: () => {
        localStorage.removeItem(SAVE_KEY);
        state = defaultState();
        UI.runIntro((name, preset) => {
          state.name = name;
          state.charPreset = preset;
          save();
          startGame(true);
        });
      },
      onContinue: () => {
        if (!state) state = defaultState();
        startGame(false);
      },
    });
  });
})();
