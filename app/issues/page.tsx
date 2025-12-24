'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Skill = {
    id: string
    name: string
    community: string
}

export default function IssuesPage() {
    const router = useRouter()
    const [skills, setSkills] = useState<Skill[]>([])
    const [skillIssues, setSkillIssues] = useState<Record<string, string[]>>({})

    const [community, setCommunity] = useState<string | null>(null)
    const [skillId, setSkillId] = useState<string | null>(null)
    const [issue, setIssue] = useState<string | null>(null)
    const [user, setUser] = useState<any>(null)
    const [role, setRole] = useState<string | null>(null)

    const [uploadType, setUploadType] =
        useState<'raw' | 'processed' | null>(null)
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    /* ===== FETCH ===== */
    useEffect(() => {
        fetchSkills()
        fetchSkillIssues()
    }, [])

    useEffect(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            if (!data?.user) return
            setUser(data.user)

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single()

            setRole(profile?.role ?? null)
        })
    }, [])

    async function fetchSkills() {
        const { data } = await supabase.from('skills').select('*')
        setSkills(data ?? [])
    }

    async function fetchSkillIssues() {
        const { data } = await supabase
            .from('skill_issues')
            .select('skill_id, issue')

        const grouped: Record<string, string[]> = {}
        data?.forEach(r => {
            grouped[r.skill_id] ??= []
            grouped[r.skill_id].push(r.issue)
        })

        setSkillIssues(grouped)
    }
    async function handleIssueUpload() {
        if (!user || role !== 'coach' || !file || !uploadType) return

        setUploading(true)

        try {
            const path = `issue_explanations/${user.id}/${Date.now()}-${file.name}`

            const { error: uploadErr } = await supabase.storage
                .from('raw_videos')
                .upload(path, file)

            if (uploadErr) throw uploadErr

            const { data } = supabase.storage
                .from('raw_videos')
                .getPublicUrl(path)

            const payload =
                uploadType === 'processed'
                    ? {
                        coach_id: user.id,
                        community,
                        skill_id: skillId,
                        issue,
                        processed_video_url: data.publicUrl,
                        processing_status: 'done',
                    }
                    : {
                        coach_id: user.id,
                        community,
                        skill_id: skillId,
                        issue,
                        raw_video_url: data.publicUrl,
                        processing_status: 'pending',
                    }

            const { error } = await supabase
                .from('issue_explanations')
                .insert(payload)

            if (error) throw error

            alert('Uploaded')
            setFile(null)
            setUploadType(null)
        } catch (e: any) {
            alert(e.message || 'Upload failed')
        } finally {
            setUploading(false)
        }
    }

    return (
        <main className="min-h-screen bg-[#FBF6EC] text-black p-6">
            <div className="max-w-4xl mx-auto bg-white border rounded-xl p-6 space-y-4">

                {/* BACK BUTTON */}
                <button
                    className="text-sm underline cursor-pointer hover:text-black transition"
                    onClick={() => router.back()}
                >
                    ← Back
                </button>

                <h1 className="text-xl font-semibold">Issue Explanations</h1>

                {/* ===== FILTER ===== */}
                <div className="space-y-3">

                    {/* COMMUNITY — SINGLE */}
                    <select
                        className="border p-2 w-full"
                        value={community ?? ''}
                        onChange={e => {
                            setCommunity(e.target.value || null)
                            setSkillId(null)
                            setIssue(null)
                        }}
                    >
                        <option value="">Select community</option>
                        {[...new Set(skills.map(s => s.community))].map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    {/* SKILL — SINGLE */}
                    {community && (
                        <select
                            className="border p-2 w-full"
                            value={skillId ?? ''}
                            onChange={e => {
                                setSkillId(e.target.value || null)
                                setIssue(null)
                            }}
                        >
                            <option value="">Select skill</option>
                            {skills
                                .filter(s => s.community === community)
                                .map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                        </select>
                    )}

                    {/* ISSUE — SINGLE */}
                    {skillId && (
                        <select
                            className="border p-2 w-full"
                            value={issue ?? ''}
                            onChange={e => setIssue(e.target.value || null)}
                        >
                            <option value="">Select issue</option>
                            {(skillIssues[skillId] ?? []).map(i => (
                                <option key={i} value={i}>{i}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* ===== PLACEHOLDER RESULT ===== */}
                {issue && (
                    <div className="border rounded p-4 bg-gray-50 text-sm">
                        Videos explaining <b>{issue}</b> will appear here.
                    </div>
                )}

                {/* ===== COACH UPLOAD (MINIMAL) ===== */}
                {user && role === 'coach' && community && skillId && issue && (
                    <div className="border rounded p-4 space-y-2 bg-white">

                        <select
                            className="border p-2 w-full"
                            value={uploadType ?? ''}
                            onChange={e => setUploadType(e.target.value as any)}
                        >
                            <option value="">Upload type</option>
                            <option value="raw">Raw video</option>
                            <option value="processed">Processed video</option>
                        </select>

                        {uploadType && (
                            <input
                                type="file"
                                accept="video/*"
                                onChange={e => setFile(e.target.files?.[0] || null)}
                            />
                        )}

                        <button
                            disabled={!file || uploading}
                            className="px-3 py-1 text-sm bg-black text-white rounded disabled:opacity-50"
                            onClick={handleIssueUpload}
                        >
                            {uploading ? 'Uploading…' : 'Upload'}
                        </button>

                    </div>
                )}
            </div>
        </main>
    )
}