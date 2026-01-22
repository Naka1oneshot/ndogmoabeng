import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  defaultValue?: number;
}

/**
 * NumberInput - A number input that allows deleting all digits
 * and restores to the default/previous value on blur if empty or invalid.
 */
const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, min, max, defaultValue = 0, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState(String(value));
    const previousValidValue = React.useRef(value);

    // Sync display value when external value changes
    React.useEffect(() => {
      setDisplayValue(String(value));
      previousValidValue.current = value;
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Allow empty string and valid number patterns (including negative)
      if (inputValue === '' || inputValue === '-' || /^-?\d*$/.test(inputValue)) {
        setDisplayValue(inputValue);
      }
    };

    const handleBlur = () => {
      let numValue = parseInt(displayValue, 10);
      
      // If invalid or empty, restore to previous valid value or default
      if (isNaN(numValue) || displayValue === '' || displayValue === '-') {
        numValue = previousValidValue.current ?? defaultValue;
      }
      
      // Apply min/max constraints
      if (min !== undefined && numValue < min) {
        numValue = min;
      }
      if (max !== undefined && numValue > max) {
        numValue = max;
      }
      
      setDisplayValue(String(numValue));
      previousValidValue.current = numValue;
      onChange(numValue);
    };

    return (
      <input
        type="text"
        inputMode="numeric"
        pattern="-?[0-9]*"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  },
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
