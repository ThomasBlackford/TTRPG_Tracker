import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { App } from './App'
import { PresentationPage } from './pages/PresentationPage'

const params = new URLSearchParams(window.location.search)
const isPresent = params.get('present') === '1'
const initialMapId = params.get('mapId') ?? ''

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPresent ? <PresentationPage initialMapId={initialMapId} /> : <App />}
  </React.StrictMode>
)
