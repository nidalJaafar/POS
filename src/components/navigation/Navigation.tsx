'use client'

import React, { useState } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import Logo from './Logo'
import NavigationLink from './NavigationLink'
import { ChartPie, Ellipsis, Plus } from 'lucide-react'
import type { UpdateNotice } from '@/lib/update-status'

const links = [
  { title: 'New Order', href: '/', icon: <Plus className="w-5" /> },
  { title: 'Orders', href: '/orders', icon: <Ellipsis className="w-5" /> },
  { title: 'Dashboard', href: '/dashboard', icon: <ChartPie className="w-5" /> },
]

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <div className="flex h-6 w-6 flex-col justify-between cursor-pointer">
      <span className={`block h-0.5 w-full ${open ? 'bg-sidebar-ink' : 'bg-ink'} transition-all duration-300 ${open ? 'translate-y-2.5 rotate-45' : ''}`} />
      <span className={`block h-0.5 w-full ${open ? 'bg-sidebar-ink' : 'bg-ink'} transition-all duration-300 ${open ? 'opacity-0' : ''}`} />
      <span className={`block h-0.5 w-full ${open ? 'bg-sidebar-ink' : 'bg-ink'} transition-all duration-300 ${open ? '-translate-y-2.5 -rotate-45' : ''}`} />
    </div>
  )
}

function NavContent({ onLinkClick, updateNotice }: { onLinkClick?: () => void; updateNotice?: UpdateNotice | null }) {
  return (
    <>
      <div className="mb-10">
        <Logo />
      </div>
      <nav>
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.title}>
              <NavigationLink
                href={link.href}
                title={link.title}
                icon={link.icon}
                onClick={onLinkClick}
              />
            </li>
          ))}
        </ul>
      </nav>
      {/* Which release is running and how the last update went; mt-auto pins it to the bottom */}
      <div className="mt-auto flex flex-col gap-2 pt-6">
        {updateNotice && (
          <p
            role="status"
            className={`rounded-lg px-3 py-2 text-xs ${
              updateNotice.tone === 'ok' ? 'bg-sidebar-hover text-sidebar-ink' : 'bg-danger text-danger-ink'
            }`}
          >
            {updateNotice.message}
          </p>
        )}
        <p className="text-xs text-sidebar-muted">Version {process.env.NEXT_PUBLIC_APP_VERSION}</p>
      </div>
    </>
  )
}

function Navigation({ updateNotice }: { updateNotice?: UpdateNotice | null }) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)

  if (!isMobile) {
    return (
      <div className="sticky top-0 flex h-screen flex-col bg-sidebar border-r border-panel-dark/40 p-6 shadow-sm">
        <NavContent updateNotice={updateNotice} />
      </div>
    )
  }

  return (
    <div className="flex items-center p-5">
      <button aria-label="Toggle menu" aria-expanded={isOpen} onClick={() => setIsOpen((o) => !o)} className="relative z-40">
        <HamburgerIcon open={isOpen} />
      </button>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-20 bg-black transition-opacity duration-300 ${
          isOpen ? 'opacity-50' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 z-30 flex h-full w-64 flex-col bg-sidebar p-8 shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <NavContent onLinkClick={() => setIsOpen(false)} updateNotice={updateNotice} />
      </div>
    </div>
  )
}

export default Navigation
