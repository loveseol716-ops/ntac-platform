import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import EntryGate from './EntryGate.jsx'
import AppUpdates from './AppUpdates.jsx'

createRoot(
  document.getElementById('root'),
).render(
  <StrictMode>
    <EntryGate />
    <AppUpdates />
  </StrictMode>,
)
