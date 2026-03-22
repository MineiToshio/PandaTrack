import Typography from "@/components/core/Typography";

type StoreEmptyStateBoxProps = {
  message: string;
};

export default function StoreEmptyStateBox({ message }: StoreEmptyStateBoxProps) {
  return (
    <div className="border-border/70 bg-background/60 rounded-lg border border-dashed px-4 py-6 text-center">
      <Typography size="sm" className="text-text-muted">
        {message}
      </Typography>
    </div>
  );
}
