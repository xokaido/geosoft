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

/** Private-use unicode sentinels so we can mask pre-escape tokens safely. */
const TOKEN_OPEN = '\uF000'
const TOKEN_CLOSE = '\uF001'

/**
 * Render a paragraph with automatic semantic highlighting of money, mileage and
 * model-year values so users can scan the prose quickly.
 */
function renderInlineWithEmphasis(raw: string): string {
  const currencyPatterns: RegExp[] = [
    // $1,500 / $1,500.00 optionally with a range like "$1,500 to $3,500" or "$1,500 - $3,500"
    /\$\s?\d[\d,.]*(?:\s*(?:-|–|—|to|და|до)\s*\$?\s?\d[\d,.]*)?/giu,
    // Number followed by currency (works with Latin, Georgian, Russian, and Arabic-script fallbacks).
    /\d[\d,.]*(?:\s*(?:-|–|—|to|და|до)\s*\d[\d,.]*)?\s?(?:USD|EUR|GEL|ლარი|ლარ|დოლარი|დოლარ|ევრო|ევრ|лар[иия]?|дол(?:лар[аовы]*)?|евр[оа]|€|₾)/giu,
    // Currency word followed by number: USD 1,500 / ₾ 1,500 / დოლარი 1,500
    /(?:USD|EUR|GEL|₾|€|ლარი|ლარ|დოლარი|დოლ|ევრო|ევრ|лар[иия]?|дол(?:лар[аовы]*)?|евр[оа])\s?\d[\d,.]*(?:\s*(?:-|–|—|to|და|до)\s*\d[\d,.]*)?/giu,
    // Mileage: 150,000 miles / 150,000 km / 150,000 კმ / 150,000 км
    /\d[\d,.]*\s?(?:miles?|mi\b|km\b|kilometers?|კმ|км)/giu,
  ]

  const tokens: string[] = []
  let masked = raw
  for (const pattern of currencyPatterns) {
    masked = masked.replace(pattern, (match) => {
      const idx = tokens.length
      tokens.push(match)
      return `${TOKEN_OPEN}${idx}${TOKEN_CLOSE}`
    })
  }

  let html = renderInline(masked)
  html = html.replace(new RegExp(`${TOKEN_OPEN}(\\d+)${TOKEN_CLOSE}`, 'g'), (_m, i) => {
    const token = tokens[parseInt(i, 10)] ?? ''
    return `<strong class="cr-num">${escapeHtml(token)}</strong>`
  })
  return html
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
  /^key\s+specs?\b/i,
  /^specifications?\b/i,
  /^recommendation\b/i,
  /^notes?\b/i,
  /^verdict\b/i,
  /^summary\b/i,
  // Georgian
  /^შეფასება/u,
  /^დაზიანება/u,
  /^ბაზრის/u,
  /^ღირებულება/u,
  /^რეკომენდაცი/u,
  /^რეიტინგ/u,
  /^დეტალ/u,
  /^სპეციფიკაცი/u,
  // Russian
  /^оценк/i,
  /^поврежден/i,
  /^рыночн/i,
  /^рекоменд/i,
  /^характерист/i,
  /^специфик/i,
]

function isHeadingLine(t: string): boolean {
  const clean = t.replace(/\*/g, '').replace(/[:：.]\s*$/, '').trim()
  if (!clean) return false
  if (clean.length > 48) return false
  if (/^[-*•\u2022–—]\s+/.test(t)) return false
  if (/\d\s*\/\s*10/.test(clean)) return false
  const boldOnly = /^\*\*[^*]+\*\*\s*:?$/.test(t)
  if (boldOnly) return true
  return HEADING_PATTERNS.some((re) => re.test(clean))
}

const LOOSE_METRIC_COLON = /^(.+?)\s*[:：]\s*(.+?)\s*$/i
/** Matches "label 7/10" / "label N/A" / "**label** 7/10" without a colon. */
const LOOSE_METRIC_NOCOLON = /^(.+?)\s+(\d{1,2}\s*\/\s*10|N\/?A(?:\s*\([^)]*\))?)\s*\*{0,2}\s*$/i

