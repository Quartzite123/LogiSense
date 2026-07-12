import { createContext, useCallback, useContext, useRef, useState } from 'react'
import UploadModal from '../components/UploadModal.jsx'
import { ToastContainer } from '../components/Toast.jsx'

// Global UI singletons: the upload modal + toast stack, reachable from any page
// header via useUI().openUpload() / useUI().toast(type, message).
const UIContext = createContext(null)
export const useUI = () => useContext(UIContext)

export function UIProvider({ children }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (type, message) => {
      const id = ++idRef.current
      setToasts((ts) => [...ts, { id, type, message }])
      if (type === 'success') setTimeout(() => dismiss(id), 4000)
      return id
    },
    [dismiss],
  )

  const value = {
    openUpload: () => setUploadOpen(true),
    closeUpload: () => setUploadOpen(false),
    toast,
  }

  return (
    <UIContext.Provider value={value}>
      {children}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onResult={toast} />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </UIContext.Provider>
  )
}
