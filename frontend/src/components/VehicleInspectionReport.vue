<script setup lang="ts">
import { computed } from 'vue'
import type { Grade, VehicleInspectionReport } from '../lib/vehicle-report'

type Tone = 'good' | 'ok' | 'warn' | 'bad' | 'neutral'

type GradeItem = {
  key: string
  label: string
  grade: Grade
}

type BooleanItem = {
  key: string
  label: string
  value: boolean
  trueLabel: string
  falseLabel: string
  trueTone: Tone
  falseTone: Tone
}

type CategoryCard = {
  key: string
  title: string
  eyebrow: string
  gradeItems: GradeItem[]
  booleanItems?: BooleanItem[]
}

const props = defineProps<{
  report: VehicleInspectionReport
}>()

const vehicleName = computed(() => {
  const name = `${props.report.vehicle.make} ${props.report.vehicle.model}`.trim()
  return name || 'Vehicle'
})

const gradeTone = computed<Tone>(() => {
  const grade = props.report.summary.overallGrade
  if (grade === 'A' || grade === 'B') return 'good'
  if (grade === 'C') return 'neutral'
  if (grade === 'D') return 'warn'
  return 'bad'
})

const confidenceTone = computed<Tone>(() => {
  const confidence = props.report.vehicle.modelConfidence
  if (confidence === 'high') return 'good'
  if (confidence === 'medium') return 'warn'
  return 'bad'
})

const categoryCards = computed<CategoryCard[]>(() => {
  const inspection = props.report.inspection

  return [
    {
      key: 'interior',
      title: 'Interior',
      eyebrow: 'Cabin condition',
      gradeItems: [
        { key: 'steeringWheelCondition', label: 'Steering wheel', grade: inspection.interior.steeringWheelCondition },
        { key: 'seatCondition', label: 'Seats', grade: inspection.interior.seatCondition },
        { key: 'ceilingAndPillars', label: 'Ceiling and pillars', grade: inspection.interior.ceilingAndPillars },
      ],
      booleanItems: [
        {
          key: 'controlPanel',
          label: 'Control panel',
          value: inspection.interior.controlPanel,
          trueLabel: 'Visible / confirmed',
          falseLabel: 'Not confirmed',
          trueTone: 'good',
          falseTone: 'neutral',
        },
        {
          key: 'multimediaScreen',
          label: 'Multimedia screen',
          value: inspection.interior.multimediaScreen,
          trueLabel: 'Visible / confirmed',
          falseLabel: 'Not confirmed',
          trueTone: 'good',
          falseTone: 'neutral',
        },
      ],
    },
    {
      key: 'exterior',
      title: 'Exterior',
      eyebrow: 'Body and lighting',
      gradeItems: [
        { key: 'hood', label: 'Hood', grade: inspection.exterior.hood },
        { key: 'frontBumper', label: 'Front bumper', grade: inspection.exterior.frontBumper },
        { key: 'headlightsLeft', label: 'Left headlight', grade: inspection.exterior.headlights.left },
        { key: 'headlightsRight', label: 'Right headlight', grade: inspection.exterior.headlights.right },
        { key: 'frontFenders', label: 'Front fenders', grade: inspection.exterior.frontFenders },
        { key: 'windshield', label: 'Windshield', grade: inspection.exterior.windshield },
        { key: 'frontDoorLeft', label: 'Left front door', grade: inspection.exterior.frontDoors.left },
        { key: 'frontDoorRight', label: 'Right front door', grade: inspection.exterior.frontDoors.right },
        { key: 'rearDoorLeft', label: 'Left rear door', grade: inspection.exterior.rearDoors.left },
        { key: 'rearDoorRight', label: 'Right rear door', grade: inspection.exterior.rearDoors.right },
        { key: 'sideSillsThresholds', label: 'Side sills / thresholds', grade: inspection.exterior.sideSillsThresholds },
        { key: 'roof', label: 'Roof', grade: inspection.exterior.roof },
        { key: 'rearFenders', label: 'Rear fenders', grade: inspection.exterior.rearFenders },
        { key: 'taillights', label: 'Taillights', grade: inspection.exterior.taillights },
        {
          key: 'trunkLidAndRearBumper',
          label: 'Trunk lid and rear bumper',
          grade: inspection.exterior.trunkLidAndRearBumper,
        },
      ],
    },
    {
      key: 'electronicPanel',
      title: 'Electronic / Panel',
      eyebrow: 'Panel status',
      gradeItems: [],
      booleanItems: [
        {
          key: 'dashboardIndicators',
          label: 'Dashboard indicators',
          value: inspection.electronicPanel.dashboardIndicators,
          trueLabel: 'Indicators visible',
          falseLabel: 'Not confirmed',
          trueTone: 'good',
          falseTone: 'warn',
        },
        {
          key: 'checkEngineLight',
          label: 'Check engine light',
          value: inspection.electronicPanel.checkEngineLight,
          trueLabel: 'Warning active',
          falseLabel: 'Clear',
          trueTone: 'bad',
          falseTone: 'good',
        },
        {
          key: 'airbags',
          label: 'Airbag system',
          value: inspection.electronicPanel.airbags,
          trueLabel: 'Present / no visible fault',
          falseLabel: 'Not confirmed',
          trueTone: 'good',
          falseTone: 'warn',
        },
        {
          key: 'absBrakeSystem',
          label: 'ABS / brake system',
          value: inspection.electronicPanel.absBrakeSystem,
          trueLabel: 'Present / no visible fault',
          falseLabel: 'Not confirmed',
          trueTone: 'good',
          falseTone: 'warn',
        },
      ],
    },
    {
      key: 'technicalDetails',
      title: 'Technical Details',
      eyebrow: 'Visible mechanical clues',
      gradeItems: [
        { key: 'wheelsAndTires', label: 'Wheels and tires', grade: inspection.technicalDetails.wheelsAndTires },
        { key: 'fluidLeakTraces', label: 'Fluid leak traces', grade: inspection.technicalDetails.fluidLeakTraces },
      ],
    },
  ]
})

