'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '../lib/supabase'

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

type Comment = {
  id: string            // 👈 comment row id (uuid)
  user_id: string       // 👈 who wrote the comment
  attempt_id: string    // 👈 which video
  second: number
  issue: string
  issue_id?: string
  suggestion: string
  corrected_at?: string | null
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
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [draftComments, setDraftComments] = useState<
    Record<string, { second: number; issue: string; suggestion: string }>
  >({})


  const [skillIssues, setSkillIssues] = useState<Record<string, string[]>>({})

  /* ---------- FEED FILTER STATE ---------- */
  const [filterCommunity, setFilterCommunity] = useState<string | null>(null)
  const [filterSkill, setFilterSkill] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'latest' | 'following' | 'relevance'>('latest')
  const [filterApplied, setFilterApplied] = useState(false)

  /* ---------- UPLOAD STATE (ADDED) ---------- */
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // ===== PROFILE VIDEO VIEW (ADDED) =====


  const [activeProfileAttempt, setActiveProfileAttempt] = useState<Attempt | null>(null)

  // ===== PROFILE STATE (ADDED) =====



  /* 🔹 AUTO-FETCH COMMENTS WHEN A VIDEO OPENS */
  useEffect(() => {
    if (!activeProfileAttempt) return
    fetchComments(activeProfileAttempt.id)
  }, [activeProfileAttempt])

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
  const [primaryCommunity, setPrimaryCommunity] = useState<string | null>(null)
  const [primarySkill, setPrimarySkill] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null)
  const [showPicModal, setShowPicModal] = useState(false)
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

    if (filterSkill) {
      q = q.eq('skill_id', filterSkill)
    } else if (filterCommunity) {
      const skillIds = skills
        .filter(s => s.community === filterCommunity)
        .map(s => s.id)

      q = q.in('skill_id', skillIds)
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

    const { data } = await q
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
          username: p.username,
          avatar_url: p.avatar_url
        }
      })

      setFeedProfiles(map)
    }
    setFilterApplied(true)
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
       .returns<Comment[]>() 

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
        isReAttempt: Boolean(row.parent_attempt_id)
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
        .maybeSingle()

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

    const skill = skills.find(s => s.id === activeSkillName)
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

  if (!user) {
    return (
      <main className="min-h-screen flex bg-[#FBF6EC] text-black">
        <section className="hidden md:flex w-1/2 relative">
          <Image src="/activities3.jpg" alt="Activities" fill className="object-contain" />
          <div className="absolute inset-0 bg-black/40 p-12 flex flex-col justify-center">

          </div>
        </section>

        <section className="w-full md:w-1/2 flex items-center justify-center">
          <div className="flex flex-col items-center">

            {/* TITLE + TAGLINE */}
            <div className="mb-6 text-center">
              <div className="text-4xl font-bold mb-2">MUST_Life</div>
              <div className="text-sm text-gray-600">
                Practice together. Improve together.
              </div>
            </div>
            <div className="w-[380px] bg-white border border-gray-200 p-8 rounded-2xl shadow-sm">
              <h2 className="text-2xl font-semibold mb-6 text-center">
                Login to MUST_Life
              </h2>

              <input
                className="w-full border border-gray-300 p-2 mb-3 rounded"
                placeholder="Email or Username"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
              />

              <input
                className="w-full border border-gray-300 p-2 mb-3 rounded"
                placeholder="Password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />

              {authError && (
                <p className="text-red-600 text-sm mb-3">{authError}</p>
              )}

              <button
                className="w-full bg-black text-white py-2 rounded-lg mb-3"
                onClick={loginWithPassword}
              >
                Login
              </button>

              {/* ✅ ONLY ADDITION */}
              <p className="text-sm text-center mb-2">
                New here? <span className="font-medium">Create account</span>
              </p>

              <button
                className="w-full border border-black py-2 rounded-lg mb-4"
                onClick={() => setAuthMode('verify_email')}
              >
                Create account
              </button>

              <div className="flex justify-between text-sm">
                <button
                  className="underline"
                  onClick={() => setAuthMode('forgot_password')}
                >
                  Forgot password?
                </button>
                <button className="underline" onClick={continueAsGuest}>
                  Continue as guest
                </button>
              </div>
            </div>


            {authMode === 'verify_email' && (
              <div className="w-[380px] bg-white border p-6 rounded-xl mt-6">
                <h3 className="text-lg font-semibold mb-3 text-center">
                  Verify your email
                </h3>

                <input
                  className="w-full border p-2 mb-3 rounded"
                  placeholder="Email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                />
                <input
                  className="w-full border p-2 mb-3 rounded"
                  type="password"
                  placeholder="Password (optional)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />

                {authError && (
                  <p className="text-red-600 text-sm mb-2">{authError}</p>
                )}

                <button
                  className="w-full bg-black text-white py-2 rounded"
                  onClick={sendEmailVerification}
                >
                  Send verification link
                </button>
              </div>
            )}
            {authMode === 'forgot_password' && (
              <div className="w-[380px] bg-white border p-6 rounded-xl mt-6">
                <h3 className="text-lg font-semibold mb-3 text-center">
                  Reset password
                </h3>

                <input
                  className="w-full border p-2 mb-3 rounded"
                  placeholder="Email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                />

                {authError && (
                  <p className="text-red-600 text-sm mb-2">{authError}</p>
                )}

                <button
                  className="w-full bg-black text-white py-2 rounded"
                  onClick={sendPasswordReset}
                >
                  Send reset link
                </button>
              </div>
            )}

          </div>
        </section>
      </main>
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
    <main className="min-h-screen bg-[#FBF6EC] text-black">
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
                  className="mt-2 text-xs text-red-600 underline"
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
                    className="text-xs underline"
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
                className="border rounded p-2 text-sm bg-white flex items-start gap-3"
              >
                {/* PROFILE PIC */}
                <div
                  className="w-8 h-8 rounded-full bg-gray-300 overflow-hidden flex-shrink-0 cursor-pointer"
                  onClick={() => {
                    openProfile(c.profiles?.id!)
                  }}
                >
                  {c.profiles?.avatar_url && (
                    <img
                      src={c.profiles.avatar_url}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>


                {/* COMMENT CONTENT — HORIZONTAL */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="font-medium cursor-pointer hover:underline whitespace-nowrap"
                    onClick={() => {
                      openProfile(c.profiles?.id!)
                    }}
                  >
                    {c.profiles?.display_name || c.profiles?.username || 'User'}
                  </span>

                  {/* TIMESTAMP */}
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {c.second === 0 ? 'Overall' : `${c.second}s`}
                  </span>

                  {/* ISSUE */}
                  <span className="font-medium whitespace-nowrap">
                    {c.issue}
                  </span>

                  {/* SUGGESTION */}
                  {editingCommentId === c.id ? (
                    <input
                      className="border p-1 text-sm"
                      value={editDraft.suggestion}
                      onChange={e =>
                        setEditDraft(prev => ({ ...prev, suggestion: e.target.value }))
                      }
                    />
                  ) : (
                    <span className="text-gray-700">
                      {c.suggestion}
                    </span>
                  )}
                  {c.user_id === user.id && editingCommentId !== c.id && (
                    <button
                      className="text-xs underline"
                      onClick={() => {
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
                  {editingCommentId === c.id && (
                    <button
                      className="text-xs underline"
                      onClick={async () => {
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
                  {(c.user_id === user.id ||
                    activeProfileAttempt.user_id === user.id) && (
                      <button
                        className="text-xs text-red-600 underline"
                        onClick={() => deleteComment(c.id)}
                      >
                        Delete
                      </button>
                    )}
                  {/* 🔹 ATTEMPT CORRECTION — ONLY FOR VIDEO OWNER */}
                  {activeProfileAttempt.user_id === user.id && !c.corrected_at && (
                    <div className="mt-2 ml-11 text-xs">
                      <button
                        className="underline"
                        onClick={() =>
                          setCorrectionState({ commentId: c.id, file: null })
                        }
                      >
                        Attempt correction
                      </button>
                    </div>
                  )}
                  {c.corrected_at && (
                    <div className="mt-2 ml-11 text-xs text-green-700">
                      <button
                        className="underline"
                        onClick={() => {
                          const correctedAttempt = feed.find(
                            a => a.parent_attempt_id === activeProfileAttempt.id
                          )

                          if (correctedAttempt) {
                            setActiveProfileAttempt(correctedAttempt)
                            setShowProfile(false)
                          }
                        }}
                      >
                        Correction attempted
                      </button>
                    </div>
                  )}

                  {/* 🔹 CORRECTION UPLOAD UI */}
                  {correctionState?.commentId === c.id && (
                    <div className="mt-2 ml-11 space-y-2 text-xs">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={e =>
                          setCorrectionState(prev =>
                            prev
                              ? { ...prev, file: e.target.files?.[0] || null }
                              : null
                          )
                        }
                      />

                      <button
                        className="bg-black text-white px-3 py-1 rounded disabled:opacity-50"
                        disabled={!correctionState.file || uploading}
                        onClick={handleCorrectionUpload}
                      >
                        Upload
                      </button>

                      {uploading && (
                        <div className="w-40 h-2 bg-gray-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-black"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}





                </div>
              </div>

            ))}
          </div>

        </div>
      )}
      <header className="sticky top-0 z-20 bg-[#FBF6EC]/90 backdrop-blur border-b border-gray-200 px-6 py-4 flex justify-between">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-lg">MUST_Life</span>
          <div
            className="relative group cursor-pointer text-sm"
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

        {/* ===== PROFILE BUTTON (ADDED) ===== */}
        <button
          onClick={() => {
            // ✅ CLOSE VIDEO + RESET RE-ATTEMPT
            setActiveProfileAttempt(null)

            setOriginalAttempt(null)
            setIsReAttempt(false)
            setReAttemptFile(null)

            openProfile(user.id)
            fetchUserUploads(user.id)
          }}
          className="text-sm underline mr-4"
        >
          Profile
        </button>
        <button onClick={logout} className="text-sm underline">
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
                    className={`border rounded p-2 bg-white whitespace-pre-wrap ${isOwnProfile ? 'cursor-pointer' : ''
                      }`}
                    onClick={() => isOwnProfile && setEditingBio(true)}
                  >
                    {bio || 'Write about yourself (max 200 words)'}
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
                      ? new Date(skillDashboard.lastAttemptAt).toLocaleDateString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })
                      : '—'}
                  </div>
                </div>
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

              {/* Follow button — ONLY other user's profile */}
              {user?.id !== profileUserId && (
                <button
                  className="border px-3 py-1 rounded text-sm"
                  onClick={handleFollow}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            {/* FOLLOW / UNFOLLOW — ONLY OTHER USER */}
            {user?.id !== profileUserId && (
              <button
                onClick={toggleFollow}
                className={`px-4 py-2 rounded text-sm border ${isFollowing
                  ? 'bg-white text-black'
                  : 'bg-black text-white'
                  }`}
              >
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
            )}

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
                        <option key={s.id} value={s.name}>
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
                        className={`text-xs underline mb-3 ${includeCaption ? 'text-green-600' : ''}`}
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
                      <div className="text-sm font-semibold text-gray-700 mt-2">
                        {skill}
                      </div>
                      <div className="flex gap-3 flex-wrap mt-2">
                        {(vids as any[]).map((v, i) => (
                          <div
                            key={i}
                            className="w-24 h-16 bg-black rounded cursor-pointer overflow-hidden"
                            onClick={() => {
                              const attempt = feed.find(
                                a => a.processed_video_url === v.url
                              )
                              if (!attempt) {
                                alert('Attempt not found')
                                return
                              }

                              setActiveProfileAttempt(attempt)
                              setShowProfile(false)


                              // reset re-attempt state

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
                              src={v.url}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="text-[10px] text-gray-500 text-center mt-1">
                              {new Date(v.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ===== FEED FILTERS ===== */}
      {!showProfile && !activeProfileAttempt && (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-center">

            {/* 1️⃣ COMMUNITY */}
            <select
              className="border p-2 text-sm"
              value={filterCommunity ?? ''}
              onChange={e => {
                setFilterCommunity(e.target.value || null)
                setFilterSkill(null)
                setFilterApplied(false)
              }}
            >
              <option value="">Select Community</option>
              {[...new Set(skills.map(s => s.community))].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* 2️⃣ SKILL */}
            <select
              className="border p-2 text-sm"
              value={filterSkill ?? ''}
              disabled={!filterCommunity}
              onChange={e => {
                setFilterSkill(e.target.value || null)
                setFilterApplied(false)
              }}
            >
              <option value="">Select Skill</option>
              {skills
                .filter(s => s.community === filterCommunity)
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>

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
              className={`px-4 py-2 text-sm rounded border
      ${filterApplied ? 'bg-black text-white' : 'bg-white'}
    `}
              onClick={applyHomeFilter}
            >
              Apply filter
            </button>

          </div>
        </div>
      )}


      {/* ================= FEED ================= */}
      {!showProfile && !activeProfileAttempt && (
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

              {attempt.user_id === user.id && (
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

                <div className="text-sm">
                  <div className="font-medium">
                    {feedProfiles[attempt.user_id]?.username ?? 'User'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {skills.find(s => s.id === attempt.skill_id)?.community}
                    {' → '}
                    {skills.find(s => s.id === attempt.skill_id)?.name}
                  </div>
                </div>
                <div className="text-[11px] text-gray-400">
                  {new Date(attempt.created_at).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                  })}
                </div>
              </div>

              {/* VIDEO (UNCHANGED BEHAVIOR) */}
              <div
                className="cursor-pointer"
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
      )}

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
                className="w-full text-sm underline"
                onClick={deleteProfilePicture}
              >
                Delete profile picture
              </button>

              <button
                className="w-full text-sm underline"
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