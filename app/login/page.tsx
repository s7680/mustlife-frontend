'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FBF6EC]">
      <div className="bg-white border rounded-xl p-6 w-80 space-y-4">
        <h1 className="text-lg font-semibold">Login</h1>

        <input
          className="border p-2 w-full"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="border p-2 w-full"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          className="w-full bg-black text-white py-2 rounded"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>

        <div className="text-xs text-center space-y-1">
          <button
            className="underline"
            onClick={() => router.push('/forgot-password')}
          >
            Forgot password?
          </button>
          <br />
          <button
            className="underline"
            onClick={() => router.push('/signup')}
          >
            Create account
          </button>
        </div>
      </div>
    </main>
  )
}