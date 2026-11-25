import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { ChangeEvent } from "react";
import { Icon } from "./Icon.js";

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: string | undefined;
  children?: ReactNode;
}

export function Button({
  variant = "default",
  size = "md",
  icon,
  children,
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={["ts-btn", className].filter(Boolean).join(" ")}
      data-variant={variant}
      data-size={size}
      {...rest}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: string;
  label: string;
  active?: boolean;
  size?: "md" | "lg";
  shortcut?: string;
}

/** Icon-only button: always carries an aria-label and a tooltip with shortcut. */
export function IconButton({
  icon,
  label,
  active,
  size = "md",
  shortcut,
  type = "button",
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={["ts-icon-btn", className].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      data-size={size}
      data-active={active ? "true" : undefined}
      {...rest}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, children }: FieldProps) {
  return (
    <div className="ts-field">
      <label className="ts-field-label" {...(htmlFor ? { htmlFor } : {})}>
        {label}
        {hint ? <span className="ts-faint">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      className="ts-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  disabled,
}: SliderProps) {
  return (
    <div className="ts-field">
      <div className="ts-row-between">
        <span className="ts-field-label">{label}</span>
        <span className="ts-range-value ts-num">{format ? format(value) : value}</span>
      </div>
      <div className="ts-range">
        <input
          type="range"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  id?: string;
}

export function Select({ label, value, options, onChange, id }: SelectProps) {
  return (
    <div className="ts-field">
      <label className="ts-field-label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="ts-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <span className="ts-badge" data-tone={tone ?? "neutral"}>
      {children}
    </span>
  );
}

export function Spinner() {
  return <span className="ts-spinner" aria-hidden="true" />;
}
