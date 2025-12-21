'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Skill = {
  id: string
  name: string
  community: string
}

export default function IssuesPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillIssues, setSkillIssues] = useState<Record<string, string[]>>({})

  const [community, setCommunity] = useState<string>('')
  const [skillId, setSkillId] = useState<string>('')
  const [issue, setIssue] = useState<string>('')

  /* ===== FETCH MASTER DATA ===== */

  useEffect(() => {
    fetchSkills()
    fetchSkillIssues()
  }, [])

  async function fetchSkills() {
    const { data } = await supabase.from('skills').select('id, name, community')
    setSkills(data ?? [])
  }

  async function fetchSkillIssues() {
    const { data } = await supabase
      .from('skill_issues')
      .select('skill_id, issue')

    const grouped: Record<string, string[]> = {}

    ;(data ?? []).forEach(r => {
      grouped[r.skill_id] ??= []
      grouped[r.skill_id].push(r.issue)
    })

    setSkillIssues(grouped)
  }

  /* ===== UI ===== */

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-black p-6">
      <div className="max-w-xl mx-auto space-y-6">

        {/* TITLE */}
        <h1 className="text-2xl font-semibold">Issues</h1>

        {/* COMMUNITY */}
        <select
          className="border p-2 w-full"
          value={community}
          onChange={e => {
            setCommunity(e.target.value)
            setSkillId('')
            setIssue('')
          }}
        >
          <option value="">Select community</option>
          {[...new Set(skills.map(s => s.community))].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* SKILL */}
        {community && (
          <select
            className="border p-2 w-full"
            value={skillId}
            onChange={e => {
              setSkillId(e.target.value)
              setIssue('')
            }}
          >
            <option value="">Select skill</option>
            {skills
              .filter(s => s.community === community)
              .map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
        )}

        {/* ISSUE */}
        {skillId && (
          <select
            className="border p-2 w-full"
            value={issue}
            onChange={e => setIssue(e.target.value)}
          >
            <option value="">Select issue</option>
            {(skillIssues[skillId] ?? []).map(i => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        )}

      </div>
    </main>
  )
}