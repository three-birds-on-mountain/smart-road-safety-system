import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import MapPage from './pages/MapPage'
import NotFoundPage from './pages/NotFoundPage'
import SettingsPage from './pages/SettingsPage'

const App = () => {
  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    [
      'rounded-md px-md py-sm text-sm font-semibold transition-colors',
      isActive
        ? 'bg-primary-500 text-white shadow-md shadow-primary-500/20'
        : 'text-white/85 hover:bg-primary-500/20 hover:text-white',
    ].join(' ')

  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-surface-muted text-text-primary">
        <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-sm px-xl py-lg md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-semibold">智慧道路守護系統</h1>
              <p className="text-sm text-white/80">
                Smart Road Safety Dashboard
              </p>
            </div>
            <nav className="flex items-center gap-sm">
              <NavLink to="/" className={navLinkClassName} end>
                即時地圖
              </NavLink>
              <NavLink to="/settings" className={navLinkClassName}>
                警示設定
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-lg px-xl py-xl">
          <Routes>
            <Route path="/" element={<MapPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <footer className="mt-auto bg-surface-white text-sm text-text-secondary shadow-inner">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-sm px-xl py-lg md:flex-row md:items-center md:justify-between">
            <span>© {new Date().getFullYear()} Town Pass Road Safety Team</span>
            <span>使用設計系統：Town Pass Design System</span>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
