/* ============================================================
   المتجر المركزي (Pinia) — كل بيانات النظام من الخادم + تحديث حي
   ============================================================ */
import { defineStore } from 'pinia'
import {
  api, getServerUrl, hasServerUrl, getToken, getMe, setAuth, clearAuth,
  testServer, saveServerUrl, applyInviteFromHash, cleanAppHash,
} from './api.js'
import { isOnLeaveNow } from './utils.js'

/* إشعار محلي (داخل الجهاز) عند وصول مهمة جديدة — يكمل إشعارات الخادم */
async function localNotify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return // لا نزعج وهو فاتح الصفحة
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) { await reg.showNotification(title, { body, icon: './icon.png', badge: './icon.png', tag: 'tmb-' + Date.now() }); return }
    new Notification(title, { body })
  } catch { /* لا شيء */ }
}

export const useStore = defineStore('app', {
  state: () => ({
    booted: false,
    view: 'login',            // login | setup | app
    serverInfo: null,
    setupError: '',           // رسالة عامة فقط — بدون أي تفاصيل تقنية
    pendingAdminPass: '',     // كلمة مرور المدير المؤقتة لإكمال الربط (لا تُخزن)

    auth: null,               // {role, name, id}
    conn: 'ok',               // ok | off

    /* بيانات المدير */
    settings: {},
    employees: [],
    taskTypes: [],
    tasks: [],
    ledger: [],
    audit: [],

    /* بيانات الموظف */
    me: null,
    leaderboard: [],
    myLedger: [],
    serverSettings: {},
    _knownAvail: null,   // معرفات المهام المتاحة — لكشف الجديد وإشعار محلي

    section: 'dashboard',
    _sig: '',
    _timer: null,

    /* واجهة */
    toasts: [],
    lightbox: null,           // url صورة مكبرة
    confirmBox: null,         // {title, text, danger, resolve}
  }),

  getters: {
    isAdmin: s => s.auth?.role === 'admin',
    isEmployee: s => s.auth?.role === 'employee',

    pendingTasks: s => s.tasks.filter(t => t.status === 'pending_approval'),
    /* المهام المتاحة لهذا الموظف */
    myAvailableTasks(s) {
      if (!this.isEmployee || !s.me) return []
      const exc = s.me.exceptions || []
      return s.tasks.filter(t =>
        t.status === 'available' &&
        (!t.offeredTo || !t.offeredTo.length || t.offeredTo.includes(s.me.id)) &&
        !exc.includes(t.taskTypeId)
      )
    },
    myTasks(s) {
      if (!this.isEmployee || !s.me) return []
      return s.tasks.filter(t => t.assignedToId === s.me.id)
    },
    activeEmployees: s => s.employees.filter(e => e.status !== 'disabled'),
  },

  actions: {
    /* ============ الإقلاع ============ */
    async boot() {
      // رابط دعوة من المدير؟ نطبقه فوراً وننظف شريط العنوان
      if (applyInviteFromHash()) cleanAppHash()

      if (!hasServerUrl()) { this.view = 'login'; this.booted = true; return }
      try {
        this.serverInfo = await testServer(getServerUrl())
        this.setupError = ''
      } catch {
        this.view = 'login'
        this.setupError = 'تعذر الاتصال بالخادم — راجع المدير'
        this.booted = true
        return
      }
      const saved = getToken() ? getMe() : null
      if (saved && saved.role) {
        // التحقق أن الجلسة ما زالت صالحة
        try {
          await api('/api/me')
          this.auth = saved
          this.view = 'app'
          await this.refresh(true)
          this._startPolling()
          this.section = saved.role === 'admin' ? 'dashboard' : 'avail'
        } catch (e) {
          if (e.status === 401 || e.status === 403) clearAuth()
          this.view = 'login'
        }
      } else {
        this.view = 'login'
      }
      this.booted = true
    },

    /* ============ الربط — للمدير فقط ============ */
    /* تُستدعى من شاشة الدخول بعد أن يكتب المدير كلمة مروره
       والنظام غير مرتبط أو غير متوفر — الموظف لا يصل لهذه الشاشة أبداً */
    requestLinking(adminPass) {
      this.pendingAdminPass = adminPass
      this.setupError = ''
      this.view = 'setup'
    },

    async connectServer(url) {
      const saved = saveServerUrl(url)
      if (!saved) throw new Error('اكتب عنوان الربط')
      this.serverInfo = await testServer(saved)   // يرمي خطأ عاماً إذا كان العنوان غير صحيح
      this.setupError = ''
      const pass = this.pendingAdminPass
      this.pendingAdminPass = ''
      if (pass) {
        // التحقق من هوية المدير عند الخادم قبل إكمال الربط والدخول التلقائي
        try {
          await this.login({ role: 'admin', password: pass })
          return
        } catch {
          this.view = 'login'
          throw new Error('تم الربط — سجّل دخولك بكلمة المرور')
        }
      }
      this.view = 'login'
    },

    /* تحديث عنوان الخادم من لوحة المدير (إعدادات ← ربط الخادم) */
    async updateServerUrl(url) {
      const saved = saveServerUrl(url)
      if (!saved) throw new Error('اكتب عنوان الربط')
      this.serverInfo = await testServer(saved)
    },

    /* ============ الدخول والخروج ============ */
    async login(payload) {
      const r = await api('/api/login', { method: 'POST', body: payload })
      setAuth(r.token, r.me)
      this.auth = r.me
      this.view = 'app'
      this.section = r.me.role === 'admin' ? 'dashboard' : 'avail'
      await this.refresh(true)
      this._startPolling()
      return r.me
    },

    logout() {
      clearAuth()
      this.auth = null
      this.view = 'login'
      this._stopPolling()
      this._sig = ''
    },

    /* ============ التحديث الحي ============ */
    async refresh(force = false) {
      const d = await api('/api/state')
      const sig = JSON.stringify(d)
      if (force || sig !== this._sig) {
        this._sig = sig
        if (d.role === 'admin') {
          this.settings = d.settings || {}
          this.employees = d.employees || []
          this.taskTypes = d.taskTypes || []
          this.tasks = d.tasks || []
          this.ledger = d.ledger || []
          this.audit = d.audit || []
        } else {
          this.me = d.me || null
          this.taskTypes = d.taskTypes || []
          this.tasks = d.tasks || []
          this.leaderboard = d.leaderboard || []
          this.myLedger = d.myLedger || []
          this.serverSettings = d.serverSettings || {}
          // إشعار محلي عند وصول مهمة متاحة جديدة
          const ids = this.tasks.filter(t => t.status === 'available').map(t => t.id).sort()
          if (Array.isArray(this._knownAvail)) {
            const fresh = ids.filter(id => !this._knownAvail.includes(id))
            if (fresh.length) {
              const t = this.tasks.find(x => x.id === fresh[0])
              localNotify('🔔 مهمة جديدة!', t ? `#${t.no} ${t.title} — ⭐${t.points} نقطة` : 'افتح الموقع لتراها')
            }
          }
          this._knownAvail = ids
        }
      }
      this.conn = 'ok'
    },

    _startPolling() {
      this._stopPolling()
      this._timer = setInterval(async () => {
        if (document.visibilityState !== 'visible') return
        try {
          await this.refresh()
          if (this.auth && this.auth.role === 'employee' && this.me?.status === 'disabled') {
            this.toast('حسابك تم إيقافه من المدير', 'err')
            this.logout()
          }
        } catch (e) {
          this.conn = 'off'
          if (e.status === 401) { this.logout() }
        }
      }, 4000)
    },
    _stopPolling() { if (this._timer) { clearInterval(this._timer); this._timer = null } },

    /* ============ أدوات واجهة ============ */
    toast(msg, type = '') {
      const id = Date.now() + Math.random()
      this.toasts.push({ id, msg, type })
      setTimeout(() => { this.toasts = this.toasts.filter(t => t.id !== id) }, 3200)
    },

    showLightbox(url) { this.lightbox = url },

    /* نافذة تأكيد بنفس ستايل النظام — ترجع Promise<boolean> */
    confirm(title, text, danger = false) {
      return new Promise(resolve => {
        this.confirmBox = { title, text, danger, resolve }
      })
    },
    _resolveConfirm(v) {
      this.confirmBox?.resolve(v)
      this.confirmBox = null
    },

    setSection(name) {
      this.section = name
    },

    /* ============ مهام: رفض مهمة عامة (موظف) ============ */
    declineTask(taskId, reason) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/decline', { method: 'POST', body: { reason } }))
    },

    /* ============ إعدادات الموظف الذاتية ============ */
    updateMyCredentials(oldPassword, newPassword, username) {
      return this.act(() => api('/api/me/credentials', { method: 'POST', body: { oldPassword, newPassword, username } }))
    },

    /* ============ تعيين إحصائيات موظف بقيمة محددة (مدير) ============ */
    setEmployeeStats(eid, patch) {
      return this.act(() => api('/api/employees/' + encodeURIComponent(eid) + '/stats', { method: 'POST', body: patch }))
    },

    convertTaskNow(taskId) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/convert-now', { method: 'POST', body: {} }))
    },

    /* ============ مساعدات المدير (نفس منطق الإصدار السابق) ============ */
    listEmployees(includeDisabled) {
      return this.employees
        .filter(e => includeDisabled || e.status !== 'disabled')
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'))
    },
    getEmployee(id) { return this.employees.find(e => e.id === id) || null },
    getTask(id) { return this.tasks.find(t => t.id === id) || null },
    getTaskType(id) { return this.taskTypes.find(t => t.id === id) || null },
    listTaskTypes(activeOnly) {
      const arr = this.taskTypes.slice()
      arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
      return activeOnly ? arr.filter(t => t.isActive !== false) : arr
    },
    getEligibleEmployees(taskTypeId) {
      return this.listEmployees(false).filter(e =>
        e.status === 'active' && !(e.exceptions || []).includes(taskTypeId)
      )
    },
    pickAutoCandidates(taskTypeId) {
      const eligible = this.getEligibleEmployees(taskTypeId)
      if (!eligible.length) return []
      const min = Math.min(...eligible.map(e => Number(e.totalPoints) || 0))
      return eligible.filter(e => (Number(e.totalPoints) || 0) === min)
    },

    /* ============ عمليات API موحدة ============ */
    async act(fn, okMsg) {
      try {
        const r = await fn()
        if (okMsg) this.toast(okMsg, 'ok')
        await this.refresh(true).catch(() => {})
        return r
      } catch (e) {
        this.toast(e.message, 'err')
        if (e.status === 401) this.logout()
        throw e
      }
    },

    /* المدير */
    saveSettings(patch) { return this.act(() => api('/api/settings', { method: 'PUT', body: patch })) },
    addEmployee(data) { return this.act(() => api('/api/employees', { method: 'POST', body: data })) },
    updateEmployee(id, patch) { return this.act(() => api('/api/employees/' + encodeURIComponent(id), { method: 'PATCH', body: patch })) },
    addTaskType(data) { return this.act(() => api('/api/task-types', { method: 'POST', body: data })) },
    updateTaskType(id, patch) { return this.act(() => api('/api/task-types/' + encodeURIComponent(id), { method: 'PATCH', body: patch })) },
    createTask(data) { return this.act(() => api('/api/tasks', { method: 'POST', body: data })) },
    updateTask(id, patch) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id), { method: 'PATCH', body: patch })) },
    approveTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/approve', { method: 'POST' })) },
    rejectTask(id, reason) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/reject', { method: 'POST', body: { reason } })) },
    cancelTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/cancel', { method: 'POST' })) },
    unassignTask(id) { return this.act(() => api('/api/tasks/' + encodeURIComponent(id) + '/unassign', { method: 'POST' })) },
    adjustPoints(employeeId, amount, reason) {
      return this.act(() => api('/api/points/adjust', { method: 'POST', body: { employeeId, amount, reason } }))
    },
    changePassword(oldPassword, newPassword) {
      return this.act(() => api('/api/settings/password', { method: 'POST', body: { oldPassword, newPassword } }))
    },
    testTelegram() { return api('/api/notify/test', { method: 'POST', body: {} }) },

    /* الموظف */
    acceptTask(taskId) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/accept', { method: 'POST', body: {} }))
    },
    startTask(taskId) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/start', { method: 'POST', body: {} }))
    },
    submitReport(taskId, reportText, photoIds) {
      return this.act(() => api('/api/tasks/' + encodeURIComponent(taskId) + '/submit', { method: 'POST', body: { reportText, photoIds } }))
    },
    getSubmissions(taskId) { return api('/api/tasks/' + encodeURIComponent(taskId) + '/submissions') },
  },
})
