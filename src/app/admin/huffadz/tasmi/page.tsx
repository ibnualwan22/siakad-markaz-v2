import { checkPermission } from "@/lib/permission";
import TasmiHuffadzClient from "./client";

export default async function TasmiHuffadzPage() {
  const canEdit = await checkPermission("huffadz_edit");
  return <TasmiHuffadzClient canEdit={canEdit} />;
}
