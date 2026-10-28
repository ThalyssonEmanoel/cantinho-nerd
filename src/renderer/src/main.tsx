import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouter } from './app/router'
import './styles/globals.css'

const container = document.getElementById('root')
if (container === null) throw new Error('Elemento #root não encontrado no index.html')

createRoot(container).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
)
