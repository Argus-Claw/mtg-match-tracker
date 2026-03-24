import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useGames } from '../hooks/useGames'
import {
  DndContext,
  closestCenter,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSwappingStrategy,
  useSortable,
  arraySwap,
} from '@dnd-kit/sortable'
import Modal from './Modal'
import './GameSession.css'

// --- Constants ---
const MANA_COLORS = {
  W: { name: 'Plains', color: '#F9FAF4', accent: '#E8D8A0', dark: '#3D3526' },
  U: { name: 'Island', color: '#0E68AB', accent: '#1A9BD7', dark: '#0A2A44' },
  B: { name: 'Swamp', color: '#2B2B2B', accent: '#6B5E5E', dark: '#150B1E' },
  R: { name: 'Mountain', color: '#D32029', accent: '#F0613A', dark: '#3A0A0A' },
  G: { name: 'Forest', color: '#00733E', accent: '#1A9B50', dark: '#0A2A15' },
}

const THEMES = [
  { id: 'obsidian', name: 'Obsidian', bg: '#0D0D0F', card: '#18181B', accent: '#A78BFA', text: '#E4E4E7', muted: '#71717A', border: '#27272A', glow: 'rgba(167,139,250,0.15)' },
  { id: 'blood', name: 'Blood Moon', bg: '#110808', card: '#1C0F0F', accent: '#EF4444', text: '#FCA5A5', muted: '#7F5555', border: '#2D1515', glow: 'rgba(239,68,68,0.15)' },
  { id: 'azorius', name: 'Azorius', bg: '#080C14', card: '#0F1724', accent: '#60A5FA', text: '#BFDBFE', muted: '#5577AA', border: '#1E2A40', glow: 'rgba(96,165,250,0.15)' },
  { id: 'golgari', name: 'Golgari', bg: '#0A0E08', card: '#141C10', accent: '#84CC16', text: '#D9F99D', muted: '#5A7744', border: '#1E2D15', glow: 'rgba(132,204,22,0.15)' },
  { id: 'orzhov', name: 'Orzhov', bg: '#0E0D0B', card: '#1A1814', accent: '#D4AF37', text: '#FDE68A', muted: '#8A7744', border: '#2D2815', glow: 'rgba(212,175,55,0.15)' },
]

const ROTATION_CYCLE = { 0: 90, 90: 270, 270: 180, 180: 0 }

function haptic() {
  if (navigator.vibrate) navigator.vibrate(10)
}

// --- SVG Icons ---
function DiceIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" /><circle cx="16" cy="8" r="1.2" fill="currentColor" />
      <circle cx="8" cy="16" r="1.2" fill="currentColor" /><circle cx="16" cy="16" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}

function CoinIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M8 8.5c0-1.5 1.8-2.5 4-2.5s4 1 4 2.5-1.8 2.5-4 3.5-4 2-4 3.5 1.8 2.5 4 2.5 4-1 4-2.5" />
    </svg>
  )
}

function SkullIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 3.07 1.39 5.81 3.57 7.63L6 22h4v-2h4v2h2.43l.43-2.37C19.61 17.81 21 15.07 21 12c0-5.52-4.48-10-9-10zm-3 13a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>
}

function BoltIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" /></svg>
}

function StarIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" /></svg>
}

function SwordsIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20L20 4M14 4l6 0 0 6M4 20l4-4" /><path d="M20 20L4 4M10 4L4 4l0 6M20 20l-4-4" opacity="0.5" /></svg>
}

function HistoryIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>
}

function FullscreenIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
}

function EyeIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}

function EyeOffIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}

