'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Attempt = {
  id: string
  processed_video_url: string | null
}

export default function ComparePage() {
  const [attempts, setAttempts] = useState<Attempt[]>([])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ids = params.get('ids')?.split(',') ?? []

    if (ids.length !== 2) return

    supabase
      .from('attempts')
      .select('id, processed_video_url')
      .in('id', ids)
      .then(({ data }) => {
        setAttempts(data ?? [])
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
    <main className="min-h-screen bg-[#FBF6EC] p-6">
      <div className="max-w-6xl mx-auto space-y-4">

        <div className="flex justify-between items-center">
          <div className="text-sm font-semibold">
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
          {attempts.map(a => (
            <video
              key={a.id}
              src={a.processed_video_url!}
              controls
              className="w-full rounded bg-black object-contain"
            />
          ))}
        </div>
      </div>
    </main>
  )
}