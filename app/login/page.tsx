'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    async function login() {
        setError(null)
        setLoading(true)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        setLoading(false)

        if (error) {
            setError(error.message)
            return
        }

        window.location.href = '/'
    }

    async function signup() {
        setError(null)
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

        alert('Verification email sent. Please check your inbox.')
        setMode('login')
    }

    async function resetPassword() {
        setError(null)
        setLoading(true)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        })

        setLoading(false)

        if (error) {
            setError(error.message)
            return
        }

        alert('Password reset email sent.')
        setMode('login')
    }

    return (
        <main className="min-h-screen grid grid-cols-1 md:grid-cols-2">

            {/* LEFT IMAGE */}
            <div className="hidden md:block">
                <img
                    src="/activities3.jpg"
                    alt="Activities"
                    className="h-full w-full object-cover"
                />
            </div>

            {/* RIGHT FORM */}
            <div className="flex flex-col items-center justify-center bg-[#FBF6EC] gap-6">

                {/* ===== BRAND HEADER ===== */}
                <div className="text-center px-4">
                    <div className="text-3xl font-extrabold tracking-wide">
                        MUST LIFE
                    </div>

                    <div className="mt-2 text-sm text-gray-600 max-w-xs">
                        Practice. Feedback. Progress.
                    </div>
                </div>

                {/* ===== LOGIN BOX ===== */}
                <div className="w-[360px] bg-white border rounded-xl p-6 space-y-4">

                    <h1 className="text-lg font-semibold text-center text-gray-700">
                        {mode === 'login' && 'Login'}
                        {mode === 'signup' && 'Create account'}
                        {mode === 'forgot' && 'Reset password'}
                    </h1>

                    <input
                        type="email"
                        placeholder="Email"
                        className="w-full border p-2 rounded"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />

                    {mode !== 'forgot' && (
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full border p-2 rounded"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    )}

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}

                    {mode === 'login' && (
                        <button
                            onClick={login}
                            disabled={loading}
                            className="w-full bg-black text-white py-2 rounded"
                        >
                            Login
                        </button>
                    )}

                    {mode === 'signup' && (
                        <button
                            onClick={signup}
                            disabled={loading}
                            className="w-full bg-black text-white py-2 rounded"
                        >
                            Create account
                        </button>
                    )}

                    {mode === 'forgot' && (
                        <button
                            onClick={resetPassword}
                            disabled={loading}
                            className="w-full bg-black text-white py-2 rounded"
                        >
                            Send reset link
                        </button>
                    )}

                    <div className="text-center text-sm space-y-1">
                        {mode !== 'login' && (
                            <button
                                className="underline"
                                onClick={() => setMode('login')}
                            >
                                Back to login
                            </button>
                        )}

                        {mode === 'login' && (
                            <>
                                <button
                                    className="underline block"
                                    onClick={() => setMode('signup')}
                                >
                                    Create account
                                </button>
                                <button
                                    className="underline block"
                                    onClick={() => setMode('forgot')}
                                >
                                    Forgot password?
                                </button>
                            </>
                        )}
                    </div>

                </div>
            </div>
        </main>
    )
}