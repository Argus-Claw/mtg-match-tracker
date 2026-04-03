import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useGames } from '../hooks/useGames'
import { useGameSession } from '../hooks/useGameSession'
import { QRCodeSVG } from 'qrcode.react'
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

const ROTATION_CYCLE = { 0: 90, 90: 180, 180: 270, 270: 0 }

// Normalize commanderDamage entry: supports legacy (number) and new (array of trackers) formats
function getCmdrTrackers(commanderDamage, oppId) {
  const entry = commanderDamage[oppId]
  if (!entry) return [{ id: 1, name: 'Cmdr 1', damage: 0 }]
  if (typeof entry === 'number') return [{ id: 1, name: 'Cmdr 1', damage: entry }]
  if (Array.isArray(entry)) return entry.length === 0 ? [{ id: 1, name: 'Cmdr 1', damage: 0 }] : entry
  return [{ id: 1, name: 'Cmdr 1', damage: 0 }]
}

let nextCmdrId = 100

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

function PlayerCard({ player, players, theme, isCommander, onUpdate, onRemove, isMinimized, onToggleMinimize, isDesktop, onEditPlayer, isConnected, isReadOnly }) {
  const [showCommander, setShowCommander] = useState(false)
  const [showCounters, setShowCounters] = useState(false)
  const [lifeFlash, setLifeFlash] = useState(null)
  const prevLife = useRef(player.life)
  const lifeTapRef = useRef(null)
  const [pendingDelta, setPendingDelta] = useState(0)
  const [deltaFading, setDeltaFading] = useState(false)
  const deltaTimeoutRef = useRef(null)
  const deltaFadeRef = useRef(null)
  const localTapRef = useRef(false) // tracks whether life change came from local tap
  const manaColor = MANA_COLORS[player.color] || MANA_COLORS.W
  const commanderLethal = isCommander && player.commanderDamage && Object.keys(player.commanderDamage).some(oppId => getCmdrTrackers(player.commanderDamage, oppId).some(t => t.damage >= 21))
  const isDead = player.life <= 0 || player.poison >= 10 || commanderLethal

  useEffect(() => {
    if (player.life !== prevLife.current) {
      const delta = player.life - prevLife.current
      setLifeFlash(delta > 0 ? 'gain' : 'loss')
      const timeout = setTimeout(() => setLifeFlash(null), 2500)

      // Show delta indicator for remote changes (local taps handle their own)
      if (!localTapRef.current) {
        clearTimeout(deltaTimeoutRef.current)
        clearTimeout(deltaFadeRef.current)
        setDeltaFading(false)
        setPendingDelta(prev => prev + delta)
        deltaTimeoutRef.current = setTimeout(() => {
          setDeltaFading(true)
          deltaFadeRef.current = setTimeout(() => { setPendingDelta(0); setDeltaFading(false) }, 500)
        }, 2000)
      }
      localTapRef.current = false

      prevLife.current = player.life
      return () => clearTimeout(timeout)
    }
  }, [player.life])

  useEffect(() => {
    return () => { clearTimeout(deltaTimeoutRef.current); clearTimeout(deltaFadeRef.current) }
  }, [])

  const handleLifeTap = (e) => {
    haptic()
    localTapRef.current = true
    const rect = lifeTapRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const rotation = player.rotation || 0
    const relX = (e.clientX - centerX) / (rect.width / 2)
    const relY = (e.clientY - centerY) / (rect.height / 2)
    const isHorizontal = Math.abs(relX) >= Math.abs(relY)
    let isIncrease
    if (isHorizontal) {
      const isRight = relX >= 0
      isIncrease = (rotation === 0 || rotation === 90) ? isRight : !isRight
    } else {
      const isBottom = relY >= 0
      isIncrease = (rotation === 0 || rotation === 270) ? !isBottom : isBottom
    }
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
          {isConnected && <ConnectedDot connected={true} size={isDesktop ? 10 : 8} />}
          <span onClick={() => onEditPlayer && onEditPlayer(player)} style={{ color: theme.text, fontFamily: "'Cinzel', serif", fontSize: isDesktop ? 22 : 14, fontWeight: 700, cursor: onEditPlayer ? 'pointer' : 'default', letterSpacing: '0.05em', borderBottom: onEditPlayer ? `1px dashed ${theme.muted}44` : 'none', paddingBottom: 1, opacity: isReadOnly ? 0.7 : 1 }}>{player.name}</span>
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
        {/* Tap zone indicators — rotation-aware */}
        {(() => {
          const r = player.rotation || 0
          const leftSign = (r === 0 || r === 90) ? '−' : '+'
          const rightSign = (r === 0 || r === 90) ? '+' : '−'
          const topSign = (r === 0 || r === 270) ? '+' : '−'
          const bottomSign = (r === 0 || r === 270) ? '−' : '+'
          const plusColor = 'rgba(74,222,128,0.45)'
          const minusColor = 'rgba(248,113,113,0.45)'
          return <>
            <span style={{ position: 'absolute', pointerEvents: 'none', fontSize: isDesktop ? 48 : 28, fontWeight: 700, color: leftSign === '+' ? plusColor : minusColor, left: isDesktop ? 24 : 16, top: '50%', transform: 'translateY(-50%)' }}>{leftSign}</span>
            <span style={{ position: 'absolute', pointerEvents: 'none', fontSize: isDesktop ? 48 : 28, fontWeight: 700, color: rightSign === '+' ? plusColor : minusColor, right: isDesktop ? 24 : 16, top: '50%', transform: 'translateY(-50%)' }}>{rightSign}</span>
            <span style={{ position: 'absolute', pointerEvents: 'none', fontSize: isDesktop ? 36 : 22, fontWeight: 700, color: topSign === '+' ? plusColor : minusColor, top: isDesktop ? 12 : 8, left: '50%', transform: 'translateX(-50%)' }}>{topSign}</span>
            <span style={{ position: 'absolute', pointerEvents: 'none', fontSize: isDesktop ? 36 : 22, fontWeight: 700, color: bottomSign === '+' ? plusColor : minusColor, bottom: isDesktop ? 12 : 8, left: '50%', transform: 'translateX(-50%)' }}>{bottomSign}</span>
          </>
        })()}
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
            const trackers = getCmdrTrackers(player.commanderDamage, opp.id)
            const hasMultiple = trackers.length > 1
            return (
              <div key={opp.id} style={{ marginBottom: isDesktop ? 8 : 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: hasMultiple ? (isDesktop ? 4 : 2) : 0 }}>
                  <span style={{ color: theme.text, fontSize: isDesktop ? 16 : 12, fontWeight: 700 }}>{opp.name}</span>
                  <button onClick={handleButton(() => {
                    const newTrackers = [...trackers, { id: ++nextCmdrId, name: `Cmdr ${trackers.length + 1}`, damage: 0 }]
                    onUpdate({ commanderDamage: { ...player.commanderDamage, [opp.id]: newTrackers } })
                  })} style={{ padding: isDesktop ? '2px 8px' : '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.border}`, color: theme.muted, fontSize: isDesktop ? 11 : 9, cursor: 'pointer', fontFamily: "'Cinzel', serif" }}>+ Cmdr</button>
                </div>
                {trackers.map((tracker, tIdx) => {
                  const lethal = tracker.damage >= 21
                  return (
                    <div key={tracker.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isDesktop ? '4px 0' : '3px 0', paddingLeft: hasMultiple ? (isDesktop ? 12 : 8) : 0, opacity: lethal ? 0.5 : 1 }}>
                      <span onClick={hasMultiple ? handleButton(() => {
                        const name = prompt('Commander name:', tracker.name)
                        if (name && name !== tracker.name) {
                          const newTrackers = trackers.map((t, i) => i === tIdx ? { ...t, name } : t)
                          onUpdate({ commanderDamage: { ...player.commanderDamage, [opp.id]: newTrackers } })
                        }
                      }) : undefined} style={{ color: lethal ? '#EF4444' : theme.muted, fontSize: isDesktop ? 14 : 11, cursor: hasMultiple ? 'pointer' : 'default', borderBottom: hasMultiple ? `1px dashed ${theme.border}` : 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {hasMultiple && <span>{tracker.name}</span>}
                        {lethal && '\u{1F480}'}
                        {hasMultiple && trackers.length > 1 && (
                          <span onClick={(e) => { e.stopPropagation(); haptic(); const newTrackers = trackers.filter((_, i) => i !== tIdx); onUpdate({ commanderDamage: { ...player.commanderDamage, [opp.id]: newTrackers.length ? newTrackers : [{ id: 1, name: 'Cmdr 1', damage: 0 }] } }) }} style={{ color: '#F87171', fontSize: isDesktop ? 10 : 8, cursor: 'pointer', marginLeft: 2 }}>{'\u2716'}</span>
                        )}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 12 : 8 }}>
                        <button onClick={handleButton(() => {
                          const newTrackers = trackers.map((t, i) => i === tIdx ? { ...t, damage: Math.max(0, t.damage - 1) } : t)
                          onUpdate({ commanderDamage: { ...player.commanderDamage, [opp.id]: newTrackers } })
                        })} style={{ width: isDesktop ? 36 : 24, height: isDesktop ? 36 : 24, borderRadius: 4, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: isDesktop ? 20 : 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u2212'}</button>
                        <span style={{ color: lethal ? '#EF4444' : theme.accent, fontFamily: "'Cinzel', serif", fontSize: isDesktop ? 22 : 16, fontWeight: 700, minWidth: isDesktop ? 28 : 20, textAlign: 'center' }}>{tracker.damage}</span>
                        <button onClick={handleButton(() => {
                          const newTrackers = trackers.map((t, i) => i === tIdx ? { ...t, damage: t.damage + 1 } : t)
                          onUpdate({ commanderDamage: { ...player.commanderDamage, [opp.id]: newTrackers }, life: player.life - 1 })
                        })} style={{ width: isDesktop ? 36 : 24, height: isDesktop ? 36 : 24, borderRadius: 4, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ADE80', fontSize: isDesktop ? 20 : 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  )
                })}
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

function SortablePlayerPanel({ id, children, theme, gridColumn, onRotate }) {
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

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    outline: isOver && !isDragging ? `2px solid ${theme.accent}` : 'none',
    outlineOffset: 2,
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gridColumn,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '4px auto 8px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (navigator.vibrate) navigator.vibrate(10); onRotate && onRotate(); }}
          style={{
            zIndex: 20,
            color: theme.text, fontSize: 18, lineHeight: 1,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: 0, userSelect: 'none', cursor: 'pointer',
            width: 48, height: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.7,
            transition: 'opacity 0.15s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
          title="Rotate"
        >
          {'\u21BB'}
        </button>
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          style={{
            zIndex: 20,
            cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none',
            color: theme.text, fontSize: 22, lineHeight: 1, letterSpacing: 2,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: 0, userSelect: 'none',
            width: 48, height: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: isDragging ? 1 : 0.7,
            transition: 'opacity 0.15s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
          title="Drag to rearrange"
        >
          {'\u2630'}
        </div>
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

// Share link icon
function ShareIcon({ size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
}

// Connected indicator dot
function ConnectedDot({ connected, size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: connected ? '#4ADE80' : 'transparent', border: connected ? 'none' : '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
}

// Build the share URL base from the current location
function getShareUrlBase() {
  // Use VITE_SHARE_URL if configured, otherwise derive from current origin + base
  const customBase = import.meta.env.VITE_SHARE_URL
  if (customBase) return customBase.replace(/\/$/, '')
  return window.location.origin + (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
}

// --- Main GameSession Component ---
export default function GameSession({ format, startingLife, setupPlayers, getPlayerLabel, user, friends, onEndGame, resumeState, multiplayerSession: externalSession, guestClaimedPlayerId, initialRemoteState }) {
  const { addToast } = useToast()
  const { createGame } = useGames()

  // Multiplayer — use external session (guest) or create own (host)
  const ownSession = useGameSession()
  const mp = externalSession || ownSession
  const isGuest = !!externalSession
  const isGuestView = isGuest && !!guestClaimedPlayerId

  const isCommander = format === 'Commander' || format === 'Brawl'

  // Build initial players from setup data, resumeState, or remote state (guest)
  const [players, setPlayers] = useState(() => {
    if (initialRemoteState?.players) return initialRemoteState.players
    if (resumeState?.players) return resumeState.players
    const colors = Object.keys(MANA_COLORS)
    return setupPlayers.map((sp, i) => ({
      id: sp.id,
      setupId: sp.id,
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
  const [gridCols, setGridCols] = useState(() => {
    const saved = localStorage.getItem('mtg-grid-cols')
    return saved ? parseInt(saved, 10) : 0 // 0 = auto
  })

  // End game state
  const [showEndModal, setShowEndModal] = useState(false)
  const [gameSaved, setGameSaved] = useState(false) // post-save state for Run It Back
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [winners, setWinners] = useState({})
  const [endNotes, setEndNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Edit player state
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editDeckName, setEditDeckName] = useState('')
  const [editCommanderName, setEditCommanderName] = useState('')
  const [editPlayerName, setEditPlayerName] = useState('')

  // Share/multiplayer state
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [expandedOpponent, setExpandedOpponent] = useState(null) // for guest compact view
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const isDesktop = layoutMode === 'desktop'

  // --- Drag-to-rearrange sensors ---
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  const dndSensors = useSensors(pointerSensor, touchSensor)

  const handleDragEnd = useCallback((event) => {
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

  // Save game state to localStorage for resume functionality (host/single-player only)
  useEffect(() => {
    if (isGuestView) return // guests don't save to localStorage
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
  }, [players, format, startingLife, turnCount, stormCount, theme, layoutMode, isGuestView])

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

  // --- Multiplayer: Host broadcasts full state on every change ---
  const broadcastTimeoutRef = useRef(null)
  useEffect(() => {
    if (!mp.isMultiDevice || !mp.isHost) return
    clearTimeout(broadcastTimeoutRef.current)
    broadcastTimeoutRef.current = setTimeout(() => {
      mp.broadcastFullState({
        players,
        turnCount,
        stormCount,
        format,
        startingLife,
        themeId: theme.id,
      })
    }, 50) // debounce 50ms
    return () => clearTimeout(broadcastTimeoutRef.current)
  }, [players, turnCount, stormCount, mp.isMultiDevice, mp.isHost]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Multiplayer: Host receives guest player updates ---
  useEffect(() => {
    if (!mp.isMultiDevice || !mp.isHost) return
    mp.setOnRemoteUpdate((payload) => {
      if (payload.type === 'request_state') {
        // A guest just joined — send current state
        mp.broadcastFullState({
          players,
          turnCount,
          stormCount,
          format,
          startingLife,
          themeId: theme.id,
        })
        return
      }
      if (payload.type === 'player_update') {
        const { playerId, updates } = payload
        // Apply guest update — player ID matching is sufficient authorization
        // (only the guest who claimed this player sends updates for it)
        // Use String() comparison to handle any type mismatch from serialization
        setPlayers(prev => prev.map(p => String(p.id) === String(playerId) ? { ...p, ...updates } : p))
      }
    })
  }, [mp.isMultiDevice, mp.isHost, players, turnCount, stormCount, mp.connectedPlayers]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Multiplayer: Guest receives full state from host ---
  useEffect(() => {
    if (!mp.isMultiDevice || mp.isHost) return
    mp.setOnFullState((payload) => {
      if (payload.players) setPlayers(payload.players)
      if (payload.turnCount !== undefined) setTurnCount(payload.turnCount)
      if (payload.stormCount !== undefined) setStormCount(payload.stormCount)
      if (payload.connectedPlayers) mp.setConnectedPlayers(payload.connectedPlayers)
    })
  }, [mp.isMultiDevice, mp.isHost]) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Share Game handler ---
  const handleShareGame = async () => {
    if (mp.isMultiDevice) {
      // Already sharing — just show the modal
      setShowShareModal(true)
      return
    }
    setSharing(true)
    try {
      const { code } = await mp.createSession(format, startingLife)
      const url = `${getShareUrlBase()}/join/${code}`
      setShareUrl(url)
      setShowShareModal(true)
      // Broadcast initial state to any early joiners
      setTimeout(() => {
        mp.broadcastFullState({
          players,
          turnCount,
          stormCount,
          format,
          startingLife,
          themeId: theme.id,
        })
      }, 500)
    } catch (err) {
      addToast(err.message || 'Failed to share game', 'error')
    } finally {
      setSharing(false)
    }
  }

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = shareUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const logAction = useCallback((action) => {
    setGameLog(prev => [{ action, time: new Date().toLocaleTimeString(), turn: turnCount }, ...prev].slice(0, 100))
  }, [turnCount])

  const updatePlayer = useCallback((id, updates) => {
    // Guest permission check: can only modify own claimed player
    if (isGuestView && id !== guestClaimedPlayerId) return

    // If guest, send update to host AND update local state optimistically
    if (isGuestView) {
      mp.sendPlayerUpdate(id, updates)
      // Optimistic local update so the tap feels instant
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
      return
    }

    setPlayers(prev => prev.map(p => {
      if (p.id !== id) return p
      const updated = { ...p, ...updates }
      if (updates.life !== undefined && updates.life !== p.life) logAction(`${p.name}: ${p.life} \u2192 ${updates.life} life`)
      if (updates.poison !== undefined && updates.poison !== p.poison) logAction(`${p.name}: ${updates.poison} poison counters`)
      if (updates.energy !== undefined && updates.energy !== p.energy) logAction(`${p.name}: ${p.energy} \u2192 ${updates.energy} energy`)
      if (updates.experience !== undefined && updates.experience !== p.experience) logAction(`${p.name}: ${p.experience} \u2192 ${updates.experience} experience`)
      if (updates.commanderDamage !== undefined) {
        Object.keys(updates.commanderDamage).forEach(oppId => {
          const oldTrackers = getCmdrTrackers(p.commanderDamage, oppId)
          const newTrackers = getCmdrTrackers(updates.commanderDamage, oppId)
          const oldTotal = oldTrackers.reduce((s, t) => s + t.damage, 0)
          const newTotal = newTrackers.reduce((s, t) => s + t.damage, 0)
          if (newTotal !== oldTotal) {
            const opp = prev.find(pl => String(pl.id) === String(oppId))
            const oppName = opp ? opp.name : `Player ${oppId}`
            logAction(`${p.name}: took ${Math.abs(newTotal - oldTotal)} commander damage from ${oppName}`)
          }
        })
      }
      return updated
    }))
  }, [logAction, isGuestView, guestClaimedPlayerId]) // eslint-disable-line react-hooks/exhaustive-deps

  const removePlayer = (id) => { if (players.length <= 2) return; setPlayers(players.filter(p => p.id !== id)) }

  const rotatePlayer = (id) => {
    haptic()
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, rotation: ROTATION_CYCLE[p.rotation || 0] ?? 0 } : p))
  }



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
          const trackers = getCmdrTrackers(other.commanderDamage, p.id)
          const totalDmg = trackers.reduce((s, t) => s + t.damage, 0)
          if (totalDmg > 0) {
            const targetKey = other.user_id || `guest-${other.id}`
            cmdDmgDealt[targetKey] = totalDmg
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
      setGameSaved(true)
    } catch (err) {
      addToast(err.message || 'Failed to save game', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRunItBack = () => {
    // Reset all players to starting life, clear counters, keep names/decks
    setPlayers(prev => prev.map(p => ({
      ...p,
      life: startingLife,
      poison: 0,
      energy: 0,
      experience: 0,
      commanderDamage: {},
    })))
    setTurnCount(1)
    setStormCount(0)
    setGameLog([])
    setWinners({})
    setEndNotes('')
    setGameSaved(false)
    setShowEndModal(false)
    addToast('New game — same players, same format. Let\'s go!', 'success')
  }

  const handleDoneAfterSave = () => {
    if (mp.isMultiDevice) mp.endSession()
    onEndGame()
  }

  const handleAbandonGame = () => {
    localStorage.removeItem(ACTIVE_GAME_KEY)
    if (mp.isMultiDevice) mp.endSession()
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
          {mp.isMultiDevice && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
              <ConnectedDot connected={mp.isChannelHealthy} size={6} />
              <span style={{ fontSize: 10, color: mp.isChannelHealthy ? '#4ADE80' : '#FBBF24', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {!mp.isChannelHealthy ? 'Reconnecting...' : isGuestView ? 'Connected' : `Shared${Object.keys(mp.connectedPlayers).length > 0 ? ` \u00B7 ${Object.keys(mp.connectedPlayers).length} joined` : ''}`}
              </span>
            </div>
          )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {[0, 1, 2, 3].map(c => (
              <button key={c} onClick={() => { haptic(); setGridCols(c); localStorage.setItem('mtg-grid-cols', c) }} style={{
                padding: '6px 10px', borderRadius: 8,
                background: gridCols === c ? theme.accent : 'transparent',
                border: `1px solid ${gridCols === c ? theme.accent : theme.border}`,
                color: gridCols === c ? theme.bg : theme.text,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif",
                minWidth: 32,
              }}>{c === 0 ? 'Auto' : `${c}col`}</button>
            ))}
          </div>
          {!isGuestView && <button onClick={() => { haptic(); handleShareGame() }} disabled={sharing} style={{ padding: '6px 14px', borderRadius: 8, background: mp.isMultiDevice ? 'rgba(74,222,128,0.15)' : 'transparent', border: `1px solid ${mp.isMultiDevice ? 'rgba(74,222,128,0.35)' : theme.border}`, color: mp.isMultiDevice ? '#4ADE80' : theme.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}><ShareIcon size={12} /> {sharing ? '...' : mp.isMultiDevice ? 'Shared' : 'Share'}</button>}
          {!isGuestView && <button onClick={() => { haptic(); setShowEndModal(true) }} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#F87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{'\u2716'} End Game</button>}
          {!isGuestView && <button onClick={() => { haptic(); setShowAbandonConfirm(true) }} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#FBBF24', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{'\u26A0'} Abandon</button>}
          {isGuestView && <button onClick={() => { haptic(); mp.endSession(); onEndGame() }} style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#FBBF24', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', fontFamily: "'Cinzel', serif" }}>{'\u26A0'} Leave</button>}
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

        {/* Player grid — Guest gets a compact layout */}
        {isGuestView ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 'calc(100vh - 200px)' }}>
            {/* Own player card — full size */}
            {(() => {
              const ownPlayer = players.find(p => p.id === guestClaimedPlayerId)
              if (!ownPlayer) return null
              return (
                <div style={{ flex: '1 1 auto', minHeight: 200, display: 'flex', flexDirection: 'column' }}>
                  <PlayerCard
                    player={ownPlayer} players={players} theme={theme} isCommander={isCommander}
                    onUpdate={(updates) => updatePlayer(ownPlayer.id, updates)}
                    onRemove={() => {}}
                    isMinimized={false}
                    onToggleMinimize={() => {}}
                    isDesktop={isDesktop}
                    isConnected={true}
                    isReadOnly={false}
                  />
                </div>
              )
            })()}

            {/* Other players — compact list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, color: theme.muted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4, fontFamily: "'Cinzel', serif" }}>Other Players</div>
              {players.filter(p => p.id !== guestClaimedPlayerId).map(player => {
                const isExpanded = expandedOpponent === player.id
                const isPlayerConnected = !!mp.connectedPlayers[player.id]
                return (
                  <div key={player.id} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    {/* Compact row — tap to expand */}
                    <div
                      onClick={() => setExpandedOpponent(isExpanded ? null : player.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isPlayerConnected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />}
                        <span style={{ fontWeight: 700, fontSize: 14, color: theme.text, fontFamily: "'Cinzel', serif" }}>{player.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: theme.accent, fontFamily: "'Cinzel', serif" }}>{player.life}</span>
                        {player.poison > 0 && <span style={{ fontSize: 12, color: '#4ADE80' }}>☠ {player.poison}</span>}
                        {isCommander && (() => {
                          const ownPlayer = players.find(p => p.id === guestClaimedPlayerId)
                          if (!ownPlayer) return null
                          const trackers = getCmdrTrackers(ownPlayer.commanderDamage, player.id)
                          const totalCmdr = trackers.reduce((s, t) => s + t.damage, 0)
                          return totalCmdr > 0 ? <span style={{ fontSize: 12, color: '#FBBF24' }}>⚔ {totalCmdr}</span> : null
                        })()}
                        <span style={{ fontSize: 12, color: theme.muted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                      </div>
                    </div>
                    {/* Expanded detail — show counters */}
                    {isExpanded && (
                      <div style={{ padding: '8px 14px 12px', borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: theme.text }}>
                          <span>❤️ Life: <strong>{player.life}</strong></span>
                          <span>☠ Poison: <strong>{player.poison || 0}</strong></span>
                          {player.energy > 0 && <span>⚡ Energy: <strong>{player.energy}</strong></span>}
                          {player.experience > 0 && <span>⭐ Experience: <strong>{player.experience}</strong></span>}
                        </div>
                        {isCommander && (
                          <div style={{ fontSize: 11, color: theme.muted }}>
                            <div style={{ marginBottom: 4, fontWeight: 600 }}>Commander Damage Dealt to You:</div>
                            {(() => {
                              const ownPlayer = players.find(p => p.id === guestClaimedPlayerId)
                              if (!ownPlayer) return null
                              const trackers = getCmdrTrackers(ownPlayer.commanderDamage, player.id)
                              return trackers.map((t, i) => (
                                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                                  <span>{t.name || `Cmdr ${i + 1}`}:</span>
                                  <strong style={{ color: t.damage >= 21 ? '#F87171' : theme.accent }}>{t.damage}</strong>
                                  {t.damage >= 21 && <span style={{ color: '#F87171', fontSize: 10 }}>LETHAL</span>}
                                </div>
                              ))
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={players.map(p => p.id)} strategy={rectSwappingStrategy}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: (() => {
                if (gridCols > 0) return `repeat(${gridCols}, 1fr)`
                // Auto layout
                if (isDesktop) return players.length === 2 ? '1fr 1fr' : players.length >= 6 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'
                return players.length === 2 ? '1fr' : players.length >= 6 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)'
              })(),
              gridAutoRows: '1fr', gap: (gridCols >= 3 || (gridCols === 0 && players.length >= 6)) ? 8 : 12,
              minHeight: isDesktop ? 'calc(100vh - 120px)' : 'calc(100vh - 200px)',
            }}>
              {players.map((player, index) => {
                const rotation = player.rotation || 0
                const needsWrapper = rotation === 90 || rotation === 270
                const cols = gridCols > 0 ? gridCols : (players.length >= 6 ? 3 : 2)
                const remainder = cols === 1 ? 0 : players.length % cols
                const isLastInShortRow = remainder !== 0 && index >= players.length - remainder
                const isPlayerConnected = !!mp.connectedPlayers[player.id]
                const isOwnPlayer = isGuestView && player.id === guestClaimedPlayerId
                const isReadOnly = isGuestView && !isOwnPlayer
                const cardElement = (
                  <PlayerCard
                    player={player} players={players} theme={theme} isCommander={isCommander}
                    onUpdate={isReadOnly ? () => {} : (updates) => updatePlayer(player.id, updates)}
                    onRemove={isGuestView ? () => {} : () => removePlayer(player.id)}
                    isMinimized={!!minimized[player.id]}
                    onToggleMinimize={() => setMinimized(prev => ({ ...prev, [player.id]: !prev[player.id] }))}
                    isDesktop={isDesktop}
                    onEditPlayer={isGuestView ? undefined : openEditPlayer}
                    isConnected={mp.isMultiDevice && isPlayerConnected}
                    isReadOnly={isReadOnly}
                  />
                )
                return (
                  <SortablePlayerPanel key={player.id} id={player.id} theme={theme} gridColumn={isLastInShortRow && remainder === 1 ? `span ${cols}` : undefined} onRotate={() => rotatePlayer(player.id)}>
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
        )}
      </div>

      {/* Share Game Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="Share Game">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: 14 }}>
            Scan the QR code or share the link to let others join this game on their device.
          </p>
          {shareUrl && (
            <>
              <div style={{ display: 'inline-block', padding: 16, background: '#fff', borderRadius: 12, marginBottom: 16 }}>
                <QRCodeSVG value={shareUrl} size={200} level="M" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: 28, fontWeight: 800, letterSpacing: '0.2em', color: 'var(--text-primary)' }}>{mp.sessionCode}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <input
                  readOnly
                  value={shareUrl}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', minWidth: 0 }}
                  onClick={e => e.target.select()}
                />
                <button onClick={copyShareUrl} style={{ padding: '8px 16px', borderRadius: 8, background: copied ? '#4ADE80' : 'var(--accent)', border: 'none', color: copied ? '#000' : 'var(--bg-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', fontFamily: "'Cinzel', serif" }}>
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {Object.keys(mp.connectedPlayers).length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Connected Players</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(mp.connectedPlayers).map(([playerId, info]) => {
                      const player = players.find(p => String(p.id) === String(playerId))
                      return (
                        <div key={playerId} style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                          <ConnectedDot connected={true} />
                          <span style={{ color: 'var(--text-primary)', fontSize: 14, fontFamily: "'Cinzel', serif" }}>{player?.name || info.displayName}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* End Game Modal */}
      <Modal isOpen={showEndModal} onClose={() => { if (!gameSaved) setShowEndModal(false) }} title={gameSaved ? 'Game Saved! 🏆' : 'End Game'}>
        {gameSaved ? (
          <div className="endgame-modal" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 14 }}>What's next?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                type="button"
                onClick={handleRunItBack}
                style={{ padding: '14px 24px', borderRadius: 10, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ADE80', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cinzel', serif", letterSpacing: '0.05em' }}
              >
                🔄 Run It Back
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Same players, same format — reset life & counters</span>
              <button
                type="button"
                onClick={() => { if (mp.isMultiDevice) mp.endSession(); onEndGame('new-game') }}
                style={{ padding: '12px 24px', borderRadius: 10, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.35)', color: '#60A5FA', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cinzel', serif", marginTop: 8 }}
              >
                🎲 New Game
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Different players or format</span>
              <button
                type="button"
                onClick={handleDoneAfterSave}
                style={{ padding: '10px 24px', borderRadius: 10, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Cinzel', serif", marginTop: 4 }}
              >
                Back to Menu
              </button>
            </div>
          </div>
        ) : (
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
        )}
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
