'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeftRight, BookOpen, Bot, Check, ChevronRight, Clock3, Copy, Download, Link2, MessageCircle, MoonStar, Plus, RotateCcw, Save, Send, Shuffle, Sparkles, Square, Sunrise, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cardOrigin } from '@/lib/card-origins';
import { buildCombinationInsights, type CombinationInsight } from '@/lib/tarot-combinations';
import { minorCards, minorDomainMeaning, type DeckCard, type Domain } from '@/lib/tarot-deck';

type Spread = 'single' | 'three' | 'celtic' | 'relationship' | 'choice' | 'career' | 'year';
type SpreadPosition = { name: string; short: string; focus: string };
type SpreadDefinition = { name: string; countLabel: string; description: string; positions: SpreadPosition[] };
type RitualStage = 'idle' | 'gathering' | 'shuffling' | 'opening';

const moonJourney = [
  { label: '静心', phase: 'new' },
  { label: '选阵', phase: 'crescent' },
  { label: '洗牌', phase: 'half' },
  { label: '选牌', phase: 'gibbous' },
  { label: '解读', phase: 'full' },
] as const;

const spreadScenes: Record<Spread, { symbol: string; title: string; note: string }> = {
  single: { symbol: '☾', title: '月光之门', note: '一束月光，只照亮此刻最重要的答案' },
  three: { symbol: '⋯', title: '时间之流', note: '过往、当下与趋势沿同一条星轨展开' },
  celtic: { symbol: '✣', title: '十字圣域', note: '交叉力量与命运之轮共同揭示全貌' },
  relationship: { symbol: '♡', title: '双星共振', note: '两颗独立的心，在关系核心处相遇' },
  choice: { symbol: '⋔', title: '命运岔路', note: '两条道路分别显露机会、代价与走向' },
  career: { symbol: '⌁', title: '星阶之路', note: '沿能力、阻碍与机会逐层走向下一站' },
  year: { symbol: '◎', title: '年度星轮', note: '十二个生活宫位环绕年度核心缓慢展开' },
};

const ritualCopy: Record<Exclude<RitualStage, 'idle'>, { eyebrow: string; title: string; note: string }> = {
  gathering: { eyebrow: 'GATHERING INTENTION', title: '星光正在回应你的问题', note: '让呼吸慢下来，把注意力放回此刻。' },
  shuffling: { eyebrow: 'SHUFFLING THE DECK', title: '七十八张牌正在重新排列', note: '正位与逆位分别独立随机，牌序由安全随机源生成。' },
  opening: { eyebrow: 'THE PATH IS OPENING', title: '牌阵之门已经打开', note: '接下来，请从完整牌组中亲手选出吸引你的牌。' },
};

function starNoise(index: number, salt: number) {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 1, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
}

const twinkleStars = Array.from({ length: 22 }, (_, index) => ({
  left: `${3 + starNoise(index, 1) * 94}%`,
  top: `${2 + starNoise(index, 2) * 95}%`,
  '--twinkle-size': `${.85 + starNoise(index, 3) * 2.15}px`,
  '--twinkle-delay': `${-starNoise(index, 4) * 8.5}s`,
  '--twinkle-duration': `${3.8 + starNoise(index, 5) * 5.2}s`,
  '--twinkle-drift': `${-8 + starNoise(index, 6) * 16}px`,
  '--twinkle-rise': `${-11 + starNoise(index, 7) * 15}px`,
} as CSSProperties));

type SkyMode = 'auto' | 'night';
type SkyPeriod = 'dawn' | 'day' | 'dusk' | 'night';
type ConstellationZone = 'reading' | 'selection' | 'daily' | 'library' | 'history';
type ConstellationPoint = readonly [number, number];
type ConstellationSpec = {
  id: string;
  name: string;
  en: string;
  zone: ConstellationZone;
  points: ConstellationPoint[];
  lines: readonly [number, number][];
  bright: number[];
  position: { left: string; top: string; width: string; rotate: string; delay: string };
};

const SKY_MODE_KEY = 'xingqi-sky-mode-v1';

function skyPeriodFor(date = new Date()): SkyPeriod {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

const constellationSpecs: ConstellationSpec[] = [
  {
    id: 'orion', name: '猎户座', en: 'ORION', zone: 'reading', bright: [0,1,5],
    points: [[25,13],[72,18],[42,45],[52,48],[62,51],[29,87],[76,89],[18,36],[82,38]],
    lines: [[0,1],[0,7],[7,2],[2,3],[3,4],[4,8],[8,1],[2,5],[4,6]],
    position: { left: '3%', top: '15%', width: '210px', rotate: '-8deg', delay: '-2s' },
  },
  {
    id: 'ursa-major', name: '大熊座', en: 'URSA MAJOR', zone: 'reading', bright: [0,3,6],
    points: [[8,34],[25,27],[43,31],[59,43],[76,35],[91,45],[82,66]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]],
    position: { left: '70%', top: '11%', width: '270px', rotate: '7deg', delay: '-6s' },
  },
  {
    id: 'ursa-minor', name: '小熊座', en: 'URSA MINOR', zone: 'reading', bright: [0,6],
    points: [[10,18],[24,28],[38,38],[54,50],[72,43],[88,55],[76,73]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]],
    position: { left: '78%', top: '62%', width: '175px', rotate: '-12deg', delay: '-9s' },
  },
  {
    id: 'cygnus', name: '天鹅座', en: 'CYGNUS', zone: 'selection', bright: [0,3,5],
    points: [[50,6],[49,29],[49,51],[49,76],[48,94],[14,47],[82,55]],
    lines: [[0,1],[1,2],[2,3],[3,4],[5,2],[2,6]],
    position: { left: '5%', top: '50%', width: '205px', rotate: '13deg', delay: '-4s' },
  },
  {
    id: 'pegasus', name: '飞马座', en: 'PEGASUS', zone: 'selection', bright: [0,1,2,3],
    points: [[15,18],[77,13],[83,70],[21,78],[6,48],[95,38],[62,91]],
    lines: [[0,1],[1,2],[2,3],[3,0],[0,4],[1,5],[3,6]],
    position: { left: '72%', top: '18%', width: '245px', rotate: '-5deg', delay: '-8s' },
  },
  {
    id: 'lyra', name: '天琴座', en: 'LYRA', zone: 'daily', bright: [0],
    points: [[19,10],[42,36],[76,32],[70,76],[35,81]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,1]],
    position: { left: '5%', top: '18%', width: '170px', rotate: '-11deg', delay: '-3s' },
  },
  {
    id: 'aquila', name: '天鹰座', en: 'AQUILA', zone: 'daily', bright: [3],
    points: [[9,47],[27,31],[48,45],[55,20],[63,48],[82,33],[94,55],[50,79]],
    lines: [[0,1],[1,2],[2,3],[2,4],[4,5],[5,6],[2,7]],
    position: { left: '74%', top: '57%', width: '225px', rotate: '9deg', delay: '-7s' },
  },
  {
    id: 'cassiopeia', name: '仙后座', en: 'CASSIOPEIA', zone: 'library', bright: [0,2,4],
    points: [[6,29],[27,66],[49,25],[71,69],[94,31]],
    lines: [[0,1],[1,2],[2,3],[3,4]],
    position: { left: '4%', top: '14%', width: '230px', rotate: '-7deg', delay: '-5s' },
  },
  {
    id: 'andromeda', name: '仙女座', en: 'ANDROMEDA', zone: 'library', bright: [0,3,6],
    points: [[7,47],[24,43],[40,50],[55,36],[69,48],[84,35],[95,17],[61,74]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[3,7]],
    position: { left: '73%', top: '57%', width: '250px', rotate: '8deg', delay: '-9s' },
  },
  {
    id: 'scorpius', name: '天蝎座', en: 'SCORPIUS', zone: 'history', bright: [0,4,8],
    points: [[12,12],[20,31],[34,39],[47,50],[60,61],[76,67],[87,78],[79,91],[64,84]],
    lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]],
    position: { left: '73%', top: '16%', width: '235px', rotate: '-9deg', delay: '-4s' },
  },
];

function ConstellationField({ zone }: { zone: ConstellationZone }) {
  return <div className={`constellation-field zone-${zone}`} aria-hidden="true">
    {constellationSpecs.map((constellation) => (
      <figure
        className={`constellation-group constellation-${constellation.id} for-${constellation.zone}`}
        style={{
          '--constellation-left': constellation.position.left,
          '--constellation-top': constellation.position.top,
          '--constellation-width': constellation.position.width,
          '--constellation-rotate': constellation.position.rotate,
          '--constellation-delay': constellation.position.delay,
        } as CSSProperties}
        key={constellation.id}
      >
        <svg viewBox="0 0 100 100" role="presentation">
          <g className="constellation-lines">
            {constellation.lines.map(([from,to], index) => <line x1={constellation.points[from][0]} y1={constellation.points[from][1]} x2={constellation.points[to][0]} y2={constellation.points[to][1]} key={`${constellation.id}-line-${index}`} />)}
          </g>
          <g className="constellation-stars">
            {constellation.points.map(([x,y], index) => <circle className={constellation.bright.includes(index) ? 'is-bright' : ''} cx={x} cy={y} r={constellation.bright.includes(index) ? 1.65 : 1.05} key={`${constellation.id}-star-${index}`} />)}
          </g>
        </svg>
        <figcaption><span>{constellation.name}</span><small>{constellation.en}</small></figcaption>
      </figure>
    ))}
  </div>;
}

const spreadDefinitions: Record<Spread, SpreadDefinition> = {
  single: {
    name: '单牌指引', countLabel: '1张', description: '为此刻抽取一张核心指引牌',
    positions: [{ name: '此刻的指引', short: '指引', focus: '聚焦你此刻最需要看见的主题与可采取的行动。' }],
  },
  three: {
    name: '三牌展开', countLabel: '3张', description: '以过往、当下、趋势展开三张牌',
    positions: [
      { name: '过往', short: '过往', focus: '照见事件的根源、已经形成的惯性和从过去带来的经验。' },
      { name: '当下', short: '当下', focus: '描述当前最核心的能量，也是此刻最能改变走向的着力点。' },
      { name: '趋势', short: '趋势', focus: '显示沿着现有选择继续前进时较可能形成的可调整趋势。' },
    ],
  },
  celtic: {
    name: '凯尔特十字', countLabel: '10张', description: '从十个层面完整分析问题与发展趋势',
    positions: [
      { name: '现状', short: '现状', focus: '呈现问题当前最核心的能量与真实处境。' },
      { name: '挑战', short: '挑战', focus: '指出横在现状上的阻碍、冲突或必须整合的力量。' },
      { name: '意识目标', short: '目标', focus: '反映你清楚知道、正在追求或期待实现的方向。' },
      { name: '潜意识根源', short: '根源', focus: '揭示尚未完全说出口，却持续驱动选择的深层原因。' },
      { name: '近期过去', short: '过去', focus: '说明刚刚离开的阶段及其对当前局面的影响。' },
      { name: '近期未来', short: '近期', focus: '显示接下来最先出现的变化、机会或考验。' },
      { name: '你的立场', short: '自我', focus: '呈现你的态度、资源、行为方式和对自身角色的理解。' },
      { name: '外部环境', short: '环境', focus: '指出他人、现实条件和周围环境如何影响问题。' },
      { name: '希望与恐惧', short: '希望／恐惧', focus: '揭示期待与焦虑交织之处，以及它如何影响判断。' },
      { name: '最终趋势', short: '结果', focus: '整合前九张牌，显示按当前路径发展时最可能抵达的方向。' },
    ],
  },
  relationship: {
    name: '感情关系', countLabel: '7张', description: '看见双方状态、关系核心与发展趋势',
    positions: [
      { name: '你的状态', short: '你', focus: '呈现你在关系中的感受、需求和行为方式。' },
      { name: '对方状态', short: '对方', focus: '呈现对方目前展现出的情感状态与关系立场。' },
      { name: '关系基础', short: '基础', focus: '指出让双方连接的共同基础、吸引力或历史原因。' },
      { name: '当前互动', short: '互动', focus: '描述关系现在实际运行的模式与能量交换。' },
      { name: '隐藏议题', short: '隐藏', focus: '揭示尚未被正视、却持续影响关系的深层问题。' },
      { name: '关系需要', short: '需要', focus: '指出关系若要成长，双方最需要建立或调整的部分。' },
      { name: '发展趋势', short: '趋势', focus: '显示维持当前互动方式时，关系较可能形成的走向。' },
    ],
  },
  choice: {
    name: '二选一决策', countLabel: '7张', description: '比较A、B两条路径的机会、代价与结果',
    positions: [
      { name: '决策核心', short: '核心', focus: '说明这次选择真正需要解决的核心课题。' },
      { name: '选择A的优势', short: 'A优势', focus: '显示走向选择A时可利用的机会和支持。' },
      { name: '选择A的代价', short: 'A代价', focus: '显示选择A需要承担的成本、风险或放弃。' },
      { name: '选择A的趋势', short: 'A趋势', focus: '显示沿着选择A继续发展时较可能出现的结果。' },
      { name: '选择B的优势', short: 'B优势', focus: '显示走向选择B时可利用的机会和支持。' },
      { name: '选择B的代价', short: 'B代价', focus: '显示选择B需要承担的成本、风险或放弃。' },
      { name: '选择B的趋势', short: 'B趋势', focus: '显示沿着选择B继续发展时较可能出现的结果。' },
    ],
  },
  career: {
    name: '事业发展', countLabel: '7张', description: '分析能力、阻碍、机会与下一步职业行动',
    positions: [
      { name: '职业现状', short: '现状', focus: '呈现当前事业或学业最真实的状态。' },
      { name: '核心优势', short: '优势', focus: '指出你最值得运用的能力、经验与资源。' },
      { name: '主要阻碍', short: '阻碍', focus: '揭示限制进展的内外部因素与惯性。' },
      { name: '潜在机会', short: '机会', focus: '指出尚未充分利用的窗口、方向或合作可能。' },
      { name: '外部环境', short: '环境', focus: '反映组织、行业、合作对象和现实条件的影响。' },
      { name: '行动建议', short: '行动', focus: '说明现阶段最值得投入的具体行动方向。' },
      { name: '发展趋势', short: '趋势', focus: '显示按当前选择继续推进时的阶段性职业走向。' },
    ],
  },
  year: {
    name: '年度十二宫', countLabel: '13张', description: '以年度主题与十二宫位观察未来一年',
    positions: [
      { name: '年度主题', short: '年度', focus: '统领未来一年的核心课题、整体基调与成长方向。' },
      { name: '第一宫 · 自我', short: '自我', focus: '观察身份、外在状态、主动性与个人开始。' },
      { name: '第二宫 · 财务', short: '财务', focus: '观察收入、资源、消费模式与自我价值。' },
      { name: '第三宫 · 沟通', short: '沟通', focus: '观察学习、表达、短途行动与日常信息。' },
      { name: '第四宫 · 家庭', short: '家庭', focus: '观察家庭、居所、安全感与内在根基。' },
      { name: '第五宫 · 创造', short: '创造', focus: '观察恋爱、兴趣、创造力、孩子与快乐。' },
      { name: '第六宫 · 工作健康', short: '工作／健康', focus: '观察日常工作、习惯、服务与身心照护。' },
      { name: '第七宫 · 关系', short: '关系', focus: '观察伴侣、合作、契约与一对一互动。' },
      { name: '第八宫 · 转化', short: '转化', focus: '观察共享资源、亲密、危机、债务与深层改变。' },
      { name: '第九宫 · 远方', short: '远方', focus: '观察高等学习、旅行、信念与视野扩展。' },
      { name: '第十宫 · 事业', short: '事业', focus: '观察职业目标、社会角色、责任与公众评价。' },
      { name: '第十一宫 · 社群', short: '社群', focus: '观察朋友、团队、长期愿望与共同目标。' },
      { name: '第十二宫 · 内在', short: '内在', focus: '观察潜意识、休息、隐秘压力、结束与精神疗愈。' },
    ],
  },
};

const questionExamples: Record<Exclude<Spread, 'choice'>, string[]> = {
  single: [
    '此刻我最需要看见的提醒是什么？',
    '我应该如何面对眼前的变化？',
    '今天最值得我关注的能量是什么？',
  ],
  three: [
    '这件事是如何发展到现在的，接下来会走向哪里？',
    '我目前的处境中，最需要调整的是什么？',
    '过去的什么经验正在影响我现在的选择？',
  ],
  celtic: [
    '我该如何完整理解并推进目前最困扰我的问题？',
    '这件事背后的核心阻碍、隐藏因素与发展趋势是什么？',
    '如果我继续沿着当前方向前进，可能会迎来怎样的结果？',
  ],
  relationship: [
    '我和 TA 目前的关系处于什么状态？',
    '对方如何看待这段关系？',
    '未来三个月这段关系可能如何发展？',
    '我应该如何处理与 TA 的关系？',
    '这段关系目前最大的阻碍是什么？',
  ],
  career: [
    '我目前职业发展的主要阻碍是什么？',
    '我是否应该接受这个工作机会？',
    '接下来三个月工作上应该把重点放在哪里？',
    '我该如何发挥优势，走出目前的职业停滞？',
  ],
  year: [
    '未来一年最重要的成长主题是什么？',
    '未来一年我的事业、关系与财务分别需要关注什么？',
    '这一年我最值得主动把握的机会是什么？',
  ],
};

type TarotCard = {
  id: number;
  name: string;
  en: string;
  glyph: string;
  upright: string;
  reversed: string;
  message: string;
  uprightMeaning?: string;
  reversedMeaning?: string;
  arcana?: 'major' | 'minor';
  suit?: DeckCard['suit'];
  suitLabel?: string;
  rank?: string;
  element?: string;
};

const majorCards: TarotCard[] = [
  { id: 0, name: '愚者', en: 'THE FOOL', glyph: '✦', upright: '启程 · 自由 · 信任', reversed: '迟疑 · 冒进 · 漂泊', message: '允许自己先迈出一步。答案不会在原地出现，而会在路上逐渐清晰。' },
  { id: 1, name: '魔术师', en: 'THE MAGICIAN', glyph: '∞', upright: '创造 · 意志 · 行动', reversed: '分心 · 欺瞒 · 潜能未用', message: '你需要的工具其实已经在手中。把注意力收回，专注完成最关键的一件事。' },
  { id: 2, name: '女祭司', en: 'THE HIGH PRIESTESS', glyph: '☽', upright: '直觉 · 静观 · 秘密', reversed: '封闭 · 忽视直觉 · 表象', message: '先别急着解释一切。安静片刻，你的第一感受往往比分析更接近真相。' },
  { id: 3, name: '皇后', en: 'THE EMPRESS', glyph: '♀', upright: '丰盛 · 滋养 · 感受', reversed: '消耗 · 依赖 · 忽略自己', message: '让事情生长，而不是用力拉扯。先照顾好自己的节奏，丰盛才有容器。' },
  { id: 4, name: '皇帝', en: 'THE EMPEROR', glyph: '♜', upright: '秩序 · 边界 · 领导', reversed: '僵化 · 控制 · 失序', message: '清晰的边界会带来自由。决定什么值得守护，也决定什么不再接受。' },
  { id: 5, name: '教皇', en: 'THE HIEROPHANT', glyph: '⚿', upright: '传统 · 学习 · 信念', reversed: '质疑 · 新路 · 束缚', message: '借鉴经验，但别把传统当成唯一答案。真正的信念经得起你的提问。' },
  { id: 6, name: '恋人', en: 'THE LOVERS', glyph: '♡', upright: '连结 · 选择 · 一致', reversed: '失衡 · 分离 · 价值冲突', message: '这不只关于感情，也关于选择。问问自己：哪个决定更符合真实的你？' },
  { id: 7, name: '战车', en: 'THE CHARIOT', glyph: '➶', upright: '前进 · 决心 · 掌控', reversed: '失控 · 阻滞 · 方向不明', message: '聚拢分散的力量。只要方向一致，速度自然会回来。' },
  { id: 8, name: '力量', en: 'STRENGTH', glyph: '♌', upright: '勇气 · 温柔 · 耐心', reversed: '自疑 · 压抑 · 逞强', message: '真正的力量不必吼叫。以温柔而坚定的方式对待自己，也对待眼前的难题。' },
  { id: 9, name: '隐者', en: 'THE HERMIT', glyph: '✧', upright: '独处 · 寻路 · 内省', reversed: '孤立 · 逃避 · 迷失', message: '暂时离开噪声，答案需要一点独处的空间。你正在寻找的灯就在手里。' },
  { id: 10, name: '命运之轮', en: 'WHEEL OF FORTUNE', glyph: '⊙', upright: '转机 · 周期 · 机缘', reversed: '停滞 · 抗拒 · 反复', message: '局势正在转动。你无法控制所有变化，但可以选择如何回应它。' },
  { id: 11, name: '正义', en: 'JUSTICE', glyph: '⚖', upright: '公平 · 真相 · 责任', reversed: '偏见 · 回避 · 失衡', message: '把事实和愿望分开来看。坦诚承担自己的部分，事情才会重新平衡。' },
  { id: 12, name: '倒吊人', en: 'THE HANGED MAN', glyph: '▽', upright: '暂停 · 换位 · 放下', reversed: '拖延 · 僵持 · 徒劳牺牲', message: '现在的暂停并非空白。换一个角度，原本的困局会显出新的出口。' },
  { id: 13, name: '死神', en: 'DEATH', glyph: '♏', upright: '结束 · 蜕变 · 重生', reversed: '抗拒 · 停滞 · 放不下', message: '某个阶段已经完成使命。允许它结束，才能为真正的新生腾出位置。' },
  { id: 14, name: '节制', en: 'TEMPERANCE', glyph: '△', upright: '调和 · 节奏 · 疗愈', reversed: '过度 · 失衡 · 急躁', message: '不必走极端。把看似相反的两种力量调到一个可持续的比例。' },
  { id: 15, name: '恶魔', en: 'THE DEVIL', glyph: '♑', upright: '欲望 · 束缚 · 执念', reversed: '觉察 · 松绑 · 重获自主', message: '看清是什么在牵引你。承认欲望不是屈服，而是拿回选择权的开始。' },
  { id: 16, name: '高塔', en: 'THE TOWER', glyph: 'ϟ', upright: '突变 · 揭露 · 重建', reversed: '余震 · 抗拒改变 · 延迟', message: '倒下的是不再牢靠的结构。先确保安全，再用真实的材料重建。' },
  { id: 17, name: '星星', en: 'THE STAR', glyph: '★', upright: '希望 · 灵感 · 疗愈', reversed: '失望 · 疏离 · 信心不足', message: '希望并非盲目乐观，而是你在黑暗里仍愿意抬头确认方向。' },
  { id: 18, name: '月亮', en: 'THE MOON', glyph: '☾', upright: '潜意识 · 迷雾 · 梦境', reversed: '看清 · 恐惧消退 · 混乱', message: '此刻的信息并不完整。尊重感受，但在做重大决定前再多等一个线索。' },
  { id: 19, name: '太阳', en: 'THE SUN', glyph: '☀', upright: '喜悦 · 清晰 · 活力', reversed: '延迟的快乐 · 过度乐观 · 阴影', message: '让自己被看见。坦率、热情和清晰会为这件事带来真正的生命力。' },
  { id: 20, name: '审判', en: 'JUDGEMENT', glyph: '♬', upright: '觉醒 · 回应 · 复盘', reversed: '自我怀疑 · 逃避召唤 · 苛责', message: '过去不是判决，而是材料。听见内心的召唤，然后用新的选择回应它。' },
  { id: 21, name: '世界', en: 'THE WORLD', glyph: '◎', upright: '完成 · 圆满 · 整合', reversed: '未竟 · 缺口 · 延迟完成', message: '一个循环正在收尾。认可自己走过的路，完成最后那一点，再启程。' },
];

const cards: TarotCard[] = [
  ...majorCards.map((card) => ({
    ...card,
    arcana: 'major' as const,
    uprightMeaning: `${card.upright}。${card.message}`,
    reversedMeaning: `${card.reversed}。这张牌的核心力量受到压抑、延迟或被过度使用，需要先处理失衡再行动。`,
  })),
  ...minorCards,
];

type CardGuide = {
  love: string;
  career: string;
  money: string;
  health?: string;
  blindspot: string;
  action: string;
  reflect: string;
};

