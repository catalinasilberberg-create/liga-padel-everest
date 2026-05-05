import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const [telefono, setTelefono] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function buscarJugadora() {
    setLoading(true)
    setError('')
    const tel = telefono.trim()
    const { data, error } = await supabase
      .from('parejas')
      .select('*')
      .or(`telefono1.eq.${tel},telefono2.eq.${tel}`)
      .single()

    if (error || !data) {
      if (tel === process.env.NEXT_PUBLIC_ADMIN_PHONE) {
        localStorage.setItem('user', JSON.stringify({ rol: 'admin', nombre: 'Administrador' }))
        router.push('/admin')
      } else {
        setError('Número no encontrado. Verifica que sea el número registrado en la liga.')
      }
    } else {
      localStorage.setItem('user', JSON.stringify({
        rol: 'jugadora',
        pareja_id: data.id,
        nombre: data.nombre,
        categoria: data.categoria,
        grupo: data.grupo,
      }))
      router.push('/jugadora')
    }
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">Liga<span>Pádel</span></div>
      <p className="login-sub">Club Everest · 1er Semestre 2026</p>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <div className="field">
          <label>Tu número de teléfono</label>
          <input
            type="tel"
            placeholder="Ej: 56912345678"
            value={telefono}
            onChange={e => setTelefono(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarJugadora()}
          />
          <p style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            Con código de país, sin espacios. Ej: 56912345678
          </p>
        </div>
        {error && <p style={{ fontSize: 13, color: '#A32D2D', marginBottom: 8 }}>{error}</p>}
        <button className="btn btn-verde" onClick={buscarJugadora} disabled={loading || !telefono}>
          {loading ? 'Buscando...' : 'Entrar →'}
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#bbb', marginTop: '3rem', textAlign: 'center' }}>
        ¿Problemas para entrar? Escríbele a la administradora.
      </p>
    </div>
  )
}
