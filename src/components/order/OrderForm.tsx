'use client'
import { addItemToMenu } from '@/lib/actions'
import { Item } from '@/lib/dto'
import { Coffee, DollarSign, Save } from 'lucide-react'
import React, { FormEvent, useEffect, useState, useTransition } from 'react'

import { useForm } from 'react-hook-form'
interface Params {
  item: Item | null
  setAddedItemActive: (value: boolean) => void
  setPending: (state: boolean) => void
}

export default function OrderForm({
  item,
  setAddedItemActive,
  setPending,
}: Params) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { register } = useForm({
    defaultValues: {
      ...item,
    },
  })
  useEffect(() => {
    if (item?.image) {
      setImagePreview(item.image)
    }
  }, [item])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }
  return (
    <form
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const data = new FormData(e.target as HTMLFormElement)
        data.delete('image')
        if (selectedFile) {
          data.append('image', selectedFile)
        } else {
          data.append('image', item?.image || '')
        }
        setPending(true)
        await addItemToMenu(data)
        setPending(false)
      }}
      encType="multipart/form-data"
      className="mt-5 flex h-max max-w-fit flex-col items-start justify-center gap-10"
    >
      {imagePreview && (
        <img
          src={imagePreview}
          alt="Image preview"
          className="mb-4 h-24 w-24 rounded object-cover"
        />
      )}
      <label
        htmlFor="image"
        className="mr-5 cursor-pointer rounded-xl border-0 bg-sunflowerYellow-light p-2 text-charcoal hover:cursor-pointer"
      >
        Choose an image
      </label>
      <input
        {...register('image')}
        type="file"
        className="hidden"
        id="image"
        onChange={handleFileChange}
      />
      <div className="flex items-center gap-0">
        <DollarSign className="w-5" />
        <input
          {...register('price')}
          type="number"
          step={0.01}
          placeholder="Item price"
          className="w-fit rounded-xl p-3 focus:outline-0"
        />
      </div>
      <div className="flex items-center gap-0">
        <Coffee className="w-5" />
        <input
          {...register('name')}
          type="text"
          placeholder="Item name"
          className="w-fit rounded-xl p-3 focus:outline-0"
        />
      </div>
      <input type="hidden" {...register('id')} />
      <button
        onClick={() => setAddedItemActive(false)}
        className="flex items-center justify-center gap-2 rounded-xl bg-sunflowerYellow-light p-2 text-charcoal"
      >
        <Save className="text-charcoal" /> Save
      </button>
    </form>
  )
}
