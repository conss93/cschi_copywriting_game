// 업적 메달 정의
// condition(state): 플레이어 상태를 받아 true를 반환하면 메달 획득.
// state = { completed: {questId: {score, best, attempts}}, level, xp, totalAttempts, perfects }
const ACHIEVEMENTS = [
  {
    id: "first_ink",
    icon: "🖋️",
    name: "첫 잉크",
    desc: "첫 번째 퀘스트를 완료했다.",
    condition: (s) => Object.keys(s.completed).length >= 1,
  },
  {
    id: "guild_member",
    icon: "📜",
    name: "길드 등록증",
    desc: "1장의 모든 퀘스트를 완료했다.",
    condition: (s) =>
      QUESTS.filter((q) => q.chapter === 1).every((q) => s.completed[q.id]),
  },
  {
    id: "word_mercenary",
    icon: "⚔️",
    name: "언어의 용병",
    desc: "2장의 모든 퀘스트를 완료했다.",
    condition: (s) =>
      QUESTS.filter((q) => q.chapter === 2).every((q) => s.completed[q.id]),
  },
  {
    id: "master_wordsmith",
    icon: "👑",
    name: "마스터 워드스미스",
    desc: "모든 퀘스트를 완료했다.",
    condition: (s) => QUESTS.every((q) => s.completed[q.id]),
  },
  {
    id: "perfectionist",
    icon: "💯",
    name: "한 번에 통과",
    desc: "자동 평가 기준을 모두 만족하는 카피를 제출했다.",
    condition: (s) => s.perfects >= 1,
  },
  {
    id: "triple_perfect",
    icon: "🔥",
    name: "불붙은 펜촉",
    desc: "만점 통과를 3회 달성했다.",
    condition: (s) => s.perfects >= 3,
  },
  {
    id: "grinder",
    icon: "🔁",
    name: "퇴고의 장인",
    desc: "같은 퀘스트에 3번 이상 도전해 카피를 다듬었다.",
    condition: (s) =>
      Object.values(s.completed).some((c) => c.attempts >= 3),
  },
  {
    id: "level5",
    icon: "⭐",
    name: "떠오르는 별",
    desc: "레벨 5에 도달했다.",
    condition: (s) => s.level >= 5,
  },
];
