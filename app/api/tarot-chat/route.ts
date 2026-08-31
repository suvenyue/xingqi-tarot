type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type TarotContext = {
  question?: string;
  spread?: { name?: string; positions?: string[] };
  cards?: Array<{
    name?: string;
    orientation?: string;
    position?: string;
    keywords?: string;
    focus?: string;
  }>;
  synthesis?: string;
  verdict?: string;
  connections?: string[];
  actions?: { doNow?: string; avoid?: string; watch?: string } | null;
  energy?: string;
};

type RequestBody = {
  message?: string;
  style?: 'gentle' | 'analytical' | 'intuitive' | 'direct';
  history?: ChatMessage[];
  context?: TarotContext;
};

const STYLE_PROMPTS = {
  gentle: '像一个温柔、熟悉用户的朋友：先回应感受，再给一两个真正有用的提醒。',
  analytical: '像一个头脑清楚的朋友：把关键牌面讲明白，说明推论，不说空泛套话。',
  intuitive: '像一个直觉敏锐的朋友：可以有一点诗意和联想，但说话自然，并落回现实。',
  direct: '像一个愿意说真话的朋友：直接指出矛盾和盲点，语气坦率但不刻薄。',
} as const;

const WINDOW_MS = 24 * 60 * 60 * 1000;
const SERVER_LIMIT = 12;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'anonymous'
  );
}

function consumeServerQuota(request: Request) {
  const now = Date.now();
  const key = clientKey(request);
  const current = rateBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current;

  if (bucket.count >= SERVER_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return { allowed: true, remaining: SERVER_LIMIT - bucket.count, resetAt: bucket.resetAt };
}

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as ChatMessage;
      return (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string';
    })
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content.slice(0, 3000) }));
}

function contextText(context: TarotContext | undefined) {
  const cards = Array.isArray(context?.cards) ? context.cards.slice(0, 13) : [];
  const lines = cards.map((card, index) =>
    `${index + 1}. ${card.position || '牌位'}：${card.name || '未知牌'}（${card.orientation || '未知方向'}）` +
    `；关键词：${card.keywords || '无'}；位置关注：${card.focus || '无'}`,
  );

  return [
    `用户问题：${context?.question?.slice(0, 800) || '未填写，请围绕牌阵本身进行开放式解读'}`,
    `牌阵：${context?.spread?.name || '未知牌阵'}`,
    `当前牌面：\n${lines.join('\n') || '暂无牌面'}`,
    context?.verdict ? `直接结论：${context.verdict.slice(0, 1200)}` : '',
    context?.synthesis ? `现有综合解读：${context.synthesis.slice(0, 1800)}` : '',
    Array.isArray(context?.connections) && context.connections.length ? `关键牌组联系：\n${context.connections.slice(0, 7).map((item) => item.slice(0, 900)).join('\n')}` : '',
    context?.actions ? `行动建议：适合做——${context.actions.doNow?.slice(0, 700) || '无'}；暂时避免——${context.actions.avoid?.slice(0, 700) || '无'}；接下来观察——${context.actions.watch?.slice(0, 700) || '无'}` : '',
    context?.energy ? `能量结构：${context.energy.slice(0, 900)}` : '',
  ].filter(Boolean).join('\n\n');
}

function extractText(event: unknown) {
  if (!event || typeof event !== 'object') return '';
  const value = event as Record<string, unknown>;
  if (value.type === 'response.output_text.delta' && typeof value.delta === 'string') return value.delta;
  const choices = value.choices;
  if (Array.isArray(choices)) {
    const first = choices[0] as { delta?: { content?: string }; message?: { content?: string } } | undefined;
    return first?.delta?.content || first?.message?.content || '';
  }
  return '';
}

function extractCompletedText(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const response = value as Record<string, unknown>;
  if (typeof response.output_text === 'string') return response.output_text;
  if (Array.isArray(response.choices)) {
    const first = response.choices[0] as { message?: { content?: string } } | undefined;
    if (typeof first?.message?.content === 'string') return first.message.content;
  }
  if (!Array.isArray(response.output)) return '';
  return response.output.flatMap((item) => {
    const content = (item as { content?: unknown[] })?.content;
    if (!Array.isArray(content)) return [];
    return content.map((part) => {
      const typed = part as { type?: string; text?: string };
      return typed.type === 'output_text' && typeof typed.text === 'string' ? typed.text : '';
    });
  }).join('');
}

