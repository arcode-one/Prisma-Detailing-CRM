import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { ListSkeleton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { CarMark } from '@/components/Logo'
import Login from '@/pages/Login'
import Visits from '@/pages/Visits'
import VisitForm from '@/pages/VisitForm'

// Редкие экраны грузятся по требованию; SW всё равно кладёт их в кеш
const Clients = lazy(() => import('@/pages/Clients'))
const ClientDetail = lazy(() => import('@/pages/ClientDetail'))
const Archive = lazy(() => import('@/pages/Archive'))
const Services = lazy(() => import('@/pages/Services'))
const Trash = lazy(() => import('@/pages/Trash'))
const Blacklist = lazy(() => import('@/pages/Blacklist'))

function Protected() {
  const { session, ready } = useAuth()
  if (!ready) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  return <Layout />
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <CarMark className="h-8 w-auto animate-pulse" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<ListSkeleton className="p-4" />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected />}>
            <Route index element={<Visits />} />
            <Route path="new" element={<VisitForm />} />
            <Route path="visits/:id" element={<VisitForm />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="archive" element={<Archive />} />
            <Route path="services" element={<Services />} />
            <Route path="trash" element={<Trash />} />
            <Route path="blacklist" element={<Blacklist />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
