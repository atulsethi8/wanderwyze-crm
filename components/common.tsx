
import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[3px]',
  };
  return (
    <div className={`animate-spin rounded-full border-line-strong border-t-brand ${sizeClasses[size]}`}></div>
  );
};

/** A panel. Everything that sits on the canvas should be one of these, not a bare div. */
export const Card: React.FC<{ children: React.ReactNode; className?: string; padded?: boolean }> = ({
  children,
  className = '',
  padded = true,
}) => (
  <section
    className={`bg-surface border border-line rounded-xl shadow-card ${padded ? 'p-5' : ''} ${className}`}
  >
    {children}
  </section>
);

/** Section heading with optional supporting line and right-aligned actions. */
export const SectionHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div className="min-w-0">
      <h2 className="text-lg font-semibold text-ink tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover border border-transparent shadow-card',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-canvas',
  ghost: 'bg-transparent text-ink-muted border border-transparent hover:bg-canvas hover:text-ink',
  danger: 'bg-danger text-white hover:bg-red-800 border border-transparent shadow-card',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
    icon?: React.ReactNode;
  }
> = ({ variant = 'secondary', size = 'md', icon, children, className = '', ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
      size === 'sm' ? 'text-xs px-2.5 py-1.5' : 'text-sm px-3.5 py-2'
    } ${BUTTON_VARIANTS[variant]} ${className}`}
  >
    {icon}
    {children}
  </button>
);

/** Quiet status chip: a tinted ground with a hairline ring rather than a solid block. */
export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brand';
  className?: string;
}> = ({ children, tone = 'neutral', className = '' }) => {
  const tones = {
    neutral: 'bg-canvas text-ink-muted ring-line',
    ok: 'bg-ok-subtle text-ok ring-ok-line',
    warn: 'bg-warn-subtle text-warn ring-warn-line',
    danger: 'bg-danger-subtle text-danger ring-danger-line',
    brand: 'bg-brand-subtle text-brand ring-blue-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ring-1 ring-inset whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
};

/** Shown in place of a table or list that has nothing to display. */
export const EmptyState: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="py-16 px-6 text-center">
    <p className="text-sm font-semibold text-ink">{title}</p>
    {description && <p className="text-sm text-ink-subtle mt-1 max-w-sm mx-auto">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, title, width = 'max-w-xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-[2px] z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className={`bg-surface rounded-xl shadow-overlay border border-line w-full ${width} m-4 relative`} onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-line">
          {title && <h3 className="text-base font-semibold text-ink tracking-tight">{title}</h3>}
          <button onClick={onClose} aria-label="Close" className="text-ink-subtle hover:text-ink rounded-md p-1 hover:bg-canvas transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

/* Labels sit in the small caps size so a dense form reads as structured rather than shouty,
   and every control shares one border, radius and disabled treatment. */
const LABEL = 'block text-label font-semibold uppercase text-ink-subtle mb-1.5';
const CONTROL =
  'w-full px-3 py-2 text-sm bg-surface border border-line-strong rounded-lg text-ink placeholder:text-ink-subtle transition-colors hover:border-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:bg-canvas disabled:text-ink-subtle disabled:cursor-not-allowed';

export const FormInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: React.ReactNode; containerClassName?: string }> = ({ label, containerClassName, icon, ...props }) => (
    <div className={containerClassName}>
        {label && <label className={LABEL}>{label}</label>}
        <div className="relative">
            <input {...props} className={`${CONTROL} ${props.readOnly ? 'bg-canvas' : ''} ${icon ? 'pr-10' : ''}`} />
            {icon && <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-subtle">{icon}</div>}
        </div>
    </div>
);

export const FormTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; containerClassName?: string }> = ({ label, containerClassName, ...props }) => (
    <div className={containerClassName}>
        <label className={LABEL}>{label}</label>
        <textarea {...props} className={CONTROL} />
    </div>
);

export const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; containerClassName?: string }> = ({ label, children, containerClassName, ...props }) => (
    <div className={containerClassName}>
        <label className={LABEL}>{label}</label>
        <select {...props} className={CONTROL}>
            {children}
        </select>
    </div>
);

export const Icons = {
  calendar: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  plus: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
  trash: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  user: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  logout: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  plane: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>,
  hotel: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 14a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 18a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>,
  excursion: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>,
  transfer: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" /></svg>,
  file: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
  comment: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.08-3.239A8.99 8.99 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM4.832 14.927l.86-.258A7 7 0 104.03 8.804l-.258.862L3 14l1.832.927z" clipRule="evenodd" /></svg>,
  payment: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm3 0a1 1 0 011-1h1a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
  chevronDown: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  eye: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  eyeSlash: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>,
  ai: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>,
  invoice: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h6.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 5a1 1 0 000 2h6a1 1 0 100-2H7zm0 4a1 1 0 100 2h4a1 1 0 100-2H7z" clipRule="evenodd" /></svg>,
};