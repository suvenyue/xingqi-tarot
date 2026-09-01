type ChatRole = 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type TarotContext = {
  question?: string;
  spread?: { name?: string; positions?: string[] };
  cards?: Array<{
    id?: number;
    name?: string;
    englishName?: string;
    arcana?: string;
    suit?: string;
    rank?: string;
    element?: string;
    orientation?: string;
    position?: string;
    keywords?: string;
    meaning?: string;
    focus?: string;
    symbolism?: string;
    domains?: { love?: string; career?: string; money?: string; health?: string };
    origin?: string;
  }>;
  synthesis?: string;
  verdict?: string;
  connections?: string[];
  combinations?: Array<{ title?: string; cards?: string[]; evidence?: string; meaning?: string }>;
  actions?: { doNow?: string; avoid?: string; watch?: string } | null;
  energy?: string;
  memory?: { enabled?: boolean; note?: string; patterns?: string } | null;
  journal?: { date?: string; initial?: string; outcome?: string; review7?: string; review30?: string; accurate?: string; missed?: string; reflection?: string; correction?: string } | null;
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
  length?: 'brief' | 'standard' | 'deep';
  history?: ChatMessage[];
  context?: TarotContext;
};

type AgentToolId = 'spread' | 'meanings' | 'patterns' | 'links' | 'combinations' | 'actions' | 'memory' | 'journal' | 'compare';

const STYLE_PROMPTS = {
  gentle: '像一个真正关心用户、但不会过度安慰的朋友。先接住最具体的感受，再说一两个有用的观察。',
  analytical: '像一个头脑清楚、表达利落的朋友。把推论讲明白，但不要写成报告或分析模板。',
  intuitive: '像一个直觉敏锐、说话有温度的朋友。允许一点联想，但不要故作神秘，最后要落回现实。',
  direct: '像一个愿意说真话的朋友。直接指出矛盾和盲点，可以坦率，但不要审判、训话或吓人。',
} as const;

const LENGTH_PROMPTS = {
  brief: { instruction: '用120至220个汉字完成回答。篇幅短，但必须包含直接答案、最关键的一条牌面依据和一句完整收尾；宁可少讲一个点，也不准在句子或推论中途结束。最多两个短段落。', maxTokens: 700 },
  standard: { instruction: '用300至600个汉字完成回答。必须讲清核心判断、主要牌位联系和一个现实建议，并让最后一个推论自然收束；不要为了卡字数截断句子。', maxTokens: 1400 },
  deep: { instruction: '进行完整深度解读，通常700至1200个汉字。覆盖各牌位、关键组合、元素与正逆位结构、主线转折和行动建议；可以使用短标题，但不要堆砌套话。', maxTokens: 2400 },
} as const;

const WINDOW_MS = 24 * 60 * 60 * 1000;
const SERVER_LIMIT = 50;
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

function cleanMessages(value: unknown, limit = 8, maxLength = 3000): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as ChatMessage;
      return (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string';
    })
    .slice(-limit)
    .map((item) => ({ role: item.role, content: item.content.slice(0, maxLength) }));
}

function isNaturalFollowUp(message: string) {
  if (message.length > 140) return false;
  const asksForReading = /解牌|解读|分析|重新解释|牌阵|牌位|正位|逆位|组合|趋势|未来|结果|走向|建议|怎么办|应该|如何|为什么|哪张|澄清牌|复盘|对比|比较|会不会|能不能/.test(message);
  return !asksForReading;
}

function compactContextText(context: TarotContext | undefined) {
  const cards = Array.isArray(context?.cards) ? context.cards.slice(0,13) : [];
  return [
    `原始问题：${trimText(context?.question,260) || '未填写'}`,
    `牌阵背景：${context?.spread?.name || '未知牌阵'}；${cards.map((card) => `${card.position || '牌位'}=${card.name || '未知牌'}·${card.orientation || '方向未知'}（${trimText(card.keywords,36) || '无关键词'}）`).join('；')}`,
    context?.verdict ? `先前核心判断：${trimText(context.verdict,320)}` : '',
    '以上只作为已经发生过的对话背景。当前优先回应用户刚说的话，不要主动重讲整副牌。',
  ].filter(Boolean).join('\n');
}

