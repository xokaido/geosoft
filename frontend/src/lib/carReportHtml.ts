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
  return /Ratings|\/\s*10|1\s*[-–]\s*10|Exterior|Interior|Engine|market|damage|estimate/i.test(raw)
}

const LOOSE_METRIC = /^(.+?)\s*[:：]\s*(.+?)\s*$/i

function isLikelyScoreLine(label: string, valuePart: string): boolean {
  const v = valuePart.trim()
  if (/N\/?A/i.test(v)) return true
  if (/\/\s*10/.test(v)) return true
  if (/^(\d{1,2})\s*\/\s*10$/.test(v) || /^(10|[0-9])$/.test(v)) {
    const n = parseInt(v, 10)
    if (n >= 0 && n <= 10) {
      return /exterior|interior|engine|condition|ratings?|damage|age|miles?|odometer|model|trim|score|market|price range|value/i.test(
        label
      )
    }
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
  return `<div class="cr-metric" ${na ? 'data-na="1"' : ''} style="--cr-metric-pct: ${pct}"><div class="cr-metric__row"><span class="cr-metric__name">${applyBold(escapeHtml(name))}</span><span class="cr-metric__val">${applyBold(escapeHtml(valShow))}</span></div><div class="cr-metric__track" role="presentation"><div class="cr-metric__fill"></div></div></div>`
}

/**
 * Renders a structured, accessible report. Input is raw assistant text; output is safe HTML.
 */
export function formatCarReportHtml(raw: string): string {
  const lines = raw.split(/\r?\n/)
  const out: string[] = []
  let bul: string[] = []
  const flushBul = () => {
    if (!bul.length) return
    out.push(`<ul class="cr-bullets">`)
    for (const item of bul) {
      out.push(
        `<li class="cr-bullets__item"><span class="cr-bullets__dot" aria-hidden="true" />${applyBold(escapeHtml(item))}</li>`
      )
    }
    out.push('</ul>')
    bul = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (t === '') {
      flushBul()
      const last = out[out.length - 1]
      if (last && last !== '<div class="cr-gap" />') out.push('<div class="cr-gap" />')
      continue
    }

    const overallM = t.match(/Overall\s*grade\s*:\s*([A-Fa-f])/i)
    if (overallM) {
      flushBul()
      const letter = (overallM[1] || 'A').toUpperCase()
      const rest = t
        .replace(/\*+/g, '')
        .replace(/Overall\s*grade\s*:\s*[A-Fa-f]\s*/i, '')
        .trim()
      out.push(
        `<div class="cr-verdict cr-verdict--${letter}" role="status"><div class="cr-verdict__card"><p class="cr-verdict__eyebrow">Verdict</p><p class="cr-verdict__grade" aria-label="Overall grade ${letter}">${letter}</p><p class="cr-verdict__sub">Overall grade</p></div></div>`
      )
      if (rest) {
        out.push(`<p class="cr-para cr-para--note">${applyBold(escapeHtml(rest))}</p>`)
      }
      continue
    }

    if (/^[-*•\u2022–—]\s+/.test(t) || /^\d+[.)]\s+/.test(t)) {
      const item = t.replace(/^[-*•–—]\s+/, '').replace(/^\d+[.)]\s+/, '')
      bul.push(item)
      continue
    }
    flushBul()

    {
      const block = formatMetricBlock(t)
      if (block) {
        out.push(block)
        continue
      }
    }

    out.push(`<p class="cr-para">${applyBold(escapeHtml(line))}</p>`)
  }
  flushBul()
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
