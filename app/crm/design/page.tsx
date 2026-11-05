import { notFound } from "next/navigation";
import { DesignSpecimen } from "@/components/crm/DesignSpecimen";

/** Dev-only preview of the Command design system with sample data. Not available in production. */
export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignSpecimen />;
}
