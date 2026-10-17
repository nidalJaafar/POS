interface Params {
  children: React.ReactNode
  className?: string
}

export default function Grid({ children, className }: Params) {
  return (
    <div
      className={`${className ?? ''} grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]`}
    >
      {children}
    </div>
  )
}