const SCORE_LABEL_RE =
  /exterior|interior|engine|mechanical|condition|ratings?|damage|score|გარე|შიდა|ძრავ|მდგომ|ცვეთ|რეიტინგ|оценк|внешн|внутрен|двигат|состоян/i

function isScoreValue(v: string): boolean {
  const t = v.trim()
  if (/N\/?A/i.test(t)) return true
  if (/^\*{0,2}\s*\d{1,2}\s*\/\s*10\s*\*{0,2}$/.test(t)) return true
  if (/^\*{0,2}\s*(10|[0-9])\s*\*{0,2}$/.test(t)) return true
  return false
}

function scoreTone(num: number): 'good' | 'ok' | 'warn' | 'bad' {
  if (num >= 8) return 'good'
  if (num >= 6) return 'ok'
  if (num >= 4) return 'warn'
  return 'bad'
}

function gradeTone(letter: string): 'good' | 'ok' | 'warn' | 'bad' {
  const L = letter.toUpperCase()
  if (L === 'A' || L === 'B') return 'good'
  if (L === 'C') return 'ok'
  if (L === 'D') return 'warn'
  return 'bad'
}

/**
 * Extract any trailing parenthetical explanation from the value so we can show
 * a compact pill ("N/A" or "7/10") and display the note on its own line.
 * Also handles bracketed notes without parens like "N/A — not visible".
 */
function splitValueAndNote(value: string): { pill: string; note: string } {
  const raw = value.replace(/\*+/g, '').trim()
  // Parenthetical: "N/A (reason)" → pill: "N/A", note: "reason"
  const paren = raw.match(/^([^()]+?)\s*\(\s*([^)]+?)\s*\)\s*$/)
  if (paren) return { pill: paren[1].trim(), note: paren[2].trim() }
  // Dash-separated: "N/A — reason" / "N/A - reason"
  const dash = raw.match(/^(N\/?A|\d{1,2}\s*\/\s*10|\d{1,2})\s*[–—-]\s*(.+)$/i)
  if (dash) return { pill: dash[1].trim(), note: dash[2].trim() }
  return { pill: raw, note: '' }
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

  const nameClean = name.replace(/^\*+/, '').replace(/\*+$/, '').trim()
  if (!isScoreValue(valuePart)) return ''
  if (!/N\/?A/i.test(valuePart) && !SCORE_LABEL_RE.test(nameClean)) return ''

  const { pill: pillRaw, note } = splitValueAndNote(valuePart)
  const na = /N\/?A/i.test(pillRaw)
  let num = 0
  if (!na) {
    const s10 = pillRaw.match(/^(\d{1,2})\s*\/\s*10$/)
    const s1 = pillRaw.match(/^(10|[0-9])$/)
    if (s10) num = Math.min(10, parseInt(s10[1], 10) || 0)
    else if (s1) num = Math.min(10, parseInt(s1[1], 10) || 0)
  }
  const pct = na ? 0 : num * 10
  const tone = na ? 'na' : scoreTone(num)
  const pillShow = na ? 'N/A' : /\/\s*10/.test(pillRaw) ? pillRaw : `${num}/10`
  const noteHtml = note
    ? `<p class="cr-metric__note">${renderInline(note)}</p>`
    : ''
  return [
    `<div class="cr-metric" data-tone="${tone}" ${na ? 'data-na="1"' : ''} style="--cr-metric-pct: ${pct}">`,
    `<div class="cr-metric__row">`,
    `<span class="cr-metric__name">${renderInline(nameClean)}</span>`,
    `<span class="cr-metric__val">${renderInline(pillShow)}</span>`,
    `</div>`,
    `<div class="cr-metric__track" role="presentation"><div class="cr-metric__fill"></div></div>`,
    noteHtml,
    `</div>`,
  ].join('')
}

/* ---------------------------------------------------------------------------
 * "Key Spec" detection — Mileage / Age / Model / Year / Transmission / Fuel
 * ------------------------------------------------------------------------- */

type StatIconKey = 'mileage' | 'age' | 'model' | 'transmission' | 'fuel' | 'engine' | 'trim' | 'body' | 'info'

