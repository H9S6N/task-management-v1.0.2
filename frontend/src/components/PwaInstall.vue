<script setup>
/* v1.0.1+: تحميل التطبيق — يثبت النظام كتطبيق هاتف (PWA)
   يدعم الآيفون (Safari — إضافة للشاشة الرئيسية) والأندرويد (Chrome — تثبيت بضغطة واحدة)
   يظهر في: الإعدادات (المدير) + حسابي (الموظف ومدير المهام) */
import { computed } from 'vue'
import { useStore } from '../store.js'

const store = useStore()

const standalone = computed(() => store.isStandalone)
const isIos = computed(() => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const isAndroid = computed(() => /android/i.test(navigator.userAgent))

async function install() {
  const ok = await store.installPwa()
  if (!ok) store.toast('اختر التعليمات المناسبة لجهازك بالأسفل', 'err')
}
</script>

<template>
  <div class="card">
    <h3>📱 تحميل التطبيق — يعمل كتطبيق هاتف</h3>
    <p class="muted">
      ثبّت نظام المهام كتطبيق على شاشة هاتفك: يفتح بضغطة واحدة من أيقونته بدون متصفح،
      بكامل الشاشة وبدون تحميل من المتاجر — ويعمل على الآيفون والأندرويد.
    </p>

    <!-- مثبت من قبل -->
    <div v-if="standalone" class="detail-sec" style="background:var(--ok-bg)">
      ✅ <b>التطبيق مثبت على جهازك</b> — افتحه من أيقونة <b>«المهام»</b> على الشاشة الرئيسية
    </div>

    <template v-else>
      <!-- زر التثبيت الفوري (أندرويد / كروم / ديسكتوب) -->
      <div v-if="store.canInstallPwa" class="btn-row">
        <button class="btn btn-primary" @click="install">
          📲 تثبيت التطبيق الآن — بضغطة واحدة
        </button>
      </div>

      <!-- خطوات الجهازين -->
      <div class="grid-2" style="margin-top:12px">
        <div class="detail-sec" :style="isIos ? 'border:2px solid #047857' : ''">
          <div class="lbl">🍎 الآيفون (آيباد - Safari)</div>
          <ol class="steps">
            <li>افتح الموقع من متصفح <b>Safari</b></li>
            <li>اضغط زر <b>المشاركة</b> 📤 (أسفل الشاشة)</li>
            <li>انزل واختر <b>«إضافة إلى الشاشة الرئيسية»</b></li>
            <li>اضغط <b>«إضافة»</b> — تلقى أيقونة التطبيق على شاشتك</li>
          </ol>
          <p class="hint">مهم للآيفون: الإشعارات الفورية تشتغل بعد التثبيت — افتح التطبيق من أيقونته وفعّل الإشعارات</p>
        </div>
        <div class="detail-sec" :style="isAndroid ? 'border:2px solid #047857' : ''">
          <div class="lbl">🤖 الأندرويد (Chrome)</div>
          <ol class="steps">
            <li>افتح الموقع من متصفح <b>Chrome</b></li>
            <li>اضغط زر <b>القائمة</b> ⋮ (أعلى الشاشة)</li>
            <li>اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b></li>
            <li>أو اضغط زر <b>«تثبيت التطبيق الآن»</b> بالأعلى مباشرة</li>
          </ol>
          <p class="hint">بعد التثبيت يفتح النظام كتطبيق مستقل بكامل الشاشة مثل باقي تطبيقات جهازك</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.steps { margin: 6px 0 0; padding-right: 18px; display: grid; gap: 6px; }
.steps li { line-height: 1.6; }
</style>
