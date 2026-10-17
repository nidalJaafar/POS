import Image from 'next/image'
import logo from '../../../public/logo-light.png'
import Link from 'next/link'

// Cream lettering: the logo sits on the dark green sidebar
function Logo() {
  return (
    <Link href="/">
      <Image src={logo} alt="Sunflower Crafts" className="h-auto w-44" priority />
    </Link>
  )
}

export default Logo