function scoreTone(grade: Grade): Tone {
  if (grade >= 8) return 'good'
  if (grade >= 6) return 'neutral'
  if (grade >= 4) return 'warn'
  return 'bad'
}

function scorePercent(grade: Grade): string {
  return `${grade * 10}%`
}

function chipTone(item: BooleanItem): Tone {
  return item.value ? item.trueTone : item.falseTone
}

function chipLabel(item: BooleanItem): string {
  return item.value ? item.trueLabel : item.falseLabel
}

function formatRange(range: { min: number; max: number }, currency: 'GEL' | 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US')
  return `${currency} ${formatter.format(range.min)} - ${formatter.format(range.max)}`
}
</script>

<template>
  <article class="report" :aria-label="`Vehicle inspection report for ${vehicleName}`">
    <section class="summary" :data-tone="gradeTone" aria-label="Vehicle inspection summary">
      <div class="grade-lockup">
        <div
          class="grade-badge"
          :aria-label="`Overall grade ${report.summary.overallGrade}`"
        >
          {{ report.summary.overallGrade }}
        </div>
        <div class="summary-copy">
          <p class="eyebrow">Structured inspection</p>
          <h2>{{ vehicleName }}</h2>
          <p class="recommendation">{{ report.summary.recommendation }}</p>
        </div>
      </div>

      <dl class="summary-grid" aria-label="Vehicle and market details">
        <div class="summary-stat">
          <dt>Year estimate</dt>
          <dd>{{ report.vehicle.yearEstimate }}</dd>
        </div>
        <div class="summary-stat">
          <dt>Mileage estimate</dt>
          <dd>{{ report.vehicle.mileageEstimate }}</dd>
        </div>
        <div class="summary-stat">
          <dt>Model confidence</dt>
          <dd>
            <span class="chip" :data-tone="confidenceTone">
              {{ report.vehicle.modelConfidence }}
            </span>
          </dd>
        </div>
        <div class="summary-stat summary-stat--market">
          <dt>Market value</dt>
          <dd>
            <span>{{ formatRange(report.market.valueRangeGel, 'GEL') }}</span>
            <span v-if="report.market.valueRangeUsd" class="subvalue">
              {{ formatRange(report.market.valueRangeUsd, 'USD') }}
            </span>
          </dd>
        </div>
      </dl>
    </section>

    <section class="categories" aria-label="Inspection categories">
      <section
        v-for="card in categoryCards"
        :key="card.key"
        class="category-card"
        :class="{ 'category-card--panel': !card.gradeItems.length }"
      >
        <div class="category-head">
          <p>{{ card.eyebrow }}</p>
          <h3>{{ card.title }}</h3>
        </div>

        <div v-if="card.gradeItems.length" class="score-list">
          <div
            v-for="item in card.gradeItems"
            :key="item.key"
            class="score-row"
            :data-tone="scoreTone(item.grade)"
          >
            <div class="score-meta">
              <span class="score-label">{{ item.label }}</span>
              <span class="score-pill">{{ item.grade }}/10</span>
            </div>
            <div
              class="score-track"
              role="meter"
              :aria-label="`${item.label} condition score ${item.grade} out of 10`"
              aria-valuemin="1"
              aria-valuemax="10"
              :aria-valuenow="item.grade"
            >
              <span class="score-fill" :style="{ width: scorePercent(item.grade) }" />
            </div>
          </div>
        </div>

        <div v-if="card.booleanItems?.length" class="chip-list">
          <div v-for="item in card.booleanItems" :key="item.key" class="status-row">
            <span class="status-label">{{ item.label }}</span>
            <span
              class="chip"
              :data-tone="chipTone(item)"
              :aria-label="`${item.label}: ${chipLabel(item)}`"
            >
              {{ chipLabel(item) }}
            </span>
          </div>
        </div>
      </section>
    </section>

    <section class="supporting" aria-label="Supporting inspection notes">
      <div class="support-card">
        <h3>Visible Damage Notes</h3>
        <ul v-if="report.summary.visibleDamageNotes.length">
          <li v-for="note in report.summary.visibleDamageNotes" :key="note">{{ note }}</li>
        </ul>
        <p v-else class="empty-note">No visible damage notes were provided.</p>
      </div>

      <div class="support-card">
        <h3>Market Caveats</h3>
        <ul v-if="report.market.caveats.length">
          <li v-for="caveat in report.market.caveats" :key="caveat">{{ caveat }}</li>
        </ul>
        <p v-else class="empty-note">No market caveats were provided.</p>
      </div>

      <div class="support-card">
        <h3>Accuracy Inputs</h3>
        <ul v-if="report.summary.accuracyInputs.length">
          <li v-for="input in report.summary.accuracyInputs" :key="input">{{ input }}</li>
        </ul>
        <p v-else class="empty-note">No accuracy inputs were provided.</p>
      </div>
    </section>
  </article>