const cardGuides: Record<number, CardGuide> = {
  0: { love: '关系里需要一点新鲜空气。单身时适合放下过度设想，以真实好奇心认识别人；已有关系则可一起尝试新事物，但别把“随性”变成回避承诺。', career: '新的方向、岗位或项目正在召唤你。此时不必等到百分之百准备好，但要区分勇敢试错与没有基本规划的冒险。', money: '财务上可能出现冲动消费或对新机会过度乐观的倾向。可以为体验留预算，却不宜在信息不足时投入大额资金。', blindspot: '你可能把自由误解为不必负责，或因为害怕犯错而迟迟不肯启程。真正的自由包含为选择承担后果。', action: '选一个风险可控、能在七天内完成的第一步；先行动、再根据真实反馈修正方向。', reflect: '如果不需要向任何人证明自己，我真正想开始的是什么？' },
  1: { love: '吸引力与沟通力都很强，适合主动表达心意、把暧昧说清楚。也要留意漂亮话是否有稳定行动支撑，避免用技巧操控关系。', career: '这是整合资源并展示能力的时刻。你已经具备关键工具，重点是明确目标、减少分心，并把想法做成看得见的成果。', money: '适合通过技能、谈判或副业创造收入。涉及合作时务必确认信息真实、条款清晰，不要被包装精美的机会迷惑。', blindspot: '过度相信技巧会让你忽略诚意；同时，你也可能因为低估自己而一直等待“更好的工具”。', action: '列出手中已有的人脉、技能与资源，选出最能推动目标的三项，在今天完成一次明确输出。', reflect: '我是在创造真实结果，还是只在维持“我很忙”的感觉？' },
  2: { love: '关系中有尚未说出口的感受。与其逼问结论，不如观察双方的语气、停顿与一致性；单身者可先辨认自己真正需要的安全感。', career: '信息尚未完全浮现，适合调研、倾听与保密工作。先收集线索，不必急着公开计划或在办公室政治中站队。', money: '面对不透明的投资、费用或承诺要格外谨慎。直觉可以提醒风险，但仍需用账目、合同和事实完成验证。', blindspot: '把沉默当成智慧，可能演变成回避沟通；把焦虑当成直觉，也会让你误读情势。', action: '给自己二十四小时不做决定，写下第一直觉、可验证事实与未知信息，再比较三者。', reflect: '当外界声音安静下来，我最先听见的答案是什么？' },
  3: { love: '温柔、接纳与身体层面的亲密感正在增长。关系需要被照顾，但别只照顾别人；单身者也应先建立稳定的自我滋养。', career: '创意项目进入生长期，适合培育团队、产品或个人品牌。耐心提供资源，比反复催促更能带来结果。', money: '整体有丰盛潜力，适合把资金用于长期价值、生活品质或创造力。但要警惕用消费填补情绪空缺。', blindspot: '过度付出可能让关爱变成控制或牺牲。你不需要通过不断给予来证明自己的价值。', action: '为最重要的人或项目安排一项持续四周的滋养计划，同时明确自己能给与不能给的边界。', reflect: '我正在培育什么？它也有在滋养我吗？' },
  4: { love: '关系需要稳定承诺、规则与可预期性。适合讨论未来和边界，但避免把“为你好”变成替对方做主。', career: '适合建立流程、承担领导责任和做长期规划。清晰标准会让团队安心，僵硬命令则可能压低主动性。', money: '强调储蓄、资产配置与风险控制。此时稳健优先于短期刺激，适合完善预算、保险和长期计划。', blindspot: '害怕失控可能让你过度掌控，或把脆弱藏在强硬姿态后面。秩序应服务生命，而不是压住生命。', action: '写下三条真正必要的边界，并把每条边界对应的责任与后果说清楚。', reflect: '我想守护的核心是什么？哪些控制其实只是源自恐惧？' },
  5: { love: '共同价值观、家庭观念或正式承诺成为主题。适合确认彼此原则，也要给差异留下空间，别让外界标准替你们决定关系。', career: '导师、制度或专业训练能提供帮助。遵循成熟方法会降低试错成本，但最终仍要形成自己的判断。', money: '传统、透明、看得懂的理财方式更合适。若要借贷或签约，优先咨询合格专业人士并阅读全部条款。', blindspot: '可能因为权威说过就停止思考，或为了反叛而拒绝一切经验。真正的成熟是有意识地选择遵循什么。', action: '找一位可信赖且经验扎实的人请教，同时写下你不会放弃的个人原则。', reflect: '哪些信念真正属于我，哪些只是为了获得认可而继承的？' },
  6: { love: '亲密关系来到真诚选择的节点。吸引力很重要，价值一致与长期行动更重要；暧昧状态需要一次不绕弯的对话。', career: '可能面临两个方向、合作伙伴或价值取舍。不要只看眼前收益，要选那个让能力、兴趣与原则更一致的方案。', money: '共同财务、伴侣支出或合作分配需要透明。重大消费应确认是出于真实需要，而非为了取悦或证明关系。', blindspot: '你可能想保留所有选项，结果让每个选择都失去深度；也可能把强烈吸引误认为天然适合。', action: '列出这个选择必须满足的三项核心价值，删掉与它们明显冲突的选项。', reflect: '这个决定让我更接近真实的自己，还是更依赖他人的认可？' },
  7: { love: '关系需要共同方向，而不是一方拖着另一方前进。异地、时间安排或生活目标应形成可执行的共识。', career: '推进力很强，适合争取项目、考试、竞聘或突破停滞。集中火力比同时追逐多个目标更有效。', money: '财务目标可通过自律快速推进，但要避免因为急于证明成功而超前消费或高杠杆操作。', blindspot: '速度会掩盖方向问题；过度用意志压住情绪，可能在后期造成突然失控。', action: '确定一个三十天目标，设定每周里程碑，并明确暂时不做的三件事。', reflect: '我如此急着前进，是被目标吸引，还是在逃离某种感受？' },
  8: { love: '温柔而稳定的陪伴比强势说服更有效。关系中的敏感、嫉妒或不安需要被理解，而不是被羞辱或压制。', career: '你有能力处理高压任务，关键在情绪韧性与持续节奏。耐心影响他人，比正面硬碰更能赢得信任。', money: '适合克制即时欲望、坚持长期积累。不要因短期波动否定整个计划，也别用消费奖励每一次疲惫。', blindspot: '逞强并不等于强大；如果总是假装没事，你会失去请求支持和调整节奏的机会。', action: '面对最困难的一件事，先把情绪强度降下来，再用平静而清晰的一句话表达立场。', reflect: '如果我不必证明自己很强，我会怎样更温柔地解决这件事？' },
  9: { love: '需要独处不代表不爱。先分清是健康空间还是情感撤退；单身者此刻更适合认识自己的模式，而非急于填补空白。', career: '适合深度研究、复盘与独立完成关键工作。暂时远离无效会议和比较，找回自己的专业判断。', money: '倾向保守与审慎，适合核对长期目标、减少不必要开支。也别因缺乏安全感而完全停止合理投入。', blindspot: '内省若没有出口，会变成孤立与反刍。智慧需要在适当时候重新带回现实与关系。', action: '安排一段无干扰的独处时间，写出问题、证据和自己的答案，之后找可信的人校准一次。', reflect: '我是在寻找答案，还是用独处躲避必须发生的对话？' },
  10: { love: '关系进入新的周期，意外相遇、关系转折或旧模式重现都可能发生。把握机会，同时观察重复出现的课题。', career: '外部环境正在变化，可能带来岗位调整、窗口期或意外助力。保持灵活，提前准备能让好运真正落地。', money: '收入与支出可能出现波动，不宜把短期好运当成永久趋势。预留缓冲金，并在机会出现时保持理性。', blindspot: '把一切交给命运会削弱行动力；反过来，试图控制所有变量也会让你错过转机。', action: '梳理最近重复出现的三个信号，区分可控与不可控，为可控部分准备备选方案。', reflect: '这个循环想教会我什么？这次我能做出怎样不同的回应？' },
  11: { love: '关系需要公平、诚实和责任对等。适合澄清承诺、边界与事实，少猜测动机，多讨论可观察的行为。', career: '合同、考核、流程或重要决定成为焦点。坚持事实与专业标准，你的长期信誉比短期讨好更重要。', money: '适合核对账目、税务、合同和债务。任何“差不多”的数字都值得重新确认，公平分配也要写清楚。', blindspot: '自认为客观时，仍可能只挑选支持自身立场的证据；过度苛刻也会忽略情境与人性。', action: '把已知事实、个人解释、自己的责任分别写成三栏，再基于事实作决定。', reflect: '如果由完全中立的人审视这件事，他会指出我忽略了什么？' },
  12: { love: '关系需要暂停旧的互动方式。暂时退一步能看见对方视角，但无期限等待或单方面牺牲并不会自动换来改善。', career: '进展缓慢未必是失败，可能是方向需要重新定义。适合学习、观察和调整框架，不宜用更多蛮力解决结构问题。', money: '资金可能暂时冻结或回报延迟，宜保留流动性。不要为了证明过去的选择正确而继续投入沉没成本。', blindspot: '你可能把“再等等”当作避免决定的理由，或因习惯牺牲而忘了检查它是否仍有意义。', action: '暂停一个无效动作七天，从相反立场重新描述问题，并设定等待的明确截止日期。', reflect: '如果换一个角度看，这个停滞正在保护我或提醒我什么？' },
  13: { love: '旧的关系模式必须结束，关系才可能更新。这可能是告别，也可能是双方真正放下旧账后重新开始。', career: '职业阶段、岗位或工作方式正走向终点。与其勉强维持，不如清理旧任务，为新能力与方向腾出空间。', money: '适合停止长期无效支出、处理闲置资产和重整财务结构。短期可能不舒服，却有助于长期轻盈。', blindspot: '对熟悉事物的依恋会让你把结束视为失败。真正耗损你的，往往是已经结束却仍不肯承认。', action: '明确写下需要结束的一件事，完成必要交接，并为结束后的第一个新习惯安排日期。', reflect: '我必须放下什么，才能让新的生命真正进入？' },
  14: { love: '关系正在寻找更舒适的节奏。双方的需求不必完全相同，但可以通过耐心沟通与小幅调整达到动态平衡。', career: '适合跨部门协调、整合不同技能和稳步优化。此时持续改善优于激进翻盘，合作比单打独斗更有利。', money: '保持收支平衡，采用分散、渐进的策略。避免极端节省后报复性消费，也不宜追逐暴涨暴跌。', blindspot: '表面和平可能掩盖真实需求；如果总在调和别人，你自己的界限会逐渐模糊。', action: '挑出生活中最失衡的一处，只调整百分之十，坚持两周后再评估，而非一次改变全部。', reflect: '怎样的比例既照顾现实，也不背叛我的真实需要？' },
  15: { love: '强烈吸引、依赖、嫉妒或权力拉扯可能出现。承认欲望本身没有错，关键是双方是否仍有自由、尊重与退出空间。', career: '可能被头衔、竞争、过劳或有毒环境绑住。确认你追逐的究竟是成长，还是害怕失去认可与安全感。', money: '需留意债务、成瘾性消费、投机和“快速翻身”的诱惑。对让你羞于查看的账目尤其要主动面对。', blindspot: '束缚常以“我没办法”维持。你也许暂时不能立刻离开，但通常仍能拿回一小部分选择权。', action: '找出最消耗你的一个循环，记录触发点、行为与后果，并设置一个现实可执行的阻断动作。', reflect: '如果不再被恐惧或欲望牵着走，我今天能拿回哪一项选择权？' },
  16: { love: '被压住的问题可能突然爆发，真相也可能打破原有想象。先保证彼此安全，再处理事实，不要急着重建表面和平。', career: '组织变动、项目中断或信念被现实检验。危机中最重要的是识别真正失效的结构，而不是维护旧形式。', money: '可能有突发支出或风险暴露。立即检查现金流、保险与债务，暂停高风险操作，优先守住基本盘。', blindspot: '最危险的不是变化，而是继续假装裂缝不存在。另一方面，也别把每个小波动都灾难化。', action: '先处理安全与底线，再列出必须停止、需要保留、可以重建的三张清单。', reflect: '这次震动揭露了哪个我早已感觉到、却不愿承认的事实？' },
  17: { love: '关系中有修复与重新信任的可能。保持真诚和开放，但让信任通过持续的小行动慢慢恢复，不必催促结果。', career: '长期愿景重新清晰，创意和个人使命感上升。适合规划未来、展示原创想法，并与价值相近的人连接。', money: '财务正在恢复或出现更清楚的长期方向。继续稳步积累，避免因为看见希望就过早放松纪律。', blindspot: '希望不是等待奇迹；若没有现实行动，它会变成逃避当下困难的漂亮想象。', action: '写下未来六个月最想靠近的状态，并安排一个能在本周留下证据的小行动。', reflect: '即使结果尚未出现，什么仍值得我继续相信并投入？' },
  18: { love: '暧昧、投射或不安全感使关系显得模糊。感受值得尊重，但不要仅凭猜测定罪；重要结论要通过坦诚对话确认。', career: '信息混杂、目标不明或团队情绪影响判断。适合试探、小步验证，不宜在迷雾最浓时做不可逆决定。', money: '警惕隐藏费用、模糊承诺和情绪化交易。任何无法解释清楚的收益模式，都不应仅凭想象投入。', blindspot: '恐惧会把不确定自动翻译成最坏结局；幻想也会把警讯解释成浪漫信号。两者都需要事实校准。', action: '把担忧拆成“事实、猜测、最坏情境、可验证步骤”，在获得新证据前保持决定可逆。', reflect: '我现在看见的是事实，还是被过去经验放大的影子？' },
  19: { love: '坦率、温暖与被看见的喜悦增强。适合公开关系、庆祝进展或一起规划未来，也要给彼此真实而非表演式的快乐。', career: '成果容易被认可，适合展示、发布、面试和领导团队。清晰表达贡献，同时分享荣誉，会扩大正向影响。', money: '财务趋于明朗，努力可能得到回报。仍需避免因乐观而高估持续收入，把一部分成果留作长期积累。', blindspot: '过度强调积极可能让真实困难无处安放。健康的光明不是否认阴影，而是有能力看清它。', action: '把一个真实成果公开呈现或与重要的人分享，同时记录促成成果的具体做法。', reflect: '我是否允许自己真心享受成果，而不急着寻找下一个证明？' },
  20: { love: '过去的关系课题回到眼前，目的是让你作出更成熟的回应。适合诚实复盘、道歉、原谅或决定是否重新开始。', career: '职业召唤感变强，可能收到关键反馈、机会或重新选择方向。别让旧标签定义你接下来的身份。', money: '需要对过去的财务决定做总复盘，包括债务、长期计划与收入结构。看清之后再做一次明确调整。', blindspot: '自我审判会让复盘变成惩罚；逃避责任则会让同一课题不断重演。目标是回应，不是定罪。', action: '写一封不发送的总结信：承认发生了什么、学到了什么、接下来会怎样不同地行动。', reflect: '如果这是一次重新回应人生的机会，我愿意对什么说“是”？' },
  21: { love: '关系进入成熟、完成或共同迈入新阶段的时刻。单身者也可能真正结束旧循环，准备以更完整的自己进入关系。', career: '项目、学习或职业阶段接近完成，适合交付、复盘与庆祝。完成最后细节后，新的舞台会自然打开。', money: '长期规划逐渐见效，适合结算、整合账户或确认阶段性目标。不要因接近终点而忽略最后的手续与细节。', blindspot: '你可能低估完成的意义，立刻奔向下一个目标；也可能卡在最后一步，只因结束意味着身份变化。', action: '列出尚未收尾的最后三项，依次完成、记录成果并安排一次正式庆祝。', reflect: '这段旅程已经让我成为了怎样的人？我想带着什么进入下一个循环？' },
};

const majorHealth = [
  '活力与身体状态容易随生活节奏变化，适合尝试新的健康习惯，但要避免忽视风险或准备不足。',
  '关注手部、神经与专注力的协调；主动建立规律，会比不断更换方法更有效。',
  '身体正在要求安静、睡眠与对细微信号的倾听；不明症状应以专业检查确认。',
  '强调营养、休息、生殖与身体滋养；照顾别人之前也要确认自己的能量储备。',
  '骨骼、姿势、结构与规律性是重点；稳定作息有帮助，但避免因意志强撑而延误处理。',
  '适合遵循成熟、专业的照护方案；不要仅依赖传统经验而忽略个人差异。',
  '健康选择需要身心一致，也可能涉及伴侣共同习惯；避免为迎合别人忽略自身需要。',
  '行动力上升，适合有计划地运动和康复；过快、过量或忽略身体反馈容易造成消耗。',
  '恢复力与韧性较强，温和持续胜过短期猛冲；情绪压抑可能转成身体紧绷。',
  '需要独处、安静与恢复性休息，也适合进行系统检查和长期健康复盘。',
  '身体状态可能处于周期变化中，维持基础习惯并给突发波动留出缓冲。',
  '重视检查结果、剂量、指标与客观记录；在医疗问题上坚持事实而非自我判断。',
  '暂停和换角度有助于恢复；若进展停滞，应重新评估方法，不要无期限忍耐。',
  '象征旧阶段结束与身体更新，适合戒除耗损习惯；它本身不代表字面死亡。',
  '重点是平衡、代谢、补水与节奏；避免极端饮食、过度训练或忽冷忽热的生活方式。',
  '关注成瘾、强迫、过劳和欲望驱动的习惯；承认依赖模式是恢复自主的第一步。',
  '提醒突发风险、急性压力或旧问题暴露；出现严重不适时应及时寻求专业帮助。',
  '适合长期疗愈、补充水分与恢复信心；小幅而持续的改善比追求立刻痊愈更可靠。',
  '睡眠、焦虑、激素与不明感受可能互相影响；记录症状并用检查排除想象中的最坏情况。',
  '生命力、恢复与清晰度较强，适合户外活动；同时避免过度暴晒和因乐观忽视警讯。',
  '适合复诊、复盘旧病史和调整方案；身体的提醒需要被回应，而不是被自我苛责。',
  '代表一个康复或训练周期的完成与整体整合；做好收尾、复查和后续维护。',
];

type DrawnCard = Omit<TarotCard, 'reversed'> & { reversed: boolean; reversedKeywords: string };
type ClarifierCard = DrawnCard & { purpose: string; createdAt: number };
type AppView = 'daily' | 'reading' | 'library' | 'history' | 'agent';
type LibraryFilter = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles' | 'court';
type DiaryNotes = {
  initial?: string;
  outcome?: string;
  reflection?: string;
  updatedAt?: number;
};
type SavedReading = {
  id: string;
  createdAt: number;
  question: string;
  spread: Spread;
  cards: { id: number; reversed: boolean }[];
  optionA?: string;
  optionB?: string;
  kind?: 'spread' | 'daily';
  dailyMood?: string;
  notes?: DiaryNotes;
  clarifiers?: { id: number; reversed: boolean; purpose: string; createdAt: number }[];
};

type DailyEntry = {
  date: string;
  createdAt: number;
  card: { id: number; reversed: boolean };
  mood?: string;
  notes?: DiaryNotes;
};

type ChatStyle = 'gentle' | 'analytical' | 'intuitive' | 'direct';
type ReplyLength = 'brief' | 'standard' | 'deep';
type AgentMode = 'ready' | 'thinking' | 'model' | 'local';
type PendingAgentAction =
  | { type: 'clarifier'; title: string; description: string; purpose: string }
  | { type: 'switch-spread'; title: string; description: string; spread: Spread }
  | { type: 'redraw'; title: string; description: string };
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  tools?: string[];
  mode?: AgentMode;
  evidence?: string[];
};
type SavedChat = { style: ChatStyle; length?: ReplyLength; messages: ChatMessage[]; updatedAt: number };
type AgentMemory = { enabled: boolean; note: string; updatedAt?: number };
type GuidedPlan = {
  refinedQuestion: string;
  spread: Spread;
  reason: string;
  followUps: string[];
  memorySuggestion: string;
  mode?: 'model' | 'local';
};
type CloudSyncStatus = 'checking' | 'local' | 'ready' | 'syncing' | 'error';
type CloudSnapshot = {
  history: SavedReading[];
  dailyEntries: DailyEntry[];
  chats: Record<string,SavedChat>;
  memory: AgentMemory;
  updatedAt: number;
};

function mergeRecords<T>(localItems: T[], cloudItems: T[], keyOf: (item: T) => string, updatedOf: (item: T) => number) {
  const merged = new Map<string,T>();
  [...localItems,...cloudItems].forEach((item) => {
    const key = keyOf(item);
    const current = merged.get(key);
    if (!current || updatedOf(item) >= updatedOf(current)) merged.set(key,item);
  });
  return [...merged.values()].sort((first,second) => updatedOf(second) - updatedOf(first));
}

function mergeCloudSnapshots(local: CloudSnapshot, cloud: Partial<CloudSnapshot> | null): CloudSnapshot {
  if (!cloud) return local;
  const history = mergeRecords(local.history,Array.isArray(cloud.history) ? cloud.history : [],(item) => item.id,(item) => item.notes?.updatedAt || item.createdAt).slice(0,MAX_HISTORY_ITEMS);
  const dailyEntries = mergeRecords(local.dailyEntries,Array.isArray(cloud.dailyEntries) ? cloud.dailyEntries : [],(item) => item.date,(item) => item.notes?.updatedAt || item.createdAt).slice(0,MAX_DAILY_ITEMS);
  const chats = { ...local.chats };
  Object.entries(cloud.chats || {}).forEach(([key,value]) => {
    if (!chats[key] || value.updatedAt >= chats[key].updatedAt) chats[key] = value;
  });
  const trimmedChats = Object.fromEntries(Object.entries(chats).sort(([,a],[,b]) => b.updatedAt - a.updatedAt).slice(0,8));
  const cloudMemory = cloud.memory && typeof cloud.memory.note === 'string' ? cloud.memory : null;
  const memory = cloudMemory && (cloudMemory.updatedAt || 0) >= (local.memory.updatedAt || 0) ? cloudMemory : local.memory;
  return { history, dailyEntries, chats: trimmedChats, memory, updatedAt: Math.max(local.updatedAt,cloud.updatedAt || 0) };
}

function withOrientation(card: TarotCard, reversed: boolean): DrawnCard {
  const { reversed: reversedKeywords, ...cardData } = card;
  return { ...cardData, reversedKeywords, reversed };
}

const HISTORY_KEY = 'xingqi-tarot-readings-v1';
const AI_CHAT_KEY = 'xingqi-tarot-ai-chats-v1';
const AI_USAGE_KEY = 'xingqi-tarot-ai-usage-v1';
const AGENT_MEMORY_KEY = 'xingqi-tarot-agent-memory-v1';
const DAILY_TAROT_KEY = 'xingqi-tarot-daily-v1';
const DAILY_CHAT_LIMIT = 50;
const MAX_HISTORY_ITEMS = 120;
const MAX_DAILY_ITEMS = 366;
const dailyMoods = ['平静','轻盈','专注','疲惫','混乱'] as const;
const chatStyles: Record<ChatStyle, { name: string; note: string; symbol: string }> = {
  gentle: { name: '温柔陪伴', note: '先接住感受，再慢慢梳理', symbol: '☾' },
  analytical: { name: '理性解析', note: '按牌位与证据清晰拆解', symbol: '◇' },
  intuitive: { name: '直觉灵感', note: '强调意象、共鸣与内在声音', symbol: '✦' },
  direct: { name: '直言提醒', note: '坦率指出矛盾、盲点和代价', symbol: '↗' },
};
const replyLengths: Record<ReplyLength, { name: string; note: string }> = {
  brief: { name: '简短', note: '约100～200字' },
  standard: { name: '标准', note: '约300～500字' },
  deep: { name: '深度', note: '完整牌位与组合分析' },
};
const agentToolLabels: Record<string, string> = {
  spread: '读取当前牌阵',
  meanings: '检索牌义证据',
  patterns: '分析整体结构',
  links: '追踪牌组联系',
  combinations: '检索组合牌义',
  actions: '生成行动建议',
  memory: '读取本轮记忆',
  journal: '复盘塔罗日记',
  compare: '对比历史牌阵',
};
const defaultAgentTools = ['读取当前牌阵','检索牌义证据','分析整体结构','本地解读兜底'];

function cardImagePath(card: Pick<TarotCard, 'id' | 'arcana' | 'suit'>) {
  if (card.arcana !== 'minor') return `/cards/major-${String(card.id).padStart(2, '0')}.webp`;
  const suitIndex = ((card.id - 22) % 14) + 1;
  return `/cards/${card.suit}-${String(suitIndex).padStart(2, '0')}.webp`;
}

function buildChoiceQuestion(optionA: string, optionB: string) {
  const first = optionA.trim();
  const second = optionB.trim();
  if (!first && !second) return '';
  return `在“${first || '选项 A'}”与“${second || '选项 B'}”之间，我应该如何选择？`;
}

function parseChoiceQuestion(value: string) {
  const match = value.match(/^在“(.+)”与“(.+)”之间，我应该如何选择？$/);
  return match ? {
    optionA: match[1] === '选项 A' ? '' : match[1],
    optionB: match[2] === '选项 B' ? '' : match[2],
  } : null;
}

function formatDiaryDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function dateKeyWithOffset(offset: number) {
  const date = new Date();
  date.setHours(12,0,0,0);
  date.setDate(date.getDate() + offset);
  return localDateKey(date);
}

function dailyStreak(entries: DailyEntry[]) {
  const dates = new Set(entries.map((entry) => entry.date));
  let offset = dates.has(dateKeyWithOffset(0)) ? 0 : -1;
  let count = 0;
  while (dates.has(dateKeyWithOffset(offset))) {
    count += 1;
    offset -= 1;
  }
  return count;
}

const majorSymbols = [
  '白玫瑰、悬崖与小狗象征纯真、未知和冒险前的本能提醒。',
  '无限符号、四元素工具与上下相连的手势象征意志将潜能带入现实。',
  '黑白双柱、石榴帷幕与月冠象征直觉、二元世界和被遮蔽的知识。',
  '麦田、星冠与丰盛自然象征孕育、感官经验和创造生命的能力。',
  '石座、铠甲与公羊象征结构、保护、权威和稳定边界。',
  '圣殿、钥匙与两位信徒象征传统传承、共同信念和制度性学习。',
  '天使、两个人物与生命之树象征关系、价值一致和有意识的选择。',
  '双狮身人面兽、星冠与战车象征驾驭相反力量并朝同一方向前进。',
  '女人与狮子、无限符号象征温柔的勇气、本能整合和持久自制。',
  '高山、提灯与手杖象征独处求索、经验照明和谨慎前行。',
  '转轮、四方守护者与神秘符号象征周期、机缘和不可停止的变化。',
  '天平、宝剑与红袍象征事实衡量、因果责任和清晰裁决。',
  '倒悬姿态与头部光环象征主动暂停、牺牲旧视角和意识转变。',
  '白马、黑旗与升起的太阳象征不可逆的结束、净化和新阶段。',
  '两只杯、水流与一脚入水象征调和、耐心试验和身心整合。',
  '锁链、火炬与倒五芒星象征欲望、依附，以及看见束缚后拿回选择。',
  '雷击、高塔与坠落王冠象征虚假结构崩解、真相突现和被迫重建。',
  '八芒星、水流与裸身人物象征希望、疗愈、坦诚和与更大秩序连接。',
  '月、双塔、犬狼与水中生物象征潜意识、恐惧投射和信息未明。',
  '太阳、向日葵与白马上的孩子象征生命力、坦率、成功和被看见。',
  '号角、复起人物与群山象征觉醒、复盘过去和回应新的召唤。',
  '花环、四方守护者与舞者象征完成、整合、自由和循环圆满。',
];

function visualSymbolism(card: Omit<TarotCard, 'reversed'>) {
  if (card.arcana !== 'minor') return majorSymbols[card.id];
  const suitSymbols: Record<string, string> = {
    wands: '权杖与火元素强调意志、创造、行动和向外扩张。',
    cups: '圣杯与水元素强调情感、直觉、关系和接纳能力。',
    swords: '宝剑与风元素强调思想、真相、冲突和清晰判断。',
    pentacles: '星币与土元素强调金钱、身体、技能和可持续成果。',
  };
  const rankSymbol = ['侍从','骑士','王后','国王'].includes(card.rank || '')
    ? `${card.rank}代表这股元素从学习、行动、内在掌握到外在领导的成熟阶段。`
    : `${card.rank}对应这一元素在现实事件中的阶段、数量与发展节奏。`;
  return `${suitSymbols[card.suit || 'wands']} ${rankSymbol}`;
}

