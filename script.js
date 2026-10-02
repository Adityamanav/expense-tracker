/* ============================================
   Multi-Currency Expense Tracker – script.js
   ============================================ */

(function () {
  'use strict';

  // ---------- 1. Data Layer ----------
  const STORAGE_KEY = 'travelExpenseTracker_v1';

  const DEFAULT_RATES = {
    // Approximate rates relative to USD (update as needed)
    USD: 1,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.5,
    JPY: 149.5,
    AUD: 1.53,
    CAD: 1.36,
    THB: 35.8,
    SGD: 1.34,
    AED: 3.67
  };

  const CATEGORY_ICONS = {
    Food: '🍽️',
    Transport: '🚗',
    Accommodation: '🏨',
    Activities: '🎯',
    Shopping: '🛍️',
    Other: '📦'
  };

  const CURRENCY_SYMBOLS = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    THB: '฿',
    SGD: 'S$',
    AED: 'د.إ'
  };

  let state = {
    expenses: [],
    settings: {
      tripName: 'My Trip',
      baseCurrency: 'USD',
      totalBudget: null,
      dailyBudget: null,
      tripStart: '',
      tripEnd: '',
      rates: { ...DEFAULT_RATES }
    },
    theme: 'light',
    deleteId: null
  };

  // ---------- 2. Persistence ----------
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state.expenses = parsed.expenses || [];
        state.settings = { ...state.settings, ...parsed.settings };
        if (!state.settings.rates) state.settings.rates = { ...DEFAULT_RATES };
        state.theme = parsed.theme || 'light';
      }
    } catch (e) {
      console.warn('Failed to load saved data', e);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        expenses: state.expenses,
        settings: state.settings,
        theme: state.theme
      }));
    } catch (e) {
      showToast('Could not save data', 'error');
    }
  }

  // ---------- 3. Currency Helpers ----------
  function convert(amount, from, to) {
    if (from === to) return amount;
    const rates = state.settings.rates;
    // Convert to USD first, then to target
    const inUSD = amount / (rates[from] || 1);
    return inUSD * (rates[to] || 1);
  }

  function formatMoney(amount, currency) {
    const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
    const decimals = currency === 'JPY' ? 0 : 2;
    const formatted = Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    return symbol + formatted;
  }

  function getBaseTotal(expense) {
    return convert(expense.amount, expense.currency, state.settings.baseCurrency);
  }

  // ---------- 4. Core Calculations ----------
  function getFilteredExpenses() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('filterCategory')?.value || 'all';
    const curr = document.getElementById('filterCurrency')?.value || 'all';
    const sort = document.getElementById('sortBy')?.value || 'newest';

    let list = [...state.expenses];

    if (search) {
      list = list.filter(e =>
        (e.description || '').toLowerCase().includes(search) ||
        (e.location || '').toLowerCase().includes(search) ||
        e.category.toLowerCase().includes(search)
      );
    }
    if (cat !== 'all') list = list.filter(e => e.category === cat);
    if (curr !== 'all') list = list.filter(e => e.currency === curr);

    list.sort((a, b) => {
      if (sort === 'newest') return new Date(b.date) - new Date(a.date) || b.id - a.id;
      if (sort === 'oldest') return new Date(a.date) - new Date(b.date) || a.id - b.id;
      if (sort === 'highest') return getBaseTotal(b) - getBaseTotal(a);
      if (sort === 'lowest') return getBaseTotal(a) - getBaseTotal(b);
      if (sort === 'category') return a.category.localeCompare(b.category);
      return 0;
    });

    return list;
  }

  function calcTotals() {
    const base = state.settings.baseCurrency;
    let total = 0;
    const byCategory = {};
    const byCurrency = {};

    state.expenses.forEach(e => {
      const converted = getBaseTotal(e);
      total += converted;
      byCategory[e.category] = (byCategory[e.category] || 0) + converted;
      byCurrency[e.currency] = (byCurrency[e.currency] || 0) + e.amount;
    });

    return { total, byCategory, byCurrency, count: state.expenses.length };
  }

  function calcDailyAverage(total) {
    const start = state.settings.tripStart ? new Date(state.settings.tripStart) : null;
    const end = state.settings.tripEnd ? new Date(state.settings.tripEnd) : new Date();
    if (!start) return { avg: 0, days: 0 };

    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
    return { avg: total / days, days };
  }

  // ---------- 5. UI Rendering ----------
  function renderDashboard() {
    const { total, byCategory, count } = calcTotals();
    const base = state.settings.baseCurrency;

    document.getElementById('totalSpent').textContent = formatMoney(total, base);
    document.getElementById('headerTotal').textContent = formatMoney(total, base);
    document.getElementById('expenseCount').textContent = `${count} expense${count !== 1 ? 's' : ''}`;

    // Budget
    const budget = state.settings.totalBudget;
    const remainingEl = document.getElementById('budgetRemaining');
    const progressEl = document.getElementById('budgetProgress');

    if (budget && budget > 0) {
      const remaining = budget - total;
      remainingEl.textContent = formatMoney(remaining, base);
      const pct = Math.min(100, (total / budget) * 100);
      progressEl.style.width = pct + '%';
      progressEl.classList.remove('over', 'warn');
      if (pct >= 100) progressEl.classList.add('over');
      else if (pct >= 80) progressEl.classList.add('warn');
    } else {
      remainingEl.textContent = '—';
      progressEl.style.width = '0%';
      progressEl.classList.remove('over', 'warn');
    }

    // Daily average
    const { avg, days } = calcDailyAverage(total);
    document.getElementById('dailyAvg').textContent = formatMoney(avg, base);
    document.getElementById('tripDays').textContent = days > 0 ? `${days} day${days !== 1 ? 's' : ''} so far` : 'Set trip dates';

    // Top category
    let topCat = '—';
    let topAmt = 0;
    Object.entries(byCategory).forEach(([cat, amt]) => {
      if (amt > topAmt) {
        topAmt = amt;
        topCat = cat;
      }
    });
    document.getElementById('topCategory').textContent = topCat === '—' ? '—' : `${CATEGORY_ICONS[topCat] || ''} ${topCat}`;
    document.getElementById('topCategoryAmount').textContent = topCat === '—' ? '—' : formatMoney(topAmt, base);
  }

  function renderExpenseList() {
    const list = getFilteredExpenses();
    const container = document.getElementById('expenseList');
    const empty = document.getElementById('emptyState');
    const base = state.settings.baseCurrency;

    container.innerHTML = '';

    if (list.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    list.forEach(exp => {
      const converted = getBaseTotal(exp);
      const item = document.createElement('div');
      item.className = 'expense-item';
      item.setAttribute('role', 'listitem');
      item.dataset.id = exp.id;

      const catClass = exp.category.toLowerCase();

      item.innerHTML = `
        <div class="expense-cat-icon ${catClass}">${CATEGORY_ICONS[exp.category] || '📦'}</div>
        <div class="expense-details">
          <div class="expense-title">${escapeHtml(exp.description || exp.category)}</div>
          <div class="expense-meta">
            <span>${exp.category}</span>
            <span>•</span>
            <span>${formatDate(exp.date)}</span>
            ${exp.location ? `<span>•</span><span>${escapeHtml(exp.location)}</span>` : ''}
          </div>
        </div>
        <div class="expense-amounts">
          <div class="expense-original">${formatMoney(exp.amount, exp.currency)}</div>
          ${exp.currency !== base ? `<div class="expense-converted">≈ ${formatMoney(converted, base)}</div>` : ''}
        </div>
        <div class="expense-actions">
          <button type="button" class="icon-btn edit" data-id="${exp.id}" title="Edit" aria-label="Edit expense">✏️</button>
          <button type="button" class="icon-btn delete" data-id="${exp.id}" title="Delete" aria-label="Delete expense">🗑️</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function renderRates() {
    const container = document.getElementById('ratesList');
    const base = state.settings.baseCurrency;
    container.innerHTML = '';

    Object.keys(DEFAULT_RATES).forEach(code => {
      if (code === base) return;
      const row = document.createElement('div');
      row.className = 'rate-row';
      row.innerHTML = `
        <label>${code}</label>
        <input type="number" step="0.0001" min="0.0001" data-currency="${code}" value="${state.settings.rates[code] || DEFAULT_RATES[code]}" />
        <span style="font-size:0.8rem;color:var(--text-muted)">= 1 ${base}</span>
      `;
      container.appendChild(row);
    });

    // Note: rates are stored as "units of currency per 1 USD". 
    // For display we show relative to base by converting.
    // Simpler approach used: rates always vs USD, conversion handles base.
  }

  function updateCurrencySymbols() {
    const base = state.settings.baseCurrency;
    const symbol = CURRENCY_SYMBOLS[base] || base;
    document.getElementById('budgetSymbol').textContent = symbol;
    document.getElementById('dailyBudgetSymbol').textContent = symbol;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  // ---------- 6. Actions ----------
  function addExpense(data) {
    const expense = {
      id: Date.now() + Math.random().toString(36).slice(2, 7),
      amount: parseFloat(data.amount),
      currency: data.currency,
      category: data.category,
      date: data.date,
      description: (data.description || '').trim(),
      location: (data.location || '').trim(),
      createdAt: new Date().toISOString()
    };
    state.expenses.unshift(expense);
    saveState();
    renderAll();
    showToast('Expense added', 'success');
  }

  function updateExpense(id, data) {
    const idx = state.expenses.findIndex(e => e.id === id);
    if (idx === -1) return;
    state.expenses[idx] = {
      ...state.expenses[idx],
      amount: parseFloat(data.amount),
      currency: data.currency,
      category: data.category,
      date: data.date,
      description: (data.description || '').trim(),
      location: (data.location || '').trim()
    };
    saveState();
    renderAll();
    showToast('Expense updated', 'success');
  }

  function deleteExpense(id) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveState();
    renderAll();
    showToast('Expense deleted', 'success');
  }

  function setBaseCurrency(code) {
    state.settings.baseCurrency = code;
    saveState();
    updateCurrencySymbols();
    renderRates();
    renderAll();
    updateConverter();
  }

  // ---------- 7. Converter ----------
  function updateConverter() {
    const amount = parseFloat(document.getElementById('convAmount').value) || 0;
    const from = document.getElementById('convFrom').value;
    const to = document.getElementById('convTo').value;
    const result = convert(amount, from, to);
    document.querySelector('#convResult .conv-value').textContent =
      formatMoney(result, to);
  }

  // ---------- 8. Export ----------
  function exportJSON() {
    const data = {
      tripName: state.settings.tripName,
      baseCurrency: state.settings.baseCurrency,
      expenses: state.expenses,
      settings: state.settings,
      exportedAt: new Date().toISOString()
    };
    downloadFile(
      JSON.stringify(data, null, 2),
      `travel-expenses-${Date.now()}.json`,
      'application/json'
    );
    showToast('JSON exported', 'success');
  }

  function exportCSV() {
    const base = state.settings.baseCurrency;
    const headers = ['Date', 'Category', 'Description', 'Location', 'Amount', 'Currency', `Converted (${base})`];
    const rows = state.expenses.map(e => [
      e.date,
      e.category,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.location || '').replace(/"/g, '""')}"`,
      e.amount,
      e.currency,
      getBaseTotal(e).toFixed(2)
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(csv, `travel-expenses-${Date.now()}.csv`, 'text/csv');
    showToast('CSV exported', 'success');
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- 9. UI Helpers ----------
  function showToast(msg, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.style.overflow = '';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function renderAll() {
    renderDashboard();
    renderExpenseList();
  }

  // ---------- 10. Event Listeners ----------
  function initEvents() {
    // Add expense
    document.getElementById('expenseForm').addEventListener('submit', e => {
      e.preventDefault();
      const amount = document.getElementById('amount').value;
      if (!amount || parseFloat(amount) <= 0) {
        showToast('Enter a valid amount', 'error');
        return;
      }
      addExpense({
        amount,
        currency: document.getElementById('currency').value,
        category: document.getElementById('category').value,
        date: document.getElementById('date').value,
        description: document.getElementById('description').value,
        location: document.getElementById('location').value
      });
      e.target.reset();
      document.getElementById('date').value = todayISO();
      document.getElementById('currency').value = state.settings.baseCurrency;
    });

    document.getElementById('clearFormBtn').addEventListener('click', () => {
      document.getElementById('expenseForm').reset();
      document.getElementById('date').value = todayISO();
    });

    // Filters
    ['searchInput', 'filterCategory', 'filterCurrency', 'sortBy'].forEach(id => {
      document.getElementById(id).addEventListener('input', renderExpenseList);
      document.getElementById(id).addEventListener('change', renderExpenseList);
    });

    // Expense list actions (event delegation)
    document.getElementById('expenseList').addEventListener('click', e => {
      const btn = e.target.closest('.icon-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.classList.contains('edit')) {
        const exp = state.expenses.find(x => x.id === id);
        if (!exp) return;
        document.getElementById('editId').value = exp.id;
        document.getElementById('editAmount').value = exp.amount;
        document.getElementById('editCurrency').value = exp.currency;
        document.getElementById('editCategory').value = exp.category;
        document.getElementById('editDate').value = exp.date;
        document.getElementById('editDescription').value = exp.description || '';
        document.getElementById('editLocation').value = exp.location || '';
        openModal('editModal');
      }
      if (btn.classList.contains('delete')) {
        state.deleteId = id;
        openModal('deleteModal');
      }
    });

    // Edit form
    document.getElementById('editForm').addEventListener('submit', e => {
      e.preventDefault();
      updateExpense(document.getElementById('editId').value, {
        amount: document.getElementById('editAmount').value,
        currency: document.getElementById('editCurrency').value,
        category: document.getElementById('editCategory').value,
        date: document.getElementById('editDate').value,
        description: document.getElementById('editDescription').value,
        location: document.getElementById('editLocation').value
      });
      closeModal('editModal');
    });

    // Delete confirm
    document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
      if (state.deleteId) {
        deleteExpense(state.deleteId);
        state.deleteId = null;
      }
      closeModal('deleteModal');
    });

    // Modal close
    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => {
        closeModal('editModal');
        closeModal('deleteModal');
      });
    });

    // Base currency
    document.getElementById('baseCurrency').addEventListener('change', e => {
      setBaseCurrency(e.target.value);
    });

    // Trip name
    document.getElementById('tripName').addEventListener('change', e => {
      state.settings.tripName = e.target.value.trim() || 'My Trip';
      saveState();
    });

    // Theme
    document.getElementById('themeToggle').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      saveState();
    });

    // Budget save
    document.getElementById('saveBudgetBtn').addEventListener('click', () => {
      const total = document.getElementById('totalBudget').value;
      const daily = document.getElementById('dailyBudget').value;
      state.settings.totalBudget = total ? parseFloat(total) : null;
      state.settings.dailyBudget = daily ? parseFloat(daily) : null;
      state.settings.tripStart = document.getElementById('tripStart').value;
      state.settings.tripEnd = document.getElementById('tripEnd').value;
      saveState();
      renderDashboard();
      showToast('Budget & dates saved', 'success');
    });

    // Rates editing
    document.getElementById('ratesList').addEventListener('change', e => {
      if (e.target.matches('input[data-currency]')) {
        const code = e.target.dataset.currency;
        const val = parseFloat(e.target.value);
        if (val > 0) {
          state.settings.rates[code] = val;
          saveState();
          renderAll();
          updateConverter();
          showToast('Rate updated', 'success');
        }
      }
    });

    document.getElementById('resetRatesBtn').addEventListener('click', () => {
      state.settings.rates = { ...DEFAULT_RATES };
      saveState();
      renderRates();
      renderAll();
      updateConverter();
      showToast('Rates reset to defaults', 'success');
    });

    // Converter
    ['convAmount', 'convFrom', 'convTo'].forEach(id => {
      document.getElementById(id).addEventListener('input', updateConverter);
      document.getElementById(id).addEventListener('change', updateConverter);
    });

    document.getElementById('swapCurrencies').addEventListener('click', () => {
      const from = document.getElementById('convFrom');
      const to = document.getElementById('convTo');
      const tmp = from.value;
      from.value = to.value;
      to.value = tmp;
      updateConverter();
    });

    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('convAmount').value = btn.dataset.amount;
        updateConverter();
      });
    });

    // Export / Clear
    document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);

    document.getElementById('clearAllBtn').addEventListener('click', () => {
      if (confirm('Delete ALL expenses and reset settings? This cannot be undone.')) {
        state.expenses = [];
        state.settings.totalBudget = null;
        state.settings.dailyBudget = null;
        saveState();
        renderAll();
        document.getElementById('totalBudget').value = '';
        document.getElementById('dailyBudget').value = '';
        showToast('All data cleared', 'success');
      }
    });

    // Keyboard: Escape closes modals
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal('editModal');
        closeModal('deleteModal');
      }
    });
  }

  // ---------- 11. Initialization ----------
  function init() {
    loadState();
    applyTheme();

    // Set form defaults
    document.getElementById('date').value = todayISO();
    document.getElementById('baseCurrency').value = state.settings.baseCurrency;
    document.getElementById('currency').value = state.settings.baseCurrency;
    document.getElementById('tripName').value = state.settings.tripName;
    document.getElementById('totalBudget').value = state.settings.totalBudget || '';
    document.getElementById('dailyBudget').value = state.settings.dailyBudget || '';
    document.getElementById('tripStart').value = state.settings.tripStart || '';
    document.getElementById('tripEnd').value = state.settings.tripEnd || '';

    updateCurrencySymbols();
    renderRates();
    renderAll();
    updateConverter();
    initEvents();
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);
})();
