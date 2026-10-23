import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initPwa } from './lib/pwa'
import { startApp } from './boot'

const root = ReactDOM.createRoot(document.getElementById('root')!)

// A read-only link (#share=…) opens its own page, loaded on demand; everything else is the editor (see boot.ts).
startApp({
  initPwa,
  renderApp: () =>
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    ),
  renderShare: (address) =>
    import('./share/SharePage').then(({ default: SharePage }) =>
      root.render(
        <React.StrictMode>
          <SharePage token={address.token} backend={address.backend} />
        </React.StrictMode>
      )
    )
})
