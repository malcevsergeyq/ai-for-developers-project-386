import { Link, NavLink, Route, Routes } from 'react-router-dom'
import AdminPage from '@/pages/AdminPage'
import BookingPage from '@/pages/BookingPage'
import EventTypesPage from '@/pages/EventTypesPage'
import NotFoundPage from '@/pages/NotFoundPage'

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 transition-colors ${
          isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`
      }
    >
      {children}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Запись на звонок
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavItem to="/">Гостю</NavItem>
            <NavItem to="/admin">Владельцу</NavItem>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Routes>
          <Route path="/" element={<EventTypesPage />} />
          <Route path="/book/:eventTypeId" element={<BookingPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-xs text-muted-foreground">
        Время указано в UTC.
      </footer>
    </div>
  )
}
