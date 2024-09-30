'use client'
import Grid from '@/components/Grid'
import { updateOrderItemsAction } from '@/lib/actions'
import { addItem, changeItemQuantity } from '@/lib/store/order/orderSlice'
import { useAppDispatch, useAppSelector } from '@/lib/store/reduxHooks'
import { Item } from '@/lib/dto'
import { currencyFormat } from '@/lib/util'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import ItemCard from '../item/ItemCard'
import { Minus, Plus } from 'lucide-react'
import { OrderItem } from '../../lib/dto'
import Spinner from '../Spinner'

interface Params {
  items: Item[]
  handleModalState: (state: boolean) => void
}

function Modal({ items, handleModalState }: Params) {
  const dispatch = useAppDispatch()
  const order = useAppSelector((state) => state.order)

  return (
    <>
      <button
        onClick={() => handleModalState(false)}
        className="mb-5 rounded-xl bg-sunflowerYellow-light p-2"
      >
        Done
      </button>
      <Grid>
        <>
          {items.map((item) => {
            return (
              <ItemCard
                key={item.id}
                item={item}
                isDisabled={
                  order.items.filter((i) => i.id === item.id).length != 0
                }
                onSelect={() => {
                  const orderItem: OrderItem = { ...item, quantity: 1 }
                  dispatch(addItem(orderItem))
                }}
              />
            )
          })}
        </>
      </Grid>
    </>
  )
}

export default function EditPage({ items }: { items: Item[] }) {
  items = items.filter((item) => !item.deleted)
  const [isPending, startTransition] = useTransition()
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const order = useAppSelector((state) => state.order)
  const dispatch = useAppDispatch()
  const router = useRouter()
  if (order.items.length === 0) {
    router.push(`/orders/${order.id}`)
    return
  }
  function handleModalOpen(open: boolean) {
    setModalOpen(open)
  }
  function handleMinus(item: OrderItem) {
    dispatch(
      changeItemQuantity({ itemId: item.id, quantity: item.quantity - 1 })
    )
  }

  function handlePlus(item: OrderItem) {
    dispatch(
      changeItemQuantity({ itemId: item.id, quantity: item.quantity + 1 })
    )
  }
  return (
    <div className="relative min-w-full self-start">
      <div className="flex items-center justify-start gap-5">
        <h3 className="text-2xl">#{order.id}</h3>
      </div>
      <p className="my-5 text-xl">Order Items</p>
      {modalOpen ? (
        <Modal items={items} handleModalState={handleModalOpen} />
      ) : isPending ? (
        <div className="min-w-screen flex min-h-screen flex-col items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <Grid>
            <>
              {order.items.map((item) => (
                <ItemCard key={item.id} item={item}>
                  <div className="flex w-20 items-center justify-center gap-2">
                    <Minus
                      className="cursor-pointer"
                      onClick={() => handleMinus(item)}
                    />
                    <div className="w-5 text-center">{item.quantity}</div>
                    <Plus
                      className="cursor-pointer"
                      onClick={() => handlePlus(item)}
                    />
                  </div>
                </ItemCard>
              ))}
              <div
                onClick={() => handleModalOpen(true)}
                className="flex h-full w-full cursor-pointer flex-col items-center justify-around rounded-xl bg-beige-light px-10 py-2 transition-all hover:bg-sunflowerYellow-light"
              >
                <div className="relative my-3 mb-3 flex aspect-square w-32 items-center justify-center rounded-lg border-2 border-dashed border-charcoal sm:w-40">
                  <Plus className="h-32 w-32 text-charcoal sm:h-40 sm:w-40" />
                </div>
                <div className="max-w-36 overflow-hidden text-ellipsis whitespace-nowrap text-center text-lg">
                  Add Item
                </div>
              </div>
            </>
          </Grid>
          <p className="mt-5 text-xl">
            Total Price:{' '}
            {currencyFormat(
              order.items.reduce(
                (acc, item) => acc + item.quantity * item.price,
                0
              )
            )}
          </p>
          <form
            action={() => startTransition(() => updateOrderItemsAction(order))}
          >
            <button className="mt-5 rounded-xl bg-sunflowerYellow-light p-2">
              Save
            </button>
          </form>
        </>
      )}
    </div>
  )
}
