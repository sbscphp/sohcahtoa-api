import { z } from "zod";

export const UpdateAgentNotificationPreferencesSchema = z
  .object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
  })
  .refine((data) => data.email !== undefined || data.sms !== undefined, {
    message: "At least one of email or sms is required",
  });

export type UpdateAgentNotificationPreferencesDto = z.infer<
  typeof UpdateAgentNotificationPreferencesSchema
>;
