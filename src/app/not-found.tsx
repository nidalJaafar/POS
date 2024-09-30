'use client'
import notFoundImage from '@/../public/error.png'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-10">
      <div className="relative aspect-square w-52">
        <Image
          src={notFoundImage}
          alt="not found logo"
          fill
          className="object-cover"
        />
      </div>
      <div className="block h-52 border-l-2 border-solid border-charcoal"></div>
      <div className="text-xl">Page Not Found</div>
    </div>
  )
}
