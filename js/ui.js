// ============================================================
// UI: 타이틀, 인트로, 스토리, 대화창, 퀘스트, 상점, 설정, 메달, HUD
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
    $("#dialogue").classList.add("hidden"); // 대화창 위에 다른 모달이 뜨는 경우, 뒤에 숨어 키 입력을 가로채지 않도록 정리
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

  // ---------- 타이틀 화면 ----------
  function showTitle(hasSave, handlers) {
    const screen = $("#title-screen");
    screen.classList.remove("hidden");
    const btnContinue = $("#btn-title-continue");
    btnContinue.disabled = !hasSave;
    btnContinue.onclick = () => {
      screen.classList.add("hidden");
      handlers.onContinue();
    };
    $("#btn-title-new").onclick = () => {
      if (hasSave && !confirm("저장된 게임이 있습니다. 새로 시작하면 기존 진행이 사라져요. 계속할까요?")) return;
      screen.classList.add("hidden");
      handlers.onNew();
    };
    $("#btn-title-settings").onclick = () => showSettings();
    $("#btn-title-help").onclick = () => showHelp();
    $("#btn-title-quit").onclick = () => {
      window.close();
      // 브라우저가 창을 못 닫게 하면 안내
      setTimeout(() => toast("브라우저 탭을 닫아 게임을 종료하세요. 진행은 자동 저장되어 있습니다.", true), 100);
    };
  }
  function backToTitle() {
    location.reload();
  }

  // ---------- 인트로 (타자기) ----------
  function runIntro(onDone) {
    const screen = $("#intro-screen");
    const textBox = $("#intro-text");
    textBox.innerHTML = "";
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
        timer = setTimeout(typeNext, 480);
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
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(2.4, 2.4);
      drawCharacter(ctx, card.dataset.preset, 0, 4, { moving: false, progress: 0, face: "down" }, null);
      ctx.restore();
      card.onclick = () => {
        cards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        chosen = card.dataset.preset;
      };
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

  // ---------- 스토리 컷신 ----------
  // lines: [{npc: npcId|null, text}], 순서대로 클릭해서 넘긴다
  function playStory(lines, onDone) {
    let idx = 0;
    function showLine() {
      const line = lines[idx];
      const npc = line.npc ? NPCS.find((n) => n.id === line.npc) : null;
      const isLast = idx === lines.length - 1;
      showDialogue(npc, line.text, [
        {
          label: isLast ? "✔ 확인" : "▶ 다음",
          onClick: () => {
            idx++;
            if (idx < lines.length) showLine();
            else {
              closeModals();
              if (onDone) onDone();
            }
          },
        },
      ]);
      if (!npc) {
        $("#dlg-name").textContent = "— 이야기 —";
        $("#dlg-name").style.color = "#a698bc";
      }
    }
    showLine();
  }

  // ---------- HUD ----------
  function updateHUD(state) {
    $("#hud-name").textContent = state.name;
    $("#hud-level").textContent = "Lv." + state.level;
    $("#hud-points").textContent = state.points.toLocaleString() + "P";
    const need = state.level * 200;
    $("#hud-xp-fill").style.width = Math.min(100, (state.xp / need) * 100) + "%";
    $("#hud-ai").textContent = AI.hasKey() ? "🤖" : "📏";
    const mains = QUESTS.filter((q) => q.type === "main");
    const done = mains.filter((q) => state.completed[q.id]).length;
    $("#hud-quest").textContent = "📋 " + done + "/" + mains.length;
    $("#hud-map").textContent = "📍 " + currentMap().name;
  }

  function updateObjective(text) {
    $("#objective-text").textContent = text || "";
    $("#objective-bar").classList.toggle("hidden", !text);
  }

  // ---------- 대화창 ----------
  let dlgFocus = 0;

  function setDlgFocus(i) {
    const btns = document.querySelectorAll("#dlg-menu .dlg-btn");
    if (!btns.length) return;
    dlgFocus = ((i % btns.length) + btns.length) % btns.length;
    btns.forEach((b, idx) => b.classList.toggle("focused", idx === dlgFocus));
  }

  function showDialogue(npc, text, options) {
    const box = $("#dialogue");
    box.classList.remove("hidden");
    modalOpen = true;
    $("#dlg-name").textContent = npc ? npc.name + " · " + npc.title : "";
    $("#dlg-name").style.color = npc ? npc.color : "#f0d060";
    $("#dlg-text").textContent = text;
    const menu = $("#dlg-menu");
    menu.innerHTML = "";
    (options || []).forEach((opt, i) => {
      const btn = el("button", "dlg-btn" + (opt.primary ? " primary" : ""));
      btn.appendChild(el("span", "dlg-key", String(i + 1)));
      btn.appendChild(document.createTextNode(opt.label));
      btn.addEventListener("click", opt.onClick);
      btn.addEventListener("mouseenter", () => setDlgFocus(i));
      menu.appendChild(btn);
    });
    $("#dlg-hint").classList.toggle("hidden", (options || []).length === 0);
    setDlgFocus(0);
  }

  // AI 응답 대기 중임을 분명히 보여주는 전용 표시 ("…"만 뜨면 멈춘 것처럼 보여 오해할 수 있다)
  function showThinking(npc) {
    const box = $("#dialogue");
    box.classList.remove("hidden");
    modalOpen = true;
    $("#dlg-name").textContent = npc ? npc.name + " · " + npc.title : "";
    $("#dlg-name").style.color = npc ? npc.color : "#f0d060";
    $("#dlg-text").innerHTML =
      '<span class="dlg-typing">' + (npc ? npc.name : "상대") +
      '이(가) 답장을 쓰는 중<span class="dlg-dots"><span>.</span><span>.</span><span>.</span></span></span>';
    $("#dlg-menu").innerHTML = "";
    $("#dlg-hint").classList.add("hidden");
  }

  // 대화창이 열려 있을 때 방향키/숫자/Enter로 선택지를 넘긴다 (마우스 클릭 없이도 진행 가능)
  function handleDialogueKey(e) {
    const box = $("#dialogue");
    if (!box || box.classList.contains("hidden")) return false;
    if ($("#dlg-menu input")) return false; // 잡담 입력창이 떠 있으면 입력창 자체 핸들러에 맡긴다
    const btns = document.querySelectorAll("#dlg-menu .dlg-btn");
    if (!btns.length) return false;

    if (["ArrowUp", "ArrowLeft", "w", "a"].includes(e.key)) {
      setDlgFocus(dlgFocus - 1);
      return true;
    }
    if (["ArrowDown", "ArrowRight", "s", "d"].includes(e.key)) {
      setDlgFocus(dlgFocus + 1);
      return true;
    }
    if (e.key === " " || e.key === "Enter") {
      btns[dlgFocus].click();
      return true;
    }
    const num = parseInt(e.key, 10);
    if (!isNaN(num) && num >= 1 && num <= btns.length) {
      btns[num - 1].click();
      return true;
    }
    return false;
  }

  function showChatInput(npc, onSend, onExit) {
    const menu = $("#dlg-menu");
    menu.innerHTML = "";
    $("#dlg-hint").classList.add("hidden");
    const wrap = el("div", "chat-input-row");
    const input = el("input");
    input.type = "text";
    input.maxLength = 200;
    input.placeholder = npc.name + "에게 말 걸기…";
    const send = el("button", "dlg-btn primary", "전송");
    const exit = el("button", "dlg-btn", "그만 (ESC)");
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
    const typeLabel = quest.type === "sub" ? "🔖 [서브] " : quest.type === "practice" ? "🌱 [훈련] " : "📋 [메인] ";
    $("#q-title").textContent = typeLabel + quest.title;
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

    const coffeeBtn = $("#q-btn-coffee");
    const coffees = state.coffees || 0;
    coffeeBtn.textContent = "🧋 힌트 (" + coffees + ")";
    coffeeBtn.disabled = coffees <= 0;
    coffeeBtn.onclick = () => {
      if (handlers.onCoffee()) {
        $("#q-hint-box").textContent = "💡 참고 예시: " + quest.example;
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
      rv.appendChild(el("p", "fb-npc", "🖋️ 프로는 이렇게 씁니다"));
      rv.appendChild(el("p", "revised-copy", "“" + result.revised + "”"));
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

  // ---------- 도움말 ----------
  function showHelp() {
    openModal("help-modal");
    $("#btn-help-close").onclick = () => closeModals();
  }

  // ---------- 메달 ----------
  function showMedals(state) {
    openModal("medals-modal");
    $("#medal-count").textContent = state.medals.length + " / " + ACHIEVEMENTS.length;
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
    isModalOpen, closeModals, toast,
    showTitle, backToTitle, runIntro, playStory,
    updateHUD, updateObjective,
    showDialogue, showThinking, handleDialogueKey, showChatInput, showQuest, showGrading, showQuestResult,
    showShop, showSettings, showHelp, showMedals,
  };
})();
