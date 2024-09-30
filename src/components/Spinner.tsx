import Image from 'next/image'
import spinner from '@/../public/logo-spinner.png'

function Spinner() {
  return (
    <Image
      className="aspect-square h-[120px] animate-spin"
      src={spinner}
      alt="spinner"
      width={120}
      height={120}
    />
  )
}

export default Spinner
