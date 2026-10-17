'use client'
import { Item } from '@/lib/dto'
import AddItems from '../AddItems'
import OrderForm from '../order/OrderForm'
import Search from '../Search'

interface Params {
  onSearch: (query: string) => void
  showItemForm: boolean
  setShowItemForm: (v: boolean) => void
  editedItem: Item | null
  setEditedItem: (v: Item | null) => void
  setIsPending: (v: boolean) => void
}

export default function Header({
  onSearch,
  showItemForm,
  setShowItemForm,
  editedItem,
  setEditedItem,
  setIsPending,
}: Params) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Search onSearch={onSearch} />
        <AddItems
          isActive={showItemForm}
          onActivate={() => setEditedItem(null)}
          setIsActive={setShowItemForm}
        />
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          showItemForm ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <OrderForm
          setPending={setIsPending}
          item={editedItem}
          setAddedItemActive={setShowItemForm}
        />
      </div>
    </div>
  )
}
