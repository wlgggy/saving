import { useEffect, useMemo, useRef, useState } from "react";
import profileFrog from "./assets/profile-frog.png";
import pixelAngelWingLeft from "./assets/pixel-angel-wing-left.png";
import pixelClouds from "./assets/pixel-clouds.png";
import { isSupabaseConfigured } from "./lib/supabase";
import { loadPlanner, savePlanner } from "./lib/plannerRepository";

const START_MONTH = "2026-01";
const END_MONTH = "2030-12";
const STORAGE_KEY = "save-me-planner-v1";
const money = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

const makeMonths = (start = START_MONTH, end = END_MONTH) => {
  const months = [];
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  for (let year = startYear; year <= endYear; year += 1) {
    const firstMonth = year === startYear ? startMonth : 1;
    const lastMonth = year === endYear ? endMonth : 12;
    for (let month = firstMonth; month <= lastMonth; month += 1) {
      months.push(`${year}-${String(month).padStart(2, "0")}`);
    }
  }
  return months;
};

const PLAN_MONTHS = makeMonths();
const YEAR_OPTIONS = [2026, 2027, 2028, 2029, 2030];
const FIXED_PLAN_TOTAL = 100000000;
const emptyForm = {
  name: "",
  account: "",
  start: "",
  end: "",
  travelDate: "",
  deposit: "",
  target: "",
  menuPage: false,
};
const DEFAULT_SETTINGS = {
  nickname: "coco",
  bio: "오늘도 귀엽게 저축하는 중 .ᐟ",
  profileImage: "",
  spotifyUrl:
    "https://open.spotify.com/track/2Lqdqm1ql2AWdEgLjwirN4?si=94058eaad1d8490f",
};

const defaultCategories = () => [
  {
    id: "isa",
    name: "ISA",
    account: "ISA 계좌",
    start: "2026-01",
    end: "2030-12",
    deposit: 500000,
    target: "",
  },
  {
    id: "youth-future",
    name: "청년미래적금",
    account: "청년미래적금",
    start: "2026-10",
    end: "2029-09",
    deposit: 500000,
    target: "",
  },
];

const initialState = () => ({
  categories: defaultCategories(),
  checks: {},
  settings: { ...DEFAULT_SETTINGS },
});
const monthLabel = (month) =>
  `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
const yearOf = (month) => Number(month.slice(0, 4));
const currentMonth = () => {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return PLAN_MONTHS.includes(key) ? key : "2026-10";
};
const isPeriodFree = (category) => !category.start && !category.end;
const isScheduled = (category, month) => {
  if (category.manualMonths?.includes(month)) return true;
  if (isPeriodFree(category)) return false;
  return (
    month >= (category.start || START_MONTH) &&
    month <= (category.end || END_MONTH)
  );
};
const checkKey = (categoryId, month) => `${categoryId}:${month}`;
const formatMoney = (value) => money.format(Number(value || 0));
const isMenuCategory = (category) => Boolean(category.menuPage);
const isTravelGoalName = (name) => name.includes("여행적금");
const displayTravelName = (name) => name || "여행";
const formatAmountInput = (value) =>
  value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const spotifyEmbedUrl = (url) => {
  const trackId = url?.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/)?.[1];
  return `https://open.spotify.com/embed/track/${trackId || "2Lqdqm1ql2AWdEgLjwirN4"}?utm_source=generator`;
};

function loadSavings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1 && Array.isArray(saved.categories) && saved.checks)
      return normalizeSavings(saved);
  } catch {
    // Start with the default plan when browser storage is unavailable or invalid.
  }
  return initialState();
}

function normalizeSavings(saved) {
  return {
    ...saved,
    categories: saved.categories.map((category) => ({
      ...category,
      manualMonths: category.manualMonths || [],
      menuPage: category.menuPage ?? Boolean(category.travel),
    })),
    settings: { ...DEFAULT_SETTINGS, ...(saved.settings || {}) },
  };
}

