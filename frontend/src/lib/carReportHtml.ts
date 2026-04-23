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
  return s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
}

/**
 * Escape, bold, then strip *stray* leftover markdown markers (e.g. an unpaired
 * `**` that the model emitted). Prevents `* **Label** **` artefacts from
 * leaking into the rendered UI.
 */
function renderInline(raw: string): string {
  const escaped = escapeHtml(raw)
  const bolded = applyBold(escaped)
  return bolded
    .replace(/\*\*/g, '') // drop any remaining unpaired bold markers
    .replace(/^\s*\*\s+/, '') // drop leading bullet-style single *
    .replace(/\s+\*\s*$/, '') // drop trailing stray single *
    .trim()
}

function stripLeadingListMarker(s: string): string {
  return s
    .replace(/^\s*[-*•\u2022–—]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
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

const LOOSE_METRIC_COLON = /^(.+?)\s*[:：]\s*(.+?)\s*$/i
/** Matches "label 7/10" / "label N/A" / "**label** 7/10" without a colon. */
const LOOSE_METRIC_NOCOLON = /^(.+?)\s+(\d{1,2}\s*\/\s*10|N\/?A(?:\s*\([^)]*\))?)\s*\*{0,2}\s*$/i

const SCORE_LABEL_RE =
  /exterior|interior|engine|mechanical|condition|ratings?|damage|age|miles?|odometer|model|trim|score|market|price range|value|გარე|შიდა|ძრავ|მდგომ|ცვეთ|რეიტინგ|оценк|внешн|внутрен|двигат|состоян/i

function isScoreValue(v: string): boolean {
  const t = v.trim()
  if (/N\/?A/i.test(t)) return true
  if (/^\*{0,2}\s*\d{1,2}\s*\/\s*10\s*\*{0,2}$/.test(t)) return true
  if (/^\*{0,2}\s*(10|[0-9])\s*\*{0,2}$/.test(t)) return true
  return false
}

function formatMetricBlock(line: string): string {
  const cleaned = stripLeadingListMarker(line).trim()
  if (!cleaned) return ''

  let name = ''
  let valuePart = ''

  const colonMatch = cleaned.match(LOOSE_METRIC_COLON)
  if (colonMatch) {
    name = colonMatch[1].trim()
    valuePart = colonMatch[2].trim()
  } else {
    const noColon = cleaned.match(LOOSE_METRIC_NOCOLON)
    if (!noColon) return ''
    name = noColon[1].trim()
    valuePart = noColon[2].trim()
  }

  // Strip wrapping bold markers around the label so the name regex can recognise it.
  const nameClean = name.replace(/^\*+/, '').replace(/\*+$/, '').trim()
  if (!isScoreValue(valuePart)) return ''
  if (!/N\/?A/i.test(valuePart) && !SCORE_LABEL_RE.test(nameClean)) return ''

  const na = /N\/?A/i.test(valuePart)
  let num = 0
  if (!na) {
    const digits = valuePart.replace(/\*+/g, '').trim()
    const s10 = digits.match(/^(\d{1,2})\s*\/\s*10$/)
    const s1 = digits.match(/^(10|[0-9])$/)
    if (s10) num = Math.min(10, parseInt(s10[1], 10) || 0)
    else if (s1) num = Math.min(10, parseInt(s1[1], 10) || 0)
  }
  const pct = na ? 0 : num * 10
  const valShow = na
    ? valuePart.replace(/\*+/g, '').trim()
    : /\/\s*10/.test(valuePart)
      ? valuePart.replace(/\*+/g, '').trim()
      : `${num}/10`
  return [
    `<div class="cr-metric" ${na ? 'data-na="1"' : ''} style="--cr-metric-pct: ${pct}">`,
    `<div class="cr-metric__row">`,
    `<span class="cr-metric__name">${renderInline(nameClean)}</span>`,
    `<span class="cr-metric__val">${renderInline(valShow)}</span>`,
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
        `<li class="cr-bullets__item"><span class="cr-bullets__dot" aria-hidden="true"></span><span class="cr-bullets__text">${renderInline(item)}</span></li>`
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
        out.push(`<p class="cr-para cr-para--note">${renderInline(rest)}</p>`)
      }
      continue
    }

    // Section heading
    if (isHeadingLine(t)) {
      flushAll()
      const label = t
        .replace(/\*\*/g, '')
        .replace(/^\s*[-*•\u2022–—]\s+/, '')
        .replace(/[:：.]\s*$/, '')
        .trim()
      out.push(`<h3 class="cr-heading">${renderInline(label)}</h3>`)
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
      const item = stripLeadingListMarker(t)
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
    out.push(`<p class="cr-para">${renderInline(line)}</p>`)
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
