import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/org";

export default async function OrgHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { role } = await requireOrgContext(slug);
  redirect(`/org/${slug}/${role === "cleaner" ? "cleaning" : "dashboard"}`);
}