function App() {
  const [savings, setSavings] = useState(loadSavings);
  const [view, setView] = useState("month");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(
    Number(currentMonth().slice(0, 4)),
  );
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [activeTravelId, setActiveTravelId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState(
    isSupabaseConfigured ? "loading" : "local",
  );
  const saveQueue = useRef(Promise.resolve());
  const skipNextCloudSave = useRef(false);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...savings, version: 1 }),
    );
  }, [savings]);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;

    const loadCloudState = async () => {
      try {
        const cloudSavings = await loadPlanner(DEFAULT_SETTINGS);
        if (cloudSavings && active) setSavings(normalizeSavings(cloudSavings));
        if (active) {
          setCloudReady(true);
          setSyncStatus("saved");
        }
      } catch (error) {
        if (active) setSyncStatus("error");
        console.error("Supabase planner load failed:", error.message);
      }
    };

    loadCloudState();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!cloudReady || !isSupabaseConfigured) return undefined;
    if (skipNextCloudSave.current) {
      skipNextCloudSave.current = false;
      return undefined;
    }
    setSyncStatus("saving");
    const saveTimer = window.setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => savePlanner(savings))
        .then(() => setSyncStatus("saved"))
        .catch((error) => {
          setSyncStatus("error");
          console.error("Supabase planner save failed:", error.message);
        });
    }, 600);

    return () => window.clearTimeout(saveTimer);
  }, [cloudReady, savings]);

  const syncLabel = {
    loading: "클라우드 불러오는 중",
    saving: "클라우드 저장 중",
    saved: "클라우드 동기화됨",
    error: "동기화 설정 필요",
    local: "기기 내 저장 중",
  }[syncStatus];

  const checkedTotal = useMemo(
    () =>
      Object.entries(savings.checks).reduce((total, [key, checked]) => {
        if (!checked) return total;
        const [categoryId, month] = key.split(":");
        const category = savings.categories.find(
          (item) => item.id === categoryId,
        );
        return category && isScheduled(category, month)
          ? total + Number(category.deposit)
          : total;
      }, 0),
    [savings],
  );

  const overallProgress = Math.round((checkedTotal / FIXED_PLAN_TOTAL) * 100);
  const travelCategories = useMemo(
    () => savings.categories.filter((category) => isMenuCategory(category)),
    [savings.categories],
  );
  const checklistCategories = useMemo(
    () => savings.categories.filter((category) => !isMenuCategory(category)),
    [savings.categories],
  );
  const activeTravel = travelCategories.find(
    (category) => category.id === activeTravelId,
  );

  const visibleMonths = useMemo(() => {
    if (view === "month") return [selectedMonth];
    if (view === "year")
      return PLAN_MONTHS.filter((month) => yearOf(month) === selectedYear);
    return PLAN_MONTHS;
  }, [view, selectedMonth, selectedYear]);

  const toggleCheck = (categoryId, month) => {
    const key = checkKey(categoryId, month);
    setSavings((previous) => ({
      ...previous,
      checks: { ...previous.checks, [key]: !previous.checks[key] },
    }));
  };

  const changeMonth = (direction) => {
    const index = PLAN_MONTHS.indexOf(selectedMonth);
    const next =
      PLAN_MONTHS[
        Math.min(Math.max(index + direction, 0), PLAN_MONTHS.length - 1)
      ];
    setSelectedMonth(next);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      account: category.account || "",
      start: category.start === START_MONTH ? "" : category.start,
      end: category.end === END_MONTH ? "" : category.end,
      travelDate: category.travelDate || "",
      deposit: category.deposit
        ? formatAmountInput(String(category.deposit))
        : "",
      target: category.target ? formatAmountInput(String(category.target)) : "",
      menuPage: Boolean(category.menuPage),
    });
    setFormError("");
    setModalOpen(true);
  };

  const submitCategory = (event) => {
    event.preventDefault();
    if (isSupabaseConfigured && !cloudReady)
      return setFormError("클라우드 데이터를 불러오는 중이에요. 잠시 후 다시 저장해 주세요.");
    const isTravelGoal = isTravelGoalName(form.name);
    const deposit = isTravelGoal
      ? 0
      : form.deposit
        ? Number(form.deposit.replaceAll(",", ""))
        : 0;
    const target = form.target ? Number(form.target.replaceAll(",", "")) : "";
    if (!form.name.trim()) return setFormError("항목명은 꼭 입력해 주세요.");
    if (!isTravelGoal && (!Number.isFinite(deposit) || deposit < 0))
      return setFormError("1회 저축액을 다시 확인해 주세요.");
    if (form.target && (!Number.isFinite(target) || target < 0))
      return setFormError("목표금액을 다시 확인해 주세요.");
    if (!isTravelGoal && form.start && form.end && form.start > form.end)
      return setFormError("시작월은 종료월보다 앞서야 해요.");
    if (form.menuPage && (!Number.isFinite(target) || target <= 0))
      return setFormError(
        isTravelGoalName(form.name)
          ? "여행 예산을 입력해 주세요."
          : "목표 금액을 입력해 주세요.",
      );

    const category = {
      id: editingId || `category-${Date.now()}`,
      name: form.name.trim(),
      account: form.account.trim(),
      start: isTravelGoal ? "" : form.start,
      end: isTravelGoal ? "" : form.end,
      travelDate: isTravelGoal ? form.travelDate : "",
      deposit,
      target,
      manualMonths: editingId
        ? savings.categories.find((item) => item.id === editingId)
            ?.manualMonths || []
        : [],
      menuPage: form.menuPage,
      travel: form.menuPage
        ? {
            budget: target,
            deposits: editingId
              ? savings.categories.find((item) => item.id === editingId)?.travel
                  ?.deposits || []
              : [],
          }
        : undefined,
    };
    const nextSavings = {
      ...savings,
      categories: editingId
        ? savings.categories.map((item) =>
            item.id === editingId ? category : item,
          )
        : [...savings.categories, category],
    };
    setSavings(nextSavings);
    if (isSupabaseConfigured) {
      skipNextCloudSave.current = true;
      setSyncStatus("saving");
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(() => savePlanner(nextSavings))
        .then(() => setSyncStatus("saved"))
        .catch((error) => {
          setSyncStatus("error");
          console.error("Supabase category save failed:", error.message);
        });
    }
    setModalOpen(false);
  };

  const deleteCategory = (id) => {
    if (!window.confirm("이 카테고리와 체크 기록을 지울까요?")) return;
    setSavings((previous) => ({
      ...previous,
      categories: previous.categories.filter((category) => category.id !== id),
      checks: Object.fromEntries(
        Object.entries(previous.checks).filter(
          ([key]) => !key.startsWith(`${id}:`),
        ),
      ),
    }));
    setModalOpen(false);
  };

  const moveCategory = (id, direction) => {
    setSavings((previous) => {
      const fromIndex = previous.categories.findIndex(
        (category) => category.id === id,
      );
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= previous.categories.length)
        return previous;
      const categories = [...previous.categories];
      [categories[fromIndex], categories[toIndex]] = [
        categories[toIndex],
        categories[fromIndex],
      ];
      return { ...previous, categories };
    });
  };

  const categoryCheckedTotal = (category) =>
    PLAN_MONTHS.reduce(
      (total, month) =>
        savings.checks[checkKey(category.id, month)]
          ? total + Number(category.deposit)
          : total,
      0,
    );

  const addTravelDeposit = (categoryId, input) => {
    const amount = Number(input.amount.replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount <= 0)
      return "금액을 0원보다 크게 입력해 주세요.";
    const category = savings.categories.find((item) => item.id === categoryId);
    const currentSaved = (category?.travel?.deposits || []).reduce(
      (total, deposit) =>
        total +
        (deposit.kind === "withdrawal" ? -deposit.amount : deposit.amount),
      0,
    );
    if (input.kind === "withdrawal" && amount > currentSaved)
      return "현재 모은 금액보다 큰 출금액은 기록할 수 없어요.";
    setSavings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              travel: {
                ...category.travel,
                deposits: [
                  {
                    id: `travel-deposit-${Date.now()}`,
                    date: input.date,
                    amount,
                    kind: input.kind,
                    memo: input.memo.trim(),
                  },
                  ...(category.travel?.deposits || []),
                ],
              },
            }
          : category,
      ),
    }));
    return "";
  };

  const removeTravelDeposit = (categoryId, depositId) =>
    setSavings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) =>
        category.id === categoryId
          ? {
              ...category,
              travel: {
                ...category.travel,
                deposits: (category.travel?.deposits || []).filter(
                  (deposit) => deposit.id !== depositId,
                ),
              },
            }
          : category,
      ),
    }));

  const saveSettings = (settings) =>
    setSavings((previous) => ({
      ...previous,
      settings: { ...previous.settings, ...settings },
    }));
  const resetCategoryPeriods = () => {
    if (
      !window.confirm(
        "모든 카테고리의 기간을 2026년 1월부터 2030년 12월로 초기화할까요?",
      )
    )
      return;
    setSavings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) => ({
        ...category,
        start: START_MONTH,
        end: END_MONTH,
      })),
    }));
  };
  const resetCategoryTargets = () => {
    if (
      !window.confirm(
        "모든 카테고리의 목표금액과 여행적금 예산을 초기화할까요?",
      )
    )
      return;
    setSavings((previous) => ({
      ...previous,
      categories: previous.categories.map((category) => ({
        ...category,
        target: "",
        travel: category.travel ? { ...category.travel, budget: 0 } : undefined,
      })),
    }));
  };

  return (
    <div className="retro-desktop">
      <img
        className="pixel-clouds"
        src={pixelClouds}
        alt=""
        aria-hidden="true"
      />
      <div className="desktop-decor decor-star">★</div>
      <img
        className="pixel-wing pixel-wing-left"
        src={pixelAngelWingLeft}
        alt=""
        aria-hidden="true"
      />
      <img
        className="pixel-wing pixel-wing-right"
        src={pixelAngelWingLeft}
        alt=""
        aria-hidden="true"
      />
      <div className="window-shell">
        <div className="window-titlebar">
          <span>₩ SAVE ME.exe — 저축 관리 프로그램</span>
          <div className="window-controls" aria-hidden="true">
            <i>_</i>
            <i>□</i>
            <i>×</i>
          </div>
        </div>
        <aside className="sidebar">
          <div className="brand">
            <b>₩</b>
            <span>MY 저축 플래너</span>
          </div>
          <section className="profile-card" aria-label="프로필">
            <img
              src={savings.settings?.profileImage || profileFrog}
              alt="프로필"
            />
            <div>
              <strong>{savings.settings?.nickname || "coco"}</strong>
              <span>saving archive ★</span>
            </div>
            <p>{savings.settings?.bio || DEFAULT_SETTINGS.bio}</p>
          </section>
          <nav aria-label="저축 메뉴">
            <button
              className={`nav-item ${!activeTravelId && !showSettings ? "active" : ""}`}
              onClick={() => {
                setActiveTravelId(null);
                setShowSettings(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span>▣</span> 대시보드
            </button>
            {travelCategories.map((category) => (
              <button
                key={category.id}
                className={`nav-item travel-nav ${activeTravelId === category.id ? "active" : ""}`}
                onClick={() => {
                  setActiveTravelId(category.id);
                  setShowSettings(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <span>{isTravelGoalName(category.name) ? "✈" : "₩"}</span>{" "}
                {displayTravelName(category.name)}
              </button>
            ))}
            <button
              className={`nav-item ${showSettings ? "active" : ""}`}
              onClick={() => {
                setActiveTravelId(null);
                setShowSettings(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <span>⚙</span> 설정
            </button>
          </nav>
          <section className="music-card" aria-label="지금 듣는 노래">
            <p>NOW PLAYING ♫</p>
            <iframe
              title="Spotify track player"
              src={spotifyEmbedUrl(savings.settings?.spotifyUrl)}
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            />
          </section>
          <div className="sidebar-bottom">
            <small>저장 위치</small>
            <b>{isSupabaseConfigured ? "Supabase" : "이 브라우저"}</b>
            <span>● {syncLabel}</span>
          </div>
        </aside>
        <main className="app-shell">
          {showSettings ? (
            <SettingsPage
              settings={savings.settings}
              onSave={saveSettings}
              onResetPeriods={resetCategoryPeriods}
              onResetTargets={resetCategoryTargets}
            />
          ) : activeTravel ? (
            <TravelSavingsPage
              category={activeTravel}
              onBack={() => setActiveTravelId(null)}
              onAddDeposit={addTravelDeposit}
              onRemoveDeposit={removeTravelDeposit}
            />
          ) : (
            <>
              <header className="hero">
                <div>
                  <p className="eyebrow">MY FIVE-YEAR MONEY DIARY</p>
                  <h1>
                    Save <em>Me!</em>
                  </h1>
                  <p className="hero-copy">
                    2026 — 2030 · 나만의 반짝이는 저축 루틴
                  </p>
                </div>
                <button className="add-button" onClick={openAdd}>
                  <span>＋</span> 카테고리 추가
                </button>
              </header>

              <section className="summary-grid" aria-label="전체 저축 현황">
                <article className="summary-card main-summary">
                  <div className="summary-top">
                    <span>CHECKED SAVINGS</span>
                    <span className="mini-sticker">{overallProgress}%</span>
                  </div>
                  <strong>{formatMoney(checkedTotal)}</strong>
                  <div className="progress-track">
                    <i style={{ width: `${overallProgress}%` }} />
                  </div>
                  <p>계획 금액 {formatMoney(FIXED_PLAN_TOTAL)} 중</p>
                </article>
                <article className="summary-card small-summary">
                  <span>계획 기간</span>
                  <strong>
                    60 <b>months</b>
                  </strong>
                  <p>2026.01 — 2030.12</p>
                </article>
                <article className="summary-card small-summary aqua">
                  <span>오늘의 한 걸음</span>
                  <strong>
                    {Object.values(savings.checks).filter(Boolean).length}{" "}
                    <b>checks</b>
                  </strong>
                  <p>차곡차곡 쌓는 중!</p>
                </article>
              </section>

              <section className="planner-panel">
                <div className="planner-header">
                  <div>
                    <p className="eyebrow">SAVINGS CHECKLIST</p>
                    <h2>저축 체크리스트</h2>
                  </div>
                  <div className="view-switcher" aria-label="보기 기준">
                    {[
                      ["month", "매월"],
                      ["year", "매년"],
                      ["all", "전체"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={view === value ? "active" : ""}
                        onClick={() => setView(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {view === "month" && (
                  <div className="date-control">
                    <button
                      aria-label="이전 달"
                      onClick={() => changeMonth(-1)}
                    >
                      ←
                    </button>
                    <strong>{monthLabel(selectedMonth)}</strong>
                    <button aria-label="다음 달" onClick={() => changeMonth(1)}>
                      →
                    </button>
                  </div>
                )}
                {view === "year" && (
                  <div className="year-tabs">
                    {YEAR_OPTIONS.map((year) => (
                      <button
                        key={year}
                        className={selectedYear === year ? "selected" : ""}
                        onClick={() => setSelectedYear(year)}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                )}

                <div
                  className={`schedule ${view === "all" ? "all-schedule" : ""}`}
                >
                  {view === "all"
                    ? YEAR_OPTIONS.map((year) => (
                        <YearBlock
                          key={year}
                          year={year}
                          months={PLAN_MONTHS.filter(
                            (month) => yearOf(month) === year,
                          )}
                          categories={checklistCategories}
                          checks={savings.checks}
                          onToggle={toggleCheck}
                        />
                      ))
                    : visibleMonths.map((month) => (
                        <MonthCard
                          key={month}
                          month={month}
                          categories={checklistCategories}
                          checks={savings.checks}
                          onToggle={toggleCheck}
                        />
                      ))}
                </div>
              </section>

              <section className="categories-section">
                <div className="section-title">
                  <div>
                    <p className="eyebrow">MY POCKETS</p>
                    <h2>카테고리별 목표</h2>
                  </div>
                  <button className="text-button" onClick={openAdd}>
                    새 항목 만들기 ↗
                  </button>
                </div>
                <div className="category-grid">
                  {savings.categories.map((category, index) => {
                    const saved = categoryCheckedTotal(category);
                    const targetPercent = category.target
                      ? Math.min(
                          100,
                          Math.round((saved / category.target) * 100),
                        )
                      : null;
                    return (
                      <article
                        className={`category-card card-${index % 3}`}
                        key={category.id}
                      >
                        <div
                          className="category-order"
                          aria-label="카테고리 순서"
                        >
                          <button
                            type="button"
                            onClick={() => moveCategory(category.id, -1)}
                            disabled={index === 0}
                            aria-label="카테고리 위로 이동"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCategory(category.id, 1)}
                            disabled={index === savings.categories.length - 1}
                            aria-label="카테고리 아래로 이동"
                          >
                            ↓
                          </button>
                        </div>
                        <button
                          className="edit-button"
                          onClick={() => openEdit(category)}
                          aria-label={`${category.name} 편집`}
                        >
                          -
                        </button>
                        <span className="category-orb">
                          {isTravelGoalName(category.name) ? "✈" : "★"}
                        </span>
                        <h3>{category.name}</h3>
                        <p>{category.account || "연결된 계좌/상품 없음"}</p>
                        <strong>{formatMoney(saved)}</strong>
                        <small>
                          {category.target
                            ? `목표 ${formatMoney(category.target)} · ${targetPercent}%`
                            : `매회 ${formatMoney(category.deposit)}`}
                        </small>
                        {category.target && (
                          <div className="category-progress">
                            <i style={{ width: `${targetPercent}%` }} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                  <button className="empty-category" onClick={openAdd}>
                    <span>＋</span>
                    <b>새 저축 주머니</b>
                    <small>나만의 목표를 추가해요</small>
                  </button>
                </div>
              </section>

              {isModalOpen && (
                <div
                  className="modal-backdrop"
                  role="presentation"
                  onMouseDown={() => setModalOpen(false)}
                >
                  <section
                    className="category-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <button
                      className="close-button"
                      onClick={() => setModalOpen(false)}
                      aria-label="닫기"
                    >
                      ×
                    </button>
                    <div className="modal-titlebar">
                      <h2 id="modal-title">
                        {editingId ? "카테고리 편집" : "새 카테고리 만들기"}
                      </h2>
                    </div>
                    <form onSubmit={submitCategory}>
                      <label>
                        항목명 <b>필수</b>
                        <input
                          value={form.name}
                          onChange={(event) =>
                            setForm({ ...form, name: event.target.value })
                          }
                          autoFocus
                        />
                      </label>
                      <label>
                        계좌번호 또는 상품명
                        <input
                          value={form.account}
                          onChange={(event) =>
                            setForm({ ...form, account: event.target.value })
                          }
                        />
                      </label>
                      {isTravelGoalName(form.name) ? (
                        <label>
                          여행일자
                          <input
                            type="date"
                            value={form.travelDate}
                            onChange={(event) =>
                              setForm({ ...form, travelDate: event.target.value })
                            }
                          />
                        </label>
                      ) : (
                        <div className="form-row">
                          <label>
                            시작월
                            <input
                              type="month"
                              min={START_MONTH}
                              max={END_MONTH}
                              value={form.start}
                              onChange={(event) =>
                                setForm({ ...form, start: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            종료월
                            <input
                              type="month"
                              min={START_MONTH}
                              max={END_MONTH}
                              value={form.end}
                              onChange={(event) =>
                                setForm({ ...form, end: event.target.value })
                              }
                            />
                          </label>
                        </div>
                      )}
                      <label className={isTravelGoalName(form.name) ? "disabled-field" : ""}>
                        1회 저축액
                        <input
                          inputMode="numeric"
                          value={isTravelGoalName(form.name) ? "" : form.deposit}
                          disabled={isTravelGoalName(form.name)}
                          placeholder={
                            isTravelGoalName(form.name)
                              ? "입출금 기록으로 관리"
                              : undefined
                          }
                          onChange={(event) =>
                            setForm({
                              ...form,
                              deposit: formatAmountInput(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        {form.menuPage
                          ? isTravelGoalName(form.name)
                            ? "여행 예산"
                            : "목표금액"
                          : "목표금액"}
                        {form.menuPage && <small>필수</small>}
                        <input
                          inputMode="numeric"
                          value={form.target}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              target: formatAmountInput(event.target.value),
                            })
                          }
                        />
                      </label>
                      {formError && <p className="form-error">✦ {formError}</p>}
                      <div className="modal-actions">
                        <label className="menu-checkbox">
                          <input
                            type="checkbox"
                            checked={form.menuPage}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                menuPage: event.target.checked,
                              })
                            }
                          />
                          메뉴에 추가
                        </label>
                        <div className="modal-buttons">
                          {editingId && (
                            <button
                              type="button"
                              className="delete-button"
                              onClick={() => deleteCategory(editingId)}
                            >
                              삭제
                            </button>
                          )}
                          <button type="submit" className="save-button">
                            {editingId ? "저장하기" : "카테고리 추가"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function TravelSavingsPage({
  category,
  onBack,
  onAddDeposit,
  onRemoveDeposit,
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    memo: "",
    kind: "",
  });
  const [error, setError] = useState("");
  const deposits = category.travel?.deposits || [];
  const budget = Number(category.travel?.budget || category.target || 0);
  const isTravelGoal = isTravelGoalName(category.name);
  const saved = deposits.reduce(
    (total, deposit) =>
      total +
      (deposit.kind === "withdrawal"
        ? -Number(deposit.amount)
        : Number(deposit.amount)),
    0,
  );
  const remaining = Math.max(0, budget - saved);
  const progress = budget
    ? Math.min(100, Math.round((saved / budget) * 100))
    : 0;
  const submit = (event) => {
    event.preventDefault();
    if (!form.kind) return setError("입금 또는 출금을 선택해 주세요.");
    const result = onAddDeposit(category.id, form);
    if (result) return setError(result);
    setError("");
    setForm({
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      memo: "",
      kind: "",
    });
  };

  return (
    <section className="travel-page">
      <header className="travel-page-header">
        <div>
          <button className="back-button" onClick={onBack}>
            ← 대시보드
          </button>
          <p className="eyebrow">
            {isTravelGoal ? "TRAVEL SAVINGS PAGE" : "SAVINGS PAGE"}
          </p>
          <h1>
            {displayTravelName(category.name)}{" "}
            <em>{isTravelGoal ? "여행적금" : "저축 목표"}</em>
          </h1>
          <p>
            {isTravelGoal
              ? "여행을 향해 오늘도 한 칸 더 가까이."
              : "목표를 향해 오늘도 한 칸 더 가까이."}
          </p>
        </div>
      </header>
      <section className="travel-summary">
        <article className="travel-progress">
          <span>
            {isTravelGoal ? "여행 예산" : "목표 금액"} {formatMoney(budget)}
          </span>
          <strong>{formatMoney(saved)}</strong>
          <p>현재까지 모은 금액</p>
          <div className="progress-track">
            <i style={{ width: `${progress}%` }} />
          </div>
          <b>{progress}% complete</b>
        </article>
        <article className="travel-remaining">
          <span>남은 금액</span>
          <strong>{formatMoney(remaining)}</strong>
          <p>
            {remaining === 0
              ? isTravelGoal
                ? "목표 달성! 여행 갈 준비 끝 ✦"
                : "목표 달성! 준비 끝 ✦"
              : "다음 입금으로 조금 더 가까워져요."}
          </p>
        </article>
      </section>
      <section className="travel-grid">
        <article className="travel-panel">
          <div className="travel-panel-title">
            <h2>＋ 입출금 기록하기</h2>
            <span>NEW TRANSACTION</span>
          </div>
          <form className="travel-deposit-form" onSubmit={submit}>
            <fieldset className="transaction-type-picker">
              <legend>
                구분 <small>필수</small>
              </legend>
              <div>
                <button
                  type="button"
                  className={form.kind === "deposit" ? "selected" : ""}
                  onClick={() => setForm({ ...form, kind: "deposit" })}
                >
                  ＋ 입금
                </button>
                <button
                  type="button"
                  className={
                    form.kind === "withdrawal"
                      ? "selected withdrawal"
                      : "withdrawal"
                  }
                  onClick={() => setForm({ ...form, kind: "withdrawal" })}
                >
                  − 출금
                </button>
              </div>
            </fieldset>
            <label>
              기록 날짜
              <input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm({ ...form, date: event.target.value })
                }
              />
            </label>
            <label>
              {form.kind === "withdrawal"
                ? "출금액"
                : form.kind === "deposit"
                  ? "입금액"
                  : "금액"}
              <input
                inputMode="numeric"
                value={form.amount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    amount: formatAmountInput(event.target.value),
                  })
                }
              />
            </label>
            <label>
              메모
              <input
                value={form.memo}
                onChange={(event) =>
                  setForm({ ...form, memo: event.target.value })
                }
              />
            </label>
            {error && <p className="form-error">✦ {error}</p>}
            <button className="save-button" type="submit">
              {form.kind === "withdrawal"
                ? "출금 기록 추가"
                : form.kind === "deposit"
                  ? "입금 기록 추가"
                  : "기록 추가"}
            </button>
          </form>
        </article>
        <article className="travel-panel">
          <div className="travel-panel-title">
            <h2>▤ 입출금 히스토리</h2>
            <span>{deposits.length} records</span>
          </div>
          {deposits.length ? (
            <div className="travel-deposit-list">
              {deposits.map((deposit) => (
                <div
                  className={`travel-deposit-row ${deposit.kind === "withdrawal" ? "withdrawal" : ""}`}
                  key={deposit.id}
                >
                  <div>
                    <strong>{deposit.date}</strong>
                    <span>
                      {deposit.memo ||
                        (deposit.kind === "withdrawal"
                          ? "출금 기록"
                          : "입금 기록")}
                    </span>
                  </div>
                  <b>
                    {deposit.kind === "withdrawal" ? "− " : "+ "}
                    {formatMoney(deposit.amount)}
                  </b>
                  <button
                    onClick={() => onRemoveDeposit(category.id, deposit.id)}
                    aria-label="입출금 기록 삭제"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="travel-empty">
              아직 입출금 기록이 없어요.
              <br />첫 저축을 추가해 볼까요?
            </p>
          )}
        </article>
      </section>
    </section>
  );
}

function SettingsPage({ settings, onSave, onResetPeriods, onResetTargets }) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState("");
  const updatePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024)
      return setMessage("사진은 2MB 이하로 선택해 주세요.");
    const reader = new FileReader();
    reader.onload = () =>
      setForm((previous) => ({ ...previous, profileImage: reader.result }));
    reader.readAsDataURL(file);
  };
  const submit = (event) => {
    event.preventDefault();
    onSave(form);
    setMessage("설정을 저장했어요!");
  };
  return (
    <section className="settings-page">
      <header className="travel-page-header">
        <div>
          <p className="eyebrow">PERSONALIZE MY SPACE</p>
          <h1>
            설정 <em>페이지</em>
          </h1>
          <p>왼쪽 미니 블로그를 나답게 꾸며요.</p>
        </div>
      </header>
      <section className="settings-panel">
        <div className="travel-panel-title">
          <h2>⚙ 프로필 & 음악 설정</h2>
        </div>
        <form onSubmit={submit}>
          <div className="settings-photo">
            <img src={form.profileImage || profileFrog} alt="프로필 미리보기" />
            <label className="photo-upload">
              사진 선택
              <input type="file" accept="image/*" onChange={updatePhoto} />
            </label>
            {form.profileImage && (
              <button
                type="button"
                className="photo-reset"
                onClick={() =>
                  setForm((previous) => ({ ...previous, profileImage: "" }))
                }
              >
                기본 사진으로
              </button>
            )}
          </div>
          <label>
            닉네임
            <input
              value={form.nickname}
              onChange={(event) =>
                setForm({ ...form, nickname: event.target.value })
              }
              placeholder="닉네임"
            />
          </label>
          <label>
            한 줄 소개
            <input
              value={form.bio}
              onChange={(event) =>
                setForm({ ...form, bio: event.target.value })
              }
              placeholder="소개 문구"
            />
          </label>
          <label>
            Spotify 곡 링크
            <input
              value={form.spotifyUrl}
              onChange={(event) =>
                setForm({ ...form, spotifyUrl: event.target.value })
              }
              placeholder="https://open.spotify.com/track/..."
            />
          </label>
          {message && <p className="settings-message">✦ {message}</p>}
          <button className="save-button" type="submit">
            설정 저장하기
          </button>
        </form>
      </section>
      <section className="settings-panel reset-panel">
        <div className="travel-panel-title">
          <h2>↻ 카테고리 데이터 초기화</h2>
        </div>
        <div className="reset-options">
          <div>
            <strong>기간 초기화</strong>
            <p>모든 기간을 2026.01 — 2030.12로 되돌려요.</p>
            <button
              type="button"
              className="soft-reset-button"
              onClick={onResetPeriods}
            >
              기간 초기화
            </button>
          </div>
          <div>
            <strong>목표금액 초기화</strong>
            <p>목표금액과 여행적금 예산만 지워요. 기록은 유지돼요.</p>
            <button
              type="button"
              className="soft-reset-button danger-reset"
              onClick={onResetTargets}
            >
              목표금액 초기화
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

function YearBlock({ year, months, categories, checks, onToggle }) {
  const total = months.reduce(
    (sum, month) =>
      sum +
      categories.reduce(
        (monthSum, category) =>
          monthSum +
          (isScheduled(category, month) && checks[checkKey(category.id, month)]
            ? Number(category.deposit)
            : 0),
        0,
      ),
    0,
  );
  return (
    <section className="year-block">
      <div className="year-block-title">
        <h3>{year}</h3>
        <span>저금 총액 {formatMoney(total)}</span>
      </div>
      <div className="year-months">
        {months.map((month) => (
          <MonthCard
            key={month}
            compact
            month={month}
            categories={categories}
            checks={checks}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  );
}

function MonthCard({
  month,
  categories,
  checks,
  onToggle,
  compact = false,
}) {
  const scheduled = categories.filter((category) =>
    isScheduled(category, month),
  );
  const total = scheduled.reduce(
    (sum, category) =>
      sum +
      (checks[checkKey(category.id, month)] ? Number(category.deposit) : 0),
    0,
  );
  return (
    <article className={`month-card ${compact ? "compact" : ""}`}>
      <div className="month-card-heading">
        <div>
          <span>{month.slice(0, 4)}</span>
          <h3>{Number(month.slice(5))}월</h3>
        </div>
        <strong>{formatMoney(total)}</strong>
      </div>
      {scheduled.length ? (
        <div className="check-list">
          {scheduled.map((category) => {
            const checked = Boolean(checks[checkKey(category.id, month)]);
            return (
              <button
                key={category.id}
                className={`check-item ${checked ? "checked" : ""}`}
                onClick={() => onToggle(category.id, month)}
                aria-pressed={checked}
              >
                <span className="check-circle">{checked && "✓"}</span>
                <span className="item-name">
                  {category.name}
                  <small>{category.account}</small>
                </span>
                <b>{formatMoney(category.deposit)}</b>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty-state">이 달에 예정된 저축이 없어요.</p>
      )}
    </article>
  );
}

export default App;
