import { useEffect, useMemo, useState } from 'react'

const START_MONTH = '2026-01'
const END_MONTH = '2030-12'
const STORAGE_KEY = 'save-me-planner-v1'
const money = new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 })

const makeMonths = (start = START_MONTH, end = END_MONTH) => {
  const months = []
  const [startYear, startMonth] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  for (let year = startYear; year <= endYear; year += 1) {
    const firstMonth = year === startYear ? startMonth : 1
    const lastMonth = year === endYear ? endMonth : 12
    for (let month = firstMonth; month <= lastMonth; month += 1) {
      months.push(`${year}-${String(month).padStart(2, '0')}`)
    }
  }
  return months
}

const PLAN_MONTHS = makeMonths()
const YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030]
const emptyForm = { name: '', account: '', start: '', end: '', deposit: '', target: '' }

const defaultCategories = () => [
  { id: 'isa', name: 'ISA', account: 'ISA 계좌', start: '2026-01', end: '2030-12', deposit: 500000, target: '' },
  { id: 'youth-future', name: '청년미래적금', account: '청년미래적금', start: '2026-10', end: '2029-09', deposit: 500000, target: '' },
]

const initialState = () => ({ categories: defaultCategories(), checks: {} })
const monthLabel = (month) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`
const yearOf = (month) => Number(month.slice(0, 4))
const currentMonth = () => {
  const now = new Date()
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return PLAN_MONTHS.includes(key) ? key : '2026-10'
}
const isScheduled = (category, month) => month >= (category.start || START_MONTH) && month <= (category.end || END_MONTH)
const checkKey = (categoryId, month) => `${categoryId}:${month}`
const formatMoney = (value) => money.format(Number(value || 0))

function loadSavings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.version === 1 && Array.isArray(saved.categories) && saved.checks) return saved
  } catch {
    // Start with the default plan when browser storage is unavailable or invalid.
  }
  return initialState()
}

function App() {
  const [savings, setSavings] = useState(loadSavings)
  const [view, setView] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear] = useState(Number(currentMonth().slice(0, 4)))
  const [isModalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...savings, version: 1 }))
  }, [savings])

  const allScheduledTotal = useMemo(() => savings.categories.reduce(
    (total, category) => total + PLAN_MONTHS.filter((month) => isScheduled(category, month)).length * Number(category.deposit),
    0,
  ), [savings.categories])

  const checkedTotal = useMemo(() => Object.entries(savings.checks).reduce((total, [key, checked]) => {
    if (!checked) return total
    const [categoryId, month] = key.split(':')
    const category = savings.categories.find((item) => item.id === categoryId)
    return category && isScheduled(category, month) ? total + Number(category.deposit) : total
  }, 0), [savings])

  const overallProgress = allScheduledTotal ? Math.round((checkedTotal / allScheduledTotal) * 100) : 0

  const visibleMonths = useMemo(() => {
    if (view === 'month') return [selectedMonth]
    if (view === 'year') return PLAN_MONTHS.filter((month) => yearOf(month) === selectedYear)
    return PLAN_MONTHS
  }, [view, selectedMonth, selectedYear])

  const toggleCheck = (categoryId, month) => {
    const key = checkKey(categoryId, month)
    setSavings((previous) => ({
      ...previous,
      checks: { ...previous.checks, [key]: !previous.checks[key] },
    }))
  }

  const changeMonth = (direction) => {
    const index = PLAN_MONTHS.indexOf(selectedMonth)
    const next = PLAN_MONTHS[Math.min(Math.max(index + direction, 0), PLAN_MONTHS.length - 1)]
    setSelectedMonth(next)
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (category) => {
    setEditingId(category.id)
    setForm({
      name: category.name,
      account: category.account || '',
      start: category.start === START_MONTH ? '' : category.start,
      end: category.end === END_MONTH ? '' : category.end,
      deposit: String(category.deposit),
      target: category.target ? String(category.target) : '',
    })
    setFormError('')
    setModalOpen(true)
  }

  const submitCategory = (event) => {
    event.preventDefault()
    const deposit = Number(form.deposit.replaceAll(',', ''))
    const target = form.target ? Number(form.target.replaceAll(',', '')) : ''
    if (!form.name.trim()) return setFormError('항목명은 꼭 입력해 주세요.')
    if (!Number.isFinite(deposit) || deposit <= 0) return setFormError('1회 저축액은 0원보다 크게 입력해 주세요.')
    if (form.target && (!Number.isFinite(target) || target < 0)) return setFormError('목표금액을 다시 확인해 주세요.')
    if (form.start && form.end && form.start > form.end) return setFormError('시작월은 종료월보다 앞서야 해요.')

    const category = {
      id: editingId || `category-${Date.now()}`,
      name: form.name.trim(),
      account: form.account.trim(),
      start: form.start || START_MONTH,
      end: form.end || END_MONTH,
      deposit,
      target,
    }
    setSavings((previous) => ({
      ...previous,
      categories: editingId
        ? previous.categories.map((item) => (item.id === editingId ? category : item))
        : [...previous.categories, category],
    }))
    setModalOpen(false)
  }

  const deleteCategory = (id) => {
    if (!window.confirm('이 카테고리와 체크 기록을 지울까요?')) return
    setSavings((previous) => ({
      categories: previous.categories.filter((category) => category.id !== id),
      checks: Object.fromEntries(Object.entries(previous.checks).filter(([key]) => !key.startsWith(`${id}:`))),
    }))
    setModalOpen(false)
  }

  const categoryCheckedTotal = (category) => PLAN_MONTHS.reduce(
    (total, month) => (savings.checks[checkKey(category.id, month)] ? total + Number(category.deposit) : total),
    0,
  )

  return (
    <main className="app-shell">
      <div className="sparkle sparkle-one">✦</div><div className="sparkle sparkle-two">✧</div>
      <header className="hero">
        <div>
          <p className="eyebrow">MY FIVE-YEAR MONEY DIARY</p>
          <h1>Save <em>Me!</em></h1>
          <p className="hero-copy">2026 — 2030 · 나만의 반짝이는 저축 루틴</p>
        </div>
        <button className="add-button" onClick={openAdd}><span>＋</span> 카테고리 추가</button>
      </header>

      <section className="summary-grid" aria-label="전체 저축 현황">
        <article className="summary-card main-summary">
          <div className="summary-top"><span>CHECKED SAVINGS</span><span className="mini-sticker">{overallProgress}%</span></div>
          <strong>{formatMoney(checkedTotal)}</strong>
          <div className="progress-track"><i style={{ width: `${overallProgress}%` }} /></div>
          <p>계획 금액 {formatMoney(allScheduledTotal)} 중</p>
        </article>
        <article className="summary-card small-summary"><span>계획 기간</span><strong>60 <b>months</b></strong><p>2026.01 — 2030.12</p></article>
        <article className="summary-card small-summary aqua"><span>오늘의 한 걸음</span><strong>{Object.values(savings.checks).filter(Boolean).length} <b>checks</b></strong><p>차곡차곡 쌓는 중!</p></article>
      </section>

      <section className="planner-panel">
        <div className="planner-header">
          <div>
            <p className="eyebrow">SAVINGS CHECKLIST</p>
            <h2>저축 체크리스트</h2>
          </div>
          <div className="view-switcher" aria-label="보기 기준">
            {[['month', '매월'], ['year', '매년'], ['all', '전체']].map(([value, label]) => (
              <button key={value} className={view === value ? 'active' : ''} onClick={() => setView(value)}>{label}</button>
            ))}
          </div>
        </div>

        {view === 'month' && <div className="date-control">
          <button aria-label="이전 달" onClick={() => changeMonth(-1)}>←</button>
          <strong>{monthLabel(selectedMonth)}</strong>
          <button aria-label="다음 달" onClick={() => changeMonth(1)}>→</button>
        </div>}
        {view === 'year' && <div className="year-tabs">{YEAR_OPTIONS.map((year) => <button key={year} className={selectedYear === year ? 'selected' : ''} onClick={() => setSelectedYear(year)}>{year}</button>)}</div>}

        <div className={`schedule ${view === 'all' ? 'all-schedule' : ''}`}>
          {view === 'all'
            ? YEAR_OPTIONS.map((year) => <YearBlock key={year} year={year} months={PLAN_MONTHS.filter((month) => yearOf(month) === year)} categories={savings.categories} checks={savings.checks} onToggle={toggleCheck} />)
            : visibleMonths.map((month) => <MonthCard key={month} month={month} categories={savings.categories} checks={savings.checks} onToggle={toggleCheck} />)}
        </div>
      </section>

      <section className="categories-section">
        <div className="section-title"><div><p className="eyebrow">MY POCKETS</p><h2>카테고리별 목표</h2></div><button className="text-button" onClick={openAdd}>새 항목 만들기 ↗</button></div>
        <div className="category-grid">
          {savings.categories.map((category, index) => {
            const saved = categoryCheckedTotal(category)
            const targetPercent = category.target ? Math.min(100, Math.round((saved / category.target) * 100)) : null
            return <article className={`category-card card-${index % 3}`} key={category.id}>
              <button className="edit-button" onClick={() => openEdit(category)} aria-label={`${category.name} 편집`}>•••</button>
              <span className="category-orb">{index === 0 ? '✦' : index === 1 ? '♥' : '☻'}</span>
              <h3>{category.name}</h3>
              <p>{category.account || '연결된 계좌/상품 없음'}</p>
              <strong>{formatMoney(saved)}</strong>
              <small>{category.target ? `목표 ${formatMoney(category.target)} · ${targetPercent}%` : `매회 ${formatMoney(category.deposit)}`}</small>
              {category.target && <div className="category-progress"><i style={{ width: `${targetPercent}%` }} /></div>}
            </article>
          })}
          <button className="empty-category" onClick={openAdd}><span>＋</span><b>새 저축 주머니</b><small>나만의 목표를 추가해요</small></button>
        </div>
      </section>

      {isModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
        <section className="category-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <button className="close-button" onClick={() => setModalOpen(false)} aria-label="닫기">×</button>
          <p className="eyebrow">MY NEW POCKET</p><h2 id="modal-title">{editingId ? '카테고리 편집' : '새 카테고리 만들기'}</h2>
          <form onSubmit={submitCategory}>
            <label>항목명 <b>필수</b><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="예: 여행 적금" autoFocus /></label>
            <label>계좌번호 또는 상품명<input value={form.account} onChange={(event) => setForm({ ...form, account: event.target.value })} placeholder="예: 카카오뱅크 세이프박스" /></label>
            <div className="form-row"><label>시작월 <small>선택</small><input type="month" min={START_MONTH} max={END_MONTH} value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} /></label><label>종료월 <small>선택</small><input type="month" min={START_MONTH} max={END_MONTH} value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} /></label></div>
            <label>1회 저축액 <b>필수</b><input inputMode="numeric" value={form.deposit} onChange={(event) => setForm({ ...form, deposit: event.target.value })} placeholder="예: 100000" /></label>
            <label>목표금액 <small>선택</small><input inputMode="numeric" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })} placeholder="예: 3000000" /></label>
            {formError && <p className="form-error">✦ {formError}</p>}
            <div className="modal-actions">{editingId && <button type="button" className="delete-button" onClick={() => deleteCategory(editingId)}>삭제</button>}<button type="submit" className="save-button">{editingId ? '저장하기' : '카테고리 추가'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  )
}

function YearBlock({ year, months, categories, checks, onToggle }) {
  const total = months.reduce((sum, month) => sum + categories.reduce((monthSum, category) => monthSum + (checks[checkKey(category.id, month)] ? Number(category.deposit) : 0), 0), 0)
  return <section className="year-block"><div className="year-block-title"><h3>{year}</h3><span>{formatMoney(total)} saved</span></div><div className="year-months">{months.map((month) => <MonthCard key={month} compact month={month} categories={categories} checks={checks} onToggle={onToggle} />)}</div></section>
}

function MonthCard({ month, categories, checks, onToggle, compact = false }) {
  const scheduled = categories.filter((category) => isScheduled(category, month))
  const total = scheduled.reduce((sum, category) => sum + (checks[checkKey(category.id, month)] ? Number(category.deposit) : 0), 0)
  return <article className={`month-card ${compact ? 'compact' : ''}`}>
    <div className="month-card-heading"><div><span>{month.slice(0, 4)}</span><h3>{Number(month.slice(5))}월</h3></div><strong>{formatMoney(total)}</strong></div>
    {scheduled.length ? <div className="check-list">{scheduled.map((category) => {
      const checked = Boolean(checks[checkKey(category.id, month)])
      return <button key={category.id} className={`check-item ${checked ? 'checked' : ''}`} onClick={() => onToggle(category.id, month)} aria-pressed={checked}>
        <span className="check-circle">{checked && '✓'}</span><span className="item-name">{category.name}<small>{category.account}</small></span><b>{formatMoney(category.deposit)}</b>
      </button>
    })}</div> : <p className="empty-state">이 달에 예정된 저축이 없어요.</p>}
  </article>
}

export default App
