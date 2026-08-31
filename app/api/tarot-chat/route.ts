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
  memory?: { enabled?: boolean; note?: string; patterns?: string } | null;
  journal?: { date?: string; initial?: string; outcome?: string; reflection?: string } | null;
  comparisons?: Array<{
    date?: string;
    question?: string;
    spread?: string;
    cards?: string[];
    reflection?: string;
  }>;
};

type RequestBody = {
  message?: string;
  style?: 'gentle' | 'analytical' | 'intuitive' | 'direct';
  history?: ChatMessage[];
  context?: TarotContext;
};

type AgentToolId = 'spread' | 'meanings' | 'patterns' | 'links' | 'actions' | 'memory' | 'journal' | 'compare';

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
    context?.memory?.enabled && (context.memory.note || context.memory.patterns) ? `用户主动开启的长期记忆：${context.memory.note?.slice(0, 1200) || '无补充背景'}；历史模式：${context.memory.patterns?.slice(0, 800) || '暂无足够记录'}` : '',
    context?.journal ? `本条塔罗日记：日期 ${context.journal.date || '未知'}；当时想法：${context.journal.initial?.slice(0, 700) || '未记录'}；后续发生：${context.journal.outcome?.slice(0, 700) || '未记录'}；现在回看：${context.journal.reflection?.slice(0, 700) || '未记录'}` : '',
    Array.isArray(context?.comparisons) && context.comparisons.length > 1 ? `对比记录：\n${context.comparisons.slice(0, 3).map((item, index) => `${index + 1}. ${item.date || '未知日期'}｜${item.spread || '未知牌阵'}｜${item.question || '未写问题'}｜${item.cards?.join('、') || '无牌面'}｜回看：${item.reflection || '未记录'}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

function selectAgentTools(message: string, body: RequestBody): AgentToolId[] {
  const tools: AgentToolId[] = ['spread', 'meanings', 'patterns'];
  if ((body.context?.cards?.length || 0) > 1) tools.push('links');
  if (/怎么|应该|建议|行动|避免|接下来|选择|做什么/.test(message)) tools.push('actions');
  if (body.context?.memory?.enabled && (body.context.memory.note || body.context.memory.patterns)) tools.push('memory');
  if (body.context?.journal && Object.values(body.context.journal).some(Boolean)) tools.push('journal');
  if ((body.context?.comparisons?.length || 0) > 1) tools.push('compare');
  if ((body.history?.length || 0) > 0 && !tools.includes('memory')) tools.push('memory');
  return tools;
}

function agentEvidence(context: TarotContext | undefined, tools: AgentToolId[]) {
  const cards = Array.isArray(context?.cards) ? context.cards : [];
  const evidence = [
    tools.includes('spread') ? `[工具·读取牌阵] ${context?.spread?.name || '未知牌阵'}；${cards.map((card) => `${card.position || '牌位'}=${card.name || '未知牌'}${card.orientation ? `·${card.orientation}` : ''}`).join('；')}` : '',
    tools.includes('meanings') ? `[工具·牌义检索] ${cards.map((card) => `${card.name || '未知牌'}：${card.keywords || '暂无关键词'}`).join('；')}` : '',
    tools.includes('patterns') && context?.energy ? `[工具·结构分析] ${context.energy}` : '',
    tools.includes('links') && context?.connections?.length ? `[工具·组合关系] ${context.connections.slice(0, 5).join('；')}` : '',
    tools.includes('actions') && context?.actions ? `[工具·行动建议] 适合：${context.actions.doNow || '暂无'}；避免：${context.actions.avoid || '暂无'}；观察：${context.actions.watch || '暂无'}` : '',
    tools.includes('memory') ? `[工具·长期记忆] ${context?.memory?.enabled ? `${context.memory.note || '无用户补充背景'}；${context.memory.patterns || '暂无历史模式'}` : '已读取本次牌阵最近的对话内容。'}` : '',
    tools.includes('journal') && context?.journal ? `[工具·日记复盘] 当时想法：${context.journal.initial || '未记录'}；后续发生：${context.journal.outcome || '未记录'}；现在回看：${context.journal.reflection || '未记录'}` : '',
    tools.includes('compare') && context?.comparisons?.length ? `[工具·牌阵对比] ${context.comparisons.slice(0, 3).map((item) => `${item.date || '未知日期'}的${item.spread || '牌阵'}：${item.cards?.join('、') || '无牌面'}`).join('；')}` : '',
  ].filter(Boolean);
  return evidence.join('\n');
}

function trimText(value: string | undefined, maxLength: number) {
  const text = value?.trim() || '';
  return text.length > maxLength ? `${text.slice(0, maxLength).replace(/[，；、\s]+$/,'')}……` : text;
}

