'use client'
import { completePendingOrder, deletePendingOrder } from '@/lib/actions'
import { Check, EllipsisVertical, Pencil, Trash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'

interface Params {
  orderId: number
  isOpen: boolean
  handleIsOpen: () => void
  setIsPending?: (isPending: boolean) => void
}

export default function ContextMenu({
  orderId,
  isOpen,
  handleIsOpen,
  setIsPending,
}: Params) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  useEffect(() => {
    if (setIsPending) setIsPending(isPending)
  }, [isPending, setIsPending])

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    handleIsOpen()
  }
  return (
    <>
      <div
        className={`z-5 fixed inset-0 ${
          isOpen ? 'cursor-pointer' : 'pointer-events-none'
        }`}
        onClick={handleClick}
      ></div>
      <div
        onClick={handleClick}
        className={`absolute right-5 flex w-fit cursor-pointer items-center justify-center rounded-full p-1 hover:bg-sunflowerYellow-light ${isOpen ? 'bg-sunflowerYellow-light' : 'bg-beige'}`}
      >
        <EllipsisVertical />
      </div>
      <div
        className={`absolute right-0 top-12 z-10 transform flex-col items-center justify-center transition-opacity duration-100 ease-in-out ${
          isOpen
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -z-0 opacity-0'
        }`}
      >
        <div
          className="flex w-8 cursor-pointer items-center justify-center rounded-t-xl bg-skyBlue p-2"
          onClick={() =>
            startTransition(() => router.push(`/orders/edit/${orderId}`))
          }
        >
          <Pencil />
        </div>
        <div
          className="flex w-8 cursor-pointer items-center justify-center bg-mintGreen p-2"
          onClick={() => startTransition(() => completePendingOrder(orderId))}
        >
          <Check />
        </div>
        <div
          className="flex w-8 cursor-pointer items-center justify-center rounded-b-xl bg-pastelPink p-2"
          onClick={() => startTransition(() => deletePendingOrder(orderId))}
        >
          <Trash />
        </div>
      </div>
    </>
  )
}
