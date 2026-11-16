import { Switch as Part, SwitchThumb } from '@ui-sdk/react/switch';

export function Switch({ checked, onCheckedChange, disabled, className, 'aria-label': ariaLabel }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; className?: string; 'aria-label'?: string;
}) {
  return (
    <Part checked={checked} disabled={disabled} aria-label={ariaLabel} className={className}
      onClick={(e) => e.stopPropagation()} onCheckedChange={(v) => onCheckedChange(v)}>
      <SwitchThumb />
    </Part>
  );
}
