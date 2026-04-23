/** Safe HTML for vehicle / car review style assistant messages. */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function applyBold(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

/** Heuristic: use rich report when it looks like our vehicle assessment output. */
export function isVehicleReportText(raw: string): boolean {
  if (!raw || raw.length < 30) return false
  if (!/Overall\s*grade\s*:\s*[A-Fa-f]/i.test(raw)) return false
  if (raw.length > 180) return true
  return /Ratings|\/\s*10|1\s*[-–]\s*10|Exterior|Interior|Engine|market|damage|estimate|verdict/i.test(
    raw
  )
}

/** English + Georgian + Russian headings we want to render as section titles. */
const HEADING_PATTERNS: RegExp[] = [
  /^ratings?\b/i,
  /^damage(\s+assessment)?\b/i,
  /^market(\s+value)?\b/i,
  /^value(\s+estimate)?\b/i,
  /^vehicle(\s+details)?\b/i,
  /^recommendation\b/i,
  /^notes?\b/i,
  /^verdict\b/i,
  // Georgian
  /^შეფასება/u,
  /^დაზიანება/u,
  /^ბაზრის/u,
  /^ღირებულება/u,
  /^რეკომენდაცი/u,
  /^რეიტინგ/u,
  // Russian
  /^оценк/i,
  /^поврежден/i,
  /^рыночн/i,
  /^рекоменд/i,
]

function isHeadingLine(t: string): boolean {
  const clean = t.replace(/\*/g, '').replace(/[:：.]\s*$/, '').trim()
  if (!clean) return false
  if (clean.length > 48) return false
  if (/^[-*•\u2022–—]\s+/.test(t)) return false
  if (/\d\s*\/\s*10/.test(clean)) return false
  // Entirely-bold line is usually a section heading
  const boldOnly = /^\*\*[^*]+\*\*\s*:?$/.test(t)
  if (boldOnly) return true
  return HEADING_PATTERNS.some((re) => re.test(clean))
}

const LOOSE_METRIC = /^(.+?)\s*[:：]\s*(.+?)\s*$/i

const SCORE_LABEL_RE =
  /exterior|interior|engine|mechanical|condition|ratings?|damage|age|miles?|odometer|model|trim|score|market|price range|value|გარე|შიდა|ძრავ|მდგომ|ცვეთ|რეიტინგ|оценк|внешн|внутрен|двигат|состоян/i

function isLikelyScoreLine(label: string, valuePart: string): boolean {
  const v = valuePart.trim()
  if (/N\/?A/i.test(v)) return true
  if (/\/\s*10/.test(v)) return true
  if (/^(\d{1,2})\s*\/\s*10$/.test(v) || /^(10|[0-9])$/.test(v)) {
    const n = parseInt(v, 10)
    if (n >= 0 && n <= 10) return SCORE_LABEL_RE.test(label)
  }
  return false
}

function formatMetricBlock(line: string): string {
  const m = line.match(LOOSE_METRIC)
  if (!m) return ''
  const name = m[1].trim()
  const valuePart = m[2].trim()
  if (!isLikelyScoreLine(name, valuePart)) return ''

  const na = /N\/?A/i.test(valuePart)
  let num = 0
  if (!na) {
    const s10 = valuePart.match(/^(\d{1,2})\s*\/\s*10$/)
    const s1 = valuePart.match(/^(10|[0-9])$/)
    if (s10) num = Math.min(10, parseInt(s10[1], 10) || 0)
    else if (s1) num = Math.min(10, parseInt(s1[1], 10) || 0)
  }
  const pct = na ? 0 : num * 10
  const valShow = /\/\s*10/.test(valuePart) || na ? valuePart : `${num}/10`
  return [
    `<div class="cr-metric" ${na ? 'data-na="1"' : ''} style="--cr-metric-pct: ${pct}">`,
    `<div class="cr-metric__row">`,
    `<span class="cr-metric__name">${applyBold(escapeHtml(name))}</span>`,
    `<span class="cr-metric__val">${applyBold(escapeHtml(valShow))}</span>`,
    `</div>`,
    `<div class="cr-metric__track" role="presentation"><div class="cr-metric__fill"></div></div>`,
    `</div>`,
  ].join('')
}

/**
 * Renders a structured, accessible vehicle report. Input is raw assistant text; output is safe HTML.
 */
export function formatCarReportHtml(raw: string): string {
  const lines = raw.split(/\r?\n/)
  const out: string[] = []
  let bul: string[] = []
  let metrics: string[] = []

  const flushBul = () => {
    if (!bul.length) return
    out.push('<ul class="cr-bullets">')
    for (const item of bul) {
      out.push(
        `<li class="cr-bullets__item"><span class="cr-bullets__dot" aria-hidden="true"></span><span class="cr-bullets__text">${applyBold(escapeHtml(item))}</span></li>`
      )
    }
    out.push('</ul>')
    bul = []
  }

  const flushMetrics = () => {
    if (!metrics.length) return
    out.push('<div class="cr-metrics">')
    out.push(metrics.join(''))
    out.push('</div>')
    metrics = []
  }

  const flushAll = () => {
    flushBul()
    flushMetrics()
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()

    if (t === '') {
      flushAll()
      const last = out[out.length - 1]
      if (last && last !== '<div class="cr-gap"></div>') out.push('<div class="cr-gap"></div>')
      continue
    }

    // Verdict line — rendered as a hero card
    const overallM = t.match(/Overall\s*grade\s*:\s*([A-Fa-f])/i)
    if (overallM) {
      flushAll()
      const letter = (overallM[1] || 'A').toUpperCase()
      const rest = t
        .replace(/\*+/g, '')
        .replace(/Overall\s*grade\s*:\s*[A-Fa-f]\s*/i, '')
        .trim()
      out.push(
        [
          `<div class="cr-verdict cr-verdict--${letter}" role="status">`,
          `<div class="cr-verdict__card">`,
          `<p class="cr-verdict__eyebrow">Verdict</p>`,
          `<p class="cr-verdict__grade" aria-label="Overall grade ${letter}">${letter}</p>`,
          `<p class="cr-verdict__sub">Overall grade</p>`,
          `</div>`,
          `</div>`,
        ].join('')
      )
      if (rest) {
        out.push(`<p class="cr-para cr-para--note">${applyBold(escapeHtml(rest))}</p>`)
      }
      continue
    }

    // Section heading
    if (isHeadingLine(t)) {
      flushAll()
      const label = t
        .replace(/\*\*/g, '')
        .replace(/[:：.]\s*$/, '')
        .trim()
      out.push(`<h3 class="cr-heading">${applyBold(escapeHtml(label))}</h3>`)
      continue
    }

    // Metric row (Label: 7/10 or "N/A")
    const metric = formatMetricBlock(t)
    if (metric) {
      flushBul()
      metrics.push(metric)
      continue
    }
    flushMetrics()

    // Bullet / numbered list
    if (/^[-*•\u2022–—]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const item = t.replace(/^[-*•\u2022–—]\s+/, '').replace(/^\d+[.)]\s+/, '')
      // If it's secretly a score line inside bullets, promote to a metric card.
      const maybeMetric = formatMetricBlock(item)
      if (maybeMetric) {
        flushBul()
        metrics.push(maybeMetric)
      } else {
        bul.push(item)
      }
      continue
    }
    flushBul()

    // Fallback paragraph
    out.push(`<p class="cr-para">${applyBold(escapeHtml(line))}</p>`)
  }
  flushAll()
  return `<div class="cr-report">${out.join('')}</div>`
}

export function defaultAssistantHtml(raw: string): string {
  let s = escapeHtml(raw)
  s = applyBold(s)
  s = s.replace(
    /(^|\n)Overall\s*grade\s*:\s*([A-Fa-f])(?=\s|$|[\s.!?(])/gim,
    (_m, lead, letter) => {
      const L = String(letter).toUpperCase()
      return `${lead}Overall grade: <span class="ov-grade grade-${L}">${L}</span>`
    }
  )
  return s.replace(/\n/g, '<br />')
}

export function formatAssistantMessageHtml(raw: string): string {
  if (isVehicleReportText(raw)) return formatCarReportHtml(raw)
  return defaultAssistantHtml(raw)
}