function combinationMeanings(card: TarotCard) {
  if (card.arcana !== 'minor') {
    return [
      `与另一张大阿卡纳同现：${card.name}所代表的课题会成为本次牌阵的重要转折，而不只是短期事件。`,
      `与权杖牌同现：把“${card.upright}”落实为主动选择、创造或行动。`,
      `与圣杯牌同现：需要观察“${card.upright}”背后的感受、关系与直觉反应。`,
    ];
  }
  const partners: Record<string, string> = {
    wands: '宝剑会让行动获得方向，圣杯过多则可能让热情与情绪互相拉扯。',
    cups: '星币能为感受提供稳定容器，权杖过强则可能让关系节奏过快。',
    swords: '权杖能把想法转成行动，星币过重则可能造成思维与现实条件的僵持。',
    pentacles: '圣杯让现实投入更有情感意义，宝剑过强则可能让安全感受到挑战。',
  };
  return [
    `与同花色牌同现：${card.suitLabel}主题被放大，“${card.upright}”会成为局面主轴。`,
    partners[card.suit || 'wands'],
    `与大阿卡纳同现：${card.name}更像重大课题在日常生活中的具体表现。`,
  ];
}

function readingStructure(drawn: DrawnCard[], spread: Spread) {
  const majorCount = drawn.filter((card) => card.arcana !== 'minor').length;
  const reversedCount = drawn.filter((card) => card.reversed).length;
  const suits = { wands: 0, cups: 0, swords: 0, pentacles: 0 };
  drawn.forEach((card) => { if (card.arcana === 'minor' && card.suit) suits[card.suit] += 1; });
  const suitEntries = Object.entries(suits) as [keyof typeof suits, number][];
  const dominant = suitEntries.sort((a,b) => b[1] - a[1])[0];
  const suitLabels = { wands: '权杖／火', cups: '圣杯／水', swords: '宝剑／风', pentacles: '星币／土' };
  const ranks = new Map<string,number>();
  drawn.forEach((card) => { if (card.rank) ranks.set(card.rank, (ranks.get(card.rank) || 0) + 1); });
  const repeats = [...ranks.entries()].filter(([,count]) => count > 1).map(([rank,count]) => `${rank}×${count}`);
  const courts = drawn.filter((card) => card.rank && ['侍从','骑士','王后','国王'].includes(card.rank)).length;
  const adjacency = drawn.slice(0,-1).map((card,index) => {
    const next = drawn[index + 1];
    if (card.arcana !== 'minor' || next.arcana !== 'minor') return `${card.name} → ${next.name}：大阿卡纳介入相邻位置，使这一步成为整组牌的关键转折。`;
    if (card.suit === next.suit) return `${card.name} → ${next.name}：同为${card.suitLabel}，能量连续并被明显加强。`;
    const supportive = new Set(['wands-swords','swords-wands','cups-pentacles','pentacles-cups']);
    const key = `${card.suit}-${next.suit}`;
    return supportive.has(key)
      ? `${card.name} → ${next.name}：${card.element}与${next.element}形成支持，前一张的课题较容易转成下一步。`
      : `${card.name} → ${next.name}：${card.element}与${next.element}存在节奏差，需要协调感受、想法与现实行动。`;
  });
  const turnIndex = drawn.findIndex((card,index) => index > 0 && (card.arcana !== 'minor' || card.reversed !== drawn[index - 1].reversed));
  const turning = drawn[Math.max(0, turnIndex)];
  const actionIndex = spread === 'career' ? 5 : spread === 'relationship' ? 5 : spread === 'celtic' ? 9 : drawn.length - 1;
  return {
    majorCount,
    reversedCount,
    suits,
    dominantLabel: dominant[1] ? suitLabels[dominant[0]] : '大阿卡纳主导',
    repeats,
    courts,
    adjacency,
    mainline: `${drawn[0].name}开启问题，${turning.name}构成主要转折，${drawn[drawn.length - 1].name}显示当前路径最可能抵达的方向。`,
    advice: guideFor(drawn[actionIndex]).action,
  };
}

function orientationNote(card: DrawnCard) {
  return card.reversed
    ? `这张牌以逆位出现，能量更可能表现为内在阻力、延迟或过度使用。关键词是“${card.reversedKeywords}”。它不是坏结果，而是在提醒你：先看见卡住能量的方式，再谈下一步。`
    : `这张牌以正位出现，核心力量正在较顺畅地表达。关键词是“${card.upright}”。它不保证事情自动成功，但说明你可以主动使用这份能量来推动局面。`;
}

function positionMeaning(card: DrawnCard, position: SpreadPosition) {
  const meaning = card.reversed ? card.reversedMeaning : card.uprightMeaning;
  const expression = card.reversed
    ? '说明这个位置的力量目前更可能以内耗、延迟、回避或过度反应的方式出现'
    : '说明这个位置的力量已经能够较直接地进入现实，需要通过行动与事实继续验证';
  return `${card.name}以${card.reversed ? '逆位' : '正位'}落在“${position.name}”，并不是通用牌义的重复。这个位置负责：${position.focus}${expression}。牌面把注意力具体落在“${activeKeywords(card)}”上；结合标准含义来看：${meaning}`;
}

function domainMeaning(card: DrawnCard, domain: Domain) {
  if (card.arcana === 'minor') return minorDomainMeaning({ ...card, reversed: card.reversedKeywords } as DeckCard, domain, card.reversed);
  const guide = cardGuides[card.id];
  const base = domain === 'health' ? majorHealth[card.id] : guide[domain];
  return card.reversed
    ? `${base} 逆位时，尤其要留意“${card.reversedKeywords}”如何让这一领域出现延迟、内耗或过度反应。`
    : `${base} 正位时，可借助“${card.upright}”把理解转成稳健行动。`;
}

function guideFor(card: DrawnCard): CardGuide {
  if (card.arcana !== 'minor') return { ...cardGuides[card.id], health: majorHealth[card.id] };
  return {
    love: domainMeaning(card, 'love'),
    career: domainMeaning(card, 'career'),
    money: domainMeaning(card, 'money'),
    health: domainMeaning(card, 'health'),
    blindspot: card.reversed
      ? `主要盲点是“${card.reversedKeywords}”。逆位并不自动等于坏结果，它更常指出能量受阻、内化、延迟或被使用过度。`
      : `正位的优势是“${card.upright}”，但任何优势推到极端都会形成盲点；请确认行动仍符合现实条件。`,
    action: `${card.message} 先选择一个能在七天内完成、且可以观察结果的具体步骤。`,
    reflect: `“${card.reversed ? card.reversedKeywords : card.upright}”正在我的现实中以什么方式出现？`,
  };
}

function synthesisText(drawn: DrawnCard[], spread: Spread) {
  if (drawn.length === 1) {
    const card = drawn[0];
    return `${card.name}把焦点放在“${card.reversed ? card.reversedKeywords : card.upright}”上。此刻最重要的不是追问一个绝对结果，而是辨认你能改变的部分，并用一次具体行动验证牌面给出的提醒。`;
  }

  const reversedCount = drawn.filter((card) => card.reversed).length;
  const energy = reversedCount === 0
    ? '本次牌阵均为正位，整体能量较外显，适合把理解转化为行动。'
    : reversedCount === drawn.length
      ? '本次牌阵均为逆位，主要课题偏向内在整理；放慢、校准与解除旧模式，比勉强推进更重要。'
      : `本次有 ${reversedCount} 张逆位牌，显示局面既有可用的推动力，也有需要先梳理的阻力。`;

  if (spread === 'three') return `从${drawn[0].name}到${drawn[1].name}，再走向${drawn[2].name}，牌面呈现一条“看见根源—回应当下—调整趋势”的路径。${energy}`;
  if (spread === 'relationship') return `你的位置是${drawn[0].name}，对方的位置是${drawn[1].name}，关系基础由${drawn[2].name}说明；真正需要结合观察的是隐藏议题${drawn[4].name}与关系需要${drawn[5].name}。${energy}`;
  if (spread === 'choice') return `牌阵以${drawn[0].name}界定决策核心。选择A由${drawn[1].name}、${drawn[2].name}与${drawn[3].name}组成；选择B由${drawn[4].name}、${drawn[5].name}与${drawn[6].name}组成。比较时请同时衡量优势、代价和趋势，而不是只挑看起来更好的结果牌。${energy}`;
  if (spread === 'career') return `职业现状由${drawn[0].name}呈现，优势${drawn[1].name}与机会${drawn[3].name}是可用资源，阻碍${drawn[2].name}和环境${drawn[4].name}说明现实限制；行动牌${drawn[5].name}是改变趋势的关键。${energy}`;
  if (spread === 'celtic') return `凯尔特十字以${drawn[0].name}描述现状，以${drawn[1].name}指出交叉挑战；潜意识根源${drawn[3].name}、外部环境${drawn[7].name}与希望恐惧${drawn[8].name}共同解释为何局面复杂，最终趋势${drawn[9].name}应作为整组牌的综合结果理解。${energy}`;
  return `年度主题由${drawn[0].name}统领，其余十二张牌分别落入十二个生活宫位。大阿卡纳出现于某一宫位时，通常表示该领域是年度重要课题；逆位较多的宫位更需要整理、修正或放慢。${energy}`;
}

type IntegratedConnection = { title: string; body: string };
type IntegratedReading = {
  verdict: string;
  story: string;
  axis: [string, string, string];
  connections: IntegratedConnection[];
  actions: { doNow: string; avoid: string; watch: string };
};

function activeKeywords(card: DrawnCard) {
  return card.reversed ? card.reversedKeywords : card.upright;
}

function cardReference(card: DrawnCard) {
  return `${card.name}${card.reversed ? '逆位' : '正位'}所代表的“${activeKeywords(card)}”`;
}

function pairInsight(first: DrawnCard, second: DrawnCard, firstPosition: string, secondPosition: string) {
  const orientation = first.reversed === second.reversed
    ? first.reversed
      ? '两张牌都以逆位出现，说明这组关系主要发生在内在阻力、延迟或尚未说出口的部分。'
      : '两张牌都以正位出现，说明前后位置之间已有较清晰的传递通道，可以通过现实行动加以验证。'
    : '一正一逆显示两个位置并不同步：一边已经能够表达，另一边仍在防御、迟疑或调整。';
  if (first.arcana !== 'minor' && second.arcana !== 'minor') {
    return `${firstPosition}的${first.name}与${secondPosition}的${second.name}都是大阿卡纳，这不是短暂情绪，而是两项重要人生课题正在互相影响。${orientation}`;
  }
  if (first.arcana === 'minor' && second.arcana === 'minor') {
    if (first.suit === second.suit) return `${firstPosition}与${secondPosition}都由${first.suitLabel}主导，同一种元素被连续强调，“${activeKeywords(first)}”会直接放大或修正“${activeKeywords(second)}”。${orientation}`;
    const supportive = new Set(['wands-swords','swords-wands','cups-pentacles','pentacles-cups']);
    const conflicting = new Set(['wands-cups','cups-wands','swords-pentacles','pentacles-swords']);
    const key = `${first.suit}-${second.suit}`;
    if (supportive.has(key)) return `${firstPosition}的${first.element}与${secondPosition}的${second.element}能够互相支持：前者提供动力或容器，后者帮助它形成表达与现实结果。${orientation}`;
    if (conflicting.has(key)) return `${firstPosition}的${first.element}与${secondPosition}的${second.element}节奏相冲，需要在“${activeKeywords(first)}”与“${activeKeywords(second)}”之间作出实际协调。${orientation}`;
  }
  return `${firstPosition}的${cardReference(first)}正在影响${secondPosition}的${cardReference(second)}。大阿卡纳提供主课题，小阿卡纳说明它如何落入日常选择。${orientation}`;
}

function integratedReading(drawn: DrawnCard[], spread: Spread, question: string): IntegratedReading {
  const structure = readingStructure(drawn, spread);
  const positions = spreadDefinitions[spread].positions;
  const reverseNote = structure.reversedCount > drawn.length / 2
    ? '整组逆位偏多，短期重点是解除内耗与校准判断，而不是强行推动结果。'
    : structure.reversedCount === 0
      ? '整组牌均为正位，可用能量较外显，但仍需要以连续行动而不是期待来兑现。'
      : `牌阵中有${structure.reversedCount}张逆位，推进力量与内在阻力同时存在，真正的转折取决于如何处理卡住的部分。`;

  let verdict = '';
  if (spread === 'single') {
    verdict = `${cardReference(drawn[0])}是本次问题的核心：先处理它指出的现实课题，再判断结果，而不是急着寻找绝对的“会”或“不会”。`;
  } else if (spread === 'three') {
    verdict = `局面正从${cardReference(drawn[0])}走向${cardReference(drawn[2])}；当前真正能改变方向的是${cardReference(drawn[1])}，所以趋势仍然可以被你的下一步行动修正。`;
  } else if (spread === 'relationship') {
    const sync = drawn[0].reversed === drawn[1].reversed
      ? drawn[0].reversed ? '双方目前都带着未处理的防御或迟疑' : '双方并非完全没有回应空间'
      : '双方当前的投入方式与表达节奏并不同步';
    verdict = `这段关系里，${sync}；${drawn[4].name}${drawn[4].reversed ? '逆位' : '正位'}揭示的隐藏议题尚未被真正解决，在${drawn[5].name}所要求的调整出现前，${drawn[6].name}${drawn[6].reversed ? '逆位' : '正位'}显示的趋势不会自动向前发展。`;
  } else if (spread === 'choice') {
    const aFriction = drawn.slice(1,4).filter((card) => card.reversed).length;
    const bFriction = drawn.slice(4,7).filter((card) => card.reversed).length;
    const comparison = aFriction === bFriction ? '两条路径的阻力数量接近，区别主要在于你愿意承担哪一种代价' : aFriction < bFriction ? '选择A目前阻力较少，但仍需接受它对应的代价' : '选择B目前阻力较少，但仍需接受它对应的代价';
    verdict = `${drawn[0].name}说明这次决定的真正核心；${comparison}。结果牌不是替你决定，而是在比较两种选择会把你带入怎样的生活。`;
  } else if (spread === 'career') {
    verdict = `当前事业的关键不是单纯等待机会：${drawn[2].name}指出主要阻碍，${drawn[3].name}给出可用窗口，而${drawn[5].name}所代表的行动能否落实，将直接决定${drawn[6].name}显示的发展趋势。`;
  } else if (spread === 'celtic') {
    verdict = `${drawn[1].name}正在交叉限制${drawn[0].name}所描述的现状；真正的转折来自${drawn[3].name}揭示的深层根源，若继续沿当前路径发展，${drawn[9].name}${drawn[9].reversed ? '逆位提醒结果仍有未完成的阻力' : '正位显示局面具备形成结果的条件'}。`;
  } else {
    verdict = `${drawn[0].name}是这一年的总主题；大阿卡纳与逆位集中的宫位会成为全年真正需要投入注意力的领域，而不是十二个宫位平均用力。`;
  }

  const questionLead = question.trim() ? `针对“${question.trim()}”，` : '从整组牌来看，';
  const story = `${questionLead}${synthesisText(drawn, spread)} ${structure.majorCount ? `其中${structure.majorCount}张大阿卡纳把问题提升到价值选择、人生阶段或长期模式层面。` : '本次以小阿卡纳为主，改变更多取决于日常沟通、资源与行动方式。'} 主导能量是${structure.dominantLabel}。${reverseNote}`;

  const pairMap: Record<Spread, [number, number][]> = {
    single: [],
    three: [[0,1],[1,2]],
    relationship: [[0,1],[2,3],[4,5],[5,6]],
    choice: [[1,2],[2,3],[4,5],[5,6],[3,6]],
    career: [[1,2],[3,4],[5,6]],
    celtic: [[0,1],[2,3],[4,5],[6,7],[8,9]],
    year: [[0,1],[0,6],[0,7],[0,10],[0,12]],
  };
  const connections: IntegratedConnection[] = pairMap[spread].map(([firstIndex,secondIndex]) => ({
    title: `${positions[firstIndex].short} × ${positions[secondIndex].short}`,
    body: pairInsight(drawn[firstIndex], drawn[secondIndex], positions[firstIndex].name, positions[secondIndex].name),
  }));
  if (spread === 'single') connections.push({ title: '核心牌与问题', body: `${cardReference(drawn[0])}需要同时从牌义、正逆位和你能够采取的现实行动理解。${drawn[0].message}` });
  if (structure.repeats.length) connections.push({ title: '重复数字／阶位', body: `${structure.repeats.join('、')}重复出现，说明同一发展阶段正在不同领域反复发生；它比单张牌的偶然性更值得留意。` });
  if (structure.courts >= 2) {
    const courtCards = drawn.filter((card) => card.rank && ['侍从','骑士','王后','国王'].includes(card.rank));
    connections.push({ title: '宫廷牌关系', body: `${courtCards.map((card) => `${card.name}${card.reversed ? '逆位' : '正位'}`).join('、')}同时出现，说明人物立场、沟通成熟度与行动方式是事件的重要变量；需要观察谁在学习、谁在行动、谁在掌控。` });
  }
  if (drawn.length > 1) connections.push({ title: '起点 × 结果', body: pairInsight(drawn[0], drawn[drawn.length - 1], positions[0].name, positions[positions.length - 1].name) });

  const actionIndex = spread === 'career' ? 5 : spread === 'relationship' ? 5 : spread === 'celtic' ? 9 : drawn.length - 1;
  const obstacleIndex = spread === 'relationship' ? 4 : spread === 'career' ? 2 : spread === 'celtic' ? 1 : spread === 'three' ? 1 : 0;
  const actionCard = drawn[actionIndex];
  const obstacleCard = drawn[obstacleIndex];
  const resultCard = drawn[drawn.length - 1];

  return {
    verdict,
    story,
    axis: [drawn[0].name, drawn[Math.floor((drawn.length - 1) / 2)].name, resultCard.name],
    connections: connections.slice(0,7),
    actions: {
      doNow: `${guideFor(actionCard).action} 这一步对应${positions[actionIndex].name}的${actionCard.name}${actionCard.reversed ? '逆位' : '正位'}。`,
      avoid: `暂时避免让“${activeKeywords(obstacleCard)}”替你作决定。${guideFor(obstacleCard).blindspot}`,
      watch: `接下来观察现实中是否连续出现与“${activeKeywords(resultCard)}”一致的行动、沟通或资源变化；一次情绪波动不能单独证明趋势已经确定。`,
    },
  };
}

function encodeReading(reading: SavedReading) {
  const bytes = new TextEncoder().encode(JSON.stringify(reading));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}

function decodeReading(value: string): SavedReading | null {
  try {
    const normalized = value.replaceAll('-','+').replaceAll('_','/');
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as SavedReading;
  } catch {
    return null;
  }
}

