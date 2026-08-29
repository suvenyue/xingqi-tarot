'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeftRight, BookOpen, ChevronRight, Clock3, Copy, Download, Link2, MoonStar, RotateCcw, Save, Shuffle, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { minorCards, minorDomainMeaning, type DeckCard, type Domain } from '@/lib/tarot-deck';

type Spread = 'single' | 'three' | 'celtic' | 'relationship' | 'choice' | 'career' | 'year';
type SpreadPosition = { name: string; short: string; focus: string };
type SpreadDefinition = { name: string; countLabel: string; description: string; positions: SpreadPosition[] };

const twinkleStars = Array.from({ length: 38 }, (_, index) => ({
  left: `${(index * 37 + 9) % 100}%`,
  top: `${(index * 53 + 6) % 100}%`,
  '--twinkle-size': `${1.2 + (index % 5) * .46}px`,
  '--twinkle-delay': `${-(index % 13) * .62}s`,
  '--twinkle-duration': `${3.4 + (index % 7) * .68}s`,
  '--twinkle-drift': `${4 + (index % 4) * 2}px`,
  '--twinkle-rise': `${-3 - (index % 5)}px`,
} as CSSProperties));

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

type DrawnCard = TarotCard & { reversed: boolean };
type AppView = 'reading' | 'library' | 'history';
type LibraryFilter = 'all' | 'major' | 'wands' | 'cups' | 'swords' | 'pentacles' | 'court';
type SavedReading = {
  id: string;
  createdAt: number;
  question: string;
  spread: Spread;
  cards: { id: number; reversed: boolean }[];
};

const HISTORY_KEY = 'xingqi-tarot-readings-v1';

function cardImagePath(card: TarotCard) {
  if (card.arcana !== 'minor') return `/cards/major-${String(card.id).padStart(2, '0')}.webp`;
  const suitIndex = ((card.id - 22) % 14) + 1;
  return `/cards/${card.suit}-${String(suitIndex).padStart(2, '0')}.webp`;
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

function visualSymbolism(card: TarotCard) {
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
    ? `这张牌以逆位出现，能量更可能表现为内在阻力、延迟或过度使用。关键词是“${card.reversed}”。它不是坏结果，而是在提醒你：先看见卡住能量的方式，再谈下一步。`
    : `这张牌以正位出现，核心力量正在较顺畅地表达。关键词是“${card.upright}”。它不保证事情自动成功，但说明你可以主动使用这份能量来推动局面。`;
}

function positionMeaning(card: DrawnCard, position: SpreadPosition) {
  const meaning = card.reversed ? card.reversedMeaning : card.uprightMeaning;
  return `在“${position.name}”位置，${position.focus}${card.name}进一步说明“${meaning}”。请把位置职责与牌义同时考虑，而不是脱离牌阵单独判断。`;
}

function domainMeaning(card: DrawnCard, domain: Domain) {
  if (card.arcana === 'minor') return minorDomainMeaning(card as DeckCard, domain, card.reversed);
  const guide = cardGuides[card.id];
  const base = domain === 'health' ? majorHealth[card.id] : guide[domain];
  return card.reversed
    ? `${base} 逆位时，尤其要留意“${card.reversed}”如何让这一领域出现延迟、内耗或过度反应。`
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
      ? `主要盲点是“${card.reversed}”。逆位并不自动等于坏结果，它更常指出能量受阻、内化、延迟或被使用过度。`
      : `正位的优势是“${card.upright}”，但任何优势推到极端都会形成盲点；请确认行动仍符合现实条件。`,
    action: `${card.message} 先选择一个能在七天内完成、且可以观察结果的具体步骤。`,
    reflect: `“${card.reversed ? card.reversed : card.upright}”正在我的现实中以什么方式出现？`,
  };
}

