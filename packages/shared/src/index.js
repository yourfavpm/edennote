"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarkUploadedSchema = exports.UploadUrlSchema = exports.CreateMeetingSchema = exports.ExportMeetingSchema = exports.ExportFormatSchema = exports.SummarySchema = void 0;
const zod_1 = require("zod");
// AI Summary Schema
exports.SummarySchema = zod_1.z.object({
    executive_summary: zod_1.z.string(),
    bullet_summary: zod_1.z.array(zod_1.z.string()),
    decisions: zod_1.z.array(zod_1.z.object({
        decision: zod_1.z.string(),
        owner: zod_1.z.string().optional(),
        timestamp_seconds: zod_1.z.number().optional(),
        quote: zod_1.z.string().optional(),
    })),
    action_items: zod_1.z.array(zod_1.z.object({
        task: zod_1.z.string(),
        owner: zod_1.z.string().optional(),
        due_date: zod_1.z.string().optional(),
        confidence: zod_1.z.number(),
        timestamp_seconds: zod_1.z.number().optional(),
        quote: zod_1.z.string().optional(),
    })),
    topics: zod_1.z.array(zod_1.z.object({
        title: zod_1.z.string(),
        start_time_seconds: zod_1.z.number(),
        summary: zod_1.z.string(),
        key_quotes: zod_1.z.array(zod_1.z.object({
            quote: zod_1.z.string(),
            speaker: zod_1.z.string().optional(),
            timestamp_seconds: zod_1.z.number().optional(),
        })).optional(),
    })),
    risks: zod_1.z.array(zod_1.z.string()),
    questions: zod_1.z.array(zod_1.z.string()),
});
// BullMQ Job Types
exports.ExportFormatSchema = zod_1.z.enum(['pdf', 'docx', 'json', 'txt']);
exports.ExportMeetingSchema = zod_1.z.object({
    format: exports.ExportFormatSchema
});
// Endpoints Schemas
exports.CreateMeetingSchema = zod_1.z.object({
    workspace_id: zod_1.z.string().uuid(),
    title: zod_1.z.string().min(1),
    source: zod_1.z.enum(['recording', 'upload']),
    recording_mime: zod_1.z.string().optional(),
});
exports.UploadUrlSchema = zod_1.z.object({
    file_ext: zod_1.z.string().min(1),
    mime_type: zod_1.z.string().min(1),
});
exports.MarkUploadedSchema = zod_1.z.object({
    object_path: zod_1.z.string().min(1),
    recording_mime: zod_1.z.string().optional(),
});
