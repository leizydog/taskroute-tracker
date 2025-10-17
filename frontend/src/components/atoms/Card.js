export const Card = ({ children, className = '', hoverable = false }) => (
    <div className={`bg-white/90 dark:bg-slate-800/90 shadow-md rounded-xl p-6 ${hoverable ? 'hover:shadow-lg transition-shadow' : ''} ${className}`}>
      {children}
    </div>
  );