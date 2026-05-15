import { useState } from 'react'
import { StepList } from '../components/pipeline/StepList'
import { ConfigPanel } from '../components/pipeline/ConfigPanel'
import { TerminalLog } from '../components/pipeline/TerminalLog'
import { AutoRunPanel } from '../components/autorun/AutoRunPanel'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'

import { createPortal } from 'react-dom'

export function Pipeline() {
  const [showAutoRun, setShowAutoRun] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const setActiveProject = useAppStore((s) => s.setActiveProject)
  const [sheetsReadyUrl, setSheetsReadyUrl] = useState<string | null>(null)

  useEffect(() => {
    const sheetsPending = searchParams.get('sheets_pending') === '1'
    const projectName   = searchParams.get('project') || ''
    const step          = searchParams.get('step') || ''
    const filename      = searchParams.get('filename') || ''
    const BASE          = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
    const token         = localStorage.getItem('qcm_token') || ''
    const authHeaders: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {}

    if (!projectName) return

    // Clear URL params so a refresh doesn't re-trigger
    setSearchParams({})

    // Fetch full project object (has pdf_path, last_step, etc.) and activate it
    fetch(`${BASE}/projects`, { headers: authHeaders })
      .then(r => r.json())
      .then(data => {
        const found = (data.projects || []).find((p: any) => p.name === projectName)
        if (found) setActiveProject(found)

        // If sheets_pending, trigger upload and show clickable banner (popup-blocker safe)
        if (sheetsPending && step && filename) {
          fetch(`${BASE}/projects/${encodeURIComponent(projectName)}/steps/${step}/open-sheets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ filename })
          })
            .then(r => r.json())
            .then(res => {
              if (res.url) {
                setSheetsReadyUrl(res.url)
              } else {
                console.error('Sheets retry: no URL returned', res)
              }
            })
            .catch(err => console.error('Sheets retry failed:', err))
        }
      })
      .catch(err => console.error('Pipeline: failed to load projects', err))
  }, [searchParams])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden relative">

      {/* ── Google Sheets ready banner (popup-blocker safe) ── */}
      {sheetsReadyUrl && (
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-2.5 bg-[#34A853]/10 border-b border-[#34A853]/30 animate-in slide-in-from-top-1 duration-300">
          <div className="flex items-center gap-2 text-[#34A853] text-xs font-bold">
            <span className="material-symbols-outlined text-[18px]">table_chart</span>
            Your file has been uploaded to Google Sheets — click to open
          </div>
          <div className="flex items-center gap-3">
            <a
              href={sheetsReadyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 bg-[#34A853] text-white text-xs font-black rounded-lg hover:bg-[#2d9247] transition-colors uppercase tracking-wider"
            >
              Open Google Sheet ↗
            </a>
            <button
              onClick={() => setSheetsReadyUrl(null)}
              className="text-[#34A853]/60 hover:text-[#34A853] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Header with Auto Run trigger */}
      <div className="h-14 bg-surface-container-low border-b border-outline-variant/10 flex items-center justify-end px-6 shrink-0">
        <button
          id="btn-open-autorun"
          onClick={() => setShowAutoRun(true)}
          className="flex items-center gap-2 px-4 py-1.5 bg-secondary-container text-on-secondary-container rounded-lg text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">play_circle</span>
          Auto Run
        </button>
      </div>

      {/* Main two-column area */}
      <div className="flex flex-1 overflow-hidden">
        <StepList />
        <ConfigPanel />
      </div>

      <TerminalLog />

      {showAutoRun && createPortal(<AutoRunPanel onClose={() => setShowAutoRun(false)} />, document.body)}
    </div>
  )
}
