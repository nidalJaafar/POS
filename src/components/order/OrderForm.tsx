'use client'
import { addItemToMenu } from '@/lib/actions'
import { Item } from '@/lib/dto'
import { Coffee, DollarSign, Save } from 'lucide-react'
import React, { FormEvent, useEffect, useRef, useState, useTransition } from 'react'

interface Params {
  item: Item | null
  setAddedItemActive: (value: boolean) => void
  setPending: (state: boolean) => void
}

export default function OrderForm({ item, setAddedItemActive, setPending }: Params) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => { setPending(isPending) }, [isPending, setPending])

  // Inputs are uncontrolled, so reset them to the new item's values when it changes
  useEffect(() => {
    formRef.current?.reset()
    setImagePreview(item?.image ?? null)
    setSelectedFile(null)
  }, [item])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.target as HTMLFormElement)
    data.delete('image')
    if (selectedFile) data.append('image', selectedFile)
    else data.append('image', item?.image ?? '')
    startTransition(() => addItemToMenu(data))
    setAddedItemActive(false)
    formRef.current?.reset()
    setImagePreview(item?.image ?? null)
    setSelectedFile(null)
  }

  const inputClass =
    'w-full rounded-xl bg-panel-light px-4 py-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-primary border border-panel-dark/30'

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="mt-2 flex flex-col gap-4 rounded-2xl bg-surface p-6 sm:max-w-sm shadow-sm"
    >
      {imagePreview && (
        // eslint-disable-next-line @next/next/no-img-element -- previews a local data: URL
        <img
          src={imagePreview}
          alt="Preview"
          className="h-24 w-24 rounded-xl object-cover"
        />
      )}

      <label
        htmlFor="image"
        className="cursor-pointer rounded-xl bg-primary-light px-4 py-2 text-center text-sm font-medium text-ink hover:bg-primary hover:text-primary-ink transition-colors"
      >
        Choose image
      </label>
      <input
        type="file"
        id="image"
        name="image"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="relative">
        <DollarSign className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-ink-light" />
        <input
          name="price"
          type="number"
          step={0.01}
          min={0}
          defaultValue={item?.price}
          placeholder="Price"
          aria-label="Price"
          className={`${inputClass} pl-9`}
          required
        />
      </div>

      <div className="relative">
        <Coffee className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-ink-light" />
        <input
          name="name"
          type="text"
          defaultValue={item?.name}
          placeholder="Item name"
          aria-label="Item name"
          className={`${inputClass} pl-9`}
          required
        />
      </div>

      <input type="hidden" name="id" defaultValue={item?.id} />

      <button
        type="submit"
        disabled={isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-ink shadow-sm transition-all hover:bg-primary-dark disabled:opacity-60"
      >
        <Save className="w-4" /> Save
      </button>
    </form>
  )
}
