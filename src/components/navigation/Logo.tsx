import Image from 'next/image'
import logo from '../../../public/logo.png'
import Link from 'next/link'

function Logo() {
  return (
    <Link href="/">
      <Image src={logo} width={120} height={120} alt="logo"></Image>
    </Link>
  )
}

export default Logo