import Grid from './Grid'

export default function NewOrderGalleryItems({
  title,
  active,
  children,
}: {
  title: string
  active: boolean
  children: React.ReactElement
}) {
  if (!active) return null
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-medium text-ink-light uppercase tracking-wide">{title}</h3>
      <Grid>{children}</Grid>
    </div>
  )
}
