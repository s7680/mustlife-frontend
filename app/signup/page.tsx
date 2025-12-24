'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function SignupPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    setError(null)

    if (!email || !password) {
      setError('Email and password required')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // ✅ STRICT FLOW: redirect to login
    router.push('/login')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#EAF4FF]">
      <div className="w-[360px] bg-white border rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold text-center">Create account</h1>

        <input
          className="w-full border p-2 rounded"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 transition"
        >
          {loading ? 'Creating...' : 'Create account'}
        </button>

        <p className="text-sm text-center">
          Already have an account?{' '}
          <span
            className="underline cursor-pointer"
            onClick={() => router.push('/login')}
          >
            Login
          </span>
        </p>
      </div>
    </main>
  )
}