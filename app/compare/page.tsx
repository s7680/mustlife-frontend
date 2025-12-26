'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

type Attempt = {
    id: string
    processed_video_url: string | null
}

export default function ComparePage() {
    const [attempts, setAttempts] = useState<Attempt[]>([])
    const videoRefs = useRef<HTMLVideoElement[]>([])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const a = params.get('a')
        const b = params.get('b')

        if (!a || !b) return

        const ids = [a, b]

        supabase
            .from('attempts')
            .select('id, processed_video_url')
            .in('id', ids)
            .then(({ data }) => {
                if (!data) return

                const ordered = ids.map(id =>
                    data.find(a => a.id === id)
                ).filter(Boolean) as Attempt[]

                setAttempts(ordered)
            })
    }, [])

    if (attempts.length !== 2) {
        return (
            <main className="min-h-screen flex items-center justify-center text-sm text-gray-500">
                Invalid comparison
            </main>
        )
    }

    return (
        <>
            {/* ===== HEADER (SAME AS HOME) ===== */}
            <header className="sticky top-0 z-20 bg-[#FBF6EC]/90 backdrop-blur border-b border-gray-200 px-6 py-4 flex justify-between">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-lg">MUST_Life</span>

                    <div
                        className="relative group cursor-pointer text-sm hover:text-black transition"
                        onClick={() => window.location.href = '/'}
                    >
                        🏠
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs border px-2 py-0.5 bg-white hidden group-hover:block">
                            Home
                        </span>
                    </div>
                </div>

                <button
                    className="text-sm underline cursor-pointer hover:text-black transition"
                    onClick={() => window.history.back()}
                >
                    Back
                </button>
            </header>

            <main className="min-h-screen bg-[#FBF6EC] p-6">
                <div className="max-w-6xl mx-auto space-y-4">

                    <div className="flex justify-between items-center">
                        <div className="text-center text-sm font-semibold text-gray-800">
                            Comparing two attempts
                        </div>

                        <button
                            className="text-xs underline"
                            onClick={() => window.history.back()}
                        >
                            Back
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {attempts.map((a, i) => (
                            <div key={a.id} className="space-y-1">
                                {a.processed_video_url ? (
                                    <video
                                        ref={el => {
                                            if (el) videoRefs.current[i] = el
                                        }}
                                        src={a.processed_video_url}
                                        controls
                                        className="w-full rounded bg-black object-contain"
                                    />
                                ) : (
                                    <div className="h-64 flex items-center justify-center text-xs text-gray-500 bg-gray-100 rounded">
                                        Processing…
                                    </div>
                                )}

                                <div className="text-center text-xs text-gray-800">
                                    Attempt {i + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-center gap-6 mt-6">
                        <button
                            className="px-6 py-2 bg-black text-white rounded text-sm"
                            onClick={() => {
                                videoRefs.current.forEach(v => v?.play())
                            }}
                        >
                            ▶ Play
                        </button>

                        <button
                            className="px-6 py-2 bg-black text-white rounded text-sm"
                            onClick={() => {
                                videoRefs.current.forEach(v => v?.pause())
                            }}
                        >
                            ⏸ Pause
                        </button>
                    </div>

                </div>
            </main>
        </>
    )
}