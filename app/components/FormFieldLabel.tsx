import type { ReactNode } from "react";

type FormFieldLabelProps = {
  htmlFor?: string;
  required?: boolean;
  optionalHint?: string;
  children: ReactNode;
  className?: string;
};

export default function FormFieldLabel({
  htmlFor,
  required = false,
  optionalHint,
  children,
  className,
}: FormFieldLabelProps) {
  const content = (
    <>
      {children}
      {optionalHint ? (
        <span className="ml-1 text-xs font-normal text-slate-500">({optionalHint})</span>
      ) : null}
      {required ? (
        <>
          <span className="ml-0.5 font-semibold text-rose-600" aria-hidden="true">*</span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
    </>
  );
  const classes = className ?? "text-sm font-semibold text-slate-900";

  return htmlFor ? (
    <label htmlFor={htmlFor} className={classes}>{content}</label>
  ) : (
    <span className={classes}>{content}</span>
  );
}
