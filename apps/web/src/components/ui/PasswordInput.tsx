import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./Input";
import type { InputProps } from "./Input";

export type PasswordInputProps = Omit<InputProps, "type" | "rightSlot">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (props, ref) => {
    const [visible, setVisible] = useState(false);

    const rightSlot = (
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="p-1 text-text-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    );

    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        rightSlot={rightSlot}
        {...props}
      />
    );
  },
);

PasswordInput.displayName = "PasswordInput";
