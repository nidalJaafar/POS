'use client'

import { Item, OrderItem } from '@/lib/dto'
import { useItems } from '@/lib/context/ItemsContext'
import { useMemo, useState } from 'react'
import ItemCard from '../item/ItemCard'
import NewOrderGalleryItems from '../NewOrderGalleryItems'
import Header from './Header'
import OrderItemsMenu from './OrderItemsMenu'
import Spinner from '../Spinner'
import useIsMobile from '@/hooks/useIsMobile'

function NewOrderGallery() {
  const isMobile = useIsMobile()
  const { items } = useItems()

  const [searchQuery, setSearchQuery] = useState('')
  const [cartItems, setCartItems] = useState<OrderItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editedItem, setEditedItem] = useState<Item | null>(null)
  const [isPending, setIsPending] = useState(false)

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.deleted &&
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [items, searchQuery]
  )

  const deletedItems = useMemo(
    () => items.filter((item) => item.deleted),
    [items]
  )

  function addToCart(item: OrderItem) {
    setCartItems((prev) => [...prev, { ...item, quantity: 1 }])
    setCartOpen(true)
  }

  function removeFromCart(item: Item) {
    setCartItems((prev) => {
      const next = prev.filter((i) => i.id !== item.id)
      if (next.length === 0) setCartOpen(false)
      return next
    })
  }

  function updateCartItemQuantity(itemId: number, quantity: number) {
    if (quantity < 1) {
      removeFromCart({ id: itemId } as Item)
      return
    }
    setCartItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Header
        onSearch={setSearchQuery}
        showItemForm={showItemForm}
        setShowItemForm={setShowItemForm}
        editedItem={editedItem}
        setEditedItem={setEditedItem}
        setIsPending={setIsPending}
      />

      {/* The cart stays mounted while an action runs: it owns the transition, and
          unmounting it would leave the spinner up if the action fails */}
      {isPending && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner />
        </div>
      )}
      <div className={isPending ? 'hidden' : 'flex gap-6'}>
        {/* Item gallery */}
        <div className="flex min-w-0 flex-1 flex-col gap-10">
          <NewOrderGalleryItems
            title="Menu Items"
            active={filteredItems.length > 0}
          >
            <>
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onSelect={addToCart}
                  isDisabled={cartItems.some((i) => i.id === item.id)}
                  onEdit={(item) => {
                    setShowItemForm(true)
                    setEditedItem(item)
                  }}
                  withContextMenu
                />
              ))}
            </>
          </NewOrderGalleryItems>

          <NewOrderGalleryItems
            title="Deleted Items"
            active={deletedItems.length > 0}
          >
            <>
              {deletedItems.map((item) => (
                <ItemCard key={item.id} item={item} deleted withContextMenu />
              ))}
            </>
          </NewOrderGalleryItems>
        </div>

        {/* Desktop cart — always visible */}
        {!isMobile && (
          <OrderItemsMenu
            cartItems={cartItems}
            onRemove={removeFromCart}
            onQuantityChange={updateCartItemQuantity}
            setIsPending={setIsPending}
          />
        )}
      </div>

      {/* Mobile cart float */}
      {isMobile && (
        <>
          {cartItems.length > 0 && (
            <button
              onClick={() => setCartOpen(true)}
              className="fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-ink shadow-lg"
            >
              View Order ({cartItems.length})
            </button>
          )}

          {cartOpen && (
            <>
              <div
                className="fixed inset-0 z-20 bg-black/40"
                onClick={() => setCartOpen(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-surface p-6 shadow-2xl">
                <OrderItemsMenu
                  cartItems={cartItems}
                  onRemove={removeFromCart}
                  onQuantityChange={updateCartItemQuantity}
                  setIsPending={setIsPending}
                  onClose={() => setCartOpen(false)}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default NewOrderGallery
