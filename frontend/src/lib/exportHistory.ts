import jsPDF from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
import type { HealthEvent, Kind, PatientProfile } from '../types'

/**
 * Formats bytes into human-readable size (KB, MB).
 */
function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Capitalizes string nicely.
 */
function capitalize(val?: string): string {
  if (!val) return ''
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase()
}

/**
 * Formats ISO or YYYY-MM-DD date into standard display format (e.g. 15 Oct 2024).
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Returns user-friendly category label for record kind.
 */
function formatRecordKind(kind: Kind): string {
  switch (kind) {
    case 'allergy':
      return 'Allergy'
    case 'condition':
      return 'Condition'
    case 'medication':
      return 'Medication'
    case 'vaccination':
      return 'Vaccination'
    case 'report':
      return 'Lab Report'
    case 'document':
      return 'Document'
    default:
      return capitalize(kind)
  }
}

/**
 * Builds formatted multi-line clinical details for each record row.
 */
function buildRecordDetails(evt: HealthEvent): string {
  const lines: string[] = []

  // Main title or specific clinical item name
  const mainTitle = evt.medicationName || evt.conditionName || evt.vaccineName || evt.reportName || evt.title || 'Medical Record'
  lines.push(mainTitle)

  // Kind-specific detailed metadata
  if (evt.kind === 'medication') {
    if (evt.dosage) lines.push(`Dosage: ${evt.dosage}`)
    if (evt.instructions) lines.push(`Instructions: ${evt.instructions}`)
    if (evt.startDate || evt.endDate) {
      const start = evt.startDate ? formatDate(evt.startDate) : 'N/A'
      const end = evt.endDate ? formatDate(evt.endDate) : 'ongoing'
      lines.push(`Period: ${start} -> ${end}`)
    }
  } else if (evt.kind === 'allergy') {
    if (evt.reaction) lines.push(`Reaction: ${evt.reaction}`)
    if (evt.category) lines.push(`Category: ${capitalize(evt.category)}`)
    if (evt.notes) lines.push(`Notes: ${evt.notes}`)
  } else if (evt.kind === 'condition') {
    if (evt.onsetDate) lines.push(`Onset: ${formatDate(evt.onsetDate)}`)
    if (evt.resolvedDate) lines.push(`Resolved: ${formatDate(evt.resolvedDate)}`)
    if (evt.notes) lines.push(`Notes: ${evt.notes}`)
  } else if (evt.kind === 'vaccination') {
    if (evt.doseNumber) lines.push(`Dose: #${evt.doseNumber}`)
    if (evt.batchNumber) lines.push(`Batch: ${evt.batchNumber}`)
    if (evt.nextDueDate) lines.push(`Next Due: ${formatDate(evt.nextDueDate)}`)
  } else if (evt.kind === 'report') {
    if (evt.reportType) lines.push(`Type: ${evt.reportType}`)
    if (evt.conclusion) lines.push(`Conclusion: ${evt.conclusion}`)
  } else if (evt.kind === 'document') {
    if (evt.fileName) {
      const sizeStr = formatBytes(evt.fileSizeBytes)
      lines.push(`File: ${evt.fileName}${sizeStr ? ` (${sizeStr})` : ''}`)
    }
  }

  // Fallback to detail text if no specific lines were added besides the title
  if (lines.length === 1 && evt.detail && evt.detail !== mainTitle) {
    lines.push(evt.detail)
  }

  return lines.join('\n')
}

/**
 * Builds status and severity summary string for a record.
 */
function buildStatusSeverity(evt: HealthEvent): string {
  if (evt.isBirthRecord) return 'Birth Origin'

  const parts: string[] = []
  if (evt.severity) parts.push(`Severity: ${capitalize(evt.severity)}`)
  if (evt.criticality && evt.criticality !== 'unable-to-assess') {
    parts.push(`Criticality: ${capitalize(evt.criticality)}`)
  }
  if (evt.status) parts.push(`Status: ${capitalize(evt.status)}`)

  if (parts.length > 0) return parts.join('\n')
  return evt.status ? capitalize(evt.status) : 'Recorded'
}

/**
 * Generates and downloads the patient's medical records history as a formatted PDF with tables.
 */
