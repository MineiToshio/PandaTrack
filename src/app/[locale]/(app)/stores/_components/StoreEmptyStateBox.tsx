import Typography from "@/components/core/Typography";

type StoreEmptyStateBoxProps = {
  message: string;
};

export default function StoreEmptyStateBox({ message }: StoreEmptyStateBoxProps) {
  return (
    <div className="border-border bg-background rounded-lg border border-dashed p-4">
      <Typography size="sm" className="text-text-muted">
        {message}
      </Typography>
    </div>
  );
}
