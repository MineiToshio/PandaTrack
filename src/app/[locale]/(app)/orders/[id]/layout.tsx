import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/auth-server";
import { getOrderHeader } from "@/lib/data/orders/orderQueries";
import OrderSegmentContentHeader from "./_components/OrderSegmentContentHeader";

type OrderDetailLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
};

export default async function OrderDetailLayout({ children, params }: OrderDetailLayoutProps) {
  const { locale, id } = await params;
  const session = await getSession();
  if (!session?.user?.id) redirect(`/${locale}/sign-in`);

  const order = await getOrderHeader(id, session.user.id);
  if (!order) notFound();

  return (
    <>
      <OrderSegmentContentHeader locale={locale} orderId={order.id} humanReadableId={order.humanReadableId} />
      {children}
    </>
  );
}
