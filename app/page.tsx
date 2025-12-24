'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { supabase } from '../lib/supabase'
/* ===== IST DATE FORMATTER (GLOBAL) ===== */
const formatIST = (date: string | Date, withTime = true) => {
  const d = typeof date === 'string' ? new Date(date) : date

  return withTime
    ? d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: true,
    })
    : d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
    })
}

/* ================= TYPES ================= */
type Profile = {
  avatar_url: string | null
  bio: string | null
  display_name: string | null
  public_id: string | null
  impact?: number | null
  role?: string | null
  primary_community?: string | null
  primary_skill?: string | null
}

type Skill = {
  id: string
  name: string
  community: string   // ✅ ADD THIS
}

type Attempt = {
  id: string
  user_id: string
  processed_video_url: string | null
  skill_id?: string
  parent_attempt_id?: string | null   // ✅ ADD THIS
  created_at: string
  caption?: string | null
}

type AppComment = {
  id: string            // 👈 comment row id (uuid)
  user_id: string       // 👈 who wrote the comment
  attempt_id: string    // 👈 which video
  second: number
  issue: string
  issue_id?: string
  suggestion: string
  corrected_at?: string | null
  clarification?: string | null
  clarified_by?: string | null
  clarified_at?: string | null
  username?: string
  avatar_url?: string | null
  comment_likes?: { user_id: string }[]
  profiles?: {
    id: string
    display_name: string | null
    username: string | null
    avatar_url: string | null
  }
}

type UploadRow = {
  processed_video_url: string
  parent_attempt_id: string | null
  created_at: string
  skills: {
    name: string
    community: string
  } | null
}

/* ================= COMPONENT ================= */

const isReAttemptAttempt = (attempt: Attempt) =>
  Boolean(attempt.parent_attempt_id)

function handleFollow() {
  alert('Follow logic coming next')
}

