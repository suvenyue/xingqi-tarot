export type CombinationCard = {
  name: string;
  arcana?: 'major' | 'minor';
  suit?: string;
  suitLabel?: string;
  rank?: string;
  element?: string;
  reversed: boolean;
};

export type CombinationInsight = {
  kind: 'classic-pair' | 'same-suit' | 'repeated-rank' | 'court' | 'start-result' | 'position';
  title: string;
  cards: string[];
  evidence: string;
  meaning: string;
};

const classicPairs: Record<string, string> = {
  '女祭司|月亮': '直觉与投射同时增强。先相信感受发出的警报，但不要把猜测直接当成事实。',
  '愚者|魔术师': '新的可能已经从想法走向行动，关键是把自由感落到一个具体选择上。',
  '魔术师|女祭司': '主动表达与安静观察需要配合；只行动会忽略暗线，只等待也会错失时机。',
  '皇后|皇帝': '滋养与结构同时出现，说明关系或计划既需要温度，也需要边界和稳定规则。',
  '皇帝|教皇': '制度、承诺和既有标准被明显强调，要确认遵循规则是在保护你，还是限制你。',
  '恋人|恶魔': '吸引与依附很容易混在一起。强烈连接不等于健康连接，选择权和边界是判断重点。',
  '战车|力量': '外在推进与内在克制互相支持；真正有效的前进不是硬冲，而是稳定驾驭情绪。',
  '隐者|星星': '独处正在从封闭转向修复。答案不会立刻喧闹地出现，而会先恢复方向感。',
  '命运之轮|审判': '旧循环再次出现，但这一次要求你作出不同回应，而不是被动等待局势改变。',
  '正义|审判': '事实、责任与复盘同时被强调。决定之前要分清证据、解释和自己应承担的部分。',
  '倒吊人|死神': '暂停已接近真正的结束或转化；继续拖延只会延长已经失效的阶段。',
  '死神|世界': '一个周期正在彻底收尾。先完成告别与整合，新的开始才不会重复旧模式。',
  '节制|恶魔': '节制正在修正欲望、依赖或过度。重点不是压抑，而是恢复可持续的比例。',
  '高塔|星星': '结构破裂之后出现修复方向。不要急着回到原样，应以已经看见的真相重新建立。',
  '月亮|太阳': '迷雾正在走向清晰。前一张暴露恐惧与投射，后一张要求用坦率和事实完成验证。',
  '太阳|世界': '成果具备被确认和正式完成的条件，但最后的交付、收尾或公开仍不能省略。',
};

const suitMeaning: Record<string, string> = {
  wands: '权杖连续出现，行动、欲望和推进速度成为主线；需要确认热情是否有稳定方向。',
  cups: '圣杯连续出现，感受、关系与直觉被放大；情绪真实，但仍要和现实行为互相验证。',
  swords: '宝剑连续出现，沟通、判断或冲突正在主导局面；想清楚很重要，也要避免反复内耗。',
  pentacles: '星币连续出现，金钱、身体、时间和长期投入最关键；结果取决于能否持续落实。',
};

function cardLabel(card: CombinationCard) {
  return `${card.name}·${card.reversed ? '逆位' : '正位'}`;
}

function positionModifier(firstPosition: string, secondPosition: string) {
  const pair = `${firstPosition}|${secondPosition}`;
  if (/(过去|起点|根源).*(未来|结果|趋势)/.test(pair)) return '它们横跨起点与结果，重点要看前一种状态怎样演变成后一种状态。';
  if (/(你|自我).*(对方|TA)|(?:对方|TA).*(你|自我)/.test(pair)) return '它们分别落在双方位置，说明这不是单方牌义，而是两种立场如何互相作用。';
  if (/(阻碍|挑战|阴影)/.test(pair)) return '其中一张位于阻碍或阴影位置，组合中较紧张的一面会被放大。';
  if (/(建议|行动|应对)/.test(pair)) return '其中一张位于建议或行动位置，因此组合重点是怎样回应，而不是预测一个固定结果。';
  return '两张牌落在不同牌位，组合含义要以各自承担的角色为准，不能脱离牌阵位置套用。';
}

