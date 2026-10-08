import { useEffect, useMemo, useState } from 'react'
import profileFrog from './assets/profile-frog.png'

const STORAGE_KEY = 'save-me-goals-v2'
const DEFAULT_SPOTIFY = 'https://open.spotify.com/track/2Lqdqm1ql2AWdEgLjwirN4?si=94058eaad1d8490f'
const money = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })

const createDefaultApp = () => ({
  version: 2,
  settings: { nickname: 'coco', bio: '오늘도 귀엽게 저축하는 중 .ᐟ', spotifyUrl: DEFAULT_SPOTIFY },
  goals: [],
})

const formatMoney = (value) => money.format(Number(value || 0))
const today = () => new Date().toISOString().slice(0, 10)
const savedAmount = (goal) => goal.deposits.reduce((total, deposit) => total + deposit.amount, 0)

function loadApp() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (stored?.version === 2 && Array.isArray(stored.goals) && stored.settings) return stored
  } catch {
    // A fresh planner is safer than a broken page when browser storage is corrupted.
  }
  return createDefaultApp()
}

function spotifyEmbed(url) {
  const match = url?.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)
  return match ? `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator` : null
}

function App() {
  const [app, setApp] = useState(loadApp)
  const [page, setPage] = useState('dashboard')
  const [goalModal, setGoalModal] = useState(null)
  const [goalForm, setGoalForm] = useState({ name: '', target: '' })
  const [goalError, setGoalError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app))
  }, [app])

  const currentGoal = app.goals.find((goal) => goal.id === page)
  const totalSaved = useMemo(() => app.goals.reduce((total, goal) => total + savedAmount(goal), 0), [app.goals])
  const totalTarget = useMemo(() => app.goals.reduce((total, goal) => total + goal.target, 0), [app.goals])
  const musicUrl = spotifyEmbed(app.settings.spotifyUrl)

  const openGoalModal = (goal = null) => {
    setGoalModal(goal || 'new')
    setGoalForm(goal ? { name: goal.name, target: String(goal.target) } : { name: '', target: '' })
    setGoalError('')
  }

  const saveGoal = (event) => {
    event.preventDefault()
    const target = Number(goalForm.target.replaceAll(',', ''))
    if (!goalForm.name.trim()) return setGoalError('목표 이름을 입력해 주세요.')
    if (!Number.isFinite(target) || target <= 0) return setGoalError('여행 예산을 0원보다 크게 입력해 주세요.')
    if (goalModal === 'new') {
      const id = `goal-${Date.now()}`
      setApp((previous) => ({ ...previous, goals: [...previous.goals, { id, name: goalForm.name.trim(), target, deposits: [] }] }))
      setPage(id)
    } else {
      setApp((previous) => ({ ...previous, goals: previous.goals.map((goal) => goal.id === goalModal.id ? { ...goal, name: goalForm.name.trim(), target } : goal) }))
    }
    setGoalModal(null)
  }

  const deleteGoal = (id) => {
    if (!window.confirm('이 목표적금과 모든 입금 기록을 삭제할까요?')) return
    setApp((previous) => ({ ...previous, goals: previous.goals.filter((goal) => goal.id !== id) }))
    setPage('dashboard')
    setGoalModal(null)
  }

  const addDeposit = (goalId, input) => {
    const amount = Number(input.amount.replaceAll(',', ''))
    if (!Number.isFinite(amount) || amount <= 0) return '입금액을 0원보다 크게 입력해 주세요.'
    setApp((previous) => ({
      ...previous,
      goals: previous.goals.map((goal) => goal.id === goalId ? {
        ...goal,
        deposits: [{ id: `deposit-${Date.now()}`, date: input.date, amount, memo: input.memo.trim() }, ...goal.deposits],
      } : goal),
    }))
    return ''
  }

  const removeDeposit = (goalId, depositId) => {
    setApp((previous) => ({ ...previous, goals: previous.goals.map((goal) => goal.id === goalId ? { ...goal, deposits: goal.deposits.filter((deposit) => deposit.id !== depositId) } : goal) }))
  }

  const updateSettings = (settings) => setApp((previous) => ({ ...previous, settings: { ...previous.settings, ...settings } }))

  return <div className="retro-desktop">
    <div className="desktop-cloud">☁</div><div className="desktop-star">★</div>
    <div className="window-shell">
      <div className="window-titlebar"><span>₩ SAVE ME.exe — 목표적금 관리 프로그램</span><div className="window-controls" aria-hidden="true"><i>_</i><i>□</i><i>×</i></div></div>
      <aside className="sidebar">
        <div className="brand"><b>₩</b><span>MY SAVINGS</span></div>
        <section className="profile-card" aria-label="프로필">
          <img src={profileFrog} alt="노란 모자를 쓴 초록색 캐릭터 프로필" />
          <div><strong>{app.settings.nickname || 'coco'}</strong><span>saving archive ★</span></div>
          <p>{app.settings.bio || '오늘도 귀엽게 저축하는 중 .ᐟ'}</p>
        </section>
        <nav aria-label="목표적금 메뉴">
          <button className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => setPage('dashboard')}><span>▣</span> 대시보드</button>
          {app.goals.map((goal) => <button key={goal.id} className={`nav-item ${page === goal.id ? 'active' : ''}`} onClick={() => setPage(goal.id)}><span>✦</span> {goal.name}</button>)}
          <button className="nav-item add-goal-nav" onClick={() => openGoalModal()}><span>＋</span> 목표적금 추가</button>
          <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}><span>⚙</span> 설정</button>
        </nav>
        {musicUrl && <section className="music-card" aria-label="지금 듣는 노래"><p>NOW PLAYING ♫</p><iframe title="Spotify track player" src={musicUrl} loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" /></section>}
        <div className="sidebar-bottom"><small>저장 위치</small><b>이 브라우저</b><span>● 자동 저장 중</span></div>
      </aside>
      <main className="app-shell">
        {page === 'dashboard' && <Dashboard goals={app.goals} totalSaved={totalSaved} totalTarget={totalTarget} onOpenGoal={setPage} onCreate={() => openGoalModal()} />}
        {currentGoal && <GoalPage goal={currentGoal} onBack={() => setPage('dashboard')} onEdit={() => openGoalModal(currentGoal)} onAddDeposit={addDeposit} onRemoveDeposit={removeDeposit} />}
        {page === 'settings' && <SettingsPage settings={app.settings} onSave={updateSettings} onReset={() => { if (window.confirm('모든 목표와 입금 기록을 초기화할까요?')) { setApp(createDefaultApp()); setPage('dashboard') } }} />}
      </main>
    </div>
    {goalModal && <GoalModal goal={goalModal === 'new' ? null : goalModal} form={goalForm} error={goalError} onChange={setGoalForm} onSubmit={saveGoal} onClose={() => setGoalModal(null)} onDelete={deleteGoal} />}
  </div>
}

