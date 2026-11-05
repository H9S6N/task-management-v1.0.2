<script setup>
import { computed, ref } from 'vue'
import { useStore } from '../../store.js'
import { getServerUrl, buildInviteLink, downloadFile, apiUploadFile } from '../../api.js'
import { APP_VERSION } from '../../utils.js'

const store = useStore()
const s = store.settings

const tgEnabled = ref(s.tgEnabled !== false)
const tgToken = ref('')
const tgAdmins = ref((s.tgAdminChatIds || []).join(','))
const maxActive = ref(Number(s.maxActiveTasks) || 3)

const oldPass = ref(''); const newPass = ref(''); const newPass2 = ref('')
const tgStatus = ref('')
const backingUp = ref(false)
const restoring = ref(false)
const restoreFile = ref(null)

/* رقم واتساب الدعم */
const waNumber = ref(s.supportWhatsapp || '')
const waBusy = ref(false)
const waPreview = computed(() => (waNumber.value || '').replace(/\D/g, ''))

async function saveWhatsapp() {
  const clean = waNumber.value.replace(/[^\d+]/g, '')
  waBusy.value = true
  try {
    await store.saveSettings({ supportWhatsapp: clean })
    waNumber.value = clean
    store.toast('تم حفظ رقم الدعم — الزر ظاهر الآن للجميع 💬', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
  waBusy.value = false
}

/* التوزيع التلقائي الافتراضي */
const defDist = ref(s.defaultDistribution || 'lowest')
const defCount = ref(Number(s.defaultCandidates) || 1)

async function saveDistribution() {
  const v = parseInt(defCount.value, 10)
  if (!v || v < 1 || v > 50) { store.toast('عدد غير صحيح (1 - 50)', 'err'); return }
  await store.saveSettings({ defaultDistribution: defDist.value, defaultCandidates: v })
  store.toast('تم حفظ إعدادات التوزيع ✅', 'ok')
}

/* ربط الخادم — للمدير فقط */
const newUrl = ref(getServerUrl())
const linkingBusy = ref(false)
const appUrlInput = ref(s.appUrl || '')
const appUrlBusy = ref(false)
const copied = ref(false)

const inviteLink = computed(() => buildInviteLink(store.settings.appUrl || ''))

async function updateServer() {
  if (!newUrl.value.trim()) { store.toast('اكتب عنوان الربط', 'err'); return }
  linkingBusy.value = true
  try {
    await store.updateServerUrl(newUrl.value)
    store.toast('تم تحديث عنوان الخادم ✅', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
  linkingBusy.value = false
}

async function saveAppUrl() {
  let u = String(appUrlInput.value || '').trim()
  if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u
  if (u && !/^https?:\/\/[^\s]+$/i.test(u)) { store.toast('رابط التطبيق غير صحيح', 'err'); return }
  appUrlBusy.value = true
  try {
    await store.saveSettings({ appUrl: u })
    appUrlInput.value = u
    store.toast('تم حفظ رابط التطبيق ✅', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
  appUrlBusy.value = false
}

async function copyInvite() {
  if (!inviteLink.value) { store.toast('اربط الخادم أولاً', 'err'); return }
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copied.value = true
    store.toast('تم نسخ رابط الدعوة ✅ — أرسله للموظفين', 'ok')
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    store.toast('انسخ الرابط يدوياً من الحقل', 'err')
  }
}

async function saveTelegram() {
  const admins = tgAdmins.value.split(',').map(x => x.trim()).filter(Boolean)
  await store.saveSettings({ tgEnabled: tgEnabled.value, tgToken: tgToken.value.trim(), tgAdminChatIds: admins })
  tgToken.value = ''
  tgStatus.value = '✅ تم حفظ إعدادات تيليكرام'
}

async function testTelegram() {
  const admins = tgAdmins.value.split(',').map(x => x.trim()).filter(Boolean)
  if (!admins.length) { store.toast('اكتب Chat ID واحد على الأقل', 'err'); return }
  tgStatus.value = '⏳ جاري الإرسال...'
  try {
    await saveTelegram()
    const r = await store.testTelegram()
    tgStatus.value = r.ok ? '✅ وصل الإشعار التجريبي! افتح تيليكرام' : '❌ فشل: ' + r.error
  } catch (e) {
    tgStatus.value = '❌ ' + e.message
  }
}

async function saveGeneral() {
  const v = parseInt(maxActive.value, 10)
  if (!v || v < 1) { store.toast('قيمة غير صحيحة', 'err'); return }
  await store.saveSettings({ maxActiveTasks: v })
}

async function changePassword() {
  if (newPass.value.length < 6) { store.toast('الجديدة 6 أحرف على الأقل', 'err'); return }
  if (newPass.value !== newPass2.value) { store.toast('التأكيد غير مطابق', 'err'); return }
  try {
    await store.changePassword(oldPass.value, newPass.value)
    oldPass.value = newPass.value = newPass2.value = ''
    store.toast('تم تغيير كلمة المرور ✅', 'ok')
  } catch { /* التوست من store */ }
}

async function backup() {
  backingUp.value = true
  try {
    await downloadFile('/api/backup', `taskmanager-backup-${new Date().toISOString().slice(0, 10)}.db`)
    store.toast('تم تنزيل النسخة الاحتياطية ✅', 'ok')
  } catch (e) { store.toast(e.message, 'err') }
  backingUp.value = false
}

/* ===== استيراد نسخة احتياطية — نقل بيانات نسخة إلى نسخة ===== */
function pickRestore(ev) {
  restoreFile.value = (ev.target.files || [])[0] || null
}

async function doRestore() {
  const f = restoreFile.value
  if (!f) { store.toast('اختر ملف النسخة الاحتياطية (.db) أولاً', 'err'); return }
  const ok = await store.confirm(
    'استيراد نسخة احتياطية',
    `سيتم استبدال كل البيانات الحالية ببيانات الملف "${f.name}" — المهام والموظفون والنقاط كلها تتغير. متابعة؟`,
    true
  )
  if (!ok) return
  restoring.value = true
  try {
    const r = await apiUploadFile('/api/restore', f)
    store.toast(r.message || 'تم الاستيراد ✅', 'ok')
    setTimeout(() => store.logout(), 2500)
  } catch (e) { store.toast(e.message, 'err') }
  restoring.value = false
}
</script>

<template>
  <section>
    <h2 class="sec-title">⚙️ الإعدادات</h2>

    <!-- ربط الخادم — للمدير فقط -->
    <div class="card">
      <h3>🔗 ربط الخادم</h3>
      <p class="muted">العنوان الحالي المرتبط بهذا الجهاز:</p>
      <p class="hint" dir="ltr" style="word-break:break-all">{{ getServerUrl() || 'غير مرتبط' }}</p>

      <label>تغيير عنوان الخادم</label>
      <input v-model="newUrl" dir="ltr" placeholder="https://..." @keyup.enter="updateServer">
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="linkingBusy" @click="updateServer">🔗 تحديث العنوان</button>
      </div>

      <label style="margin-top:14px">رابط التطبيق (GitHub Pages) — يُضاف تلقائياً إلى إشعارات تيليكرام والمتصفح ويُستخدم برابط الدعوة</label>
      <input v-model="appUrlInput" dir="ltr" placeholder="https://username.github.io/repo/" @keyup.enter="saveAppUrl">
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="appUrlBusy" @click="saveAppUrl">💾 حفظ رابط التطبيق</button>
      </div>

      <label style="margin-top:14px">رابط الدعوة للموظفين — أرسله مرة واحدة لكل موظف، يفتح النظام ويربط جهازه تلقائياً بدون ما يحط أي عنوان</label>
      <input :value="inviteLink" dir="ltr" readonly placeholder="اربط الخادم أولاً" style="word-break:break-all">
      <div class="btn-row">
        <button class="btn btn-outline" @click="copyInvite">{{ copied ? '✅ تم النسخ' : '📋 نسخ رابط الدعوة' }}</button>
      </div>
    </div>

    <!-- دعم واتساب -->
    <div class="card">
      <h3>💬 دعم التطبيق (واتساب)</h3>
      <p class="muted">حدد رقم الدعم — يظهر زر واتساب لكل الموظفين (بجانب الشاشة وقسم إعداداتي) ويمكنهم مراسلتك بضغطة</p>
      <label>رقم الواتساب مع رمز الدولة (بدون +)</label>
      <input v-model="waNumber" dir="ltr" inputmode="numeric" placeholder="مثال: 9647701234567">
      <p v-if="waPreview" class="hint">الزر سيفتح: <span dir="ltr">wa.me/{{ waPreview }}</span></p>
      <div class="btn-row">
        <button class="btn btn-primary" :disabled="waBusy" @click="saveWhatsapp">💾 حفظ رقم الدعم</button>
      </div>
    </div>

    <div class="card">
      <h3>🎲 التوزيع التلقائي — الإعدادات الافتراضية</h3>
      <p class="muted">هذه القيم تُستخدم كافتراضي عند إنشاء مهمة جديدة بتوزيع تلقائي، ويمكن تغييرها لكل مهمة على حدة.</p>
      <div class="grid-2">
        <div>
          <label>نمط التوزيع الافتراضي</label>
          <select v-model="defDist">
            <option value="lowest">⬇️ صاحب الأقل نقاطاً أولاً</option>
            <option value="random">🎲 عشوائي</option>
            <option value="all">👥 كل المؤهلين</option>
          </select>
        </div>
        <div>
          <label>عدد المعروض عليهم افتراضياً</label>
          <input v-model="defCount" type="number" min="1" max="50" class="input-sm">
        </div>
      </div>
      <div class="btn-row"><button class="btn btn-primary" @click="saveDistribution">💾 حفظ إعدادات التوزيع</button></div>
    </div>

    <div class="card">
      <h3>📬 إشعارات تيليكرام</h3>
      <p class="muted">الخادم يرسل الإشعارات تلقائياً عند: عرض مهمة، قبولها، رفضها، رفع تقرير، اعتماد أو رفض — حتى لو المتصفح مقفل، ومع كل إشعار رابط يفتح التطبيق مباشرة.</p>
      <label class="switch-row"><input type="checkbox" v-model="tgEnabled"> تشغيل الإشعارات</label>
      <label>Bot Token (من @BotFather) {{ s.hasToken ? `— محفوظ (${s.tokenMasked})` : '' }}</label>
      <input v-model="tgToken" dir="ltr" :placeholder="s.hasToken ? 'اتركه فارغاً للإبقاء على التوكن الحالي' : 'مثال: 7123456789:AAH8skfh...'">
      <label>معرفات المديرين Chat ID (مفصولة بفاصلة)</label>
      <input v-model="tgAdmins" dir="ltr" placeholder="مثال: 375486602,123456789">
      <p class="hint">اعرف معرفك من بوت <b>@userinfobot</b> — والموظف يجب أن يرسل <b>/start</b> للبوت أولاً حتى تصل إشعاراته</p>
      <div class="btn-row">
        <button class="btn btn-outline" @click="testTelegram">🔔 إرسال إشعار تجريبي</button>
        <button class="btn btn-primary" @click="saveTelegram">💾 حفظ الإعدادات</button>
      </div>
      <p class="hint">{{ tgStatus }}</p>
    </div>

    <div class="card">
      <h3>🔔 إشعارات المتصفح (Web Push)</h3>
      <p class="muted">مفعّلة تلقائياً — مفاتيح التشفير (VAPID) تُولد عند تشغيل الخادم. الموظف يفعّلها من <b>⚙️ إعداداتي ← 🔔 إشعارات المتصفح</b> ويعطي إذن المتصفح مرة واحدة، وتصله المهام الجديدة حتى لو الموقع مقفل — وعلى الموبايل حتى لو المتصفح مقفل كلياً.</p>
      <p class="hint">الإشعارات تعمل مع تيليكرام معاً — الموظف يستلم بالطريقتين</p>
    </div>

    <div class="card">
      <h3>🔧 إعدادات عامة</h3>
      <label>أقصى عدد مهام مفتوحة لكل موظف</label>
      <input v-model="maxActive" type="number" min="1" max="20" class="input-sm">
      <div class="btn-row"><button class="btn btn-primary" @click="saveGeneral">💾 حفظ</button></div>
    </div>

    <div class="card">
      <h3>🔑 كلمة مرور المدير</h3>
      <label>كلمة المرور الحالية</label>
      <input v-model="oldPass" type="password" autocomplete="off">
      <label>كلمة المرور الجديدة (6 أحرف على الأقل)</label>
      <input v-model="newPass" type="password" autocomplete="off">
      <label>تأكيد كلمة المرور الجديدة</label>
      <input v-model="newPass2" type="password" autocomplete="off">
      <div class="btn-row"><button class="btn btn-primary" @click="changePassword">تغيير كلمة المرور</button></div>
    </div>

    <div class="card">
      <h3>💾 النسخ الاحتياطي</h3>
      <p class="muted">نزّل نسخة كاملة من قاعدة البيانات (كل الموظفين والمهام والنقاط) واحفظها بمكان آمن — أو استورد نسخة سابقة لتنقل معلوماتك من نسخة إلى نسخة.</p>
      <div class="btn-row">
        <button class="btn btn-outline" :disabled="backingUp" @click="backup">⬇️ تنزيل نسخة احتياطية الآن</button>
      </div>

      <div class="detail-sec" style="margin-top:14px">
        <div class="lbl">⬆️ استيراد نسخة احتياطية (ملف .db)</div>
        <p class="muted" style="margin:6px 0">اختر ملف نسخة احتياطية سابقة — سيتم استبدال البيانات الحالية كاملة ببيانات الملف (تنبيه: تُسجّل خروج الجميع بعد الاستيراد)</p>
        <input type="file" accept=".db,.sqlite,.sqlite3" style="padding:8px" @change="pickRestore">
        <div class="btn-row">
          <button class="btn btn-danger" :disabled="restoring" @click="doRestore">
            {{ restoring ? '⏳ جاري الاستيراد...' : '⬆️ استيراد واستبدال البيانات' }}
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>ℹ️ معلومات النظام</h3>
      <p class="muted">
        🖥️ الوضع: خادم محلي — البيانات محفوظة على جهازك والإشعارات تُرسل من الخادم<br><br>
        📦 الإصدار: <b>v{{ APP_VERSION }}</b><br>
        🗂️ عدد المهام المخزنة: {{ store.tasks.length }}<br>
        👥 عدد الموظفين: {{ store.employees.length }}
      </p>
    </div>
  </section>
</template>
