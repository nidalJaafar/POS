'use client'
import { Item } from '@/lib/dto'
import { CSSTransition } from 'react-transition-group'
import AddItems from '../AddItems'
import OrderForm from '../order/OrderForm'
import Search from '../Search'

interface Params {
  handleFilteredItems: (items: Item[]) => void
  addItemActive: boolean
  setAddItemActive: (state: boolean) => void
  editedItem: Item | null
  setEditedItem: (state: Item | null) => void
  setPending: (state: boolean) => void
}

export default function Header({
  handleFilteredItems,
  addItemActive,
  setAddItemActive,
  editedItem,
  setEditedItem,
  setPending,
}: Params) {
  return (
    <>
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-10">
        <Search handleFilteredItems={handleFilteredItems} />
        <AddItems
          isActive={addItemActive}
          onActivate={() => setEditedItem(null)}
          setIsActive={setAddItemActive}
        />
      </div>
      <CSSTransition
        key="form"
        in={addItemActive}
        classNames="slide"
        unmountOnExit
        timeout={300}
        addEndListener={(node, done) => {
          node.addEventListener('transitionend', done, false)
        }}
      >
        <OrderForm
          setPending={setPending}
          item={editedItem}
          setAddedItemActive={setAddItemActive}
        />
      </CSSTransition>
    </>
  )
}