function localAgentText(message: string, context: TarotContext | undefined) {
  const cards = Array.isArray(context?.cards) ? context.cards : [];
  const reversed = cards.filter((card) => card.orientation === '逆位');
  const lead = trimText(context?.verdict, 150)
    || (cards.length ? `这组牌的重点落在${cards.slice(0, 2).map((card) => `${card.name || '这张牌'}${card.orientation ? `·${card.orientation}` : ''}`).join('与')}之间。` : '先把问题放回你当下最能影响的部分。');
  const wantsLinks = /联系|关系|矛盾|组合|互相|主线/.test(message);
  const wantsAction = /怎么|应该|建议|行动|避免|接下来|选择|做什么/.test(message);
  const wantsReversed = /逆位|阻碍|卡住|困难/.test(message);
  const wantsJournal = /日记|复盘|后来|回看|发生/.test(message);
  const wantsCompare = /对比|比较|变化|重复|几次|多次/.test(message);

  if (wantsCompare && (context?.comparisons?.length || 0) > 1) {
    const records = context?.comparisons || [];
    return `${lead}\n\n这 ${records.length} 次记录分别出现了：${records.map((item) => `${item.date || '某次'}的${item.cards?.join('、') || '未记录牌面'}`).join('；')}。先看重复牌、正逆位变化和结果牌方向，再把它们与真实发生的事情核对；重复出现不等于命运注定，更可能表示同一课题还在被处理。`;
  }
  if (wantsJournal && context?.journal) {
    return `${lead}\n\n你当时写下的是“${trimText(context.journal.initial, 110) || '还没有记录第一感受'}”，后来发生的是“${trimText(context.journal.outcome, 120) || '还没有补写后续'}”。把牌面和事实分开看：已经发生的部分可以验证理解，没发生的部分不必硬套进牌义。`;
  }

  if (wantsLinks && context?.connections?.length) {
    return `${lead}\n\n${trimText(context.connections.slice(0, 2).join('；'), 260)}\n\n先不要把每张牌拆开看，真正值得观察的是它们共同指向的变化。`;
  }
  if (wantsAction && context?.actions) {
    return `${lead}\n\n现在适合：${trimText(context.actions.doNow, 120)}\n暂时避免：${trimText(context.actions.avoid, 110)}\n接下来观察：${trimText(context.actions.watch, 110)}`;
  }
  if (wantsReversed && reversed.length) {
    const card = reversed[0];
    return `${lead}\n\n${card.name || '这张逆位牌'}更像在提醒你留意“${trimText(card.keywords, 100) || '能量受阻'}”，而不是宣布一个坏结果。先找出哪里在勉强、拖延或过度消耗，再决定下一步。`;
  }
  return `${lead}${context?.synthesis ? `\n\n${trimText(context.synthesis, 280)}` : ''}${context?.actions?.watch ? `\n\n接下来可以观察：${trimText(context.actions.watch, 110)}` : ''}`;
}

function agentHeaders(tools: AgentToolId[], mode: 'model' | 'local', remaining: number) {
  return {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-RateLimit-Remaining': String(remaining),
    'X-Agent-Mode': mode,
    'X-Agent-Tools': tools.join(','),
  };
}

function localAgentResponse(message: string, context: TarotContext | undefined, tools: AgentToolId[], remaining: number) {
  return new Response(localAgentText(message, context), {
    status: 200,
    headers: agentHeaders(tools, 'local', remaining),
  });
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

export async function POST(request: Request) {
  const apiKey = process.env.MOYU_API_KEY;
  const baseUrl = (process.env.MOYU_BASE_URL || 'https://www.moyu.info/v1').replace(/\/$/, '');
  const model = process.env.MOYU_MODEL || 'deepseek-v4-flash';

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

  const tools = selectAgentTools(message, body);
  if (!apiKey) return localAgentResponse(message, body.context, tools, quota.remaining);

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
    '你不是在自由联想，而是在使用星契智能体已经执行完的工具结果。优先引用与用户追问最相关的工具证据，不要声称调用了未列出的工具。',
    agentEvidence(body.context, tools),
    contextText(body.context),
  ].join('\n\n');

  const history = cleanMessages(body.history);
  const input = [...history, { role: 'user' as const, content: message }];

  let upstream: Response;
  const connectController = new AbortController();
  const connectTimeout = setTimeout(() => connectController.abort(), 18000);
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
      signal: connectController.signal,
    });
  } catch {
    return localAgentResponse(message, body.context, tools, quota.remaining);
  } finally {
    // The timeout only guards establishing the upstream response. Keeping it
    // active would abort a healthy SSE stream midway through a longer reply.
    clearTimeout(connectTimeout);
  }

  if (!upstream.ok) {
    const upstreamDetail = (await upstream.text().catch(() => '')).slice(0, 500);
    console.error('[tarot-chat] Moyu request failed', {
      status: upstream.status,
      model,
      detail: upstreamDetail,
    });
    return localAgentResponse(message, body.context, tools, quota.remaining);
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.body || contentType.includes('application/json')) {
    const payload = await upstream.json().catch(() => null);
    const completed = extractCompletedText(payload);
    if (!completed) return localAgentResponse(message, body.context, tools, quota.remaining);
    return new Response(completed, {
      headers: agentHeaders(tools, 'model', quota.remaining),
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
        controller.enqueue(encoder.encode(`\n\n连接短暂中断，我先用本地牌义把重点补完整：\n${localAgentText(message, body.context)}`));
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: agentHeaders(tools, 'model', quota.remaining),
  });
}
