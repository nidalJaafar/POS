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
  return (
    active && (
      <div className="flex flex-col justify-start gap-5">
        <h3 className="text-2xl font-bold">{title}</h3>
        <Grid>{children}</Grid>
      </div>
    )
  )
}
