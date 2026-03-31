export interface AgentTransactionDetailUploadedDoc {
  id: string;
  file_name: string;
  file_url: string;
  verification_status: string;
}

export function formatProfileAddress(
  profile: {
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  } | null
): string | null {
  if (!profile) return null;
  const parts = [
    profile.address,
    profile.city,
    profile.state,
    profile.postalCode,
    profile.country,
  ].filter((p): p is string => typeof p === "string" && p.trim().length > 0);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

export function pickLatestDocumentByType<
  T extends { documentType: string; uploadedAt: Date }
>(documents: T[], docType: string): T | undefined {
  const matches = documents.filter((d) => d.documentType === docType);
  if (matches.length === 0) return undefined;
  return matches.reduce((latest, d) => (d.uploadedAt > latest.uploadedAt ? d : latest));
}

export function mapDocSnippet(
  doc:
    | {
        id: string;
        fileName: string;
        fileUrl: string;
        verificationStatus: string;
      }
    | undefined
): AgentTransactionDetailUploadedDoc | null {
  if (!doc) return null;
  return {
    id: doc.id,
    file_name: doc.fileName,
    file_url: doc.fileUrl,
    verification_status: doc.verificationStatus,
  };
}
