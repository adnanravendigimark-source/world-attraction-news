import { sql } from "./db";
import type { Session } from "./auth";

// Admin audit log — every meaningful admin mutation (user approve/reject/
// suspend, article approve/reject/publish/edit/delete/score, city/category
// changes, event create/edit/delete) calls logActivity() so /admin/activity
// has a real record instead of a static/fake list. Logging failures never
// block the action itself (best-effort) — an audit log write failing is not
// a reason to fail the actual admin action.
export interface ActivityEntry {
  id: number;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

function rowToActivity(row: any): ActivityEntry {
  return {
    id: row.id,
    adminId: row.admin_id,
    adminEmail: row.admin_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetLabel: row.target_label,
    metadata: row.metadata ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function logActivity(
  admin: Pick<Session, "userId" | "email">,
  action: string,
  target: { type: string; id: string; label: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await sql`
      INSERT INTO activity_log (admin_id, admin_email, action, target_type, target_id, target_label, metadata)
      VALUES (${admin.userId}, ${admin.email}, ${action}, ${target.type}, ${target.id}, ${target.label}, ${
      metadata ? JSON.stringify(metadata) : null
    })
    `;
  } catch (err) {
    console.error("[activity log] failed to record entry:", err);
  }
}

export async function getActivityLog(limit = 200): Promise<ActivityEntry[]> {
  try {
    const rows = await sql`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(rowToActivity);
  } catch {
    return [];
  }
}
