'use client'

import React, { useEffect, useState } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import Logo from './Logo'
import NavigationLink from './NavigationLink'
import { ChartPie, Ellipsis, Plus } from 'lucide-react'
import Hamburger from 'hamburger-react'

const links = [
  {
    title: 'New Order',
    href: '/',
    icon: <Plus className="w-7" />,
  },
  {
    title: 'Orders',
    href: '/orders',
    icon: <Ellipsis />,
  },
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <ChartPie />,
  },
]

function Navigation() {
  const isMobile = useIsMobile()
  const [isMounted, setIsMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  function handleOpen() {
    setIsOpen((o) => !o)
  }

  const navLinks = (
    <>
      <div onClick={handleOpen}>
        <Logo />
      </div>
      <ul className="mt-10 flex flex-1 flex-col gap-10">
        {links.map((link) => (
          <li key={link.title}>
            <NavigationLink
              onClick={handleOpen}
              href={link.href}
              title={link.title}
              icon={link.icon}
            />
          </li>
        ))}
      </ul>
    </>
  )

  if (!isMounted) {
    return null
  }

  return (
    <>
      {isMobile ? (
        <div className="flex items-center justify-start">
          <div className="ml-10 mt-10 h-10 w-10">
            <Hamburger toggled={isOpen} toggle={handleOpen} />
          </div>
          <div
            className={`fixed inset-0 z-10 bg-black transition-opacity duration-300 ease-in-out ${
              isOpen ? 'opacity-50' : 'pointer-events-none opacity-0'
            }`}
            onClick={handleOpen}
          ></div>
          <MobileWrapper isOpen={isOpen}>{navLinks}</MobileWrapper>
        </div>
      ) : (
        <div
          className={`flex min-h-screen max-w-fit flex-col items-center rounded-2xl bg-beige p-6`}
        >
          <div className="sticky top-10">{navLinks}</div>
        </div>
      )}
    </>
  )
}

function MobileWrapper({
  children,
  isOpen,
}: {
  children: React.ReactNode
  isOpen: boolean
}) {
  return (
    <div
      className={`fixed right-0 top-0 z-20 flex h-full w-fit transform flex-col bg-white p-10 shadow-2xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {children}
    </div>
  )
}

export default Navigation
