'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'
import Spinner from '../Spinner'

export default function OrdersNavigation() {
  const path = usePathname()
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  function handleTransition(url: string) {
    startTransition(() => {
      router.push(url)
    })
  }

  return (
    <>
      <ul className="flex w-full items-center justify-between text-sm font-semibold sm:justify-center sm:gap-10 sm:text-xl">
        <li className="w-fit">
          <div
            onClick={() => handleTransition('/orders')}
            className={`cursor-pointer rounded-xl bg-beige p-3 transition-all hover:bg-sunflowerYellow-light ${path === '/orders' ? 'bg-sunflowerYellow-light' : 'bg-beige-light'}`}
          >
            Pending Orders
          </div>
        </li>
        <li className="w-fit">
          <div
            onClick={() => handleTransition('/orders/completed')}
            className={`cursor-pointer rounded-xl bg-beige p-3 transition-all hover:bg-sunflowerYellow-light focus:bg-sunflowerYellow-light ${path === '/orders/completed' ? 'bg-sunflowerYellow-light' : 'bg-beige-light'}`}
          >
            Completed Orders
          </div>
        </li>
      </ul>
      {isPending && (
        <div className="min-w-screen flex min-h-screen flex-col items-center justify-center">
          <Spinner />
        </div>
      )}
    </>
  )
}