function contextText(context: TarotContext | undefined) {
  const cards = Array.isArray(context?.cards) ? context.cards.slice(0, 13) : [];
  const originalCards = cards.filter((card) => !card.position?.startsWith('澄清牌'));
  const clarifierCards = cards.filter((card) => card.position?.startsWith('澄清牌'));
  const lines = originalCards.map((card, index) =>
    `${index + 1}. ${card.position || '牌位'}：${card.name || '未知牌'}（${card.orientation || '未知方向'}）` +
    `；体系：${card.arcana || '未知'}${card.suit ? `／${card.suit}` : ''}${card.element ? `／${card.element}` : ''}` +
    `；关键词：${card.keywords || '无'}；标准牌义：${card.meaning || '无'}；位置关注：${card.focus || '无'}` +
    `；图像象征：${card.symbolism || '无'}`,
  );
  const clarifierLines = clarifierCards.map((card, index) =>
    `${index + 1}. ${card.position || '澄清牌'}：${card.name || '未知牌'}（${card.orientation || '未知方向'}）` +
    `；直接牌义：${card.meaning || card.keywords || '无'}；限制：${card.focus || '只能补充原牌阵'}`,
  );

  return [
    `用户问题：${context?.question?.slice(0, 800) || '未填写，请围绕牌阵本身进行开放式解读'}`,
    `牌阵：${context?.spread?.name || '未知牌阵'}`,
    `原牌阵牌面：\n${lines.join('\n') || '暂无牌面'}`,
    clarifierLines.length ? `已经抽出的澄清牌（只解释，不得再次抽牌）：\n${clarifierLines.join('\n')}` : '',
    context?.verdict ? `直接结论：${context.verdict.slice(0, 1200)}` : '',
    context?.synthesis ? `现有综合解读：${context.synthesis.slice(0, 1800)}` : '',
    Array.isArray(context?.connections) && context.connections.length ? `关键牌组联系：\n${context.connections.slice(0, 7).map((item) => item.slice(0, 900)).join('\n')}` : '',
    Array.isArray(context?.combinations) && context.combinations.length ? `组合牌义知识库：\n${context.combinations.slice(0, 7).map((item) => `${item.title || '组合'}｜${item.evidence || ''}｜${item.meaning || ''}`).join('\n')}` : '',
    context?.actions ? `行动建议：适合做——${context.actions.doNow?.slice(0, 700) || '无'}；暂时避免——${context.actions.avoid?.slice(0, 700) || '无'}；接下来观察——${context.actions.watch?.slice(0, 700) || '无'}` : '',
    context?.energy ? `能量结构：${context.energy.slice(0, 900)}` : '',
    context?.memory?.enabled && (context.memory.note || context.memory.patterns) ? `用户主动开启的长期记忆：${context.memory.note?.slice(0, 1200) || '无补充背景'}；历史模式：${context.memory.patterns?.slice(0, 800) || '暂无足够记录'}` : '',
    context?.journal ? `本条塔罗日记：日期 ${context.journal.date || '未知'}；当时想法：${context.journal.initial?.slice(0, 700) || '未记录'}；7天回看：${context.journal.review7?.slice(0, 700) || '未记录'}；30天回看：${context.journal.review30?.slice(0, 700) || '未记录'}；实际发生：${context.journal.outcome?.slice(0, 900) || '未记录'}；认为准确：${context.journal.accurate?.slice(0, 700) || '未记录'}；没有发生：${context.journal.missed?.slice(0, 700) || '未记录'}；现在回看：${context.journal.reflection?.slice(0, 700) || '未记录'}；上次事实校准：${context.journal.correction?.slice(0, 900) || '暂无'}` : '',
    Array.isArray(context?.comparisons) && context.comparisons.length > 1 ? `对比记录：\n${context.comparisons.slice(0, 3).map((item, index) => `${index + 1}. ${item.date || '未知日期'}｜${item.spread || '未知牌阵'}｜${item.question || '未写问题'}｜${item.cards?.join('、') || '无牌面'}｜回看：${item.reflection || '未记录'}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

function selectAgentTools(message: string, body: RequestBody): AgentToolId[] {
  if (isNaturalFollowUp(message)) {
    const tools: AgentToolId[] = ['spread'];
    if ((body.history?.length || 0) > 0) tools.push('memory');
    return tools;
  }
  const tools: AgentToolId[] = ['spread', 'meanings', 'patterns'];
  if ((body.context?.cards?.length || 0) > 1) tools.push('links');
  if ((body.context?.combinations?.length || 0) > 0) tools.push('combinations');
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
    tools.includes('meanings') ? `[工具·78张牌库检索] ${cards.map((card) => `${card.name || '未知牌'}${card.orientation ? `·${card.orientation}` : ''}：${card.meaning || card.keywords || '暂无牌义'}；象征：${card.symbolism || '暂无'}`).join('；')}` : '',
    tools.includes('meanings') ? `[工具·领域牌义] ${cards.map((card) => `${card.name || '未知牌'}：爱情=${card.domains?.love || '无'}；事业=${card.domains?.career || '无'}；财运=${card.domains?.money || '无'}；健康=${card.domains?.health || '无'}`).join('；')}` : '',
    tools.includes('meanings') ? `[工具·历史与韦特图像] ${cards.map((card) => `${card.name || '未知牌'}：${card.origin || '暂无来源说明'}`).join('；')}` : '',
    tools.includes('patterns') && context?.energy ? `[工具·结构分析] ${context.energy}` : '',
    tools.includes('links') && context?.connections?.length ? `[工具·组合关系] ${context.connections.slice(0, 5).join('；')}` : '',
    tools.includes('combinations') && context?.combinations?.length ? `[工具·组合牌义知识库] ${context.combinations.slice(0, 6).map((item) => `${item.title || '组合'}：${item.evidence || ''}${item.meaning || ''}`).join('；')}` : '',
    tools.includes('actions') && context?.actions ? `[工具·行动建议] 适合：${context.actions.doNow || '暂无'}；避免：${context.actions.avoid || '暂无'}；观察：${context.actions.watch || '暂无'}` : '',
    tools.includes('memory') ? `[工具·长期记忆] ${context?.memory?.enabled ? `${context.memory.note || '无用户补充背景'}；${context.memory.patterns || '暂无历史模式'}` : '已读取本次牌阵最近的对话内容。'}` : '',
    tools.includes('journal') && context?.journal ? `[工具·日记复盘] 7天回看：${context.journal.review7 || '未记录'}；30天回看：${context.journal.review30 || '未记录'}；实际发生：${context.journal.outcome || '未记录'}；准确部分：${context.journal.accurate || '未记录'}；没有发生：${context.journal.missed || '未记录'}；现在回看：${context.journal.reflection || '未记录'}` : '',
    tools.includes('compare') && context?.comparisons?.length ? `[工具·牌阵对比] ${context.comparisons.slice(0, 3).map((item) => `${item.date || '未知日期'}的${item.spread || '牌阵'}：${item.cards?.join('、') || '无牌面'}`).join('；')}` : '',
  ].filter(Boolean);
  return evidence.join('\n');
}

function trimText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.length > maxLength ? `${text.slice(0, maxLength).replace(/[，；、\s]+$/,'')}……` : text;
}

