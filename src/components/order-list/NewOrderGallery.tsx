'use client'

import useIsMobile from '@/hooks/useIsMobile'
import { Item, OrderItem } from '@/lib/dto'
import { useAppSelector } from '@/lib/store/reduxHooks'
import { useEffect, useState } from 'react'
import ItemCard from '../item/ItemCard'
import NewOrderGalleryItems from '../NewOrderGalleryItems'
import Spinner from '../Spinner'
import Header from './Header'
import OrderItemsMenu from './OrderItemsMenu'

function NewOrderGallery() {
  const isMobile = useIsMobile()
  const items = useAppSelector((state) => state.items)
  const deletedItems = items.filter((item) => item.deleted)

  const [editedItem, setEditedItem] = useState<Item | null>(null)
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([])
  const [addedItemActive, setAddedItemActive] = useState<boolean>(false)
  const [filteredItems, setFilteredItems] = useState<Item[]>(() =>
    items.filter((item) => !item.deleted)
  )
  const [isMounted, setIsMounted] = useState(false)
  const [orderItemsMenuIsOpen, setOrderItemsMenuIsOpen] = useState(false)
  const [isPending, setIsPending] = useState<boolean>(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setFilteredItems(items.filter((item) => !item.deleted))
  }, [items])

  function handleSelectedItem(item: OrderItem) {
    item.quantity = 1
    setOrderItemsMenuIsOpen(true)
    setSelectedItems((prev) => [...prev, item])
  }
  function handleRemovedItem(item: Item) {
    setSelectedItems((items) => items.filter((i) => i.id !== item.id))
  }
  if (!isMounted) {
    return null
  }

  return (
    <div className="flex flex-col gap-5 transition-all">
      <Header
        handleFilteredItems={setFilteredItems}
        addItemActive={addedItemActive}
        setAddItemActive={setAddedItemActive}
        editedItem={editedItem}
        setPending={setIsPending}
        setEditedItem={setEditedItem}
      />
      <div className="sm:flex sm:items-start sm:justify-center">
        <div className="flex flex-1 flex-col gap-10">
          {isPending ? (
            <div className="min-w-screen flex min-h-screen flex-col items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <NewOrderGalleryItems
                title="Menu Items"
                active={filteredItems.length !== 0}
              >
                <>
                  {filteredItems.map((item) => (
                    <ItemCard
                      item={item}
                      key={item.id}
                      onSelect={handleSelectedItem}
                      isDisabled={
                        selectedItems.filter((i) => i.id === item.id).length > 0
                      }
                      onEdit={(item) => {
                        setAddedItemActive(true)
                        setEditedItem(item)
                      }}
                      withContextMenu
                    />
                  ))}
                </>
              </NewOrderGalleryItems>
              <NewOrderGalleryItems
                title="Deleted Items"
                active={deletedItems.length !== 0}
              >
                <>
                  {deletedItems.map((item) => (
                    <ItemCard
                      item={item}
                      key={item.id}
                      deleted
                      withContextMenu
                    />
                  ))}
                </>
              </NewOrderGalleryItems>
            </>
          )}
        </div>
        <OrderItemsMenu
          setSelectedItems={setSelectedItems}
          isMobile={isMobile}
          selectedItems={selectedItems}
          orderItemsMenuIsOpen={orderItemsMenuIsOpen}
          setOrderItemsMenuIsOpen={setOrderItemsMenuIsOpen}
          handleRemovedItem={handleRemovedItem}
          handlePending={setIsPending}
        />
      </div>
    </div>
  )
}
export default NewOrderGallery