const ICONS: Record<StatIconKey, string> = {
  mileage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18a9 9 0 1 1 18 0"/><path d="M12 18l4-5"/><circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none"/></svg>`,
  age: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>`,
  model: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 17h14"/><path d="M6 17v-3.5l2-4.5h8l2 4.5V17"/><circle cx="7.8" cy="17" r="1.6"/><circle cx="16.2" cy="17" r="1.6"/></svg>`,
  transmission: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6.5" cy="6.5" r="1.8"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="6.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/><path d="M6.5 8.3v7.4M17.5 8.3v7.4M8.3 6.5h7.4"/></svg>`,
  fuel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M4 14h11"/><path d="M15 9h3l3 3v5.5a1.5 1.5 0 0 1-3 0V14"/></svg>`,
  engine: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h4V9h6v3h3v5H5z"/><path d="M7 9V7M17 9V7"/><path d="M9 17v2M15 17v2"/></svg>`,
  trim: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a1 1 0 0 1-.3-.7V4a1 1 0 0 1 1-1h8.7a1 1 0 0 1 .7.3l7.1 7.1a2 2 0 0 1 0 2.8z"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/></svg>`,
  body: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15h18"/><path d="M5 15l1.5-5.5A2 2 0 0 1 8.4 8h7.2a2 2 0 0 1 1.9 1.5L19 15"/><circle cx="7.5" cy="17.5" r="1.6"/><circle cx="16.5" cy="17.5" r="1.6"/></svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8.5v4M12 15.5h.01"/></svg>`,
}

function specIconKeyFor(label: string): StatIconKey {
  const l = label.toLowerCase()
  if (/mileage|odometer|mile|\bkm\b|გარბენ|пробег/.test(l)) return 'mileage'
  if (/\bage\b|\byear|years\s+old|vintage|ასაკ|возраст|\bгод/.test(l)) return 'age'
  if (/transmission|gearbox|გადაცემ|коробк|трансмис/.test(l)) return 'transmission'
  if (/fuel|gasoline|diesel|საწვავ|топлив|бензин|дизел/.test(l)) return 'fuel'
  if (/engine|motor|ძრავ|мотор|двигат/.test(l)) return 'engine'
  if (/trim\b|package|კომპლექტ|комплек/.test(l)) return 'trim'
  if (/body|chassis|კორპუს|кузов/.test(l)) return 'body'
  if (/model|make|brand|მარკ|მოდელ|марк|модел/.test(l)) return 'model'
  return 'info'
}

const SPEC_LABEL_RE =
  /\bmileage|odometer|mile|\bkm\b|\bage\b|\byear|years\s+old|vintage|model|make|brand|trim|transmission|gearbox|fuel|engine|motor|body|chassis|color|colour|VIN|გარბენ|ასაკ|წელ|მოდელ|მარკ|ფერ|კორპუს|გადაცემ|საწვავ|ძრავ|კომპლექტ|пробег|возраст|\bгод|модел|марк|цвет|кузов|коробк|трансмис|топлив|двигат|мотор|комплек/i

function formatStatBlock(rawLine: string): string {
  const cleaned = stripLeadingListMarker(rawLine).trim()
  if (!cleaned) return ''
  const match = cleaned.match(/^(.+?)\s*[:：]\s*(.+?)\s*$/)
  if (!match) return ''
  const rawName = match[1].replace(/^\*+|\*+$/g, '').trim()
  const rawValue = match[2].trim()
  if (!rawName || !rawValue) return ''
  if (!SPEC_LABEL_RE.test(rawName)) return ''
  // Score lines should win — they go to the metrics grid, not the stat strip.
  if (isScoreValue(rawValue)) return ''
  // Long, sentence-style values don't fit a compact stat card.
  if (rawValue.length > 80) return ''
  if (/[.!?]\s+\S/.test(rawValue)) return ''
  const iconKey = specIconKeyFor(rawName)
  return [
    `<div class="cr-stat">`,
    `<div class="cr-stat__icon" aria-hidden="true">${ICONS[iconKey]}</div>`,
    `<div class="cr-stat__body">`,
    `<div class="cr-stat__label">${renderInline(rawName)}</div>`,
    `<div class="cr-stat__value">${renderInlineWithEmphasis(rawValue)}</div>`,
    `</div>`,
    `</div>`,
  ].join('')
}

export type CarReportRenderOptions = {
  /** Localised "Verdict" eyebrow label. Defaults to "Verdict". */
  verdictLabel?: string
  /** Localised "Overall grade" sub-label. Defaults to "Overall grade". */
  gradeSubLabel?: string
}

function buildVerdict(letter: string, opts: CarReportRenderOptions): string {
  const L = letter.toUpperCase()
  const tone = gradeTone(L)
  const eyebrow = opts.verdictLabel ?? 'Verdict'
  const sub = opts.gradeSubLabel ?? 'Overall grade'
  return [
    `<section class="cr-verdict cr-verdict--${L}" data-tone="${tone}" role="status">`,
    `<div class="cr-verdict__badge" aria-label="${escapeHtml(`${sub} ${L}`)}">${L}</div>`,
    `<div class="cr-verdict__body">`,
    `<p class="cr-verdict__eyebrow">${escapeHtml(eyebrow)}</p>`,
    `<p class="cr-verdict__sub">${escapeHtml(sub)}</p>`,
    `</div>`,
    `</section>`,
  ].join('')
}

/**
 * Renders a structured, accessible vehicle report. Input is raw assistant text; output is safe HTML.
 */
export function formatCarReportHtml(raw: string, opts: CarReportRenderOptions = {}): string {
  const lines = raw.split(/\r?\n/)
  const out: string[] = []
  let bul: string[] = []
  let metrics: string[] = []
  let stats: string[] = []
  let verdictHtml: string | null = null
  let verdictNote: string | null = null

  const flushBul = () => {
    if (!bul.length) return
    out.push('<ul class="cr-bullets">')
    for (const item of bul) {
      out.push(
        `<li class="cr-bullets__item"><span class="cr-bullets__dot" aria-hidden="true"></span><span class="cr-bullets__text">${renderInlineWithEmphasis(item)}</span></li>`
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

  const flushStats = () => {
    if (!stats.length) return
    out.push('<div class="cr-stats">')
    out.push(stats.join(''))
    out.push('</div>')
    stats = []
  }

  const flushAll = () => {
    flushBul()
    flushMetrics()
    flushStats()
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

    const overallM = t.match(/Overall\s*grade\s*:\s*([A-Fa-f])/i)
    if (overallM) {
      flushAll()
      const letter = (overallM[1] || 'A').toUpperCase()
      verdictHtml = buildVerdict(letter, opts)
      const rest = t
        .replace(/\*+/g, '')
        .replace(/Overall\s*grade\s*:\s*[A-Fa-f]\s*/i, '')
        .trim()
      if (rest) verdictNote = rest
      continue
    }

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

    // Priority 1: metric rows (Exterior: 7/10)
    const metric = formatMetricBlock(t)
    if (metric) {
      flushBul()
      flushStats()
      metrics.push(metric)
      continue
    }
    flushMetrics()

    // Priority 2: stat rows (Mileage: 150,000 km) — also works for bulleted spec items
    const stat = formatStatBlock(t)
    if (stat) {
      flushBul()
      stats.push(stat)
      continue
    }
    flushStats()

    // Bullet / numbered list
    if (/^[-*•\u2022–—]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const item = stripLeadingListMarker(t)
      const maybeMetric = formatMetricBlock(item)
      if (maybeMetric) {
        flushBul()
        flushStats()
        metrics.push(maybeMetric)
        continue
      }
      const maybeStat = formatStatBlock(item)
      if (maybeStat) {
        flushBul()
        flushMetrics()
        stats.push(maybeStat)
        continue
      }
      bul.push(item)
      continue
    }
    flushBul()

    out.push(`<p class="cr-para">${renderInlineWithEmphasis(line)}</p>`)
  }
  flushAll()

  // Assemble: verdict hero at top, then body; supporting note at the bottom.
  const body = out.join('')
  const note = verdictNote
    ? `<p class="cr-para cr-para--note">${renderInlineWithEmphasis(verdictNote)}</p>`
    : ''
  const hero = verdictHtml ?? ''
  return `<div class="cr-report">${hero}${body}${note}</div>`
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

export function formatAssistantMessageHtml(
  raw: string,
  opts: CarReportRenderOptions = {}
): string {
  if (isVehicleReportText(raw)) return formatCarReportHtml(raw, opts)
  return defaultAssistantHtml(raw)
}
