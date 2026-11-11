import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-mist min-[901px]:grid-cols-[268px_minmax(0,1fr)]">
      <Sidebar />
      <main className="min-w-0 px-[18px] pt-6 pb-[110px] min-[901px]:px-10 min-[901px]:pt-9 min-[901px]:pb-16">
        <div className="mx-auto max-w-[1080px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
