pages/jugadora.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Link from 'next/link'

export default function Jugadora() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('inicio')
  const [partido, setPartido] = useState(null)
  const [historial, setHistorial] = useState([])
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) { router.push('/'); return }
    const parsed = JSON.parse(u)
    if (parsed.rol === 'admin') { router.push('/admin'); return }
    setUser(parsed)
    cargarDatos(parsed)
  }, [])

  async function cargarDatos(u) {
    setLoading(true)
    // Próximo partido
    const { data: partidos } = await supabase
      .from('partidos')
      .select(`*, fecha:fechas(*), pareja1:parejas!partidos_pareja1_id_fkey(*), pareja2:parejas!partidos_pareja2_id_fkey(*)`)
      .or(`pareja1_id.eq.${u.pareja_id},pareja2_id.eq.${u.pareja_id}`)
      .order('fecha_id', { ascending: true })

    if (partidos) {
      // Buscar el próximo sin resultado
      const { data: resultados } = await supabase
        .from('resultados')
        .select('partido_id')
        .eq('aprobado', true)

      const ids_con_resultado = new Set((resultados || []).map(r => r.partido_id))
      const proximo = partidos.find(p => !ids_con_resultado.has(p.id))
      setPartido(proximo || null)

      // Historial: partidos con resultado
      const conResultado = partidos.filter(p => ids_con_resultado.has(p.id))
      const idsConRes = conResultado.map(p => p.id)
      if (idsConRes.length > 0) {
        const { data: resData } = await supabase
          .from('resultados')
          .select('*')
          .in('partido_id', idsConRes)
        const resMap = {}
        ;(resData || []).forEach(r => resMap[r.partido_id] = r)
        setHistorial(conResultado.map(p => ({ ...p, resultado: resMap[p.id] })).reverse())
      }
    }

    // Ranking de su categoría/grupo
    const { data: todasParejas } = await supabase
      .from('parejas')
      .select('*')
      .eq('categoria', u.categoria)
      .eq('grupo', u.grupo || '')

    if (todasParejas) {
      const ids = todasParejas.map(p => p.id)
      const { data: todosPartidos } = await supabase
        .from('partidos')
        .select('*, resultado:resultados(*)')
        .or(ids.map(id => `pareja1_id.eq.${id}`).join(',') + ',' + ids.map(id => `pareja2_id.eq.${id}`).join(','))

      const pts = {}; const diff = {}
      todasParejas.forEach(p => { pts[p.id] = 0; diff[p.id] = 0 })

      ;(todosPartidos || []).forEach(p => {
        const r = p.resultado
        if (!r || !r.aprobado) return
        if (r.puntos_p1 !== null) pts[p.pareja1_id] = (pts[p.pareja1_id] || 0) + r.puntos_p1
        if (r.puntos_p2 !== null) pts[p.pareja2_id] = (pts[p.pareja2_id] || 0) + r.puntos_p2
        if (r.diff_p1 !== null) diff[p.pareja1_id] = (diff[p.pareja1_id] || 0) + r.diff_p1
        if (r.diff_p2 !== null) diff[p.pareja2_id] = (diff[p.pareja2_id] || 0) + r.diff_p2
      })

      const ranking = todasParejas
        .map(p => ({ ...p, pts: pts[p.id] || 0, diff: diff[p.id] || 0 }))
        .sort((a, b) => b.pts - a.pts || b.diff - a.diff)
        .map((p, i) => ({ ...p, pos: i + 1 }))
      setRanking(ranking)
    }
    setLoading(false)
  }

  function calcPuntos(r) {
    if (!r) return null
    const s1p1 = r.set1_p1 || 0, s1p2 = r.set1_p2 || 0
    const s2p1 = r.set2_p1 || 0, s2p2 = r.set2_p2 || 0
    const w1 = (s1p1 > s1p2 ? 1 : 0) + (s2p1 > s2p2 ? 1 : 0)
    const w2 = (s1p2 > s1p1 ? 1 : 0) + (s2p2 > s2p1 ? 1 : 0)
    return { w1, w2 }
  }

  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return null

  const NavBar = () => (
    <nav className="bottom-nav">
      {[
        { id: 'inicio', label: 'Inicio', icon: '⌂' },
        { id: 'partido', label: 'Mi partido', icon: '🎾' },
        { id: 'ranking', label: 'Tabla', icon: '📊' },
        { id: 'historial', label: 'Historial', icon: '📋' },
      ].map(n => (
        <button key={n.id} className={`nav-btn ${tab === n.id ? 'active' : ''}`} onClick={() => setTab(n.id)}>
          <span style={{ fontSize: 20 }}>{n.icon}</span>
          {n.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar-logo">Liga<span>Pádel</span></div>
        <div className="topbar-sub">{user.nombre}</div>
      </div>

      {tab === 'inicio' && (
        <div className="section">
          {partido ? (
            <>
              <p className="section-title">Próximo partido</p>
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      {partido.pareja1?.nombre} <span style={{ color: '#999', fontWeight: 400 }}>vs</span> {partido.pareja2?.nombre}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>{partido.fecha?.nombre} · {partido.hora}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                      {partido.lugar === 'PLT' ? 'Pádel Los Trapenses' : partido.lugar === 'Everest' ? 'Club Everest' : partido.lugar}
                      {partido.cancha ? ` · Cancha ${partido.cancha}` : ''}
                    </div>
                  </div>
                  <span className="badge badge-gris">{partido.categoria?.replace('CATEGORÍA ', 'Cat ')}</span>
                </div>
                <button className="btn btn-verde" onClick={() => setTab('partido')}>
                  Ingresar resultado →
                </button>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎾</div>
              <div style={{ fontSize: 14, color: '#666' }}>No hay partidos pendientes</div>
            </div>
          )}

          {ranking.length > 0 && (
            <>
              <p className="section-title" style={{ marginTop: '1rem' }}>Tu posición</p>
              <div className="card">
                {ranking.slice(0, 3).map(p => (
                  <div key={p.id} className={`rank-row ${p.id === user.pareja_id ? 'me' : ''}`}>
                    <span className="rank-num">{p.pos}</span>
                    <span className="rank-name">{p.nombre}{p.id === user.pareja_id ? ' 👈' : ''}</span>
                    <span className="rank-diff">{p.diff > 0 ? '+' : ''}{p.diff}</span>
                    <span className="rank-pts">{p.pts}</span>
                  </div>
                ))}
                {ranking.length > 3 && (
                  <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setTab('ranking')}>
                    Ver tabla completa
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'partido' && partido && (
        <IngresoResultado partido={partido} user={user} onGuardado={() => cargarDatos(user)} />
      )}
      {tab === 'partido' && !partido && (
        <div className="section">
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 14, color: '#666' }}>No hay partidos pendientes de resultado</div>
          </div>
        </div>
      )}

      {tab === 'ranking' && (
        <div className="section">
          <p className="section-title">{user.categoria} {user.grupo ? `· ${user.grupo}` : ''}</p>
          <div className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', fontSize: 11, color: '#999', paddingBottom: 8, borderBottom: '0.5px solid #eee', marginBottom: 4 }}>
              <span style={{ width: 26 }}>#</span>
              <span style={{ flex: 1 }}>Pareja</span>
              <span style={{ width: 36, textAlign: 'right' }}>Dif.</span>
              <span style={{ width: 32, textAlign: 'right' }}>Pts</span>
            </div>
            {ranking.map(p => (
              <div key={p.id} className={`rank-row ${p.id === user.pareja_id ? 'me' : ''}`}>
                <span className="rank-num">{p.pos}</span>
                <span className="rank-name">{p.nombre}{p.id === user.pareja_id ? ' 👈' : ''}</span>
                <span className="rank-diff">{p.diff > 0 ? '+' : ''}{p.diff}</span>
                <span className="rank-pts">{p.pts}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <div className="section">
          <p className="section-title">Mis partidos jugados</p>
          {historial.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '1.5rem', color: '#999', fontSize: 14 }}>
              Aún no hay resultados registrados
            </div>
          )}
          {historial.map(p => {
            const r = p.resultado
            const esP1 = p.pareja1_id === user.pareja_id
            const miPts = esP1 ? r?.puntos_p1 : r?.puntos_p2
            const gane = miPts === 3
            return (
              <div key={p.id} className="match-card">
                <div className="match-teams">
                  <span className="match-team" style={{ color: esP1 && gane ? '#1D9E75' : esP1 && !gane ? '#A32D2D' : '' }}>
                    {p.pareja1?.nombre}
                  </span>
                  <span className="match-score">
                    {r ? `${r.set1_p1}-${r.set1_p2} / ${r.set2_p1}-${r.set2_p2}${r.tb_p1 ? ` / ${r.tb_p1}-${r.tb_p2}` : ''}` : '—'}
                  </span>
                  <span className="match-team" style={{ color: !esP1 && gane ? '#1D9E75' : !esP1 && !gane ? '#A32D2D' : '' }}>
                    {p.pareja2?.nombre}
                  </span>
                </div>
                <div className="match-meta">
                  <span>{p.fecha?.nombre}</span>
                  <span className={`badge ${gane ? 'badge-verde' : 'badge-rojo'}`}>{gane ? 'Victoria' : 'Derrota'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <NavBar />
    </div>
  )
}

function IngresoResultado({ partido, user, onGuardado }) {
  const [s1p1, setS1p1] = useState('')
  const [s1p2, setS1p2] = useState('')
  const [s2p1, setS2p1] = useState('')
  const [s2p2, setS2p2] = useState('')
  const [tbp1, setTbp1] = useState('')
  const [tbp2, setTbp2] = useState('')
  const [loading, setLoading] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const necesitaTB = () => {
    const w1 = (Number(s1p1) > Number(s1p2) ? 1 : 0) + (Number(s2p1) > Number(s2p2) ? 1 : 0)
    const w2 = (Number(s1p2) > Number(s1p1) ? 1 : 0) + (Number(s2p2) > Number(s2p1) ? 1 : 0)
    return s1p1 && s1p2 && s2p1 && s2p2 && w1 === 1 && w2 === 1
  }

  function calcPuntos() {
    const w1 = (Number(s1p1) > Number(s1p2) ? 1 : 0) + (Number(s2p1) > Number(s2p2) ? 1 : 0)
    const w2 = (Number(s1p2) > Number(s1p1) ? 1 : 0) + (Number(s2p2) > Number(s2p1) ? 1 : 0)
    if (w1 === 2) return { p1: 3, p2: 0 }
    if (w2 === 2) return { p1: 0, p2: 3 }
    if (w1 === 1 && w2 === 1 && tbp1 && tbp2) {
      return Number(tbp1) > Number(tbp2) ? { p1: 3, p2: 1 } : { p1: 1, p2: 3 }
    }
    return { p1: 2, p2: 2 }
  }

  async function guardar() {
    setLoading(true)
    const { p1, p2 } = calcPuntos()
    const diffP1 = (Number(s1p1) - Number(s1p2)) + (Number(s2p1) - Number(s2p2)) + (tbp1 ? Number(tbp1) - Number(tbp2) : 0)

    await supabase.from('resultados').upsert({
      partido_id: partido.id,
      set1_p1: Number(s1p1), set1_p2: Number(s1p2),
      set2_p1: Number(s2p1), set2_p2: Number(s2p2),
      tb_p1: tbp1 ? Number(tbp1) : null,
      tb_p2: tbp2 ? Number(tbp2) : null,
      puntos_p1: p1, puntos_p2: p2,
      diff_p1: diffP1, diff_p2: -diffP1,
      ingresado_por: user.nombre,
      aprobado: false,
    }, { onConflict: 'partido_id' })

    setGuardado(true)
    setLoading(false)
    setTimeout(() => { onGuardado(); setGuardado(false) }, 2000)
  }

  if (guardado) return (
    <div className="section" style={{ textAlign: 'center', paddingTop: '3rem' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Resultado enviado</div>
      <div style={{ fontSize: 13, color: '#666' }}>La administradora lo revisará pronto</div>
    </div>
  )

  const { p1, p2 } = s1p1 && s1p2 && s2p1 && s2p2 ? calcPuntos() : { p1: null, p2: null }

  return (
    <div className="section">
      <p className="section-title">Ingresar resultado</p>
      <div style={{ fontSize: 13, color: '#666', marginBottom: 12, textAlign: 'center' }}>
        {partido.pareja1?.nombre} <b>vs</b> {partido.pareja2?.nombre}
      </div>

      <div className="card">
        <div style={{ display: 'flex', fontSize: 11, color: '#999', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #eee' }}>
          <span style={{ width: 44 }}></span>
          <span style={{ flex: 1, textAlign: 'center' }}>{partido.pareja1?.nombre.split(' - ')[0]}</span>
          <span style={{ width: 16 }}></span>
          <span style={{ flex: 1, textAlign: 'center' }}>{partido.pareja2?.nombre.split(' - ')[0]}</span>
        </div>

        <div className="score-row">
          <span className="score-label">Set 1</span>
          <input className="score-input" type="number" min="0" max="7" value={s1p1} onChange={e => setS1p1(e.target.value)} placeholder="0" />
          <span className="score-sep">–</span>
          <input className="score-input" type="number" min="0" max="7" value={s1p2} onChange={e => setS1p2(e.target.value)} placeholder="0" />
        </div>
        <div className="score-row">
          <span className="score-label">Set 2</span>
          <input className="score-input" type="number" min="0" max="7" value={s2p1} onChange={e => setS2p1(e.target.value)} placeholder="0" />
          <span className="score-sep">–</span>
          <input className="score-input" type="number" min="0" max="7" value={s2p2} onChange={e => setS2p2(e.target.value)} placeholder="0" />
        </div>
        {necesitaTB() && (
          <div className="score-row">
            <span className="score-label">TB</span>
            <input className="score-input" type="number" min="0" value={tbp1} onChange={e => setTbp1(e.target.value)} placeholder="0" />
            <span className="score-sep">–</span>
            <input className="score-input" type="number" min="0" value={tbp2} onChange={e => setTbp2(e.target.value)} placeholder="0" />
          </div>
        )}

        {p1 !== null && (
          <div style={{ background: '#f5f5f3', borderRadius: 8, padding: '10px 12px', marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span>{partido.pareja1?.nombre.split(' - ')[0]}: <b style={{ color: p1 === 3 ? '#1D9E75' : '#666' }}>{p1} pts</b></span>
            <span>{partido.pareja2?.nombre.split(' - ')[0]}: <b style={{ color: p2 === 3 ? '#1D9E75' : '#666' }}>{p2} pts</b></span>
          </div>
        )}
      </div>

      <button
        className="btn btn-verde"
        onClick={guardar}
        disabled={loading || !s1p1 || !s1p2 || !s2p1 || !s2p2 || (necesitaTB() && (!tbp1 || !tbp2))}
      >
        {loading ? 'Guardando...' : 'Enviar resultado →'}
      </button>
      <p style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 8 }}>
        La administradora revisará y aprobará el resultado
      </p>
    </div>
  )
}
