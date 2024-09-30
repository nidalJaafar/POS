interface Params {
  children: React.ReactNode
  className?: string
}

export default function Grid({ children, className }: Params) {
  return (
    <div
      className={`${className ? className : ''} grid grid-cols-2 gap-5 transition-all duration-300 sm:mr-10 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]`}
    >
      {children}
    </div>
  )
}
