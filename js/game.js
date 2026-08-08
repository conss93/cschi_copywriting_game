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
    practiceCount: 0,
    affinity: {}, // npcId -> 잡담 횟수 (친밀도)
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
    }, state.name);
    return true;
  }

  // ---------- 퀘스트 진행 ----------
  // 메인 스토리 진행 순서에는 일반 카피 퀘스트("main")뿐 아니라 미니게임형 중간보스("minigame")도
  // 포함된다 — nextMainQuest()가 순서대로 하나씩 내주는 대상이라, 여기서 빠지면 건너뛰어진다.
  const MAIN_QUESTS = QUESTS.filter((q) => q.type === "main" || q.type === "minigame");

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
    // 메인 퀘스트는 튜토리얼(오팀장 면접) 이후부터, 그리고 레벨 조건을 채워야 받을 수 있다
    if (main && main.npcId === npc.id && state.flags.tutorialDone && (!main.minLevel || state.level >= main.minLevel)) {
      list.push(main);
    }
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

  // ---------- 미니게임 (시간 제한 4지선다 — 중간보스 등 별도 유형의 메인 퀘스트) ----------
  function submitMinigame(quest, npc, correct, total) {
    const pass = correct >= (quest.passCount || Math.ceil(total / 2));
    const score = Math.round((correct / total) * 100);
    state.bestScore = Math.max(state.bestScore, score);
    let leveledUp = false;
    let newMedals = [];
    if (pass && !state.completed[quest.id]) {
      state.completed[quest.id] = { score, attempts: (state.attempts[quest.id] || 0) + 1 };
      state.points += quest.reward.points;
      state.totalEarned += quest.reward.points;
      leveledUp = addXp(quest.reward.xp);
      newMedals = checkMedals(true);
    }
    state.attempts[quest.id] = (state.attempts[quest.id] || 0) + 1;
    save();
    UI.updateHUD(state);
    const result = {
      score,
      pass,
      feedback: pass
        ? total + "문제 중 " + correct + "문제. 시간 안에 정확히 골라냈네요."
        : total + "문제 중 " + correct + "문제밖에 못 골랐어요. 아직 순발력이 부족해요.",
      reward: pass ? quest.reward : null,
      leveledUp,
      newMedals,
    };
    UI.showQuestResult(quest, npc, result, {
      onRetry: () => openQuest(quest, npc),
      onClose: () => {
        if (pass) {
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

  // ---------- 연습 마당 즉흥 훈련 (풀숲 인카운터) ----------
  const PRACTICE_NPC = {
    id: "practice", name: "골목의 감", title: "즉흥 훈련", color: "#8aa06a",
    persona: "당신은 '골목의 감', 풀숲에서 불쑥 나타나 즉흥 카피 대결을 거는 정체불명의 존재다. 짧고 리듬감 있게 말하며, 정식 의뢰보다는 가볍게 순발력을 시험하는 태도를 취한다. 잘 쓰면 화끈하게 칭찬하고, 못 쓰면 장난스럽게 놀린다.",
  };

  function startPractice() {
    const drill = PRACTICE_DRILLS[Math.floor(Math.random() * PRACTICE_DRILLS.length)];
    const quest = Object.assign({ id: "practice", type: "practice" }, drill);
    UI.showQuest(quest, PRACTICE_NPC, state, {
      onCoffee: () => false, // 훈련은 힌트 없이 순발력으로
      onSubmit: (text) => submitPractice(quest, text),
    });
  }

  async function submitPractice(quest, text) {
    UI.showGrading(PRACTICE_NPC.name);
    let result;
    if (AI.hasKey()) {
      try {
        result = await AI.grade(quest, PRACTICE_NPC, text, state.name);
      } catch (e) {
        result = ruleGrade(quest, text);
      }
    } else {
      result = ruleGrade(quest, text);
    }
    state.bestScore = Math.max(state.bestScore, result.score);
    let leveledUp = false;
    let newMedals = [];
    if (result.pass) {
      state.practiceCount = (state.practiceCount || 0) + 1;
      state.points += quest.reward.points;
      state.totalEarned += quest.reward.points;
      leveledUp = addXp(quest.reward.xp);
      newMedals = checkMedals(true);
    }
    result.reward = result.pass ? quest.reward : null;
    result.leveledUp = leveledUp;
    result.newMedals = newMedals;
    save();
    UI.updateHUD(state);
    UI.showQuestResult(quest, PRACTICE_NPC, result, { onClose: () => {} });
  }

  // ---------- NPC 상호작용 ----------
  function openQuest(quest, npc) {
    if (quest.type === "minigame") {
      UI.showMinigame(quest, npc, { onDone: (correct, total) => submitMinigame(quest, npc, correct, total) });
      return;
    }
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
  }

  function startQuest(quest, npc) {
    // 영웅서기식 상호 대화: 정식 미션을 던지기 전에, NPC와 주인공이 짧게 서로 말을 주고받는다.
    if (quest.intro && quest.intro.length) {
      UI.playStory(quest.intro, () => openQuest(quest, npc), state.name);
    } else {
      openQuest(quest, npc);
    }
  }

  function talkTo(npc) {
    const quests = availableQuestsFor(npc);
    const options = [];

    quests.forEach((quest) => {
      options.push({
        label: (quest.type === "sub" ? "🔖 " : quest.type === "minigame" ? "⚡ " : "📋 ") + quest.title,
        primary: quest.type !== "sub",
        onClick: () => startQuest(quest, npc),
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
        if (owner.id === npc.id && main.minLevel && state.level < main.minLevel) {
          // 레벨 조건 미달: 이 NPC가 바로 다음 메인 퀘스트의 주인이지만 아직 못 준다
          greeting = "…아직은 좀 이른 것 같은데. 최소 레벨 " + main.minLevel + "은 돼야 맡길 수 있을 것 같아. 연습 마당에서 실력 좀 더 쌓고 와.";
        } else if (owner.id === npc.id) {
          greeting = "어서 와!";
        } else {
          greeting = npc.redirect ? npc.redirect(owner.name) : "지금은 부탁할 게 없네. " + owner.name + "이(가) 사람을 찾던데?";
        }
      } else if (!main) {
        greeting = "골목을 지켜줘서 고마워. 덕분에 오늘도 영업 중이야!";
      } else {
        greeting = "처음 보는 얼굴이네. 골목기획 오팀장부터 만나보는 게 어때?";
      }
    }
    UI.showDialogue(npc, greeting, options);
  }

  // ---------- 잡담 (AI) / 친밀도 ----------
  function startChat(npc) {
    state.chatCount = (state.chatCount || 0) + 1;
    if (!state.affinity) state.affinity = {};
    state.affinity[npc.id] = (state.affinity[npc.id] || 0) + 1;
    if (state.affinity[npc.id] === 5) {
      state.points += 100;
      UI.toast("🤝 " + npc.name + "과(와) 친해졌다! 선물로 100P를 받았다.", true);
    }
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
        UI.showThinking(npc);
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
      if (e.key === "Escape" && !storyPlaying) {
        UI.closeModals();
        return;
      }
      // 대화창이 열려 있으면 방향키/숫자/엔터로 선택지 넘기기 (클릭 없이도 대화 진행)
      if (UI.handleDialogueKey(e)) {
        e.preventDefault();
      }
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

  // 아날로그 스틱: 손을 떼지 않고 드래그 방향을 바꿔가며 이동할 수 있게 한다.
  // (기존 4버튼 D패드는 위로 가다가 오른쪽으로 틀려면 손을 떼고 다시 눌러야 했다.)
  const DIR_VECTORS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  function bindJoystick() {
    const zone = document.getElementById("joystick-zone");
    const base = document.getElementById("joystick");
    const knob = document.getElementById("joystick-knob");
    if (!zone || !base || !knob) return;
    const MAX_R = 30; // 스틱 손잡이 최대 이동 반경(px)
    const DEAD_ZONE = 10; // 이 반경 안쪽은 중립(방향 없음)으로 취급
    let activeId = null;
    let currentDir = null;
    let originX = 0;
    let originY = 0; // 부유형: 터치를 시작한 지점이 곧 스틱의 중심이 된다

    function setDir(dir) {
      if (currentDir === dir) return;
      if (currentDir) keys[currentDir] = false;
      currentDir = dir;
      if (currentDir) {
        keys[currentDir] = true;
        if (!UI.isModalOpen() && !player.moving) {
          const d = DIR_VECTORS[currentDir];
          if (d) tryMove(d[0], d[1]);
        }
      }
    }

    function showAt(clientX, clientY) {
      const zoneRect = zone.getBoundingClientRect();
      originX = clientX;
      originY = clientY;
      base.style.left = clientX - zoneRect.left + "px";
      base.style.top = clientY - zoneRect.top + "px";
      base.classList.add("active");
      knob.style.transform = "translate(0px, 0px)";
    }

    function hide() {
      base.classList.remove("active");
      knob.style.transform = "translate(0px, 0px)";
      setDir(null);
    }

    function updateFromPoint(clientX, clientY) {
      const dx = clientX - originX;
      const dy = clientY - originY;
      const dist = Math.hypot(dx, dy);
      if (dist < DEAD_ZONE) {
        knob.style.transform = "translate(0px, 0px)";
        setDir(null);
        return;
      }
      const clamped = Math.min(dist, MAX_R);
      const angle = Math.atan2(dy, dx);
      knob.style.transform = "translate(" + (Math.cos(angle) * clamped) + "px, " + (Math.sin(angle) * clamped) + "px)";
      // 4방향 중 더 크게 기울어진 축으로 스냅 (그리드 기반 이동이라 대각선은 없다)
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : (dy > 0 ? "ArrowDown" : "ArrowUp");
      setDir(dir);
    }

    function onDown(e) {
      if (activeId !== null) return;
      activeId = e.pointerId;
      zone.setPointerCapture(activeId);
      showAt(e.clientX, e.clientY);
      e.preventDefault();
    }
    function onMove(e) {
      if (e.pointerId !== activeId) return;
      updateFromPoint(e.clientX, e.clientY);
      e.preventDefault();
    }
    function onUp(e) {
      if (e.pointerId !== activeId) return;
      activeId = null;
      hide();
    }
    zone.addEventListener("pointerdown", onDown);
    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerup", onUp);
    zone.addEventListener("pointercancel", onUp);
  }

  // ---------- 이동 ----------
  const STEP_MS = 130; // 한 칸 이동에 걸리는 시간 (짧을수록 반응이 즉각적으로 느껴진다)
  const player = { x: 12, y: 9, moving: false, fromX: 12, fromY: 9, progress: 1, face: "down" };
  let queuedMove = null; // 이동 애니메이션 도중 들어온 입력을 버퍼링 — 연타 시 "한 박자 밀리는" 느낌 방지

  function faceFor(dx, dy) {
    if (dx === 1) return "right";
    if (dx === -1) return "left";
    if (dy === 1) return "down";
    if (dy === -1) return "up";
    return player.face;
  }

  function tryMove(dx, dy) {
    if (UI.isModalOpen()) return;
    if (player.moving) {
      queuedMove = [dx, dy]; // 최신 입력 하나만 버퍼링 — 애니메이션이 끝나는 즉시 이어서 이동
      return;
    }
    const nx = player.x + dx;
    const ny = player.y + dy;
    const warp = warpAt(nx, ny);
    if (warp && warp.requires && !state.flags[warp.requires]) {
      UI.toast(warp.lockMsg || "아직 갈 수 없다.");
      return;
    }
    if (isSolid(nx, ny)) {
      player.face = faceFor(dx, dy); // 막힌 방향이라도 그쪽을 바라보게 (제자리 회전)
      return;
    }
    player.fromX = player.x;
    player.fromY = player.y;
    player.x = nx;
    player.y = ny;
    player.face = faceFor(dx, dy);
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

  // ---------- 렌더링 / 카메라 ----------
  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  let lastTime = 0;

  // 전체 맵을 한눈에 보여주는 대신, 플레이어를 따라다니는 카메라로 가까이서 본다 (포켓몬 골드식).
  // 화면이 좁으면(모바일) 세로로 긴 뷰포트, 넓으면(데스크톱) 가로로 넓은 뷰포트를 쓴다.
  let viewport = { w: 15, h: 10 };
  let vpPxW = viewport.w * TILE;
  let vpPxH = viewport.h * TILE;
  // 캔버스 표시 크기(CSS)에 맞춰 정수배로 실제 래스터 해상도를 올려서, 확대된 카메라 시야가
  // 뭉개지지 않고 또렷하게(레티나 대응 포함) 보이도록 한다. 게임 로직상의 좌표(TILE 단위)는 그대로 유지.
  function updateViewport() {
    const mobile = window.matchMedia("(max-width: 640px)").matches;
    const w = mobile ? 8 : 15; // 가로 타일 수는 기존처럼 화면 폭 기준으로 고정 (모바일=확대된 세로형)
    const cssW = canvas.parentElement.clientWidth || canvas.clientWidth || w * TILE;
    const tilePx = cssW / w; // 실제 화면에서 타일 한 칸이 차지할 CSS px

    // 세로 타일 수는 실제 남은 화면 높이(HUD/목표 바를 뺀 나머지)에 맞춰 동적으로 계산한다.
    // 고정값을 쓰면 화면이 짧은 기기(가로 모드 폰 등)에서 캔버스가 뷰포트 밖으로 밀려
    // 방향키/버튼이 잘려 보이는 문제가 생기므로, 항상 화면 안에 들어오도록 맞춘다.
    const hud = document.getElementById("hud");
    const obj = document.getElementById("objective-bar");
    const chromeH = (hud ? hud.offsetHeight : 0) + (obj ? obj.offsetHeight : 0);
    const availH = Math.max(tilePx * 6, window.innerHeight - chromeH - 20);
    const maxH = mobile ? 14 : 11;
    const h = Math.max(6, Math.min(maxH, Math.floor(availH / tilePx)));

    viewport = { w, h };
    vpPxW = viewport.w * TILE;
    vpPxH = viewport.h * TILE;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderScale = Math.max(1, Math.round((cssW * dpr) / vpPxW));
    canvas.width = vpPxW * renderScale;
    canvas.height = vpPxH * renderScale;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  updateViewport();
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateViewport, 120);
  });
  window.addEventListener("orientationchange", updateViewport);

  function getCamera() {
    if (viewport.w >= MAP_W && viewport.h >= MAP_H) return { x: 0, y: 0 };
    const px = player.fromX + (player.x - player.fromX) * player.progress;
    const py = player.fromY + (player.y - player.fromY) * player.progress;
    let cx = px - viewport.w / 2 + 0.5;
    let cy = py - viewport.h / 2 + 0.5;
    cx = Math.max(0, Math.min(MAP_W - viewport.w, cx));
    cy = Math.max(0, Math.min(MAP_H - viewport.h, cy));
    return { x: cx, y: cy };
  }

  function update(dt) {
    if (player.moving) {
      player.progress += dt / STEP_MS;
      if (player.progress >= 1) {
        player.progress = 1;
        player.moving = false;
        state.px = player.x;
        state.py = player.y;
        // 출입구 도착 → 맵 전환
        const warp = warpAt(player.x, player.y);
        if (warp && (!warp.requires || state.flags[warp.requires])) {
          queuedMove = null;
          changeMap(warp.to, warp.tx, warp.ty);
          return;
        }
        save();
        // 풀숲(L)을 밟으면 일정 확률로 즉흥 훈련 인카운터 — 걷다 보면 걸리는 랜덤 조우
        if (tileAt(player.x, player.y) === "L" && Math.random() < 0.16) {
          queuedMove = null;
          startPractice();
          return;
        }
        if (queuedMove) {
          const [qdx, qdy] = queuedMove;
          queuedMove = null;
          tryMove(qdx, qdy);
        }
      }
    } else if (!UI.isModalOpen()) {
      if (keys.ArrowUp || keys.w) tryMove(0, -1);
      else if (keys.ArrowDown || keys.s) tryMove(0, 1);
      else if (keys.ArrowLeft || keys.a) tryMove(-1, 0);
      else if (keys.ArrowRight || keys.d) tryMove(1, 0);
    }
  }

  function render(time) {
    const cam = getCamera();
    const camPxX = cam.x * TILE;
    const camPxY = cam.y * TILE;

    ctx.save();
    ctx.translate(-camPxX, -camPxY);

    const x0 = Math.max(0, Math.floor(cam.x));
    const x1 = Math.min(MAP_W, Math.ceil(cam.x + viewport.w) + 1);
    const y0 = Math.max(0, Math.floor(cam.y));
    const y1 = Math.min(MAP_H, Math.ceil(cam.y + viewport.h) + 1);

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        drawTile(ctx, tileAt(x, y), x, y, time);
      }
    }
    currentMap().signs.forEach(([c, r, t]) => drawSign(ctx, c, r, t));

    npcsHere().forEach((npc) => {
      const idleOffset = Math.sin(time / 700 + npc.x * 1.3) > 0.6 ? -1 : 0;
      drawCharacter(ctx, npc.sprite, npc.x * TILE, npc.y * TILE, { moving: false, progress: 0, face: npc.face || "down", idleOffset }, null);
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
    drawCharacter(ctx, state.charPreset, ix, iy, { moving: player.moving, progress: player.progress, face: player.face }, outfitPalette());

    ctx.restore();

    const target = facingTile();
    if (target && !UI.isModalOpen()) {
      ctx.font = "bold 12px 'Malgun Gothic', sans-serif";
      const hint = target.npc ? "SPACE: " + target.npc.name + "와 대화" : "SPACE: 편의점 들어가기";
      const hw = ctx.measureText(hint).width + 16;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(vpPxW / 2 - hw / 2, vpPxH - 28, hw, 20);
      ctx.fillStyle = "#f0d060";
      ctx.fillText(hint, vpPxW / 2 - hw / 2 + 8, vpPxH - 14);
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
    updateViewport(); // 이제 실제 표시 크기를 측정할 수 있으므로 해상도 재계산
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

    bindJoystick();
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
