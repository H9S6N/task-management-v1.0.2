<script setup>
/* حسابي — v1.0.2
   الموظف: يغير كلمة مروره واسم المستخدم (الاسم ثابت — يغيره المدير فقط)
   مدير المهام: يغير كلمة مروره
   v1.0.1+: تحميل التطبيق (PWA) + الدعم والتواصل أسفل الصفحة */
import { ref, computed } from 'vue'
import { useStore } from '../../store.js'
import { pointsFmt } from '../../utils.js'
import PwaInstall from '../PwaInstall.vue'

const store = useStore()
const isMgr = computed(() => store.isManager)

const oldPass = ref('')
const newPass = ref('')
const newPass2 = ref('')
const newUsername = ref(store.me?.username || '')
const busy = ref(false)

const pushOn = computed(() => store.pushState === 'granted')

async function save() {
  if (newPass.value || newPass2.value) {
    if (newPass.value !== newPass2.value) { store.toast('التأكيد غير مطابق', 'err'); return }
    if (newPass.value.length < 4) { store.toast('كلمة المرور 4 أحرف على الأقل', 'err'); return }
  }
  const body = { oldPassword: oldPass.value }
  if (newPass.value) body.newPassword = newPass.value
  if (!isMgr.value && newUsername.value.trim() && newUsername.value.trim() !== (store.me?.username || '')) {
    body.username = newUsername.value.trim()
  }
  busy.value = true
  try {
    await store.changeMyCredentials(body)
    store.toast('تم تحديث بيانات حسابك ✅', 'ok')
    oldPass.value = newPass.value = newPass2.value = ''
  } catch { /* التوست من store */ }
  busy.value = false
}

async function testPush() {
  const r = await store.testPush()
  if (r?.ok) store.toast('أرسلنا لك إشعار تجريبي — شوف شاشتك 🔔', 'ok')
  else store.toast(r?.error || 'ما تم الإرسال', 'err')
}
</script>

<template>
  <section>
    <h2 class="sec-title">🔑 حسابي</h2>

    <div class="stats-grid" v-if="!isMgr">
      <div class="stat"><div class="num">⭐ {{ pointsFmt(store.me?.totalPoints) }}</div><div class="lbl">رصيد نقاطي</div></div>
      <div class="stat"><div class="num">✅ {{ store.me?.tasksCompleted || 0 }}</div><div class="lbl">مهام مكتملة</div></div>
      <div class="stat"><div class="num">❌ {{ store.me?.tasksRejected || 0 }}</div><div class="lbl">مهام مرفوضة</div></div>
    </div>

    <div class="card">
      <h3>👤 بياناتي</h3>
      <div class="detail-sec">
        <p>الاسم: <b>{{ store.me?.fullName }}</b> <span class="muted">(ثابت — يغيره المدير فقط)</span></p>
        <p v-if="store.me?.username">اسم المستخدم: <b>@{{ store.me.username }}</b></p>
      </div>

      <label>اسم المستخدم (اختياري — تدخل به بدل اسمك)</label>
      <input v-model="newUsername" maxlength="40" :disabled="isMgr">
      <p v-if="isMgr" class="hint">اسم المستخدم لمدير المهام يغيره المدير العام</p>

      <label>{{ isMgr ? 'كلمة المرور' : 'كلمة المرور' }} الحالية *</label>
      <input v-model="oldPass" type="password" autocomplete="off">
      <label>كلمة المرور الجديدة (4 أحرف على الأقل — اتركها فارغة للإبقاء)</label>
      <input v-model="newPass" type="password" autocomplete="off">
      <label>تأكيد الجديد</label>
      <input v-model="newPass2" type="password" autocomplete="off">

      <div class="form-actions">
        <button class="btn btn-primary" :disabled="busy" @click="save">💾 حفظ التغييرات</button>
      </div>
    </div>

    <div v-if="!isMgr" class="card">
      <h3>🔔 إشعارات المتصفح</h3>
      <p class="muted">
        {{ pushOn
          ? '✅ مفعلة — تصلك المهام فوراً حتى لو المتصفح مسكر'
          : 'فعّل الإشعارات حتى توصلك المهام الجديدة ونتائج الاعتماد فوراً' }}
      </p>
      <div class="btn-row">
        <button v-if="!pushOn" class="btn btn-primary" @click="store.enablePush()">🔔 تفعيل الإشعارات</button>
        <button v-else class="btn btn-outline" @click="testPush">🧪 إشعار تجريبي</button>
      </div>
      <p class="hint">على الآيفون: ثبّت التطبيق من البطاقة بالأسفل ثم افتحه من أيقونته وفعّل الإشعارات</p>
    </div>

    <!-- v1.0.1+: تحميل التطبيق — يعمل كتطبيق هاتف -->
    <PwaInstall />

    <!-- v1.0.1+: الدعم والتواصل — مكانه الوحيد أسفل حسابي -->
    <div class="card">
      <h3>💬 الدعم والتواصل</h3>
      <p class="muted">أي ملاحظة أو مشكلة بالتطبيق أو بالمهام؟ راسل الدعم مباشرة على واتساب.</p>
      <a v-if="store.whatsappUrl" class="btn btn-wa" :href="store.whatsappUrl" target="_blank" rel="noopener">
        <svg viewBox="0 0 32 32" width="20" height="20" fill="#fff" aria-hidden="true">
          <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.9 5.1 2.4 7.1L4 29l7.3-2.3c1.9 1 4 1.6 6.2 1.6h.5c6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-2 0-3.9-.6-5.5-1.6l-.4-.2-4.3 1.4 1.4-4.1-.3-.4c-1.2-1.7-1.9-3.7-1.9-5.9C5 9.4 9.9 4.6 16 4.6S27 9.4 27 15.9s-4.9 8.9-11 8.9zm6.1-6.6c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.3-.7.1-.3-.2-1.4-.5-2.7-1.7-1-1.2-1.7-2.6-1.9-3-.2-.4 0-.5.2-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.5 3.9 6.1 5.3.9.3 1.5.5 2 .7.9.2 1.7.2 2.3.1.7-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.2-.3-.2-.6-.4z"/>
        </svg>
        مراسلة الدعم على واتساب
      </a>
      <p v-else class="hint">لم يُضف رقم الدعم بعد — راجع المدير</p>
    </div>
  </section>
</template>
