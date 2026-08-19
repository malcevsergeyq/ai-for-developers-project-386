import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function NotFoundPage() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Страница не найдена</h1>
      <p className="mt-2 text-sm text-muted-foreground">Такого адреса в приложении нет.</p>
      <Link to="/" className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
        На главную
      </Link>
    </section>
  )
}
