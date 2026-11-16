import { forwardRef, type InputHTMLAttributes } from 'react';
import { Input } from '@ui-sdk/react/input';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> & { value?: string; defaultValue?: string; invalid?: boolean };

export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput({ invalid, ...rest }, ref) {
  return <Input ref={ref} aria-invalid={invalid || undefined} data-invalid={invalid ? '' : undefined} {...rest} />;
});