function fitCompleteText(value: string, maxLength: number) {
  const text = value.trim();
  if (!text) return '';
  if (text.length <= maxLength) return /[。！？!?…」』”’）)]$/.test(text) ? text : `${text}。`;
  const window = text.slice(0, maxLength);
  const endings = [...window.matchAll(/[。！？!?]/g)];
  const lastEnding = endings.at(-1)?.index ?? -1;
  if (lastEnding >= Math.floor(maxLength * .52)) return window.slice(0, lastEnding + 1);
  return `${window.replace(/[，；、：\s]+$/,'')}。`;
}

function localConversationText(message: string, context: TarotContext | undefined) {
  const hasRelationshipContext = /感情|关系|恋爱/.test(context?.spread?.name || '') || /关系|对方|TA|他|她|男友|女友/.test(context?.question || '');
  if (hasRelationshipContext && /想.*(在一起|继续|挽回|坚持)|不想.*(分开|失去)|舍不得|放不下|还爱/.test(message)) {
    return '我知道。你现在不是不知道这段关系有问题，而是即使知道，还是舍不得放手。想继续在一起没有错，但别让“我很想”替代了“他有没有一起努力”。你可以先不逼自己马上离开，只观察一个最现实的信号：他会不会主动沟通、承担关系，而不是一直由你一个人维持。';
  }
  if (/难过|伤心|想哭|崩溃|很累|累了|痛苦|受不了/.test(message)) {
    return '先别急着分析牌。你现在是真的难受，这件事本身就值得被认真对待。今天可以先把决定放一放，照顾好自己；等情绪稍微落下来，我们再一起分清楚，究竟是这段关系让你累，还是失去它的想象让你害怕。';
  }
  if (/害怕|担心|焦虑|不安|慌|怕/.test(message)) {
    return '我听见你的担心了。现在不用马上把它变成一个结论，也不需要靠不断抽牌来压住不安。你可以先告诉我，你最害怕发生的具体事情是什么；把那个画面说清楚后，我们再看牌阵里有没有真正支持它的证据。';
  }
  if (/不知道|说不清|很乱|迷茫|纠结/.test(message)) {
    return '没关系，不必现在就把一切说清楚。你可以只说最卡住的那一小部分：是舍不得、看不到对方的态度，还是不知道自己该不该继续？我们先聊一个点，不重新把整副牌讲一遍。';
  }
  return `我有在听。你刚才说的是你的真实感受，不需要立刻被整理成一份牌阵报告。${hasRelationshipContext ? '先说说此刻最让你放不下的是什么，我会顺着你的话聊；只有需要时，才拿一两张相关牌来核对。' : '你可以继续把最在意的那一部分说出来，我们先把这件事聊明白，再决定要不要回到牌面。'}`;
}