export function downloadHistoryAsPdf(profile: PatientProfile, events: HealthEvent[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 14

  // ── 1. HEADER SECTION ──────────────────────────────────────────
  // Decorative top accent bar
  doc.setFillColor(13, 92, 117) // Mediclaim deep teal
  doc.rect(0, 0, pageWidth, 5, 'F')

  // Header Title & Subtitle
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(13, 92, 117)
  doc.text('MEDICLAIM HEALTH RECORD', marginX, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text('Official Comprehensive Patient Health History • HL7 FHIR Standard', marginX, 21)

  // Header Right Metadata
  const exportedAtStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${exportedAtStr}`, pageWidth - marginX, 16, { align: 'right' })
  doc.text(`Mediclaim ID: ${profile.mediclaimId || 'N/A'}`, pageWidth - marginX, 21, { align: 'right' })

  // Divider Line
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.4)
  doc.line(marginX, 25, pageWidth - marginX, 25)

  // ── 2. PATIENT INFORMATION TABLE ──────────────────────────────
  const emergencyStr = profile.emergencyContact?.name
    ? `${profile.emergencyContact.name} (${profile.emergencyContact.relation || 'Contact'}${profile.emergencyContact.phone ? ` • ${profile.emergencyContact.phone}` : ''})`
    : 'Not Specified'

  autoTable(doc, {
    startY: 28,
    head: [
      [
        {
          content: 'PATIENT INFORMATION',
          colSpan: 4,
          styles: {
            fillColor: [13, 92, 117] as [number, number, number],
            textColor: [255, 255, 255] as [number, number, number],
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 2,
          },
        },
      ],
    ],
    body: [
      [
        { content: 'Full Name:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] as [number, number, number] } },
        profile.fullName || 'N/A',
        { content: 'Mediclaim ID:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] as [number, number, number] } },
        profile.mediclaimId || 'N/A',
      ],
      [
        { content: 'Date of Birth:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] as [number, number, number] } },
        formatDate(profile.dateOfBirth),
        { content: 'Gender / Blood:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] as [number, number, number] } },
        `${capitalize(profile.gender || 'N/A')}  •  ${profile.bloodGroup || 'N/A'}`,
      ],
      [
        { content: 'Phone:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] as [number, number, number] } },
        profile.phone || 'N/A',
        { content: 'Emergency:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] as [number, number, number] } },
        emergencyStr,
      ],
      [
        { content: 'Address:', styles: { fontStyle: 'bold', textColor: [71, 85, 105] as [number, number, number] } },
        { content: profile.address || 'N/A', colSpan: 3 },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.15,
      textColor: [30, 41, 59] as [number, number, number],
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 63 },
      2: { cellWidth: 35 },
      3: { cellWidth: 56 },
    },
    margin: { left: marginX, right: marginX },
  })

  // ── 3. HEALTH RECORDS TABLE ───────────────────────────────────
  const patientTableFinalY = (doc as any).lastAutoTable?.finalY ?? 60

  // Section Header
  const recordsStartY = patientTableFinalY + 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(13, 92, 117)
  doc.text('MEDICAL RECORDS HISTORY', marginX, recordsStartY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Total Records: ${events.length}`, pageWidth - marginX, recordsStartY, { align: 'right' })

  // Sort events newest first (matching patient UI)
  const sortedEvents = [...events].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return db - da
  })

  const tableRows: RowInput[] = sortedEvents.length > 0
    ? sortedEvents.map((evt, idx) => {
        const rowNum = (idx + 1).toString()
        const displayDate = evt.date ? formatDate(evt.date) : 'N/A'
        const kindLabel = formatRecordKind(evt.kind)
        const details = buildRecordDetails(evt)
        const statusSev = buildStatusSeverity(evt)
        const provider = evt.provider || (evt.source === 'self_reported' ? 'Self-reported' : evt.source === 'uploaded' ? 'Patient Upload' : 'Practitioner')

        return [
          rowNum,
          displayDate,
          kindLabel,
          details,
          statusSev,
          provider,
        ]
      })
    : [
        [
          {
            content: 'No medical records found on file for this patient.',
            colSpan: 6,
            styles: {
              halign: 'center' as const,
              textColor: [100, 116, 139] as [number, number, number],
              fontStyle: 'italic' as const,
              cellPadding: 8,
            },
          },
        ],
      ]

  autoTable(doc, {
    startY: recordsStartY + 3,
    head: [['#', 'Date', 'Category', 'Record Details', 'Status / Severity', 'Provider / Facility']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 23, 42] as [number, number, number], // Slate-900 for sharp tabular header
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] as [number, number, number],
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.1,
      textColor: [30, 41, 59] as [number, number, number],
      valign: 'top',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 26, fontStyle: 'bold' },
      3: { cellWidth: 64 },
      4: { cellWidth: 26, halign: 'center' },
      5: { cellWidth: 32 },
    },
    margin: { left: marginX, right: marginX, bottom: 16 },
  })

  // ── 4. PAGE NUMBERING & FOOTER (ON ALL PAGES) ─────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    // Footer divider line
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(marginX, pageHeight - 11, pageWidth - marginX, pageHeight - 11)

    // Footer text
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text('Confidential Medical Record • Mediclaim Digital Health Authority', marginX, pageHeight - 6)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 6, { align: 'right' })
  }

  // ── 5. SAVE / DOWNLOAD PDF ────────────────────────────────────
  const cleanId = (profile.mediclaimId || 'patient').replace(/[^a-zA-Z0-9_-]/g, '')
  const dateStamp = new Date().toISOString().slice(0, 10)
  const filename = `Mediclaim-Health-Records-${cleanId}-${dateStamp}.pdf`
  doc.save(filename)
}

/**
 * Downloads record history as a JSON file (legacy FHIR export option).
 */
export function downloadHistoryAsJson(profile: PatientProfile, events: HealthEvent[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    patient: {
      mediclaimId: profile.mediclaimId,
      fullName: profile.fullName,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      bloodGroup: profile.bloodGroup,
    },
    totalRecords: events.length,
    records: events,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mediclaim-history-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Default download handler invoked by the UI.
 * Creates and downloads the official PDF document with records in tabular format.
 */
export function downloadHistory(profile: PatientProfile, events: HealthEvent[]) {
  downloadHistoryAsPdf(profile, events)
}
