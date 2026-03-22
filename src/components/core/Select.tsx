import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/styles";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  error?: boolean;
  /**
   * When true, hides the native chevron and shows a Lucide chevron aligned with theme tokens.
   * Use for layouts that need a custom-styled control (e.g. modals with rounded-xl fields).
   */
  showChevron?: boolean;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, showChevron = false, children, ...props }, ref) => {
    const selectClassName = cn(
      "border-input bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background w-full cursor-pointer border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      showChevron
        ? "flex h-10 appearance-none items-center rounded-md py-2 pr-10 pl-3"
        : "block h-10 rounded-md px-3 py-2",
      error && "border-destructive focus-visible:ring-destructive",
      className,
    );

    const selectElement = (
      <select ref={ref} className={selectClassName} {...props}>
        {children}
      </select>
    );

    if (!showChevron) {
      return selectElement;
    }

    return (
      <div className="relative">
        {selectElement}
        <ChevronDown
          className="text-text-muted pointer-events-none absolute top-1/2 right-3 size-4 shrink-0 -translate-y-1/2"
          aria-hidden
        />
      </div>
    );
  },
);

Select.displayName = "Select";

export default Select;
