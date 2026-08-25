'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  idleLabel,
  pendingLabel = 'Salvando...',
  className = 'button',
  name,
  value,
}: {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      name={name}
      value={value}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
