import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
};

export function Input({ label, error, id, className = '', ...rest }: Props) {
  const inputId = id ?? `input-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-800">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        {...rest}
        className={`min-h-10 rounded-lg border px-3 py-2 text-start text-base ${
          error ? 'border-red-500' : 'border-neutral-300'
        } ${className}`}
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
