import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { CreateTicketPayload, ticketsService } from "../services/tickets.service";
import { CloudinaryService, uploadToCloudinary } from "../../../shared/utils/cloudinary";
import { PrismaClientRustPanicError } from "@prisma/client/runtime/library";

class TicketsController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await ticketsService.getStats();
    res.json(successResponse(result));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await ticketsService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const ticket = await ticketsService.get(req.params.id);
    res.json(successResponse(ticket));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
  let uploadedFile: Awaited<ReturnType<typeof uploadToCloudinary>> | undefined;

  try {
    if (req.file) {
      uploadedFile = await uploadToCloudinary(req.file.buffer, {
        folder: 'tickets',
        resourceType: 'auto',
        allowedFormats: ['jpg', 'jpeg', 'png', 'pdf'],
        maxFileSize: 2 * 1024 * 1024,
      });
    }

    const payload: CreateTicketPayload = {
      customer: req.body.customer,
      caseType: req.body.caseType,
      priorityLevel: req.body.priorityLevel,
      description: req.body.description,
      attachment: uploadedFile
        ? {
            url: uploadedFile.secureUrl,
            format: req.file?.mimetype || '',
            bytes: uploadedFile.bytes,
            publicId: uploadedFile.publicId,
          }
        : undefined,
    };

      const created = await ticketsService.create(payload);

      return res.status(201).json(successResponse(created));
    } catch (error) {
      // Prevent orphaned uploads if DB fails
      if (uploadedFile?.publicId) {
        await CloudinaryService.delete(uploadedFile.publicId, uploadedFile.resourceType as any).catch(() => {
        // Optional: log cleanup failure
        });
      }

      throw error;
    }
  });


  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const updated = await ticketsService.updateStatus(req.params.id, req.body.status, req.body?.notes, adminId);
    res.json(successResponse(updated));
  });

  assign = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const updated = await ticketsService.assignAgent(req.params.id, adminId);
    res.json(successResponse(updated));
  });

  comment = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const comment = await ticketsService.addComment(req.params.id, adminId, req.body.message);
    res.status(201).json(successResponse(comment));
  });
}

export const ticketsController = new TicketsController();