</template>

<style scoped>
.report {
  width: min(100%, 880px);
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 15px;
  line-height: 1.5;
  white-space: normal;
}

.summary {
  --tone-1: var(--accent);
  --tone-2: var(--accent-2);
  --tone-fg: var(--accent);

  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--tone-2) 32%, var(--border));
  border-radius: 24px;
  padding: 20px;
  background:
    radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--tone-1) 18%, transparent), transparent 36%),
    linear-gradient(135deg, color-mix(in srgb, var(--tone-1) 10%, var(--surface)), var(--surface));
  box-shadow:
    inset 4px 0 0 var(--tone-2),
    0 16px 44px color-mix(in srgb, var(--tone-2) 12%, transparent),
    var(--shadow);
}

.summary[data-tone='good'] {
  --tone-1: #34d399;
  --tone-2: #059669;
  --tone-fg: #047857;
}

.summary[data-tone='neutral'] {
  --tone-1: #60a5fa;
  --tone-2: #2563eb;
  --tone-fg: #1d4ed8;
}

.summary[data-tone='warn'] {
  --tone-1: #fbbf24;
  --tone-2: #d97706;
  --tone-fg: #b45309;
}

.summary[data-tone='bad'] {
  --tone-1: #f87171;
  --tone-2: #dc2626;
  --tone-fg: #b91c1c;
}

[data-theme='dark'] .summary[data-tone='good'] {
  --tone-fg: #6ee7b7;
}

[data-theme='dark'] .summary[data-tone='neutral'] {
  --tone-fg: #93c5fd;
}

[data-theme='dark'] .summary[data-tone='warn'] {
  --tone-fg: #fcd34d;
}

[data-theme='dark'] .summary[data-tone='bad'] {
  --tone-fg: #fca5a5;
}

.grade-lockup {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  align-items: center;
}

.grade-badge {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  color: #fff;
  font-size: 2.7rem;
  font-weight: 850;
  line-height: 1;
  letter-spacing: -0.08em;
  background: linear-gradient(145deg, var(--tone-1), var(--tone-2));
  box-shadow:
    0 0 0 5px color-mix(in srgb, var(--tone-2) 14%, transparent),
    0 12px 28px color-mix(in srgb, var(--tone-2) 28%, transparent);
}

.summary-copy {
  min-width: 0;
}

.eyebrow,
.category-head p {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.summary h2,
.category-head h3,
.support-card h3 {
  margin: 0;
  color: var(--text);
  letter-spacing: -0.025em;
}

.summary h2 {
  margin-top: 2px;
  font-size: clamp(1.45rem, 4vw, 2.15rem);
  line-height: 1.08;
}

.recommendation {
  max-width: 68ch;
  margin: 8px 0 0;
  color: color-mix(in srgb, var(--text) 86%, var(--muted));
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 18px 0 0;
}

.summary-stat {
  min-width: 0;
  margin: 0;
  padding: 13px 14px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
}

.summary-stat--market {
  grid-column: span 2;
}

.summary-stat dt {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary-stat dd {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  margin: 0;
  color: var(--text);
  font-weight: 700;
  overflow-wrap: anywhere;
}

.subvalue {
  color: var(--muted);
  font-size: 13px;
  font-weight: 650;
}

.categories {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.category-card,
.support-card {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--assistant-bubble);
  box-shadow: var(--shadow);
}

.category-card {
  padding: 16px;
}

.category-card--panel {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 36%, transparent), transparent 48%),
    var(--assistant-bubble);
}

