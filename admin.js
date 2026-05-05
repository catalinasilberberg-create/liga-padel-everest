pages/admin.js
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const CATS = ['PRINCIPIANTE', 'CATEGORÍA D', 'CATEGORÍA C -', 'CATEGORÍA C+']

export default function Admin() {
  const router = useRouter()
  const [tab, setTab] = useState('resultados')
  const [pendientes, setPendientes] = useState([])
  const [aprobados, setAprobados] = useState([])
  const [ranking, setRanking] = useState({})
  const [catSeleccionada, setCatSeleccionada] = useState('PRINCIPIANTE')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const u = localStorage.getItem('user')
    if (!u) { router.push('/'); return }
    const parsed = JSON.parse(u)
    if (parsed.rol !== 'admin') { router.push('/jugadora'); return }
    cargarTodo()
  }, [])

  async function cargarTodo() {
    setLoading(true)
    // Resultados pendientes de aprobar
    const { data: resPend } = await supabase
      .from('resultados')
      .select(`*, partido:partidos(*, fecha:fechas(*), pareja1:parejas!partidos_pareja1_id_fkey(*), pareja2:parejas!partidos_pareja2_id_fkey(*))`)
      .eq('aprobado', false)
      .order('created_at', { ascending: false })
    setPendientes(resPend || [])

    // Últimos aprobados
    const { data: resApro } = await supabase
      .from('resultados')
      .select(`*, partido:partidos(*, fecha:fechas(*), pareja1:parejas!partidos_pareja1_id_fkey(*), pareja2:parejas!partidos_pareja2_id_fkey(*))`)
      .eq('aprobado', true)
      .order('created_at', { ascending: false })
      .limit(20)
    setAprobados(resApro || [])

    // Ranking por categoría
    const rankData = {}
    for (const cat of CATS) {
      const { data: parejas } = await supabase.from('parejas').select('*').eq('categoria', cat)
      if (!parejas) continue
      const ids = parejas.map(p => p.id)
      const { data: partidos } = await supabase
        .from('partidos')
        .select('*, resultado:resultados(*)')
        .or(ids.map(id => `pareja1_id.eq.${id}`).join(',') + ',' + ids.map(id => `pareja2_id.eq.${id}`).join(','))

      const pts = {}; const diff = {}
      parejas.forEach(p => { pts[p.id] = 0; diff[p.id] = 0 })
      ;(partidos || []).forEach(p => {
        const r = p.resultado
        if (!r || !r.aprobado) return
        pts[p.pareja1_id] = (pts[p.pareja1_id] || 0) + (r.puntos_p1 || 0)
        pts[p.pareja2_id] = (pts[p.pareja2_id] || 0) + (r.puntos_p2 || 0)
        diff[p.pareja1_id] = (diff[p.pareja1_id] || 0) + (r.diff_p1 || 0)
        diff[p.pareja2_id] = (diff[p.pareja2_id] || 0) + (r.diff_p2 || 0)
      })

      // Agrupar por grupo
      const grupos = {}
      parejas.forEach(p => {
        const g = p.grupo || 'Sin grupo'
        if (!grupos[g]) grupos[g] = []
        grupos[g].push({ ...p, pts: pts[p.id] || 0, diff: diff[p.id] || 0 })
      })
      Object.keys(grupos).forEach(g => {
        grupos[g].sort((a, b) => b.pts - a.pts || b.diff - a.diff)
        grupos[g] = grupos[g].map((p, i) => ({ ...p, pos: i + 1 }))
      })
      rankData[cat] = grupos
    }
    setRanking(rankData)
    setLoading(false)
  }

  async function aprobar(id) {
    await supabase.from('resultados').update({ aprobado: true }).eq('id', id)
    cargarTodo()
  }

  async function rechazar(id) {
    await supabase.from('resultados').delete().eq('id', id)
    cargarTodo()
  }

  if (loading) return <div className="loading">Cargando...</div>

  const NavBar = () => (
    <nav className="bottom-nav">
      {[
        { id: 'resultados', label: 'Resultados', icon: '🎾' },
        { id: 'tabla', label: 'Tabla', icon: '📊' },
        { id: 'parejas', label: 'Parejas', icon: '👥' },
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
        <div className="topbar-logo">Liga<span>Pádel</span> <span style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>Admin</span></div>
      </div>

      {tab === 'resultados' && (
        <div className="section">
          {pendientes.length > 0 && (
            <>
              <p className="section-title">Por aprobar ({pendientes.length})</p>
              {pendientes.map(r => (
                <div key={r.id} className="card" style={{ borderLeft: '3px solid #BA7517' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {r.partido?.pareja1?.nombre} <span style={{ color: '#999', fontWeight: 400 }}>vs</span> {r.partido?.pareja2?.nombre}
                  </div>
                  <div style={{ fontSize: 13, color: '#444', marginBottom: 6 }}>
                    {r.set1_p1}-{r.set1_p2} / {r.set2_p1}-{r.set2_p2}
                    {r.tb_p1 ? ` / TB: ${r.tb_p1}-${r.tb_p2}` : ''}
                    <span style={{ marginLeft: 8, color: '#666' }}>· {r.puntos_p1}–{r.puntos_p2} pts</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>
                    {r.partido?.fecha?.nombre} · Ingresado por {r.ingresado_por}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button className="btn btn-verde" style={{ marginTop: 0 }} onClick={() => aprobar(r.id)}>✓ Aprobar</button>
                    <button className="btn btn-outline" style={{ marginTop: 0, color: '#A32D2D', borderColor: '#A32D2D' }} onClick={() => rechazar(r.id)}>✕ Rechazar</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {pendientes.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '1.5rem', marginBottom: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>✅</div>
              <div style={{ fontSize: 13, color: '#666' }}>Todo al día, sin resultados pendientes</div>
            </div>
          )}

          <p className="section-title">Últimos aprobados</p>
          {aprobados.slice(0, 8).map(r => (
            <div key={r.id} className="match-card">
              <div className="match-teams">
                <span className="match-team">{r.partido?.pareja1?.nombre}</span>
                <span className="match-score">{r.set1_p1}-{r.set1_p2} / {r.set2_p1}-{r.set2_p2}{r.tb_p1 ? ` / ${r.tb_p1}-${r.tb_p2}` : ''}</span>
                <span className="match-team">{r.partido?.pareja2?.nombre}</span>
              </div>
              <div className="match-meta">
                <span>{r.partido?.fecha?.nombre}</span>
                <span className="badge badge-verde">Aprobado</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tabla' && (
        <div className="section">
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {CATS.map(c => (
              <button
                key={c}
                onClick={() => setCatSeleccionada(c)}
                style={{
                  padding: '5px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: 'none',
                  background: catSeleccionada === c ? '#1D9E75' : '#f0f0ee',
                  color: catSeleccionada === c ? 'white' : '#666',
                  fontFamily: 'inherit', fontWeight: catSeleccionada === c ? 600 : 400,
                }}
              >
                {c.replace('CATEGORÍA ', 'Cat ')}
              </button>
            ))}
          </div>

          {ranking[catSeleccionada] && Object.entries(ranking[catSeleccionada]).map(([grupo, parejas]) => (
            <div key={grupo}>
              {grupo !== 'Sin grupo' && <p className="section-title">{grupo}</p>}
              <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: 12 }}>
                <div style={{ display: 'flex', fontSize: 11, color: '#999', paddingBottom: 6, borderBottom: '0.5px solid #eee', marginBottom: 4 }}>
                  <span style={{ width: 26 }}>#</span>
                  <span style={{ flex: 1 }}>Pareja</span>
                  <span style={{ width: 36, textAlign: 'right' }}>Dif.</span>
                  <span style={{ width: 32, textAlign: 'right' }}>Pts</span>
                </div>
                {parejas.map(p => (
                  <div key={p.id} className="rank-row">
                    <span className="rank-num">{p.pos}</span>
                    <span className="rank-name">{p.nombre}</span>
                    <span className="rank-diff">{p.diff > 0 ? '+' : ''}{p.diff}</span>
                    <span className="rank-pts">{p.pts}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'parejas' && <ParejasTab />}
      <NavBar />
    </div>
  )
}

function ParejasTab() {
  const [parejas, setParejas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState(null)
  const [tel1, setTel1] = useState('')
  const [tel2, setTel2] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('parejas').select('*').order('categoria').order('nombre').then(({ data }) => {
      setParejas(data || [])
      setLoading(false)
    })
  }, [])

  async function guardarTelefono(id) {
    await supabase.from('parejas').update({ telefono1: tel1, telefono2: tel2 }).eq('id', id)
    const { data } = await supabase.from('parejas').select('*').order('nombre')
    setParejas(data || [])
    setEditando(null)
  }

  const filtradas = parejas.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <div className="section">
      <div className="field" style={{ marginBottom: 12 }}>
        <input placeholder="Buscar pareja..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>
      <p style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
        Toca una pareja para agregar sus teléfonos (necesarios para que puedan entrar a la app)
      </p>
      {filtradas.map(p => (
        <div key={p.id} className="card" style={{ padding: '0.875rem 1rem', cursor: 'pointer' }} onClick={() => { setEditando(p.id); setTel1(p.telefono1 || ''); setTel2(p.telefono2 || '') }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{p.categoria?.replace('CATEGORÍA ', 'Cat ')} {p.grupo ? `· ${p.grupo}` : ''}</div>
            </div>
            <span className={`badge ${p.telefono1 ? 'badge-verde' : 'badge-amarillo'}`}>
              {p.telefono1 ? 'Con tel.' : 'Sin tel.'}
            </span>
          </div>
          {editando === p.id && (
            <div style={{ marginTop: 10, borderTop: '0.5px solid #eee', paddingTop: 10 }} onClick={e => e.stopPropagation()}>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Teléfono jugadora 1</label>
                <input placeholder="56912345678" value={tel1} onChange={e => setTel1(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 8 }}>
                <label>Teléfono jugadora 2</label>
                <input placeholder="56912345678" value={tel2} onChange={e => setTel2(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn btn-verde" style={{ marginTop: 0 }} onClick={() => guardarTelefono(p.id)}>Guardar</button>
                <button className="btn btn-outline" style={{ marginTop: 0 }} onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
