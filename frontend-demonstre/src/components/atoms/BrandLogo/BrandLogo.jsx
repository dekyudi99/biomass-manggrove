import { Link } from 'react-router-dom'
import logo from '../../../assets/logo.png'

const BrandLogo = ({ className = '', imageClassName = 'h-10 w-10', showName = true }) => (
  <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`} aria-label="Grovia home">
    <img src={logo} alt="" className={`${imageClassName} brand-logo-image object-contain`} />
    {showName && <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Grovia</span>}
  </Link>
)

export default BrandLogo