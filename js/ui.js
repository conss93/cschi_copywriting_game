// ============================================================
// UI: 인트로, 대화창, 퀘스트 창, 상점, 설정, 메달, HUD
// DOM 오버레이를 관리한다. 게임 로직은 game.js에 있다.
// ============================================================

const UI = (function () {
  const $ = (s) => document.querySelector(s);

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  let modalOpen = false;
  function isModalOpen() {
    return modalOpen;
  }
  function openModal(id) {
    $("#" + id).classList.remove("hidden");
    modalOpen = true;
  }
  function closeModals() {
    document.querySelectorAll(".modal, #dialogue").forEach((m) => m.classList.add("hidden"));
    modalOpen = false;
  }

  function toast(msg, long) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add("hidden"), long ? 4200 : 2200);
  }

  // ---------- 인트로 ----------
  function runIntro(onDone) {
    const screen = $("#intro-screen");
    const textBox = $("#intro-text");
    screen.classList.remove("hidden");
    let line = 0;
    let charIdx = 0;
    let finished = false;
    let timer = null;

    function typeNext() {
      if (line >= INTRO_LINES.length) {
        finished = true;
        $("#intro-hint").textContent = "클릭해서 계속";
        return;
      }
      const current = INTRO_LINES[line];
      if (charIdx === 0) textBox.appendChild(el("p"));
      const p = textBox.lastChild;
      if (charIdx < current.length) {
        p.textContent = current.slice(0, ++charIdx);
        timer = setTimeout(typeNext, 55);
      } else {
        line++;
        charIdx = 0;
        timer = setTimeout(typeNext, 500);
      }
    }

    function skip() {
      if (!finished) {
        clearTimeout(timer);
        textBox.innerHTML = "";
        INTRO_LINES.forEach((l) => textBox.appendChild(el("p", null, l)));
        finished = true;
        $("#intro-hint").textContent = "클릭해서 계속";
      } else {
        screen.removeEventListener("click", skip);
        screen.classList.add("hidden");
        showCharacterSelect(onDone);
      }
    }
    screen.addEventListener("click", skip);
    typeNext();
  }

  function showCharacterSelect(onDone) {
    openModal("charselect-modal");
    let chosen = "playerA";
    const cards = document.querySelectorAll(".char-card");
    cards.forEach((card) => {
      const canvas = card.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.scale(2.4, 2.4);
      drawCharacter(ctx, card.dataset.preset, 0, 4, 0, null);
      ctx.restore();
      card.addEventListener("click", () => {
        cards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        chosen = card.dataset.preset;
      });
    });
    cards[0].classList.add("selected");

    $("#btn-charselect-ok").onclick = () => {
      const name = $("#input-name").value.trim();
      if (!name) {
        toast("이름을 입력해주세요!");
        return;
      }
      closeModals();
      onDone(name, chosen);
    };
  }

  // ---------- HUD ----------
  function updateHUD(state) {
    $("#hud-name").textContent = state.name;
    $("#hud-level").textContent = "Lv." + state.level;
    $("#hud-points").textContent = state.points.toLocaleString() + "P";
    const need = state.level * 200;
    $("#hud-xp-fill").style.width = Math.min(100, (state.xp / need) * 100) + "%";
    $("#hud-ai").textContent = AI.hasKey() ? "🤖 AI 채점" : "📏 기본 채점";
    const done = Object.keys(state.completed).length;
    $("#hud-quest").textContent = "📋 " + done + "/" + QUESTS.length;
  }

  // ---------- 대화창 ----------
  // options: [{label, onClick}]
  function showDialogue(npc, text, options) {
    const box = $("#dialogue");
    box.classList.remove("hidden");
    modalOpen = true;
    $("#dlg-name").textContent = npc ? npc.name + " · " + npc.title : "";
    $("#dlg-name").style.color = npc ? npc.color : "#f0d060";
    $("#dlg-text").textContent = text;
    const menu = $("#dlg-menu");
    menu.innerHTML = "";
    (options || []).forEach((opt) => {
      const btn = el("button", "dlg-btn", opt.label);
      btn.addEventListener("click", opt.onClick);
      menu.appendChild(btn);
    });
  }

  // 잡담 모드: 입력창 포함 대화
  function showChatInput(npc, onSend, onExit) {
    const menu = $("#dlg-menu");
    menu.innerHTML = "";
    const wrap = el("div", "chat-input-row");
    const input = el("input");
    input.type = "text";
    input.maxLength = 200;
    input.placeholder = npc.name + "에게 말 걸기…";
    const send = el("button", "dlg-btn primary", "전송");
    const exit = el("button", "dlg-btn", "그만하기");
    send.addEventListener("click", () => {
      const msg = input.value.trim();
      if (msg) {
        input.value = "";
        onSend(msg);
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send.click();
      e.stopPropagation();
    });
    exit.addEventListener("click", onExit);
    wrap.appendChild(input);
    wrap.appendChild(send);
    wrap.appendChild(exit);
    menu.appendChild(wrap);
    input.focus();
  }

  // ---------- 퀘스트 창 ----------
  function showQuest(quest, npc, state, handlers) {
    openModal("quest-modal");
    $("#q-title").textContent = "📋 " + quest.title;
    $("#q-npc").textContent = npc.name + " · " + npc.title;
    $("#q-npc").style.color = npc.color;
    $("#q-briefing").textContent = "“" + quest.briefing + "”";
    $("#q-mission").textContent = quest.mission;
    const input = $("#q-input");
    input.value = "";
    $("#q-count").textContent = "0자";
    input.oninput = () => ($("#q-count").textContent = input.value.trim().length + "자");
    $("#q-result").classList.add("hidden");
    $("#q-form").classList.remove("hidden");
    $("#q-hint-box").classList.add("hidden");

    // 아메리카노(힌트) 버튼
    const coffeeBtn = $("#q-btn-coffee");
    const coffees = state.coffees || 0;
    coffeeBtn.textContent = "🧋 힌트 보기 (" + coffees + "개)";
    coffeeBtn.disabled = coffees <= 0;
    coffeeBtn.onclick = () => {
      if (handlers.onCoffee()) {
        $("#q-hint-box").textContent = "💡 모범 예시: " + quest.example;
        $("#q-hint-box").classList.remove("hidden");
        coffeeBtn.disabled = true;
      }
    };

    $("#q-btn-submit").onclick = () => {
      const text = input.value.trim();
      if (text.length < quest.minLength) {
        toast("너무 짧아요! 최소 " + quest.minLength + "자 이상 써주세요.");
        return;
      }
      handlers.onSubmit(text);
    };
    $("#q-btn-close").onclick = () => closeModals();
  }

  function showGrading(npcName) {
    $("#q-form").classList.add("hidden");
    const box = $("#q-result");
    box.classList.remove("hidden");
    box.innerHTML = "";
    box.appendChild(el("p", "grading-anim", "✍️ " + npcName + "이(가) 카피를 읽고 있다…"));
  }

  // result: {score, pass, feedback, tip, revised, checks?, reward?, leveledUp, newMedals}
  function showQuestResult(quest, npc, result, handlers) {
    const box = $("#q-result");
    box.classList.remove("hidden");
    $("#q-form").classList.add("hidden");
    box.innerHTML = "";

    const head = el("div", "result-head");
    head.appendChild(el("span", "result-score " + (result.pass ? "pass" : "fail"), result.score + "점"));
    head.appendChild(el("span", "result-verdict", result.pass ? "합격!" : "재도전"));
    box.appendChild(head);

    const fb = el("div", "result-feedback");
    fb.appendChild(el("p", "fb-npc", npc.name + "의 첨삭"));
    fb.appendChild(el("p", null, result.feedback));
    box.appendChild(fb);

    if (result.checks) {
      const ul = el("ul", "check-list");
      result.checks.forEach((c) => ul.appendChild(el("li", c.pass ? "ok" : "no", (c.pass ? "✅ " : "❌ ") + c.desc)));
      box.appendChild(ul);
    }
    if (result.revised) {
      const rv = el("div", "result-revised");
      rv.appendChild(el("p", "fb-npc", "✏️ 이렇게 다듬어 보면"));
      rv.appendChild(el("p", null, result.revised));
      box.appendChild(rv);
    }
    if (result.tip) box.appendChild(el("p", "result-tip", "💡 " + result.tip));

    if (result.pass && result.reward) {
      box.appendChild(el("p", "result-reward", "🎉 보상: +" + result.reward.xp + " XP, +" + result.reward.points + "P"));
      if (result.leveledUp) box.appendChild(el("p", "result-levelup", "⬆️ 레벨 업!"));
      (result.newMedals || []).forEach((m) => box.appendChild(el("p", "result-medal", m.icon + " 메달 획득: " + m.name)));
      box.appendChild(el("p", "result-lesson", "📖 " + quest.lesson));
    }

    const row = el("div", "btn-row");
    if (!result.pass) {
      const retry = el("button", "btn secondary", "다시 쓰기");
      retry.addEventListener("click", () => {
        $("#q-result").classList.add("hidden");
        $("#q-form").classList.remove("hidden");
      });
      row.appendChild(retry);
    }
    const ok = el("button", "btn primary", result.pass ? "좋았어!" : "나중에 다시");
    ok.addEventListener("click", () => {
      closeModals();
      if (handlers && handlers.onClose) handlers.onClose();
    });
    row.appendChild(ok);
    box.appendChild(row);
  }

  // ---------- 상점 ----------
  function showShop(state, onBuy) {
    openModal("shop-modal");
    $("#shop-points").textContent = state.points.toLocaleString() + "P";
    const list = $("#shop-list");
    list.innerHTML = "";
    SHOP_ITEMS.forEach((item) => {
      const owned = item.type !== "consumable" && state.inventory.includes(item.id);
      const equipped = state.outfit === item.id;
      const card = el("div", "shop-item" + (owned ? " owned" : ""));
      card.appendChild(el("span", "shop-icon", item.icon));
      const info = el("div", "shop-info");
      info.appendChild(el("p", "shop-name", item.name));
      info.appendChild(el("p", "shop-desc", item.desc));
      card.appendChild(info);
      const btn = el("button", "btn small primary");
      if (item.type === "outfit" && owned) {
        btn.textContent = equipped ? "벗기" : "입기";
        btn.className = "btn small secondary";
      } else if (owned) {
        btn.textContent = "보유중";
        btn.disabled = true;
      } else {
        btn.textContent = item.price.toLocaleString() + "P";
        btn.disabled = state.points < item.price;
      }
      btn.addEventListener("click", () => onBuy(item));
      card.appendChild(btn);
      list.appendChild(card);
    });
    $("#btn-shop-close").onclick = () => closeModals();
  }

  // ---------- 설정 (API 키) ----------
  function showSettings() {
    openModal("settings-modal");
    $("#input-apikey").value = AI.getKey();
    $("#apikey-status").textContent = AI.hasKey()
      ? "✅ 키가 저장되어 있습니다. NPC가 AI로 대화하고 첨삭합니다."
      : "키가 없으면 기본(규칙 기반) 채점으로 동작합니다.";
    $("#btn-apikey-save").onclick = async () => {
      const key = $("#input-apikey").value.trim();
      AI.setKey(key);
      if (!key) {
        $("#apikey-status").textContent = "키를 삭제했습니다. 기본 채점으로 전환됩니다.";
        return;
      }
      $("#apikey-status").textContent = "연결 확인 중…";
      try {
        await AI.test();
        $("#apikey-status").textContent = "✅ 연결 성공! NPC들이 살아 움직이기 시작합니다.";
      } catch (e) {
        $("#apikey-status").textContent = "❌ 연결 실패: " + e.message;
      }
    };
    $("#btn-settings-close").onclick = () => closeModals();
  }

  // ---------- 메달 ----------
  function showMedals(state) {
    openModal("medals-modal");
    const grid = $("#medal-grid");
    grid.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const got = state.medals.includes(a.id);
      const card = el("div", "medal" + (got ? " earned" : ""));
      card.appendChild(el("div", "medal-icon", got ? a.icon : "❓"));
      card.appendChild(el("div", "medal-name", got ? a.name : "???"));
      card.appendChild(el("div", "medal-desc", got ? a.desc : "아직 획득하지 못했다"));
      grid.appendChild(card);
    });
    $("#btn-medals-close").onclick = () => closeModals();
  }

  return {
    isModalOpen, closeModals, toast, runIntro, updateHUD,
    showDialogue, showChatInput, showQuest, showGrading, showQuestResult,
    showShop, showSettings, showMedals,
  };
})();
