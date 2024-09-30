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

function checkIfActive(pathName: string, href: string): boolean {
  if (pathName === '/') return href === '/'
  if (href === '/') return false
  return pathName.replaceAll('/', '').includes(href.replaceAll('/', ''))
}

function NavigationLink({ href, title, icon, onClick }: Props) {
  const pathName = usePathname()
  const active = checkIfActive(pathName, href)
  return (
    <Link href={href} onClick={onClick}>
      <div
        className={`select:bg-sunflowerYellow-light flex aspect-square flex-col items-center justify-center rounded-xl border-none p-2 text-charcoal transition-all hover:bg-sunflowerYellow-light ${active ? 'bg-sunflowerYellow-light' : 'bg-beige'}`}
      >
        <div className="w-7">{icon}</div>
        <div>{title}</div>
      </div>
    </Link>
  )
}

export default NavigationLink