export default function Home() {
  /* ---------- AUTH ---------- */

  const [helpIntent, setHelpIntent] = useState('')
  const [editingHelpIntent, setEditingHelpIntent] = useState(false)

  const [authLoading, setAuthLoading] = useState(true)

  const [profileCreated, setProfileCreated] = useState(false)
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [publicId, setPublicId] = useState('')
  const [editingPublicId, setEditingPublicId] = useState(false)
  const [publicIdStatus, setPublicIdStatus] =
    useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [clarifyingCommentId, setClarifyingCommentId] = useState<string | null>(null)
  const [clarificationDraft, setClarificationDraft] = useState('')

  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null)
  const [showLikesForComment, setShowLikesForComment] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const [correctionState, setCorrectionState] = useState<{
    commentId: string
    file: File | null
  } | null>(null)
  const [editDraft, setEditDraft] = useState<{
    second: number
    issue: string
    suggestion: string
  }>({
    second: 0,
    issue: '',
    suggestion: ''
  })
  const [loginEmail, setLoginEmail] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authMode, setAuthMode] = useState<
    'login' | 'verify_email' | 'complete_profile' | 'forgot_password' | 'reset_password'
  >('login')
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(false)

  const [username, setUsername] = useState('')
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([])
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle')
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [user, setUser] = useState<any>(null)
  const isGuest = user?.id === 'guest'
  // ===== PROFILE META (TEMP / UI ONLY) =====
  const [showProfile, setShowProfile] = useState(false)
  const [viewedUserId, setViewedUserId] = useState<string | null>(null)
  const profileUserId = user ? (viewedUserId ?? user.id) : null
  const isOwnProfile = profileUserId === user?.id
  const [isFollowing, setIsFollowing] = useState(false)
  const [impactScore, setImpactScore] = useState(0)
  const [skillDashboard, setSkillDashboard] = useState<{
    community: string
    skill: string
    attempts14d: number
    feedbackActed: number
    lastAttemptAt: string | null
  } | null>(null)

  // ===== OPEN PROFILE (CENTRALIZED) =====
  function openProfile(userId: string) {
    setViewedUserId(userId)
    setShowProfile(true)
    setActiveProfileAttempt(null)
    fetchProfile(userId)
    fetchAllProfileComments(userId)

    // persist intent across refresh
    localStorage.setItem('mustlife:view', 'profile')
    localStorage.setItem('mustlife:profileUserId', userId)

  }


  /* ---------- DATA ---------- */
  const [skills, setSkills] = useState<Skill[]>([])
  const [feedProfiles, setFeedProfiles] = useState<
    Record<string, { username: string; avatar_url: string | null }>
  >({})
  const [feed, setFeed] = useState<Attempt[]>([])
  const [videoMeta, setVideoMeta] = useState<
    Record<string, { portrait: boolean; duration: number }>
  >({})
  const [comments, setComments] = useState<Record<string, AppComment[]>>({})
  const [draftComments, setDraftComments] = useState<
    Record<string, { second: number; issue: string; suggestion: string }>
  >({})


  const [skillIssues, setSkillIssues] = useState<Record<string, string[]>>({})

  /* ---------- FEED FILTER STATE ---------- */
  const [searchPublicId, setSearchPublicId] = useState('')
  const [filterCommunity, setFilterCommunity] = useState<string | null>(null)
  const [filterSkill, setFilterSkill] = useState<string | null>(null)
  const [filterCommunities, setFilterCommunities] = useState<string[]>([])
  const [filterSkills, setFilterSkills] = useState<string[]>([])
  const [filterIssues, setFilterIssues] = useState<string[]>([])
  const [filterType, setFilterType] = useState<'latest' | 'following' | 'relevance'>('latest')
  const [filterApplied, setFilterApplied] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  /* ===== COMPARE ATTEMPTS (NEW) ===== */
  const [compareSkill, setCompareSkill] = useState<string | null>(null)
  const [compareAttempts, setCompareAttempts] = useState<Attempt[]>([])
  const [globalPlaybackRate, setGlobalPlaybackRate] = useState(1)
  const filterAppliedTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /* ---------- UPLOAD STATE (ADDED) ---------- */
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // ===== PROFILE VIDEO VIEW (ADDED) =====


  const [activeProfileAttempt, setActiveProfileAttempt] = useState<Attempt | null>(null)

  // ===== PROFILE STATE (ADDED) =====



  /* 🔹 AUTO-FETCH COMMENTS WHEN A VIDEO OPENS */
  useEffect(() => {
    if (compareAttempts.length === 2) {
      const ids = compareAttempts.map(a => a.id).join(',')
      window.location.href = `/compare?ids=${ids}`
    }
  }, [compareAttempts])
  useEffect(() => {
    if (!activeProfileAttempt) return
    fetchComments(activeProfileAttempt.id)
  }, [activeProfileAttempt])

  useEffect(() => {
    document.querySelectorAll('video').forEach(v => {
      try {
        v.playbackRate = globalPlaybackRate
      } catch { }
    })
  }, [globalPlaybackRate])
  function seekActiveVideo(second: number) {
    const video = document.getElementById('active-video') as HTMLVideoElement | null
    if (!video) return

    video.pause()
    video.currentTime = second <= 0 ? 0 : second
  }

  useEffect(() => {
    if (!activeProfileAttempt) return

    setDraftComments(prev => ({
      ...prev,
      [activeProfileAttempt.id]: {
        second: -1,     // Overall
        issue: '',
        suggestion: '',
      },
    }))
  }, [activeProfileAttempt])

  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(null)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [uploadType, setUploadType] = useState<'raw' | 'processed' | null>(null)
  const [attemptCaption, setAttemptCaption] = useState('')
  const [includeCaption, setIncludeCaption] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [viewerRole, setViewerRole] = useState<string | null>(null)
  const [showCoachScan, setShowCoachScan] = useState(false)
  const [showImprovementSnapshot, setShowImprovementSnapshot] = useState(false)
  const [primaryCommunity, setPrimaryCommunity] = useState<string | null>(null)
  const [primarySkill, setPrimarySkill] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)
  const [showPicModal, setShowPicModal] = useState(false)
  // ===== NOTIFICATIONS (NEW) =====
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [followers, setFollowers] = useState<string[]>([])
  const [followingCount, setFollowingCount] = useState(0)
  // ===== RE-ATTEMPT STATE =====
  const [isReAttempt, setIsReAttempt] = useState(false)
  const [originalAttempt, setOriginalAttempt] = useState<Attempt | null>(null)
  const [reAttemptFile, setReAttemptFile] = useState<File | null>(null)
  const previousAttempt =
    activeProfileAttempt?.parent_attempt_id
      ? originalAttempt
      : null

  const [userUploads, setUserUploads] = useState<
    { community: string; skill: string; url: string; created_at: string }[]
  >([])

  useEffect(() => {
    if (!username) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')

    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)

    return () => clearTimeout(timeout)
  }, [username])
  useEffect(() => {
    if (!editingPublicId || !publicId) {
      setPublicIdStatus('idle')
      return
    }

    setPublicIdStatus('checking')

    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('public_id', publicId)
        .neq('id', user.id)
        .maybeSingle()

      setPublicIdStatus(data ? 'taken' : 'available')
    }, 400)

    return () => clearTimeout(t)
  }, [publicId, editingPublicId])


  /* ---------- INIT ---------- */

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type')

    // 🔹 PRIORITY: password recovery must override everything
    if (type === 'recovery') {
      setAuthMode('reset_password')
    }

    if (type === 'recovery') {
      setAuthMode('reset_password')
      setIsRecoveryFlow(true)
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data?.user && !isRecoveryFlow) {
        setUser(data.user)
      }
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // 🔹 BLOCK normal login flow during recovery
        if (type === 'recovery') return
        if (isRecoveryFlow) return
        if (user?.id !== 'guest') {
          setUser(session?.user ?? null)
          setAuthLoading(false)
        }

        if (session?.user && session?.access_token) {
          if (authMode === 'verify_email') {
            setAuthMode('complete_profile')
          }
        }
      }
    )

    fetchSkills()
    fetchFeed()
    fetchSkillIssues()

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // ===== RESTORE PROFILE VIEW AFTER REFRESH =====
  useEffect(() => {
    if (!user || authLoading) return

    const view = localStorage.getItem('mustlife:view')
    const pid = localStorage.getItem('mustlife:profileUserId')

    if (view === 'profile' && pid) {
      openProfile(pid)
      fetchUserUploads(pid)
      fetchNotifications()
    }
  }, [user, authLoading])

  // 🔹 FETCH PROFILE DATA (avatar + bio)
  useEffect(() => {
    if (!profileUserId || isGuest || skills.length === 0) return


    supabase
      .from('profiles')
      .select('avatar_url, bio, display_name, public_id, impact, role, primary_community, primary_skill')
      .eq('id', profileUserId)
      .single<Profile>()
      .then(({ data }) => {
        if (!data) return

        const profile = data

        if (profile.avatar_url !== null) {
          setProfilePicUrl(profile.avatar_url)
        }

        if (profile.bio !== null) {
          setBio(profile.bio)
        }

        setDisplayName(profile.display_name ?? '')
        setPublicId(profile.public_id ?? '')
        setImpactScore(profile.impact ?? 0)
        setRole(profile.role ?? null)
        setPrimaryCommunity(profile.primary_community ?? null)
        setPrimarySkill(profile.primary_skill ?? null)
        if (skills.length > 0) {
          fetchSkillDashboard(profileUserId, skills)
        }
      })
  }, [profileUserId])
  useEffect(() => {
    if (!user || !profileUserId || isOwnProfile) return

    supabase
      .from('followers')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profileUserId)
      .maybeSingle()
      .then(({ data }) => {
        setIsFollowing(Boolean(data))
      })
  }, [user, profileUserId, isOwnProfile])
  useEffect(() => {
    if (!user || isGuest) return

    const fetchFollowers = async () => {
      const { data, error } = await supabase
        .from('followers')
        .select('follower_id')
        .eq('following_id', user.id)

      if (error) {
        console.error(error)
        return
      }

      setFollowers(data.map(f => f.follower_id))
      setFollowingCount(data.length)
    }

    fetchFollowers()
  }, [user])


  /* ---------- FETCH ---------- */
  async function fetchNotifications() {
    if (!user || isGuest) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    setNotifications(data ?? [])
  }
  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select(
        'avatar_url, bio, display_name, public_id, impact, role, primary_community, primary_skill'
      )
      .eq('id', userId)
      .single<Profile>()

    if (!data) return

    setProfilePicUrl(data.avatar_url)
    setBio(data.bio ?? '')
    setDisplayName(data.display_name ?? '')
    setPublicId(data.public_id ?? '')
    setImpactScore(data.impact ?? 0)
    setRole(data.role ?? null)
    setPrimaryCommunity(data.primary_community ?? null)
    setPrimarySkill(data.primary_skill ?? null)
    if (user && user.id !== 'guest') {
      const { data: viewer } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setViewerRole(viewer?.role ?? null)
    }
  }
  async function fetchSkills() {
    const { data } = await supabase.from('skills').select('*')
    setSkills(data ?? [])
  }
  async function fetchSkillIssues() {
    const { data, error } = await supabase
      .from('skill_issues')
      .select('skill_id, issue')

    if (error) {
      console.error('Skill issues fetch error:', error)
      return
    }

    const grouped: Record<string, string[]> = {}

      ; (data ?? []).forEach(row => {
        if (!grouped[row.skill_id]) grouped[row.skill_id] = []
        grouped[row.skill_id].push(row.issue)
      })

    setSkillIssues(grouped)
  }
  async function getFollowingUserIds() {
    if (!user) return []

    const { data, error } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', user.id)

    if (error) {
      console.error('Following fetch error:', error)
      return []
    }

    return data.map(f => f.following_id)
  }
  async function fetchFeed(skillId?: string) {
    let q = supabase
      .from('attempts')
      .select('id, user_id, processed_video_url, processing_status, skill_id, parent_attempt_id, created_at, caption')
      .eq('processing_status', 'done')          // ✅ ONLY finished
      .not('processed_video_url', 'is', null)   // ✅ must exist
      .order('created_at', { ascending: false })

    if (skillId) q = q.eq('skill_id', skillId)

    const { data, error } = await q

    if (error) {
      console.error('Feed error:', error)
      return
    }

    console.log(
      'FIRST ITEM FULL:',
      JSON.stringify(data?.[0], null, 2)
    )
    console.log('FEED DATA:', data)
    console.log('FIRST ITEM:', data?.[0])

    setFeed(data ?? [])
    const userIds = [...new Set((data ?? []).map(a => a.user_id))]

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, display_name')
        .in('id', userIds)

      const map: any = {}
      profiles?.forEach(p => {
        map[p.id] = {
          username: p.display_name || p.username,
          avatar_url: p.avatar_url
        }
      })

      setFeedProfiles(map)
    }
  }
  async function applyHomeFilter() {
    let q = supabase
      .from('attempts')
      .select('id, user_id, processed_video_url, skill_id, created_at, caption')
      .eq('processing_status', 'done')
      .not('processed_video_url', 'is', null)

    // ✅ SKILL FILTER (MULTI)
    let skillIdsToUse: string[] = []

    if (filterCommunities.length > 0) {
      skillIdsToUse = skills
        .filter(s => filterCommunities.includes(s.community))
        .map(s => s.id)
    }

    if (filterSkills.length > 0) {
      skillIdsToUse = skillIdsToUse.length > 0
        ? skillIdsToUse.filter(id => filterSkills.includes(id))
        : filterSkills
    }

    if (skillIdsToUse.length > 0) {
      q = q.in('skill_id', skillIdsToUse)
    }

    // 🔹 MINIMAL RELEVANCE LOGIC
    if (filterType === 'relevance') {
      q = q.order('created_at', { ascending: false }) // placeholder relevance
    }

    if (filterType === 'latest') {
      q = q.order('created_at', { ascending: false })
    }

    // following = no-op for now (safe)
    if (filterType === 'following') {
      const followingIds = await getFollowingUserIds()

      if (followingIds.length === 0) {
        setFeed([])
        setFilterApplied(true)
        return
      }

      q = q
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
    }
    q = q.order('created_at', { ascending: false })
    const { data } = await q
    let filtered = data ?? []




    setFeed(filtered)
    const userIds = [...new Set(filtered.map(a => a.user_id))]

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, display_name')
        .in('id', userIds)

      const map: any = {}
      profiles?.forEach(p => {
        map[p.id] = {
          username: p.username,
          avatar_url: p.avatar_url
        }
      })

      setFeedProfiles(map)
    }
    setFilterApplied(true)

    if (filterAppliedTimeoutRef.current) {
      clearTimeout(filterAppliedTimeoutRef.current)
    }

    filterAppliedTimeoutRef.current = setTimeout(() => {
      setFilterApplied(false)
    }, 1500)
  }
  async function searchByPublicId() {
    const pid = searchPublicId.trim().replace(/^@/, '')
    if (!pid) return

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('public_id', pid)
      .maybeSingle()

    if (error || !data) {
      alert('User not found')
      return
    }

    openProfile(data.id)
    fetchUserUploads(data.id)
    setSearchPublicId('')
  }
  async function fetchComments(attemptId: string) {
    const res = await supabase
      .from('comments')
      .select(`
    *,
    profiles (
      id,
      display_name,
      username,
      avatar_url
    ),
     comment_likes (
      user_id
    )
  `)
      .eq('attempt_id', attemptId)


    console.log('FETCH COMMENTS RAW RESULT:', res)

    if (res.error) {
      console.error('fetchComments error:', res.error)
      return
    }

    setComments(prev => ({
      ...prev,
      [attemptId]: res.data ?? [],
    }))
  }
  async function fetchAllProfileComments(profileUserId: string) {
    const { data: attempts } = await supabase
      .from('attempts')
      .select('id')
      .eq('user_id', profileUserId)

    if (!attempts || attempts.length === 0) return

    const attemptIds = attempts.map(a => a.id)

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .in('attempt_id', attemptIds)

    if (error) {
      console.error('Profile comments fetch error:', error)
      return
    }

    const grouped: Record<string, AppComment[]> = {}
    data.forEach(c => {
      grouped[c.attempt_id] ??= []
      grouped[c.attempt_id].push(c)
    })

    setComments(grouped)
  }
  function getTimestampOptions(attemptId: string) {
    const duration = videoMeta[attemptId]?.duration ?? 60
    return Array.from({ length: duration }, (_, i) => i + 1)
  }
  // ===== FETCH USER UPLOADS (ADDED) =====
  async function fetchUserUploads(forUserId?: string) {
    if (!user || isGuest) return

    const { data, error } = await supabase
      .from('attempts')
      .select(`
    processed_video_url,
    parent_attempt_id,
    created_at,
     caption,
    skills (
      name,
      community
    )
  `)
      .eq('user_id', forUserId ?? user.id)
      .eq('processing_status', 'done')
      .not('processed_video_url', 'is', null)
      .order('created_at', { ascending: false })
      .returns<UploadRow[]>()

    if (error) {
      console.error(error)
      return
    }

    setUserUploads(
      (data ?? []).map(row => ({
        community: row.skills?.community ?? 'Unknown',
        skill: row.skills?.name ?? 'Unknown',
        url: row.processed_video_url,
        created_at: row.created_at,
        isReAttempt: Boolean(row.parent_attempt_id),
      }))
    )
  }
  async function fetchSkillDashboard(
    profileUserId: string,
    skillsList: Skill[]
  ) {
    // 1️⃣ Decide active skill
    let activeSkillId = primarySkill
    let activeSkillName: string | null = null

    if (!activeSkillId) {
      const { data } = await supabase
        .from('attempts')
        .select('skill_id, skills(name, community)')
        .eq('user_id', profileUserId)
        .gte(
          'created_at',
          new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        )
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<{
          skill_id: string | null
          skills: {
            name: string
            community: string
          } | null
        }>()


      if (!data) {
        setSkillDashboard(null)
        return
      }
      if (!data.skills || !data.skills.name) {
        setSkillDashboard(null)
        return
      }
      const skillsRow: { name: string; community: string } = data.skills
      activeSkillName = data.skills.name
    }

    const skill = skills.find(s => s.name === activeSkillName)
    if (!skill) return

    // 2️⃣ Attempts last 14 days
    const { count: attempts14d } = await supabase
      .from('attempts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profileUserId)
      .eq('skill_id', skill.id)
      .gte(
        'created_at',
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      )

    // 3️⃣ Feedback acted upon
    const { count: feedbackActed } = await supabase
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .neq('corrected_at', null)
      .in(
        'attempt_id',
        (
          await supabase
            .from('attempts')
            .select('id')
            .eq('user_id', profileUserId)
            .eq('skill_id', skill.id)
        ).data?.map(a => a.id) ?? []
      )

    // 4️⃣ Last attempt time
    const { data: last } = await supabase
      .from('attempts')
      .select('created_at')
      .eq('user_id', profileUserId)
      .eq('skill_id', skill.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setSkillDashboard({
      community: skill.community,
      skill: skill.name,
      attempts14d: attempts14d ?? 0,
      feedbackActed: feedbackActed ?? 0,
      lastAttemptAt: last?.created_at ?? null,
    })
  }


  /* ---------- AUTH ---------- */


  async function loginWithPassword() {
    setAuthError(null)
    if (!loginEmail || !password) {
      setAuthError('Email/Username and password required')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) setAuthError(error.message)

  }
  async function signupWithPassword() {
    setAuthError(null)

    if (!signupEmail || !password) {
      setAuthError('Email and password required')
      return
    }

    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password,
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    // After signup, user must verify email
    setAuthMode('verify_email')
  }



  async function sendEmailVerification() {
    setAuthError(null)

    if (!signupEmail) {
      setAuthError('Email required')
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: signupEmail,
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      if (
        error.message.toLowerCase().includes('registered') ||
        error.message.toLowerCase().includes('exists')
      ) {
        setAuthError('Email already registered. Please log in.')
      } else {
        setAuthError(error.message)
      }
      return
    }

    // optional UX feedback
    alert('Verification link sent. Check your email.')
  }
  async function completeSignup() {
    setAuthError(null)

    if (!username || !password) {
      setAuthError('Username and password required')
      return
    }
    if (usernameStatus === 'taken') {
      setAuthError('Please choose a different username')
      return
    }

    setCheckingUsername(true)

    // 🔹 1️⃣ CHECK USERNAME UNIQUENESS
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) {
      setAuthError('Username already taken')
      setCheckingUsername(false)
      return
    }

    // 🔹 2️⃣ SET PASSWORD
    const { error: pwdErr } = await supabase.auth.updateUser({ password })
    if (pwdErr) {
      setAuthError(pwdErr.message)
      setCheckingUsername(false)
      return
    }

    // 🔹 3️⃣ CREATE PROFILE
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: user.id,
      username,
      communities: selectedCommunities,
    })

    if (profileErr) {
      setAuthError(profileErr.message)
      setCheckingUsername(false)
      return
    }

    setCheckingUsername(false)
    alert('Profile successfully created')
    setAuthMode('login')
  }


  function continueAsGuest() {
    setUser({ id: 'guest', email: 'guest@must.life' })
  }

  async function sendPasswordReset() {
    setAuthError(null)

    if (!signupEmail) {
      setAuthError('Email required')
      return
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      signupEmail,
      { redirectTo: window.location.origin }
    )

    if (error) {
      setAuthError(error.message)
      return
    }

    alert('Password reset link sent. Check your email.')
  }

  async function logout() {
    if (!isGuest) await supabase.auth.signOut()
    setUser(null)
  }
  /* ===== DELETE PROFILE PICTURE (NEW) ===== */
  async function deleteProfilePicture() {
    if (!user) return

    const path = `profile_avatars/${user.id}.jpg`

    // 1️⃣ Delete from storage
    await supabase.storage
      .from('profile_avatars')
      .remove([path])

    // 2️⃣ Remove from DB
    await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    // 3️⃣ Update UI
    setProfilePicUrl(null)
    setShowPicModal(false)
  }
  async function toggleFollow() {
    if (!user || !profileUserId) return

    if (isFollowing) {
      // UNFOLLOW
      await supabase
        .from('followers')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileUserId)

      setIsFollowing(false)
    } else {
      // FOLLOW
      await supabase
        .from('followers')
        .insert({
          follower_id: user.id,
          following_id: profileUserId,
        })

      setIsFollowing(true)
    }
  }

  // ===== AUTH GUARD (ADDED) =====
  function requireAuth(): boolean {
    if (isGuest) {
      alert('Please create an account or login to use this feature.')
      return false
    }
    return true
  }
  // ===== HANDLE VIDEO UPLOAD (ADDED) =====
  async function handleVideoUpload() {
    if (!requireAuth()) return

    if (!selectedFile || !selectedCommunity || !selectedSkill || !uploadType || !user) {
      alert('Select community, skill, upload type, and video')
      return
    }

    const filePath = `${user.id}/${Date.now()}-${selectedFile.name}`

    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)

    try {
      // 1️⃣ Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('raw_videos')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadErr) throw uploadErr

      // Supabase has no real progress → mark as done
      setUploadProgress(100)

      // 2️⃣ Get public URL
      const { data: pub } = supabase.storage
        .from('raw_videos')
        .getPublicUrl(filePath)

      // 3️⃣ Create attempt (worker will pick this)
      // 🔹 Resolve skill UUID from name
      const skill = skills.find(s => s.id === selectedSkill)

      if (!skill) {
        alert('Invalid skill selected')
        return
      }

      // 🔹 Create attempt (worker will pick this)
      const payload =
        uploadType === 'raw'
          ? {
            user_id: user.id,
            skill_id: skill.id,
            processed_video_url: pub.publicUrl,
            processing_status: 'done',
            caption: includeCaption ? attemptCaption : null
          }
          : {
            user_id: user.id,
            skill_id: skill.id,
            raw_video_url: pub.publicUrl,
            processing_status: 'pending',
            caption: includeCaption ? attemptCaption : null
          }

      const { error: attemptErr } = await supabase
        .from('attempts')
        .insert(payload)

      if (attemptErr) throw attemptErr



      setSelectedFile(null)
      setShowProfile(true)
      setActiveProfileAttempt(null)
      fetchUserUploads()
      fetchFeed()

    } catch (err: any) {
      console.error(err)
      setUploadError(err.message || 'Upload failed')
      alert(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }



  /* ===== DELETE COMMENT (ADD HERE) ===== */
  async function deleteComment(commentId: string) {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      alert('Failed to delete comment')
      return
    }

    setComments(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(attemptId => {
        next[attemptId] = next[attemptId].filter(c => c.id !== commentId)
      })
      return next
    })
  }
  async function deleteAttempt(attemptId: string) {
    if (!user) return

    const ok = confirm('Delete this video?')
    if (!ok) return

    const { error } = await supabase
      .from('attempts')
      .delete()
      .eq('id', attemptId)
      .eq('user_id', user.id) // 🔐 ownership enforced

    if (error) {
      alert(error.message)
      return
    }

    // UI cleanup
    setFeed(prev => prev.filter(a => a.id !== attemptId))
    setUserUploads(prev =>
      prev.filter(v => v.url !== activeProfileAttempt?.processed_video_url)
    )
    setActiveProfileAttempt(null)
  }
  // ===== RE-ATTEMPT UPLOAD HANDLER =====
  async function handleReAttemptUpload() {
    setIsReAttempt(true)
    console.log('Re-attempt clicked')

    if (!user) {
      alert('Not logged in')
      return
    }

    if (!originalAttempt) {
      alert('Original attempt missing')
      return
    }

    if (!reAttemptFile) {
      alert('No re-attempt file selected')
      return
    }

    try {
      setUploading(true)
      setUploadProgress(0)
      const filePath = `${user.id}/reattempt-${Date.now()}-${reAttemptFile.name}`

      // 1️⃣ Upload new video
      const { error: uploadErr } = await supabase.storage
        .from('raw_videos')
        .upload(filePath, reAttemptFile)

      setUploadProgress(100)

      if (uploadErr) throw uploadErr

      // 2️⃣ Get public URL
      const { data: pub } = supabase.storage
        .from('raw_videos')
        .getPublicUrl(filePath)

      // 3️⃣ Create NEW attempt (linked by same skill + community)
      const { error: insertErr } = await supabase
        .from('attempts')
        .insert({
          user_id: user.id,
          skill_id: originalAttempt.skill_id,
          raw_video_url: pub.publicUrl,
          processing_status: 'pending',
          parent_attempt_id: originalAttempt.id // 🔗 IMPORTANT FOR FUTURE COMPARISON
        })
      const commenters =
        comments[originalAttempt.id]
          ?.map(c => c.user_id)
          .filter(uid => uid !== user.id) ?? []

      if (commenters.length > 0) {
        await supabase.from('notifications').insert(
          commenters.map(uid => ({
            user_id: uid,
            actor_id: user.id,
            type: 'reattempt',
            attempt_id: originalAttempt.id,
            message: 'User uploaded a re-attempt on a video you commented on',
          }))
        )
      }

      if (insertErr) throw insertErr



      // 4️⃣ Reset UI
      setIsReAttempt(false)
      setReAttemptFile(null)
      setOriginalAttempt(null)
      setActiveProfileAttempt(null)


      // 5️⃣ Refresh
      fetchFeed()
      fetchUserUploads()
      setUploading(false)

      alert('Re-attempt uploaded successfully')

    } catch (err: any) {
      setUploading(false)
      setUploadProgress(0)
      console.error(err)
      alert(err.message || 'Re-attempt upload failed')
    }
  }

  async function handleCorrectionUpload() {
    if (!user || !activeProfileAttempt || !correctionState?.file) return

    try {
      setUploading(true)
      setUploadProgress(0)

      const file = correctionState.file
      const filePath = `${user.id}/correction-${Date.now()}-${file.name}`

      // 1️⃣ Upload
      const { error: uploadErr } = await supabase.storage
        .from('raw_videos')
        .upload(filePath, file)

      if (uploadErr) throw uploadErr

      setUploadProgress(100)

      // 2️⃣ Public URL
      const { data: pub } = supabase.storage
        .from('raw_videos')
        .getPublicUrl(filePath)

      // 3️⃣ Create attempt (linked to original)
      const { error: insertErr } = await supabase
        .from('attempts')
        .insert({
          user_id: user.id,
          skill_id: activeProfileAttempt.skill_id,
          raw_video_url: pub.publicUrl,
          processing_status: 'pending',
          parent_attempt_id: activeProfileAttempt.id
        })

      if (insertErr) throw insertErr

      // 4️⃣ Mark comment corrected
      await supabase
        .from('comments')
        .update({ corrected_at: new Date().toISOString() })
        .eq('id', correctionState.commentId)
      const correctedComment =
        comments[activeProfileAttempt.id]?.find(
          c => c.id === correctionState.commentId
        )

      if (correctedComment) {
        await supabase.from('notifications').insert({
          user_id: correctedComment.user_id,
          actor_id: user.id,
          type: 'correction_uploaded',
          attempt_id: activeProfileAttempt.id,
          comment_id: correctedComment.id,
          message: 'User uploaded a correction based on your feedback',
        })
      }
      // 🔹 ADD: +5 impact to comment author
      const comment = comments[activeProfileAttempt.id]?.find(
        c => c.id === correctionState.commentId
      )

      if (comment) {
        await supabase
          .from('profiles')
          .update({ impact: impactScore + 5 })
          .eq('id', comment.user_id)
      }

      // 5️⃣ Cleanup
      setCorrectionState(null)
      setUploading(false)

      fetchFeed()
      fetchUserUploads()

      alert('Correction uploaded')

    } catch (err: any) {
      setUploading(false)
      setUploadProgress(0)
      alert(err.message || 'Correction upload failed')
    }
  }


  /* ================= LOGIN PAGE ================= */
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }


  /* ================= COMPLETE PROFILE ================= */

  if (authMode === 'complete_profile') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FBF6EC] text-black">
        <div className="w-[380px] bg-white border p-6 rounded-2xl space-y-4">

          <h2 className="text-xl font-semibold text-center">
            Complete your profile
          </h2>

          {/* USERNAME */}
          <input
            className="w-full border p-2 rounded"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value.trim())}
          />

          {/* LIVE STATUS */}
          {usernameStatus === 'checking' && (
            <p className="text-xs text-gray-500">Checking…</p>
          )}
          {usernameStatus === 'available' && (
            <p className="text-xs text-green-600">Username available</p>
          )}
          {usernameStatus === 'taken' && (
            <p className="text-xs text-red-600">Username already taken</p>
          )}

          {/* PASSWORD */}
          <input
            className="w-full border p-2 rounded"
            type="password"
            placeholder="Set password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {/* COMMUNITIES */}
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedCommunities.includes('Fitness')}
                onChange={() =>
                  setSelectedCommunities(prev =>
                    prev.includes('Fitness')
                      ? prev.filter(c => c !== 'Fitness')
                      : [...prev, 'Fitness']
                  )
                }
              />
              Fitness
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedCommunities.includes('Yoga')}
                onChange={() =>
                  setSelectedCommunities(prev =>
                    prev.includes('Yoga')
                      ? prev.filter(c => c !== 'Yoga')
                      : [...prev, 'Yoga']
                  )
                }
              />
              Yoga
            </label>
          </div>

          {authError && (
            <p className="text-sm text-red-600">{authError}</p>
          )}

          {/* CREATE PROFILE BUTTON */}
          <button
            className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
            disabled={usernameStatus !== 'available'}
            onClick={completeSignup}
          >
            Create profile
          </button>

          <p className="text-xs text-center text-gray-500">
            Profile will be created after email verification
          </p>
        </div>
      </main>
    )
  }

  // ================= RESET PASSWORD =================
  if (authMode === 'reset_password') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FBF6EC]">
        <div className="w-[380px] bg-white border p-6 rounded-xl space-y-4">

          <h2 className="text-xl font-semibold text-center">
            Set new password
          </h2>

          <input
            className="w-full border p-2 rounded"
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />

          {authError && (
            <p className="text-red-600 text-sm">{authError}</p>
          )}

          <button
            className="w-full bg-black text-white py-2 rounded"
            onClick={async () => {
              const { error } = await supabase.auth.updateUser({ password })
              if (error) {
                setAuthError(error.message)
                return
              }

              alert('Password updated successfully')
              setIsRecoveryFlow(false)
              setAuthMode('login')
            }}
          >
            Update password
          </button>

        </div>
      </main>
    )
  }


  /* ================= HOME ================= */

  return (
    <main className="min-h-screen bg-[#FBF6EC] text-black [&_button]:cursor-pointer">
      {activeProfileAttempt && !showProfile && (
        <div className="max-w-6xl mx-auto p-6 space-y-4">

          <div
            className={
              previousAttempt
                ? 'flex flex-col gap-4'
                : 'grid grid-cols-[2fr_1fr] gap-4'
            }
          >

            {/* ================= LEFT COLUMN — VIDEOS ================= */}
            <div className="space-y-3">

              {/* COMMUNITY + SKILL (ALWAYS ON TOP) */}
              <div className="text-xs text-gray-600">
                {skills.find(s => s.id === activeProfileAttempt.skill_id)?.community}
                {' • '}
                {skills.find(s => s.id === activeProfileAttempt.skill_id)?.name}
              </div>

              {/* PREVIOUS ATTEMPT (OPTIONAL) */}
              {previousAttempt ? (
                <div className="grid grid-cols-2 gap-2">

                  {/* BEFORE */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Before</div>
                    <video
                      src={previousAttempt.processed_video_url!}
                      controls
                      className="w-full max-h-[70vh] rounded bg-black object-contain"
                    />
                  </div>

                  {/* AFTER */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">After</div>
                    <video
                      id="active-video"
                      src={activeProfileAttempt.processed_video_url!}
                      controls
                      className="w-full max-h-[70vh] rounded bg-black object-contain"
                      onLoadedMetadata={e => {
                        const video = e.currentTarget
                        setVideoMeta(prev => ({
                          ...prev,
                          [activeProfileAttempt.id]: {
                            portrait: video.videoHeight > video.videoWidth,
                            duration: video.duration,
                          },
                        }))
                      }}
                    />



                  </div>

                </div>
              ) : (
                /* SINGLE VIDEO VIEW */
                <video
                  id="active-video"
                  src={activeProfileAttempt.processed_video_url!}
                  controls
                  className="w-full max-h-[70vh] rounded bg-black object-contain"
                  onLoadedMetadata={e => {
                    const video = e.currentTarget
                    setVideoMeta(prev => ({
                      ...prev,
                      [activeProfileAttempt.id]: {
                        portrait: video.videoHeight > video.videoWidth,
                        duration: video.duration,
                      },
                    }))
                  }}
                />
              )}

              {/* ACTIVE ATTEMPT */}

              {activeProfileAttempt.user_id === user.id && (
                <button
                  className="mt-2 text-xs text-red-600 underline cursor-pointer hover:text-red-700 transition"
                  onClick={() => deleteAttempt(activeProfileAttempt.id)}
                >
                  Delete this video
                </button>
              )}
            </div>

            {/* ================= RIGHT COLUMN — COMMENTS ================= */}

            {activeProfileAttempt.caption && (
              <div className="bg-white border rounded p-3 text-sm text-gray-700">
                {activeProfileAttempt.caption}
              </div>
            )}
            <div className="border rounded p-3 bg-gray-50 space-y-2">

              <div className="flex gap-3">

                {/* AVATAR */}
                <div className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden">
                  {profilePicUrl && (
                    <img
                      src={profilePicUrl}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 space-y-2">

                  {/* TIMESTAMP (WITH OVERALL) */}
                  <select
                    className="border p-1 text-xs w-32"
                    value={draftComments[activeProfileAttempt.id]?.second ?? -1}
                    onChange={e =>
                      setDraftComments(prev => ({
                        ...prev,
                        [activeProfileAttempt.id]: {
                          ...prev[activeProfileAttempt.id],
                          second: Number(e.target.value),
                        },
                      }))
                    }
                  >
                    <option value={-1}>Overall</option>
                    {getTimestampOptions(activeProfileAttempt.id).map(t => (
                      <option key={t} value={t}>
                        {t}s
                      </option>
                    ))}
                  </select>

                  {/* ISSUE */}
                  <select
                    className="border p-1 text-sm w-full"
                    value={draftComments[activeProfileAttempt.id]?.issue ?? ''}
                    onChange={e =>
                      setDraftComments(prev => ({
                        ...prev,
                        [activeProfileAttempt.id]: {
                          ...prev[activeProfileAttempt.id],
                          issue: e.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">Select issue</option>
                    {(skillIssues[activeProfileAttempt.skill_id ?? ''] ?? []).map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>

                  {/* SUGGESTION */}
                  <textarea
                    className="border p-2 text-sm w-full"
                    placeholder="Suggestion"
                    value={draftComments[activeProfileAttempt.id]?.suggestion ?? ''}
                    onChange={e =>
                      setDraftComments(prev => ({
                        ...prev,
                        [activeProfileAttempt.id]: {
                          ...prev[activeProfileAttempt.id],
                          suggestion: e.target.value,
                        },
                      }))
                    }
                  />

                  {/* POST */}
                  <button
                    className="text-xs underline cursor-pointer hover:text-black transition"
                    onClick={async () => {
                      if (!requireAuth()) return

                      const d = draftComments[activeProfileAttempt.id]
                      if (!d.issue || !d.suggestion) return

                      const { data: newComment, error } = await supabase
                        .from('comments')
                        .insert({
                          user_id: user.id,
                          attempt_id: activeProfileAttempt.id,
                          second: d.second === -1 ? 0 : d.second,
                          issue: d.issue,
                          suggestion: d.suggestion,
                        })
                        .select(`
                           *,
                         comment_likes(user_id)
                         `)
                        .single()

                      if (error) {
                        console.error('Comment insert error:', error)
                        alert(error.message)
                        return
                      }

                      // ✅ IMMEDIATE UI UPDATE (UNCHANGED BEHAVIOR)
                      if (newComment) {
                        setComments(prev => ({
                          ...prev,
                          [activeProfileAttempt.id]: [
                            ...(prev[activeProfileAttempt.id] ?? []),
                            newComment,
                          ],
                        }))
                      }
                      // 🔔 NOTIFY VIDEO OWNER (ONLY IF DIFFERENT USER)
                      if (activeProfileAttempt.user_id !== user.id) {
                        await supabase.from('notifications').insert({
                          user_id: activeProfileAttempt.user_id,
                          actor_id: user.id,
                          type: 'new_comment',
                          attempt_id: activeProfileAttempt.id,
                          comment_id: newComment.id,
                          message: `${feedProfiles[user.id]?.username ?? 'Someone'} commented on your video`,
                        })
                      }


                    }}
                  >
                    Post
                  </button>

                </div>
              </div>
            </div>

          </div>



          {/* RE-ATTEMPT BUTTON */}
          {!isReAttempt && (
            <button
              className="border px-4 py-2 rounded text-sm"
              onClick={() => {
                setOriginalAttempt(
                  activeProfileAttempt?.parent_attempt_id
                    ? feed.find(a => a.id === activeProfileAttempt.parent_attempt_id) || activeProfileAttempt
                    : activeProfileAttempt
                )

                setIsReAttempt(true)
                setReAttemptFile(null)
              }}
            >
              Re-attempt
            </button>
          )}

          {/* RE-ATTEMPT UPLOAD */}
          {isReAttempt && (
            <div className="space-y-3">

              <label className="block text-sm underline cursor-pointer">
                Select re-attempt video
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e =>
                    setReAttemptFile(e.target.files?.[0] || null)
                  }
                />
              </label>

              <button
                className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                disabled={!reAttemptFile}
                onClick={handleReAttemptUpload}
              >
                Upload Re-attempt
              </button>
              {uploading && (
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
                  <div
                    className="h-full bg-black transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}


            </div>
          )}

          {/* ===== COMMENTS ===== */}
          <div className="mt-6 space-y-3">
            <div className="font-semibold text-sm">Comments</div>

            {(comments[activeProfileAttempt.id] ?? []).length === 0 && (
              <div className="text-xs text-gray-500">
                No comments yet
              </div>
            )}

            {(comments[activeProfileAttempt.id] ?? []).map(c => (
              <div
                key={c.id}
                className="border rounded p-2 text-sm bg-white"
              >
                {/* ================= ROW 1 ================= */}
                <div className="flex items-start gap-3 flex-wrap">

                  {/* AVATAR */}
                  <div
                    className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden flex-shrink-0
        cursor-pointer hover:opacity-80 transition"
                    onClick={() => openProfile(c.profiles?.id!)}
                  >
                    {c.profiles?.avatar_url && (
                      <img
                        src={c.profiles.avatar_url}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* ROW 1 CONTENT */}
                  <div className="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1">

                    {/* NAME */}
                    <span
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() => openProfile(c.profiles?.id!)}
                    >
                      {c.profiles?.display_name || c.profiles?.username || 'User'}
                    </span>

                    {/* TIMESTAMP */}
                    <button
                      className="text-xs text-gray-500 underline"
                      onClick={() => seekActiveVideo(c.second)}
                    >
                      {c.second === 0 ? 'Overall' : `${c.second}s`}
                    </button>

                    {/* ISSUE */}
                    <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">
                      {c.issue}
                    </span>

                    {/* SUGGESTION */}
                    {/* SUGGESTION */}
                    {editingCommentId === c.id ? (
                      <input
                        className="border px-2 py-1 text-sm w-full max-w-md"
                        value={editDraft.suggestion}
                        onChange={e =>
                          setEditDraft(prev => ({
                            ...prev,
                            suggestion: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <span className="text-gray-700">
                        {c.suggestion}
                      </span>
                    )}

                    {/* ACTIONS */}
                    <div className="flex gap-3 text-xs items-center">

                      {/* 👍 LIKE */}
                      <button
                        className="underline"
                        onClick={async () => {
                          if (!requireAuth()) return

                          await supabase
                            .from('comment_likes')
                            .insert({
                              user_id: user.id,
                              comment_id: c.id,
                            })

                          await supabase.from('notifications').insert([
                            {
                              user_id: c.user_id,
                              actor_id: user.id,
                              type: 'comment_like',
                              attempt_id: c.attempt_id,
                              comment_id: c.id,
                              message: 'Someone liked your suggestion',
                            },
                            {
                              user_id: activeProfileAttempt.user_id,
                              actor_id: user.id,
                              type: 'comment_like',
                              attempt_id: c.attempt_id,
                              comment_id: c.id,
                              message: 'Someone liked a suggestion on your video',
                            },
                          ])

                          fetchComments(activeProfileAttempt.id)
                        }}
                      >
                        👍 {c.comment_likes?.length ?? 0}
                      </button>

                      {(c.comment_likes?.length ?? 0) > 0 && (
                        <button
                          className="underline text-gray-600"
                          onClick={() =>
                            setShowLikesForComment(
                              showLikesForComment === c.id ? null : c.id
                            )
                          }
                        >
                          See likes
                        </button>
                      )}

                      {/* EDIT */}
                      {c.user_id === user.id && editingCommentId !== c.id && (
                        <button
                          className="underline"
                          onClick={() => {
                            if (!requireAuth()) return
                            setEditingCommentId(c.id)
                            setEditDraft({
                              second: c.second,
                              issue: c.issue,
                              suggestion: c.suggestion,
                            })
                          }}
                        >
                          Edit
                        </button>
                      )}

                      {/* SAVE */}
                      {c.user_id === user.id && editingCommentId === c.id && (
                        <button
                          className="underline"
                          onClick={async () => {
                            if (!requireAuth()) return
                            await supabase
                              .from('comments')
                              .update({ suggestion: editDraft.suggestion })
                              .eq('id', c.id)

                            setEditingCommentId(null)
                            fetchComments(activeProfileAttempt.id)
                          }}
                        >
                          Save
                        </button>
                      )}

                      {/* DELETE */}
                      {(c.user_id === user.id ||
                        activeProfileAttempt.user_id === user.id) && (
                          <button
                            className="underline text-red-600"
                            onClick={() => deleteComment(c.id)}
                          >
                            Delete
                          </button>
                        )}
                    </div>
                  </div>
                </div>
                {showLikesForComment === c.id && (
                  <div className="ml-11 mt-2 space-y-2 text-xs">
                    {c.comment_likes?.map(like => {
                      const p = feedProfiles[like.user_id]
                      if (!p) return null

                      return (
                        <div
                          key={like.user_id}
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                          onClick={() => openProfile(like.user_id)}
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-300 overflow-hidden">
                            {p.avatar_url && (
                              <img
                                src={p.avatar_url}
                                className="w-full h-full object-cover"
                              />
                            )}
                          </div>
                          <span className="underline">
                            {p.username}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ================= ROW 2 ================= */}
                <div className="ml-11 mt-2 flex gap-6 text-xs">

                  {activeProfileAttempt.user_id === user.id && !c.corrected_at && (
                    <button
                      className="underline"
                      onClick={() =>
                        setCorrectionState({ commentId: c.id, file: null })
                      }
                    >
                      Attempt correction
                    </button>
                  )}

                  {activeProfileAttempt.user_id === user.id &&
                    c.user_id !== user.id &&
                    !c.clarification && (
                      <button
                        className="underline"
                        onClick={() => {
                          if (!requireAuth()) return
                          setClarifyingCommentId(c.id)
                          setClarificationDraft('')
                        }}
                      >
                        Ask clarification
                      </button>
                    )}
                  {clarifyingCommentId === c.id && (
                    <div className="ml-11 mt-2 space-y-1 text-xs">
                      <input
                        className="border p-1 w-full"
                        placeholder="Ask clarification (max 200 chars)"
                        maxLength={200}
                        value={clarificationDraft}
                        onChange={e => setClarificationDraft(e.target.value)}
                      />
                      <button
                        className="underline"
                        onClick={async () => {
                          if (!clarificationDraft.trim()) return

                          await supabase
                            .from('comments')
                            .update({ clarification: clarificationDraft })
                            .eq('id', c.id)

                          // 🔔 NOTIFY COMMENT AUTHOR
                          await supabase.from('notifications').insert({
                            user_id: c.user_id,
                            actor_id: user.id,
                            type: 'clarification_request',
                            attempt_id: c.attempt_id,
                            comment_id: c.id,
                            message: 'User asked for clarification on your suggestion',
                          })

                          setClarifyingCommentId(null)
                          setClarificationDraft('')
                          fetchComments(activeProfileAttempt.id)
                        }}
                      >
                        Submit
                      </button>
                    </div>
                  )}
                </div>

                {/* ================= ROW 3 ================= */}
                {/* ================= ROW 3 ================= */}
                {c.clarification && (
                  <div className="ml-11 mt-2 space-y-2 text-xs text-gray-700">

                    {/* USER CLARIFICATION */}
                    <div className="italic">
                      Clarification: {c.clarification}
                    </div>

                    {/* COACH REPLY BUTTON */}
                    {viewerRole === 'coach' &&
                      c.user_id === user.id && // coach is comment author
                      !c.clarified_at && (
                        <button
                          className="underline"
                          onClick={() => {
                            if (!requireAuth()) return
                            setReplyingCommentId(c.id)
                            setReplyDraft('')
                          }}
                        >
                          Reply
                        </button>
                      )}

                    {/* COACH REPLY INPUT */}
                    {replyingCommentId === c.id && !c.clarified_at && (
                      <div className="space-y-1">
                        <input
                          className="border p-1 w-full"
                          placeholder="Reply to clarification (max 200 chars)"
                          maxLength={200}
                          value={replyDraft}
                          onChange={e => setReplyDraft(e.target.value)}
                        />

                        <button
                          className="underline"
                          onClick={async () => {
                            if (!replyDraft.trim()) return

                            await supabase
                              .from('comments')
                              .update({
                                suggestion: replyDraft,          // overwrite suggestion
                                clarified_by: user.id,
                                clarified_at: new Date().toISOString(),
                              })
                              .eq('id', c.id)
                            await supabase.from('notifications').insert({
                              user_id: activeProfileAttempt.user_id,
                              actor_id: user.id,
                              type: 'clarification_reply',
                              attempt_id: c.attempt_id,
                              comment_id: c.id,
                              message: 'Coach replied to your clarification request',
                            })

                            setReplyingCommentId(null)
                            setReplyDraft('')
                            fetchComments(activeProfileAttempt.id)
                          }}
                        >
                          Submit reply
                        </button>


                      </div>
                    )}

                    {/* FINAL COACH REPLY (READ-ONLY) */}
                    {c.clarified_at && (
                      <div className="text-gray-800">
                        Coach reply: {c.suggestion}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      )}
      <header className="sticky top-0 z-20 bg-[#FBF6EC]/90 backdrop-blur border-b border-gray-200 px-6 py-4 flex justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg">MUST_Life</span>
          <div
            className="relative group cursor-pointer text-sm hover:text-black transition"

            onClick={() => {
              localStorage.removeItem('mustlife:view')
              localStorage.removeItem('mustlife:profileUserId')

              setShowProfile(false)
              setViewedUserId(null)

              // ✅ CLOSE VIDEO + RESET RE-ATTEMPT
              setActiveProfileAttempt(null)
              setOriginalAttempt(null)
              setIsReAttempt(false)
              setReAttemptFile(null)

              fetchFeed()
            }}
          >
            🏠
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs border px-2 py-0.5 bg-white hidden group-hover:block">
              Home
            </span>
          </div>
        </div>
        {/* 🧠 ISSUES BUTTON (NEW) */}
        <button
          className="text-sm underline cursor-pointer hover:text-black transition"
          onClick={() => {
            window.location.href = '/issues'
          }}
        >
          Issues
        </button>

        {/* ===== PROFILE BUTTON (ADDED) ===== */}
        <button
          onClick={() => {
            // ✅ CLOSE VIDEO + RESET RE-ATTEMPT
            setActiveProfileAttempt(null)

            setOriginalAttempt(null)
            setIsReAttempt(false)
            setReAttemptFile(null)
            if (!user) {
              alert('Please login to view profile')
              return
            }
            openProfile(user.id)
            fetchUserUploads(user.id)
          }}
          className="text-sm underline mr-4 cursor-pointer hover:text-black transition"
        >
          Profile
        </button>
        {/* 🔔 NOTIFICATIONS */}
        <div className="relative">
          <button
            className="text-sm underline cursor-pointer hover:text-black transition"
            onClick={() => {
              setShowNotifications(v => !v)
              fetchNotifications()
            }}
          >
            🔔
            {notifications.some(n => !n.read_at) && (
              <span className="ml-1 text-xs text-red-600">●</span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border rounded-xl shadow-lg z-50 max-h-[400px] overflow-y-auto">
              {notifications.length === 0 && (
                <div className="p-4 text-sm text-gray-500">
                  No notifications
                </div>
              )}

              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-3 text-sm border-b cursor-pointer hover:bg-gray-50
            ${!n.read_at ? 'bg-gray-50' : ''}
          `}
                  onClick={async () => {
                    await supabase
                      .from('notifications')
                      .update({ read_at: new Date().toISOString() })
                      .eq('id', n.id)

                    // ✅ UPDATE LOCAL STATE (CRITICAL)
                    setNotifications(prev =>
                      prev.map(x =>
                        x.id === n.id
                          ? { ...x, read_at: new Date().toISOString() }
                          : x
                      )
                    )

                    setShowNotifications(false)

                    if (n.attempt_id) {
                      const { data: attempt } = await supabase
                        .from('attempts')
                        .select('*')
                        .eq('id', n.attempt_id)
                        .single()

                      if (attempt) {
                        setActiveProfileAttempt(attempt)
                        setShowProfile(false)
                      }
                    }
                  }}
                >
                  {n.message}
                  <div className="text-xs text-gray-400 mt-1">
                    {formatIST(n.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={logout}
          className="text-sm underline cursor-pointer hover:text-black transition"
        >
          Logout
        </button>
      </header>
      {/* ================= PROFILE PANEL (ADDED) ================= */}
      {showProfile && !activeProfileAttempt && (
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">

            {/* Profile picture */}
            {/* Profile picture */}
            <div className="flex items-center gap-4">
              <div
                className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-200 cursor-pointer flex items-center justify-center"
                onClick={() => {
                  if (isGuest) return
                  if (user?.id === profileUserId && profilePicUrl) {
                    setShowPicModal(true)
                  }
                }}
              >
                {profilePicUrl ? (
                  <img
                    src={profilePicUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <label className="text-xs text-gray-600 text-center cursor-pointer">
                    👤
                    <div className="text-[10px]">Choose<br />photo</div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file || !user) return

                        const path = `profile_avatars/${user.id}.jpg`

                        await supabase.storage
                          .from('profile_avatars')
                          .upload(path, file, { upsert: true })

                        const { data } = supabase.storage
                          .from('profile_avatars')
                          .getPublicUrl(path)
                        const bustedUrl = `${data.publicUrl}?t=${Date.now()}`

                        await supabase
                          .from('profiles')
                          .upsert(
                            { id: user.id, avatar_url: bustedUrl },
                            { onConflict: 'id' }
                          )

                        setProfilePicUrl(bustedUrl)
                        setShowPicModal(false)
                      }}
                    />
                  </label>
                )}
              </div>

              <div>
                {editingName && isOwnProfile ? (
                  <input
                    className="border p-1 text-sm rounded"
                    value={displayName}
                    autoFocus
                    onChange={e => setDisplayName(e.target.value)}
                    onBlur={async () => {
                      setEditingName(false)
                      await supabase
                        .from('profiles')
                        .update({ display_name: displayName })
                        .eq('id', user.id)
                    }}
                    placeholder="Your name"
                  />
                ) : (
                  <div
                    className={`text-sm font-medium ${isOwnProfile ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (isOwnProfile) setEditingName(true)
                    }}
                  >
                    {displayName || 'Unnamed'}
                  </div>
                )}
              </div>
            </div>

            {/* PUBLIC ID */}
            <div className="text-sm">
              {editingPublicId && isOwnProfile ? (
                <>
                  <input
                    className="border p-1 text-sm rounded w-48"
                    value={publicId}
                    autoFocus
                    onChange={e =>
                      setPublicId(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9._]/g, '')
                      )
                    }
                    onBlur={async () => {
                      if (publicIdStatus !== 'available') {
                        setEditingPublicId(false)
                        return
                      }

                      await supabase
                        .from('profiles')
                        .update({ public_id: publicId })
                        .eq('id', user.id)

                      setEditingPublicId(false)
                    }}
                    placeholder="your-id"
                  />

                  <div className="text-xs mt-1">
                    {publicIdStatus === 'checking' && 'Checking…'}
                    {publicIdStatus === 'available' && (
                      <span className="text-green-600">Available</span>
                    )}
                    {publicIdStatus === 'taken' && (
                      <span className="text-red-600">Already taken</span>
                    )}
                  </div>
                </>
              ) : (
                <div
                  className={`text-xs text-gray-600 ${isOwnProfile ? 'cursor-pointer underline' : ''
                    }`}
                  onClick={() => {
                    if (isOwnProfile) setEditingPublicId(true)
                  }}
                >
                  @{publicId || 'set-your-id'}
                </div>
              )}
            </div>




            {/* ===== PROFILE HEADER — WHO IS THIS ATHLETE NOW ===== */}
            <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
              {/* ABOUT (BIO) */}
              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">About</div>
                {editingBio && isOwnProfile ? (
                  <textarea
                    className="w-full border rounded p-2"
                    rows={4}
                    maxLength={200}
                    autoFocus
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    onBlur={async () => {
                      setEditingBio(false)

                      if (bio.trim() === '') return

                      await supabase
                        .from('profiles')
                        .update({ bio })
                        .eq('id', user.id)
                    }}
                  />
                ) : (
                  <div
                    className={`border rounded p-2 bg-white whitespace-pre-wrap
                    ${isOwnProfile ? 'cursor-pointer hover:bg-gray-50 transition' : ''}
                     `}
                    onClick={() => {
                      if (isGuest) return
                      isOwnProfile && setEditingBio(true)
                    }}
                  >
                    {bio || 'Write about yourself (max 200 words)'}
                  </div>
                )}
              </div>

              {/* ROLE */}
              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Role</div>
                {isOwnProfile ? (
                  <select
                    className="border p-2 w-full"
                    value={role ?? ''}
                    onChange={async e => {
                      const v = e.target.value || null
                      setRole(v)
                      await supabase.from('profiles')
                        .update({ role: v })
                        .eq('id', user.id)
                    }}
                  >
                    <option value="">Select role</option>
                    <option value="learner">Learner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="coach">Coach</option>
                  </select>
                ) : (
                  <div>{role ?? '—'}</div>
                )}
              </div>

              {/* PRIMARY COMMUNITY */}
              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Primary community</div>
                {isOwnProfile ? (
                  <select
                    className="border p-2 w-full"
                    value={primaryCommunity ?? ''}
                    onChange={async e => {
                      const v = e.target.value || null
                      setPrimaryCommunity(v)
                      setPrimarySkill(null)
                      await supabase.from('profiles')
                        .update({ primary_community: v, primary_skill: null })
                        .eq('id', user.id)
                    }}
                  >
                    <option value="">Select community</option>
                    {[...new Set(skills.map(s => s.community))].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <div>{primaryCommunity ?? '—'}</div>
                )}
              </div>

              {/* PRIMARY SKILL */}
              {primaryCommunity && (
                <div className="text-sm">
                  <div className="text-xs text-gray-500 mb-1">Primary skill</div>
                  {isOwnProfile ? (
                    <select
                      className="border p-2 w-full"
                      value={primarySkill ?? ''}
                      onChange={async e => {
                        const v = e.target.value || null
                        setPrimarySkill(v)
                        await supabase.from('profiles')
                          .update({ primary_skill: v })
                          .eq('id', user.id)
                      }}
                    >
                      <option value="">Select skill</option>
                      {skills
                        .filter(s => s.community === primaryCommunity)
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                  ) : (
                    <div>{primarySkill ?? '—'}</div>
                  )}
                </div>
              )}

              {/* PAST FOCUS (READ-ONLY) */}
              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Past focus</div>
                {Object.entries(
                  userUploads.reduce((acc: any, v) => {
                    acc[v.community] ??= new Set()
                    acc[v.community].add(v.skill)
                    return acc
                  }, {})
                ).map(([community, skillsSet]) => (
                  <div key={community} className="text-xs text-gray-700">
                    {community} → {[...(skillsSet as Set<string>)].join(', ')}
                  </div>
                ))}
              </div>


              {/* ===== IMPROVEMENT SNAPSHOT (NEW) ===== */}
              {/* ===== IMPROVEMENT SNAPSHOT (COLLAPSIBLE) ===== */}
              <div className="border rounded-lg bg-white">

                {/* HEADER */}
                <button
                  className="w-full flex items-center justify-between p-4 text-sm font-semibold
               cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setShowImprovementSnapshot(v => !v)}
                >
                  <span>Improvement snapshot</span>
                  <span className="text-xs">
                    {showImprovementSnapshot ? '▲' : '▼'}
                  </span>
                </button>

                {/* BODY */}
                {showImprovementSnapshot && (
                  <div className="p-4 space-y-3">

                    {/* 1️⃣ RECURRING ISSUES */}
                    <div className="text-sm">
                      <div className="text-xs text-gray-500 mb-1">
                        Most recurring issues
                      </div>

                      {(() => {
                        const grouped: Record<
                          string,
                          Record<string, Record<string, number>>
                        > = {}

                        Object.values(comments).flat().forEach(c => {
                          const attempt = feed.find(a => a.id === c.attempt_id)
                          if (!attempt) return

                          const skill = skills.find(s => s.id === attempt.skill_id)
                          if (!skill) return

                          grouped[skill.community] ??= {}
                          grouped[skill.community][skill.name] ??= {}
                          grouped[skill.community][skill.name][c.issue] =
                            (grouped[skill.community][skill.name][c.issue] || 0) + 1
                        })

                        const communities = Object.keys(grouped)
                        if (communities.length === 0) {
                          return <div className="text-xs text-gray-400">No feedback yet</div>
                        }

                        return (
                          <div className="text-xs space-y-3">
                            {communities.map(community => (
                              <div key={community}>
                                <div className="font-medium text-gray-800 mb-1">
                                  {community}
                                </div>

                                <div className="pl-3 space-y-1">
                                  {Object.entries(grouped[community]).map(
                                    ([skillName, issues]) => {
                                      const topIssue = Object.entries(issues).sort(
                                        (a, b) => b[1] - a[1]
                                      )[0]

                                      return (
                                        <div key={skillName} className="text-gray-700">
                                          {skillName}: {topIssue[0]} ({topIssue[1]})
                                        </div>
                                      )
                                    }
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>

                    {/* 2️⃣ ISSUES FIXED VS PENDING */}
                    <div className="text-sm">
                      <div className="text-xs text-gray-500 mb-1">
                        Feedback action
                      </div>

                      {(() => {
                        const grouped: Record<
                          string,
                          Record<string, { fixed: number; pending: number }>
                        > = {}

                        Object.values(comments).flat().forEach(c => {
                          const attempt = feed.find(a => a.id === c.attempt_id)
                          if (!attempt) return

                          const skill = skills.find(s => s.id === attempt.skill_id)
                          if (!skill) return

                          grouped[skill.community] ??= {}
                          grouped[skill.community][skill.name] ??= { fixed: 0, pending: 0 }

                          if (c.corrected_at) {
                            grouped[skill.community][skill.name].fixed += 1
                          } else {
                            grouped[skill.community][skill.name].pending += 1
                          }
                        })

                        const communities = Object.keys(grouped)
                        if (communities.length === 0) {
                          return <div className="text-xs text-gray-400">No feedback yet</div>
                        }

                        return (
                          <div className="text-xs space-y-3">
                            {communities.map(community => (
                              <div key={community}>
                                <div className="font-medium text-gray-800 mb-1">
                                  {community}
                                </div>

                                <div className="pl-3 space-y-1">
                                  {Object.entries(grouped[community]).map(
                                    ([skillName, stats]) => (
                                      <div key={skillName} className="text-gray-700">
                                        {skillName}: Fixed {stats.fixed} • Pending {stats.pending}
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </div>

                    {/* 3️⃣ USER INTENT */}
                    <div className="text-sm">
                      <div className="text-xs text-gray-500 mb-1">
                        What I want help with right now
                      </div>

                      {editingHelpIntent && isOwnProfile ? (
                        <textarea
                          className="w-full border rounded p-2 text-xs"
                          rows={2}
                          maxLength={200}
                          value={helpIntent}
                          autoFocus
                          onChange={e => setHelpIntent(e.target.value)}
                          onBlur={async () => {
                            setEditingHelpIntent(false)
                            await supabase
                              .from('profiles')
                              .update({ help_intent: helpIntent })
                              .eq('id', user.id)
                          }}
                        />
                      ) : (
                        <div
                          className={`border rounded p-2 text-xs bg-gray-50
              ${isOwnProfile ? 'cursor-pointer' : ''}`}
                          onClick={() => isOwnProfile && setEditingHelpIntent(true)}
                        >
                          {helpIntent || 'Click to describe what you want help with'}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>

            </div>


            {/* ===== SKILL DASHBOARD — WHAT AM I WORKING ON ===== */}
            {skillDashboard && (
              <div className="border rounded-lg p-4 bg-white">
                <div className="text-sm font-semibold mb-2">
                  Current focus
                </div>

                <div className="text-sm text-gray-700">
                  {skillDashboard.community} • {skillDashboard.skill}
                </div>

                <div className="mt-2 text-xs text-gray-600 space-y-1">
                  <div>Attempts (last 14 days): {skillDashboard.attempts14d}</div>
                  <div>Feedback acted upon: {skillDashboard.feedbackActed}</div>
                  <div>
                    Last attempt:{' '}
                    {skillDashboard.lastAttemptAt
                      ? formatIST(skillDashboard.lastAttemptAt, false)
                      : '—'}
                  </div>
                </div>
              </div>
            )}



            {/* ===== COACH QUICK SCAN (READ-ONLY) ===== */}
            {!isOwnProfile && viewerRole === 'coach' && (
              <div className="border rounded-lg bg-gray-50">
                {/* HEADER */}
                <button
                  className="w-full flex items-center justify-between p-4 text-sm font-semibold
           cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => setShowCoachScan(v => !v)}
                >
                  <span>Coach quick scan</span>
                  <span className="text-xs">
                    {showCoachScan ? '▲' : '▼'}
                  </span>
                </button>

                {/* BODY */}
                {showCoachScan && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* USER INTENT */}
                    <div className="text-sm">
                      <div className="text-xs text-gray-500 mb-1">
                        User intent
                      </div>
                      <div className="text-xs text-gray-700">
                        {helpIntent || 'No intent specified'}
                      </div>
                    </div>

                    {/* LAST CORRECTION */}
                    <div className="text-sm">
                      <div className="text-xs text-gray-500 mb-1">
                        Last correction activity
                      </div>
                      {(() => {
                        const corrected = Object.values(comments)
                          .flat()
                          .filter(c => c.corrected_at)
                          .sort(
                            (a, b) =>
                              new Date(b.corrected_at!).getTime() -
                              new Date(a.corrected_at!).getTime()
                          )[0]

                        return (
                          <div className="text-xs text-gray-700">
                            {corrected
                              ? formatIST(corrected.corrected_at!, false)
                              : 'No corrections yet'}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== PROFILE STATS + FOLLOW ===== */}
            <div className="flex items-center gap-6 mt-4 text-sm">

              {/* Impact */}
              <div className="text-center">
                <div className="font-semibold">{impactScore}</div>
                <div className="text-gray-500 text-xs">Impact</div>
              </div>

              {/* Following */}
              <div className="text-center">
                <div className="font-semibold">{followingCount}</div>
                <div className="text-gray-500 text-xs">Following</div>
              </div>

              {/* FOLLOW CONTROLS — ONLY WHEN VIEWING OTHER USER */}
              {user?.id !== profileUserId && (
                <div className="flex gap-3">
                  {/* FOLLOW (when not following) */}
                  {!isFollowing && (
                    <button
                      onClick={() => {
                        if (!requireAuth()) return
                        toggleFollow()
                      }}
                      className="px-5 py-2 rounded text-sm font-semibold bg-black text-white hover:bg-gray-800 transition"
                    >
                      Follow
                    </button>
                  )}

                  {/* FOLLOWING + UNFOLLOW (when already following) */}
                  {isFollowing && (
                    <>
                      <button
                        disabled
                        className="px-5 py-2 rounded text-sm font-semibold border bg-white text-black cursor-default"
                      >
                        Following
                      </button>

                      <button
                        onClick={() => {
                          if (!requireAuth()) return
                          toggleFollow()
                        }}
                        className="px-5 py-2 rounded text-sm font-semibold border text-black hover:bg-gray-100 transition"
                      >
                        Unfollow
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>


            {/* Upload Video */}
            {user?.id === profileUserId && (
              <div className="space-y-3">
                <div className="font-semibold">Upload Video</div>

                <select
                  className="border p-2 w-full"
                  value={selectedCommunity ?? ''}
                  onChange={e => {
                    setSelectedCommunity(e.target.value)
                    setSelectedSkill(null)
                  }}
                >
                  <option value="">Select Community</option>
                  <option value="Fitness">Fitness</option>
                  <option value="Yoga">Yoga</option>
                </select>

                {selectedCommunity && (
                  <select
                    className="border p-2 w-full"
                    value={selectedSkill ?? ''}
                    onChange={e => setSelectedSkill(e.target.value)}
                  >
                    <option value="">Select Skill</option>
                    {skills
                      .filter(s => s.community === selectedCommunity)
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                )}
                {/* ✅ NEW: Upload type */}
                {selectedSkill && (
                  <select
                    className="border p-2 w-full"
                    value={uploadType ?? ''}
                    onChange={e => setUploadType(e.target.value as any)}
                  >
                    <option value="">Upload type</option>
                    <option value="raw">Upload raw video</option>
                    <option value="processed">Upload processed video</option>
                  </select>
                )}

                {uploadType && (
                  <div className="space-y-6">
                    {/* ATTEMPT CAPTION */}
                    <textarea
                      className="border p-2 w-full text-sm"
                      rows={4}
                      maxLength={200}
                      placeholder="Write about issues in this attempt (max 200 words)"
                      value={attemptCaption}
                      onChange={e => setAttemptCaption(e.target.value)}
                    />

                    <div className="space-y-2">
                      <button
                        className={`text-xs underline mb-3 cursor-pointer hover:text-black transition
  ${includeCaption ? 'text-green-600' : ''}
`}
                        onClick={() => setIncludeCaption(true)}
                      >
                        Include text
                      </button>

                      <input
                        type="file"
                        accept="video/*"
                        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleVideoUpload}
                  disabled={!selectedFile || uploading}
                  className={`px-4 py-2 rounded text-sm transition
    ${uploading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-black text-white hover:bg-gray-800'}
  `}
                >
                  {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
                </button>

                {/* Progress bar */}
                {uploading && (
                  <div className="w-full h-2 bg-gray-200 rounded overflow-hidden mt-2">
                    <div
                      className="h-full bg-black transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}

                {/* Error */}
                {uploadError && (
                  <p className="text-red-600 text-sm mt-2">{uploadError}</p>
                )}
              </div>
            )}

            {/* Uploaded videos */}
            <div className="space-y-4">
              {Object.entries(
                userUploads.reduce((acc: any, v) => {
                  acc[v.community] ??= {}
                  acc[v.community][v.skill] ??= []
                  acc[v.community][v.skill].push(v)
                  return acc
                }, {})
              ).map(([community, skills]) => (
                <div key={community}>
                  <div className="text-lg font-bold mt-4">{community}</div>

                  {Object.entries(skills as any).map(([skill, vids]) => (
                    <div key={skill} className="ml-4">
                      <div className="mt-2 space-y-1">
                        <div className="text-sm font-semibold text-gray-700">
                          {skill}
                        </div>

                        {isOwnProfile && (vids as any[]).length >= 2 && (
                          <>
                            <button
                              className={`text-xs underline font-semibold ${compareSkill === skill ? 'text-black' : ''
                                }`}
                              onClick={e => {
                                e.stopPropagation()

                                // 🔁 TOGGLE LOGIC
                                if (compareSkill === skill) {
                                  setCompareSkill(null)
                                  setCompareAttempts([])
                                } else {
                                  setCompareSkill(skill)
                                  setCompareAttempts([])
                                }
                              }}
                            >
                              Compare {skill} attempts
                            </button>

                            {compareSkill === skill && (
                              <div className="text-[11px] text-gray-500 mt-1">
                                Select any two attempts
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex gap-3 flex-wrap mt-2">
                        {(() => {
                          // sort attempts by earliest first for numbering
                          const sorted = [...(vids as any[])].sort(
                            (a, b) =>
                              Date.parse(a.created_at) -
                              Date.parse(b.created_at)
                          )

                          return sorted.map((v, index) => (
                            <div
                              key={v.url}
                              className={`w-24 cursor-pointer
    ${compareAttempts.some(a => a.processed_video_url === v.url)
                                  ? 'ring-2 ring-black rounded'
                                  : ''}
  `}
                              onClick={() => {
                                const attempt = feed.find(
                                  a =>
                                    a.processed_video_url === v.url &&
                                    a.created_at === v.created_at
                                )
                                if (!attempt) return

                                if (compareSkill === skill) {
                                  setCompareAttempts(prev => {
                                    if (prev.find(a => a.id === attempt.id)) return prev
                                    if (prev.length === 2) return prev

                                    const next = [...prev, attempt]

                                    return next
                                  })
                                  return
                                }

                                setActiveProfileAttempt(attempt)
                                setShowProfile(false)
                              }}
                            >
                              <div className="w-24 h-16 bg-black rounded overflow-hidden">
                                <video
                                  src={v.url}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                              </div>

                              {/* ATTEMPT NUMBER */}
                              <div className="text-[10px] font-medium text-center mt-1">
                                Attempt {index + 1}
                              </div>

                              {/* DATE */}
                              <div className="text-[10px] text-gray-500 text-center">
                                {formatIST(v.created_at, false)}
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

          </div>
        </div>
      )
      }

      {/* ===== FEED FILTERS ===== */}
      {
        !showProfile && !activeProfileAttempt && (
          <div className="max-w-5xl mx-auto px-6 pt-6">
            <div className="bg-white border rounded-xl p-4 flex flex-col gap-2">

              {/* 🔍 SEARCH + FILTER GROUP */}
              <div className="flex flex-col gap-1">

                {/* SEARCH ROW */}
                <div className="flex items-center gap-2">
                  <input
                    className="border px-2 py-1 text-sm rounded w-40"
                    placeholder="@user-id"
                    value={searchPublicId}
                    onChange={e => setSearchPublicId(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') searchByPublicId()
                    }}
                  />
                  <button
                    className="text-sm underline cursor-pointer hover:text-black transition"
                    onClick={searchByPublicId}
                  >
                    Search
                  </button>
                </div>

                {/* FILTER BUTTON — JUST BELOW SEARCH */}
                <button
                  className="text-xs underline cursor-pointer hover:text-black transition self-start"
                  onClick={() => setShowFilters(v => !v)}
                >
                  {filterApplied ? 'Filter applied' : 'Filter'}
                </button>
              </div>

              {/* FILTER OPTIONS */}
              {showFilters && (
                <>

                  {/* 1️⃣ COMMUNITY */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* COMMUNITY */}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Community</div>

                      {[...new Set(skills.map(s => s.community))].map(c => (
                        <label key={c} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filterCommunities.includes(c)}
                            onChange={() => {
                              setFilterApplied(false)
                              setFilterCommunities(prev =>
                                prev.includes(c)
                                  ? prev.filter(x => x !== c)
                                  : [...prev, c]
                              )
                            }}
                          />
                          {c}
                        </label>
                      ))}
                    </div>

                    {/* SKILL */}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Skill</div>

                      {skills
                        .filter(s =>
                          filterCommunities.length === 0 ||
                          filterCommunities.includes(s.community)
                        )
                        .map(s => (
                          <label key={s.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={filterSkills.includes(s.id)}
                              onChange={() =>
                                setFilterSkills(prev =>
                                  prev.includes(s.id)
                                    ? prev.filter(x => x !== s.id)
                                    : [...prev, s.id]
                                )
                              }
                            />
                            {s.name}
                          </label>
                        ))}
                    </div>
                  </div>

                  {false && (
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Issue</div>

                      {Array.from(
                        new Set(
                          Object.entries(skillIssues)
                            .filter(([skillId]) =>
                              filterSkills.length === 0 || filterSkills.includes(skillId)
                            )
                            .flatMap(([, issues]) => issues)
                        )
                      ).map(issue => (
                        <label key={issue} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={filterIssues.includes(issue)}
                            onChange={() =>
                              setFilterIssues(prev =>
                                prev.includes(issue)
                                  ? prev.filter(x => x !== issue)
                                  : [...prev, issue]
                              )
                            }
                          />
                          {issue}
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 3️⃣ FILTER TYPE */}
                  <select
                    className="border p-2 text-sm"
                    value={filterType}
                    onChange={e => {
                      setFilterType(e.target.value as any)
                      setFilterApplied(false)
                    }}
                  >
                    <option value="latest">Latest</option>
                    <option value="following">Following</option>
                    <option value="relevance">Relevance</option>
                  </select>

                  {/* 4️⃣ APPLY BUTTON */}
                  <button
                    className={`px-4 py-2 text-sm rounded border cursor-pointer transition
    ${filterApplied
                        ? 'bg-black text-white'
                        : 'bg-white hover:bg-gray-100'}
  `}
                    onClick={applyHomeFilter}
                  >
                    Apply filter
                  </button>
                </>
              )}

            </div>
          </div>
        )
      }



      {/* ================= FEED ================= */}
      {
        !showProfile && !activeProfileAttempt && (
          <div className="max-w-5xl mx-auto p-6 space-y-6">
            {feed.length === 0 && (
              <div className="text-center text-sm text-gray-500">
                No videos yet
              </div>
            )}

            {feed.map(attempt => (
              <div
                key={attempt.id}
                className="bg-white border rounded-xl p-4"
              >

                {attempt.user_id === user?.id && (
                  <button
                    className="text-xs text-red-600 underline float-right"
                    onClick={e => {
                      e.stopPropagation()
                      deleteAttempt(attempt.id)
                    }}
                  >
                    Delete
                  </button>
                )}
                {/* HEADER (NEW) */}
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden cursor-pointer"
                    onClick={e => {
                      e.stopPropagation()
                      openProfile(attempt.user_id)
                      fetchUserUploads(attempt.user_id)
                    }}
                  >
                    {feedProfiles[attempt.user_id]?.avatar_url && (
                      <img
                        src={feedProfiles[attempt.user_id]?.avatar_url || ''}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div
                    className="font-medium cursor-pointer hover:underline"
                    onClick={e => {
                      e.stopPropagation()
                      openProfile(attempt.user_id)
                      fetchUserUploads(attempt.user_id)
                    }}
                  >
                    {feedProfiles[attempt.user_id]?.username ?? 'User'}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {formatIST(attempt.created_at)}
                  </div>
                </div>

                {/* VIDEO (UNCHANGED BEHAVIOR) */}
                <div
                  className="cursor-pointer hover:bg-gray-50 transition rounded"
                  onClick={() => {
                    setActiveProfileAttempt(attempt)
                    setShowProfile(false)

                    setOriginalAttempt(
                      attempt.parent_attempt_id
                        ? feed.find(a => a.id === attempt.parent_attempt_id) || attempt
                        : attempt
                    )
                    setIsReAttempt(false)
                    setReAttemptFile(null)
                  }}
                >

                  <video
                    src={attempt.processed_video_url!}
                    className="w-full max-h-[70vh] rounded bg-black object-contain"
                    muted
                  />
                </div>
              </div>
            ))}
          </div>
        )
      }

      {
        showPicModal && profilePicUrl && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl space-y-4 w-[320px]">
              <img src={profilePicUrl} className="w-full rounded-lg" />

              <label className="block text-center text-sm underline cursor-pointer">
                Edit picture
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file || !user) return

                    const path = `profile_avatars/${user.id}.jpg`

                    const { error } = await supabase.storage
                      .from('profile_avatars')
                      .upload(path, file, { upsert: true })

                    if (error) return alert(error.message)

                    const { data } = supabase.storage
                      .from('profile_avatars')
                      .getPublicUrl(path)
                    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`
                    await supabase
                      .from('profiles')
                      .upsert(
                        { id: user.id, avatar_url: bustedUrl },
                        { onConflict: 'id' }
                      )

                    setProfilePicUrl(bustedUrl)
                    setShowPicModal(false)
                  }}
                />
              </label>

              <button
                className="w-full text-sm underline cursor-pointer hover:text-black transition"
                onClick={deleteProfilePicture}
              >
                Delete profile picture
              </button>

              <button
                className="w-full text-sm underline cursor-pointer hover:text-black transition"
                onClick={() => setShowPicModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        )
      }

    </main >
  )
}