'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

interface Props {
  href: string
  title: string
  icon: React.ReactNode
  onClick?: () => void
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

function NavigationLink({ href, title, icon, onClick }: Props) {
  const pathname = usePathname()
  const active = isActive(pathname, href)

  return (
    <Link href={href} onClick={onClick}>
      <div
        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all
          ${active
            ? 'bg-primary text-primary-ink'
            : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink'
          }`}
      >
        {icon}
        <span>{title}</span>
      </div>
    </Link>
  )
}

export default NavigationLink