function Dashboard({ goals, totalSaved, totalTarget, onOpenGoal, onCreate }) {
  const progress = totalTarget ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0
  return <>
    <header className="page-hero"><div><p className="eyebrow">TRAVEL SAVINGS HOME</p><h1>목표적금 <em>대시보드</em></h1><p>꿈꾸는 여행을 하나씩 현실로 만들어요.</p></div><button className="pink-button" onClick={onCreate}>＋ 새 목표적금</button></header>
    <section className="summary-grid"><SummaryCard label="지금까지 모은 돈" value={formatMoney(totalSaved)} note="모든 목표적금 합계" /><SummaryCard label="전체 여행 예산" value={formatMoney(totalTarget)} note="목표 금액 합계" /><SummaryCard label="전체 달성률" value={`${progress}%`} note={`${goals.length}개의 여행 계획`} /></section>
    <section className="window-panel dashboard-goals"><div className="panel-titlebar"><h2>✦ 나의 여행 적금</h2><span>{goals.length} goals</span></div>{goals.length ? <div className="goal-card-grid">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} onClick={() => onOpenGoal(goal.id)} />)}</div> : <div className="empty-goals"><span>✈</span><h2>첫 번째 여행 목표를 만들어요!</h2><p>여행지와 예산을 적으면 나만의 적금 페이지가 생겨요.</p><button className="pink-button" onClick={onCreate}>목표적금 추가하기</button></div>}</section>
  </>
}

