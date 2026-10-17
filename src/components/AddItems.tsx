import { Plus, X } from 'lucide-react'

interface Params {
  isActive: boolean
  onActivate: () => void
  setIsActive: (value: boolean) => void
}

export default function AddItems({ isActive, setIsActive, onActivate }: Params) {
  if (!isActive) {
    return (
      <button
        onClick={() => { setIsActive(true); onActivate() }}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-ink shadow-sm transition-all hover:bg-primary-dark hover:shadow-md"
      >
        <Plus className="w-4" /> Add Item
      </button>
    )
  }
  return (
    <button
      onClick={() => setIsActive(false)}
      className="flex items-center gap-2 rounded-xl bg-panel px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition-all hover:bg-panel-dark"
    >
      <X className="w-4" /> Cancel
    </button>
  )
}
