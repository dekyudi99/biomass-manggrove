const LANGUAGES = [
  { id: 'id', label: 'ID' },
  { id: 'en', label: 'EN' },
  { id: 'th', label: 'TH' },
]

const LanguageSwitcher = ({ value, onChange, label = 'Language', className = '' }) => (
  <label className={`inline-flex items-center gap-2 ${className}`}>
    <span className="sr-only">{label}</span>
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="cursor-pointer rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 outline-none transition hover:border-emerald-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      {LANGUAGES.map((language) => (
        <option key={language.id} value={language.id}>{language.label}</option>
      ))}
    </select>
  </label>
)

export default LanguageSwitcher