import { Link } from 'react-router-dom'

const VARIANTS = {
  primary: 'bg-emerald-700 text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-800 focus-visible:ring-emerald-700',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 focus-visible:ring-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-emerald-700 dark:hover:bg-slate-700',
  inverse: 'bg-white text-emerald-900 shadow-lg shadow-emerald-950/10 hover:bg-emerald-50 focus-visible:ring-white',
}

const ActionLink = ({ to, href, variant = 'primary', children, className = '', ...props }) => {
  const classes = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${VARIANTS[variant]} ${className}`

  if (href) {
    return <a href={href} className={classes} {...props}>{children}</a>
  }

  return <Link to={to || '/'} className={classes} {...props}>{children}</Link>
}

export default ActionLink