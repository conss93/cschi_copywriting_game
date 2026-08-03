// 게임 엔진: 상태 관리, 화면 전환, 퀘스트 진행, 평가, 보상
(function () {
  "use strict";

  const SAVE_KEY = "copyquest_save_v1";

  // ---------- 상태 ----------
  const defaultState = () => ({
    name: "",
    xp: 0,
    level: 1,
    completed: {}, // questId -> { score, best, attempts, lastText }
    medals: [], // achievement ids
    perfects: 0,
    totalAttempts: 0,
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      /* 손상된 저장 데이터는 무시하고 새로 시작 */
    }
    return defaultState();
  }

  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  // 레벨 공식: 다음 레벨까지 필요 XP = level * 200
  function xpForLevel(level) {
    return level * 200;
  }

  function addXp(amount) {
    state.xp += amount;
    let leveledUp = false;
    while (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
      leveledUp = true;
    }
    return leveledUp;
  }

  // ---------- 유틸 ----------
  const $ = (sel) => document.querySelector(sel);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function show(screenId) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $("#" + screenId).classList.add("active");
    window.scrollTo(0, 0);
  }

  function questUnlocked(quest) {
    // 같은 장의 이전 퀘스트를 완료해야 다음 퀘스트가 열린다.
    const idx = QUESTS.indexOf(quest);
    if (idx === 0) return true;
    return !!state.completed[QUESTS[idx - 1].id];
  }

  // ---------- 렌더링: 허브(마을) ----------
  function renderHub() {
    $("#player-name").textContent = state.name || "이름 없는 워드스미스";
    $("#player-level").textContent = "Lv." + state.level;
    const need = xpForLevel(state.level);
    $("#player-xp").textContent = state.xp + " / " + need + " XP";
    $("#xp-fill").style.width = Math.min(100, (state.xp / need) * 100) + "%";
    $("#medal-count").textContent = state.medals.length + " / " + ACHIEVEMENTS.length;

    const list = $("#quest-list");
    list.innerHTML = "";
    let currentChapter = 0;
    QUESTS.forEach((q) => {
      if (q.chapter !== currentChapter) {
        currentChapter = q.chapter;
        const names = { 1: "1장 · 견습 워드스미스", 2: "2장 · 거리의 카피 용병", 3: "3장 · 길드의 시험" };
        list.appendChild(el("h3", "chapter-title", names[currentChapter] || currentChapter + "장"));
      }
      const done = state.completed[q.id];
      const unlocked = questUnlocked(q);
      const card = el("div", "quest-card" + (unlocked ? "" : " locked"));
      const head = el("div", "quest-card-head");
      head.appendChild(el("span", "quest-status", done ? "✅" : unlocked ? "🗡️" : "🔒"));
      head.appendChild(el("span", "quest-title", q.title));
      head.appendChild(el("span", "quest-xp", "+" + q.xp + " XP"));
      card.appendChild(head);
      card.appendChild(el("p", "quest-client", "의뢰인: " + q.client));
      if (done) {
        card.appendChild(el("p", "quest-best", "최고 기록: " + done.best + "점 · 도전 " + done.attempts + "회"));
      }
      if (unlocked) {
        card.addEventListener("click", () => openQuest(q));
      }
      list.appendChild(card);
    });

    renderMedals();
    show("screen-hub");
  }

  function renderMedals() {
    const wrap = $("#medal-list");
    wrap.innerHTML = "";
    ACHIEVEMENTS.forEach((a) => {
      const got = state.medals.includes(a.id);
      const card = el("div", "medal" + (got ? " earned" : ""));
      card.appendChild(el("div", "medal-icon", got ? a.icon : "❓"));
      card.appendChild(el("div", "medal-name", got ? a.name : "???"));
      card.appendChild(el("div", "medal-desc", got ? a.desc : "아직 획득하지 못한 메달"));
      wrap.appendChild(card);
    });
  }

  // ---------- 렌더링: 퀘스트 ----------
  let activeQuest = null;

  function openQuest(quest) {
    activeQuest = quest;
    $("#q-title").textContent = quest.title;
    $("#q-client").textContent = "의뢰인: " + quest.client;
    $("#q-briefing").textContent = quest.briefing;
    $("#q-mission").textContent = quest.mission;
    const input = $("#q-input");
    input.value = (state.completed[quest.id] && state.completed[quest.id].lastText) || "";
    updateCharCount();
    $("#q-result").classList.add("hidden");
    $("#q-submit").disabled = false;
    show("screen-quest");
    input.focus();
  }

  function updateCharCount() {
    const len = $("#q-input").value.trim().length;
    $("#q-charcount").textContent = len + "자";
  }

  function submitCopy() {
    const text = $("#q-input").value.trim();
    const q = activeQuest;
    if (text.length < q.minLength) {
      alert("카피가 너무 짧습니다. 최소 " + q.minLength + "자 이상 써주세요.");
      return;
    }

    state.totalAttempts += 1;
    const results = q.checks.map((c) => ({ desc: c.desc, pass: !!c.test(text) }));
    const passed = results.filter((r) => r.pass).length;
    const score = Math.round((passed / results.length) * 100);
    const perfect = passed === results.length;
    if (perfect) state.perfects += 1;

    // 보상: 점수 비율만큼 XP. 첫 완료는 전액, 재도전은 절반.
    const first = !state.completed[q.id];
    const gained = Math.round(q.xp * (score / 100) * (first ? 1 : 0.5));
    const leveledUp = addXp(gained);

    const prev = state.completed[q.id] || { best: 0, attempts: 0 };
    state.completed[q.id] = {
      score: score,
      best: Math.max(prev.best, score),
      attempts: prev.attempts + 1,
      lastText: text,
    };

    const newMedals = checkAchievements();
    save();
    renderResult(results, score, gained, leveledUp, newMedals, perfect);
  }

  function checkAchievements() {
    const earned = [];
    ACHIEVEMENTS.forEach((a) => {
      if (!state.medals.includes(a.id) && a.condition(state)) {
        state.medals.push(a.id);
        earned.push(a);
      }
    });
    return earned;
  }

  function renderResult(results, score, gained, leveledUp, newMedals, perfect) {
    const box = $("#q-result");
    box.innerHTML = "";
    box.classList.remove("hidden");

    box.appendChild(el("h3", null, perfect ? "🎉 완벽한 카피!" : "평가 결과"));
    box.appendChild(el("p", "score", score + "점 · +" + gained + " XP"));
    if (leveledUp) box.appendChild(el("p", "levelup", "⬆️ 레벨 업! 현재 Lv." + state.level));

    const ul = el("ul", "check-list");
    results.forEach((r) => {
      ul.appendChild(el("li", r.pass ? "pass" : "fail", (r.pass ? "✅ " : "❌ ") + r.desc));
    });
    box.appendChild(ul);

    // 자가 점검 체크리스트
    box.appendChild(el("h4", null, "📝 스스로 점검해보기"));
    const sc = el("ul", "self-check-list");
    activeQuest.selfChecks.forEach((s) => sc.appendChild(el("li", null, "· " + s)));
    box.appendChild(sc);

    // 교훈 + 모범 예시
    const lesson = el("div", "lesson-box");
    lesson.appendChild(el("h4", null, "💡 길드의 가르침"));
    lesson.appendChild(el("p", null, activeQuest.lesson));
    lesson.appendChild(el("p", "example", "모범 예시: " + activeQuest.example));
    box.appendChild(lesson);

    newMedals.forEach((m) => {
      box.appendChild(el("p", "new-medal", m.icon + " 새 메달 획득: " + m.name + " — " + m.desc));
    });

    const btnRow = el("div", "btn-row");
    const retry = el("button", "btn secondary", "다시 다듬기 (절반 XP)");
    retry.addEventListener("click", () => {
      box.classList.add("hidden");
      $("#q-input").focus();
    });
    const back = el("button", "btn primary", "마을로 돌아가기");
    back.addEventListener("click", renderHub);
    btnRow.appendChild(retry);
    btnRow.appendChild(back);
    box.appendChild(btnRow);
    box.scrollIntoView({ behavior: "smooth" });
  }

  // ---------- 초기화 ----------
  function init() {
    $("#btn-start").addEventListener("click", () => {
      const name = $("#input-name").value.trim();
      if (!name) {
        alert("워드스미스의 이름을 지어주세요.");
        return;
      }
      state.name = name;
      save();
      renderHub();
    });

    $("#input-name").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("#btn-start").click();
    });

    $("#q-input").addEventListener("input", updateCharCount);
    $("#q-submit").addEventListener("click", submitCopy);
    $("#q-back").addEventListener("click", renderHub);

    $("#btn-reset").addEventListener("click", () => {
      if (confirm("모든 진행 상황이 사라집니다. 정말 처음부터 시작할까요?")) {
        localStorage.removeItem(SAVE_KEY);
        state = defaultState();
        show("screen-intro");
      }
    });

    if (state.name) {
      renderHub();
    } else {
      show("screen-intro");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