function synthesisText(drawn: DrawnCard[], spread: Spread) {
  if (drawn.length === 1) {
    const card = drawn[0];
    return `${card.name}把焦点放在“${card.reversed ? card.reversed : card.upright}”上。此刻最重要的不是追问一个绝对结果，而是辨认你能改变的部分，并用一次具体行动验证牌面给出的提醒。`;
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
  const [drawn, setDrawn] = useState<DrawnCard[]>([]);
  const [selectionDeck, setSelectionDeck] = useState<DrawnCard[]>([]);
  const [selectedCards, setSelectedCards] = useState<DrawnCard[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [history, setHistory] = useState<SavedReading[]>([]);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>('all');
  const [libraryCardId, setLibraryCardId] = useState(0);
  const [notice, setNotice] = useState('');
  const [isSharedReading, setIsSharedReading] = useState(false);
  const fanRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLCanvasElement>(null);
  const spreadInfo = spreadDefinitions[spread];
  const structure = drawn.length ? readingStructure(drawn, spread) : null;

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

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as SavedReading[];
      setHistory(Array.isArray(stored) ? stored.slice(0,30) : []);
    } catch {
      setHistory([]);
    }
    const sharedValue = new URLSearchParams(window.location.hash.slice(1)).get('reading');
    if (!sharedValue) return;
    const shared = decodeReading(sharedValue);
    if (!shared || !spreadDefinitions[shared.spread]) return;
    const restored = shared.cards.map((entry) => {
      const card = cards.find((item) => item.id === entry.id);
      return card ? { ...card, reversed: Boolean(entry.reversed) } : null;
    }).filter(Boolean) as DrawnCard[];
    if (restored.length !== spreadDefinitions[shared.spread].positions.length) return;
    setSpread(shared.spread);
    setQuestion(shared.question || '');
    setDrawn(restored);
    setIsSharedReading(true);
    setView('reading');
  }, []);

  useEffect(() => {
    if (!isSelecting || !fanRef.current) return;
    const fan = fanRef.current;
    fan.scrollLeft = Math.max(0, (fan.scrollWidth - fan.clientWidth) / 2);
  }, [isSelecting, selectionDeck]);

  useEffect(() => {
    const canvas = trailRef.current;
    if (!canvas || window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    type TrailParticle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; hue: number };
    let particles: TrailParticle[] = [];
    let animationFrame = 0;
    let lastX = -100;
    let lastY = -100;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const addTrail = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      const distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      const count = Math.min(3, Math.max(1, Math.ceil(distance / 16)));
      for (let index = 0; index < count; index += 1) {
        const progress = count === 1 ? 1 : index / (count - 1);
        const life = 28 + secureRandomIndex(18);
        particles.push({
          x: lastX < 0 ? event.clientX : lastX + (event.clientX - lastX) * progress,
          y: lastY < 0 ? event.clientY : lastY + (event.clientY - lastY) * progress,
          vx: (secureRandomIndex(100) - 50) / 220,
          vy: -.12 - secureRandomIndex(35) / 180,
          life,
          maxLife: life,
          size: 1.2 + secureRandomIndex(20) / 10,
          hue: secureRandomIndex(5) === 0 ? 267 : 42 + secureRandomIndex(10),
        });
      }
      particles = particles.slice(-82);
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const paint = () => {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.restore();
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
      animationFrame = window.requestAnimationFrame(paint);
    };

    resize();
    paint();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', addTrail, { passive: true });
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', addTrail);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2400);
  }

  function makeReading(cardList: DrawnCard[], createdAt = Date.now()): SavedReading {
    return {
      id: `${createdAt}-${Math.random().toString(36).slice(2,8)}`,
      createdAt,
      question,
      spread,
      cards: cardList.map((card) => ({ id: card.id, reversed: card.reversed })),
    };
  }

  function persistReading(cardList = drawn) {
    if (!cardList.length) return;
    const record = makeReading(cardList);
    setHistory((current) => {
      const next = [record, ...current].slice(0,30);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
    showNotice('本次解读已保存到这台设备');
  }

  function restoreReading(record: SavedReading) {
    const restored = record.cards.map((entry) => {
      const card = cards.find((item) => item.id === entry.id);
      return card ? { ...card, reversed: entry.reversed } : null;
    }).filter(Boolean) as DrawnCard[];
    if (restored.length !== spreadDefinitions[record.spread].positions.length) return;
    setSpread(record.spread);
    setQuestion(record.question);
    setDrawn(restored);
    setIsSharedReading(false);
    setView('reading');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function removeHistory(id: string) {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function readingText() {
    if (!drawn.length) return '';
    const structure = readingStructure(drawn, spread);
    const cardSections = drawn.map((card,index) => {
      const position = spreadInfo.positions[index];
      return `${String(index + 1).padStart(2,'0')} · ${position.name}｜${card.name}（${card.reversed ? '逆位' : '正位'}）\n关键词：${card.reversed ? card.reversed : card.upright}\n${positionMeaning(card, position)}\n爱情：${domainMeaning(card,'love')}\n事业：${domainMeaning(card,'career')}\n财运：${domainMeaning(card,'money')}\n健康：${domainMeaning(card,'health')}`;
    });
    return `星契 Tarot｜${spreadInfo.name}\n${question ? `问题：${question}\n` : ''}${synthesisText(drawn, spread)}\n\n能量结构：大阿卡纳 ${structure.majorCount}/${drawn.length}，逆位 ${structure.reversedCount}/${drawn.length}，主导元素 ${structure.dominantLabel}。\n主线：${structure.mainline}\n相邻关系：\n${structure.adjacency.join('\n')}\n最终建议：${structure.advice}\n\n${cardSections.join('\n\n')}\n\n塔罗呈现的是当下能量与可能路径，不替代现实证据与专业建议。`;
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
    return shuffledCards.map((card) => ({ ...card, reversed: secureRandomIndex(2) === 1 }));
  }

  function drawCards() {
    setIsShuffling(true);
    setDrawn([]);
    setSelectedCards([]);
    setIsSharedReading(false);
    window.setTimeout(() => {
      setSelectionDeck(shuffledDeck());
      setIsSelecting(true);
      setIsShuffling(false);
    }, 650);
  }

  function selectCard(card: DrawnCard) {
    const targetCount = spreadDefinitions[spread].positions.length;
    setSelectedCards((current) => {
      if (current.length >= targetCount || current.some((selected) => selected.id === card.id)) return current;
      return [...current, card];
    });
  }

  function reshuffleSelection() {
    setSelectedCards([]);
    setSelectionDeck(shuffledDeck());
  }

  function cancelSelection() {
    setIsSelecting(false);
    setSelectionDeck([]);
    setSelectedCards([]);
  }

  function revealSelection() {
    if (selectedCards.length !== spreadInfo.positions.length) return;
    setDrawn(selectedCards);
    persistReading(selectedCards);
    setIsSelecting(false);
    setSelectionDeck([]);
    setSelectedCards([]);
  }

  function reset() {
    setDrawn([]);
    setQuestion('');
    setSelectionDeck([]);
    setSelectedCards([]);
    setIsSelecting(false);
    setIsSharedReading(false);
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <canvas ref={trailRef} className="cursor-trail" aria-hidden="true" />
      <div className="stars" aria-hidden="true">
        {twinkleStars.map((style, index) => <span className={`twinkle-star ${index % 7 === 0 ? 'star-cross' : ''}`} style={style} key={`star-${index}`} />)}
      </div>
      <header className="site-header">
        <a href="#top" className="brand" aria-label="星契塔罗首页" onClick={() => setView('reading')}>
          <span className="brand-mark">✦</span><span>星契</span><span className="brand-en">TAROT</span>
        </a>
        <nav className="site-nav" aria-label="主要功能">
          <button className={view === 'reading' ? 'active' : ''} onClick={() => setView('reading')}><MoonStar aria-hidden="true" />抽牌</button>
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}><BookOpen aria-hidden="true" />牌库</button>
          <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><Clock3 aria-hidden="true" />历史</button>
        </nav>
      </header>

      {notice && <div className="site-notice" role="status">{notice}</div>}
      {view === 'reading' && (
      <section id="top" className={`reading-shell ${isSelecting ? 'selecting-mode' : ''}`}>
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

            <div className="fan-window" ref={fanRef}>
              <div className="fan-track" role="group" aria-label="78张塔罗牌背">
                {selectionDeck.map((card, index) => {
                  const selectedIndex = selectedCards.findIndex((selected) => selected.id === card.id);
                  const center = (selectionDeck.length - 1) / 2;
                  const style = {
                    '--fan-angle': `${(index - center) * .42}deg`,
                    '--fan-drop': `${Math.abs(index - center) * .55}px`,
                    '--fan-delay': `${Math.min(index * 12, 480)}ms`,
                  } as CSSProperties;
                  return (
                    <button
                      type="button"
                      key={`choose-${card.id}`}
                      className={`picker-card ${selectedIndex >= 0 ? 'selected' : ''}`}
                      style={style}
                      onClick={() => selectCard(card)}
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
              <button key={key} className={spread === key ? 'active' : ''} onClick={() => { setSpread(key); setDrawn([]); }}>
                <span>{definition.name}</span><small>{definition.countLabel} · {definition.description}</small>
              </button>
            ))}
          </div>

          <label className="question-label" htmlFor="question"><span>你想询问什么？</span><span>可选</span></label>
          <Textarea id="question" value={question} maxLength={80} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：我该如何看待眼前的变化？" className="question-box" />
          <p className="question-hint">试着问“我可以如何……”而不是只问“会不会”。</p>

          <div className="action-row">
            <Button onClick={drawCards} disabled={isShuffling} className="draw-button">
              <Sparkles aria-hidden="true" />{isShuffling ? '正在洗牌…' : drawn.length ? '重新抽牌' : '开始抽牌'}
            </Button>
            {drawn.length > 0 && <Button variant="ghost" onClick={reset} className="reset-button" aria-label="清除本次抽牌"><RotateCcw aria-hidden="true" /> 清空</Button>}
          </div>
          <p className="ritual-note">闭上眼睛，缓慢呼吸三次，然后在心里默念你的问题。</p>
        </div>

        <div className="table-panel" aria-live="polite">
          <img className="table-art" src="/og.png" alt="" aria-hidden="true" />
          <div className="moon-orbit" aria-hidden="true"><span>☾</span></div>
          <p className="table-kicker">{drawn.length ? 'YOUR READING' : 'THE CARDS ARE WAITING'}</p>
          <h2>{drawn.length ? '牌面已为你展开' : subtitle}</h2>

          <div className={`card-stage spread-${spread} ${spreadInfo.positions.length === 3 ? 'three-card' : ''} ${spreadInfo.positions.length > 3 ? 'large-spread' : ''} ${isShuffling ? 'shuffling' : ''}`}>
            {(drawn.length ? drawn : Array.from({ length: spreadInfo.positions.length })).map((item, index) => {
              const card = item as DrawnCard | undefined;
              return (
                <div className="position-card" key={card?.id ?? `back-${index}`}>
                <span className="stage-position"><b>{String(index + 1).padStart(2, '0')}</b>{spreadInfo.positions[index].short}</span>
                <article className={`tarot-card ${card ? 'revealed' : ''}`} key={card?.id ?? `back-${index}`} style={{ animationDelay: `${index * 150}ms` }}>
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
          </div>

          {drawn.length > 0 ? (
            <div className="interpretations">
              {isSharedReading && <div className="shared-reading-banner"><Link2 aria-hidden="true" /><span><b>只读分享解读</b>你正在查看由分享链接还原的牌阵；它不会自动写入你的历史记录。</span></div>}
              <section className="reading-overview">
                <span className="overview-label">本次牌阵总览</span>
                <h3>{spreadInfo.name} · {drawn.length} 张</h3>
                <p>{synthesisText(drawn, spread)}</p>
                {spreadInfo.positions.length > 1 && (
                  <div className={`overview-path ${spreadInfo.positions.length > 3 ? 'many' : ''}`}>
                    {spreadInfo.positions.map((position, index) => (
                      <span key={position.name}><b>{String(index + 1).padStart(2, '0')} · {position.short}</b>{drawn[index].name}{drawn[index].reversed ? '（逆位）' : '（正位）'}</span>
                    ))}
                  </div>
                )}
                <div className="reading-tools" aria-label="保存与分享">
                  <button onClick={() => persistReading()}><Save aria-hidden="true" />保存本次解读</button>
                  <button onClick={copyFullReading}><Copy aria-hidden="true" />复制完整文字</button>
                  <button onClick={exportShareImage}><Download aria-hidden="true" />导出分享图</button>
                  <button onClick={copyShareLink}><Link2 aria-hidden="true" />复制只读链接</button>
                </div>
              </section>

              {structure && <section className="structure-reading">
                <div className="structure-heading"><span>跨牌综合分析</span><h3>牌与牌之间如何共同说话</h3></div>
                <div className="structure-stats">
                  <div><span>大阿卡纳比例</span><b>{structure.majorCount}／{drawn.length}</b><small>{structure.majorCount > drawn.length / 2 ? '重大人生课题主导' : '日常选择与现实事件主导'}</small></div>
                  <div><span>正逆位结构</span><b>{drawn.length - structure.reversedCount} 正 · {structure.reversedCount} 逆</b><small>{structure.reversedCount > drawn.length / 2 ? '先整理阻力再推进' : '可用行动能量较多'}</small></div>
                  <div><span>主导元素</span><b>{structure.dominantLabel}</b><small>权杖{structure.suits.wands} · 圣杯{structure.suits.cups} · 宝剑{structure.suits.swords} · 星币{structure.suits.pentacles}</small></div>
                  <div><span>数字与宫廷牌</span><b>{structure.repeats.length ? structure.repeats.join(' · ') : '无重复数字'}</b><small>宫廷牌 {structure.courts} 张</small></div>
                </div>
                <div className="structure-narrative">
                  <section><span>牌阵主线</span><p>{structure.mainline}</p></section>
                  <section><span>转折与相邻关系</span><ol>{structure.adjacency.map((note,index) => <li key={`${index}-${note}`}>{note}</li>)}</ol></section>
                  <section className="structure-advice"><span>最终整合建议</span><p>{structure.advice}</p></section>
                </div>
              </section>}

              {drawn.map((card, index) => {
                const guide = guideFor(card);
                return (
                <details className="interpretation detailed-reading" key={`reading-${card.id}`} open={drawn.length <= 3}>
                  <summary className="reading-summary">
                  <div className="interpretation-heading">
                    <span>{String(index + 1).padStart(2, '0')} · {spreadInfo.positions[index].name}</span>
                    <strong>{card.name} · {card.reversed ? '逆位' : '正位'} <small>{card.arcana === 'minor' ? `${card.suitLabel}／${card.element}` : '大阿卡纳'}</small></strong>
                  </div>
                  <p className="keywords">{card.reversed ? card.reversed : card.upright}</p>
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
              <div className="encyclopedia-pair">
                <section><h3>标准正位</h3><b>{libraryCard.upright}</b><p>{libraryCard.uprightMeaning}</p></section>
                <section><h3>标准逆位</h3><b>{libraryCard.reversed}</b><p>{libraryCard.reversedMeaning}</p></section>
              </div>
              <section><h3>爱情、事业、财运与健康</h3><div className="encyclopedia-domains">
                <p><b>爱情</b>{domainMeaning({ ...libraryCard, reversed: false },'love')}</p>
                <p><b>事业</b>{domainMeaning({ ...libraryCard, reversed: false },'career')}</p>
                <p><b>财运</b>{domainMeaning({ ...libraryCard, reversed: false },'money')}</p>
                <p><b>健康</b>{domainMeaning({ ...libraryCard, reversed: false },'health')}</p>
              </div></section>
              <section><h3>不同牌阵位置</h3><div className="position-examples">
                {[spreadDefinitions.three.positions[0],spreadDefinitions.celtic.positions[1],spreadDefinitions.career.positions[5],spreadDefinitions.relationship.positions[6]].map((position) => (
                  <p key={position.name}><b>{position.name}</b>{positionMeaning({ ...libraryCard, reversed: false },position)}</p>
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
            <p className="eyebrow"><span /> YOUR READING ARCHIVE</p>
            <h1>历史解读</h1>
            <p>最近30次解读保存在当前设备中，不会上传你的问题。打开记录后可以继续复制、导出或生成只读链接。</p>
          </div>
          {history.length ? <div className="history-list">
            {history.map((record) => {
              const definition = spreadDefinitions[record.spread];
              const previewCards = record.cards.slice(0,5).map((entry) => cards.find((card) => card.id === entry.id)).filter(Boolean) as TarotCard[];
              return <article key={record.id} className="history-item">
                <div className="history-card-stack">{previewCards.map((card,index) => <img key={`${record.id}-${card.id}`} src={cardImagePath(card)} alt="" style={{ transform: `translateX(${index * 24}px) rotate(${(index - 2) * 3}deg)` }} />)}</div>
                <div className="history-copy"><span>{new Date(record.createdAt).toLocaleString('zh-CN')}</span><h2>{definition.name} · {record.cards.length}张</h2><p>{record.question || '未填写问题'}</p></div>
                <div className="history-actions"><Button onClick={() => restoreReading(record)}>打开解读</Button><button onClick={() => removeHistory(record.id)}>删除</button></div>
              </article>;
            })}
          </div> : <div className="history-empty"><span>☾</span><h2>还没有保存的解读</h2><p>完成一次抽牌后，记录会自动出现在这里。</p><Button onClick={() => setView('reading')}>开始第一次抽牌</Button></div>}
        </section>
      )}

      <footer><span>星契 TAROT</span><p>把牌当作一面镜子，把选择留在自己手中。</p></footer>
    </main>
  );
}