function localAgentBase(message: string, context: TarotContext | undefined) {
  if (isNaturalFollowUp(message)) return localConversationText(message,context);
  const cards = Array.isArray(context?.cards) ? context.cards : [];
  const originalCards = cards.filter((card) => !card.position?.startsWith('澄清牌'));
  const clarifierCards = cards.filter((card) => card.position?.startsWith('澄清牌'));
  const reversed = cards.filter((card) => card.orientation === '逆位');
  const lead = trimText(context?.verdict, 150)
    || (cards.length ? `这组牌的重点落在${cards.slice(0, 2).map((card) => `${card.name || '这张牌'}${card.orientation ? `·${card.orientation}` : ''}`).join('与')}之间。` : '先把问题放回你当下最能影响的部分。');
  const wantsLinks = /联系|关系|矛盾|组合|互相|主线/.test(message);
  const wantsAction = /怎么|应该|建议|行动|避免|接下来|选择|做什么/.test(message);
  const wantsReversed = /逆位|阻碍|卡住|困难/.test(message);
  const wantsJournal = /日记|复盘|后来|回看|发生/.test(message);
  const wantsCompare = /对比|比较|变化|重复|几次|多次/.test(message);
  const wantsClarifier = /澄清牌/.test(message) && /解释|解读|分析|修正|没有改变|只解释/.test(message);

  if (wantsClarifier && clarifierCards.length) {
    const explanations = clarifierCards.map((card) => {
      const purpose = card.position?.split('·').slice(1).join('·') || card.focus || '原牌阵中尚未说清的部分';
      return `澄清对象：${purpose}\n直接补充：${card.name || '这张牌'}·${card.orientation || '方向未知'}指向“${trimText(card.meaning || card.keywords, 180) || '需要回到现实信息核对'}”。\n修正之处：它把这个问题从宽泛趋势收窄到上述具体表现，但没有足够依据推翻整副牌。`;
    }).join('\n\n');
    const unchanged = trimText(context?.verdict, 220) || (originalCards.length ? `原牌阵仍要以${originalCards.slice(0,2).map((card) => card.name || '原牌').join('与')}形成的主线为准。` : '原牌阵的核心走向仍然保留。');
    return `${explanations}\n\n没有改变：${unchanged}\n\n这次只解释已经抽出的澄清牌，不需要再补抽。`;
  }

  if (wantsCompare && (context?.comparisons?.length || 0) > 1) {
    const records = context?.comparisons || [];
    return `${lead}\n\n这 ${records.length} 次记录分别出现了：${records.map((item) => `${item.date || '某次'}的${item.cards?.join('、') || '未记录牌面'}`).join('；')}。先看重复牌、正逆位变化和结果牌方向，再把它们与真实发生的事情核对；重复出现不等于命运注定，更可能表示同一课题还在被处理。`;
  }
  if (wantsJournal && context?.journal) {
    const verified = trimText(context.journal.accurate, 160) || '目前没有足够事实确认某一部分准确';
    const missed = trimText(context.journal.missed, 160) || '尚未记录明确没有发生的部分';
    const outcome = trimText(context.journal.outcome || context.journal.review30 || context.journal.review7, 200) || '还没有补写可确认的后续事实';
    return `现实验证：${outcome}\n\n得到验证：${verified}\n没有发生：${missed}\n\n需要修正：旧解读只能保留与上述事实直接对应的部分；其余判断应降级为当时的可能性，不能事后硬套。现在更贴近事实的理解是，先依据已经发生的行为调整判断，再把牌义当作复盘线索，而不是结果证明。`;
  }

  if (wantsLinks && context?.combinations?.length) {
    const insight = context.combinations[0];
    return `${lead}\n\n${insight.title || '这组牌的关键联系'}：${trimText(`${insight.evidence || ''}${insight.meaning || ''}`, 280)}\n\n这是一条组合依据，不是单张关键词的简单相加；还要放回各自牌位和你的现实处境里核对。`;
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

function localAgentText(message: string, context: TarotContext | undefined, length: keyof typeof LENGTH_PROMPTS = 'standard') {
  const base = localAgentBase(message, context);
  if (isNaturalFollowUp(message)) return fitCompleteText(base,260);
  if (length === 'brief') return fitCompleteText(base, 220);
  if (length === 'standard') {
    const action = context?.actions?.doNow ? `\n\n更实际一点，现在可以先做：${trimText(context.actions.doNow, 130)}` : '';
    return fitCompleteText(`${base}${base.length < 320 ? action : ''}`, 620);
  }
  const cards = Array.isArray(context?.cards) ? context.cards : [];
  const cardSection = cards.map((card, index) => `${index + 1}. ${card.position || '牌位'}的${card.name || '未知牌'}·${card.orientation || '方向未知'}：${trimText(card.meaning || card.keywords, 150)}`).join('\n');
  const comboSection = (context?.combinations || []).slice(0,5).map((item) => `- ${item.title || '组合'}：${trimText(`${item.evidence || ''}${item.meaning || ''}`, 220)}`).join('\n');
  return [
    `先说重点：${trimText(context?.verdict, 220) || trimText(base, 220)}`,
    cardSection ? `逐张放回牌位看\n${cardSection}` : '',
    comboSection ? `牌与牌之间\n${comboSection}` : '',
    context?.energy ? `整体结构\n${trimText(context.energy, 260)}` : '',
    context?.actions ? `落到现实里\n现在适合：${trimText(context.actions.doNow, 180)}\n暂时避免：${trimText(context.actions.avoid, 180)}\n继续观察：${trimText(context.actions.watch, 180)}` : '',
  ].filter(Boolean).join('\n\n');
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

function localAgentResponse(message: string, context: TarotContext | undefined, tools: AgentToolId[], remaining: number, length: keyof typeof LENGTH_PROMPTS) {
  return new Response(localAgentText(message, context, length), {
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

function extractFinishReason(value: unknown) {
  if (!value || typeof value !== 'object') return '';
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return '';
  const reason = (choices[0] as { finish_reason?: unknown } | undefined)?.finish_reason;
  return typeof reason === 'string' ? reason : '';
}

function replyLooksComplete(value: string) {
  const text = value.trim();
  if (!text) return false;
  return /[。！？!?…」』”’）)]$/.test(text);
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
  const length = body.length && body.length in LENGTH_PROMPTS ? body.length : 'standard';
  const lengthConfig = LENGTH_PROMPTS[length];
  const naturalFollowUp = isNaturalFollowUp(message);
  const responseConfig = naturalFollowUp
    ? { instruction: '这是自然对话追问。先接住用户此刻的话，用80至220个汉字、两三个自然短段落回应。除非确实有帮助，最多引用一张牌；禁止重述整副牌、原问题、牌阵结构或完整结论。', maxTokens: 520 }
    : lengthConfig;
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
  if (!apiKey) return localAgentResponse(message, body.context, tools, quota.remaining, length);

  const style = body.style && body.style in STYLE_PROMPTS ? body.style : 'gentle';
  const instructions = [
    '你是“星契 Tarot”的塔罗对话伙伴，熟悉韦特体系。请始终使用简体中文。',
    '不要宣称能确定预测未来，不要制造宿命、恐惧或依赖。提供具体、可执行、尊重用户自主权的建议。',
    '涉及医疗、法律、投资、危机或人身安全时，只能提供一般性反思，并建议寻求合格专业人士或现实支持。',
    naturalFollowUp ? compactContextText(body.context) : `${agentEvidence(body.context, tools)}\n\n${contextText(body.context)}`,
    STYLE_PROMPTS[style],
    '必须严格围绕提供的牌阵、牌位、正逆位和用户问题回答；若信息不足，请明确说明这是可能性而非事实。',
    naturalFollowUp ? '当前是连续对话，不是新一轮解牌。把上一轮牌阵当作背景，不要抢着分析。先回应用户表达的情绪、愿望或犹豫；可以像朋友一样说“我知道”“我听见了”，但不要假装拥有人的经历。' : '',
    '说话必须像真人聊天：第一句就回答用户真正问的事，不复述问题，不写“综合来看”“从牌面来看”“这张牌告诉我们”等机械开场。',
    naturalFollowUp ? '' : '若用户要求重新解释某一张牌，或只分析感情、事业等某个范围，就只回答指定部分；仍要说明牌位，并用相邻牌或组合牌义做必要修正，不要把整份解读重说一遍。',
    naturalFollowUp ? '' : '只要问题涉及已经抽出的“澄清牌”，就禁止建议或执行继续抽牌。必须依次明确写出：①澄清对象；②直接补充；③修正或收窄了原牌阵哪一部分；④原牌阵中没有改变的核心判断。证据不足时直说“没有足够依据改变原结论”。澄清牌不得覆盖原牌阵。',
    '少用抽象名词和成串形容词。多用短句、具体动词和日常表达；能说“你其实已经很累了”，就不要说“你正处于能量失衡的状态”。',
    '不要把每段都写成“结论＋解释＋建议”的固定模板，不要连续使用“你可能”“这意味着”“提醒你”。允许自然停顿，也允许只把一个重点讲透。',
    '结尾不必强行提问，也不要固定使用“你可以思考”“希望这能帮助你”之类的客服式句子。确实需要用户补充信息时，再自然地问一句。',
    naturalFollowUp ? '' : '你不是在自由联想，而是在使用星契智能体已经执行完的工具结果。优先引用与用户追问最相关的工具证据，不要声称调用了未列出的工具。',
    naturalFollowUp ? '' : '“78张牌库检索”提供的是每张牌的标准正逆位牌义、图像象征、领域牌义与历史来源；回答时应先匹配牌阵位置，再用相邻牌和整体结构修正，禁止只抄关键词。',
    naturalFollowUp ? '' : '“组合牌义知识库”提供经典双牌、同花色、重复数字、宫廷牌和起点到结果的结构证据。它用于修正单张牌义；引用时要说清是哪两张牌、落在哪些位置以及正逆位如何改变组合，不要把组合解释成固定预言。',
    naturalFollowUp ? '' : '当用户要求根据日记事实修正旧解读时，事实优先于牌义。必须区分已经验证、没有发生、无法确认和原先过度推断；不得为了证明塔罗准确而重新包装没有发生的内容。',
    responseConfig.instruction,
  ].filter(Boolean).join('\n\n');

  const history = cleanMessages(body.history,naturalFollowUp ? 6 : 8,naturalFollowUp ? 1000 : 2200);
  const input = [...history, { role: 'user' as const, content: message }];
  const requestPayload = (stream: boolean) => JSON.stringify({
    model,
    messages: [{ role: 'system', content: instructions }, ...input],
    max_tokens: responseConfig.maxTokens,
    stream,
  });

  async function retryCompletedText(partial = '') {
    const retryController = new AbortController();
    const retryTimeout = setTimeout(() => retryController.abort(), 12000);
    try {
      const messages = partial
        ? [
            { role: 'system', content: instructions },
            ...input,
            { role: 'assistant', content: partial },
            { role: 'user', content: '上一段在半句话处断了。请只接着没说完的地方继续，用一至两个自然短段落收尾，不要重复前文，不要解释断线。' },
          ]
        : [{ role: 'system', content: instructions }, ...input];
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens: responseConfig.maxTokens, stream: false }),
        signal: retryController.signal,
      });
      if (!response.ok) return '';
      return extractCompletedText(await response.json().catch(() => null)).trim();
    } catch {
      return '';
    } finally {
      clearTimeout(retryTimeout);
    }
  }

  async function completeInterruptedText(partial: string, forceContinuation = false) {
    let combined = partial;
    const additions: string[] = [];
    for (let attempt = 0; attempt < 1; attempt += 1) {
      if (!forceContinuation && replyLooksComplete(combined)) break;
      const continued = await retryCompletedText(combined);
      if (!continued) break;
      additions.push(continued);
      combined = `${combined}\n\n${continued}`;
      forceContinuation = false;
    }
    return additions.join('\n\n');
  }

  let upstream: Response | null = null;
  for (let attempt = 0; attempt < 1; attempt += 1) {
    const connectController = new AbortController();
    const connectTimeout = setTimeout(() => connectController.abort(), 12000);
    try {
      upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: requestPayload(true),
        signal: connectController.signal,
      });
      if (upstream.ok || ![429,500,502,503,504].includes(upstream.status) || attempt === 0) break;
      await upstream.body?.cancel().catch(() => undefined);
      upstream = null;
    } catch {
      upstream = null;
      if (attempt === 0) break;
    } finally {
      clearTimeout(connectTimeout);
    }
  }

  if (!upstream) return localAgentResponse(message, body.context, tools, quota.remaining, length);

  if (!upstream.ok) {
    const upstreamDetail = (await upstream.text().catch(() => '')).slice(0, 500);
    console.error('[tarot-chat] Moyu request failed', {
      status: upstream.status,
      model,
      detail: upstreamDetail,
    });
    return localAgentResponse(message, body.context, tools, quota.remaining, length);
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!upstream.body || contentType.includes('application/json')) {
    const payload = await upstream.json().catch(() => null);
    const completed = extractCompletedText(payload);
    if (!completed) return localAgentResponse(message, body.context, tools, quota.remaining, length);
    return new Response(completed, {
      headers: agentHeaders(tools, 'model', quota.remaining),
    });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let emittedAny = false;
  let emittedText = '';
  let finishReason = '';

  const readSseLine = (line: string, controller: ReadableStreamDefaultController<Uint8Array>) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return false;
    const raw = trimmed.slice(5).trim();
    if (!raw) return false;
    if (raw === '[DONE]') return false;
    try {
      const payload = JSON.parse(raw);
      finishReason = extractFinishReason(payload) || finishReason;
      const delta = extractText(payload);
      if (!delta) return false;
      controller.enqueue(encoder.encode(delta));
      emittedText += delta;
      emittedAny = true;
      return true;
    } catch {
      return false;
    }
  };

  const finishStream = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (!emittedAny) {
      const retried = await retryCompletedText();
      controller.enqueue(encoder.encode(retried || `【本地解读】\n${localAgentText(message, body.context, length)}`));
    } else if (finishReason === 'length' || !replyLooksComplete(emittedText)) {
      const continued = await completeInterruptedText(emittedText, finishReason === 'length');
      const supplement = continued || '——刚才的句子没有传完整。先保留已经说清的部分，不用据此仓促下结论；你可以点“重新生成”让我完整说一遍。';
      controller.enqueue(encoder.encode(`\n\n${supplement}`));
    }
    controller.close();
  };

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            if (buffer.trim()) {
              buffer.split(/\r?\n/).forEach((line) => readSseLine(line, controller));
            }
            await finishStream(controller);
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || '';
          let emitted = false;
          for (const line of lines) {
            emitted = readSseLine(line, controller) || emitted;
          }
          if (emitted) return;
        }
      } catch {
        if (!emittedAny) {
          const retried = await retryCompletedText();
          controller.enqueue(encoder.encode(retried || `【本地解读】\n${localAgentText(message, body.context, length)}`));
        } else {
          const continued = await completeInterruptedText(emittedText, true);
          controller.enqueue(encoder.encode(`\n\n${continued || '——刚才的句子没有传完整。先保留已经说清的部分，不用据此仓促下结论；你可以点“重新生成”让我完整说一遍。'}`));
        }
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
