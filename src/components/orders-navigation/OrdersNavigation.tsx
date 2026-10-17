'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function OrdersNavigation() {
  const path = usePathname()

  const tabs = [
    { label: 'Pending', href: '/orders' },
    { label: 'Completed', href: '/orders/completed' },
  ]

  return (
    <div className="flex gap-2">
      {tabs.map(({ label, href }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-xl px-5 py-2 text-sm font-medium transition-all
              ${active
                ? 'bg-primary text-primary-ink shadow-sm'
                : 'bg-surface text-ink-light shadow-sm hover:bg-panel-light hover:text-ink'
              }`}
          >
            {label}
          </Link>
        )
      })}
    </div>
  )
}
