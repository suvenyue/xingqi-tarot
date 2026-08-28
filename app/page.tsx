'use client';

import { useMemo, useState } from 'react';
import { MoonStar, RotateCcw, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Spread = 'single' | 'three';
type TarotCard = {
  id: number;
  name: string;
  en: string;
  glyph: string;
  upright: string;
  reversed: string;
  message: string;
};

const cards: TarotCard[] = [
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

type DrawnCard = TarotCard & { reversed: boolean };
const positions = ['过往', '当下', '趋势'];

export default function Home() {
  const [spread, setSpread] = useState<Spread>('single');
  const [question, setQuestion] = useState('');
  const [drawn, setDrawn] = useState<DrawnCard[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);

  const subtitle = useMemo(
    () => (spread === 'single' ? '为此刻抽取一张指引牌' : '以过往、当下、趋势展开三张牌'),
    [spread],
  );

  function drawCards() {
    setIsShuffling(true);
    setDrawn([]);
    window.setTimeout(() => {
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      const count = spread === 'single' ? 1 : 3;
      setDrawn(shuffled.slice(0, count).map((card) => ({ ...card, reversed: Math.random() < 0.28 })));
      setIsShuffling(false);
    }, 650);
  }

  function reset() {
    setDrawn([]);
    setQuestion('');
  }

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="stars" aria-hidden="true" />
      <header className="site-header">
        <a href="#top" className="brand" aria-label="星契塔罗首页">
          <span className="brand-mark">✦</span><span>星契</span><span className="brand-en">TAROT</span>
        </a>
        <span className="header-note"><MoonStar aria-hidden="true" /> 静心 · 提问 · 抽牌</span>
      </header>

      <section id="top" className="reading-shell">
        <div className="intro-panel">
          <p className="eyebrow"><span /> A QUIET MOMENT FOR YOU</p>
          <h1>让牌面映见<br />你心中的答案</h1>
          <p className="intro-copy">塔罗不替你预言命运，它只是借由象征与直觉，照亮你已经感受到、却还没说出口的事。</p>

          <div className="spread-switch" aria-label="选择牌阵">
            <button className={spread === 'single' ? 'active' : ''} onClick={() => { setSpread('single'); setDrawn([]); }}>
              单牌指引 <small>一张牌</small>
            </button>
            <button className={spread === 'three' ? 'active' : ''} onClick={() => { setSpread('three'); setDrawn([]); }}>
              三牌展开 <small>过往 · 当下 · 趋势</small>
            </button>
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

          <div className={`card-stage ${spread === 'three' ? 'three-card' : ''} ${isShuffling ? 'shuffling' : ''}`}>
            {(drawn.length ? drawn : Array.from({ length: spread === 'single' ? 1 : 3 })).map((item, index) => {
              const card = item as DrawnCard | undefined;
              return (
                <article className={`tarot-card ${card ? 'revealed' : ''}`} key={card?.id ?? `back-${index}`} style={{ animationDelay: `${index * 150}ms` }}>
                  {card ? (
                    <div className={`card-face ${card.reversed ? 'is-reversed' : ''}`}>
                      <span className="card-number">{String(card.id).padStart(2, '0')}</span><span className="corner-star">✦</span>
                      <div className="card-arch"><span className="card-glyph">{card.glyph}</span><span className="orbit-dot" /></div>
                      <div className="card-title"><strong>{card.name}</strong><span>{card.en}</span></div>
                    </div>
                  ) : (
                    <div className="card-back" aria-label="尚未翻开的塔罗牌">
                      <span className="back-corner">✦</span><div className="back-orbit"><span>☽</span></div><span className="back-label">STELLA ARCANA</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {drawn.length > 0 ? (
            <div className="interpretations">
              {drawn.map((card, index) => (
                <article className="interpretation" key={`reading-${card.id}`}>
                  <div className="interpretation-heading"><span>{spread === 'three' ? positions[index] : '此刻的指引'}</span><strong>{card.name} · {card.reversed ? '逆位' : '正位'}</strong></div>
                  <p className="keywords">{card.reversed ? card.reversed : card.upright}</p><p>{card.message}</p>
                </article>
              ))}
              {question && <p className="question-echo">“{question}”</p>}
            </div>
          ) : (
            <div className="empty-guidance"><span>✦</span><p>没有标准答案，只有值得被你听见的提醒。</p></div>
          )}
        </div>
      </section>

      <footer><span>星契 TAROT</span><p>把牌当作一面镜子，把选择留在自己手中。</p></footer>
    </main>
  );
}
