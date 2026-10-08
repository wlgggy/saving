import { supabase } from './supabase'

const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

const throwOnError = (error) => {
  if (error) throw new Error(error.message)
}

export async function loadPlanner(defaultSettings) {
  const client = requireSupabase()
  const [settingsResult, categoriesResult, checksResult, transactionsResult] = await Promise.all([
    client.from('save_me_shared_settings').select('*').eq('id', 'save-me-shared-planner').maybeSingle(),
    client.from('save_me_shared_categories').select('*').order('sort_order').order('created_at'),
    client.from('save_me_shared_checks').select('*'),
    client.from('save_me_shared_travel_transactions').select('*').order('created_at', { ascending: false }),
  ])
  ;[settingsResult, categoriesResult, checksResult, transactionsResult].forEach(({ error }) => throwOnError(error))

  const settings = settingsResult.data
  const categories = categoriesResult.data || []
  const checks = checksResult.data || []
  const transactions = transactionsResult.data || []
  if (!settings && !categories.length && !checks.length && !transactions.length) return null

  const depositsByCategory = transactions.reduce((all, transaction) => {
    const deposits = all[transaction.category_id] || []
    deposits.push({
      id: transaction.id,
      date: transaction.transaction_date,
      amount: Number(transaction.amount),
      kind: transaction.transaction_type,
      memo: transaction.memo || '',
    })
    return { ...all, [transaction.category_id]: deposits }
  }, {})

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      account: category.account_name || '',
      start: category.start_month,
      end: category.end_month,
      deposit: Number(category.deposit_amount || 0),
      target: Number(category.target_amount || 0),
      manualMonths: category.manual_months || [],
      travel: category.name.includes('여행적금')
        ? { budget: Number(category.target_amount || 0), deposits: depositsByCategory[category.id] || [] }
        : undefined,
    })),
    checks: checks.reduce((all, check) => ({ ...all, [`${check.category_id}:${check.savings_month}`]: check.is_checked }), {}),
    settings: {
      ...defaultSettings,
      ...(settings && {
        nickname: settings.nickname,
        bio: settings.bio,
        profileImage: settings.profile_image || '',
        spotifyUrl: settings.spotify_url || '',
      }),
    },
  }
}

export async function savePlanner(state) {
  const client = requireSupabase()
  const settingsResult = await client.from('save_me_shared_settings').upsert({
    id: 'save-me-shared-planner',
    nickname: state.settings.nickname || 'coco',
    bio: state.settings.bio || '',
    profile_image: state.settings.profileImage || null,
    spotify_url: state.settings.spotifyUrl || null,
    updated_at: new Date().toISOString(),
  })
  throwOnError(settingsResult.error)

  const categoryIds = state.categories.map((category) => category.id)
  const existingCategoriesResult = await client.from('save_me_shared_categories').select('id')
  throwOnError(existingCategoriesResult.error)
  const removedIds = (existingCategoriesResult.data || []).map((category) => category.id).filter((id) => !categoryIds.includes(id))
  if (removedIds.length) {
    const removeResult = await client.from('save_me_shared_categories').delete().in('id', removedIds)
    throwOnError(removeResult.error)
  }
  if (state.categories.length) {
    const categoryResult = await client.from('save_me_shared_categories').upsert(
      state.categories.map((category, index) => ({
        id: category.id,
        name: category.name,
        account_name: category.account || null,
        start_month: category.start,
        end_month: category.end,
        deposit_amount: Number(category.deposit || 0),
        target_amount: Number(category.target || 0),
        manual_months: category.manualMonths || [],
        sort_order: index,
      })),
      { onConflict: 'id' },
    )
    throwOnError(categoryResult.error)
  }

  const clearChecksResult = await client.from('save_me_shared_checks').delete().neq('category_id', '')
  throwOnError(clearChecksResult.error)
  const checkedRows = Object.entries(state.checks)
    .filter(([, checked]) => checked)
    .map(([key]) => {
      const [categoryId, savingsMonth] = key.split(':')
      return { category_id: categoryId, savings_month: savingsMonth, is_checked: true }
    })
  if (checkedRows.length) {
    const checksResult = await client.from('save_me_shared_checks').insert(checkedRows)
    throwOnError(checksResult.error)
  }

  const clearTransactionsResult = await client.from('save_me_shared_travel_transactions').delete().neq('id', '')
  throwOnError(clearTransactionsResult.error)
  const transactionRows = state.categories.flatMap((category) => (category.travel?.deposits || []).map((deposit) => ({
    id: deposit.id,
    category_id: category.id,
    transaction_date: deposit.date,
    amount: Number(deposit.amount),
    transaction_type: deposit.kind === 'withdrawal' ? 'withdrawal' : 'deposit',
    memo: deposit.memo || null,
  })))
  if (transactionRows.length) {
    const transactionsResult = await client.from('save_me_shared_travel_transactions').insert(transactionRows)
    throwOnError(transactionsResult.error)
  }
}
