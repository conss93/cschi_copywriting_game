// ============================================================
// Claude API 연동: NPC 대화 + 카피 첨삭/채점
// 플레이어가 자신의 API 키를 입력하면 NPC가 진짜 AI로 반응한다.
// 키가 없으면 규칙 기반 채점과 고정 대사로 폴백.
// ============================================================

const AI = (function () {
  const KEY_STORAGE = "copyquest_api_key";
  const API_URL = "https://api.anthropic.com/v1/messages";
  const MODEL = "claude-opus-5";

  function getKey() {
    return localStorage.getItem(KEY_STORAGE) || "";
  }
  function setKey(key) {
    if (key) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  }
  function hasKey() {
    return !!getKey();
  }

  async function request(body) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": getKey(),
        "anthropic-version": "2023-06-01",
        // 브라우저에서 직접 호출하기 위한 CORS 옵트인 헤더
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err.error && err.error.message) || "API 오류 " + res.status);
    }
    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("응답이 거부되었습니다.");
    return data;
  }

  function textOf(data) {
    const block = (data.content || []).find((b) => b.type === "text");
    return block ? block.text : "";
  }

  // ---------- NPC 잡담 ----------
  // history: [{role:"user"|"assistant", content:"..."}]
  async function chat(npc, history, playerName) {
    const system =
      npc.persona +
      "\n\n당신은 픽셀 RPG '카피퀘스트: 글빨골목'의 NPC다. 상대는 이 골목에 갓 도착한 신입 카피라이터 '" +
      playerName +
      "'이다. 게임 속 대화이므로 답변은 반드시 1~3문장으로 짧게, 캐릭터의 말투를 유지하며 한국어로 한다. 카피라이팅에 대한 잡담이나 조언, 동네 이야기를 나눈다. 목록이나 마크다운 없이 대사만 말한다.",
    body = {
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: system,
      messages: history,
    };
    const data = await request(body);
    return textOf(data).trim();
  }

  // ---------- 카피 채점/첨삭 ----------
  const GRADE_SCHEMA = {
    type: "object",
    properties: {
      score: { type: "integer", description: "0~100 점수" },
      pass: { type: "boolean", description: "70점 이상이면 true" },
      feedback: { type: "string", description: "NPC의 말투로 쓴 첨삭 코멘트 (2~4문장, 좋은 점과 고칠 점을 구체적으로)" },
      tip: { type: "string", description: "다음에 적용할 카피라이팅 팁 한 문장" },
      revised: { type: "string", description: "제출된 카피를 다듬은 개선 예시 한 줄" },
    },
    required: ["score", "pass", "feedback", "tip", "revised"],
    additionalProperties: false,
  };

  async function grade(quest, npc, submission, playerName) {
    const system =
      npc.persona +
      "\n\n당신은 지금 신입 카피라이터 '" + playerName + "'가 제출한 카피를 첨삭하는 중이다. 캐릭터의 말투를 유지하되, 카피라이팅 전문가의 눈으로 공정하게 평가한다.\n\n" +
      "평가 기준:\n" +
      "1. 미션의 제약(글자 수 등)을 지켰는가\n" +
      "2. 구체적인가 (누구나 할 수 있는 뻔한 말은 감점)\n" +
      "3. 타겟에게 행동할 이유를 주는가\n" +
      "4. 미션의 핵심 기법(예: 혜택 번역, 사회적 증거)을 이해하고 썼는가\n\n" +
      "70점 이상이면 합격이다. 잘 쓴 카피에는 아낌없이 높은 점수를, 성의 없는 제출에는 낮은 점수를 준다. feedback은 반드시 당신의 캐릭터 말투로 쓴다.";
    const user =
      "[의뢰 상황]\n" + quest.briefing +
      "\n\n[미션]\n" + quest.mission +
      "\n\n[제출된 카피]\n" + submission;
    const body = {
      model: MODEL,
      max_tokens: 2048,
      system: system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: { type: "json_schema", schema: GRADE_SCHEMA },
      },
    };
    const data = await request(body);
    const parsed = JSON.parse(textOf(data));
    parsed.score = Math.max(0, Math.min(100, parsed.score));
    return parsed;
  }

  // ---------- 연결 테스트 ----------
  async function test() {
    const data = await request({
      model: MODEL,
      max_tokens: 512,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "OK라고만 답해." }],
    });
    return textOf(data).length > 0;
  }

  return { getKey, setKey, hasKey, chat, grade, test };
})();
