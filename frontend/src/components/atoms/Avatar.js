export const Avatar = ({ name, src, size = 'md' }) => {
    const sizes = {
      sm: 'w-8 h-8 text-xs',
      md: 'w-10 h-10 text-sm',
      lg: 'w-16 h-16 text-lg',
    };
  
    const initials = name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  
    return (
      <div className={`${sizes[size]} rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-300`}>
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover rounded-full" />
        ) : (
          initials
        )}
      </div>
    );
  };