function GoalPage({ goal, onBack, onEdit, onAddDeposit, onRemoveDeposit }) {
  const [form, setForm] = useState({ date: today(), amount: '', memo: '' })
  const [error, setError] = useState('')
  const saved = savedAmount(goal)
  const remaining = Math.max(0, goal.target - saved)
  const progress = Math.min(100, Math.round((saved / goal.target) * 100))
  const submit = (event) => { event.preventDefault(); const result = onAddDeposit(goal.id, form); if (result) return setError(result); setError(''); setForm({ date: today(), amount: '', memo: '' }) }
  return <>
    <header className="page-hero goal-hero"><div><button className="back-button" onClick={onBack}>← 대시보드</button><p className="eyebrow">MY TRAVEL FUND</p><h1>{goal.name} <em>적금</em></h1><p>여행을 향해 오늘도 한 칸 더 가까이.</p></div><button className="soft-button" onClick={onEdit}>⚙ 목표 수정</button></header>
    <section className="goal-overview"><article className="big-progress"><p>여행 예산 {formatMoney(goal.target)}</p><strong>{formatMoney(saved)}</strong><span>현재까지 모은 금액</span><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><b>{progress}% complete</b></article><article className="remaining-card"><span>남은 금액</span><strong>{formatMoney(remaining)}</strong><p>{remaining === 0 ? '목표 달성! 여행 갈 준비 끝 ✦' : '다음 입금으로 조금 더 가까워져요.'}</p></article></section>
    <section className="goal-page-grid"><section className="window-panel deposit-panel"><div className="panel-titlebar"><h2>＋ 입금 기록하기</h2><span>NEW DEPOSIT</span></div><form className="deposit-form" onSubmit={submit}><label>입금 날짜<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>입금액<input inputMode="numeric" placeholder="예: 100000" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>메모 <small>선택</small><input placeholder="예: 월급날 적금" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} /></label>{error && <p className="form-error">✦ {error}</p>}<button className="pink-button" type="submit">입금 기록 추가</button></form></section><section className="window-panel history-panel"><div className="panel-titlebar"><h2>▤ 입금 히스토리</h2><span>{goal.deposits.length} records</span></div>{goal.deposits.length ? <div className="deposit-list">{goal.deposits.map((deposit) => <div className="deposit-row" key={deposit.id}><div><strong>{deposit.date}</strong><span>{deposit.memo || '저축 기록'}</span></div><b>+ {formatMoney(deposit.amount)}</b><button onClick={() => onRemoveDeposit(goal.id, deposit.id)} aria-label="입금 기록 삭제">×</button></div>)}</div> : <div className="empty-history">아직 입금 기록이 없어요.<br />첫 저축을 추가해 볼까요?</div>}</section></section>
  </>
}

function SettingsPage({ settings, onSave, onReset }) {
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const submit = (event) => { event.preventDefault(); onSave(form); setSaved(true); window.setTimeout(() => setSaved(false), 1800) }
  return <><header className="page-hero"><div><p className="eyebrow">PERSONALIZE MY SPACE</p><h1>설정 <em>페이지</em></h1><p>왼쪽 미니 블로그를 나답게 꾸며요.</p></div></header><section className="window-panel settings-panel"><div className="panel-titlebar"><h2>⚙ 프로필 & 음악 설정</h2></div><form onSubmit={submit}><label>닉네임<input value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} placeholder="닉네임" /></label><label>한 줄 소개<input value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="소개 문구" /></label><label>Spotify 곡 링크<input value={form.spotifyUrl} onChange={(event) => setForm({ ...form, spotifyUrl: event.target.value })} placeholder="https://open.spotify.com/track/..." /></label>{saved && <p className="saved-notice">✦ 저장했어요!</p>}<button className="pink-button" type="submit">설정 저장하기</button></form></section><section className="window-panel danger-panel"><div><h2>데이터 초기화</h2><p>목표적금과 입금 기록을 모두 지워요. 이 작업은 되돌릴 수 없어요.</p></div><button className="danger-button" onClick={onReset}>모든 데이터 초기화</button></section></>
}

function GoalModal({ goal, form, error, onChange, onSubmit, onClose, onDelete }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="goal-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-titlebar"><h2 id="goal-modal-title">{goal ? '목표적금 편집' : '새 목표적금 만들기'}</h2></div><button className="close-button" onClick={onClose} aria-label="닫기">×</button><form onSubmit={onSubmit}><label>여행지 또는 목표 이름<input autoFocus value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="예: 부산, 일본, 유럽" /></label><label>여행 예산 <b>필수</b><input inputMode="numeric" value={form.target} onChange={(event) => onChange({ ...form, target: event.target.value })} placeholder="예: 1000000" /></label>{error && <p className="form-error">✦ {error}</p>}<div className="modal-actions">{goal && <button className="danger-button" type="button" onClick={() => onDelete(goal.id)}>삭제</button>}<button className="pink-button" type="submit">{goal ? '수정 저장하기' : '목표적금 만들기'}</button></div></form></section></div>
}

function SummaryCard({ label, value, note }) { return <article className="summary-card"><span>{label}</span><strong>{value}</strong><p>{note}</p></article> }
function GoalCard({ goal, onClick }) { const saved = savedAmount(goal); const progress = Math.min(100, Math.round((saved / goal.target) * 100)); return <button className="goal-card" onClick={onClick}><span className="goal-icon">✈</span><strong>{goal.name}</strong><small>{formatMoney(saved)} / {formatMoney(goal.target)}</small><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><b>{progress}% 달성</b><em>페이지 열기 →</em></button> }

export default App
