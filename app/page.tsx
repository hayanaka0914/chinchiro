'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ResultType = 'good' | 'bad' | 'normal';

type JudgeResult = {
  name: string;
  detail: string;
  payoutMultiplier: number;
  type: ResultType;
  isRole: boolean;
};

type LogItem = {
  id: number;
  text: string;
  kind: 'plus' | 'minus' | 'neutral';
};

const INITIAL_BANKROLL = 1000;
const INITIAL_BET = 100;
const MAX_REROLLS = 2;

const pipMap: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function randomDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function countValues(arr: number[]) {
  return arr.reduce<Record<number, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function judgeChinchiro(dice: number[]): JudgeResult {
  const sorted = [...dice].sort((a, b) => a - b);
  const [a, b, c] = sorted;
  const counts = countValues(sorted);
  const entries = Object.entries(counts).sort((x, y) => Number(y[1]) - Number(x[1]));

  if (a === 1 && b === 1 && c === 1) {
    return {
      name: 'ピンゾロ',
      detail: '最強役。BETの5倍を獲得。',
      payoutMultiplier: 5,
      type: 'good',
      isRole: true,
    };
  }

  if (a === 4 && b === 5 && c === 6) {
    return {
      name: 'シゴロ',
      detail: '強役。BETの2倍を獲得。',
      payoutMultiplier: 2,
      type: 'good',
      isRole: true,
    };
  }

  if (a === 1 && b === 2 && c === 3) {
    return {
      name: 'ヒフミ',
      detail: '負け役。BET分を失います。',
      payoutMultiplier: -1,
      type: 'bad',
      isRole: true,
    };
  }

  if (a === b && b === c) {
    return {
      name: `${a}のゾロ目`,
      detail: 'ゾロ目。BETの3倍を獲得。',
      payoutMultiplier: 3,
      type: 'good',
      isRole: true,
    };
  }

  if (entries[0] && Number(entries[0][1]) === 2) {
    const pairValue = Number(entries[0][0]);
    const singleValue = Number(entries[1][0]);
    return {
      name: `${singleValue}の目`,
      detail: `${pairValue}が2つ揃い、${singleValue}の目が成立。BETと同額を獲得。`,
      payoutMultiplier: 1,
      type: 'normal',
      isRole: true,
    };
  }

  return {
    name: '役なし',
    detail: '2回まで振り直し可能です。',
    payoutMultiplier: 0,
    type: 'bad',
    isRole: false,
  };
}

function Dice({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div className={`die ${rolling ? 'rolling' : ''}`}>
      {Array.from({ length: 9 }).map((_, index) => (
        <span
          key={index}
          className={`pip ${pipMap[value]?.includes(index) ? 'show' : ''}`}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [dice, setDice] = useState([1, 2, 3]);
  const [bankroll, setBankroll] = useState(INITIAL_BANKROLL);
  const [bet, setBet] = useState(INITIAL_BET);
  const [rolling, setRolling] = useState(false);
  const [role, setRole] = useState<JudgeResult>({
    name: '待機中',
    detail: 'BETしてサイコロを振ってください。',
    payoutMultiplier: 0,
    type: 'normal',
    isRole: false,
  });
  const [rerollsUsed, setRerollsUsed] = useState(0);
  const [roundActive, setRoundActive] = useState(false);
  const [currentBetLocked, setCurrentBetLocked] = useState(0);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const audioUnlockedRef = useRef(false);

  const sortedDiceText = useMemo(() => [...dice].sort((a, b) => a - b).join(' / '), [dice]);
  const remainingRerolls = MAX_REROLLS - rerollsUsed;

  useEffect(() => {
    if (bet > bankroll) {
      setBet(bankroll > 0 ? bankroll : 1);
    }
  }, [bankroll, bet]);

  const unlockAudio = async () => {
    if (audioUnlockedRef.current || typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    audioUnlockedRef.current = true;
    setTimeout(() => {
      void ctx.close();
    }, 10);
  };

  const playRollSound = () => {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const notes = [380, 470, 620];

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === 2 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(freq, now + index * 0.03);
      gain.gain.setValueAtTime(0.0001, now + index * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02 + index * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14 + index * 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.03);
      osc.stop(now + 0.18 + index * 0.05);
    });

    setTimeout(() => {
      void ctx.close();
    }, 260);
  };

  const animateRoll = async () => {
    setRolling(true);
    playRollSound();

    for (let i = 0; i < 8; i += 1) {
      setDice([randomDie(), randomDie(), randomDie()]);
      await new Promise((resolve) => setTimeout(resolve, 85));
    }

    const finalDice = [randomDie(), randomDie(), randomDie()];
    setDice(finalDice);
    setRolling(false);
    return finalDice;
  };

  const pushLog = (text: string, kind: LogItem['kind']) => {
    setLogs((prev) => [{ id: Date.now() + Math.random(), text, kind }, ...prev].slice(0, 12));
  };

  const settleRound = (result: JudgeResult, lockedBet: number, rolledDice: number[]) => {
    const sorted = [...rolledDice].sort((a, b) => a - b).join(' / ');

    if (result.payoutMultiplier > 0) {
      const delta = lockedBet * result.payoutMultiplier;
      setBankroll((prev) => prev + delta);
      pushLog(`出目 ${sorted} → ${result.name} / +${delta}枚`, 'plus');
    } else if (result.payoutMultiplier < 0) {
      const delta = lockedBet;
      setBankroll((prev) => Math.max(0, prev - delta));
      pushLog(`出目 ${sorted} → ${result.name} / -${delta}枚`, 'minus');
    } else {
      pushLog(`出目 ${sorted} → ${result.name}`, 'neutral');
    }

    setRoundActive(false);
    setCurrentBetLocked(0);
    setRerollsUsed(0);
  };

  const handleRoll = async () => {
    if (rolling) return;
    await unlockAudio();

    if (bankroll <= 0) {
      setRole({
        name: 'ゲームオーバー',
        detail: '所持金が0枚です。リセットしてください。',
        payoutMultiplier: 0,
        type: 'bad',
        isRole: false,
      });
      return;
    }

    let lockedBet = currentBetLocked;
    if (!roundActive) {
      const safeBet = Math.max(1, Math.min(bet, bankroll));
      setBet(safeBet);
      lockedBet = safeBet;
      setCurrentBetLocked(safeBet);
      setRoundActive(true);
      setRerollsUsed(0);
    }

    const rolledDice = await animateRoll();
    const result = judgeChinchiro(rolledDice);
    setRole(result);

    if (!result.isRole) {
      const nextRerolls = rerollsUsed + 1;
      setRerollsUsed(nextRerolls);

      if (nextRerolls > MAX_REROLLS) {
        const failResult: JudgeResult = {
          name: '役なしで終了',
          detail: '3回振っても役が出なかったため、このラウンドはBET分没収です。',
          payoutMultiplier: -1,
          type: 'bad',
          isRole: true,
        };
        setRole(failResult);
        settleRound(failResult, lockedBet, rolledDice);
      }
      return;
    }

    settleRound(result, lockedBet, rolledDice);
  };

  const handleReset = () => {
    setDice([1, 2, 3]);
    setBankroll(INITIAL_BANKROLL);
    setBet(INITIAL_BET);
    setRolling(false);
    setRole({
      name: '待機中',
      detail: 'BETしてサイコロを振ってください。',
      payoutMultiplier: 0,
      type: 'normal',
      isRole: false,
    });
    setRerollsUsed(0);
    setRoundActive(false);
    setCurrentBetLocked(0);
    setLogs([]);
  };

  const handleBetChange = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setBet(1);
      return;
    }
    setBet(Math.max(1, Math.min(parsed, bankroll || 1)));
  };

  return (
    <main className="page">
      <section className="shell">
        <header className="hero panel">
          <div>
            <p className="eyebrow">Smartphone Chinchiro</p>
            <h1>🎲 チンチロ</h1>
            <p className="lead">通常ルールベース。役なしなら2回まで振り直し可能です。</p>
          </div>
          <div className="stats">
            <div className="statCard">
              <span>所持金</span>
              <strong>{bankroll}枚</strong>
            </div>
            <div className="statCard">
              <span>今回のBET</span>
              <strong>{roundActive ? currentBetLocked : bet}枚</strong>
            </div>
          </div>
        </header>

        <section className="panel board">
          <div className="diceRow">
            {dice.map((value, index) => (
              <Dice key={`${index}-${value}-${rolling ? 'r' : 's'}`} value={value} rolling={rolling} />
            ))}
          </div>

          <div className="resultCard">
            <div className="numbers">出目：{sortedDiceText}</div>
            <div className={`role ${role.type}`}>{role.name}</div>
            <p className="detail">{role.detail}</p>
            <div className="rerollInfo">
              {roundActive && !role.isRole
                ? `振り直し残り：${Math.max(0, remainingRerolls)}`
                : '次のラウンドを開始できます'}
            </div>
          </div>

          <div className="controls">
            <div className="betBlock">
              <label htmlFor="bet">BET枚数</label>
              <div className="betLine">
                <input
                  id="bet"
                  type="number"
                  min={1}
                  max={Math.max(1, bankroll)}
                  value={roundActive ? currentBetLocked : bet}
                  onChange={(e) => handleBetChange(e.target.value)}
                  disabled={roundActive}
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="subButton"
                  disabled={roundActive || bankroll <= 0}
                  onClick={() => setBet(Math.max(1, bankroll))}
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="actionRow">
              <button type="button" className="mainButton" onClick={handleRoll} disabled={rolling || bankroll <= 0}>
                {roundActive ? '振り直す / 続行する' : 'サイコロを振る'}
              </button>
              <button type="button" className="subButton" onClick={handleReset}>
                リセット
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="sectionTitle">履歴</div>
          <div className="logList">
            {logs.length === 0 ? (
              <div className="emptyLog">まだ履歴がありません。</div>
            ) : (
              logs.map((item) => (
                <div key={item.id} className={`logItem ${item.kind}`}>
                  {item.text}
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
