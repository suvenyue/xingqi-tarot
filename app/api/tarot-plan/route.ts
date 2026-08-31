type Spread = 'single' | 'three' | 'celtic' | 'relationship' | 'choice' | 'career' | 'year';

type TarotPlan = {
  refinedQuestion: string;
  spread: Spread;
  reason: string;
  followUps: string[];
  memorySuggestion: string;
};

const spreadNames: Record<Spread, string> = {
  single: '单牌指引',
  three: '三牌展开',
  celtic: '凯尔特十字',
  relationship: '感情关系',
  choice: '二选一决策',
  career: '事业发展',
  year: '年度十二宫',
};

const PLAN_LIMIT = 16;
const PLAN_WINDOW_MS = 24 * 60 * 60 * 1000;
const planBuckets = new Map<string, { count: number; resetAt: number }>();

function consumePlanQuota(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const key = forwarded || request.headers.get('x-real-ip') || 'anonymous';
  const now = Date.now();
  const bucket = planBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    planBuckets.set(key, { count: 1, resetAt: now + PLAN_WINDOW_MS });
    return true;
  }
  if (bucket.count >= PLAN_LIMIT) return false;
  bucket.count += 1;
  return true;
}

function inferSpread(concern: string): Spread {
  if (/全年|未来一年|这一年|年度|十二个月/.test(concern)) return 'year';
  if (/还是|二选一|两个选择|选A|选B|选择哪|去或留|要不要换/.test(concern)) return 'choice';
  if (/感情|关系|喜欢|暧昧|复合|分手|对象|伴侣|对方|他怎么想|她怎么想|TA/.test(concern)) return 'relationship';
  if (/工作|事业|职业|转行|离职|升职|求职|项目|同事|领导|学业|考试/.test(concern)) return 'career';
  if (/反复|根源|为什么总|长期|很多方面|完整分析|看不清全貌/.test(concern)) return 'celtic';
  if (concern.length <= 24) return 'single';
  return 'three';
}

function fallbackPlan(concern: string): TarotPlan {
  const spread = inferSpread(concern);
  const topic = concern.replace(/[。！？!?]+$/g, '').trim();
  const refinedQuestion = spread === 'relationship'
    ? `围绕“${topic}”，这段关系目前的真实状态、主要阻碍和下一步适合采取的行动是什么？`
    : spread === 'career'
      ? `围绕“${topic}”，我当前最需要看清的职业课题、可用机会和下一步行动是什么？`
      : spread === 'choice'
        ? `面对“${topic}”，两条路径各自的机会、代价和发展趋势是什么？`
        : spread === 'year'
          ? `围绕“${topic}”，未来一年最重要的主题，以及各生活领域需要留意的变化是什么？`
          : spread === 'single'
            ? `关于“${topic}”，我此刻最需要看见的核心提醒是什么？`
            : spread === 'celtic'
              ? `围绕“${topic}”，问题的根源、现实阻碍、可用资源和当前路径的发展趋势是什么？`
              : `围绕“${topic}”，过去形成了什么影响、当下的关键是什么、接下来会怎样发展？`;

  const followUps: Record<Spread, string[]> = {
    single: ['这件事里，你最想改变的是结果，还是自己的状态？', '现在最让你难受的具体时刻是什么？'],
    three: ['这件事已经持续多久了？', '如果只改变一件事，你最希望先改变什么？'],
    celtic: ['这个问题最早从什么时候开始反复出现？', '你已经尝试过哪些方法，但没有真正奏效？'],
    relationship: ['你更担心对方的态度，还是关系一直没有进展？', '你们最近一次真实互动发生了什么？'],
    choice: ['选项A和选项B分别是什么？', '你最难承担的是哪一种代价？'],
    career: ['你更想解决眼前压力，还是确认长期方向？', '现在最大的现实限制是时间、能力、收入还是环境？'],
    year: ['这一年你最想优先改善哪个领域？', '目前有没有已经确定的重要计划或时间节点？'],
  };

  return {
    refinedQuestion,
    spread,
    reason: `${spreadNames[spread]}能把你描述的困扰拆成与它最相关的牌位，避免问题太散，也不会替你预设结果。`,
    followUps: followUps[spread],
    memorySuggestion: `我正在处理的主题：${topic}`.slice(0, 240),
  };
}

function readPlan(value: unknown, fallback: TarotPlan): TarotPlan {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<TarotPlan>;
  const spreads: Spread[] = ['single', 'three', 'celtic', 'relationship', 'choice', 'career', 'year'];
  const spread = spreads.includes(candidate.spread as Spread) ? candidate.spread as Spread : fallback.spread;
  const followUps = Array.isArray(candidate.followUps)
    ? candidate.followUps.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 2)
    : fallback.followUps;
  return {
    refinedQuestion: typeof candidate.refinedQuestion === 'string' && candidate.refinedQuestion.trim() ? candidate.refinedQuestion.trim().slice(0, 500) : fallback.refinedQuestion,
    spread,
    reason: typeof candidate.reason === 'string' && candidate.reason.trim() ? candidate.reason.trim().slice(0, 320) : fallback.reason,
    followUps: followUps.length ? followUps : fallback.followUps,
    memorySuggestion: typeof candidate.memorySuggestion === 'string' ? candidate.memorySuggestion.trim().slice(0, 240) : fallback.memorySuggestion,
  };
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { concern?: unknown } | null;
  const concern = typeof body?.concern === 'string' ? body.concern.trim().slice(0, 800) : '';
  if (concern.length < 4) return Response.json({ error: '请先用一两句话描述你正在困扰的事情。' }, { status: 400 });
  if (!consumePlanQuota(request)) return Response.json({ error: '今天已经整理过很多次问题了，先从已有方案里选一个继续吧。' }, { status: 429 });

  const fallback = fallbackPlan(concern);
  const apiKey = process.env.MOYU_API_KEY;
  if (!apiKey) return Response.json({ ...fallback, mode: 'local' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);
  try {
    const baseUrl = (process.env.MOYU_BASE_URL || 'https://www.moyu.info/v1').replace(/\/$/, '');
    const model = process.env.MOYU_MODEL || 'deepseek-v4-flash';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 650,
        messages: [
          {
            role: 'system',
            content: `你是星契塔罗的占卜规划助手。把用户的困扰整理成开放、具体、不过度预测的问题，并从以下牌阵中选择一个：single 单牌指引；three 三牌展开；celtic 凯尔特十字；relationship 感情关系；choice 二选一决策；career 事业发展；year 年度十二宫。只返回JSON：{"refinedQuestion":"","spread":"","reason":"","followUps":["",""] ,"memorySuggestion":""}。followUps必须是抽牌后值得追问用户的两个现实问题。memorySuggestion只概括长期背景，不写敏感细节，不得声称已保存。`,
          },
          { role: 'user', content: concern },
        ],
      }),
    });
    if (!response.ok) return Response.json({ ...fallback, mode: 'local' });
    const payload = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null;
    const content = payload?.choices?.[0]?.message?.content || '';
    return Response.json({ ...readPlan(extractJson(content), fallback), mode: content ? 'model' : 'local' });
  } catch {
    return Response.json({ ...fallback, mode: 'local' });
  } finally {
    clearTimeout(timeout);
  }
}