export default function Home() {
  const [view, setView] = useState<AppView>('reading');
  const [spread, setSpread] = useState<Spread>('single');
  const [question, setQuestion] = useState('');
  const [choiceOptionA, setChoiceOptionA] = useState('');
  const [choiceOptionB, setChoiceOptionB] = useState('');
  const [drawn, setDrawn] = useState<DrawnCard[]>([]);
  const [selectionDeck, setSelectionDeck] = useState<DrawnCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<DrawnCard[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [history, setHistory] = useState<SavedReading[]>([]);
  const [openDiaryId, setOpenDiaryId] = useState<string | null>(null);
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([]);
  const [isDailyRevealing, setIsDailyRevealing] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [libraryCardId, setLibraryCardId] = useState(0);
  const [notice, setNotice] = useState('');
  const [isSharedReading, setIsSharedReading] = useState(false);
  const [ritualStage, setRitualStage] = useState<RitualStage>('idle');
  const [revealBurst, setRevealBurst] = useState(false);
  const [isCentering, setIsCentering] = useState(false);
  const [isHoldingMoon, setIsHoldingMoon] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [chatStyle, setChatStyle] = useState<ChatStyle>('gentle');
  const [replyLength, setReplyLength] = useState<ReplyLength>('standard');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [chatRemaining, setChatRemaining] = useState(DAILY_CHAT_LIMIT);
  const [agentMode, setAgentMode] = useState<AgentMode>('ready');
  const [agentTools, setAgentTools] = useState<string[]>(defaultAgentTools);
  const [agentMemoryEnabled, setAgentMemoryEnabled] = useState(false);
  const [agentMemoryNote, setAgentMemoryNote] = useState('');
  const [agentSourceId, setAgentSourceId] = useState<string | null>(null);
  const [agentJournalEnabled, setAgentJournalEnabled] = useState(false);
  const [agentLabOpen, setAgentLabOpen] = useState(false);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [clarifiers, setClarifiers] = useState<ClarifierCard[]>([]);
  const [clarifierDeck, setClarifierDeck] = useState<DrawnCard[]>([]);
  const [clarifierPurpose, setClarifierPurpose] = useState('进一步确认当前问题');
  const [isClarifierSelecting, setIsClarifierSelecting] = useState(false);
  const [pendingAgentAction, setPendingAgentAction] = useState<PendingAgentAction | null>(null);
  const [guidedConcern, setGuidedConcern] = useState('');
  const [guidedPlan, setGuidedPlan] = useState<GuidedPlan | null>(null);
  const [isPlanningReading, setIsPlanningReading] = useState(false);
  const [guidedPlanError, setGuidedPlanError] = useState('');
  const [memorySuggestionDismissed, setMemorySuggestionDismissed] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>('checking');
  const [cloudDisplayName, setCloudDisplayName] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [skyMode, setSkyMode] = useState<SkyMode>('auto');
  const [skyPeriod, setSkyPeriod] = useState<SkyPeriod>('night');
  const fanRef = useRef<HTMLDivElement>(null);
  const fanDragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
    moved: false,
    blockClick: false,
  });
  const trailRef = useRef<HTMLCanvasElement>(null);
  const interpretationsRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const cloudSyncTimerRef = useRef<number | null>(null);
  const ritualTimersRef = useRef<number[]>([]);
  const burstTimerRef = useRef<number | null>(null);
  const holdFrameRef = useRef<number | null>(null);
  const holdStartRef = useRef(0);
  const holdCompletedRef = useRef(false);
  const spreadInfo = spreadDefinitions[spread];
  const structure = drawn.length ? readingStructure(drawn, spread) : null;
  const integrated = drawn.length ? integratedReading(drawn, spread, question) : null;
  const drawnSignature = drawn.map((card) => `${card.id}${card.reversed ? 'r' : 'u'}`).join('-');
  const clarifierSignature = clarifiers.map((card) => `${card.id}${card.reversed ? 'r' : 'u'}:${card.purpose}`).join('-');
  const agentCombinationInsights = useMemo<CombinationInsight[]>(
    () => drawn.length ? buildCombinationInsights(
      [...drawn, ...clarifiers],
      [...spreadInfo.positions.map((position) => position.name), ...clarifiers.map((card, index) => `澄清牌 ${index + 1}·${card.purpose}`)],
    ) : [],
    [drawnSignature, clarifierSignature, spread],
  );
  const fullSynthesis = integrated?.story || '';
  const oneSentenceSummary = integrated?.verdict || '';
  const readingChatKey = drawn.length
    ? `${spread}|${question.trim()}|${drawnSignature}`
    : '';
  const journeyStep = isCentering
    ? 0
    : drawn.length
    ? 4
    : isSelecting
      ? 3
      : isShuffling || ritualStage !== 'idle'
        ? 2
        : question.trim() || spread !== 'single'
          ? 1
          : 0;
  const activeSkyPeriod: SkyPeriod = skyMode === 'night' ? 'night' : skyPeriod;
  const constellationZone: ConstellationZone = view === 'reading' && (isSelecting || isShuffling || isCentering)
    ? 'selection'
    : view === 'agent'
      ? 'history'
      : view;

  const subtitle = useMemo(
    () => spreadDefinitions[spread].description,
    [spread],
  );

  const libraryCards = useMemo(() => cards.filter((card) => {
    const queryMatch = !libraryQuery.trim() || `${card.name} ${card.en} ${card.upright} ${card.reversed}`.toLowerCase().includes(libraryQuery.trim().toLowerCase());
    const filterMatch = libraryFilter === 'all'
      || (libraryFilter === 'major' && card.arcana !== 'minor')
      || (libraryFilter === 'court' && card.arcana === 'minor' && ['侍从','骑士','王后','国王'].includes(card.rank || ''))
      || (card.arcana === 'minor' && card.suit === libraryFilter);
    return queryMatch && filterMatch;
  }), [libraryQuery, libraryFilter]);

  const libraryCard = libraryCards.find((card) => card.id === libraryCardId) || libraryCards[0] || cards[0];
  const libraryOrigin = cardOrigin(libraryCard);
  const activeAgentRecord = useMemo(() => {
    if (!agentSourceId) return null;
    const record = history.find((item) => item.id === agentSourceId);
    if (!record) return null;
    const signature = record.cards.map((card) => `${card.id}${card.reversed ? 'r' : 'u'}`).join('-');
    return record.spread === spread && signature === drawnSignature ? record : null;
  }, [agentSourceId, history, spread, drawnSignature]);
  const comparisonRecords = useMemo(
    () => comparisonIds.map((id) => history.find((record) => record.id === id)).filter(Boolean) as SavedReading[],
    [comparisonIds, history],
  );
  const personalPatterns = useMemo(() => {
    const recent = history.slice(0,20);
    const cardCounts = new Map<number, number>();
    const spreadCounts = new Map<Spread, number>();
    let totalCards = 0;
    let reversedCards = 0;
    recent.forEach((record) => {
      spreadCounts.set(record.spread,(spreadCounts.get(record.spread) || 0) + 1);
      record.cards.forEach((entry) => {
        cardCounts.set(entry.id,(cardCounts.get(entry.id) || 0) + 1);
        totalCards += 1;
        if (entry.reversed) reversedCards += 1;
      });
    });
    const repeatedCards = [...cardCounts.entries()]
      .filter(([,count]) => count > 1)
      .sort((first,second) => second[1] - first[1])
      .slice(0,3)
      .map(([id,count]) => `${cards.find((card) => card.id === id)?.name || '未知牌'}×${count}`);
    const dominantSpread = [...spreadCounts.entries()].sort((first,second) => second[1] - first[1])[0];
    const reversedRate = totalCards ? Math.round(reversedCards / totalCards * 100) : 0;
    const text = recent.length
      ? `最近 ${recent.length} 次记录中，${repeatedCards.length ? `重复牌为 ${repeatedCards.join('、')}` : '暂未出现明显重复牌'}；最常使用${dominantSpread ? spreadDefinitions[dominantSpread[0]].name : '暂无牌阵'}；逆位比例约 ${reversedRate}%。`
      : '暂无足够历史记录。';
    return { recentCount: recent.length, repeatedCards, reversedRate, dominantSpread: dominantSpread ? spreadDefinitions[dominantSpread[0]].name : '暂无', text };
  }, [history]);
  const dailyDate = localDateKey();
  const todayDailyEntry = dailyEntries.find((entry) => entry.date === dailyDate);
  const todayDailyCard = todayDailyEntry
    ? (() => {
        const card = cards.find((item) => item.id === todayDailyEntry.card.id);
        return card ? withOrientation(card, todayDailyEntry.card.reversed) : null;
      })()
    : null;
  const recentDailyEntries = [...dailyEntries].sort((first, second) => second.date.localeCompare(first.date)).slice(0,7);
  const currentMonthEntries = dailyEntries.filter((entry) => entry.date.startsWith(dailyDate.slice(0,7)));
  const currentMonthReversed = currentMonthEntries.filter((entry) => entry.card.reversed).length;
  const currentDailyStreak = dailyStreak(dailyEntries);
  const todayDailyGuide = todayDailyCard ? guideFor(todayDailyCard) : null;
  const todayDailyMeaning = todayDailyCard
    ? (todayDailyCard.reversed ? todayDailyCard.reversedMeaning : todayDailyCard.uprightMeaning)
    : '';

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as SavedReading[];
      setHistory(Array.isArray(stored) ? stored.slice(0,MAX_HISTORY_ITEMS) : []);
    } catch {
      setHistory([]);
    }
    const sharedValue = new URLSearchParams(window.location.hash.slice(1)).get('reading');
    if (!sharedValue) return;
    const shared = decodeReading(sharedValue);
    if (!shared || !spreadDefinitions[shared.spread]) return;
    const restored = shared.cards.map((entry) => {
      const card = cards.find((item) => item.id === entry.id);
      return card ? withOrientation(card, Boolean(entry.reversed)) : null;
    }).filter(Boolean) as DrawnCard[];
    if (restored.length !== spreadDefinitions[shared.spread].positions.length) return;
    setSpread(shared.spread);
    setQuestion(shared.question || '');
    const sharedChoice = shared.spread === 'choice' ? parseChoiceQuestion(shared.question || '') : null;
    setChoiceOptionA(shared.optionA || sharedChoice?.optionA || '');
    setChoiceOptionB(shared.optionB || sharedChoice?.optionB || '');
    setDrawn(restored);
    setClarifiers(restoreClarifierCards(shared));
    setIsSharedReading(true);
    setView('reading');
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(DAILY_TAROT_KEY) || '[]') as DailyEntry[];
      setDailyEntries(Array.isArray(stored) ? stored.slice(0,MAX_DAILY_ITEMS) : []);
    } catch {
      setDailyEntries([]);
    }
  }, []);

  useEffect(() => {
    const storedMode = localStorage.getItem(SKY_MODE_KEY);
    if (storedMode === 'auto' || storedMode === 'night') setSkyMode(storedMode);
    const updatePeriod = () => setSkyPeriod(skyPeriodFor());
    updatePeriod();
    const timer = window.setInterval(updatePeriod,60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const usage = JSON.parse(localStorage.getItem(AI_USAGE_KEY) || '{}') as { date?: string; count?: number };
      const used = usage.date === todayKey() && Number.isFinite(usage.count) ? Number(usage.count) : 0;
      setChatRemaining(Math.max(0, DAILY_CHAT_LIMIT - used));
    } catch {
      setChatRemaining(DAILY_CHAT_LIMIT);
    }
  }, []);

  useEffect(() => {
    try {
      const memory = JSON.parse(localStorage.getItem(AGENT_MEMORY_KEY) || '{}') as Partial<AgentMemory>;
      setAgentMemoryEnabled(memory.enabled === true);
      setAgentMemoryNote(typeof memory.note === 'string' ? memory.note.slice(0,1200) : '');
    } catch {
      setAgentMemoryEnabled(false);
      setAgentMemoryNote('');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCloudState = async () => {
      setCloudSyncStatus('checking');
      try {
        const response = await fetch('/api/cloud-state',{ headers: { Accept: 'application/json' } });
        if (response.status === 401) {
          if (!cancelled) setCloudSyncStatus('local');
          return;
        }
        if (!response.ok) throw new Error('cloud unavailable');
        const payload = await response.json() as { user?: { displayName?: string }; state?: Partial<CloudSnapshot> | null };
        const parse = <T,>(key: string, fallback: T): T => {
          try { return JSON.parse(localStorage.getItem(key) || '') as T; } catch { return fallback; }
        };
        const local: CloudSnapshot = {
          history: parse<SavedReading[]>(HISTORY_KEY,[]),
          dailyEntries: parse<DailyEntry[]>(DAILY_TAROT_KEY,[]),
          chats: parse<Record<string,SavedChat>>(AI_CHAT_KEY,{}),
          memory: parse<AgentMemory>(AGENT_MEMORY_KEY,{ enabled: false, note: '', updatedAt: 0 }),
          updatedAt: Date.now(),
        };
        const merged = mergeCloudSnapshots(local,payload.state || null);
        localStorage.setItem(HISTORY_KEY,JSON.stringify(merged.history));
        localStorage.setItem(DAILY_TAROT_KEY,JSON.stringify(merged.dailyEntries));
        localStorage.setItem(AI_CHAT_KEY,JSON.stringify(merged.chats));
        localStorage.setItem(AGENT_MEMORY_KEY,JSON.stringify(merged.memory));
        if (cancelled) return;
        setHistory(merged.history);
        setDailyEntries(merged.dailyEntries);
        setAgentMemoryEnabled(merged.memory.enabled === true);
        setAgentMemoryNote(merged.memory.note.slice(0,1200));
        setCloudDisplayName(payload.user?.displayName || '已登录');
        setCloudReady(true);
        setCloudSyncStatus('ready');
      } catch {
        if (!cancelled) setCloudSyncStatus('error');
      }
    };
    void loadCloudState();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!cloudReady) return;
    if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
    cloudSyncTimerRef.current = window.setTimeout(async () => {
      setCloudSyncStatus('syncing');
      let chats: Record<string,SavedChat> = {};
      try { chats = JSON.parse(localStorage.getItem(AI_CHAT_KEY) || '{}') as Record<string,SavedChat>; } catch { chats = {}; }
      const state: CloudSnapshot = {
        history: history.slice(0,MAX_HISTORY_ITEMS),
        dailyEntries: dailyEntries.slice(0,MAX_DAILY_ITEMS),
        chats,
        memory: { enabled: agentMemoryEnabled, note: agentMemoryNote, updatedAt: Date.now() },
        updatedAt: Date.now(),
      };
      try {
        const response = await fetch('/api/cloud-state',{ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) });
        if (!response.ok) throw new Error('sync failed');
        setCloudSyncStatus('ready');
      } catch {
        setCloudSyncStatus('error');
      }
    },1400);
    return () => {
      if (cloudSyncTimerRef.current !== null) window.clearTimeout(cloudSyncTimerRef.current);
    };
  }, [cloudReady,history,dailyEntries,agentMemoryEnabled,agentMemoryNote,chatMessages,chatStyle]);

  useEffect(() => {
    setChatError('');
    setChatInput('');
    setAgentJournalEnabled(false);
    if (!readingChatKey) {
      setChatMessages([]);
      setChatStyle('gentle');
      setReplyLength('standard');
      return;
    }
    try {
      const chats = JSON.parse(localStorage.getItem(AI_CHAT_KEY) || '{}') as Record<string, SavedChat>;
      const saved = chats[readingChatKey];
      const plannedOpener: ChatMessage[] = guidedPlan?.followUps?.length
        ? [{
            id: `guided-${Date.now()}`,
            role: 'assistant',
            content: `牌已经展开了。在继续解读前，我想先确认一件事：${guidedPlan.followUps[0]}${guidedPlan.followUps[1] ? `\n\n如果你愿意，也可以一起告诉我：${guidedPlan.followUps[1]}` : ''}`,
            createdAt: Date.now(),
            tools: ['整理问题', '推荐牌阵', '读取当前牌阵'],
            mode: 'local',
          }]
        : [];
      setChatMessages(Array.isArray(saved?.messages) ? saved.messages.slice(-30) : plannedOpener);
      setChatStyle(saved?.style && saved.style in chatStyles ? saved.style : 'gentle');
      setReplyLength(saved?.length && saved.length in replyLengths ? saved.length : 'standard');
    } catch {
      setChatMessages([]);
      setChatStyle('gentle');
      setReplyLength('standard');
    }
  }, [readingChatKey]);

  useEffect(() => {
    if (!chatMessages.length) return;
    chatEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }, [chatMessages.length]);

  useEffect(() => {
    if (!drawn.length) return;
    const scrollTimer = window.setTimeout(() => {
      const readingStart = interpretationsRef.current;
      if (!readingStart) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const headerOffset = window.innerWidth <= 560 ? 78 : 96;
      const targetTop = readingStart.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: reducedMotion ? 'auto' : 'smooth' });
    }, 380);
    return () => window.clearTimeout(scrollTimer);
  }, [readingChatKey]);

  useEffect(() => {
    if (!isSelecting || !fanRef.current) return;
    const fan = fanRef.current;
    fan.scrollLeft = Math.max(0, (fan.scrollWidth - fan.clientWidth) / 2);
  }, [isSelecting, selectionDeck]);

  useEffect(() => {
    const canvas = trailRef.current;
    if (!canvas) return;
    if (isSelecting) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    if (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = canvas.getContext('2d')!;
    if (!context) return;

    type ConstellationNode = { px: number; py: number; size: number; drift: number };
    type TrailParticle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; hue: number };
    const nodes: ConstellationNode[] = Array.from({ length: 18 }, (_, index) => ({
      px: ((index * 47 + 11) % 97) / 100,
      py: ((index * 71 + 7) % 91) / 100,
      size: .65 + (index % 4) * .3,
      drift: index * .73,
    }));
    let particles: TrailParticle[] = [];
    let animationFrame = 0;
    let animationRunning = false;
    let activeUntil = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let lastX = -100;
    let lastY = -100;
    let lastSpawn = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.15);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const ensureAnimation = () => {
      if (animationRunning || document.hidden) return;
      animationRunning = true;
      animationFrame = window.requestAnimationFrame(paint);
    };

    const addTrail = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      const now = performance.now();
      activeUntil = now + 480;
      if (now - lastSpawn < 20) {
        ensureAnimation();
        return;
      }
      const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      const count = Math.min(2, Math.max(1, Math.ceil(distance / 30)));
      for (let index = 0; index < count; index += 1) {
        const progress = count === 1 ? 1 : index / (count - 1);
        const life = 22 + secureRandomIndex(14);
        particles.push({
          x: lastX < 0 ? event.clientX : lastX + (event.clientX - lastX) * progress,
          y: lastY < 0 ? event.clientY : lastY + (event.clientY - lastY) * progress,
          vx: (secureRandomIndex(100) - 50) / 220,
          vy: -.12 - secureRandomIndex(35) / 180,
          life,
          maxLife: life,
          size: 1.1 + secureRandomIndex(16) / 10,
          hue: secureRandomIndex(5) === 0 ? 267 : 42 + secureRandomIndex(10),
        });
      }
      particles = particles.slice(-34);
      lastX = event.clientX;
      lastY = event.clientY;
      lastSpawn = now;
      ensureAnimation();
    };

    function paint(time: number) {
      context.clearRect(0, 0, width, height);
      const constellationOpacity = Math.max(0, Math.min(1, (activeUntil - time) / 220));
      if (constellationOpacity > 0) {
        const points = nodes.map((node) => ({
          x: node.px * width + Math.sin(time / 6500 + node.drift) * 3,
          y: node.py * height + Math.cos(time / 7800 + node.drift) * 3,
          size: node.size,
        }));
        for (let first = 0; first < points.length; first += 1) {
          const a = points[first];
          const distanceA = Math.hypot(a.x - lastX, a.y - lastY);
          if (distanceA > 210) continue;
          for (let second = first + 1; second < points.length; second += 1) {
            const b = points[second];
            const nodeDistance = Math.hypot(a.x - b.x, a.y - b.y);
            if (nodeDistance > 140 || Math.hypot(b.x - lastX, b.y - lastY) > 210) continue;
            const opacity = (1 - distanceA / 210) * (1 - nodeDistance / 155) * constellationOpacity;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.strokeStyle = `rgba(188,164,235,${Math.max(0, opacity) * .32})`;
            context.lineWidth = .55;
            context.stroke();
          }
        }
        points.forEach((point) => {
          const awake = Math.max(0, 1 - Math.hypot(point.x - lastX, point.y - lastY) / 195) * constellationOpacity;
          if (awake <= 0) return;
          context.beginPath();
          context.arc(point.x, point.y, point.size + awake, 0, Math.PI * 2);
          context.fillStyle = `rgba(244,221,170,${awake * .65})`;
          context.fill();
        });
      }

      context.globalCompositeOperation = 'lighter';
      particles.forEach((particle) => {
        const opacity = Math.max(0, particle.life / particle.maxLife);
        const radius = particle.size * (.45 + opacity * .55);
        context.beginPath();
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        context.fillStyle = `hsla(${particle.hue}, 78%, 76%, ${opacity * .68})`;
        context.shadowColor = `hsla(${particle.hue}, 86%, 72%, ${opacity})`;
        context.shadowBlur = 9 * opacity;
        context.fill();
        if (particle.size > 2.35 && opacity > .42) {
          context.beginPath();
          context.moveTo(particle.x - radius * 2.2, particle.y);
          context.lineTo(particle.x + radius * 2.2, particle.y);
          context.moveTo(particle.x, particle.y - radius * 2.2);
          context.lineTo(particle.x, particle.y + radius * 2.2);
          context.strokeStyle = `hsla(${particle.hue}, 90%, 86%, ${opacity * .38})`;
          context.lineWidth = .55;
          context.stroke();
        }
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += .004;
        particle.life -= 1;
      });
      particles = particles.filter((particle) => particle.life > 0);
      context.shadowBlur = 0;
      context.globalCompositeOperation = 'source-over';
      if (particles.length || time < activeUntil) {
        animationFrame = window.requestAnimationFrame(paint);
      } else {
        animationRunning = false;
      }
    }

    const pauseWhenHidden = () => {
      if (!document.hidden) return;
      particles = [];
      activeUntil = 0;
      animationRunning = false;
      window.cancelAnimationFrame(animationFrame);
      context.clearRect(0, 0, width, height);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', addTrail, { passive: true });
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', addTrail);
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [isSelecting]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }

  function toggleSkyMode() {
    const nextMode: SkyMode = skyMode === 'auto' ? 'night' : 'auto';
    setSkyMode(nextMode);
    localStorage.setItem(SKY_MODE_KEY,nextMode);
    showNotice(nextMode === 'auto' ? '背景已跟随本地时间' : '背景已固定为夜间星空');
  }

  function todayKey() {
    return localDateKey();
  }

  function saveChat(messages: ChatMessage[], style = chatStyle, length = replyLength) {
    if (!readingChatKey) return;
    try {
      const chats = JSON.parse(localStorage.getItem(AI_CHAT_KEY) || '{}') as Record<string, SavedChat>;
      chats[readingChatKey] = { style, length, messages: messages.slice(-30), updatedAt: Date.now() };
      const trimmed = Object.fromEntries(
        Object.entries(chats)
          .sort(([, first], [, second]) => second.updatedAt - first.updatedAt)
          .slice(0, 8),
      );
      localStorage.setItem(AI_CHAT_KEY, JSON.stringify(trimmed));
    } catch {
      // Private browsing or a full storage quota should not block the live chat.
    }
  }

  function chooseChatStyle(style: ChatStyle) {
    setChatStyle(style);
    saveChat(chatMessages, style, replyLength);
  }

  function chooseReplyLength(length: ReplyLength) {
    setReplyLength(length);
    saveChat(chatMessages, chatStyle, length);
  }

  function saveAgentMemory(enabled: boolean, note: string) {
    setAgentMemoryEnabled(enabled);
    setAgentMemoryNote(note);
    try {
      localStorage.setItem(AGENT_MEMORY_KEY, JSON.stringify({ enabled, note, updatedAt: Date.now() } satisfies AgentMemory));
    } catch {
      // The controls remain usable even if this browser blocks local storage.
    }
  }

  function clearAgentMemory() {
    if (!agentMemoryNote.trim()) {
      showNotice('当前没有需要删除的长期记忆');
      return;
    }
    if (!window.confirm('确定删除智能体记住的全部背景吗？此操作会同步到云端。')) return;
    saveAgentMemory(false,'');
    showNotice('长期记忆已删除');
  }

  async function planGuidedReading() {
    const concern = guidedConcern.trim();
    if (concern.length < 4) {
      setGuidedPlanError('先用一两句话说说最近最困扰你的事情。');
      return;
    }
    setIsPlanningReading(true);
    setGuidedPlanError('');
    try {
      const response = await fetch('/api/tarot-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concern }),
      });
      const payload = await response.json().catch(() => null) as (GuidedPlan & { error?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.error || '暂时没能整理好这个问题，请再试一次。');
      setGuidedPlan(payload);
      setMemorySuggestionDismissed(false);
    } catch (error) {
      setGuidedPlanError(error instanceof Error ? error.message : '暂时没能整理好这个问题，请再试一次。');
    } finally {
      setIsPlanningReading(false);
    }
  }

  function acceptGuidedPlan() {
    if (!guidedPlan) return;
    setSpread(guidedPlan.spread);
    setQuestion(guidedPlan.refinedQuestion.slice(0, 180));
    setChoiceOptionA('');
    setChoiceOptionB('');
    setDrawn([]);
    setClarifiers([]);
    setPendingAgentAction(null);
    setIsClarifierSelecting(false);
    setSelectionDeck([]);
    setSelectedCards([]);
    setIsSelecting(false);
    setAgentSourceId(null);
    setChatMessages([]);
    setView('reading');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotice(`已采用${spreadDefinitions[guidedPlan.spread].name}，现在可以开始抽牌`);
  }

  function confirmGuidedMemory() {
    const suggestion = guidedPlan?.memorySuggestion.trim();
    if (!suggestion) return;
    const current = agentMemoryNote.trim();
    const next = current.includes(suggestion) ? current : [current, suggestion].filter(Boolean).join('\n');
    saveAgentMemory(true, next.slice(0, 1200));
    setMemorySuggestionDismissed(true);
    showNotice('已在你确认后写入长期记忆');
  }

  function currentAnswerEvidence() {
    const cardEvidence = drawn.slice(0, 7).map((card, index) => `${spreadInfo.positions[index]?.name || `牌位 ${index + 1}`}｜${card.name}·${card.reversed ? '逆位' : '正位'}：${card.reversed ? card.reversedMeaning : card.uprightMeaning}`);
    const clarifierEvidence = clarifiers.map((card, index) => `澄清牌 ${index + 1}｜${card.purpose}｜${card.name}·${card.reversed ? '逆位' : '正位'}：${card.reversed ? card.reversedMeaning : card.uprightMeaning}`);
    const combinationEvidence = agentCombinationInsights.slice(0, 5).map((item) => `组合知识库｜${item.title}：${item.evidence}${item.meaning}`);
    return [...cardEvidence, ...clarifierEvidence, ...combinationEvidence];
  }

  function toggleComparisonReading(id: string) {
    setComparisonIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) {
        showNotice('一次最多对比 3 条记录');
        return current;
      }
      return [...current,id];
    });
  }

  function clearChat() {
    setChatMessages([]);
    setChatInput('');
    setChatError('');
    setPendingAgentAction(null);
    setIsClarifierSelecting(false);
    setClarifierDeck([]);
    setAgentMode('ready');
    setAgentTools(defaultAgentTools);
    if (!readingChatKey) return;
    try {
      const chats = JSON.parse(localStorage.getItem(AI_CHAT_KEY) || '{}') as Record<string, SavedChat>;
      delete chats[readingChatKey];
      localStorage.setItem(AI_CHAT_KEY, JSON.stringify(chats));
    } catch {
      // The visible conversation is still cleared even if storage is unavailable.
    }
    showNotice('本次 AI 对话已从这台设备清除');
  }

  function consumeLocalChatQuota(serverRemaining?: number) {
    let used = 0;
    try {
      const saved = JSON.parse(localStorage.getItem(AI_USAGE_KEY) || '{}') as { date?: string; count?: number };
      used = saved.date === todayKey() && Number.isFinite(saved.count) ? Number(saved.count) : 0;
      const serverUsed = Number.isFinite(serverRemaining)
        ? DAILY_CHAT_LIMIT - Math.max(0, Math.min(DAILY_CHAT_LIMIT, Number(serverRemaining)))
        : 0;
      used = Math.min(DAILY_CHAT_LIMIT, Math.max(used + 1, serverUsed));
      localStorage.setItem(AI_USAGE_KEY, JSON.stringify({ date: todayKey(), count: used }));
    } catch {
      const localUsed = DAILY_CHAT_LIMIT - chatRemaining + 1;
      const serverUsed = Number.isFinite(serverRemaining)
        ? DAILY_CHAT_LIMIT - Math.max(0, Math.min(DAILY_CHAT_LIMIT, Number(serverRemaining)))
        : 0;
      used = Math.min(DAILY_CHAT_LIMIT, Math.max(localUsed, serverUsed));
    }
    setChatRemaining(Math.max(0, DAILY_CHAT_LIMIT - used));
  }

  function appendLocalAgentExchange(userText: string, assistantText: string, tools = ['识别站内操作']) {
    const next: ChatMessage[] = [
      ...chatMessages,
      { id: crypto.randomUUID(), role: 'user', content: userText, createdAt: Date.now() },
      { id: crypto.randomUUID(), role: 'assistant', content: assistantText, createdAt: Date.now(), tools, mode: 'local' },
    ].slice(-30);
    setChatMessages(next);
    saveChat(next);
    return next;
  }

  function cardIndexFromMessage(message: string) {
    const chinese: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3, 五: 4, 六: 5, 七: 6, 八: 7, 九: 8, 十: 9, 十一: 10, 十二: 11, 十三: 12 };
    const chineseMatch = message.match(/第([一二三四五六七八九十]{1,2})张/);
    if (chineseMatch && chinese[chineseMatch[1]] !== undefined) return chinese[chineseMatch[1]];
    const numberMatch = message.match(/第\s*(\d{1,2})\s*张/);
    return numberMatch ? Math.max(0, Number(numberMatch[1]) - 1) : 0;
  }

  function spreadFromMessage(message: string): Spread | null {
    const aliases: Array<[RegExp, Spread]> = [
      [/年度|十二宫/, 'year'], [/凯尔特|十字/, 'celtic'], [/感情|关系牌阵/, 'relationship'],
      [/二选一|选择牌阵/, 'choice'], [/事业|职业牌阵/, 'career'], [/三牌|三张牌/, 'three'], [/单牌|一张牌/, 'single'],
    ];
    return aliases.find(([pattern]) => pattern.test(message))?.[1] || null;
  }

  function handleAgentActionRequest(message: string) {
    if (view !== 'agent') return false;
    if (/(保存|写入).*(日记|记录)|把.*(对话|这次).*(存|记)/.test(message)) {
      const next = appendLocalAgentExchange(message, '已经把这次牌阵和对话整理好了，现在写进塔罗日记。', ['保存塔罗日记']);
      window.setTimeout(() => saveAgentSummary(next), 0);
      return true;
    }
    if (/(打开|查看).*(牌库|百科)/.test(message)) {
      const index = cardIndexFromMessage(message);
      const target = [...drawn, ...clarifiers][index];
      if (!target) {
        appendLocalAgentExchange(message, `目前只有 ${drawn.length + clarifiers.length} 张牌，我找不到你说的那一张。`);
        return true;
      }
      appendLocalAgentExchange(message, `我已经找到${target.name}${target.reversed ? '逆位' : '正位'}，现在带你去看它的牌面、来源和完整牌义。`, ['打开78张牌库']);
      setLibraryCardId(target.id);
      setLibraryQuery('');
      setLibraryFilter('all');
      setView('library');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    }
    const isClarifierExplanation = /(?:解释|解读|分析|结合).{0,12}澄清牌|澄清牌.{0,12}(?:解释|解读|分析|修正|没有改变)/.test(message);
    if (!isClarifierExplanation && /(?:补抽|再抽一张|抽.{0,8}澄清牌)/.test(message)) {
      if (clarifiers.length >= 3) {
        appendLocalAgentExchange(message, '这次已经有三张澄清牌了。再继续补抽会让主线变乱，我建议先把现有信息说清楚。');
        return true;
      }
      const purpose = message.replace(/请|帮我|想|要|再|补抽|抽|一张|澄清牌|看看|。|！|？/g, '').trim() || '进一步确认当前问题';
      setPendingAgentAction({ type: 'clarifier', title: '补抽一张澄清牌', description: '澄清牌会补充原牌阵，但不会替换任何原牌。确认后仍由你亲手选择。', purpose });
      setChatMessages((current) => {
        const next: ChatMessage[] = [...current, { id: crypto.randomUUID(), role: 'user', content: message, createdAt: Date.now() }].slice(-30);
        saveChat(next);
        return next;
      });
      return true;
    }
    const nextSpread = spreadFromMessage(message);
    if (nextSpread && /(换|改|切换|使用).*(牌阵|三牌|单牌|凯尔特|十二宫|感情|事业|二选一)/.test(message)) {
      setPendingAgentAction({ type: 'switch-spread', title: `切换为${spreadDefinitions[nextSpread].name}`, description: '切换牌阵会结束当前牌面的继续解读，但现有记录仍保留在塔罗日记。', spread: nextSpread });
      setChatMessages((current) => {
        const next: ChatMessage[] = [...current, { id: crypto.randomUUID(), role: 'user', content: message, createdAt: Date.now() }].slice(-30);
        saveChat(next);
        return next;
      });
      return true;
    }
    if (/(重新抽牌|重抽|重新洗牌)/.test(message)) {
      setPendingAgentAction({ type: 'redraw', title: '保留问题并重新抽牌', description: '当前牌面不会被覆盖，已经保存的日记仍然可以查看。确认后会重新进入洗牌流程。' });
      setChatMessages((current) => {
        const next: ChatMessage[] = [...current, { id: crypto.randomUUID(), role: 'user', content: message, createdAt: Date.now() }].slice(-30);
        saveChat(next);
        return next;
      });
      return true;
    }
    return false;
  }

  function startClarifierSelection(purpose: string) {
    const used = new Set([...drawn, ...clarifiers].map((card) => card.id));
    const candidates = shuffledDeck().filter((card) => !used.has(card.id)).slice(0,12);
    setClarifierPurpose(purpose || '进一步确认当前问题');
    setClarifierDeck(candidates);
    setIsClarifierSelecting(true);
    setPendingAgentAction(null);
  }

  function chooseClarifier(card: DrawnCard) {
    if (clarifiers.length >= 3 || clarifiers.some((item) => item.id === card.id)) return;
    const clarifier: ClarifierCard = { ...card, purpose: clarifierPurpose, createdAt: Date.now() };
    const nextClarifiers = [...clarifiers, clarifier].slice(0,3);
    setClarifiers(nextClarifiers);
    setIsClarifierSelecting(false);
    setClarifierDeck([]);
    if (activeAgentRecord) {
      setHistory((current) => {
        const next = current.map((record) => record.id === activeAgentRecord.id ? {
          ...record,
          clarifiers: nextClarifiers.map((item) => ({ id: item.id, reversed: item.reversed, purpose: item.purpose, createdAt: item.createdAt })),
          notes: { ...record.notes, updatedAt: Date.now() },
        } : record);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      });
    }
    const meaning = clarifier.reversed ? clarifier.reversedMeaning : clarifier.uprightMeaning;
    const unchanged = integrated?.verdict
      ? `它不会推翻原牌阵的核心判断：“${integrated.verdict}”`
      : '它不会替换原牌阵，也不能单独变成一个新的结果。';
    const nextMessages: ChatMessage[] = [...chatMessages, {
      id: crypto.randomUUID(), role: 'assistant', createdAt: Date.now(), mode: 'local', tools: ['抽取澄清牌', '读取标准牌义'],
      content: `澄清对象：${clarifier.purpose}\n\n直接补充：${clarifier.name}·${clarifier.reversed ? '逆位' : '正位'}把注意力放在“${meaning}”。\n\n${unchanged} 点击下方“结合原牌阵解读”，我会继续说明它具体修正了哪一部分。`,
    }].slice(-30);
    setChatMessages(nextMessages);
    saveChat(nextMessages);
  }

  function confirmAgentAction() {
    const action = pendingAgentAction;
    if (!action) return;
    if (action.type === 'clarifier') {
      startClarifierSelection(action.purpose);
      return;
    }
    setPendingAgentAction(null);
    if (action.type === 'switch-spread') {
      changeSpread(action.spread);
      setView('reading');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showNotice(`已切换为${spreadDefinitions[action.spread].name}`);
      return;
    }
    setView('reading');
    window.requestAnimationFrame(() => startRitual());
  }

  function clarifierAnalysisPrompt() {
    const list = clarifiers.map((card, index) =>
      `${index + 1}. ${card.name}·${card.reversed ? '逆位' : '正位'}，澄清“${card.purpose}”`,
    ).join('\n');
    return `只解释已经抽出的澄清牌，不要继续抽牌，也不要建议再抽一张。\n${list}\n\n请明确回答四件事：\n1. 每张牌具体在澄清什么；\n2. 它给出的直接补充是什么；\n3. 它修正或收窄了原牌阵哪一部分；\n4. 原牌阵中哪些核心判断没有改变。\n如果证据不足以改变原结论，请直接说“没有足够依据改变原结论”，不要硬凑。`;
  }

  async function sendChat(prefilled?: string, options?: { retry?: boolean; bypassActions?: boolean }) {
    const lastUserIndex = options?.retry ? chatMessages.findLastIndex((item) => item.role === 'user') : -1;
    const retryMessage = lastUserIndex >= 0 ? chatMessages[lastUserIndex].content : '';
    const message = (prefilled ?? (retryMessage || chatInput)).trim();
    if (!message || isChatStreaming || !drawn.length) return;
    if (!options?.retry && !options?.bypassActions && handleAgentActionRequest(message)) {
      setChatInput('');
      return;
    }
    if (chatRemaining <= 0) {
      setChatError(`今天的 ${DAILY_CHAT_LIMIT} 次 AI 对话已经用完，明天会自动恢复。`);
      return;
    }

    const conversationSeed = lastUserIndex >= 0 ? chatMessages.slice(0,lastUserIndex) : chatMessages;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: message, createdAt: Date.now() };
    const assistantId = crypto.randomUUID();
    const baseMessages = [...conversationSeed, userMessage];
    const abortController = new AbortController();
    let assistantText = '';
    let responseMode: AgentMode = 'model';
    let toolLabels = defaultAgentTools;
    chatAbortRef.current = abortController;
    setChatMessages([...baseMessages, { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() }]);
    setChatInput('');
    setChatError('');
    setIsChatStreaming(true);
    setAgentMode('thinking');
    setAgentTools(['正在读取牌阵','正在整理牌义','正在分析关系']);

    try {
      const response = await fetch('/api/tarot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          message,
          style: chatStyle,
          length: replyLength,
          history: conversationSeed.slice(-8).map(({ role, content }) => ({ role, content })),
          context: {
            question,
            spread: { name: spreadInfo.name, positions: spreadInfo.positions.map((position) => position.name) },
            cards: [...drawn.map((card, index) => {
              const guide = guideFor(card);
              const origin = cardOrigin(card);
              return {
                id: card.id,
                name: card.name,
                englishName: card.en,
                arcana: card.arcana === 'minor' ? '小阿卡纳' : '大阿卡纳',
                suit: card.suitLabel || card.suit || '',
                rank: card.rank || '',
                element: card.element || '',
                orientation: card.reversed ? '逆位' : '正位',
                position: spreadInfo.positions[index].name,
                keywords: card.reversed ? card.reversedKeywords : card.upright,
                meaning: card.reversed ? card.reversedMeaning : card.uprightMeaning,
                focus: spreadInfo.positions[index].focus,
                symbolism: visualSymbolism(card),
                domains: { love: guide.love, career: guide.career, money: guide.money, health: guide.health || '' },
                origin: `${origin.historicalName}；${origin.waiteSmith}`,
              };
            }), ...clarifiers.map((card, index) => {
              const guide = guideFor(card);
              const origin = cardOrigin(card);
              return {
                id: card.id,
                name: card.name,
                englishName: card.en,
                arcana: card.arcana === 'minor' ? '小阿卡纳' : '大阿卡纳',
                suit: card.suitLabel || card.suit || '',
                rank: card.rank || '',
                element: card.element || '',
                orientation: card.reversed ? '逆位' : '正位',
                position: `澄清牌 ${index + 1}·${card.purpose}`,
                keywords: card.reversed ? card.reversedKeywords : card.upright,
                meaning: card.reversed ? card.reversedMeaning : card.uprightMeaning,
                focus: `只用于澄清“${card.purpose}”，不得替换原牌阵结论`,
                symbolism: visualSymbolism(card),
                domains: { love: guide.love, career: guide.career, money: guide.money, health: guide.health || '' },
                origin: `${origin.historicalName}；${origin.waiteSmith}`,
              };
            })],
            synthesis: fullSynthesis,
            verdict: integrated?.verdict || '',
            connections: integrated?.connections.map((connection) => `${connection.title}：${connection.body}`) || [],
            combinations: agentCombinationInsights.map((item) => ({
              title: item.title,
              cards: item.cards,
              evidence: item.evidence,
              meaning: item.meaning,
            })),
            actions: integrated?.actions || null,
            energy: structure
              ? `大阿卡纳 ${structure.majorCount}/${drawn.length}；正位 ${drawn.length - structure.reversedCount}，逆位 ${structure.reversedCount}；主导元素 ${structure.dominantLabel}；主线：${structure.mainline}`
              : '',
            memory: agentMemoryEnabled ? {
              enabled: true,
              note: agentMemoryNote.trim(),
              patterns: personalPatterns.text,
            } : { enabled: false },
            journal: agentJournalEnabled && activeAgentRecord ? {
              date: formatDiaryDate(activeAgentRecord.createdAt),
              initial: activeAgentRecord.notes?.initial || '',
              outcome: activeAgentRecord.notes?.outcome || '',
              reflection: activeAgentRecord.notes?.reflection || '',
            } : null,
            comparisons: comparisonRecords.map((record) => ({
              date: formatDiaryDate(record.createdAt),
              question: record.question,
              spread: spreadDefinitions[record.spread].name,
              cards: record.cards.map((entry) => {
                const card = cards.find((item) => item.id === entry.id);
                return `${card?.name || '未知牌'}${entry.reversed ? '·逆位' : '·正位'}`;
              }),
              reflection: record.notes?.reflection || record.notes?.outcome || '',
            })),
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (response.status === 429) setChatRemaining(0);
        throw new Error(payload?.error || 'AI 暂时没有回应，请稍后再试。');
      }

      const serverRemainingHeader = response.headers.get('X-RateLimit-Remaining');
      const serverRemaining = serverRemainingHeader === null ? undefined : Number(serverRemainingHeader);
      consumeLocalChatQuota(Number.isFinite(serverRemaining) ? serverRemaining : undefined);

      responseMode = response.headers.get('X-Agent-Mode') === 'local' ? 'local' : 'model';
      const returnedTools = (response.headers.get('X-Agent-Tools') || '')
        .split(',')
        .map((tool) => agentToolLabels[tool])
        .filter((tool): tool is string => Boolean(tool));
      toolLabels = returnedTools.length ? returnedTools : defaultAgentTools;
      setAgentMode(responseMode);
      setAgentTools(toolLabels);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('当前浏览器无法读取流式回复。');
      const decoder = new TextDecoder();
      let lastRenderedAt = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        const now = performance.now();
        if (now - lastRenderedAt >= 140) {
          lastRenderedAt = now;
          setChatMessages([
            ...baseMessages,
            { id: assistantId, role: 'assistant', content: assistantText, createdAt: Date.now() },
          ]);
        }
      }

      assistantText += decoder.decode();
      if (!assistantText.trim()) throw new Error('AI 没有返回可读取的内容，请重试。');
      const localMarker = '【本地解读】';
      const usedLocalFallback = responseMode === 'local' || assistantText.trimStart().startsWith(localMarker);
      const displayText = assistantText.trimStart().startsWith(localMarker)
        ? assistantText.trimStart().slice(localMarker.length).trimStart()
        : assistantText;
      const finalMode: AgentMode = usedLocalFallback ? 'local' : 'model';
      const answerEvidence = currentAnswerEvidence();
      setAgentMode(finalMode);
      const completed = [
        ...baseMessages,
        { id: assistantId, role: 'assistant' as const, content: displayText, createdAt: Date.now(), tools: toolLabels, mode: finalMode, evidence: answerEvidence },
      ];
      setChatMessages(completed);
      saveChat(completed);
    } catch (error) {
      if (abortController.signal.aborted) {
        const partial = assistantText.trim();
        const answerEvidence = currentAnswerEvidence();
        const stoppedMessages = partial
          ? [...baseMessages, { id: assistantId, role: 'assistant' as const, content: partial, createdAt: Date.now(), tools: toolLabels, mode: responseMode, evidence: answerEvidence }]
          : baseMessages;
        setChatMessages(stoppedMessages);
        setChatError('已停止生成。你可以继续追问，或重新生成上一条回答。');
        setAgentMode(partial ? responseMode : 'ready');
        saveChat(stoppedMessages);
      } else {
        setChatMessages(baseMessages);
        setChatError(error instanceof Error ? error.message : 'AI 对话暂时不可用，请稍后再试。');
        setAgentMode('ready');
        setAgentTools(defaultAgentTools);
        saveChat(baseMessages);
      }
    } finally {
      if (chatAbortRef.current === abortController) chatAbortRef.current = null;
      setIsChatStreaming(false);
    }
  }

  function stopChat() {
    chatAbortRef.current?.abort();
  }

  function retryLastChat() {
    const lastUser = [...chatMessages].reverse().find((item) => item.role === 'user');
    if (!lastUser) {
      showNotice('还没有可以重新生成的问题');
      return;
    }
    void sendChat(lastUser.content,{ retry: true });
  }

  function tiltCard(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = (event.clientX - rect.left) / rect.width;
    const vertical = (event.clientY - rect.top) / rect.height;
    event.currentTarget.style.setProperty('--tilt-x', `${(vertical - .5) * -7}deg`);
    event.currentTarget.style.setProperty('--tilt-y', `${(horizontal - .5) * 8}deg`);
    event.currentTarget.style.setProperty('--glare-x', `${horizontal * 100}%`);
    event.currentTarget.style.setProperty('--glare-y', `${vertical * 100}%`);
  }

  function resetCardTilt(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.style.removeProperty('--tilt-x');
    event.currentTarget.style.removeProperty('--tilt-y');
    event.currentTarget.style.removeProperty('--glare-x');
    event.currentTarget.style.removeProperty('--glare-y');
  }

  function changeSpread(nextSpread: Spread) {
    setGuidedPlan(null);
    setSpread(nextSpread);
    setDrawn([]);
    setClarifiers([]);
    setPendingAgentAction(null);
    setIsClarifierSelecting(false);
    if (nextSpread === 'choice') {
      const parsed = parseChoiceQuestion(question);
      setChoiceOptionA(parsed?.optionA || '');
      setChoiceOptionB(parsed?.optionB || '');
      setQuestion(parsed ? question : '');
    } else if (spread === 'choice') {
      setChoiceOptionA('');
      setChoiceOptionB('');
      setQuestion('');
    }
  }

  function chooseQuestionExample(example: string) {
    setQuestion(example);
  }

  function updateChoiceOption(target: 'A' | 'B', value: string) {
    const nextA = target === 'A' ? value : choiceOptionA;
    const nextB = target === 'B' ? value : choiceOptionB;
    if (target === 'A') setChoiceOptionA(value);
    else setChoiceOptionB(value);
    setQuestion(buildChoiceQuestion(nextA, nextB));
  }

  function makeReading(cardList: DrawnCard[], createdAt = Date.now()): SavedReading {
    return {
      id: `${createdAt}-${Math.random().toString(36).slice(2,8)}`,
      createdAt,
      question,
      spread,
      cards: cardList.map((card) => ({ id: card.id, reversed: card.reversed })),
      clarifiers: clarifiers.map((card) => ({ id: card.id, reversed: card.reversed, purpose: card.purpose, createdAt: card.createdAt })),
      optionA: spread === 'choice' ? choiceOptionA.trim() : undefined,
      optionB: spread === 'choice' ? choiceOptionB.trim() : undefined,
    };
  }

  function restoreClarifierCards(record: SavedReading): ClarifierCard[] {
    return (record.clarifiers || []).slice(0,3).map((entry) => {
      const card = cards.find((item) => item.id === entry.id);
      return card ? { ...withOrientation(card, Boolean(entry.reversed)), purpose: entry.purpose || '进一步确认当前问题', createdAt: entry.createdAt || record.createdAt } : null;
    }).filter(Boolean) as ClarifierCard[];
  }

  function persistReading(cardList = drawn) {
    if (!cardList.length) return;
    const record = makeReading(cardList);
    const signature = record.cards.map((card) => `${card.id}${card.reversed ? 'r' : 'u'}`).join('-');
    const duplicate = history.find((item) => item.spread === record.spread && item.question === record.question && item.cards.map((card) => `${card.id}${card.reversed ? 'r' : 'u'}`).join('-') === signature);
    if (duplicate) {
      setAgentSourceId(duplicate.id);
    } else {
      const next = [record, ...history].slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setHistory(next);
      setAgentSourceId(record.id);
    }
    showNotice('本次解读已保存到这台设备');
  }

  function restoreReading(record: SavedReading) {
    const restored = record.cards.map((entry) => {
      const card = cards.find((item) => item.id === entry.id);
      return card ? withOrientation(card, entry.reversed) : null;
    }).filter(Boolean) as DrawnCard[];
    if (restored.length !== spreadDefinitions[record.spread].positions.length) return;
    setSpread(record.spread);
    setQuestion(record.question);
    const restoredChoice = record.spread === 'choice' ? parseChoiceQuestion(record.question) : null;
    setChoiceOptionA(record.optionA || restoredChoice?.optionA || '');
    setChoiceOptionB(record.optionB || restoredChoice?.optionB || '');
    setDrawn(restored);
    setClarifiers(restoreClarifierCards(record));
    setAgentSourceId(record.id);
    setAgentJournalEnabled(false);
    setGuidedPlan(null);
    setIsSharedReading(false);
    setView('reading');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function loadAgentReading(record: SavedReading) {
    const restored = record.cards.map((entry) => {
      const card = cards.find((item) => item.id === entry.id);
      return card ? withOrientation(card, entry.reversed) : null;
    }).filter(Boolean) as DrawnCard[];
    if (restored.length !== spreadDefinitions[record.spread].positions.length) return;
    setSpread(record.spread);
    setQuestion(record.question);
    const restoredChoice = record.spread === 'choice' ? parseChoiceQuestion(record.question) : null;
    setChoiceOptionA(record.optionA || restoredChoice?.optionA || '');
    setChoiceOptionB(record.optionB || restoredChoice?.optionB || '');
    setDrawn(restored);
    setClarifiers(restoreClarifierCards(record));
    setAgentSourceId(record.id);
    setAgentJournalEnabled(false);
    setGuidedPlan(null);
    setIsSharedReading(false);
    setView('agent');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function copyChatTranscript() {
    if (!chatMessages.length) {
      showNotice('当前还没有可以复制的对话');
      return;
    }
    const transcript = chatMessages
      .map((message) => `${message.role === 'assistant' ? '星契智能体' : '我'}：\n${message.content}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(transcript);
      showNotice('智能体对话已复制');
    } catch {
      showNotice('复制失败，请长按对话文字复制');
    }
  }

  function saveAgentSummary(messages = chatMessages) {
    const usefulMessages = messages.filter((item) => item.content.trim());
    if (!usefulMessages.some((item) => item.role === 'assistant')) {
      showNotice('还没有可以保存的智能体对话');
      return;
    }
    const time = new Intl.DateTimeFormat('zh-CN',{ month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    const transcript = usefulMessages.map((item) => `${item.role === 'assistant' ? '星契' : '我'}：${item.content.trim()}`).join('\n\n');
    const summary = `【智能体对话 ${time}】\n${transcript.slice(-1500)}`;
    if (activeAgentRecord) {
      const previous = activeAgentRecord.notes?.reflection?.trim();
      updateDiaryNote(activeAgentRecord.id,'reflection',`${previous ? `${previous}\n\n` : ''}${summary}`.slice(-1800));
      showNotice('本次对话已保存到这条塔罗日记');
      return;
    }
    const record = makeReading(drawn);
    const savedRecord: SavedReading = { ...record, notes: { reflection: summary, updatedAt: Date.now() } };
    setHistory((current) => {
      const next = [savedRecord,...current].slice(0,MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_KEY,JSON.stringify(next));
      return next;
    });
    setAgentSourceId(savedRecord.id);
    setAgentJournalEnabled(false);
    showNotice('本次牌阵与智能体对话已保存到塔罗日记');
  }

  function removeHistory(id: string) {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    if (openDiaryId === id) setOpenDiaryId(null);
    if (agentSourceId === id) setAgentSourceId(null);
    setComparisonIds((current) => current.filter((item) => item !== id));
  }

  function updateDiaryNote(id: string, field: 'initial' | 'outcome' | 'reflection', value: string) {
    setHistory((current) => {
      const next = current.map((item) => item.id === id ? {
        ...item,
        notes: { ...item.notes, [field]: value, updatedAt: Date.now() },
      } : item);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    if (id.startsWith('daily-')) {
      const date = id.slice(6);
      setDailyEntries((current) => {
        const next = current.map((entry) => entry.date === date ? {
          ...entry,
          notes: { ...entry.notes, [field]: value, updatedAt: Date.now() },
        } : entry);
        localStorage.setItem(DAILY_TAROT_KEY, JSON.stringify(next));
        return next;
      });
    }
  }

  function drawDailyCard() {
    if (todayDailyEntry || isDailyRevealing) return;
    const card = cards[secureRandomIndex(cards.length)];
    const reversed = secureRandomIndex(2) === 1;
    const createdAt = Date.now();
    const entry: DailyEntry = {
      date: dailyDate,
      createdAt,
      card: { id: card.id, reversed },
    };
    const record: SavedReading = {
      id: `daily-${dailyDate}`,
      createdAt,
      question: '今天我最需要留意什么？',
      spread: 'single',
      kind: 'daily',
      cards: [{ id: card.id, reversed }],
    };
    setIsDailyRevealing(true);
    setDailyEntries((current) => {
      if (current.some((item) => item.date === dailyDate)) return current;
      const next = [entry, ...current].slice(0,MAX_DAILY_ITEMS);
      localStorage.setItem(DAILY_TAROT_KEY, JSON.stringify(next));
      return next;
    });
    setHistory((current) => {
      if (current.some((item) => item.id === record.id)) return current;
      const next = [record, ...current].slice(0,MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    window.setTimeout(() => setIsDailyRevealing(false), 900);
  }

  function updateDailyMood(mood: string) {
    if (!todayDailyEntry) return;
    setDailyEntries((current) => {
      const next = current.map((entry) => entry.date === dailyDate ? { ...entry, mood } : entry);
      localStorage.setItem(DAILY_TAROT_KEY, JSON.stringify(next));
      return next;
    });
    setHistory((current) => {
      const next = current.map((item) => item.id === `daily-${dailyDate}` ? { ...item, dailyMood: mood } : item);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateDailyNote(field: 'initial' | 'outcome' | 'reflection', value: string) {
    if (!todayDailyEntry) return;
    const updatedAt = Date.now();
    setDailyEntries((current) => {
      const next = current.map((entry) => entry.date === dailyDate ? {
        ...entry,
        notes: { ...entry.notes, [field]: value, updatedAt },
      } : entry);
      localStorage.setItem(DAILY_TAROT_KEY, JSON.stringify(next));
      return next;
    });
    setHistory((current) => {
      const next = current.map((item) => item.id === `daily-${dailyDate}` ? {
        ...item,
        notes: { ...item.notes, [field]: value, updatedAt },
      } : item);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function readingText() {
    if (!drawn.length) return '';
    const structure = readingStructure(drawn, spread);
    const whole = integratedReading(drawn, spread, question);
    const cardSections = drawn.map((card,index) => {
      const position = spreadInfo.positions[index];
      return `${String(index + 1).padStart(2,'0')} · ${position.name}｜${card.name}（${card.reversed ? '逆位' : '正位'}）\n关键词：${card.reversed ? card.reversedKeywords : card.upright}\n${positionMeaning(card, position)}\n爱情：${domainMeaning(card,'love')}\n事业：${domainMeaning(card,'career')}\n财运：${domainMeaning(card,'money')}\n健康：${domainMeaning(card,'health')}`;
    });
    const connectionText = whole.connections.map((connection) => `${connection.title}：${connection.body}`).join('\n');
    return `星契 Tarot｜${spreadInfo.name}\n${question ? `问题：${question}\n` : ''}\n一句话结论：${whole.verdict}\n\n整体故事：${whole.story}\n\n关键牌组联系：\n${connectionText}\n\n能量结构：大阿卡纳 ${structure.majorCount}/${drawn.length}，逆位 ${structure.reversedCount}/${drawn.length}，主导元素 ${structure.dominantLabel}。\n\n行动建议：\n现在适合做：${whole.actions.doNow}\n暂时避免：${whole.actions.avoid}\n接下来观察：${whole.actions.watch}\n\n牌位解读：\n${cardSections.join('\n\n')}\n\n塔罗呈现的是当下能量与可能路径，不替代现实证据与专业建议。`;
  }

  async function copyFullReading() {
    await navigator.clipboard.writeText(readingText());
    showNotice('完整解读已复制');
  }

  async function copyShareLink() {
    if (!drawn.length) return;
    const record = makeReading(drawn);
    const link = `${window.location.origin}${window.location.pathname}#reading=${encodeReading(record)}`;
    await navigator.clipboard.writeText(link);
    showNotice('只读分享链接已复制');
  }

  async function exportShareImage() {
    if (!drawn.length) return;
    const structure = readingStructure(drawn, spread);
    const columns = Math.min(5, drawn.length);
    const rows = Math.ceil(drawn.length / columns);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 650 + rows * 275;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#120c1d';
    context.fillRect(0,0,canvas.width,canvas.height);
    const glow = context.createRadialGradient(540,260,30,540,260,650);
    glow.addColorStop(0,'rgba(118,72,137,.26)'); glow.addColorStop(1,'rgba(18,12,29,0)');
    context.fillStyle = glow; context.fillRect(0,0,canvas.width,canvas.height);
    context.strokeStyle = 'rgba(213,174,104,.45)'; context.lineWidth = 2; context.strokeRect(34,34,1012,canvas.height-68);
    context.fillStyle = '#d5ae68'; context.font = '700 22px Arial'; context.fillText('✦ 星契 TAROT',70,92);
    context.fillStyle = '#f4ead7'; context.font = '52px Georgia, serif'; context.fillText(spreadInfo.name,70,166);
    context.fillStyle = '#aa9bb8'; context.font = '24px Arial';
    const date = new Date().toLocaleString('zh-CN',{year:'numeric',month:'long',day:'numeric'});
    context.fillText(`${date} · ${drawn.length} 张牌`,70,210);
    if (question) { context.fillStyle = '#d9cbb9'; context.font = '24px Georgia, serif'; context.fillText(`问：${question.slice(0,34)}`,70,258); }
    context.fillStyle = '#c6b8c9'; context.font = '22px Georgia, serif';
    const summary = `大阿卡纳 ${structure.majorCount}/${drawn.length} · 逆位 ${structure.reversedCount}/${drawn.length} · 主导 ${structure.dominantLabel}`;
    context.fillText(summary,70,question ? 312 : 270);
    const startY = question ? 370 : 330;
    const cardWidth = 142, cardHeight = 245, gap = 34;
    const rowWidth = columns * cardWidth + (columns - 1) * gap;
    const startX = (canvas.width - rowWidth) / 2;
    const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve,reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
    const images = await Promise.all(drawn.map((card) => loadImage(cardImagePath(card))));
    images.forEach((image,index) => {
      const column = index % columns, row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gap), y = startY + row * 275;
      context.save();
      if (drawn[index].reversed) { context.translate(x + cardWidth/2,y + cardHeight/2); context.rotate(Math.PI); context.drawImage(image,-cardWidth/2,-cardHeight/2,cardWidth,cardHeight); }
      else context.drawImage(image,x,y,cardWidth,cardHeight);
      context.restore();
      context.fillStyle = '#f4ead7'; context.font = '18px Arial'; context.textAlign = 'center';
      context.fillText(`${index+1}. ${drawn[index].name}${drawn[index].reversed ? '·逆' : ''}`,x+cardWidth/2,y+cardHeight+25);
    });
    context.textAlign = 'left'; context.fillStyle = '#d5ae68'; context.font = '700 21px Arial';
    const footerY = startY + rows * 275 + 45;
    context.fillText('牌阵主线',70,footerY);
    context.fillStyle = '#c6b8c9'; context.font = '21px Georgia, serif';
    const line = structure.mainline.length > 42 ? `${structure.mainline.slice(0,42)}…` : structure.mainline;
    context.fillText(line,70,footerY+38);
    context.fillStyle = '#6f6379'; context.font = '16px Arial'; context.fillText('塔罗用于自我反思，不替代医疗、法律或投资等专业建议。',70,canvas.height-72);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve,'image/png'));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `星契塔罗-${spreadInfo.name}-${Date.now()}.png`; anchor.click();
    URL.revokeObjectURL(url);
    showNotice('分享图已生成');
  }

  function secureRandomIndex(upperBound: number) {
    const range = 0x100000000;
    const unbiasedLimit = range - (range % upperBound);
    const value = new Uint32Array(1);
    do window.crypto.getRandomValues(value); while (value[0] >= unbiasedLimit);
    return value[0] % upperBound;
  }

  function secureShuffle<T>(items: T[]) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = secureRandomIndex(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function shuffledDeck() {
    const shuffledCards = secureShuffle(cards);
    return shuffledCards.map((card) => withOrientation(card, secureRandomIndex(2) === 1));
  }

  function clearRitualTimers() {
    ritualTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    ritualTimersRef.current = [];
  }

  function completeRitual() {
    clearRitualTimers();
    setSelectionDeck(shuffledDeck());
    setIsSelecting(true);
    setIsShuffling(false);
    setRitualStage('idle');
  }

  function cancelMoonHold() {
    if (holdCompletedRef.current) return;
    if (holdFrameRef.current) window.cancelAnimationFrame(holdFrameRef.current);
    holdFrameRef.current = null;
    holdStartRef.current = 0;
    setIsHoldingMoon(false);
    setHoldProgress(0);
  }

  function startRitual() {
    if (holdFrameRef.current) window.cancelAnimationFrame(holdFrameRef.current);
    holdFrameRef.current = null;
    holdStartRef.current = 0;
    setIsCentering(false);
    setIsHoldingMoon(false);
    setHoldProgress(0);
    clearRitualTimers();
    setIsShuffling(true);
    setRitualStage('gathering');
    setDrawn([]);
    setClarifiers([]);
    setPendingAgentAction(null);
    setIsClarifierSelecting(false);
    setSelectedCards([]);
    setIsSharedReading(false);
    setRevealBurst(false);
    ritualTimersRef.current = [
      window.setTimeout(() => setRitualStage('shuffling'), 850),
      window.setTimeout(() => setRitualStage('opening'), 1850),
      window.setTimeout(completeRitual, 2850),
    ];
  }

  function drawCards() {
    if (spread === 'choice' && (!choiceOptionA.trim() || !choiceOptionB.trim())) {
      showNotice('请先写下选项 A 和选项 B');
      return;
    }
    holdCompletedRef.current = false;
    setHoldProgress(0);
    setIsHoldingMoon(false);
    setIsCentering(true);
  }

  function beginMoonHold() {
    if (holdStartRef.current || holdCompletedRef.current) return;
    holdStartRef.current = performance.now();
    setIsHoldingMoon(true);
    const tick = (now: number) => {
      const progress = Math.min(100, ((now - holdStartRef.current) / 1800) * 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        holdCompletedRef.current = true;
        holdStartRef.current = 0;
        holdFrameRef.current = null;
        setIsHoldingMoon(false);
        startRitual();
        return;
      }
      holdFrameRef.current = window.requestAnimationFrame(tick);
    };
    holdFrameRef.current = window.requestAnimationFrame(tick);
  }

  function closeCentering() {
    cancelMoonHold();
    setIsCentering(false);
  }

  function selectCard(card: DrawnCard) {
    const targetCount = spreadDefinitions[spread].positions.length;
    setSelectedCards((current) => {
      if (current.length >= targetCount || current.some((selected) => selected.id === card.id)) return current;
      return [...current, card];
    });
  }

  function beginFanDrag(event: ReactPointerEvent<HTMLDivElement>) {
    // Touch devices use the browser's momentum scrolling. Keeping the custom
    // pointer drag mouse-only avoids Safari treating the card buttons as a
    // captured gesture and blocking horizontal swipes.
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    const fan = event.currentTarget;
    fanDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: fan.scrollLeft,
      moved: false,
      blockClick: false,
    };
  }

  function moveFanDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = fanDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) > 4) {
      if (!drag.moved) {
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add('is-dragging');
      }
      drag.moved = true;
      drag.blockClick = true;
    }
    if (!drag.moved) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = drag.scrollLeft - distance;
  }

  function endFanDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = fanDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;
    drag.active = false;
    event.currentTarget.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      fanDragRef.current.blockClick = false;
    }, 0);
  }

  function reshuffleSelection() {
    setSelectedCards([]);
    setSelectionDeck(shuffledDeck());
  }

  function cancelSelection() {
    setIsSelecting(false);
    setSelectionDeck([]);
    setSelectedCards([]);
    setRitualStage('idle');
    setIsShuffling(false);
  }

  function revealSelection() {
    if (selectedCards.length !== spreadInfo.positions.length) return;
    setDrawn(selectedCards);
    persistReading(selectedCards);
    setIsSelecting(false);
    setSelectionDeck([]);
    setSelectedCards([]);
    setRevealBurst(true);
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    burstTimerRef.current = window.setTimeout(() => setRevealBurst(false), 2200);
    if (guidedPlan) {
      window.setTimeout(() => {
        setView('agent');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 900);
    }
  }

  function reset() {
    setDrawn([]);
    setClarifiers([]);
    setPendingAgentAction(null);
    setIsClarifierSelecting(false);
    setClarifierDeck([]);
    setQuestion('');
    setChoiceOptionA('');
    setChoiceOptionB('');
    setSelectionDeck([]);
    setSelectedCards([]);
    setIsSelecting(false);
    setIsSharedReading(false);
    setRitualStage('idle');
    setIsShuffling(false);
    setRevealBurst(false);
    setIsCentering(false);
    setGuidedPlan(null);
    setGuidedPlanError('');
    setMemorySuggestionDismissed(false);
    cancelMoonHold();
  }

  function renderAgentOperationPanels() {
    return <>
      {pendingAgentAction && <section className="agent-action-confirm" aria-live="polite">
        <div className="agent-action-icon"><Sparkles aria-hidden="true" /></div>
        <div><span>智能体准备执行</span><h4>{pendingAgentAction.title}</h4><p>{pendingAgentAction.description}</p>{pendingAgentAction.type === 'clarifier' && <small>本次澄清：{pendingAgentAction.purpose}</small>}</div>
        <div className="agent-action-buttons"><button type="button" onClick={() => setPendingAgentAction(null)}><X />取消</button><button type="button" onClick={confirmAgentAction}><Check />确认执行</button></div>
      </section>}

      {isClarifierSelecting && <section className="agent-clarifier-picker" aria-label="选择澄清牌">
        <div className="agent-clarifier-heading"><div><span>CLARIFYING CARD</span><h4>选择一张澄清牌</h4><p>它只补充“{clarifierPurpose}”，不会替换原牌阵。</p></div><button type="button" onClick={() => { setIsClarifierSelecting(false); setClarifierDeck([]); }}><X />暂不抽取</button></div>
        <div className="agent-clarifier-deck" role="group" aria-label="十二张澄清牌背">
          {clarifierDeck.map((card, index) => <button type="button" key={`clarifier-choice-${card.id}`} onClick={() => chooseClarifier(card)} aria-label={`选择第${index + 1}张澄清牌`}><span className="picker-card-inner"><span className="picker-sun">☀</span><span className="picker-seal">✦</span><span className="picker-moon">☾</span></span></button>)}
        </div>
      </section>}

      {clarifiers.length > 0 && <section className="agent-clarifier-results" aria-label="已抽取的澄清牌">
        <div className="agent-clarifier-results-heading"><div><span>澄清牌 · {clarifiers.length}/3</span><p>这些牌只修正对应问题，不会覆盖原牌阵。</p></div>{clarifiers.length < 3 && <button type="button" onClick={() => setPendingAgentAction({ type: 'clarifier', title: '再补抽一张澄清牌', description: '新牌会作为额外证据加入当前对话，确认后由你亲手选择。', purpose: '继续澄清当前牌阵尚未说清的部分' })}><Plus />再抽一张</button>}</div>
        <div className="agent-clarifier-cards">{clarifiers.map((card, index) => <article key={`clarifier-result-${card.id}`}><div><img className={card.reversed ? 'is-reversed' : ''} src={cardImagePath(card)} alt={`${card.name}${card.reversed ? '逆位' : '正位'}牌面`} /></div><span>澄清牌 {index + 1}</span><b>{card.name} · {card.reversed ? '逆位' : '正位'}</b><small>{card.purpose}</small></article>)}</div>
        <button className="agent-clarifier-analyze" type="button" onClick={() => void sendChat(clarifierAnalysisPrompt(), { bypassActions: true })} disabled={isChatStreaming || chatRemaining <= 0}><Sparkles />结合原牌阵解读澄清牌</button>
      </section>}
    </>;
  }

  useEffect(() => () => {
    clearRitualTimers();
    if (burstTimerRef.current) window.clearTimeout(burstTimerRef.current);
    if (holdFrameRef.current) window.cancelAnimationFrame(holdFrameRef.current);
  }, []);

  return (
    <main className={`site-canvas view-${view} sky-${activeSkyPeriod} min-h-screen overflow-hidden ${isSelecting ? 'selection-active' : ''}`}>
      <div className="time-sky" aria-hidden="true" />
      <canvas ref={trailRef} className="sky-effects" aria-hidden="true" />
      <div className="stars" aria-hidden="true">
        {twinkleStars.map((style, index) => <span className={`twinkle-star ${index % 9 === 0 ? 'star-cross' : ''}`} style={style} key={`star-${index}`} />)}
      </div>
      <ConstellationField zone={constellationZone} />
      <header className="site-header">
        <a href="#top" className="brand" aria-label="星契塔罗首页" onClick={() => setView('reading')}>
          <span className="brand-mark">✦</span><span>星契</span><span className="brand-en">TAROT</span>
        </a>
        <div className="header-actions">
          <nav className="site-nav" aria-label="主要功能">
            <button className={view === 'daily' ? 'active' : ''} onClick={() => setView('daily')}><Sunrise aria-hidden="true" />每日塔罗</button>
            <button className={view === 'reading' ? 'active' : ''} onClick={() => setView('reading')}><MoonStar aria-hidden="true" />抽牌</button>
            <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><BookOpen aria-hidden="true" />牌库</button>
            <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><Clock3 aria-hidden="true" />日记</button>
            <button className={view === 'agent' ? 'active' : ''} onClick={() => setView('agent')}><Bot aria-hidden="true" />智能体</button>
          </nav>
          <button type="button" className="sky-mode-toggle" onClick={toggleSkyMode} aria-pressed={skyMode === 'night'} title={skyMode === 'auto' ? '当前随本地时间变化，点击固定夜间' : '当前固定夜间，点击跟随本地时间'}>
            <MoonStar aria-hidden="true" /><span>{skyMode === 'auto' ? '自动' : '夜间'}</span>
          </button>
        </div>
      </header>

      {view === 'reading' && (
        <nav className="moon-journey" aria-label="抽牌进度">
          <ol>
            {moonJourney.map((step, index) => (
              <li className={`${index === journeyStep ? 'current' : ''} ${index < journeyStep ? 'complete' : ''}`} aria-current={index === journeyStep ? 'step' : undefined} key={step.label}>
                <span className={`phase-moon phase-${step.phase}`} aria-hidden="true" />
                <small>{step.label}</small>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {notice && <div className="site-notice" role="status">{notice}</div>}
      {view === 'daily' && (
        <section className="daily-shell" id="daily">
          <div className="daily-heading">
            <div>
              <p className="eyebrow"><span /> ONE CARD FOR TODAY</p>
              <h1>每日塔罗</h1>
              <p>每天只抽一张牌。它不会替你决定今天，而是帮你看见值得留意的情绪、行动与现实信号。</p>
            </div>
            <div className="daily-date-seal"><span>{dailyDate.slice(5).replace('-','.')}</span><small>{dailyDate.slice(0,4)}</small></div>
          </div>

          <div className="daily-stats" aria-label="每日塔罗记录">
            <div><b>{currentDailyStreak}</b><span>连续记录</span></div>
            <div><b>{currentMonthEntries.length}</b><span>本月牌数</span></div>
            <div><b>{currentMonthReversed}</b><span>本月逆位</span></div>
          </div>

          {!todayDailyCard ? (
            <div className="daily-draw-panel">
              <div className="daily-orbit" aria-hidden="true"><i /><i /><span>☾</span></div>
              <p>安静几秒，想一想：今天我最需要留意什么？</p>
              <button type="button" className="daily-deck-button" onClick={drawDailyCard} disabled={isDailyRevealing} aria-label="抽取今天的塔罗牌">
                <span className="daily-card-back"><i>☀</i><b>✦</b><i>☾</i></span>
                <strong>{isDailyRevealing ? '正在翻开…' : '抽取今日之牌'}</strong>
              </button>
              <small>牌面采用完整78张韦特体系 · 正逆位各50% · 今天抽出后不可重抽</small>
            </div>
          ) : (
            <div className={`daily-reading ${isDailyRevealing ? 'is-revealing' : ''}`} aria-live="polite">
              <div className="daily-card-column">
                <p>YOUR CARD OF THE DAY</p>
                <div className={`daily-card-image ${todayDailyCard.reversed ? 'is-reversed' : ''}`}>
                  <img src={cardImagePath(todayDailyCard)} alt={`${todayDailyCard.name}${todayDailyCard.reversed ? '逆位' : '正位'}牌面`} />
                </div>
                <span>{todayDailyCard.reversed ? '逆位' : '正位'}</span>
              </div>
              <div className="daily-reading-copy">
                <p className="daily-reading-date">{dailyDate.replaceAll('-','.')} · 今日主题</p>
                <h2>{todayDailyCard.name}</h2>
                <p className="daily-keywords">{todayDailyCard.reversed ? todayDailyCard.reversedKeywords : todayDailyCard.upright}</p>
                <blockquote>{todayDailyMeaning}</blockquote>
                <div className="daily-guidance-grid">
                  <section><span>今天适合</span><p>{todayDailyGuide?.action}</p></section>
                  <section><span>暂时避免</span><p>{todayDailyGuide?.blindspot}</p></section>
                  <section><span>留意信号</span><p>{todayDailyGuide?.reflect}</p></section>
                </div>
              </div>
            </div>
          )}

          {todayDailyCard && <>
            <section className="daily-domains">
              <div className="daily-section-title"><span>01</span><div><h2>今天的四个生活提醒</h2><p>同一张牌进入不同生活领域，会呈现不同的观察重点。</p></div></div>
              <div>
                <article><span>爱情与关系</span><p>{domainMeaning(todayDailyCard,'love')}</p></article>
                <article><span>事业与学业</span><p>{domainMeaning(todayDailyCard,'career')}</p></article>
                <article><span>财运与资源</span><p>{domainMeaning(todayDailyCard,'money')}</p></article>
                <article><span>健康与身心</span><p>{domainMeaning(todayDailyCard,'health')}</p></article>
              </div>
            </section>

            <section className="daily-reflection">
              <div className="daily-section-title"><span>02</span><div><h2>把今天留在日记里</h2><p>可以现在写第一感受，也可以晚上回来补充。内容会自动保存到当前设备。</p></div></div>
              <div className="daily-mood-row"><span>此刻状态</span><div>{dailyMoods.map((mood) => <button type="button" className={todayDailyEntry?.mood === mood ? 'active' : ''} onClick={() => updateDailyMood(mood)} key={mood}>{mood}</button>)}</div></div>
              <div className="daily-note-grid">
                <label htmlFor="daily-note-initial"><span>第一感受</span><small>看到这张牌时，脑中最先出现了什么？</small><Textarea id="daily-note-initial" value={todayDailyEntry?.notes?.initial || ''} maxLength={800} onChange={(event) => updateDailyNote('initial',event.target.value)} placeholder="不必解释，先记下最直接的感觉……" /></label>
                <label htmlFor="daily-note-outcome"><span>今天发生了什么</span><small>现实中出现了哪些与牌面呼应或相反的信号？</small><Textarea id="daily-note-outcome" value={todayDailyEntry?.notes?.outcome || ''} maxLength={800} onChange={(event) => updateDailyNote('outcome',event.target.value)} placeholder="晚上回来，写下今天真实发生的事……" /></label>
                <label htmlFor="daily-note-reflection"><span>现在回看</span><small>这张牌真正提醒你的，也许是什么？</small><Textarea id="daily-note-reflection" value={todayDailyEntry?.notes?.reflection || ''} maxLength={800} onChange={(event) => updateDailyNote('reflection',event.target.value)} placeholder="我现在对今天有了怎样不同的理解……" /></label>
              </div>
            </section>
          </>}

          <section className="daily-recent">
            <div className="daily-section-title"><span>03</span><div><h2>最近七天</h2><p>{recentDailyEntries.length ? '观察重复出现的牌、花色与正逆位，而不是只看单日结果。' : '抽出第一张每日牌后，时间轨迹会从这里开始。'}</p></div></div>
            {recentDailyEntries.length ? <div className="daily-week-strip">{recentDailyEntries.map((entry) => {
              const card = cards.find((item) => item.id === entry.card.id);
              return card ? <button type="button" onClick={() => setView('history')} key={entry.date}><small>{entry.date.slice(5).replace('-','.')}</small><span className={entry.card.reversed ? 'is-reversed' : ''}><img src={cardImagePath(card)} alt="" /></span><b>{card.name}</b><i>{entry.card.reversed ? '逆位' : '正位'}</i></button> : null;
            })}</div> : <div className="daily-week-empty">七日星轨尚未点亮</div>}
          </section>
        </section>
      )}
      {view === 'reading' && (
      <section id="top" className={`reading-shell ${isSelecting ? 'selecting-mode' : ''}`}>
        {isCentering && (
          <div className={`centering-overlay ${isHoldingMoon ? 'is-holding' : ''}`} role="dialog" aria-modal="true" aria-labelledby="centering-title">
            <div className="centering-stars" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i style={{ '--center-star': index } as CSSProperties} key={`center-star-${index}`} />)}</div>
            <div className="centering-content">
              <p className="centering-eyebrow">A MOMENT OF STILLNESS</p>
              <h2 id="centering-title">闭上眼睛，默念你的问题</h2>
              <p>不必寻找所谓正确的感觉。让呼吸慢下来，当你准备好时，按住中央的月亮。</p>
              <button
                type="button"
                className="hold-moon"
                style={{ '--hold-progress': `${holdProgress}%` } as CSSProperties}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); beginMoonHold(); }}
                onPointerUp={cancelMoonHold}
                onPointerCancel={cancelMoonHold}
                onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) { event.preventDefault(); beginMoonHold(); } }}
                onKeyUp={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); cancelMoonHold(); } }}
                onClick={(event) => event.preventDefault()}
                aria-describedby="hold-instruction"
              >
                <span className="hold-moon-disc">☾</span>
                <span className="hold-moon-ring" aria-hidden="true" />
                <small>{isHoldingMoon ? `${Math.ceil(holdProgress)}%` : '按住月亮'}</small>
              </button>
              <p id="hold-instruction" className="hold-instruction">持续约两秒 · 松开可重新开始</p>
              <div className="centering-actions">
                <button type="button" onClick={startRitual}>跳过静心，直接洗牌</button>
                <button type="button" onClick={closeCentering}>返回调整问题</button>
              </div>
            </div>
          </div>
        )}
        {ritualStage !== 'idle' && (
          <div className={`draw-ritual-overlay stage-${ritualStage}`} role="dialog" aria-modal="true" aria-live="polite" aria-label="洗牌仪式进行中">
            <div className="ritual-vignette" />
            <div className="ritual-sequence">
              <p>{ritualCopy[ritualStage].eyebrow}</p>
              <div className="ritual-cosmos" aria-hidden="true">
                <span className="ritual-ring ring-one" /><span className="ritual-ring ring-two" /><span className="ritual-ring ring-three" />
                <span className="ritual-sigil sigil-fire">△</span><span className="ritual-sigil sigil-water">▽</span><span className="ritual-sigil sigil-air">✧</span><span className="ritual-sigil sigil-earth">⊕</span>
                <div className="ritual-deck"><i /><i /><i /><span>☾</span></div>
              </div>
              <h2>{ritualCopy[ritualStage].title}</h2>
              <p className="ritual-sequence-note">{ritualCopy[ritualStage].note}</p>
              <div className="ritual-progress" aria-hidden="true"><span className="active" /><span className={ritualStage !== 'gathering' ? 'active' : ''} /><span className={ritualStage === 'opening' ? 'active' : ''} /></div>
              <button type="button" onClick={completeRitual}>跳过动画，直接选牌</button>
            </div>
          </div>
        )}
        {isSelecting ? (
          <div className="selection-ritual">
            <div className="selection-heading">
              <div>
                <p className="eyebrow"><span /> DRAWING RITUAL</p>
                <h1>选择此刻吸引你的牌</h1>
                <p>没有所谓正确答案。让视线缓慢掠过牌背，跟随第一份安静而直接的感觉。</p>
              </div>
              <div className="selection-controls">
                <span className="selection-count" aria-live="polite">已选 <b>{selectedCards.length}</b> ／ {spreadInfo.positions.length}</span>
                <button type="button" onClick={cancelSelection}><RotateCcw aria-hidden="true" /> 调整设置</button>
                <button type="button" onClick={reshuffleSelection}><Shuffle aria-hidden="true" /> 重新洗牌</button>
              </div>
            </div>

            <div className="selection-meta">
              <span>{spreadInfo.positions.length} 张 · 完整 78 张 · 按选择顺序进入牌阵</span>
              <span><ArrowLeftRight aria-hidden="true" /> 左右滑动或拖动，查看更多牌</span>
            </div>

            <div
              className="fan-window"
              ref={fanRef}
              onPointerDown={beginFanDrag}
              onPointerMove={moveFanDrag}
              onPointerUp={endFanDrag}
              onPointerCancel={endFanDrag}
            >
              <div className="fan-track" role="group" aria-label="78张塔罗牌背">
                {selectionDeck.map((card, index) => {
                  const selectedIndex = selectedCards.findIndex((selected) => selected.id === card.id);
                  const center = (selectionDeck.length - 1) / 2;
                  const isCenterCard = Math.abs(index - center) <= .5;
                  const style = {
                    '--fan-angle': `${(index - center) * .42}deg`,
                    '--fan-drop': `${Math.abs(index - center) * .55}px`,
                    '--fan-delay': `${Math.min(index * 12, 480)}ms`,
                  } as CSSProperties;
                  return (
                    <button
                      type="button"
                      key={`choose-${card.id}`}
                      className={`picker-card ${Math.abs(index - center) <= 17 ? 'fan-animated' : ''} ${isCenterCard ? 'center-card' : ''} ${selectedIndex >= 0 ? 'selected' : ''}`}
                      style={style}
                      onClick={(event) => {
                        if (fanDragRef.current.blockClick) {
                          event.preventDefault();
                          return;
                        }
                        selectCard(card);
                      }}
                      disabled={selectedIndex >= 0 || selectedCards.length >= spreadInfo.positions.length}
                      aria-label={selectedIndex >= 0 ? `已选择为第${selectedIndex + 1}张牌` : `选择牌背 ${index + 1}`}
                    >
                      <span className="picker-card-inner">
                        <span className="picker-sun">☀</span>
                        <span className="picker-seal">✦</span>
                        <span className="picker-moon">☾</span>
                      </span>
                      {selectedIndex >= 0 && <span className="picked-order">第 {selectedIndex + 1} 张</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="selection-tray-heading">
              <div><span>你已选择的牌</span><small>牌面会依次落入「{spreadInfo.name}」的对应位置</small></div>
              <Button onClick={revealSelection} disabled={selectedCards.length !== spreadInfo.positions.length} className="reveal-button">
                展开牌阵与详细解读 <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <div className="selected-tray">
              {spreadInfo.positions.map((position, index) => {
                const card = selectedCards[index];
                return (
                  <div className={`selected-slot ${card ? 'filled' : ''}`} key={`selected-slot-${position.name}`}>
                    {card ? (
                      <>
                        <div className={`picked-card-face ${card.reversed ? 'is-reversed' : ''}`}><img src={cardImagePath(card)} alt={`${card.name}牌面`} /></div>
                        <p>{position.short} · {card.reversed ? '逆位' : '正位'}</p>
                      </>
                    ) : (
                      <div className="empty-picked-card"><span>{String(index + 1).padStart(2, '0')}</span><small>{position.short}</small></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
        <>
        <div className="intro-panel">
          <p className="eyebrow"><span /> A QUIET MOMENT FOR YOU</p>
          <h1>让牌面映见<br />你心中的答案</h1>
          <p className="intro-copy">完整收录22张大阿卡纳与56张小阿卡纳，依据韦特体系的经典象征与正逆位牌义，照亮你已经感受到、却还没说出口的事。</p>
          <p className="deck-badge"><span>78</span> 张完整牌组 · 7 种牌阵 · 每张正逆位 50 / 50</p>

          <div className="spread-switch spread-catalog" aria-label="选择牌阵">
            {(Object.entries(spreadDefinitions) as [Spread, SpreadDefinition][]).map(([key, definition]) => (
              <button key={key} className={spread === key ? 'active' : ''} onClick={() => changeSpread(key)}>
                <span>{definition.name}</span><small>{definition.countLabel} · {definition.description}</small>
              </button>
            ))}
          </div>

          <div className="question-label"><span>{spread === 'choice' ? '写下你正在比较的两个选项' : '你想询问什么？'}</span><span>{spread === 'choice' ? '必填两个更清晰' : '可选'}</span></div>
          {spread === 'choice' ? (
            <div className="choice-question-builder" aria-label="二选一问题">
              <label className="choice-field" htmlFor="choice-option-a"><span><b>A</b> 选项 A</span><Input id="choice-option-a" value={choiceOptionA} maxLength={38} onChange={(event) => updateChoiceOption('A', event.target.value)} placeholder="例如：留在现在的公司" /></label>
              <span className="choice-divider">或</span>
              <label className="choice-field" htmlFor="choice-option-b"><span><b>B</b> 选项 B</span><Input id="choice-option-b" value={choiceOptionB} maxLength={38} onChange={(event) => updateChoiceOption('B', event.target.value)} placeholder="例如：接受新的工作机会" /></label>
              <p className="choice-question-preview">{question || '填入两个选项后，系统会自动组成适合牌阵的问题。'}</p>
            </div>
          ) : (
            <>
              <Textarea id="question" value={question} maxLength={96} onChange={(event) => setQuestion(event.target.value)} placeholder={questionExamples[spread][0]} className="question-box" />
              <div className="question-prompts">
                <p><Sparkles aria-hidden="true" /> 你可以这样问，点一下直接填入</p>
                <div>{questionExamples[spread].map((example) => <button type="button" className={question === example ? 'active' : ''} onClick={() => chooseQuestionExample(example)} key={example}>{example}</button>)}</div>
              </div>
              <p className="question-hint">开放式问题通常比只问“会不会”更能得到可行动的线索。</p>
            </>
          )}

          <div className="action-row">
            <Button onClick={drawCards} disabled={isShuffling || (spread === 'choice' && (!choiceOptionA.trim() || !choiceOptionB.trim()))} className="draw-button">
              <Sparkles aria-hidden="true" />{isShuffling ? '正在洗牌…' : drawn.length ? '重新抽牌' : '开始抽牌'}
            </Button>
            {drawn.length > 0 && <Button variant="ghost" onClick={reset} className="reset-button" aria-label="清除本次抽牌"><RotateCcw aria-hidden="true" /> 清空</Button>}
          </div>
          <p className="ritual-note">闭上眼睛，缓慢呼吸三次，然后在心里默念你的问题。</p>
        </div>

        <div className="table-panel" aria-live="polite">
          {revealBurst && drawn.length > 0 && (
            <div className="element-burst" aria-hidden="true">
              {drawn.map((card, index) => {
                const elementClass = card.arcana === 'minor' ? card.suit || 'spirit' : 'spirit';
                const glyph = card.arcana === 'minor' ? ({ wands: '✦', cups: '◡', swords: '✧', pentacles: '⊕' }[card.suit || 'wands']) : '✺';
                return <span className={`burst-particle burst-${elementClass}`} style={{ '--burst-index': index } as CSSProperties} key={`burst-${card.id}`}>{glyph}</span>;
              })}
            </div>
          )}
          <div className="table-stars" aria-hidden="true">
            {twinkleStars.slice(0,14).map((style, index) => <span className={`twinkle-star ${index % 7 === 0 ? 'star-cross' : ''}`} style={style} key={`table-star-${index}`} />)}
          </div>
          <img className="table-art" src="/og.png" alt="" aria-hidden="true" />
          <div className="moon-orbit" aria-hidden="true"><span>☾</span></div>
          <p className="table-kicker">{drawn.length ? 'YOUR READING' : 'THE CARDS ARE WAITING'}</p>
          <h2>{drawn.length ? '牌面已为你展开' : subtitle}</h2>

          <div className="spread-scene-caption" aria-live="polite">
            <span aria-hidden="true">{spreadScenes[spread].symbol}</span>
            <div><b>{spreadScenes[spread].title}</b><small>{spreadScenes[spread].note}</small></div>
          </div>

          <div className={`card-stage spread-${spread} ${spreadInfo.positions.length === 3 ? 'three-card' : ''} ${spreadInfo.positions.length > 3 ? 'large-spread' : ''} ${isShuffling ? 'shuffling' : ''}`}>
            {(drawn.length ? drawn : Array.from({ length: spreadInfo.positions.length })).map((item, index) => {
              const card = item as DrawnCard | undefined;
              return (
                <div className="position-card" key={card?.id ?? `back-${index}`}>
                <span className="stage-position"><b>{String(index + 1).padStart(2, '0')}</b>{spreadInfo.positions[index].short}</span>
                <article
                  className={`tarot-card ${card ? 'revealed' : ''}`}
                  key={card?.id ?? `back-${index}`}
                  style={{
                    animationDelay: `${index * 150}ms`,
                    '--float-duration': `${5.4 + (index % 4) * .47}s`,
                    '--float-delay': `${1.15 + index * .19}s`,
                    '--float-drift': `${[-1.6,.8,1.35,-.7][index % 4]}px`,
                    '--float-drift-back': `${[.7,-1.1,-.55,1.2][index % 4]}px`,
                    '--float-lift': `${-(4.6 + (index % 3) * .8)}px`,
                    '--float-roll': `${[-.42,.28,.38,-.24][index % 4]}deg`,
                    '--float-roll-back': `${[.22,-.34,-.2,.3][index % 4]}deg`,
                  } as CSSProperties}
                  onPointerMove={tiltCard}
                  onPointerLeave={resetCardTilt}
                >
                  {card ? (
                    <div className={`card-face ${card.reversed ? 'is-reversed' : ''}`}>
                      <img className="rws-card-image" src={cardImagePath(card)} alt={`${card.name}韦特牌面`} />
                    </div>
                  ) : (
                    <div className="card-back" aria-label="尚未翻开的塔罗牌">
                      <span className="back-corner">✦</span><div className="back-orbit"><span>☽</span></div><span className="back-label">STELLA ARCANA</span>
                    </div>
                  )}
                </article>
                </div>
              );
            })}
            <div className={`spread-atmosphere scene-${spread}`} aria-hidden="true">
              <span className="scene-core">{spreadScenes[spread].symbol}</span>
              {Array.from({ length: 6 }, (_, index) => <i key={`scene-${spread}-${index}`} />)}
            </div>
          </div>

          {drawn.length > 0 ? (
            <div className="interpretations" ref={interpretationsRef}>
              {isSharedReading && <div className="shared-reading-banner"><Link2 aria-hidden="true" /><span><b>只读分享解读</b>你正在查看由分享链接还原的牌阵；它不会自动写入你的历史记录。</span></div>}
              <details className="reading-layer layer-summary" open>
                <summary>
                  <span className="layer-number">01</span>
                  <div><small>一句话结论</small><strong>先直接回答问题，再解释为什么</strong></div>
                  <ChevronRight aria-hidden="true" />
                </summary>
                <div className="layer-content summary-content">
                  <p>{oneSentenceSummary}</p>
                  {question && <blockquote>“{question}”</blockquote>}
                </div>
              </details>

              <details className="reading-layer layer-panorama" open>
                <summary>
                  <span className="layer-number">02</span>
                  <div><small>整组牌的故事</small><strong>先理解主线，再进入每一张牌</strong></div>
                  <ChevronRight aria-hidden="true" />
                </summary>
                <div className="layer-content">
                  {integrated && <div className="integrated-story">
                    <span>OVERALL READING</span>
                    <p>{fullSynthesis}</p>
                    <div className="story-axis" aria-label="牌阵主轴">
                      <i>{integrated.axis[0]}</i><b>起点</b><span>→</span><i>{integrated.axis[1]}</i><b>转折</b><span>→</span><i>{integrated.axis[2]}</i><b>趋势</b>
                    </div>
                  </div>}
                  <div className={`overview-path ${spreadInfo.positions.length > 3 ? 'many' : ''}`}>
                    {spreadInfo.positions.map((position, index) => (
                      <span key={position.name}><b>{String(index + 1).padStart(2, '0')} · {position.short}</b>{drawn[index].name}{drawn[index].reversed ? '（逆位）' : '（正位）'}</span>
                    ))}
                  </div>
                </div>
              </details>

              <details className="reading-layer layer-cards" open={drawn.length <= 3}>
                <summary>
                  <span className="layer-number">03</span>
                  <div><small>牌位解读</small><strong>用每个位置验证上面的整体结论</strong></div>
                  <ChevronRight aria-hidden="true" />
                </summary>
                <div className="layer-content card-readings">
              {drawn.map((card, index) => {
                const guide = guideFor(card);
                return (
                <details className="interpretation detailed-reading" key={`reading-${card.id}`} open={drawn.length <= 3}>
                  <summary className="reading-summary">
                  <div className="interpretation-heading">
                    <span>{String(index + 1).padStart(2, '0')} · {spreadInfo.positions[index].name}</span>
                    <strong>{card.name} · {card.reversed ? '逆位' : '正位'} <small>{card.arcana === 'minor' ? `${card.suitLabel}／${card.element}` : '大阿卡纳'}</small></strong>
                  </div>
                  <p className="keywords">{card.reversed ? card.reversedKeywords : card.upright}</p>
                  <span className="summary-hint">展开详细释义</span>
                  </summary>

                  <section className="core-reading">
                    <span className="detail-index">01</span>
                    <div>
                      <h4>核心讯息</h4>
                      <p>{card.message}</p>
                      <p>{orientationNote(card)}</p>
                      <div className="canonical-pair">
                        <div className={!card.reversed ? 'active' : ''}><span>标准正位</span><p>{card.uprightMeaning}</p></div>
                        <div className={card.reversed ? 'active' : ''}><span>标准逆位</span><p>{card.reversedMeaning}</p></div>
                      </div>
                    </div>
                  </section>

                  <section className="question-reading">
                    <span className="detail-index">02</span>
                    <div>
                      <h4>{question ? '与你问题的关联' : '放回你的处境中'}</h4>
                      <p>
                        {question
                          ? `针对“${question}”，${positionMeaning(card, spreadInfo.positions[index])}`
                          : positionMeaning(card, spreadInfo.positions[index])}
                      </p>
                    </div>
                  </section>

                  <div className="detail-domain-title"><span>03</span><h4>不同生活领域的解读</h4></div>
                  <div className="domain-grid">
                    <section><span>爱情与关系</span><p>{domainMeaning(card, 'love')}</p></section>
                    <section><span>事业与学业</span><p>{domainMeaning(card, 'career')}</p></section>
                    <section><span>财运与资源</span><p>{domainMeaning(card, 'money')}</p></section>
                    <section><span>健康与身心</span><p>{domainMeaning(card, 'health')}</p></section>
                    <section className="wide-domain"><span>盲点与提醒</span><p>{guide.blindspot}</p></section>
                  </div>

                  <section className="action-guidance">
                    <div className="action-copy">
                      <span>04 · 可以采取的行动</span>
                      <p>{guide.action}</p>
                    </div>
                    <div className="reflection-prompt">
                      <span>写给自己的问题</span>
                      <p>“{guide.reflect}”</p>
                    </div>
                  </section>
                </details>
              );
              })}
                </div>
              </details>

              {structure && integrated && <>
                <details className="reading-layer layer-relationships" open>
                  <summary>
                    <span className="layer-number">04</span>
                    <div><small>关键牌组联系</small><strong>按「{spreadInfo.name}」的牌位逻辑分析加强、冲突与修正</strong></div>
                    <ChevronRight aria-hidden="true" />
                  </summary>
                  <div className="layer-content relationship-content">
                    <ol>{integrated.connections.map((connection,index) => <li key={`${index}-${connection.title}`}><strong>{connection.title}</strong><p>{connection.body}</p></li>)}</ol>
                  </div>
                </details>

                <details className="reading-layer layer-energy">
                  <summary>
                    <span className="layer-number">05</span>
                    <div><small>能量与比例</small><strong>元素、正逆位与大阿卡纳结构</strong></div>
                    <ChevronRight aria-hidden="true" />
                  </summary>
                  <div className="layer-content structure-stats">
                    <div><span>大阿卡纳比例</span><b>{structure.majorCount}／{drawn.length}</b><small>{structure.majorCount > drawn.length / 2 ? '重大人生课题主导' : '日常选择与现实事件主导'}</small></div>
                    <div><span>正逆位结构</span><b>{drawn.length - structure.reversedCount} 正 · {structure.reversedCount} 逆</b><small>{structure.reversedCount > drawn.length / 2 ? '先整理阻力再推进' : '可用行动能量较多'}</small></div>
                    <div><span>主导元素</span><b>{structure.dominantLabel}</b><small>权杖{structure.suits.wands} · 圣杯{structure.suits.cups} · 宝剑{structure.suits.swords} · 星币{structure.suits.pentacles}</small></div>
                    <div><span>数字与宫廷牌</span><b>{structure.repeats.length ? structure.repeats.join(' · ') : '无重复数字'}</b><small>宫廷牌 {structure.courts} 张</small></div>
                  </div>
                </details>

                <details className="reading-layer layer-guidance" open>
                  <summary>
                    <span className="layer-number">06</span>
                    <div><small>行动建议</small><strong>现在适合做什么、避免什么、观察什么</strong></div>
                    <ChevronRight aria-hidden="true" />
                  </summary>
                  <div className="layer-content action-triad">
                    <section className="action-do"><span>01 · 现在适合做</span><p>{integrated.actions.doNow}</p></section>
                    <section className="action-avoid"><span>02 · 暂时避免</span><p>{integrated.actions.avoid}</p></section>
                    <section className="action-watch"><span>03 · 接下来观察</span><p>{integrated.actions.watch}</p></section>
                  </div>
                </details>
              </>}

              <section className="ai-tarot-chat" aria-labelledby="ai-chat-title">
                <div className="ai-chat-heading">
                  <div className="ai-oracle-mark"><MessageCircle aria-hidden="true" /></div>
                  <div>
                    <span>XINGQI TAROT AGENT · V2</span>
                    <h3 id="ai-chat-title">星契塔罗智能体</h3>
                    <p>先调用牌阵、牌义与组合工具，再组织回答；模型不可用时自动切回本地解读。</p>
                  </div>
                  <div className="ai-chat-quota"><b>{chatRemaining}</b><span>今日剩余</span></div>
                </div>

                <div className="ai-agent-status-row" aria-live="polite">
                  <span className={`ai-agent-mode mode-${agentMode}`}><i />{agentMode === 'thinking' ? '正在分析' : agentMode === 'model' ? '模型协作' : agentMode === 'local' ? '本地解读' : '工具就绪'}</span>
                  <div className="ai-agent-tools">
                    {agentTools.map((tool) => <small key={tool}>✓ {tool}</small>)}
                  </div>
                </div>

                <div className="ai-context-ribbon">
                  <span>智能体已连接当前牌阵</span>
                  <strong>{spreadInfo.name}</strong>
                  <small>{drawn.map((card) => `${card.name}${card.reversed ? '·逆' : ''}`).join(' · ')}{clarifiers.length ? ` · 澄清牌 ${clarifiers.map((card) => card.name).join('、')}` : ''}</small>
                </div>

                <div className="ai-style-picker" aria-label="选择AI对话风格">
                  {(Object.entries(chatStyles) as [ChatStyle, (typeof chatStyles)[ChatStyle]][]).map(([key, item]) => (
                    <button
                      key={key}
                      type="button"
                      className={chatStyle === key ? 'active' : ''}
                      onClick={() => chooseChatStyle(key)}
                      aria-pressed={chatStyle === key}
                    >
                      <i>{item.symbol}</i><span><b>{item.name}</b><small>{item.note}</small></span>
                    </button>
                  ))}
                </div>

                <div className="ai-reply-length" aria-label="选择回答长度"><span>回答长度</span>{(Object.entries(replyLengths) as [ReplyLength, (typeof replyLengths)[ReplyLength]][]).map(([key,item]) => <button key={key} type="button" className={replyLength === key ? 'active' : ''} aria-pressed={replyLength === key} onClick={() => chooseReplyLength(key)}><b>{item.name}</b><small>{item.note}</small></button>)}</div>

                {renderAgentOperationPanels()}

                <div className={`ai-chat-window ${chatMessages.length ? 'has-messages' : ''}`} aria-live="polite">
                  {chatMessages.length ? chatMessages.map((message) => (
                    <article className={`ai-message ${message.role}`} key={message.id}>
                      <span className="ai-message-label">{message.role === 'assistant' ? `星契智能体 · ${chatStyles[chatStyle].name}` : '你'}</span>
                      <p>{message.content || <span className="ai-typing"><i /><i /><i /></span>}</p>
                    </article>
                  )) : (
                    <div className="ai-chat-welcome">
                      <span>✦</span>
                      <p>你可以问得很具体。智能体会先读取牌阵、检索牌义并分析整组关系，再给你回应。</p>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {!chatMessages.length && (
                  <div className="ai-prompt-chips" aria-label="推荐追问">
                    {['这组牌最需要我面对什么？','牌与牌之间最大的矛盾是什么？','请给我三条可以执行的建议'].map((prompt) => (
                      <button type="button" key={prompt} onClick={() => void sendChat(prompt)} disabled={isChatStreaming || chatRemaining <= 0}>{prompt}</button>
                    ))}
                  </div>
                )}

                <div className="ai-chat-composer">
                  <Textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value.slice(0, 1000))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        void sendChat();
                      }
                    }}
                    placeholder="继续问牌阵，例如：这张逆位牌在提醒我改变什么？"
                    aria-label="向AI追问当前牌阵"
                    disabled={isChatStreaming || chatRemaining <= 0}
                  />
                  <button
                    className="ai-send-button"
                    type="button"
                    onClick={() => void sendChat()}
                    disabled={!chatInput.trim() || isChatStreaming || chatRemaining <= 0}
                    aria-label="发送问题"
                  >
                    <Send aria-hidden="true" />
                  </button>
                </div>

                <div className="ai-chat-footer">
                  <p>{chatError || (agentMode === 'local' ? '模型通道暂时不可用，本轮已由星契本地牌义引擎完成，不消耗页面 AI 次数。' : `对话保存在这台设备；每天最多 ${DAILY_CHAT_LIMIT} 次。智能体解读仅用于自我探索。`)}</p>
                  {chatMessages.length > 0 && <button type="button" onClick={clearChat} disabled={isChatStreaming}><Trash2 aria-hidden="true" />清除对话</button>}
                </div>
              </section>

              <section className="reading-action-dock">
                <div><span>保存与分享本次解读</span><small>内容只在你主动操作时保存或生成</small></div>
                <div className="reading-tools" aria-label="保存与分享">
                  <button onClick={() => persistReading()}><Save aria-hidden="true" />保存解读</button>
                  <button onClick={copyFullReading}><Copy aria-hidden="true" />复制文字</button>
                  <button onClick={exportShareImage}><Download aria-hidden="true" />生成分享图</button>
                  <button onClick={copyShareLink}><Link2 aria-hidden="true" />复制只读链接</button>
                </div>
              </section>

              <section className="closing-reading">
                <span>最后的提醒</span>
                <p>塔罗呈现的是当下能量与可能路径，不是替你决定命运。请优先相信现实证据、自己的感受和能够承担的选择；涉及医疗、法律、投资或人身安全的问题，应寻求相应专业帮助。</p>
              </section>
            </div>
          ) : (
            <div className="empty-guidance"><span>✦</span><p>没有标准答案，只有值得被你听见的提醒。</p></div>
          )}
        </div>
        </>
        )}
      </section>
      )}

      {view === 'library' && (
        <section className="library-shell" id="library">
          <div className="section-heading">
            <p className="eyebrow"><span /> 78-CARD ENCYCLOPEDIA</p>
            <h1>韦特塔罗牌库</h1>
            <p>浏览完整78张韦特—史密斯牌面，检索标准正逆位、图像象征、生活领域、牌阵位置与组合关系。</p>
          </div>
          <section className="arcana-archive" aria-labelledby="arcana-archive-title">
            <div className="archive-heading">
              <div>
                <span>HISTORIA · SYMBOLA · VERBA</span>
                <h2 id="arcana-archive-title">秘仪档案</h2>
              </div>
              <p>塔罗并非一开始就是占卜工具。沿着纸牌、象征与艺术的流变，读懂这套图像语言从何而来。</p>
            </div>
            <div className="tarot-timeline">
              <article>
                <time>约 1440—1450</time>
                <b>北意大利 · 纸牌游戏</b>
                <p>现存早期记录集中在米兰、威尼斯、佛罗伦萨与乌尔比诺一带。它最初是一种带有“凯旋牌”的竞技纸牌，而非预言工具。</p>
              </article>
              <article>
                <time>18世纪后期</time>
                <b>法国 · 走向占卜</b>
                <p>纸牌占卜家开始为塔罗建立神秘学解释。此后，数字、占星、卡巴拉等象征系统逐渐被纳入解读传统。</p>
              </article>
              <article>
                <time>1909</time>
                <b>伦敦 · 韦特—史密斯体系</b>
                <p>Arthur Edward Waite 构思体系，Pamela Colman Smith 绘制牌面。56张小阿卡纳获得完整场景，奠定现代直觉解牌的视觉语言。</p>
              </article>
            </div>
            <div className="latin-cabinet" aria-label="拉丁语冥想箴言">
              <div className="latin-intro"><span>VERBA ARCANA</span><b>适合抽牌前默念的拉丁语</b><small>用于营造仪式感，并非原版韦特牌面铭文</small></div>
              <blockquote><i>NOSCE TE IPSUM</i><span>认识你自己</span></blockquote>
              <blockquote><i>PER ASPERA AD ASTRA</i><span>穿越艰难，抵达群星</span></blockquote>
              <blockquote><i>LUX IN TENEBRIS</i><span>黑暗中的光</span></blockquote>
            </div>
            <p className="archive-sources">历史参考：<a href="https://www.metmuseum.org/perspectives/tarot-2" target="_blank" rel="noreferrer">纽约大都会艺术博物馆</a><span>·</span><a href="https://www.vam.ac.uk/articles/tarot-cards" target="_blank" rel="noreferrer">V&amp;A 博物馆</a></p>
          </section>
          <div className="library-toolbar">
            <input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="搜索牌名、英文名或关键词" aria-label="搜索牌库" />
            <div className="library-filters" aria-label="牌库筛选">
              {([['all','全部'],['major','大阿卡纳'],['wands','权杖'],['cups','圣杯'],['swords','宝剑'],['pentacles','星币'],['court','宫廷牌']] as [LibraryFilter,string][]).map(([key,label]) => (
                <button key={key} className={libraryFilter === key ? 'active' : ''} onClick={() => setLibraryFilter(key)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="library-layout">
            <div className="library-grid" aria-label={`共${libraryCards.length}张牌`}>
              {libraryCards.map((card) => (
                <button key={`library-${card.id}`} className={libraryCard.id === card.id ? 'active' : ''} onClick={() => setLibraryCardId(card.id)}>
                  <img src={cardImagePath(card)} alt={`${card.name}韦特牌面`} loading="lazy" />
                  <span><strong>{card.name}</strong><small>{card.en}</small></span>
                </button>
              ))}
              {!libraryCards.length && <p className="library-empty">没有符合条件的牌，请更换关键词或筛选。</p>}
            </div>
            <aside className="card-encyclopedia">
              <div className="encyclopedia-hero">
                <img src={cardImagePath(libraryCard)} alt={`${libraryCard.name}完整韦特牌面`} />
                <div><span>{libraryCard.arcana === 'minor' ? `${libraryCard.suitLabel} · ${libraryCard.element}` : '大阿卡纳'}</span><h2>{libraryCard.name}</h2><p>{libraryCard.en}</p></div>
              </div>
              <section><h3>图像象征</h3><p>{visualSymbolism(libraryCard)}</p></section>
              <section className="card-origin-record">
                <div className="origin-record-heading">
                  <div><span>ICONOGRAPHIC ORIGIN</span><h3>牌面来源</h3></div>
                  <em data-confidence={libraryOrigin.confidence}>{libraryOrigin.confidence}</em>
                </div>
                <div className="origin-record-meta"><span>{libraryOrigin.period}</span><b>{libraryOrigin.historicalName}</b></div>
                <div className="origin-record-layers">
                  <article><b>历史原型</b><p>{libraryOrigin.origin}</p></article>
                  <article><b>韦特—史密斯的变化</b><p>{libraryOrigin.waiteSmith}</p></article>
                </div>
                <small>可信度说明：用于区分馆藏可证的牌名与结构、延续自欧洲艺术的图像传统，以及缺少唯一出处的现代重构。</small>
              </section>
              <div className="encyclopedia-pair">
                <section><h3>标准正位</h3><b>{libraryCard.upright}</b><p>{libraryCard.uprightMeaning}</p></section>
                <section><h3>标准逆位</h3><b>{libraryCard.reversed}</b><p>{libraryCard.reversedMeaning}</p></section>
              </div>
              <section><h3>爱情、事业、财运与健康</h3><div className="encyclopedia-domains">
                <p><b>爱情</b>{domainMeaning(withOrientation(libraryCard, false),'love')}</p>
                <p><b>事业</b>{domainMeaning(withOrientation(libraryCard, false),'career')}</p>
                <p><b>财运</b>{domainMeaning(withOrientation(libraryCard, false),'money')}</p>
                <p><b>健康</b>{domainMeaning(withOrientation(libraryCard, false),'health')}</p>
              </div></section>
              <section><h3>不同牌阵位置</h3><div className="position-examples">
                {[spreadDefinitions.three.positions[0],spreadDefinitions.celtic.positions[1],spreadDefinitions.career.positions[5],spreadDefinitions.relationship.positions[6]].map((position) => (
                  <p key={position.name}><b>{position.name}</b>{positionMeaning(withOrientation(libraryCard, false),position)}</p>
                ))}
              </div></section>
              <section><h3>常见组合牌义</h3><ul>{combinationMeanings(libraryCard).map((meaning) => <li key={meaning}>{meaning}</li>)}</ul></section>
              <p className="image-credit">牌面采用 Pamela Colman Smith 的经典韦特—史密斯图像；本组扫描来自 <a href="https://commons.wikimedia.org/wiki/Category:Rider-Waite-Smith_tarot_deck_(TaionWC)" target="_blank" rel="noreferrer">Wikimedia Commons 公版图像集</a>。</p>
            </aside>
          </div>
        </section>
      )}

      {view === 'history' && (
        <section className="history-shell" id="history">
          <div className="section-heading">
            <p className="eyebrow"><span /> YOUR TAROT JOURNAL</p>
            <h1>塔罗日记</h1>
            <p>保存当时的问题和牌阵，也记录后来真正发生了什么。所有内容仅保存在当前设备，不会上传你的私人笔记。</p>
          </div>
          {history.length ? <div className="history-list">
            {history.map((record) => {
              const definition = spreadDefinitions[record.spread];
              const previewCards = record.cards.slice(0,5).map((entry) => cards.find((card) => card.id === entry.id)).filter(Boolean) as TarotCard[];
              const ageDays = Math.max(0, Math.floor((Date.now() - record.createdAt) / 86400000));
              const noteCount = [record.notes?.initial, record.notes?.outcome, record.notes?.reflection].filter((note) => note?.trim()).length;
              const isOpen = openDiaryId === record.id;
              const isDailyRecord = record.kind === 'daily';
              return <article key={record.id} className={`history-item diary-entry ${isOpen ? 'open' : ''}`}>
                <div className="diary-overview">
                  <div className="history-card-stack">{previewCards.map((card,index) => <img key={`${record.id}-${card.id}`} src={cardImagePath(card)} alt="" style={{ transform: `translateX(${index * 24}px) rotate(${(index - 2) * 3}deg)` }} />)}</div>
                  <div className="history-copy">
                    <span>{formatDiaryDate(record.createdAt)}</span>
                    <h2>{isDailyRecord ? '每日塔罗' : definition.name}</h2>
                    <p className="diary-question">{record.question || '这次没有写下问题'}</p>
                    <div className="diary-meta"><small>{isDailyRecord ? '今日单牌' : `${record.cards.length} 张牌`}</small>{record.dailyMood && <small>状态 · {record.dailyMood}</small>}<small>{noteCount ? `已写 ${noteCount}/3 段笔记` : '等待写下感受'}</small>{ageDays > 0 && <small>距今 {ageDays} 天</small>}</div>
                  </div>
                  <div className="history-actions">
                    <Button onClick={() => restoreReading(record)}>打开完整解读</Button>
                    <button className="diary-toggle" onClick={() => setOpenDiaryId(isOpen ? null : record.id)}>{isOpen ? '收起日记' : '补写日记'}</button>
                    <button className="diary-delete" onClick={() => removeHistory(record.id)}>删除</button>
                  </div>
                </div>

                {isOpen && <div className="diary-details">
                  {ageDays >= 30 && !record.notes?.reflection?.trim() && <div className="diary-return-prompt"><span>☾</span><div><b>这次占卜已经过去 {ageDays} 天</b><p>当时看不清的部分，现在也许已经有了答案。要回来看看吗？</p></div></div>}
                  <div className="diary-spread-review">
                    <div className="diary-subheading"><span>01</span><div><b>当时抽到的牌</b><small>{isDailyRecord ? '这一天的核心提醒' : `按「${definition.name}」的位置顺序`}</small></div></div>
                    <ol>{record.cards.map((entry, index) => {
                      const card = cards.find((item) => item.id === entry.id);
                      const position = definition.positions[index];
                      return card ? <li key={`${record.id}-diary-${entry.id}`}><span>{String(index + 1).padStart(2,'0')}</span><div><small>{isDailyRecord ? '今日指引' : (position?.name || `第 ${index + 1} 张`)}</small><b>{card.name} · {entry.reversed ? '逆位' : '正位'}</b></div></li> : null;
                    })}</ol>
                  </div>
                  <div className="diary-note-section">
                    <div className="diary-subheading"><span>02</span><div><b>把时间留下来</b><small>不必一次写完，内容会自动保存在这台设备</small></div></div>
                    <div className="diary-note-grid">
                      <label><span>当时的想法</span><small>刚看到牌面时，你最直接的感受是什么？</small><Textarea value={record.notes?.initial || ''} maxLength={800} onChange={(event) => updateDiaryNote(record.id,'initial',event.target.value)} placeholder="例如：我其实已经隐约知道答案，只是不愿意承认……" /></label>
                      <label><span>后续发生了什么</span><small>事实如何发展？哪些部分与牌面产生了呼应？</small><Textarea value={record.notes?.outcome || ''} maxLength={800} onChange={(event) => updateDiaryNote(record.id,'outcome',event.target.value)} placeholder="例如：两周后我们进行了一次坦白的谈话……" /></label>
                      <label><span>现在回看</span><small>今天的你，会怎样理解当时的自己和这组牌？</small><Textarea value={record.notes?.reflection || ''} maxLength={800} onChange={(event) => updateDiaryNote(record.id,'reflection',event.target.value)} placeholder="例如：真正重要的并不是预测结果，而是我终于开始……" /></label>
                    </div>
                    {record.notes?.updatedAt && <p className="diary-saved-status">最后整理于 {formatDiaryDate(record.notes.updatedAt)}</p>}
                  </div>
                </div>}
              </article>;
            })}
          </div> : <div className="history-empty"><span>☾</span><h2>你的塔罗日记还是空的</h2><p>完成一次抽牌后，问题、牌阵和牌面会自动保存在这里。</p><Button onClick={() => setView('reading')}>开始第一次抽牌</Button></div>}
        </section>
      )}

      {view === 'agent' && (
        <section className="agent-shell" id="agent">
          <div className="agent-page-heading">
            <div>
              <p className="eyebrow"><span /> XINGQI TAROT AGENT · V4</p>
              <h1>星契塔罗智能体</h1>
              <p>先帮你把困扰整理成可解读的问题，再推荐牌阵、读取组合证据，并把对话接回塔罗日记。</p>
            </div>
            <div className="agent-page-stat"><span>今日可对话</span><b>{chatRemaining}</b><small>／{DAILY_CHAT_LIMIT} 次</small><em className={`cloud-${cloudSyncStatus}`}>{cloudSyncStatus === 'ready' ? `云端已同步${cloudDisplayName ? ` · ${cloudDisplayName}` : ''}` : cloudSyncStatus === 'syncing' ? '正在同步云端' : cloudSyncStatus === 'checking' ? '正在检查登录' : cloudSyncStatus === 'error' ? '云端暂不可用' : '当前为本地保存'}</em></div>
          </div>

          {!drawn.length ? (
            <div className="agent-empty-state">
              <div className="agent-guided-intro">
                <div className="agent-empty-orbit" aria-hidden="true"><Bot /><i /><i /></div>
                <div><span>ACTIVE READING · 主动占卜</span><h2>不用先想好该怎么问</h2><p>把最近真正困扰你的事情说出来。智能体会先帮你整理问题、推荐牌阵并解释原因，再带你进入抽牌。</p></div>
              </div>

              <div className="agent-guided-planner">
                <label htmlFor="guided-concern">最近哪件事一直在你心里打转？</label>
                <Textarea id="guided-concern" value={guidedConcern} onChange={(event) => { setGuidedConcern(event.target.value.slice(0, 800)); setGuidedPlanError(''); }} placeholder="不用组织成塔罗问题，像平时说话一样描述就可以。例如：我想换工作，但担心收入不稳定，也不知道现在离开是不是冲动……" disabled={isPlanningReading} />
                <div className="agent-guided-submit"><small>{guidedConcern.length}／800 · 这里不会自动写入长期记忆</small><Button onClick={() => void planGuidedReading()} disabled={isPlanningReading || guidedConcern.trim().length < 4}><Sparkles />{isPlanningReading ? '正在整理…' : '帮我整理问题'}</Button></div>
                {guidedPlanError && <p className="agent-guided-error">{guidedPlanError}</p>}
              </div>

              {guidedPlan && <div className="agent-plan-result">
                <div className="agent-plan-heading"><div><span>智能体建议这样问</span><small>{guidedPlan.mode === 'model' ? 'AI已整理' : '本地规则已整理'}</small></div><b>{spreadDefinitions[guidedPlan.spread].name} · {spreadDefinitions[guidedPlan.spread].countLabel}</b></div>
                <Textarea value={guidedPlan.refinedQuestion} onChange={(event) => setGuidedPlan((current) => current ? { ...current, refinedQuestion: event.target.value.slice(0, 500) } : current)} aria-label="整理后的占卜问题" />
                <div className="agent-plan-reason"><span>为什么推荐这个牌阵</span><p>{guidedPlan.reason}</p></div>
                <div className="agent-plan-followups"><span>抽牌后还会确认</span>{guidedPlan.followUps.map((item, index) => <p key={`guided-followup-${index}`}><i>{index + 1}</i>{item}</p>)}</div>
                <div className="agent-plan-actions"><button type="button" onClick={() => setGuidedPlan(null)}>重新整理</button><Button onClick={acceptGuidedPlan}>采用这个问题并去抽牌<ChevronRight /></Button></div>
              </div>}

              <div className="agent-empty-divider"><span>或者</span></div>
              <div className="agent-empty-actions"><Button variant="outline" onClick={() => { setGuidedPlan(null); setView('reading'); }}><MoonStar />自己选择牌阵</Button>{history.length > 0 && <button type="button" onClick={() => loadAgentReading(history[0])}><Clock3 />读取最近日记</button>}</div>
              {history.length > 1 && <div className="agent-recent-empty"><small>或者选择一条记录</small>{history.slice(0,4).map((record) => <button type="button" key={`agent-empty-${record.id}`} onClick={() => loadAgentReading(record)}><span>{spreadDefinitions[record.spread].name}</span><b>{record.question || '没有写下问题'}</b><small>{formatDiaryDate(record.createdAt)}</small></button>)}</div>}
            </div>
          ) : (
            <div className="agent-workspace">
              <aside className="agent-context-panel">
                <div className="agent-panel-label"><span>01</span><div><small>CONTEXT</small><b>当前连接的牌阵</b></div></div>
                <div className="agent-context-question"><small>{spreadInfo.name}</small><p>{question || '这次没有写下具体问题，将围绕牌面开放解读。'}</p></div>
                <div className="agent-context-deck" aria-label="当前牌阵牌面">
                  {drawn.slice(0,7).map((card,index) => <div key={`agent-card-${card.id}-${index}`}><img src={cardImagePath(card)} alt={card.name} className={card.reversed ? 'is-reversed' : ''} /><span>{spreadInfo.positions[index]?.short || `牌 ${index + 1}`}</span></div>)}
                  {clarifiers.slice(0,3).map((card,index) => <div className="is-clarifier" key={`agent-clarifier-${card.id}-${index}`}><img src={cardImagePath(card)} alt={`${card.name}澄清牌`} className={card.reversed ? 'is-reversed' : ''} /><span>澄清 {index + 1}</span></div>)}
                  {drawn.length > 7 && <em>+{drawn.length - 7}</em>}
                </div>
                <div className="agent-context-summary"><span>智能体正在使用</span><p>{drawn.length} 张原牌{clarifiers.length ? ` + ${clarifiers.length} 张澄清牌` : ''} · {[...drawn,...clarifiers].filter((card) => card.reversed).length} 张逆位 · {structure?.majorCount || 0} 张大阿卡纳</p></div>
                {agentCombinationInsights.length > 0 && <div className="agent-combination-snapshot"><span>组合知识库命中 {agentCombinationInsights.length} 条</span>{agentCombinationInsights.slice(0, 3).map((item) => <div key={`${item.kind}-${item.title}`}><b>{item.title}</b><p>{item.meaning}</p></div>)}</div>}

                <div className="agent-panel-label agent-source-label"><span>02</span><div><small>SOURCE</small><b>切换解读记录</b></div></div>
                <div className="agent-source-list">
                  {history.length ? history.slice(0,4).map((record) => {
                    const signature = record.cards.map((card) => `${card.id}${card.reversed ? 'r' : 'u'}`).join('-');
                    const isCurrent = record.spread === spread && signature === drawnSignature;
                    return <button type="button" className={isCurrent ? 'active' : ''} key={`agent-source-${record.id}`} onClick={() => loadAgentReading(record)}><span>{spreadDefinitions[record.spread].name}</span><b>{record.question || '没有写下问题'}</b><small>{isCurrent ? '当前牌阵' : formatDiaryDate(record.createdAt)}</small></button>;
                  }) : <p className="agent-no-source">保存过的牌阵会出现在这里，方便以后继续追问。</p>}
                </div>
                <button type="button" className="agent-new-reading" onClick={() => setView('reading')}><MoonStar />重新抽一组牌<ChevronRight /></button>
                <details className="agent-source-mobile">
                  <summary>切换塔罗日记 <ChevronRight /></summary>
                  <div>
                    {history.length ? history.slice(0,4).map((record) => <button type="button" key={`agent-mobile-source-${record.id}`} onClick={() => loadAgentReading(record)}><span>{spreadDefinitions[record.spread].name}</span><b>{record.question || '没有写下问题'}</b><small>{formatDiaryDate(record.createdAt)}</small></button>) : <p>还没有保存过的牌阵。</p>}
                    <button type="button" className="agent-mobile-new-reading" onClick={() => setView('reading')}><MoonStar />重新抽一组牌</button>
                  </div>
                </details>
              </aside>

              <div className="agent-main-column">
                <section className="agent-workflow-panel" aria-labelledby="agent-workflow-title">
                  <div className="agent-workflow-heading"><div><span>03 · ANALYSIS MODES</span><h2 id="agent-workflow-title">你想让智能体怎么分析？</h2></div><small>点击即可开始</small></div>
                  <div className="agent-workflows">
                    {[
                      ['一句话判断','先直说这组牌最核心的结论，不要绕弯。','01'],
                      ['矛盾与盲点','找出牌面最大的矛盾，以及我最容易忽略的地方。','02'],
                      ['三步行动计划','把这组牌的建议拆成今天、本周和接下来一个月的行动。','03'],
                      ['现实验证信号','接下来要观察哪些现实信号，才能判断趋势是否正在发生？','04'],
                    ].map(([title,prompt,index]) => <button type="button" key={title} onClick={() => void sendChat(prompt)} disabled={isChatStreaming || chatRemaining <= 0}><small>{index}</small><span><b>{title}</b><em>{prompt}</em></span><ChevronRight /></button>)}
                  </div>
                </section>

                {guidedPlan && <section className="agent-guided-context" aria-label="主动占卜后续确认">
                  <div><span>主动占卜进行中</span><h2>牌已经展开，接下来可以直接说真实情况</h2><p>{guidedPlan.followUps[0]}{guidedPlan.followUps[1] ? ` 也可以顺便告诉我：${guidedPlan.followUps[1]}` : ''}</p></div>
                  {!memorySuggestionDismissed && guidedPlan.memorySuggestion && <aside><small>只有你确认后才会记住</small><p>{guidedPlan.memorySuggestion}</p><div><button type="button" onClick={() => setMemorySuggestionDismissed(true)}>这次不记</button><button type="button" onClick={confirmGuidedMemory}>确认写入长期记忆</button></div></aside>}
                </section>}

                <section className="agent-capability-lab" aria-labelledby="agent-lab-title">
                  <div className="agent-lab-heading"><div><span>04 · PERSONAL CONTEXT</span><h2 id="agent-lab-title">让智能体真正理解你的变化</h2></div><div className="agent-lab-controls"><small>{cloudSyncStatus === 'ready' ? '已登录，设置会同步到云端' : '未登录时保存在当前设备'}</small><button type="button" className="agent-lab-toggle" aria-expanded={agentLabOpen} onClick={() => setAgentLabOpen((current) => !current)}>{agentLabOpen ? '收起工具' : '展开工具'}<ChevronRight /></button></div></div>
                  <div className={`agent-capability-grid ${agentLabOpen ? 'open' : ''}`}>
                    <article className="agent-memory-card">
                      <div className="agent-capability-title"><span>长期记忆</span><button type="button" role="switch" aria-checked={agentMemoryEnabled} className={agentMemoryEnabled ? 'active' : ''} onClick={() => saveAgentMemory(!agentMemoryEnabled,agentMemoryNote)}><i />{agentMemoryEnabled ? '已开启' : '未开启'}</button></div>
                      <p>主动告诉智能体需要长期记住的背景。关闭后，内容仍留在设备中，但不会发送给模型。</p>
                      <div className="agent-memory-toolbar"><span>智能体当前记住的内容 · {agentMemoryNote.length}/1200</span><button type="button" onClick={clearAgentMemory} disabled={!agentMemoryNote.trim()}>删除全部</button></div>
                      <Textarea value={agentMemoryNote} onChange={(event) => saveAgentMemory(agentMemoryEnabled,event.target.value.slice(0,1200))} placeholder="例如：我正在考虑转行；关系中的 TA 用代号 A；我更希望得到直接建议……" aria-label="希望智能体长期记住的背景" />
                      <div className="agent-pattern-snapshot"><span>历史模式</span><b>{personalPatterns.repeatedCards.length ? personalPatterns.repeatedCards.join(' · ') : '暂无重复牌'}</b><small>{personalPatterns.recentCount} 次记录 · 逆位约 {personalPatterns.reversedRate}% · 常用 {personalPatterns.dominantSpread}</small></div>
                    </article>

                    <article className="agent-journal-card">
                      <div className="agent-capability-title"><span>日记复盘</span><button type="button" role="switch" aria-checked={agentJournalEnabled} className={agentJournalEnabled ? 'active' : ''} disabled={!activeAgentRecord} onClick={() => setAgentJournalEnabled((current) => !current)}><i />{agentJournalEnabled ? '允许读取' : '不读取'}</button></div>
                      {activeAgentRecord ? <>
                        <p>将这次牌面和后来真正发生的事情分开核对，减少事后硬套牌义。</p>
                        <div className="agent-journal-status"><span className={activeAgentRecord.notes?.initial?.trim() ? 'done' : ''}>当时想法</span><span className={activeAgentRecord.notes?.outcome?.trim() ? 'done' : ''}>后续发生</span><span className={activeAgentRecord.notes?.reflection?.trim() ? 'done' : ''}>现在回看</span></div>
                        <button type="button" className="agent-capability-action" disabled={!agentJournalEnabled || isChatStreaming || chatRemaining <= 0} onClick={() => void sendChat('请结合我的日记做一次复盘：哪些牌义得到了现实验证，哪些没有发生，我当时可能忽略了什么？')}>开始日记复盘<ChevronRight /></button>
                      </> : <div className="agent-capability-empty"><p>当前牌阵还没有连接到日记记录。</p><button type="button" onClick={() => history[0] && loadAgentReading(history[0])} disabled={!history.length}>选择最近日记</button></div>}
                    </article>

                    <article className="agent-compare-card">
                      <div className="agent-capability-title"><span>多次牌阵对比</span><small>已选 {comparisonIds.length}／3</small></div>
                      <p>选择两至三次记录，比较重复牌、元素变化、正逆位和行动方向。</p>
                      <div className="agent-compare-list">
                        {history.slice(0,5).map((record) => <label key={`compare-${record.id}`} className={comparisonIds.includes(record.id) ? 'active' : ''}><input type="checkbox" checked={comparisonIds.includes(record.id)} onChange={() => toggleComparisonReading(record.id)} /><i /><span><b>{spreadDefinitions[record.spread].name}</b><small>{formatDiaryDate(record.createdAt)}</small></span></label>)}
                        {!history.length && <em>至少保存两次抽牌后即可使用。</em>}
                      </div>
                      <button type="button" className="agent-capability-action" disabled={comparisonIds.length < 2 || isChatStreaming || chatRemaining <= 0} onClick={() => void sendChat('请对比我选中的这些历史牌阵：找出重复出现的课题、正逆位或元素变化，以及我的行动方向发生了什么改变。')}>开始对比 {comparisonIds.length >= 2 ? `${comparisonIds.length} 次记录` : ''}<ChevronRight /></button>
                    </article>
                  </div>
                </section>

                <section className="ai-tarot-chat agent-chat-console" aria-labelledby="agent-chat-title">
                  <div className="ai-chat-heading">
                    <div className="ai-oracle-mark"><MessageCircle aria-hidden="true" /></div>
                    <div><span>LIVE ORACLE CONVERSATION</span><h3 id="agent-chat-title">继续追问这组牌</h3><p>回复会综合当前牌阵、日记上下文与本轮对话，不会只复述单张牌义。</p></div>
                    <div className="ai-chat-quota"><b>{chatRemaining}</b><span>今日剩余</span></div>
                  </div>

                  <div className="ai-agent-status-row" aria-live="polite">
                    <span className={`ai-agent-mode mode-${agentMode}`}><i />{agentMode === 'thinking' ? '正在分析' : agentMode === 'model' ? '模型协作' : agentMode === 'local' ? '本地解读' : '工具就绪'}</span>
                    <div className="ai-agent-tools">{agentTools.map((tool) => <small key={tool}>✓ {tool}</small>)}</div>
                  </div>

                  <div className="ai-style-picker" aria-label="选择智能体对话风格">
                    {(Object.entries(chatStyles) as [ChatStyle, (typeof chatStyles)[ChatStyle]][]).map(([key,item]) => <button key={key} type="button" className={chatStyle === key ? 'active' : ''} onClick={() => chooseChatStyle(key)} aria-pressed={chatStyle === key}><i>{item.symbol}</i><span><b>{item.name}</b><small>{item.note}</small></span></button>)}
                  </div>

                  <div className="ai-reply-length" aria-label="选择回答长度"><span>回答长度</span>{(Object.entries(replyLengths) as [ReplyLength, (typeof replyLengths)[ReplyLength]][]).map(([key,item]) => <button key={key} type="button" className={replyLength === key ? 'active' : ''} aria-pressed={replyLength === key} onClick={() => chooseReplyLength(key)}><b>{item.name}</b><small>{item.note}</small></button>)}</div>

                  {renderAgentOperationPanels()}

                  <div className={`ai-chat-window agent-chat-window ${chatMessages.length ? 'has-messages' : ''}`} aria-live="polite">
                    {chatMessages.length ? chatMessages.map((message) => <article className={`ai-message ${message.role}`} key={message.id}><span className="ai-message-label">{message.role === 'assistant' ? `星契智能体 · ${chatStyles[chatStyle].name}` : '你'}</span><p>{message.content || <span className="ai-typing"><i /><i /><i /></span>}</p>{message.role === 'assistant' && message.content && <details className="ai-message-evidence"><summary>查看回答依据 <ChevronRight /></summary><div><span>{message.mode === 'local' ? '本地韦特牌义' : 'AI 模型协作'} · {(message.tools?.length ? message.tools : agentTools).join(' · ')}</span>{message.evidence?.length ? <ul>{message.evidence.map((item,index) => <li key={`${message.id}-evidence-${index}`}>{item}</li>)}</ul> : <p>本次回答依据当前「{spreadInfo.name}」的 {drawn.length} 张牌、牌位与正逆位生成。</p>}<small>这里展示的是智能体实际读取的牌库证据；它用于说明解读路径，不是对现实事实的证明。</small></div></details>}</article>) : <div className="ai-chat-welcome"><span>✦</span><p>我已经读到了这组牌。你可以点上面的分析模式，也可以直接说你现在最纠结的部分。</p></div>}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="ai-prompt-chips" aria-label="更多推荐追问">
                    {[
                      drawn.length >= 3 ? '重新解释第三张牌，并说明它为什么落在这个位置。' : '换一种更贴近日常生活的方式解释这张牌。',
                      '只分析感情部分，不要展开其他领域。',
                      '哪组牌的组合最影响最终走向？',
                      '如果我什么都不做，会怎样发展？',
                    ].map((prompt) => <button type="button" key={prompt} onClick={() => void sendChat(prompt)} disabled={isChatStreaming || chatRemaining <= 0}>{prompt}</button>)}
                  </div>

                  <div className="agent-command-chips" aria-label="智能体可执行操作"><span>可直接让智能体执行</span>{['补抽一张澄清牌','打开第三张牌百科','把这次对话保存到塔罗日记','保留问题并重新抽牌'].map((command) => <button type="button" key={command} onClick={() => void sendChat(command)} disabled={isChatStreaming}>{command}</button>)}</div>

                  <div className="ai-chat-composer">
                    <Textarea value={chatInput} onChange={(event) => setChatInput(event.target.value.slice(0,1000))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendChat(); } }} placeholder="把你真正担心的部分告诉我……" aria-label="向星契智能体追问" disabled={isChatStreaming || chatRemaining <= 0} />
                    <button className="ai-send-button" type="button" onClick={() => void sendChat()} disabled={!chatInput.trim() || isChatStreaming || chatRemaining <= 0} aria-label="发送问题"><Send aria-hidden="true" /></button>
                  </div>

                  <div className="ai-chat-footer">
                    <p>{chatError || (agentMode === 'local' ? '模型暂时不可用，本轮已自动切换为本地牌义，不消耗页面 AI 次数。' : '对话自动保存在当前设备；智能体解读用于自我探索，不替代现实判断。')}</p>
                    <div className="agent-chat-actions">{isChatStreaming ? <button type="button" className="stop" onClick={stopChat}><Square />停止生成</button> : <><button type="button" onClick={retryLastChat} disabled={!chatMessages.some((message) => message.role === 'user') || chatRemaining <= 0}><RotateCcw />重新生成</button><button type="button" onClick={() => saveAgentSummary()} disabled={!chatMessages.some((message) => message.role === 'assistant' && message.content.trim())}><Save />保存到塔罗日记</button></>}<button type="button" onClick={() => void copyChatTranscript()} disabled={!chatMessages.length || isChatStreaming}><Copy />复制对话</button><button type="button" onClick={clearChat} disabled={!chatMessages.length || isChatStreaming}><Trash2 />清除</button></div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </section>
      )}

      <footer><span>星契 TAROT</span><p>把牌当作一面镜子，把选择留在自己手中。</p></footer>
    </main>
  );
}