function upstreamErrorMessage(status: number) {
  if (status === 429) return 'AI 服务当前繁忙或额度受限，请稍后再试。';
  if (status === 401 || status === 403) return 'AI 服务认证暂时不可用，请联系站点维护者。';
  if (status === 400 || status === 404) return 'AI 模型配置暂时不可用，请联系站点维护者。';
  return 'AI 服务暂时无法完成解读，请稍后再试。';
}

export async function POST(request: Request) {
  const apiKey = process.env.MOYU_API_KEY;
  const baseUrl = (process.env.MOYU_BASE_URL || 'https://www.moyu.info/v1').replace(/\/$/, '');
  const model = process.env.MOYU_MODEL || 'deepseek-v4-flash';

  if (!apiKey) {
    return Response.json({ error: 'AI 服务尚未完成服务器配置。' }, { status: 503 });
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return Response.json({ error: '请求格式无效。' }, { status: 400 });
  }

  const message = body.message?.trim().slice(0, 2000) || '';
  if (!message) return Response.json({ error: '请先输入你想继续询问的内容。' }, { status: 400 });
  if (!body.context?.cards?.length) return Response.json({ error: '请先完成一次抽牌，再开始牌阵对话。' }, { status: 400 });

  const quota = consumeServerQuota(request);
  if (!quota.allowed) {
    return Response.json(
      { error: '今天的 AI 对话次数已用完，请明天再来。', resetAt: quota.resetAt },
      { status: 429 },
    );
  }

  const style = body.style && body.style in STYLE_PROMPTS ? body.style : 'gentle';
  const instructions = [
    '你是“星契 Tarot”的塔罗对话伙伴，熟悉韦特体系。请始终使用简体中文。',
    STYLE_PROMPTS[style],
    '必须严格围绕提供的牌阵、牌位、正逆位和用户问题回答；若信息不足，请明确说明这是可能性而非事实。',
    '不要宣称能确定预测未来，不要制造宿命、恐惧或依赖。提供具体、可执行、尊重用户自主权的建议。',
    '涉及医疗、法律、投资、危机或人身安全时，只能提供一般性反思，并建议寻求合格专业人士或现实支持。',
    '说话要像真人聊天：先直接回答，不复述用户问题，不写“综合来看”“从牌面来看”等机械开场，不堆叠形容词，也不要每次都用相同结构。',
    '默认控制在180至320个汉字、两到四个短段落。除非用户明确要求详细分析，否则不要写标题、编号清单或完整报告；只挑最相关的两三张牌来说明。',
    '结尾可以自然地问一个贴近处境的小问题，但不要固定使用“你可以思考”之类的模板句。',
    contextText(body.context),
  ].join('\n\n');

  const history = cleanMessages(body.history);
  const input = [...history, { role: 'user' as const, content: message }];

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: instructions }, ...input],
        max_tokens: 520,
        stream: true,
      }),
    });
  } catch {
    return Response.json({ error: '暂时无法连接 AI 服务，请稍后再试。' }, { status: 502 });
  }

  if (!upstream.ok) {
    const upstreamDetail = (await upstream.text().catch(() => '')).slice(0, 500);
    console.error('[tarot-chat] Moyu request failed', {
      status: upstream.status,
      model,
      detail: upstreamDetail,
    });
    return Response.json(
      { error: upstreamErrorMessage(upstream.status) },
      { status: upstream.status === 429 ? 429 : 502 },
    );
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.body || contentType.includes('application/json')) {
    const payload = await upstream.json().catch(() => null);
    const completed = extractCompletedText(payload);
    if (!completed) return Response.json({ error: 'AI 服务未返回可读取的内容。' }, { status: 502 });
    return new Response(completed, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-RateLimit-Remaining': String(quota.remaining),
      },
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              const line = buffer.trim();
              const raw = line.startsWith('data:') ? line.slice(5).trim() : line;
              if (raw && raw !== '[DONE]') {
                const delta = extractText(JSON.parse(raw));
                if (delta) controller.enqueue(encoder.encode(delta));
              }
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          let emitted = false;
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
              const delta = extractText(JSON.parse(raw));
              if (delta) {
                controller.enqueue(encoder.encode(delta));
                emitted = true;
              }
            } catch {
              // Ignore malformed heartbeat lines from an upstream SSE connection.
            }
          }
          if (emitted) return;
        }
      } catch {
        controller.error(new Error('AI 流式响应中断'));
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-RateLimit-Remaining': String(quota.remaining),
    },
  });
}