.category-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 74%, transparent);
}

.category-head h3,
.support-card h3 {
  font-size: 1.02rem;
}

.score-list,
.chip-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.score-row {
  --score-1: var(--accent);
  --score-2: var(--accent-2);
  --score-fg: var(--accent);

  display: grid;
  gap: 8px;
  padding: 10px 0;
}

.score-row + .score-row,
.status-row + .status-row {
  border-top: 1px solid color-mix(in srgb, var(--border) 64%, transparent);
}

.score-row[data-tone='good'] {
  --score-1: #34d399;
  --score-2: #059669;
  --score-fg: #047857;
}

.score-row[data-tone='neutral'] {
  --score-1: #60a5fa;
  --score-2: #2563eb;
  --score-fg: #1d4ed8;
}

.score-row[data-tone='warn'] {
  --score-1: #fbbf24;
  --score-2: #d97706;
  --score-fg: #b45309;
}

.score-row[data-tone='bad'] {
  --score-1: #f87171;
  --score-2: #dc2626;
  --score-fg: #b91c1c;
}

[data-theme='dark'] .score-row[data-tone='good'] {
  --score-fg: #6ee7b7;
}

[data-theme='dark'] .score-row[data-tone='neutral'] {
  --score-fg: #93c5fd;
}

[data-theme='dark'] .score-row[data-tone='warn'] {
  --score-fg: #fcd34d;
}

[data-theme='dark'] .score-row[data-tone='bad'] {
  --score-fg: #fca5a5;
}

.score-meta,
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.score-label,
.status-label {
  min-width: 0;
  color: var(--text);
  font-weight: 650;
}

.score-pill,
.chip {
  flex: 0 0 auto;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
}

.score-pill {
  padding: 4px 10px;
  color: var(--score-fg);
  background: color-mix(in srgb, var(--score-2) 12%, transparent);
}

.score-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 18%, transparent);
}

.score-fill {
  display: block;
  height: 100%;
  min-width: 5px;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--score-1), var(--score-2));
}

.chip {
  padding: 5px 10px;
  border: 1px solid transparent;
  text-transform: capitalize;
}

.chip[data-tone='good'] {
  color: #047857;
  border-color: color-mix(in srgb, #059669 24%, transparent);
  background: color-mix(in srgb, #34d399 14%, transparent);
}

.chip[data-tone='neutral'] {
  color: color-mix(in srgb, var(--muted) 88%, var(--text));
  border-color: color-mix(in srgb, var(--border) 78%, transparent);
  background: color-mix(in srgb, var(--surface-2) 58%, transparent);
}

.chip[data-tone='warn'] {
  color: #b45309;
  border-color: color-mix(in srgb, #d97706 24%, transparent);
  background: color-mix(in srgb, #fbbf24 16%, transparent);
}

.chip[data-tone='bad'] {
  color: #b91c1c;
  border-color: color-mix(in srgb, #dc2626 24%, transparent);
  background: color-mix(in srgb, #f87171 14%, transparent);
}

[data-theme='dark'] .chip[data-tone='good'] {
  color: #6ee7b7;
}

[data-theme='dark'] .chip[data-tone='warn'] {
  color: #fcd34d;
}

[data-theme='dark'] .chip[data-tone='bad'] {
  color: #fca5a5;
}

.status-row {
  padding: 10px 0;
}

.supporting {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.support-card {
  padding: 16px;
}

.support-card ul {
  display: grid;
  gap: 9px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.support-card li {
  position: relative;
  padding-left: 16px;
  color: color-mix(in srgb, var(--text) 88%, var(--muted));
}

.support-card li::before {
  content: '';
  position: absolute;
  top: 0.72em;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
}

.empty-note {
  margin: 12px 0 0;
  color: var(--muted);
}

@media (max-width: 760px) {
  .summary-grid,
  .categories,
  .supporting {
    grid-template-columns: 1fr;
  }

  .summary-stat--market {
    grid-column: auto;
  }
}

@media (max-width: 520px) {
  .report {
    gap: 12px;
  }

  .summary,
  .category-card,
  .support-card {
    border-radius: 18px;
    padding: 15px;
  }

  .grade-lockup {
    grid-template-columns: 1fr;
  }

  .grade-badge {
    width: 62px;
    height: 62px;
    border-radius: 18px;
    font-size: 2.25rem;
  }

  .score-meta,
  .status-row,
  .category-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
