export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-in">
      {Icon && (
        <div className="h-14 w-14 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mb-4">
          <Icon size={26} />
        </div>
      )}
      <h3 className="text-slate-100 font-semibold text-base">{title}</h3>
      {description && <p className="text-slate-400 text-sm mt-1.5 max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
