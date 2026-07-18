import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

if (import.meta.env.DEV) {
  void import('./debug/DevEntry').then(({ DevEntry }) => {
    root.render(
      <StrictMode>
        <DevEntry />
      </StrictMode>,
    )
  })
} else {
  void import('./App').then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