// --- Sub-components ---
function RotatedCardWrapper({ rotation, children }) {
  const containerRef = useRef(null)
  const [dims, setDims] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
      <div style={{
        position: 'absolute',
        width: dims ? dims.height : '100%',
        height: dims ? dims.width : '100%',
        top: '50%', left: '50%',
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  )
}

function AnimatedNumber({ value, theme }) {
  const [display, setDisplay] = useState(value)
  const [flash, setFlash] = useState(null)
  const prevVal = useRef(value)
  useEffect(() => {
    if (value !== prevVal.current) {
      setFlash(value > prevVal.current ? 'up' : 'down')
      const timeout = setTimeout(() => setFlash(null), 400)
      setDisplay(value)
      prevVal.current = value
      return () => clearTimeout(timeout)
    }
  }, [value])
  return (
    <span style={{
      transition: 'color 0.3s, text-shadow 0.3s',
      color: flash === 'up' ? '#4ADE80' : flash === 'down' ? '#F87171' : theme.text,
      textShadow: flash ? `0 0 20px ${flash === 'up' ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)'}` : 'none',
    }}>
      {display}
    </span>
  )
}

function PlayerCard({ player, players, theme, isCommander, onUpdate, onRemove, isMinimized, onToggleMinimize, isDesktop, onEditPlayer }) {
  const [showCommander, setShowCommander] = useState(false)
  const [showCounters, setShowCounters] = useState(false)
  const [lifeFlash, setLifeFlash] = useState(null)
  const prevLife = useRef(player.life)
  const lifeTapRef = useRef(null)
  const [pendingDelta, setPendingDelta] = useState(0)
  const [deltaFading, setDeltaFading] = useState(false)
  const deltaTimeoutRef = useRef(null)
  const deltaFadeRef = useRef(null)
  const manaColor = MANA_COLORS[player.color] || MANA_COLORS.W
  const commanderLethal = isCommander && player.commanderDamage && Object.values(player.commanderDamage).some(d => d >= 21)
  const isDead = player.life <= 0 || player.poison >= 10 || commanderLethal

  useEffect(() => {
    if (player.life !== prevLife.current) {
      setLifeFlash(player.life > prevLife.current ? 'gain' : 'loss')
      const timeout = setTimeout(() => setLifeFlash(null), 2500)
      prevLife.current = player.life
      return () => clearTimeout(timeout)
    }
  }, [player.life])

  useEffect(() => {
    return () => { clearTimeout(deltaTimeoutRef.current); clearTimeout(deltaFadeRef.current) }
  }, [])

  const handleLifeTap = (e) => {
    haptic()
    const rect = lifeTapRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const rotation = player.rotation || 0
    let isIncrease
    if (rotation === 90) isIncrease = e.clientY >= centerY
    else if (rotation === 270) isIncrease = e.clientY < centerY
    else if (rotation === 180) isIncrease = e.clientX < centerX
    else isIncrease = e.clientX >= centerX
    const change = isIncrease ? 1 : -1
    onUpdate({ life: player.life + change })
    clearTimeout(deltaTimeoutRef.current)
    clearTimeout(deltaFadeRef.current)
    setDeltaFading(false)
    setPendingDelta(prev => prev + change)
    deltaTimeoutRef.current = setTimeout(() => {
      setDeltaFading(true)
      deltaFadeRef.current = setTimeout(() => { setPendingDelta(0); setDeltaFading(false) }, 500)
    }, 2000)
  }

  const handleButton = (fn) => (e) => { haptic(); fn(e) }

  if (isMinimized) {
    return (
      <div onClick={() => { haptic(); onToggleMinimize() }} style={{
        background: `linear-gradient(135deg, ${theme.card}, ${manaColor.dark})`,
        border: `1px solid ${isDead ? '#7F1D1D' : theme.border}`,
        borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        opacity: isDead ? 0.5 : 1, transition: 'all 0.3s ease',
      }}>
        <span style={{ color: theme.text, fontFamily: "'Cinzel', serif", fontSize: 14 }}>{player.name}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {player.poison > 0 && <span style={{ color: '#84CC16', fontSize: 12 }}>{'\u2620'} {player.poison}</span>}
          <span style={{ color: isDead ? '#EF4444' : theme.accent, fontFamily: "'Cinzel', serif", fontSize: 22, fontWeight: 700 }}>{player.life}</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: `linear-gradient(145deg, ${theme.card} 0%, ${manaColor.dark} 100%)`,
      border: `1px solid ${isDead ? '#7F1D1D' : theme.border}`,
      borderRadius: 16, padding: 0, position: 'relative', overflow: 'hidden',
      transition: 'all 0.4s ease',
      boxShadow: isDead ? 'inset 0 0 40px rgba(127,29,29,0.3)' : `0 4px 24px ${theme.glow}`,
      flex: 1, display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${manaColor.color}, ${manaColor.accent}, transparent)` }} />
      <div style={{ padding: isDesktop ? '16px 20px 0' : (players.length >= 3 ? '8px 8px 0' : '12px 16px 0'), display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: isDesktop ? 8 : 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: players.length >= 3 ? 4 : 8, overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <span onClick={() => onEditPlayer && onEditPlayer(player)} style={{ color: theme.text, fontFamily: "'Cinzel', serif", fontSize: isDesktop ? 22 : 14, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em', borderBottom: `1px dashed ${theme.muted}44`, paddingBottom: 1 }}>{player.name}</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {Object.entries(MANA_COLORS).map(([key, mc]) => (
              <div key={key} onClick={handleButton(() => onUpdate({ color: key }))} style={{ width: isDesktop ? 20 : 14, height: isDesktop ? 20 : 14, borderRadius: '50%', background: mc.color, cursor: 'pointer', border: player.color === key ? `2px solid ${theme.text}` : '2px solid transparent', transition: 'all 0.2s' }} />
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={handleButton(onToggleMinimize)} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: theme.text, cursor: 'pointer', fontSize: isDesktop ? 18 : 14, fontWeight: 700, padding: isDesktop ? '6px 14px' : '4px 10px', lineHeight: 1, minWidth: isDesktop ? 36 : 28, textAlign: 'center' }}>{'\u2212'}</button>
          {players.length > 2 && (
            <button onClick={handleButton(onRemove)} style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 6, color: '#F87171', cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: '4px 10px', lineHeight: 1, minWidth: 28, textAlign: 'center' }}>{'\u2715'}</button>
          )}
        </div>
      </div>

      <div ref={lifeTapRef} onClick={handleLifeTap} style={{
        padding: isDesktop ? '24px 20px 20px' : '16px 16px 14px', textAlign: 'center', cursor: 'pointer', position: 'relative',
        userSelect: 'none', WebkitTapHighlightColor: 'transparent', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        background: lifeFlash === 'gain' ? 'rgba(74,222,128,0.15)' : lifeFlash === 'loss' ? 'rgba(248,113,113,0.15)' : 'transparent',
        transition: 'background 0.8s ease-out',
      }}>
        <span style={{ position: 'absolute', pointerEvents: 'none', fontSize: isDesktop ? 48 : 28, fontWeight: 300, color: theme.muted, opacity: 0.25, left: isDesktop ? 24 : 16, top: '50%', transform: 'translateY(-50%)' }}>{'\u2212'}</span>
        <span style={{ position: 'absolute', pointerEvents: 'none', fontSize: isDesktop ? 48 : 28, fontWeight: 300, color: theme.muted, opacity: 0.25, right: isDesktop ? 24 : 16, top: '50%', transform: 'translateY(-50%)' }}>+</span>
        {pendingDelta !== 0 && (
          <div style={{
            fontSize: isDesktop ? 36 : 22, fontWeight: 700, fontFamily: "'Cinzel', serif",
            color: pendingDelta > 0 ? '#4ADE80' : '#F87171',
            textShadow: `0 0 12px ${pendingDelta > 0 ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)'}`,
            opacity: deltaFading ? 0 : 1, transition: 'opacity 0.5s ease-out', lineHeight: 1, marginBottom: 2,
          }}>
            {pendingDelta > 0 ? `+${pendingDelta}` : pendingDelta}
          </div>
        )}
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: isDesktop ? (players.length <= 2 ? 160 : players.length === 3 ? 120 : 100) : 80, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>
          <AnimatedNumber value={player.life} theme={theme} />
        </div>
        <div style={{ fontSize: isDesktop ? 18 : 12, color: theme.muted, letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: isDesktop ? 8 : 2 }}>Life Total</div>
      </div>

      <div style={{ display: 'flex', gap: isDesktop ? 8 : 6, padding: isDesktop ? '0 20px 10px' : '0 16px 8px', flexWrap: 'wrap' }}>
        {player.poison > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: isDesktop ? 6 : 4, background: 'rgba(132,204,22,0.12)', border: '1px solid rgba(132,204,22,0.25)', borderRadius: 20, padding: isDesktop ? '5px 14px' : '3px 10px', fontSize: isDesktop ? 16 : 12, color: '#84CC16' }}>
            <SkullIcon size={isDesktop ? 16 : 12} /> {player.poison}
          </span>
        )}
        {player.energy > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: isDesktop ? 6 : 4, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 20, padding: isDesktop ? '5px 14px' : '3px 10px', fontSize: isDesktop ? 16 : 12, color: '#FBBF24' }}>
            <BoltIcon size={isDesktop ? 16 : 12} /> {player.energy}
          </span>
        )}
        {player.experience > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: isDesktop ? 6 : 4, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 20, padding: isDesktop ? '5px 14px' : '3px 10px', fontSize: isDesktop ? 16 : 12, color: '#A78BFA' }}>
            <StarIcon size={isDesktop ? 16 : 12} /> {player.experience}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', borderTop: `1px solid ${theme.border}` }}>
        <button onClick={handleButton(() => setShowCounters(!showCounters))} style={{
          flex: 1, padding: isDesktop ? '14px 0' : '12px 0', background: showCounters ? theme.glow : 'rgba(255,255,255,0.03)', border: 'none',
          borderBottom: showCounters ? `2px solid ${theme.accent}` : '2px solid transparent',
          color: showCounters ? theme.accent : theme.text, fontSize: isDesktop ? 16 : 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
          fontFamily: "'Cinzel', serif", transition: 'all 0.2s', borderRight: `1px solid ${theme.border}`,
        }}>Counters</button>
        {isCommander && (
          <button onClick={handleButton(() => setShowCommander(!showCommander))} style={{
            flex: 1, padding: isDesktop ? '14px 0' : '12px 0', background: showCommander ? theme.glow : 'rgba(255,255,255,0.03)', border: 'none',
            borderBottom: showCommander ? `2px solid ${theme.accent}` : '2px solid transparent',
            color: showCommander ? theme.accent : theme.text, fontSize: isDesktop ? 16 : 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
            fontFamily: "'Cinzel', serif", transition: 'all 0.2s',
          }}><SwordsIcon size={isDesktop ? 18 : 14} /> Cmd Dmg</button>
        )}
      </div>

      {showCounters && (
        <div style={{ padding: isDesktop ? 16 : 12, borderTop: `1px solid ${theme.border}`, background: 'rgba(0,0,0,0.2)' }}>
          {[
            { label: 'Poison', key: 'poison', icon: <SkullIcon size={isDesktop ? 18 : 14} />, color: '#84CC16' },
            { label: 'Energy', key: 'energy', icon: <BoltIcon size={isDesktop ? 18 : 14} />, color: '#FBBF24' },
            { label: 'Experience', key: 'experience', icon: <StarIcon size={isDesktop ? 18 : 14} />, color: '#A78BFA' },
          ].map((counter) => (
            <div key={counter.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isDesktop ? '8px 0' : '6px 0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 8 : 6, color: counter.color, fontSize: isDesktop ? 16 : 12 }}>{counter.icon} {counter.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 12 : 8 }}>
                <button onClick={handleButton(() => onUpdate({ [counter.key]: Math.max(0, player[counter.key] - 1) }))} style={{ width: isDesktop ? 40 : 28, height: isDesktop ? 40 : 28, borderRadius: 6, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: isDesktop ? 22 : 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2212'}</button>
                <span style={{ color: counter.color, fontFamily: "'Cinzel', serif", fontSize: isDesktop ? 24 : 18, fontWeight: 700, minWidth: isDesktop ? 32 : 24, textAlign: 'center' }}>{player[counter.key]}</span>
                <button onClick={handleButton(() => onUpdate({ [counter.key]: player[counter.key] + 1 }))} style={{ width: isDesktop ? 40 : 28, height: isDesktop ? 40 : 28, borderRadius: 6, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', fontSize: isDesktop ? 22 : 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCommander && isCommander && (
        <div style={{ padding: isDesktop ? 16 : 12, borderTop: `1px solid ${theme.border}`, background: 'rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: isDesktop ? 14 : 10, color: theme.muted, marginBottom: isDesktop ? 12 : 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Commander Damage Taken From:</div>
          {players.filter(p => p.id !== player.id).map(opp => {
            const dmg = player.commanderDamage[opp.id] || 0
            const lethal = dmg >= 21
            return (
              <div key={opp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isDesktop ? '6px 0' : '4px 0', opacity: lethal ? 0.5 : 1 }}>
                <span style={{ color: lethal ? '#EF4444' : theme.text, fontSize: isDesktop ? 18 : 13 }}>{opp.name} {lethal && '\u{1F480}'}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 12 : 8 }}>
                  <button onClick={handleButton(() => { const newDmg = { ...player.commanderDamage, [opp.id]: Math.max(0, dmg - 1) }; onUpdate({ commanderDamage: newDmg }) })} style={{ width: isDesktop ? 36 : 24, height: isDesktop ? 36 : 24, borderRadius: 4, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: isDesktop ? 20 : 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2212'}</button>
                  <span style={{ color: lethal ? '#EF4444' : theme.accent, fontFamily: "'Cinzel', serif", fontSize: isDesktop ? 22 : 16, fontWeight: 700, minWidth: isDesktop ? 28 : 20, textAlign: 'center' }}>{dmg}</span>
                  <button onClick={handleButton(() => { const newDmg = { ...player.commanderDamage, [opp.id]: dmg + 1 }; onUpdate({ commanderDamage: newDmg, life: player.life - 1 }) })} style={{ width: isDesktop ? 36 : 24, height: isDesktop ? 36 : 24, borderRadius: 4, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', fontSize: isDesktop ? 20 : 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isDead && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', borderRadius: 16,
        }}>
          <span style={{ fontSize: 140, lineHeight: 1, color: '#EF4444', filter: 'drop-shadow(0 0 30px rgba(239,68,68,0.6))' }}>{'\u{1F480}'}</span>
        </div>
      )}
    </div>
  )
}

function SortablePlayerPanel({ id, children, theme, gridColumn, rotation, onRotate, rotationGestureRef }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id })

  const panelRef = useRef(null)
  const gestureRef = useRef(null)
  const [rotationPreview, setRotationPreview] = useState(null)
  const rotationPreviewRef = useRef(null)
  const isRotatingRef = useRef(false)
  const [previewHintDeg, setPreviewHintDeg] = useState(0)

  const combinedRef = useCallback((node) => {
    setNodeRef(node)
    panelRef.current = node
  }, [setNodeRef])

  const handlePointerDown = useCallback((e) => {
    if (!panelRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX)

    gestureRef.current = { centerX, centerY, startAngle, pointerId: e.pointerId }
    isRotatingRef.current = false
    rotationPreviewRef.current = null
    setRotationPreview(null)
    setPreviewHintDeg(0)

    const handleMove = (me) => {
      if (!gestureRef.current || me.pointerId !== gestureRef.current.pointerId) return
      const { centerX, centerY, startAngle } = gestureRef.current
      const currentAngle = Math.atan2(me.clientY - centerY, me.clientX - centerX)
      let angleDiff = (currentAngle - startAngle) * (180 / Math.PI)
      while (angleDiff > 180) angleDiff -= 360
      while (angleDiff < -180) angleDiff += 360

      if (Math.abs(angleDiff) > 35) {
        isRotatingRef.current = true
        if (rotationGestureRef) rotationGestureRef.current = true
        const currentRot = rotation || 0
        const steps = Math.sign(angleDiff) * Math.max(1, Math.round(Math.abs(angleDiff) / 90))
        const snapped = ((currentRot + steps * 90) % 360 + 360) % 360
        rotationPreviewRef.current = snapped
        setRotationPreview(snapped)
        setPreviewHintDeg(Math.max(-12, Math.min(12, angleDiff * 0.15)))
      } else {
        setPreviewHintDeg(Math.max(-8, Math.min(8, angleDiff * 0.1)))
      }
    }

    const handleUp = (ue) => {
      if (!gestureRef.current || ue.pointerId !== gestureRef.current.pointerId) return
      if (isRotatingRef.current && rotationPreviewRef.current !== null) {
        onRotate(rotationPreviewRef.current)
      }
      gestureRef.current = null
      isRotatingRef.current = false
      rotationPreviewRef.current = null
      setRotationPreview(null)
      setPreviewHintDeg(0)
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      document.removeEventListener('pointercancel', handleUp)
    }

    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    document.addEventListener('pointercancel', handleUp)
  }, [rotation, onRotate, rotationGestureRef])

  const isShowingRotation = isRotatingRef.current && rotationPreview !== null

  const style = {
    transform: isShowingRotation ? undefined : (transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined),
    transition: isShowingRotation ? 'none' : transition,
    opacity: isShowingRotation ? 1 : (isDragging ? 0.5 : 1),
    outline: isOver && !isDragging && !isShowingRotation ? `2px solid ${theme.accent}` : 'none',
    outlineOffset: 2,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gridColumn,
  }

  const mergedListeners = {
    ...listeners,
    onPointerDown: (e) => {
      handlePointerDown(e)
      listeners?.onPointerDown?.(e)
    },
  }

  return (
    <div ref={combinedRef} style={style} {...attributes}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        transform: previewHintDeg ? `rotate(${previewHintDeg}deg)` : undefined,
        transition: previewHintDeg ? 'none' : 'transform 0.2s ease-out',
      }}>
        {children}
      </div>
      {isShowingRotation && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 16,
          border: `2px solid ${theme.accent}`,
          boxShadow: `0 0 20px ${theme.glow}, inset 0 0 20px ${theme.glow}`,
          pointerEvents: 'none',
          zIndex: 30,
        }} />
      )}
      <div
        ref={setActivatorNodeRef}
        {...mergedListeners}
        style={{
          zIndex: 20,
          cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
          color: theme.text, fontSize: 22, lineHeight: 1, letterSpacing: 2,
          background: isShowingRotation ? `rgba(167,139,250,0.2)` : `rgba(255,255,255,0.08)`,
          border: isShowingRotation ? `1px solid ${theme.accent}` : `1px solid rgba(255,255,255,0.15)`,
          borderRadius: 10,
          padding: 0, userSelect: 'none',
          width: 48, height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: isDragging || isShowingRotation ? 1 : 0.7,
          transition: 'opacity 0.15s, background 0.15s, border-color 0.15s',
          boxShadow: isShowingRotation ? `0 0 12px ${theme.glow}` : '0 2px 8px rgba(0,0,0,0.3)',
          margin: '4px auto 8px',
        }}
        title="Drag to rearrange · Circular drag to rotate"
      >
        {isShowingRotation ? '\u21BB' : '\u2630'}
      </div>
    </div>
  )
}

function useWakeLock() {
  const wakeLockRef = useRef(null)
  useEffect(() => {
    async function requestWakeLock() {
      if ('wakeLock' in navigator) {
        try { wakeLockRef.current = await navigator.wakeLock.request('screen') } catch {}
      }
    }
    requestWakeLock()
    const handleVisibility = () => { if (document.visibilityState === 'visible') requestWakeLock() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {})
    }
  }, [])
}

function toggleFullscreen() {
  haptic()
  const doc = document
  const el = document.documentElement
  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    (doc.exitFullscreen || doc.webkitExitFullscreen || (() => {})).call(doc).catch(() => {})
  } else {
    (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el).catch(() => {})
  }
}

const ACTIVE_GAME_KEY = 'mtg-active-game'

// --- Main GameSession Component ---
export default function GameSession({ format, startingLife, setupPlayers, getPlayerLabel, user, friends, onEndGame, resumeState }) {
  const { addToast } = useToast()
  const { createGame } = useGames()

  const isCommander = format === 'Commander' || format === 'Brawl'

  // Build initial players from setup data (or restore from resumeState)
  const [players, setPlayers] = useState(() => {
    if (resumeState?.players) return resumeState.players
    const colors = Object.keys(MANA_COLORS)
    return setupPlayers.map((sp, i) => ({
      id: sp.id,
      setupId: sp.id, // keep reference to setup player
      user_id: sp.user_id,
      guest_name: sp.guest_name,
      name: getPlayerLabel(sp, i),
      life: startingLife,
      poison: 0,
      energy: 0,
      experience: 0,
      commanderDamage: {},
      color: colors[i % colors.length],
      rotation: setupPlayers.length === 2 ? (i === 0 ? 180 : 0) : 0,
      deck_name: sp.deck_name || '',
      commander_name: sp.commander_name || '',
      commander_colors: sp.commander_colors || [],
    }))
  })

  const [theme, setTheme] = useState(() => {
    if (resumeState?.themeId) {
      const t = THEMES.find(t => t.id === resumeState.themeId)
      if (t) return t
    }
    const savedId = localStorage.getItem('mtg-game-theme')
    return THEMES.find(t => t.id === savedId) || THEMES[0]
  })
  const [minimized, setMinimized] = useState({})
  const [stormCount, setStormCount] = useState(resumeState?.stormCount ?? 0)
  const [turnCount, setTurnCount] = useState(resumeState?.turnCount ?? 1)
  const [gameLog, setGameLog] = useState([])
  const [showTools, setShowTools] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [diceResult, setDiceResult] = useState(null)
  const [coinResult, setCoinResult] = useState(null)
  const [diceType, setDiceType] = useState(20)
  const [rolling, setRolling] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hideNav, setHideNav] = useState(true) // auto-enable on game start
  const [firstPlayer, setFirstPlayer] = useState(null)
  const [pickingFirst, setPickingFirst] = useState(false)
  const [layoutMode, setLayoutMode] = useState(() => resumeState?.layoutMode || localStorage.getItem('mtg-layout-mode') || 'mobile')

  // End game state
  const [showEndModal, setShowEndModal] = useState(false)
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [winners, setWinners] = useState({})
  const [endNotes, setEndNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit player state
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editDeckName, setEditDeckName] = useState('')
  const [editCommanderName, setEditCommanderName] = useState('')
  const [editPlayerName, setEditPlayerName] = useState('')

  const isDesktop = layoutMode === 'desktop'

  // --- Drag-to-rearrange sensors ---
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const dndSensors = useSensors(pointerSensor, touchSensor)

  const handleDragEnd = useCallback((event) => {
    if (rotationGestureRef.current) {
      rotationGestureRef.current = false
      return
    }
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPlayers(prev => {
      const oldIndex = prev.findIndex(p => p.id === active.id)
      const newIndex = prev.findIndex(p => p.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arraySwap(prev, oldIndex, newIndex)
    })
  }, [])

  useWakeLock()

  // Hide nav when game is active
  useEffect(() => {
    if (hideNav) {
      document.documentElement.setAttribute('data-game-fullscreen', 'true')
    } else {
      document.documentElement.removeAttribute('data-game-fullscreen')
    }
    return () => document.documentElement.removeAttribute('data-game-fullscreen')
  }, [hideNav])

  // Save game state to localStorage for resume functionality
  useEffect(() => {
    const saveState = {
      players,
      format,
      startingLife,
      turnCount,
      stormCount,
      themeId: theme.id,
      layoutMode,
      timestamp: Date.now(),
    }
    localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(saveState))
  }, [players, format, startingLife, turnCount, stormCount, theme, layoutMode])

  // Save theme preference
  useEffect(() => {
    localStorage.setItem('mtg-game-theme', theme.id)
  }, [theme])

  // Track fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement || !!document.webkitFullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    document.addEventListener('webkitfullscreenchange', handler)
    return () => { document.removeEventListener('fullscreenchange', handler); document.removeEventListener('webkitfullscreenchange', handler) }
  }, [])

  const logAction = useCallback((action) => {
    setGameLog(prev => [{ action, time: new Date().toLocaleTimeString(), turn: turnCount }, ...prev].slice(0, 100))
  }, [turnCount])

  const updatePlayer = useCallback((id, updates) => {
    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p
      const updated = { ...p, ...updates }
      if (updates.life !== undefined && updates.life !== p.life) logAction(`${p.name}: ${p.life} \u2192 ${updates.life} life`)
      if (updates.poison !== undefined && updates.poison !== p.poison) logAction(`${p.name}: ${updates.poison} poison counters`)
      if (updates.energy !== undefined && updates.energy !== p.energy) logAction(`${p.name}: ${p.energy} \u2192 ${updates.energy} energy`)
      if (updates.experience !== undefined && updates.experience !== p.experience) logAction(`${p.name}: ${p.experience} \u2192 ${updates.experience} experience`)
      if (updates.commanderDamage !== undefined) {
        Object.keys(updates.commanderDamage).forEach(oppId => {
          const oldDmg = p.commanderDamage[oppId] || 0
          const newDmg = updates.commanderDamage[oppId] || 0
          if (newDmg !== oldDmg) {
            const opp = prev.find(pl => String(pl.id) === String(oppId))
            const oppName = opp ? opp.name : `Player ${oppId}`
            logAction(`${p.name}: took ${Math.abs(newDmg - oldDmg)} commander damage from ${oppName}`)
          }
        })
      }
      return updated
    }))
  }, [logAction])

  const removePlayer = (id) => { if (players.length <= 2) return; setPlayers(players.filter(p => p.id !== id)) }

  const rotatePlayer = (id) => {
    haptic()
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, rotation: ROTATION_CYCLE[p.rotation || 0] ?? 0 } : p))
  }

  const setPlayerRotation = useCallback((id, targetRotation) => {
    haptic()
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, rotation: targetRotation } : p))
  }, [])

  const rotationGestureRef = useRef(false)

  const toggleLayoutMode = () => {
    const newMode = layoutMode === 'mobile' ? 'desktop' : 'mobile'
    setLayoutMode(newMode)
    localStorage.setItem('mtg-layout-mode', newMode)
    haptic()
  }

  // Dice/coin/first player
  const rollDice = () => {
    haptic(); setRolling(true)
    let count = 0
    const interval = setInterval(() => {
      setDiceResult(Math.floor(Math.random() * diceType) + 1)
      count++
      if (count > 10) { clearInterval(interval); const r = Math.floor(Math.random() * diceType) + 1; setDiceResult(r); setRolling(false); logAction(`Rolled d${diceType}: ${r}`) }
    }, 80)
  }

  const flipCoin = () => {
    haptic(); setFlipping(true)
    let count = 0
    const interval = setInterval(() => {
      setCoinResult(Math.random() > 0.5 ? 'Heads' : 'Tails')
      count++
      if (count > 8) { clearInterval(interval); const r = Math.random() > 0.5 ? 'Heads' : 'Tails'; setCoinResult(r); setFlipping(false); logAction(`Coin flip: ${r}`) }
    }, 100)
  }

  const pickFirstPlayer = () => {
    haptic(); setPickingFirst(true)
    let count = 0
    const interval = setInterval(() => {
      setFirstPlayer(players[Math.floor(Math.random() * players.length)].name)
      count++
      if (count > 12) { clearInterval(interval); const w = players[Math.floor(Math.random() * players.length)].name; setFirstPlayer(w); setPickingFirst(false); logAction(`Goes first: ${w}`) }
    }, 90)
  }

  // --- Edit Player ---
  const openEditPlayer = (player) => {
    setEditingPlayer(player)
    setEditPlayerName(player.name)
    setEditDeckName(player.deck_name || '')
    setEditCommanderName(player.commander_name || '')
  }

  const saveEditPlayer = () => {
    if (!editingPlayer) return
    setPlayers(prev => prev.map(p => {
      if (p.id !== editingPlayer.id) return p
      return {
        ...p,
        name: editPlayerName.trim() || p.name,
        deck_name: editDeckName.trim(),
        commander_name: editCommanderName.trim(),
      }
    }))
    setEditingPlayer(null)
  }

  // --- End Game ---
  const toggleWinner = (playerId) => {
    setWinners(prev => ({ ...prev, [playerId]: !prev[playerId] }))
  }

  const handleEndGame = async () => {
    const hasWinner = Object.values(winners).some(v => v)
    if (!hasWinner) {
      addToast('Please select at least one winner', 'error')
      return
    }

    setSaving(true)
    try {
      const gameData = {
        format,
        date: new Date().toISOString().split('T')[0],
        turn_count: turnCount,
        notes: endNotes.trim() || null,
      }

      const playerData = players.map(p => {
        // Build commander damage dealt by this player (aggregate from other players' commanderDamage)
        const cmdDmgDealt = {}
        players.forEach(other => {
          if (other.id === p.id) return
          const dmgFromP = other.commanderDamage[p.id] || 0
          if (dmgFromP > 0) {
            const targetKey = other.user_id || `guest-${other.id}`
            cmdDmgDealt[targetKey] = dmgFromP
          }
        })

        return {
          user_id: p.user_id || null,
          guest_name: p.user_id ? null : (p.guest_name || p.name),
          deck_name: p.deck_name || null,
          commander_name: p.commander_name || null,
          commander_colors: p.commander_colors || [],
          starting_life: startingLife,
          ending_life: p.life,
          is_winner: !!winners[p.id],
          kill_count: 0,
          commander_damage_dealt: cmdDmgDealt,
        }
      })

      await createGame(gameData, playerData)
      localStorage.removeItem(ACTIVE_GAME_KEY)
      addToast('Game saved!', 'success')
      onEndGame()
    } catch (err) {
      addToast(err.message || 'Failed to save game', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAbandonGame = () => {
    localStorage.removeItem(ACTIVE_GAME_KEY)
    onEndGame()
  }

  return (
    <div className="game-session" data-layout={layoutMode} style={{
      minHeight: '100vh', background: theme.bg, fontFamily: "'Cinzel', serif", color: theme.text,
      maxWidth: isDesktop ? '100%' : (players.length >= 3 ? '100%' : 600), margin: '0 auto', position: 'relative',
      paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)',
    }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 300, background: `radial-gradient(ellipse at 50% 0%, ${theme.glow}, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'relative', zIndex: 1, padding: isDesktop ? '8px 12px 40px' : (players.length >= 3 ? '8px 8px 60px' : '16px 16px 100px') }}>

        {/* Header */}
        <div style={{ textAlign: 'center', paddingTop: isDesktop ? 8 : (players.length >= 3 ? 4 : 12), paddingBottom: isDesktop ? 8 : (players.length >= 3 ? 8 : 16) }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.12em', color: theme.accent, margin: 0, textTransform: 'uppercase', textShadow: `0 0 30px ${theme.glow}` }}>{'\u27E1'} {format} {'\u27E1'}</h1>
          <div style={{ fontSize: 11, color: theme.muted, letterSpacing: '0.15em', marginTop: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 12 }}>
              <span onClick={() => { haptic(); setTurnCount(Math.max(1, turnCount - 1)) }} style={{ cursor: 'pointer', padding: '0 4px', fontSize: 14, color: '#F87171' }}>{'\u2212'}</span>
              <span>TURN {turnCount}</span>
              <span onClick={() => { haptic(); setTurnCount(turnCount + 1); setStormCount(0); logAction(`Turn ${turnCount + 1}`) }} style={{ cursor: 'pointer', padding: '0 4px', fontSize: 14, color: '#4ADE80' }}>+</span>
            </span>
            <span>{'\u00B7'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 12 }}>
              <span onClick={() => { haptic(); setStormCount(Math.max(0, stormCount - 1)) }} style={{ cursor: 'pointer', padding: '0 4px', fontSize: 14, color: '#F87171' }}>{'\u2212'}</span>
              <span>STORM {stormCount}</span>
              <span onClick={() => { haptic(); const next = stormCount + 1; setStormCount(next); logAction(`Storm: ${stormCount} \u2192 ${next}`) }} style={{ cursor: 'pointer', padding: '0 4px', fontSize: 14, color: '#4ADE80' }}>+</span>
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: isDesktop ? 8 : 6, marginBottom: isDesktop ? 8 : (players.length >= 3 ? 8 : 16), flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => { haptic(); setShowSettings(!showSettings) }} style={{ padding: '6px 14px', borderRadius: 8, background: showSettings ? theme.accent : 'transparent', border: `1px solid ${theme.border}`, color: showSettings ? theme.bg : theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{'\u2699'} Theme</button>
          <button onClick={() => { haptic(); setShowTools(!showTools) }} style={{ padding: '6px 14px', borderRadius: 8, background: showTools ? theme.accent : 'transparent', border: `1px solid ${theme.border}`, color: showTools ? theme.bg : theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{'\uD83C\uDFB2'} Tools</button>
          <button onClick={() => { haptic(); setShowHistory(!showHistory) }} style={{ padding: '6px 14px', borderRadius: 8, background: showHistory ? theme.accent : 'transparent', border: `1px solid ${theme.border}`, color: showHistory ? theme.bg : theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}><HistoryIcon size={12} /> Log</button>
          <button onClick={() => { haptic(); setHideNav(!hideNav) }} style={{ padding: '6px 14px', borderRadius: 8, background: hideNav ? theme.accent : 'transparent', border: `1px solid ${theme.border}`, color: hideNav ? theme.bg : theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{hideNav ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />} Nav</button>
          <button onClick={toggleFullscreen} style={{ padding: '6px 14px', borderRadius: 8, background: isFullscreen ? theme.accent : 'transparent', border: `1px solid ${theme.border}`, color: isFullscreen ? theme.bg : theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}><FullscreenIcon size={12} /> {isFullscreen ? 'Exit' : 'Full'}</button>
          <button onClick={toggleLayoutMode} style={{ padding: '6px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{isDesktop ? '\uD83D\uDDA5\uFE0F' : '\uD83D\uDCF1'} {isDesktop ? 'Desktop' : 'Mobile'}</button>
          <button onClick={() => { haptic(); setShowEndModal(true) }} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#F87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{'\u2716'} End Game</button>
          <button onClick={() => { haptic(); setShowAbandonConfirm(true) }} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#FBBF24', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{'\u26A0'} Abandon</button>
        </div>

        {/* Settings panel (theme only — format is locked) */}
        {showSettings && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: theme.muted, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>Theme</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => { haptic(); setTheme(t) }} style={{ padding: '6px 12px', borderRadius: 8, background: theme.id === t.id ? t.accent : 'transparent', border: `1px solid ${theme.id === t.id ? t.accent : t.border}`, color: theme.id === t.id ? t.bg : t.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cinzel', serif" }}>{t.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Tools panel */}
        {showTools && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: theme.muted, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Dice Roll</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8 }}>
                  {[4, 6, 8, 10, 12, 20].map(d => (
                    <button key={d} onClick={() => { haptic(); setDiceType(d) }} style={{ width: 30, height: 26, borderRadius: 4, background: diceType === d ? theme.accent : 'transparent', border: `1px solid ${diceType === d ? theme.accent : theme.border}`, color: diceType === d ? theme.bg : theme.text, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cinzel', serif" }}>d{d}</button>
                  ))}
                </div>
                <button onClick={rollDice} disabled={rolling} style={{ padding: '10px 20px', borderRadius: 10, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}88)`, border: 'none', color: theme.bg, fontSize: 14, fontWeight: 700, cursor: rolling ? 'wait' : 'pointer', fontFamily: "'Cinzel', serif", boxShadow: `0 4px 16px ${theme.glow}` }}><DiceIcon size={16} /> Roll</button>
                {diceResult && <div style={{ marginTop: 10, fontSize: 36, fontWeight: 800, color: theme.accent, textShadow: `0 0 20px ${theme.glow}`, animation: rolling ? 'pulse 0.15s ease infinite' : 'none' }}>{diceResult}</div>}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: theme.muted, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Coin Flip</div>
                <div style={{ height: 26, marginBottom: 8 }} />
                <button onClick={flipCoin} disabled={flipping} style={{ padding: '10px 20px', borderRadius: 10, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}88)`, border: 'none', color: theme.bg, fontSize: 14, fontWeight: 700, cursor: flipping ? 'wait' : 'pointer', fontFamily: "'Cinzel', serif", boxShadow: `0 4px 16px ${theme.glow}` }}><CoinIcon size={16} /> Flip</button>
                {coinResult && <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: theme.accent, textShadow: `0 0 20px ${theme.glow}`, animation: flipping ? 'pulse 0.15s ease infinite' : 'none' }}>{coinResult === 'Heads' ? '\uD83E\uDE99' : '\u2B58'} {coinResult}</div>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, borderTop: `1px solid ${theme.border}`, paddingTop: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: theme.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Storm Count</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <button onClick={() => { haptic(); const next = Math.max(0, stormCount - 1); setStormCount(next); logAction(`Storm: ${stormCount} \u2192 ${next}`) }} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2212'}</button>
                  <span style={{ fontSize: 28, fontWeight: 700, color: theme.accent, minWidth: 30 }}>{stormCount}</span>
                  <button onClick={() => { haptic(); const next = stormCount + 1; setStormCount(next); logAction(`Storm: ${stormCount} \u2192 ${next}`) }} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: theme.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Turn</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <button onClick={() => { haptic(); setTurnCount(Math.max(1, turnCount - 1)) }} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2212'}</button>
                  <span style={{ fontSize: 28, fontWeight: 700, color: theme.accent, minWidth: 30 }}>{turnCount}</span>
                  <button onClick={() => { haptic(); setTurnCount(turnCount + 1); setStormCount(0); logAction(`Turn ${turnCount + 1}`) }} style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16, borderTop: `1px solid ${theme.border}`, paddingTop: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: theme.muted, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>Who Goes First?</div>
              <button onClick={pickFirstPlayer} disabled={pickingFirst} style={{ padding: '10px 20px', borderRadius: 10, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}88)`, border: 'none', color: theme.bg, fontSize: 14, fontWeight: 700, cursor: pickingFirst ? 'wait' : 'pointer', fontFamily: "'Cinzel', serif", boxShadow: `0 4px 16px ${theme.glow}` }}>{'\uD83C\uDFB2'} Randomize</button>
              {firstPlayer && <div style={{ marginTop: 12, fontSize: 24, fontWeight: 800, color: theme.accent, textShadow: `0 0 20px ${theme.glow}`, animation: pickingFirst ? 'pulse 0.15s ease infinite' : 'none' }}>{pickingFirst ? firstPlayer : `${firstPlayer} goes first!`}</div>}
            </div>
          </div>
        )}

        {/* Game Log */}
        {showHistory && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
            <div style={{ fontSize: 11, color: theme.muted, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>Game Log</div>
            {gameLog.length === 0 ? (
              <div style={{ color: theme.muted, fontSize: 12, fontStyle: 'italic' }}>No actions yet</div>
            ) : (
              gameLog.map((entry, i) => (
                <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${theme.border}22`, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: theme.text }}>{entry.action}</span>
                  <span style={{ color: theme.muted, fontSize: 10 }}>T{entry.turn} {'\u00B7'} {entry.time}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Player grid */}
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={players.map(p => p.id)} strategy={rectSwappingStrategy}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? (players.length === 2 ? '1fr 1fr' : 'repeat(2, 1fr)') : (players.length === 2 ? '1fr' : 'repeat(2, 1fr)'),
              gridAutoRows: '1fr', gap: 12,
              minHeight: isDesktop ? 'calc(100vh - 120px)' : 'calc(100vh - 200px)',
            }}>
              {players.map((player, index) => {
                const rotation = player.rotation || 0
                const needsWrapper = rotation === 90 || rotation === 270
                const isLastOdd = index === players.length - 1 && players.length % 2 === 1
                const cardElement = (
                  <PlayerCard
                    player={player} players={players} theme={theme} isCommander={isCommander}
                    onUpdate={(updates) => updatePlayer(player.id, updates)}
                    onRemove={() => removePlayer(player.id)}
                    isMinimized={!!minimized[player.id]}
                    onToggleMinimize={() => setMinimized(prev => ({ ...prev, [player.id]: !prev[player.id] }))}
                    isDesktop={isDesktop}
                    onEditPlayer={openEditPlayer}
                  />
                )
                return (
                  <SortablePlayerPanel key={player.id} id={player.id} theme={theme} gridColumn={isLastOdd ? 'span 2' : undefined} rotation={rotation} onRotate={(target) => setPlayerRotation(player.id, target)} rotationGestureRef={rotationGestureRef}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {needsWrapper ? (
                        <RotatedCardWrapper rotation={rotation}>{cardElement}</RotatedCardWrapper>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', transform: rotation === 180 ? 'rotate(180deg)' : 'none' }}>
                          {cardElement}
                        </div>
                      )}
                    </div>
                  </SortablePlayerPanel>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* End Game Modal */}
      <Modal isOpen={showEndModal} onClose={() => setShowEndModal(false)} title="End Game">
        <div className="endgame-modal">
          <p className="endgame-modal__hint">Tap a player to mark as winner, then confirm.</p>
          <div className="endgame-modal__players">
            {players.map(p => (
              <button
                key={p.id}
                type="button"
                className={`endgame-player-btn ${winners[p.id] ? 'endgame-player-btn--winner' : ''}`}
                onClick={() => toggleWinner(p.id)}
              >
                <span className="endgame-player-btn__name">{p.name}</span>
                <span className="endgame-player-btn__life">{p.life} life</span>
                {winners[p.id] && <span className="endgame-player-btn__crown">{'\uD83D\uDC51'}</span>}
              </button>
            ))}
          </div>
          <div className="endgame-modal__notes">
            <label htmlFor="endgame-notes">Notes (optional)</label>
            <textarea
              id="endgame-notes"
              value={endNotes}
              onChange={e => setEndNotes(e.target.value)}
              placeholder="Any memorable plays, combos..."
              rows={3}
            />
          </div>
          <div className="endgame-modal__actions">
            <button type="button" className="endgame-cancel-btn" onClick={() => setShowEndModal(false)}>Cancel</button>
            <button type="button" className="endgame-save-btn" onClick={handleEndGame} disabled={saving}>
              {saving ? 'Saving...' : 'Save & End Game'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Player Modal */}
      <Modal isOpen={!!editingPlayer} onClose={() => setEditingPlayer(null)} title="Edit Player">
        <div className="editplayer-modal">
          <div className="editplayer-field">
            <label>Player Name</label>
            <input value={editPlayerName} onChange={e => setEditPlayerName(e.target.value)} />
          </div>
          <div className="editplayer-field">
            <label>Deck Name</label>
            <input value={editDeckName} onChange={e => setEditDeckName(e.target.value)} placeholder="e.g. Mono Red Aggro" />
          </div>
          {isCommander && (
            <div className="editplayer-field">
              <label>Commander</label>
              <input value={editCommanderName} onChange={e => setEditCommanderName(e.target.value)} placeholder="e.g. Atraxa" />
            </div>
          )}
          <div className="editplayer-actions">
            <button type="button" className="endgame-cancel-btn" onClick={() => setEditingPlayer(null)}>Cancel</button>
            <button type="button" className="endgame-save-btn" onClick={saveEditPlayer}>Save</button>
          </div>
        </div>
      </Modal>

      {/* Abandon Game Confirm Modal */}
      <Modal isOpen={showAbandonConfirm} onClose={() => setShowAbandonConfirm(false)} title="Abandon Game">
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Are you sure? This will discard the current game without saving.
        </p>
        <div className="endgame-modal__actions">
          <button type="button" className="endgame-cancel-btn" onClick={() => setShowAbandonConfirm(false)}>Cancel</button>
          <button type="button" className="endgame-save-btn" style={{ background: '#FBBF24', color: '#000' }} onClick={handleAbandonGame}>Abandon Game</button>
        </div>
      </Modal>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .game-session button:hover { filter: brightness(1.15); }
        .game-session button:active { transform: scale(0.97); }
      `}</style>
    </div>
  )
}
