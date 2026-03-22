import type { PropsWithChildren } from "react";

export function Card(props: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={["rounded-2xl border border-slateGrey/15 bg-white/55 shadow-pepla", props.className ?? ""].join(" ")}>
      {props.children}
    </div>
  );
}

export function CardHeader(props: PropsWithChildren<{ className?: string }>) {
  return <div className={["px-6 pt-6", props.className ?? ""].join(" ")}>{props.children}</div>;
}

export function CardBody(props: PropsWithChildren<{ className?: string }>) {
  return <div className={["px-6 pb-6 pt-4", props.className ?? ""].join(" ")}>{props.children}</div>;
}

export function Label(props: PropsWithChildren<{ htmlFor?: string }>) {
  return (
    <label htmlFor={props.htmlFor} className="font-display tracking-pepla text-[11px] uppercase opacity-80">
      {props.children}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={[
        "w-full rounded-xl border border-slateGrey/20 bg-sand/40 px-3 py-2 font-body text-[15px] outline-none focus:border-slateGrey/40",
        className ?? ""
      ].join(" ")}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={[
        "w-full min-h-[120px] resize-y rounded-xl border border-slateGrey/20 bg-sand/40 px-3 py-2 font-body text-[15px] outline-none focus:border-slateGrey/40",
        className ?? ""
      ].join(" ")}
    />
  );
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost" | "danger";
    size?: "sm" | "md";
  }
) {
  const { className, variant = "primary", size = "md", ...rest } = props;
  const base =
    "inline-flex items-center justify-center rounded-xl border px-4 font-display uppercase tracking-pepla text-[11px] transition disabled:opacity-50";
  const sizes = size === "sm" ? "h-9" : "h-10";
  const variants =
    variant === "primary"
      ? "border-slateGrey/30 bg-slateGrey text-sand hover:bg-slateGrey/90"
      : variant === "danger"
        ? "border-deepRed/40 bg-deepRed text-sand hover:brightness-95"
        : "border-slateGrey/20 bg-transparent hover:bg-slateGrey/5";

  return <button {...rest} className={[base, sizes, variants, className ?? ""].join(" ")} />;
}

