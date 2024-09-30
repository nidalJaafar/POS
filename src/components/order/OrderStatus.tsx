interface Params {
  status: string
}

function getClass(status: string): string {
  if (status === 'pending') return 'bg-skyBlue'
  if (status === 'completed') return 'bg-mintGreen'
  return 'bg-pastelPink'
}

export default function OrderStatus({ status }: Params) {
  return (
    <div
      className={`bg-pin flex items-center justify-center rounded-full px-2 py-1 text-lg ${getClass(status)}`}
    >
      {status}
    </div>
  )
}