export function buildCombinationInsights(cards: CombinationCard[], positions: string[]): CombinationInsight[] {
  if (!cards.length) return [];
  const insights: CombinationInsight[] = [];

  for (let firstIndex = 0; firstIndex < cards.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < cards.length; secondIndex += 1) {
      const first = cards[firstIndex];
      const second = cards[secondIndex];
      const classic = classicPairs[`${first.name}|${second.name}`] || classicPairs[`${second.name}|${first.name}`];
      if (!classic) continue;
      insights.push({
        kind: 'classic-pair',
        title: `${first.name} × ${second.name}`,
        cards: [cardLabel(first), cardLabel(second)],
        evidence: `${first.name}位于“${positions[firstIndex] || `牌位${firstIndex + 1}`}”，${second.name}位于“${positions[secondIndex] || `牌位${secondIndex + 1}`}”。`,
        meaning: `${classic}${positionModifier(positions[firstIndex] || '', positions[secondIndex] || '')}${first.reversed || second.reversed ? '其中至少一张逆位，说明这股组合能量目前更可能表现为延迟、内耗或尚未说出口。' : ''}`,
      });
    }
  }

  const suitGroups = new Map<string, number[]>();
  cards.forEach((card, index) => {
    if (card.arcana !== 'minor' || !card.suit) return;
    suitGroups.set(card.suit, [...(suitGroups.get(card.suit) || []), index]);
  });
  suitGroups.forEach((indices, suit) => {
    if (indices.length < 2) return;
    const grouped = indices.map((index) => cards[index]);
    const continuous = indices.some((index, groupIndex) => groupIndex > 0 && index === indices[groupIndex - 1] + 1);
    insights.push({
      kind: 'same-suit',
      title: `${grouped[0].suitLabel || '同花色'}${continuous ? '连续出现' : '集中出现'}`,
      cards: grouped.map(cardLabel),
      evidence: `${grouped.length}张${grouped[0].suitLabel || '同花色牌'}分布在${indices.map((index) => `“${positions[index] || `牌位${index + 1}`}”`).join('、')}。`,
      meaning: `${suitMeaning[suit] || '同一花色重复出现，说明这类现实课题不是偶然插曲，而是整组牌需要持续处理的主线。'}${continuous ? '相邻牌位连续出现，让这种影响更直接地连接前后两个阶段。' : '它们分布在不同牌位，说明同一课题从多个角度反复介入。'}`,
    });
  });

  const rankGroups = new Map<string, number[]>();
  cards.forEach((card, index) => {
    if (!card.rank) return;
    rankGroups.set(card.rank, [...(rankGroups.get(card.rank) || []), index]);
  });
  rankGroups.forEach((indices, rank) => {
    if (indices.length < 2) return;
    insights.push({
      kind: 'repeated-rank',
      title: `重复数字／阶位：${rank} × ${indices.length}`,
      cards: indices.map((index) => cardLabel(cards[index])),
      evidence: `“${rank}”在${indices.map((index) => positions[index] || `牌位${index + 1}`).join('、')}重复出现。`,
      meaning: ['侍从', '骑士', '王后', '国王'].includes(rank)
        ? '同一宫廷阶位重复，说明不同领域正在用相似的成熟度、角色或应对方式彼此呼应。'
        : '重复数字会放大同一发展阶段，提示多个位置可能共享相似的进度、压力或成长任务。',
    });
  });

  const courts = cards.map((card, index) => ({ card, index })).filter(({ card }) => ['侍从', '骑士', '王后', '国王'].includes(card.rank || ''));
  if (courts.length >= 2) {
    insights.push({
      kind: 'court',
      title: '宫廷牌角色关系',
      cards: courts.map(({ card }) => cardLabel(card)),
      evidence: `${courts.map(({ card, index }) => `${positions[index] || `牌位${index + 1}`}出现${card.rank}`).join('；')}。`,
      meaning: '宫廷牌较多时，事件不仅由抽象能量推动，也与具体人物、沟通角色和成熟度有关。侍从偏学习，骑士偏行动，王后偏内在掌握，国王偏外在决策。',
    });
  }

  if (cards.length > 1) {
    const first = cards[0];
    const last = cards[cards.length - 1];
    const orientationShift = first.reversed === last.reversed
      ? first.reversed ? '起点与结果都带有阻力，改变需要先发生在内在模式。' : '起点与结果都能较直接地进入现实，行动的连续性比等待更重要。'
      : first.reversed ? '能量从受阻走向较清晰表达，说明调整后存在改善空间。' : '能量从外显转入内在阻力，提醒中途可能有尚未处理的代价。';
    insights.push({
      kind: 'start-result',
      title: '起点 → 结果',
      cards: [cardLabel(first), cardLabel(last)],
      evidence: `${positions[0] || '起点'}由${cardLabel(first)}开启，${positions[cards.length - 1] || '结果'}落在${cardLabel(last)}。`,
      meaning: orientationShift,
    });
  }

  return insights.slice(0, 7);
}
