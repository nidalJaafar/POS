import { PlusIcon, X } from 'lucide-react'
import React from 'react'

interface Params {
  isActive: boolean
  onActivate: () => void
  setIsActive: (value: boolean) => void
}

export default function AddItems({
  isActive,
  setIsActive,
  onActivate,
}: Params) {
  function handleActivate() {
    setIsActive(true)
    onActivate()
  }
  function handleCancel() {
    setIsActive(false)
  }

  return !isActive ? (
    <button
      onClick={handleActivate}
      className="flex w-fit items-center justify-center gap-2 rounded-xl bg-sunflowerYellow-light p-2 text-charcoal"
    >
      <PlusIcon className="w-5" /> Add Items
    </button>
  ) : (
    <>
      <button
        onClick={handleCancel}
        className="flex w-fit items-center justify-center gap-2 rounded-xl bg-sunflowerYellow-light p-2 text-charcoal"
      >
        <X /> Cancel
      </button>
    </>
  )
}
