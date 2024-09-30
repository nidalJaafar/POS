import { placeOrder } from '@/lib/actions'
import { Item, OrderItem } from '@/lib/dto'
import { XCircle } from 'lucide-react'
import { useTransition, useEffect, useState, startTransition } from 'react'
import { CSSTransition } from 'react-transition-group'
import NewOrderItemCard from './NewOrderItemCard'

interface Params {
  isMobile: boolean
  selectedItems: OrderItem[]
  orderItemsMenuIsOpen: boolean
  setOrderItemsMenuIsOpen: (state: boolean) => void
  handleRemovedItem: (item: Item) => void
  setSelectedItems: (state: OrderItem[]) => void
  handlePending: (isPending: boolean) => void
}

function OrderMenu({
  isMobile = false,
  setSelectedItems,
  selectedItems,
  handleRemovedItem,
  isConditionValid,
  setIsConditionValid,
  xPressed,
  setXPressed,
  handlePending,
}: {
  isMobile?: boolean
  setSelectedItems: (state: OrderItem[]) => void
  selectedItems: OrderItem[]
  handleRemovedItem: (item: Item) => void
  isConditionValid: boolean
  setIsConditionValid: (state: boolean) => void
  xPressed: boolean
  setXPressed: (state: boolean) => void
  handlePending: (isPending: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()
  useEffect(() => {
    handlePending(isPending)
  }, [handlePending, isPending])
  return (
    <CSSTransition
      key="order-items-menu-mobile"
      in={isConditionValid}
      classNames={isMobile ? 'slide-down' : 'side'}
      unmountOnExit
      timeout={500}
      addEndListener={(node, done) => {
        node.addEventListener('transitionend', done, false)
      }}
      onExited={() => {
        if (xPressed) {
          setSelectedItems([])
        }
      }}
    >
      <div
        className={
          isMobile
            ? 'beige-scroll-bar fixed bottom-24 right-5 flex max-h-52 flex-col items-start justify-start gap-5 overflow-y-scroll rounded-xl bg-beige-light p-5 transition-opacity'
            : 'flex flex-col items-start justify-start gap-10 rounded-xl bg-beige-light p-5'
        }
      >
        <div className="flex w-full items-start justify-between">
          <div className="text-xl font-semibold">New Order</div>
          <button>
            <XCircle
              onClick={() => {
                setIsConditionValid(false)
                setXPressed(true)
              }}
            />
          </button>
        </div>
        {selectedItems.map((item) => (
          <NewOrderItemCard
            item={item}
            key={item.id}
            onRemove={handleRemovedItem}
          />
        ))}
        <button
          onClick={() => startTransition(() => placeOrder(selectedItems))}
          className="min-w-full self-center rounded-xl bg-sunflowerYellow-light py-3 text-xl font-semibold"
        >
          Place Order
        </button>
      </div>
    </CSSTransition>
  )
}

export default function OrderItemsMenu({
  isMobile,
  selectedItems,
  orderItemsMenuIsOpen,
  setOrderItemsMenuIsOpen,
  handleRemovedItem,
  setSelectedItems,
  handlePending,
}: Params) {
  const [isConditionValid, setIsConditionValid] = useState<boolean>(false)
  const [xPressed, setXPressed] = useState<boolean>(false)
  useEffect(() => {
    setXPressed(false)
    setIsConditionValid(orderItemsMenuIsOpen && selectedItems.length > 0)
  }, [orderItemsMenuIsOpen, selectedItems.length])
  const [mobile, setMobile] = useState<boolean>(isMobile)
  useEffect(() => {
    setMobile(isMobile)
  }, [isMobile])
  return (
    <>
      <OrderMenu
        isConditionValid={isConditionValid}
        setIsConditionValid={setIsConditionValid}
        xPressed={xPressed}
        setXPressed={setXPressed}
        isMobile={mobile}
        selectedItems={selectedItems}
        handleRemovedItem={handleRemovedItem}
        setSelectedItems={setSelectedItems}
        handlePending={handlePending}
      />
      {mobile && (
        <>
          <CSSTransition
            key="order-items-button"
            in={selectedItems.length > 0}
            classNames="side"
            unmountOnExit
            timeout={500}
            addEndListener={(node, done) => {
              node.addEventListener('transitionend', done, false)
            }}
          >
            <div className="fixed bottom-5 right-5 flex items-center justify-between gap-5 rounded-xl bg-sunflowerYellow-light p-5 text-xl font-semibold">
              <CSSTransition
                in={!orderItemsMenuIsOpen && !xPressed}
                classNames="text"
                unmountOnExit
                timeout={100}
              >
                <button onClick={() => setOrderItemsMenuIsOpen(true)}>
                  View Order
                </button>
              </CSSTransition>
              <CSSTransition
                in={orderItemsMenuIsOpen && !xPressed}
                classNames="text"
                unmountOnExit
                timeout={100}
              >
                <button
                  onClick={() => {
                    setXPressed(false)
                    setOrderItemsMenuIsOpen(false)
                  }}
                  className="fixed bottom-5 right-5 flex items-center justify-between gap-5 rounded-xl bg-sunflowerYellow-light p-5 text-xl font-semibold"
                >
                  Close
                </button>
              </CSSTransition>
            </div>
          </CSSTransition>
        </>
      )}
    </>
  )
}
