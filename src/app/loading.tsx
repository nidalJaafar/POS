import Spinner from '@/components/Spinner'

function loading() {
  return (
    <div className="min-w-screen flex min-h-screen flex-col items-center justify-center">
      <Spinner />
    </div>
  )
}

export default loading
