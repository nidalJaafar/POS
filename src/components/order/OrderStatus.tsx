interface Params {
  status: 'pending' | 'completed'
}

function badgeClass(status: string): string {
  if (status === 'pending') return 'bg-primary-light text-ink'
  if (status === 'completed') return 'bg-success text-success-ink'
  return 'bg-danger text-danger-ink'
}

export default function OrderStatus({ status }: Params) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${badgeClass(status)}`}
    >
      {status}
    </span>
  )
}
