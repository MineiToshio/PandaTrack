type FieldCharacterCountProps = {
  currentLength: number;
  maxLength: number;
  className?: string;
};

export default function FieldCharacterCount({
  currentLength,
  maxLength,
  className,
}: FieldCharacterCountProps) {
  return (
    <span className={className} aria-live="polite">
      {currentLength}/{maxLength}
    </span>
  );
}
